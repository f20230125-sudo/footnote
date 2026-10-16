"""Run a configuration over questions, grade each answer, and keep one JSON line per question.

A run is resumable by construction: a question already in the output file is skipped, and every
model call is cached, so stopping at a daily limit and resuming tomorrow repeats nothing.
"""

from __future__ import annotations

import json
import random
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from .. import DATA
from ..agent import run_agent
from ..dataset import Question
from ..filters import DocResolver
from ..judge import Judged, judge
from ..llm.router import AllEndpointsExhausted
from ..rag import run_closed_book, run_rag
from ..retrieve import Corpus
from ..retrievers import Retrievers
from ..run import Chat, Run
from ..tools import FilingTools

RUNS = DATA / "runs"
TOP_K = 5


@dataclass(frozen=True)
class Config:
    id: str
    label: str
    kind: str  # closed | bm25 | hybrid | agent
    use_filter: bool = False
    enforce: bool = False


CONFIGS = {
    c.id: c
    for c in [
        Config("C0", "closed book (no documents)", "closed"),
        Config("C1", "naive RAG: BM25 top-5 pages", "bm25"),
        Config("C2", "+ embedding rerank and rank fusion", "hybrid"),
        Config("C3", "+ company/year filter", "hybrid", use_filter=True),
        Config("C4", "+ citation check enforced", "hybrid", use_filter=True, enforce=True),
        Config("C5", "agent with tools and calculator", "agent", use_filter=True, enforce=True),
    ]
}


def stratified_subset(questions: list[Question], n: int, seed: int = 0) -> list[Question]:
    """The same n questions every time, spread evenly over FinanceBench's three question types."""
    rng = random.Random(seed)
    groups: dict[str, list[Question]] = {}
    for q in sorted(questions, key=lambda x: x.id):
        groups.setdefault(q.question_type, []).append(q)
    for g in groups.values():
        rng.shuffle(g)
    out: list[Question] = []
    names = sorted(groups)
    i = 0
    while len(out) < min(n, len(questions)):
        g = groups[names[i % len(names)]]
        if g:
            out.append(g.pop())
        i += 1
    return sorted(out, key=lambda x: x.id)


@dataclass
class Context:
    answer_llm: Chat
    judge_llm: Chat
    corpus: Corpus
    resolver: DocResolver
    retrievers: Retrievers


def run_one(ctx: Context, cfg: Config, q: Question, setting: str) -> Run:
    if cfg.kind == "closed":
        return run_closed_book(ctx.answer_llm, q.id, q.question, config=cfg.id)
    if cfg.kind == "agent":
        tools = FilingTools(ctx.corpus, ctx.resolver, use_filter=cfg.use_filter)
        tools.restrict = [q.doc_name] if setting == "oracle" else None
        return run_agent(ctx.answer_llm, ctx.corpus, tools, q.id, q.question, config=cfg.id)
    pick = ctx.retrievers.bm25 if cfg.kind == "bm25" else ctx.retrievers.hybrid
    hits = pick(q, TOP_K, setting=setting, use_filter=cfg.use_filter)
    return run_rag(
        ctx.answer_llm, ctx.corpus, q.id, q.question, hits, config=cfg.id, enforce=cfg.enforce
    )


def record(q: Question, setting: str, run: Run, judged: Judged) -> dict:
    gold = q.gold_pages
    shown = {tuple(h) for h in run.retrieved}
    return {
        "id": q.id,
        "type": q.question_type,
        "setting": setting,
        "run": run.to_dict(),
        "gold_pages": sorted(map(list, gold)),
        "page_hit": bool(gold & shown) if run.retrieved else None,
        "verdict": judged.verdict,
        "reason": judged.reason,
        "rule_match": judged.rule_match,
        "judge_model": judged.judge_model,
        "judge_tokens": judged.judge_tokens,
        "judge_latency_ms": judged.judge_latency_ms,
        "judge_cost_usd": judged.judge_cost_usd,
    }


def out_path(config: str, setting: str, out: Path = RUNS) -> Path:
    return out / f"{config}_{setting}.jsonl"


def read_records(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def run_questions(
    ctx: Context,
    cfg: Config,
    questions: list[Question],
    setting: str,
    *,
    out: Path = RUNS,
    log: Callable[[str], None] = print,
) -> tuple[int, bool]:
    """Returns (questions completed this call, whether the run finished)."""
    path = out_path(cfg.id, setting, out)
    path.parent.mkdir(parents=True, exist_ok=True)
    done = {r["id"] for r in read_records(path)}
    todo = [q for q in questions if q.id not in done]
    finished = 0
    for q in todo:
        try:
            run = run_one(ctx, cfg, q, setting)
            judged = judge(ctx.judge_llm, q.question, q.answer, q.justification, run.answer)
        except AllEndpointsExhausted as e:
            log(f"stopped at {len(done) + finished}/{len(questions)}: {e}. Rerun to resume.")
            return finished, False
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record(q, setting, run, judged), ensure_ascii=False) + "\n")
        finished += 1
        log(f"{cfg.id} {setting} {len(done) + finished}/{len(questions)} {q.id}: {judged.verdict}")
    return finished, True
