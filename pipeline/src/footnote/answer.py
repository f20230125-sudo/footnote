"""The typed answer a model must produce, and the check that its citations are real.

Grounding is rules, not a model: a citation passes only if its quote is found on the cited page
(whitespace, `$`, thousands commas and case ignored, since PDF tables split cells across lines).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, model_validator

from .retrieve import Corpus


class Citation(BaseModel):
    doc: str
    page: int = Field(ge=1)
    quote: str = Field(min_length=3, max_length=400)


class Answer(BaseModel):
    answer: str
    numbers_used: list[str] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    confidence: Literal["high", "medium", "low"] = "medium"
    refused: bool = False
    closed_book: bool = False  # the C0 baseline answers from memory, so it has nothing to cite

    @model_validator(mode="after")
    def _needs_evidence(self) -> Answer:
        if not self.answer.strip():
            raise ValueError("answer is empty")
        if not self.refused and not self.closed_book and not self.citations:
            raise ValueError("an answer must cite at least one page, or set refused to true")
        return self


class AnswerError(ValueError):
    """The model's text was not a valid Answer. The message is safe to show back to the model."""


_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def parse_answer(text: str) -> Answer:
    body = _FENCE.sub("", text.strip())
    try:
        data = json.loads(body)
    except json.JSONDecodeError as e:
        raise AnswerError(f"not valid JSON ({e.msg} at character {e.pos})") from None
    if (
        isinstance(data, dict)
        and data.get("action") == "finish"
        and isinstance(data.get("answer"), dict)
    ):
        data = data["answer"]  # the agent's wrapper: {"action": "finish", "answer": {...}}
    try:
        return Answer.model_validate(data)
    except ValidationError as e:
        problems = "; ".join(
            f"{'.'.join(map(str, x['loc'])) or 'answer'}: {x['msg']}" for x in e.errors()
        )
        raise AnswerError(problems) from None


def compact(s: str) -> str:
    return re.sub(r"[\s$,]+", "", s).lower()


_ELLIPSIS = re.compile(r"\.\.\.|…")


@dataclass
class Grounding:
    cited: int = 0
    supported: int = 0
    issues: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.cited > 0 and self.supported == self.cited


def check_grounding(answer: Answer, corpus: Corpus) -> Grounding:
    g = Grounding()
    for c in answer.citations:
        g.cited += 1
        page = corpus.page(c.doc, c.page)
        if page is None:
            g.issues.append(f"{c.doc} page {c.page} does not exist")
            continue
        hay = compact(page.text)
        parts = [p for p in (compact(x) for x in _ELLIPSIS.split(c.quote)) if len(p) >= 6]
        if parts and all(p in hay for p in parts):
            g.supported += 1
        else:
            g.issues.append(f"quote not found on {c.doc} page {c.page}: {c.quote[:60]!r}")
    return g
