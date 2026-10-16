"""Shared by the RAG pipeline and the agent: call the model, record the step, get a valid Answer,
and enforce that its citations are real."""

from __future__ import annotations

from .answer import Answer, AnswerError, Grounding, check_grounding, parse_answer
from .llm.providers import Messages
from .llm.store import Completion
from .retrieve import Corpus
from .run import Chat, Run, Step

NOT_FOUND = "Not found in these filings: the citations for an answer could not be verified."


def call(
    llm: Chat, run: Run, messages: Messages, purpose: str, max_tokens: int = 700
) -> Completion:
    c = llm.complete(messages, max_tokens=max_tokens, temperature=0.0, json_mode=True)
    run.steps.append(
        Step(
            n=len(run.steps) + 1,
            kind="model",
            name=c.model,
            detail={"purpose": purpose},
            prompt_tokens=c.prompt_tokens,
            completion_tokens=c.completion_tokens,
            cached=c.cached,
            duration_ms=c.latency_ms,
            cost_usd=c.cost_usd,
        )
    )
    return c


def ask_answer(llm: Chat, run: Run, messages: Messages, purpose: str = "answer") -> Answer | None:
    """One call, and one repair call if the reply is not a valid Answer. None if both fail."""
    c = call(llm, run, messages, purpose)
    try:
        return parse_answer(c.text)
    except AnswerError as first:
        fix = messages + [
            {"role": "assistant", "content": c.text},
            {
                "role": "user",
                "content": f"That reply was not valid: {first}. "
                "Reply again with only the JSON object.",
            },
        ]
        c2 = call(llm, run, fix, purpose + "-repair")
        try:
            return parse_answer(c2.text)
        except AnswerError:
            run.stop = "bad_format"
            return None


def refusal() -> Answer:
    return Answer(answer=NOT_FOUND, refused=True, confidence="low")


def enforce_grounding(
    llm: Chat, run: Run, corpus: Corpus, messages: Messages, answer: Answer
) -> tuple[Answer, Grounding | None]:
    """A refusal is its own honest answer. Anything else must cite real quotes: one retry that shows
    the model what failed, then a refusal. The unsupported answer stays visible in the step detail.
    """
    if answer.refused:
        return answer, None
    g = check_grounding(answer, corpus)
    if g.ok:
        return answer, g
    run.steps.append(
        Step(
            n=len(run.steps) + 1,
            kind="check",
            name="grounding",
            detail={"issues": g.issues, "answer": answer.answer[:300]},
        )
    )
    retry = messages + [
        {"role": "assistant", "content": answer.model_dump_json()},
        {
            "role": "user",
            "content": "Some citations could not be verified: "
            + "; ".join(g.issues)
            + ". Copy quotes exactly from the page, or set refused to true. "
            "Reply with only the JSON object.",
        },
    ]
    second = ask_answer(llm, run, retry, "answer-regrounded")
    if second is None:
        return refusal(), None
    if second.refused:
        return second, None
    g2 = check_grounding(second, corpus)
    if g2.ok:
        return second, g2
    run.steps.append(
        Step(
            n=len(run.steps) + 1,
            kind="check",
            name="grounding",
            detail={"issues": g2.issues, "answer": second.answer[:300]},
        )
    )
    return refusal(), g2
