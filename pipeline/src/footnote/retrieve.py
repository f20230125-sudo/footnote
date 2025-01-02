"""Page retrieval. A hit is a (doc, page) pair, 1-based."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from . import PAGES
from .bm25 import BM25, tokenize
from .ingest import read_pages

Hit = tuple[str, int]


@dataclass
class Page:
    doc: str
    page: int
    text: str


class Corpus:
    def __init__(self, docs: list[str], pages_dir: Path = PAGES):
        self.pages: list[Page] = []
        self.by_doc: dict[str, set[int]] = {}
        for d in docs:
            idx = set()
            for p in read_pages(d, pages_dir):
                idx.add(len(self.pages))
                self.pages.append(Page(p["doc"], p["page"], p["text"]))
            self.by_doc[d] = idx
        self.bm25 = BM25([tokenize(p.text) for p in self.pages])
        self._key = {(p.doc, p.page): i for i, p in enumerate(self.pages)}

    def page(self, doc: str, page: int) -> Page | None:
        i = self._key.get((doc, page))
        return self.pages[i] if i is not None else None

    def search(self, query: str, k: int = 10, doc: str | None = None) -> list[tuple[Hit, float]]:
        """BM25 over every page, or only over one filing when `doc` is given."""
        allowed = self.by_doc[doc] if doc is not None else None
        top = self.bm25.top(tokenize(query), k, allowed)
        return [((self.pages[i].doc, self.pages[i].page), s) for i, s in top]
