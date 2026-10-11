"""Single-shot RAG: show the model the retrieved pages once and get a typed, cited answer."""

from __future__ import annotations

from .answer import check_grounding
from .generate import ask_answer, enforce_grounding
from .prompts import RAG_SYSTEM, rag_user
from .retrieve import Corpus, Hit
from .run import Chat, Run


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
