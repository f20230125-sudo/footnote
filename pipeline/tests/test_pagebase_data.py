"""Runs only where the FinanceBench clone and the extracted pages exist (not in CI).

Guards the one assumption everything else depends on: the page number the dataset gives is the page
our extraction numbers. Searching with the gold evidence text must find its own page.
"""

import pytest

from footnote import FINANCEBENCH, PAGES
from footnote.dataset import load_questions
from footnote.evals.retrieval import score
from footnote.retrieve import Corpus

pytestmark = pytest.mark.skipif(
    not (FINANCEBENCH / "data").exists() or not PAGES.exists() or not any(PAGES.glob("*.jsonl")),
    reason="needs data/financebench and data/pages",
)


def test_evidence_text_finds_its_own_page():
    qs = load_questions()
    docs = sorted({e.doc_name for q in qs for e in q.evidence})
    corpus = Corpus(docs)

    def by_evidence(q):
        text = " ".join(e.text for e in q.evidence)[:2000]
        return [h for h, _ in corpus.search(text, 10, docs=[q.doc_name])]

    s = score(qs, by_evidence)
    assert s.hit_at[3] >= 0.97, "page numbers are probably off by one again"
