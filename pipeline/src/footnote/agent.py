"""The agent loop: choose a tool, read the result, repeat, then finish with a cited answer.

Tool calls are a JSON protocol in plain chat (not a provider's native function calling), so the same
loop runs on Gemini and Groq and every step is cached. The prompt is rebuilt each turn from the
progress notes rather than growing a chat history, which keeps every call under the per-minute token
limit of the free tiers.
"""

from __future__ import annotations

import json
import re
import time
from typing import Any

from .answer import AnswerError, parse_answer
from .generate import call, enforce_grounding, refusal
from .prompts import AGENT_SYSTEM, agent_user
from .retrieve import Corpus
from .run import Chat, Run, Step
from .tools import TOOL_DOCS, FilingTools

MAX_NOTES_CHARS = 14000
RECENT_FULL = 2  # the last results are shown whole; older ones are cut to a preview
OLD_RESULT_CHARS = 350

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def _parse_action(text: str) -> dict[str, Any] | None:
    try:
        data = json.loads(_FENCE.sub("", text.strip()))
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) and isinstance(data.get("action"), str) else None


def _render_notes(history: list[tuple[str, dict, str]]) -> str:
    lines = []
    for i, (name, args, result) in enumerate(history):
        recent = i >= len(history) - RECENT_FULL
        shown = (
            result
            if recent or len(result) <= OLD_RESULT_CHARS
            else result[:OLD_RESULT_CHARS] + " ...[cut]"
        )
        lines.append(f"{i + 1}. {name}({json.dumps(args, ensure_ascii=False)})\n   result: {shown}")
    notes = "\n".join(lines)
    while len(notes) > MAX_NOTES_CHARS and history:
        history = history[1:]  # drop the oldest step entirely rather than overflow the call
        notes = _render_notes(history)
    return notes


def run_agent(
    llm: Chat,
    corpus: Corpus,
    tools: FilingTools,
    question_id: str,
    question: str,
    *,
    config: str = "C5",
    max_steps: int = 6,
) -> Run:
    run = Run(question_id=question_id, config=config)
    history: list[tuple[str, dict, str]] = []
    bad = 0
    tool_calls = 0
    while True:
        left = max_steps - tool_calls
        messages = [
            {"role": "system", "content": AGENT_SYSTEM},
            {"role": "user", "content": agent_user(question, _render_notes(history), left)},
        ]
        if left <= 0:
            messages[1]["content"] += " You must finish now with what you have (or refuse)."
        c = call(llm, run, messages, "agent", max_tokens=900)
        act = _parse_action(c.text)
        if act is None:
            bad += 1
            if bad >= 2:
                run.stop = "bad_format"
                run.answer = refusal()
                return run
            history.append(
                ("reply", {}, 'not a JSON object with an "action"; reply with one JSON object')
            )
            continue

        if act["action"] == "finish":
            try:
                answer = parse_answer(json.dumps(act.get("answer")))
            except AnswerError as e:
                bad += 1
                if bad >= 2:
                    run.stop = "bad_format"
                    run.answer = refusal()
                    return run
                history.append(("finish", {}, f"answer rejected: {e}"))
                continue
            run.answer, run.grounding = enforce_grounding(llm, run, corpus, messages, answer)
            return run

        if left <= 0:
            run.stop = "budget"
            run.answer = refusal()
            return run

        args = act.get("args") if isinstance(act.get("args"), dict) else {}
        tool_ms = 0
        if act["action"] not in TOOL_DOCS:
            result: dict = {
                "error": f"unknown tool {act['action']!r}; tools are {', '.join(TOOL_DOCS)}"
            }
        else:
            t0 = time.perf_counter()
            result = tools.call(act["action"], args)
            tool_ms = round((time.perf_counter() - t0) * 1000)
        tool_calls += 1
        text = json.dumps(result, ensure_ascii=False)
        run.steps.append(
            Step(
                n=len(run.steps) + 1,
                kind="tool",
                name=act["action"],
                detail={"args": args, "ok": "error" not in result, "result_chars": len(text)},
                duration_ms=tool_ms,
            )
        )
        if act["action"] in ("get_page", "search_filings"):
            for r in [result] if "page" in result else result.get("results", []):
                if "doc" in r and "page" in r and (r["doc"], r["page"]) not in run.retrieved:
                    run.retrieved.append((r["doc"], r["page"]))
        history.append((act["action"], args, text))
