"""Grading an answer against FinanceBench's reference answer.

Two independent signals, both stored: a model judge (the verdict that counts) and a rule that checks
a single reference number against the numbers in the candidate. The README reports how often they
agree, and a hand-checked sample of verdicts.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ValidationError

from .answer import Answer
from .run import Chat

_NUMBER = re.compile(r"(?<![\w.])-?\$?\(?\d[\d,]*(?:\.\d+)?\)?%?")

JUDGE_SYSTEM = """You grade one answer to a question about a company's filings against a reference \
answer written by an analyst. Judge only against the reference, never against your own knowledge.

correct: the candidate reaches the same conclusion as the reference. Numbers must match after rounding \
to the precision the reference gives (a small rounding difference is fine; a different figure, period, \
or unit scale is not). Yes/no questions need the same direction. Extra explanation does not matter; a \
contradiction or a missing key fact does.
incorrect: anything else, including an answer that says it cannot find the information.

Reply with one JSON object and nothing else: {"verdict": "correct" | "incorrect", "reason": "<one sentence>"}"""


class Verdict(BaseModel):
    verdict: Literal["correct", "incorrect"]
    reason: str = ""


@dataclass
class Judged:
    verdict: str  # correct | incorrect | refused | unjudged
    reason: str
    rule_match: (
        bool | None
    )  # single reference number found in the candidate; None if not applicable
    judge_model: str = ""
    judge_tokens: int = 0
    judge_latency_ms: int = 0
    judge_cost_usd: float | None = None


def numbers_in(text: str) -> list[float]:
    out = []
    for m in _NUMBER.findall(text):
        neg = m.startswith("-") or ("(" in m and ")" in m)  # filings write negatives as (120)
        digits = re.sub(r"[^\d.]", "", m)
        if digits and digits != ".":
            try:
                v = float(digits)
            except ValueError:
                continue
            out.append(-v if neg else v)
    return out


def rule_match(gold: str, candidate: str, tolerance: float = 0.005) -> bool | None:
    """If the reference answer holds exactly one number, is it among the candidate's numbers?
    Percentages and plain figures are compared as written; a unit change (millions vs billions) is
    not guessed at, so this errs towards "no match" and is only a cross-check on the model judge."""
    g = numbers_in(gold)
    if len(g) != 1:
        return None
    target = g[0]
    for c in numbers_in(candidate):
        if target == 0:
            if c == 0:
                return True
        elif abs(c - target) <= tolerance * abs(target):
            return True
    return False


def judge(llm: Chat, question: str, gold: str, justification: str, answer: Answer | None) -> Judged:
    if answer is None or answer.refused:
        return Judged("refused", answer.answer[:200] if answer else "no valid answer", None)
    rule = rule_match(gold, answer.answer)
    user = (
        f"Question: {question}\n\nReference answer: {gold}\n"
        f"Reference reasoning: {justification[:600]}\n\nCandidate answer: {answer.answer[:1500]}"
    )
    messages = [{"role": "system", "content": JUDGE_SYSTEM}, {"role": "user", "content": user}]
    c = llm.complete(messages, max_tokens=200, temperature=0.0, json_mode=True)
    tokens = c.prompt_tokens + c.completion_tokens
    try:
        body = re.sub(r"^```(?:json)?\s*|\s*```$", "", c.text.strip())
        v = Verdict.model_validate(json.loads(body))
    except (json.JSONDecodeError, ValidationError):
        return Judged(
            "unjudged",
            f"judge reply unreadable: {c.text[:80]!r}",
            rule,
            c.model,
            tokens,
            c.latency_ms,
            c.cost_usd,
        )
    return Judged(v.verdict, v.reason, rule, c.model, tokens, c.latency_ms, c.cost_usd)
