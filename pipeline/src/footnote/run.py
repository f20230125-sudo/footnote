"""What one question's attempt looks like, whichever pipeline produced it. This is also what the
trace exporter and the eval harness read."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

from .answer import Answer, Grounding
from .llm.providers import Messages
from .llm.store import Completion


class Chat(Protocol):
    def complete(
        self,
        messages: Messages,
        *,
        max_tokens: int = ...,
        temperature: float = ...,
        json_mode: bool = ...,
    ) -> Completion: ...


@dataclass
class Step:
    n: int
    kind: str  # "model" | "tool"
    name: str  # model name, or tool name
    detail: dict[str, Any] = field(default_factory=dict)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cached: bool = False
    duration_ms: int = 0  # for a cached model call, the provider's original latency


def step_to_dict(s: Step) -> dict[str, Any]:
    return {
        "n": s.n,
        "kind": s.kind,
        "name": s.name,
        "detail": s.detail,
        "prompt_tokens": s.prompt_tokens,
        "completion_tokens": s.completion_tokens,
        "cached": s.cached,
        "duration_ms": s.duration_ms,
    }


@dataclass
class Run:
    question_id: str
    config: str
    answer: Answer | None = None
    grounding: Grounding | None = None
    steps: list[Step] = field(default_factory=list)
    stop: str = "finished"  # finished | budget | bad_format | exhausted
    retrieved: list[tuple[str, int]] = field(default_factory=list)  # pages shown to the model

    @property
    def prompt_tokens(self) -> int:
        return sum(s.prompt_tokens for s in self.steps)

    @property
    def completion_tokens(self) -> int:
        return sum(s.completion_tokens for s in self.steps)

    @property
    def model_calls(self) -> int:
        return sum(1 for s in self.steps if s.kind == "model")

    def to_dict(self) -> dict[str, Any]:
        g = self.grounding
        return {
            "question_id": self.question_id,
            "config": self.config,
            "answer": self.answer.model_dump() if self.answer else None,
            "grounding": {"cited": g.cited, "supported": g.supported, "issues": g.issues}
            if g
            else None,
            "stop": self.stop,
            "retrieved": [list(h) for h in self.retrieved],
            "steps": [step_to_dict(s) for s in self.steps],
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "model_calls": self.model_calls,
        }
