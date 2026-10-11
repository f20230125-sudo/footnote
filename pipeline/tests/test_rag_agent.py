import json

from conftest import ScriptedChat, answer_json
from footnote.agent import run_agent
from footnote.rag import run_rag

Q = "What was Acme's revenue in 2020?"


def test_rag_happy_path_is_one_call_and_grounded(corpus):
    chat = ScriptedChat([answer_json()])
    run = run_rag(chat, corpus, "q1", Q, [("ACME_2020_10K", 2)], config="C1")
    assert run.model_calls == 1 and run.answer and run.grounding.ok
    assert "[ACME_2020_10K | page 2]" in chat.seen[0][1]["content"]
    assert run.prompt_tokens == 100 and run.completion_tokens == 20


def test_rag_repairs_a_malformed_reply_once(corpus):
    chat = ScriptedChat(["Revenue was 1,500", answer_json()])
    run = run_rag(chat, corpus, "q1", Q, [("ACME_2020_10K", 2)], config="C1")
    assert run.model_calls == 2 and run.answer and run.stop == "finished"
    assert "not valid" in chat.seen[1][-1]["content"]


def test_rag_gives_up_after_a_second_malformed_reply(corpus):
    chat = ScriptedChat(["nope", "still nope"])
    run = run_rag(chat, corpus, "q1", Q, [("ACME_2020_10K", 2)], config="C1")
    assert run.answer is None and run.stop == "bad_format"


def test_unenforced_rag_keeps_an_ungrounded_answer_but_records_it(corpus):
    chat = ScriptedChat([answer_json(quote="Revenue was fifteen hundred")])
    run = run_rag(chat, corpus, "q1", Q, [("ACME_2020_10K", 2)], config="C1")
    assert run.answer and not run.answer.refused and not run.grounding.ok


def test_enforced_rag_retries_with_the_issue_then_accepts_a_fixed_answer(corpus):
    chat = ScriptedChat([answer_json(quote="made up quote text"), answer_json()])
    run = run_rag(chat, corpus, "q1", Q, [("ACME_2020_10K", 2)], config="C4", enforce=True)
    assert run.answer and not run.answer.refused and run.grounding.ok
    assert "quote not found" in chat.seen[1][-1]["content"]
    assert [s.name for s in run.steps if s.kind == "check"] == ["grounding"]


def test_enforced_rag_refuses_rather_than_keep_an_ungrounded_answer(corpus):
    chat = ScriptedChat([answer_json(quote="made up quote text")] * 2)
    run = run_rag(chat, corpus, "q1", Q, [("ACME_2020_10K", 2)], config="C4", enforce=True)
    assert run.answer.refused and "could not be verified" in run.answer.answer


def test_a_model_refusal_is_accepted_as_it_is(corpus):
    refusal = json.dumps({"answer": "Not in these pages.", "refused": True})
    run = run_rag(
        ScriptedChat([refusal]), corpus, "q1", Q, [("ACME_2020_10K", 1)], config="C4", enforce=True
    )
    assert run.answer.refused and run.model_calls == 1


def act(name, **args):
    return json.dumps({"action": name, "args": args})


def finish(**kw):
    return json.dumps({"action": "finish", "answer": json.loads(answer_json(**kw))})


def test_agent_searches_reads_calculates_and_finishes(corpus, tools):
    chat = ScriptedChat(
        [
            act("search_filings", query="Acme revenue 2021"),
            act("get_page", doc="ACME_2021_10K", page=2),
            act("calculate", expression="1800 - 1500"),
            finish(
                text="Revenue rose by $300 million.", quote="Revenue $ 1,800", doc="ACME_2021_10K"
            ),
        ]
    )
    run = run_agent(chat, corpus, tools, "q1", "How much did Acme revenue rise?")
    assert run.stop == "finished" and run.answer and run.grounding.ok
    assert [s.name for s in run.steps if s.kind == "tool"] == [
        "search_filings",
        "get_page",
        "calculate",
    ]
    assert ("ACME_2021_10K", 2) in run.retrieved
    assert '"value": 300' in chat.seen[3][1]["content"]  # the result is in the next prompt


def test_agent_stops_at_the_step_budget_with_a_refusal(corpus, tools):
    chat = ScriptedChat([act("search_filings", query="acme")] * 4)
    run = run_agent(chat, corpus, tools, "q1", Q, max_steps=2)
    assert run.stop == "budget" and run.answer.refused
    assert sum(s.kind == "tool" for s in run.steps) == 2
    assert "must finish now" in chat.seen[2][1]["content"]


def test_agent_survives_one_bad_reply_but_not_two(corpus, tools):
    ok = run_agent(ScriptedChat(["oops", finish()]), corpus, tools, "q1", Q)
    assert ok.stop == "finished" and ok.answer and not ok.answer.refused
    bad = run_agent(ScriptedChat(["oops", "again oops"]), corpus, tools, "q1", Q)
    assert bad.stop == "bad_format" and bad.answer.refused


def test_agent_tells_the_model_about_an_unknown_tool_and_carries_on(corpus, tools):
    chat = ScriptedChat([act("delete_everything"), finish()])
    run = run_agent(chat, corpus, tools, "q1", Q)
    assert "unknown tool" in chat.seen[1][1]["content"] and run.answer and not run.answer.refused


def test_agent_citation_that_fails_grounding_gets_one_retry(corpus, tools):
    chat = ScriptedChat([finish(quote="invented words here"), finish()])
    run = run_agent(chat, corpus, tools, "q1", Q)
    assert run.answer and not run.answer.refused and run.grounding.ok
    assert "could not be verified" in chat.seen[1][-1]["content"]


def test_old_results_are_cut_so_the_prompt_stays_small(corpus, tools):
    long_page = "Revenue\n$\n1,500\n" + "filler " * 300  # still contains the scripted quote
    from footnote.retrieve import Page

    corpus.pages[1] = Page("ACME_2020_10K", 2, long_page)
    chat = ScriptedChat([act("get_page", doc="ACME_2020_10K", page=2)] * 3 + [finish()])
    from footnote.tools import FilingTools

    run_agent(chat, corpus, FilingTools(corpus, tools.resolver, page_chars=2000), "q1", Q)
    last = chat.seen[3][1]["content"]
    assert (
        last.count("[cut]") == 1
    )  # the oldest of three results is a preview, the last two are whole
