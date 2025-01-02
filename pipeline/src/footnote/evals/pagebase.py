"""Measure how FinanceBench's `evidence_page_num` maps onto our 1-based page numbers.

For each evidence record, find the page whose words best overlap the dataset's own copy of that
page, then count (best page - dataset page). A single dominant offset is the page base.
"""

from __future__ import annotations

from collections import Counter

from ..bm25 import tokenize
from ..dataset import load_questions
from ..ingest import ingest, read_pages


def jaccard(a: set[str], b: set[str]) -> float:
    return len(a & b) / len(a | b) if a and b else 0.0


def measure(verbose: bool = False) -> Counter:
    qs = load_questions()
    docs = sorted({e.doc_name for q in qs for e in q.evidence})
    for d in docs:
        ingest(d)
    pages = {d: {p["page"]: set(tokenize(p["text"])) for p in read_pages(d)} for d in docs}
    offsets: Counter = Counter()
    weak = 0
    for q in qs:
        for e in q.evidence:
            target = set(tokenize(e.full_page or e.text))
            if not target:
                continue
            scored = [(jaccard(target, toks), n) for n, toks in pages[e.doc_name].items()]
            best_score, best = max(scored)
            if best_score < 0.5:
                weak += 1
                continue
            offsets[best - e.page] += 1
            if verbose and best - e.page not in (0, 1):
                print(q.id, e.doc_name, "dataset", e.page, "best", best, round(best_score, 2))
    print("offsets (our page - dataset page):", dict(offsets), "| weak matches skipped:", weak)
    return offsets


if __name__ == "__main__":
    measure(verbose=True)
