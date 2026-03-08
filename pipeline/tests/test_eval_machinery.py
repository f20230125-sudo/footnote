import json

import pytest

from conftest import answer_json
from footnote.answer import Answer
from footnote.dataset import Evidence, Question
from footnote.embed import Embedder
from footnote.evals.answers import (
    CONFIGS,
    Context,
    out_path,
    read_records,
    run_questions,
    stratified_subset,
)
from footnote.evals.report import bootstrap_ci, comparisons, paired_diff, summarise, table
from footnote.judge import judge, numbers_in, rule_match
from footnote.llm import Budget, Limits, Store
from footnote.llm.router import AllEndpointsExhausted
from footnote.llm.store import Completion
from footnote.retrievers import Retrievers, rrf
from footnote.settings import MissingKey, build_runtime, load_env


class BowProvider:
    """Embeds by word counts in 64 buckets, so similar texts get similar vectors. Counts its calls."""

    def __init__(self):
        self.calls = 0
        self.texts = 0

    def embed(self, model, texts, *, task):
        self.calls += 1
        self.texts += len(texts)
        out = []
        for t in texts:
            v = [0.0] * 64
            for w in t.lower().split():
                v[sum(map(ord, w)) % 64] += 1.0
            out.append(v)
        return out


def make_embedder(store=None):
    store = store or Store(":memory:")
    p = BowProvider()
    b = Budget("emb", Limits(1000, 10**9, 10**6, 10**12), store)
    return Embedder(p, "m", store, b, batch=2), p


def test_embeddings_are_cached_deduplicated_and_batched():
    e, p = make_embedder()
    v = e.embed(["alpha beta", "gamma", "alpha beta", "delta"], "RETRIEVAL_DOCUMENT")
    assert v.shape == (4, 64) and p.texts == 3 and p.calls == 2  # 3 distinct texts, batches of 2
    assert abs((v[0] ** 2).sum() - 1) < 1e-5  # unit length
    e.embed(["alpha beta", "gamma"], "RETRIEVAL_DOCUMENT")
    assert p.calls == 2  # all from the cache
    e.embed(["alpha beta"], "RETRIEVAL_QUERY")
    assert p.calls == 3  # a different task is a different vector


def test_rrf_prefers_pages_ranked_well_by_both():
    a, b, c = ("d", 1), ("d", 2), ("d", 3)
    assert rrf([a, b], [b, c])[0] == b  # found by both rankers beats found by one
    assert rrf([a], [a])[0] == a


def test_hybrid_reorders_bm25_candidates_by_meaning(corpus, resolver):
    e, _ = make_embedder()
    r = Retrievers(corpus, resolver, e)
    q = Question(
        id="q", company="Acme", doc_name="ACME_2020_10K", question_type="t", reasoning=None,
        question="Acme revenue net income", answer="", justification="", evidence=[],
    )  # fmt: skip
    hits = r.hybrid(q, 3, setting="full", use_filter=True)
    assert hits and all(d.startswith("ACME") for d, _ in hits)
    assert r.bm25(q, 2, setting="oracle") == [h for h in r.bm25(q, 2, setting="oracle")]
    with pytest.raises(RuntimeError):
        Retrievers(corpus, resolver).hybrid(q, 3, setting="full")


# --- judge ------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("text", "want"),
    [
        ("$1,577.00", [1577.0]),
        ("(120) and 12.5%", [-120.0, 12.5]),
        ("-3.2 points", [-3.2]),
        ("FY2018 was 8.7 times", [8.7]),  # digits glued to letters are a label, not a figure
        ("no figures here", []),
    ],
)
def test_numbers_in(text, want):
    assert numbers_in(text) == want


def test_rule_match():
    assert rule_match("$1577.00", "Capex was $1,577 million in FY2018") is True
    assert rule_match("$1577.00", "Capex was $1,488 million") is False
    assert rule_match("12.5%", "margin of 12.5 percent") is True
    assert rule_match("No, it is not growing", "It grew 4%") is None  # no single reference number
    assert rule_match("1.5 and 2.5", "1.5") is None


class JudgeChat:
    def __init__(self, reply):
        self.reply, self.n = reply, 0

    def complete(self, messages, **kw):
        self.n += 1
        return Completion(self.reply, 50, 10, "judge-m")


def cited(text="Capex was $1,577 million."):
    return Answer.model_validate_json(answer_json(text=text))


def test_judge_uses_the_model_verdict_and_records_the_rule():
    j = judge(
        JudgeChat('{"verdict": "correct", "reason": "same figure"}'), "q", "$1577.00", "", cited()
    )
    assert (j.verdict, j.rule_match, j.judge_model, j.judge_tokens) == (
        "correct",
        True,
        "judge-m",
        60,
    )


def test_a_refused_answer_is_not_sent_to_the_judge():
    chat = JudgeChat("{}")
    j = judge(chat, "q", "1", "", Answer(answer="not found", refused=True))
    assert j.verdict == "refused" and chat.n == 0
    assert judge(chat, "q", "1", "", None).verdict == "refused"


def test_an_unreadable_judge_reply_is_unjudged_not_a_guess():
    assert judge(JudgeChat("probably fine"), "q", "1", "", cited()).verdict == "unjudged"
    assert judge(JudgeChat('{"verdict": "maybe"}'), "q", "1", "", cited()).verdict == "unjudged"


# --- settings ---------------------------------------------------------------------------------


def test_env_file_parsing(tmp_path):
    f = tmp_path / ".env"
    f.write_text('# c\nGROQ_API_KEY="abc"\nGEMINI_MODEL = gm\n\nbad line\n', encoding="utf-8")
    assert load_env(f) == {"GROQ_API_KEY": "abc", "GEMINI_MODEL": "gm"}
    assert load_env(tmp_path / "missing") == {}


def test_runtime_wiring_and_missing_keys():
    with pytest.raises(MissingKey):
        build_runtime({}, Store(":memory:"))
    rt = build_runtime({"GROQ_API_KEY": "k"}, Store(":memory:"))
    assert rt.answer_models == ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"]
    assert rt.judge_models == ["qwen/qwen3.8-27b"] and rt.embedder is None
    rt2 = build_runtime(
        {
            "GROQ_API_KEY": "k",
            "GEMINI_API_KEY": "g",
            "GEMINI_MODEL": "gm",
            "GEMINI_LIMITS": "9,9,9,9",
        },
        Store(":memory:"),
    )
    assert rt2.judge_models[0] == "gm" and rt2.embedder is not None
    with pytest.raises(MissingKey, match="no model"):
        build_runtime({"GEMINI_API_KEY": "g"}, Store(":memory:"))  # a key but no model name
    with pytest.raises(ValueError):
        build_runtime({"GROQ_API_KEY": "k", "GROQ_LIMITS": "1,2"}, Store(":memory:"))


# --- runner and report -------------------------------------------------------------------------


def question(i: int, kind: str = "metrics-generated") -> Question:
    return Question(
        id=f"q{i:02d}", company="Acme", doc_name="ACME_2020_10K", question_type=kind, reasoning=None,
        question="Acme revenue 2020", answer="$1500", justification="",
        evidence=[Evidence(doc_name="ACME_2020_10K", page=2, text="")],
    )  # fmt: skip


def test_stratified_subset_is_stable_and_balanced():
    kinds = ["a", "b", "c"]
    qs = [question(i, kinds[i % 3]) for i in range(30)]
    s1, s2 = stratified_subset(qs, 9), stratified_subset(qs, 9)
    assert [q.id for q in s1] == [q.id for q in s2]
    assert sorted(q.question_type for q in s1) == ["a"] * 3 + ["b"] * 3 + ["c"] * 3
    assert len(stratified_subset(qs, 500)) == 30


class Dispatch:
    """Answers the answerer's prompts and the judge's, counting each; can run out of quota."""

    def __init__(self, quota=None):
        self.calls, self.quota = 0, quota

    def complete(self, messages, **kw):
        if self.quota is not None and self.calls >= self.quota:
            raise AllEndpointsExhausted("day's limit")
        self.calls += 1
        if "grade one answer" in messages[0]["content"]:
            return Completion('{"verdict": "correct", "reason": "ok"}', 30, 5, "judge")
        return Completion(answer_json(), 100, 20, "answerer")


def ctx_for(corpus, resolver, answer_llm, judge_llm):
    return Context(answer_llm, judge_llm, corpus, resolver, Retrievers(corpus, resolver))


def test_runner_writes_one_line_per_question_and_resumes_without_repeating(
    tmp_path, corpus, resolver
):
    qs = [question(i) for i in range(4)]
    a, j = Dispatch(quota=4), Dispatch()  # the answerer can do 4 calls, then the day is over
    ctx = ctx_for(corpus, resolver, a, j)
    done, finished = run_questions(
        ctx, CONFIGS["C1"], qs[:2], "oracle", out=tmp_path, log=lambda s: None
    )
    assert (done, finished) == (2, True)
    done, finished = run_questions(
        ctx, CONFIGS["C1"], qs, "oracle", out=tmp_path, log=lambda s: None
    )
    assert (done, finished) == (2, True)
    recs = read_records(out_path("C1", "oracle", tmp_path))
    assert [r["id"] for r in recs] == ["q00", "q01", "q02", "q03"]
    assert recs[0]["verdict"] == "correct" and recs[0]["page_hit"] is True
    assert recs[0]["run"]["prompt_tokens"] == 100
    again, fin = run_questions(ctx, CONFIGS["C1"], qs, "oracle", out=tmp_path, log=lambda s: None)
    assert (again, fin) == (0, True) and a.calls == 4  # nothing was asked a second time


def test_runner_stops_cleanly_when_the_day_runs_out(tmp_path, corpus, resolver):
    qs = [question(i) for i in range(5)]
    ctx = ctx_for(corpus, resolver, Dispatch(quota=2), Dispatch())
    logs = []
    done, finished = run_questions(ctx, CONFIGS["C1"], qs, "oracle", out=tmp_path, log=logs.append)
    assert (done, finished) == (2, False) and "Rerun to resume" in logs[-1]
    assert len(read_records(out_path("C1", "oracle", tmp_path))) == 2


def test_closed_book_and_agent_configs_run(tmp_path, corpus, resolver):
    class Closed(Dispatch):
        def complete(self, messages, **kw):
            if "own knowledge" in messages[0]["content"]:
                return Completion('{"answer": "about 1,500"}', 20, 5, "answerer")
            if "You work in steps" in messages[0]["content"]:  # the agent's system prompt
                return Completion(
                    json.dumps({"action": "finish", "answer": json.loads(answer_json())}),
                    90,
                    9,
                    "a",
                )
            return super().complete(messages, **kw)

    ctx = ctx_for(corpus, resolver, Closed(), Closed())
    for cid in ("C0", "C5"):
        done, _ = run_questions(
            ctx, CONFIGS[cid], [question(1)], "oracle", out=tmp_path, log=lambda s: None
        )
        assert done == 1
    c0 = read_records(out_path("C0", "oracle", tmp_path))[0]
    assert c0["run"]["answer"]["closed_book"] is True and c0["page_hit"] is None
    c5 = read_records(out_path("C5", "oracle", tmp_path))[0]
    assert c5["run"]["answer"]["citations"][0]["page"] == 2


def test_bootstrap_and_paired_difference():
    lo, hi = bootstrap_ci([1.0] * 40 + [0.0] * 10)
    assert 0.65 < lo < 0.8 < hi < 0.92
    assert bootstrap_ci([]) == (0.0, 0.0)
    a = {f"q{i}": 0.0 for i in range(40)}
    b = {f"q{i}": 1.0 if i < 30 else 0.0 for i in range(40)}
    d, (dlo, dhi), n = paired_diff(a, b)
    assert n == 40 and d == 0.75 and dlo > 0.55 and dhi <= 0.9
    assert paired_diff({"x": 1.0}, {"y": 1.0}) == (0.0, (0.0, 0.0), 0)


def test_summary_table_and_comparisons():
    def rec(i, verdict, hit, supported=1, rule=True):
        return {
            "id": f"q{i}", "verdict": verdict, "page_hit": hit, "rule_match": rule,
            "run": {"grounding": {"cited": 1, "supported": supported}, "answer": {"x": 1}, "prompt_tokens": 100,
                    "completion_tokens": 20, "model_calls": 1},
        }  # fmt: skip

    recs = [
        rec(0, "correct", True),
        rec(1, "incorrect", False, supported=0, rule=False),
        rec(2, "refused", None),
    ]
    recs[2]["run"]["grounding"] = None  # a refusal has nothing to verify
    row = summarise("C1", "full", recs)
    assert row.n == 3 and row.accuracy == 1 / 3 and row.refused == 1 / 3
    assert (
        row.page_hit == 0.5 and row.faithful == 0.5 and row.rule_agree == 1.0 and row.tokens == 120
    )
    text = table([row])
    assert "| C1 | full | 3 | 33% |" in text
    by_key = {("C0", "full"): {"q0": 0.0, "q1": 0.0}, ("C1", "full"): {"q0": 1.0, "q1": 0.0}}
    assert "C0 to C1 | 2 | +50 points" in comparisons(by_key, "full", ["C0", "C1", "C2"])
