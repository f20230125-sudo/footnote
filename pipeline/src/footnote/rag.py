"""Single-shot RAG: show the model the retrieved pages once and get a typed, cited answer."""

from __future__ import annotations

import json
import re

from .answer import Answer, check_grounding
from .generate import ask_answer, call, enforce_grounding
from .prompts import CLOSED_SYSTEM, RAG_SYSTEM, rag_user
from .retrieve import Corpus, Hit
from .run import Chat, Run


def run_closed_book(llm: Chat, question_id: str, question: str, *, config: str = "C0") -> Run:
    """The baseline with no documents: how much does the model already know?"""
    run = Run(question_id=question_id, config=config)
    messages = [
        {"role": "system", "content": CLOSED_SYSTEM},
        {"role": "user", "content": f"Question: {question}"},
    ]
    for attempt in range(2):
        c = call(llm, run, messages, "closed-book" if attempt == 0 else "closed-book-repair", 400)
        try:
            data = json.loads(re.sub(r"^```(?:json)?\s*|\s*```$", "", c.text.strip()))
            run.answer = Answer(answer=str(data["answer"]), closed_book=True, confidence="low")
            return run
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            messages = messages + [
                {"role": "assistant", "content": c.text},
                {"role": "user", "content": 'Reply with only {"answer": "..."}.'},
            ]
    run.stop = "bad_format"
    return run


def run_rag(
    llm: Chat,
    corpus: Corpus,
    question_id: str,
    question: str,
    hits: list[Hit],
    *,
    config: str,
    page_chars: int = 2500,
    enforce: bool = False,
) -> Run:
    run = Run(question_id=question_id, config=config, retrieved=list(hits))
    pages = []
    for doc, page in hits:
        p = corpus.page(doc, page)
        if p is not None:
            pages.append((doc, page, p.text.strip()[:page_chars]))
    messages = [
        {"role": "system", "content": RAG_SYSTEM},
        {"role": "user", "content": rag_user(question, pages)},
    ]
    answer = ask_answer(llm, run, messages)
    if answer is None:
        return run
    if enforce:
        run.answer, run.grounding = enforce_grounding(llm, run, corpus, messages, answer)
    else:
        run.answer = answer
        run.grounding = None if answer.refused else check_grounding(answer, corpus)
    return run
