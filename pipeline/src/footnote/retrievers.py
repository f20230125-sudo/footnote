"""The retrievers behind each evaluated configuration. All return ranked (doc, page) pairs.

  bm25      lexical search over the whole corpus (or the given filings)
  filtered  the same, but only over filings the company/year filter allows
  hybrid    BM25's top candidates re-ranked by embedding similarity, fused with reciprocal rank

Dense retrieval re-ranks BM25's top candidates rather than searching all pages: embedding every
page of the corpus would cost far more of the free embedding quota than a question set needs.
"""

from __future__ import annotations

from .dataset import Question
from .embed import Embedder
from .filters import DocResolver
from .retrieve import Corpus, Hit

RRF_K = 60


def rrf(*rankings: list[Hit], k: int = RRF_K) -> list[Hit]:
    score: dict[Hit, float] = {}
    for ranking in rankings:
        for rank, hit in enumerate(ranking, start=1):
            score[hit] = score.get(hit, 0.0) + 1.0 / (k + rank)
    return [h for h, _ in sorted(score.items(), key=lambda kv: (-kv[1], kv[0]))]


class Retrievers:
    def __init__(self, corpus: Corpus, resolver: DocResolver, embedder: Embedder | None = None):
        self.corpus, self.resolver, self.embedder = corpus, resolver, embedder

    def candidate_docs(self, q: Question, *, setting: str, use_filter: bool) -> list[str] | None:
        if setting == "oracle":
            return [q.doc_name]
        if use_filter:
            res = self.resolver.resolve(q.question)
            return res.docs if res.narrowed else None
        return None

    def bm25(self, q: Question, k: int, *, setting: str, use_filter: bool = False) -> list[Hit]:
        docs = self.candidate_docs(q, setting=setting, use_filter=use_filter)
        return [h for h, _ in self.corpus.search(q.question, k, docs=docs)]

    def hybrid(
        self, q: Question, k: int, *, setting: str, use_filter: bool = False, candidates: int = 50
    ) -> list[Hit]:
        if self.embedder is None:
            raise RuntimeError("hybrid retrieval needs an embedder (a Gemini key)")
        lexical = self.bm25(q, candidates, setting=setting, use_filter=use_filter)
        if not lexical:
            return []
        texts = [self.corpus.page(d, p).text for d, p in lexical]  # type: ignore[union-attr]
        page_vecs = self.embedder.embed(texts, "RETRIEVAL_DOCUMENT")
        query_vec = self.embedder.embed([q.question], "RETRIEVAL_QUERY")[0]
        sims = page_vecs @ query_vec
        dense = [lexical[i] for i in sorted(range(len(lexical)), key=lambda i: (-sims[i], i))]
        return rrf(lexical, dense)[:k]
