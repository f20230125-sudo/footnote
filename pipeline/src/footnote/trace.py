"""A Run as a Hindsight `Trace` (the schema in hindsight/src/trace/schema.ts), so one question's
attempt can be opened on a timeline: which pages were searched, what each model call cost, and
where the answer came from.

Steps ran one after another, so each span starts when the one before ended. Model calls replayed
from the cache carry the provider's original latency, but their order and offsets are worked out,
so those spans are marked "estimated".
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from .run import Run, Step

SOURCE = "footnote"
MAX_TEXT = 1900


def _clip(s: str, n: int = MAX_TEXT) -> str:
    return s if len(s) <= n else s[: n - 1] + "…"


def _status(step: Step) -> str:
    if step.kind == "check":
        return "failed"  # a grounding check is only recorded when it found a problem
    if step.kind == "tool" and not step.detail.get("ok", True):
        return "failed"
    return "ok"


def _attributes(step: Step) -> dict[str, Any]:
    attrs: dict[str, Any] = {
        k: v for k, v in step.detail.items() if isinstance(v, str | int | float | bool)
    }
    if step.prompt_tokens:
        attrs["promptTokens"] = step.prompt_tokens
    if step.completion_tokens:
        attrs["completionTokens"] = step.completion_tokens
    if step.cached:
        attrs["cached"] = True
    return attrs


def run_to_trace(
    run: Run, title: str, *, setting: str, now: datetime | None = None
) -> dict[str, Any]:
    at = (now or datetime.now(UTC)).isoformat()
    root_id = "run"
    spans: list[dict[str, Any]] = []
    t = 0
    for s in run.steps:
        kind = {"model": "model", "tool": "tool", "check": "check"}.get(s.kind, "step")
        spans.append(
            {
                "id": f"s{s.n}",
                "parentId": root_id,
                "kind": kind,
                "name": s.name
                if s.kind != "model"
                else f"{s.detail.get('purpose', 'call')} ({s.name})",
                "startMs": t,
                "durationMs": s.duration_ms,
                "status": _status(s),
                "timing": "estimated" if s.cached or s.kind == "check" else "measured",
                "attributes": _attributes(s),
            }
        )
        t += s.duration_ms
    if run.answer is not None:
        spans.append(
            {
                "id": "answer",
                "parentId": root_id,
                "kind": "said",
                "name": "answer" if not run.answer.refused else "refusal",
                "startMs": t,
                "durationMs": 0,
                "status": "ok",
                "timing": "estimated",
                "shown": _clip(run.answer.answer),
                "attributes": {"citations": len(run.answer.citations)},
            }
        )
    status = {"bad_format": "failed", "budget": "stopped"}.get(run.stop, "ok")
    spans.insert(
        0,
        {
            "id": root_id,
            "parentId": None,
            "kind": "step",
            "name": f"{run.config}, {setting} setting",
            "startMs": 0,
            "durationMs": t,
            "status": status,
            "timing": "estimated",
            "attributes": {
                "stop": run.stop,
                "pagesShown": len(run.retrieved),
                "grounded": bool(run.grounding and run.grounding.ok),
            },
        },
    )
    model_calls = run.model_calls
    cached = sum(1 for s in run.steps if s.kind == "model" and s.cached)
    return {
        "id": f"{SOURCE}:{run.config}:{setting}:{run.question_id}",
        "source": SOURCE,
        "agent": run.config,
        "title": _clip(title, 500),
        "summary": _clip(run.answer.answer, 300) if run.answer else "no valid answer",
        "startedAt": None,
        "durationMs": t,
        "status": status,
        "spans": spans,
        "totals": {
            "calls": len(run.steps),
            "modelCalls": model_calls,
            "tokens": run.prompt_tokens + run.completion_tokens,
            "failures": sum(1 for s in run.steps if _status(s) == "failed"),
            "avoided": cached,
        },
        "origin": {"how": "file", "at": at},
    }
