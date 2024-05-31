"""FinanceBench records as typed objects."""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel

from . import FINANCEBENCH

# FinanceBench counts pages from 0; every page number here is 1-based, as in a PDF viewer.
# Measured on all 183 evidence records (every one is +1): `python -m footnote.evals.pagebase`.
DATASET_PAGE_OFFSET = 1


class Evidence(BaseModel):
    doc_name: str
    page: int  # 1-based, already converted
    text: str
    full_page: str = ""


class Question(BaseModel):
    id: str
    company: str
    doc_name: str
    question_type: str
    reasoning: str | None
    question: str
    answer: str
    justification: str
    evidence: list[Evidence]

    @property
    def gold_pages(self) -> set[tuple[str, int]]:
        return {(e.doc_name, e.page) for e in self.evidence}


class DocInfo(BaseModel):
    doc_name: str
    company: str
    sector: str
    doc_type: str
    period: int | str
    link: str = ""  # where the company published the filing


def _lines(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def load_questions(root: Path = FINANCEBENCH) -> list[Question]:
    out: list[Question] = []
    for r in _lines(root / "data" / "financebench_open_source.jsonl"):
        out.append(
            Question(
                id=r["financebench_id"],
                company=r["company"],
                doc_name=r["doc_name"],
                question_type=r["question_type"],
                reasoning=r.get("question_reasoning"),
                question=r["question"],
                answer=r["answer"],
                justification=r.get("justification") or "",
                evidence=[
                    Evidence(
                        doc_name=e["doc_name"],
                        page=e["evidence_page_num"] + DATASET_PAGE_OFFSET,
                        text=e.get("evidence_text") or "",
                        full_page=e.get("evidence_text_full_page") or "",
                    )
                    for e in (r.get("evidence") or [])
                ],
            )
        )
    return out


def load_docs(root: Path = FINANCEBENCH) -> list[DocInfo]:
    return [
        DocInfo(
            doc_name=r["doc_name"],
            company=r["company"],
            sector=r.get("gics_sector") or "",
            doc_type=r["doc_type"],
            period=r["doc_period"],
            link=r.get("doc_link") or "",
        )
        for r in _lines(root / "data" / "financebench_document_information.jsonl")
    ]
