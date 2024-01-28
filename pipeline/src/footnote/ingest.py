"""PDF to pages. One JSONL file per filing in data/pages, so a rerun only reads what changed.

Pages are numbered from 1 here (the number a reader sees in a PDF viewer). FinanceBench counts from
0; `dataset.py` converts, and `evals/pagebase.py` measures that rather than assuming it.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

import pymupdf

from . import FINANCEBENCH, PAGES


def pdf_path(doc_name: str, root: Path = FINANCEBENCH) -> Path:
    return root / "pdfs" / f"{doc_name}.pdf"


def extract_pages(pdf: Path) -> list[str]:
    """Plain text of every page, in reading order. Tables stay as lines of cells."""
    with pymupdf.open(pdf) as doc:
        return [page.get_text("text") for page in doc]


def pages_file(doc_name: str, out: Path = PAGES) -> Path:
    return out / f"{doc_name}.jsonl"


def ingest(doc_name: str, *, force: bool = False, out: Path = PAGES) -> int:
    target = pages_file(doc_name, out)
    if target.exists() and not force:
        return sum(1 for _ in target.open(encoding="utf-8"))
    out.mkdir(parents=True, exist_ok=True)
    texts = extract_pages(pdf_path(doc_name))
    tmp = target.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        for i, text in enumerate(texts, start=1):
            f.write(
                json.dumps({"doc": doc_name, "page": i, "text": text}, ensure_ascii=False) + "\n"
            )
    tmp.replace(target)
    return len(texts)


def read_pages(doc_name: str, out: Path = PAGES) -> Iterator[dict]:
    with pages_file(doc_name, out).open(encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)
