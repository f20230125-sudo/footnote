import json
from datetime import UTC, datetime

from conftest import ScriptedChat, answer_json
from footnote.agent import run_agent
from footnote.rag import run_rag
from footnote.trace import run_to_trace

SPAN_KINDS = {"understand", "plan", "step", "tool", "model", "wait", "check", "said"}
STATUSES = {"ok", "failed", "skipped", "stopped"}
TRACE_STATUSES = {"ok", "failed", "stopped", "waiting", "running"}
NOW = datetime(2026, 10, 11, 12, 0, tzinfo=UTC)


def assert_valid_for_hindsight(t: dict) -> None:
    """The constraints of hindsight/src/trace/schema.ts, restated; the real Zod check runs there."""
    assert t["source"] == "footnote" and t["status"] in TRACE_STATUSES
    assert len(t["id"]) <= 200 and len(t["title"]) <= 500 and len(t["summary"] or "") <= 1000
    assert t["durationMs"] >= 0 and len(t["spans"]) <= 3000
    ids = [s["id"] for s in t["spans"]]
    assert len(ids) == len(set(ids)), "span ids must be unique"
    for s in t["spans"]:
        assert s["parentId"] is None or s["parentId"] in ids
        assert s["kind"] in SPAN_KINDS and s["status"] in STATUSES
        assert s["timing"] in {"measured", "estimated"}
        assert s["startMs"] >= 0 and s["durationMs"] >= 0 and len(s["name"]) <= 500
        assert len(s.get("shown", "")) <= 2000
        json.dumps(s["attributes"])
    assert t["totals"]["calls"] >= 0 and t["totals"]["modelCalls"] >= 0
    assert t["origin"]["how"] in {"live", "sent", "file", "sample"}
    datetime.fromisoformat(t["origin"]["at"])
    json.dumps(t)


def test_a_rag_run_becomes_a_valid_trace(corpus):
    run = run_rag(
        ScriptedChat([answer_json()]), corpus, "q1", "Revenue?", [("ACME_2020_10K", 2)], config="C1"
    )
    run.steps[0].duration_ms = 850
    t = run_to_trace(run, "What was Acme's revenue?", setting="oracle", now=NOW)
    assert_valid_for_hindsight(t)
    assert t["id"] == "footnote:C1:oracle:q1" and t["agent"] == "C1" and t["status"] == "ok"
    root, call, said = t["spans"]
    assert root["parentId"] is None and call["parentId"] == "run" and said["kind"] == "said"
    assert call["durationMs"] == 850 and root["durationMs"] == 850 and said["startMs"] == 850
    assert t["totals"] == {
        "calls": 1,
        "modelCalls": 1,
        "tokens": 120,
        "failures": 0,
        "avoided": 0,
    }


def test_an_agent_run_has_tool_spans_in_order_and_failures_are_counted(corpus, tools):
    chat = ScriptedChat(
        [
            json.dumps({"action": "get_page", "args": {"doc": "NOPE", "page": 1}}),
            json.dumps({"action": "calculate", "args": {"expression": "1+1"}}),
            json.dumps({"action": "finish", "answer": json.loads(answer_json())}),
        ]
    )
    run = run_agent(chat, corpus, tools, "q1", "Revenue?")
    t = run_to_trace(run, "Revenue?", setting="full", now=NOW)
    assert_valid_for_hindsight(t)
    kinds = [s["kind"] for s in t["spans"]]
    assert kinds == ["step", "model", "tool", "model", "tool", "model", "said"]
    assert t["totals"]["failures"] == 1  # the get_page for an unknown filing
    failed = [s for s in t["spans"] if s["status"] == "failed"]
    assert [s["name"] for s in failed] == ["get_page"]
    starts = [s["startMs"] for s in t["spans"][1:-1]]
    assert starts == sorted(starts)


def test_cached_calls_are_marked_estimated_and_counted_as_avoided(corpus):
    run = run_rag(
        ScriptedChat([answer_json()]), corpus, "q1", "Revenue?", [("ACME_2020_10K", 2)], config="C1"
    )
    run.steps[0].cached = True
    t = run_to_trace(run, "Revenue?", setting="oracle", now=NOW)
    assert t["spans"][1]["timing"] == "estimated" and t["totals"]["avoided"] == 1
    assert t["spans"][1]["attributes"]["cached"] is True


def test_budget_and_bad_format_stops_map_to_trace_statuses(corpus, tools):
    chat = ScriptedChat([json.dumps({"action": "search_filings", "args": {"query": "x"}})] * 3)
    run = run_agent(chat, corpus, tools, "q1", "?", max_steps=1)
    assert run_to_trace(run, "?", setting="full", now=NOW)["status"] == "stopped"
    bad = run_agent(ScriptedChat(["x", "y"]), corpus, tools, "q1", "?")
    t = run_to_trace(bad, "?", setting="full", now=NOW)
    assert t["status"] == "failed"
    assert_valid_for_hindsight(t)


def test_long_text_is_clipped_to_the_schema_limits(corpus):
    run = run_rag(
        ScriptedChat([answer_json(text="x" * 5000)]),
        corpus,
        "q1",
        "?",
        [("ACME_2020_10K", 2)],
        config="C1",
    )
    t = run_to_trace(run, "t" * 900, setting="oracle", now=NOW)
    assert_valid_for_hindsight(t)
    assert len(t["title"]) == 500 and len(t["spans"][-1]["shown"]) <= 1900
