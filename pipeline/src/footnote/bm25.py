"""BM25 over pages. Plain Python, no model, no quota.

The same tokeniser and the same scoring are written again in TypeScript for the browser demo, so a
page that ranks first here ranks first there. Change both together.
"""

from __future__ import annotations

import math
import re
from collections import Counter, defaultdict

_TOKEN = re.compile(r"[a-z0-9]+(?:[.,][0-9]+)*")

K1 = 1.5
B = 0.75


def tokenize(text: str) -> list[str]:
    """Lower-case words and numbers. A number keeps its thousands commas and decimal point, with the
    commas dropped so that "1,577" and "1577" are the same token."""
    out = []
    for m in _TOKEN.finditer(text.lower()):
        tok = m.group(0)
        if tok[0].isdigit():
            tok = tok.replace(",", "")
        out.append(tok)
    return out


class BM25:
    def __init__(self, docs: list[list[str]]):
        self.n = len(docs)
        self.lengths = [len(d) for d in docs]
        self.avg = (sum(self.lengths) / self.n) if self.n else 0.0
        self.postings: dict[str, list[tuple[int, int]]] = defaultdict(list)
        for i, toks in enumerate(docs):
            for term, tf in Counter(toks).items():
                self.postings[term].append((i, tf))

    def idf(self, term: str) -> float:
        df = len(self.postings.get(term, ()))
        return math.log(1 + (self.n - df + 0.5) / (df + 0.5))

    def scores(self, query: list[str], allowed: set[int] | None = None) -> dict[int, float]:
        out: dict[int, float] = defaultdict(float)
        for term in sorted(set(query)):  # a fixed order, so the browser port adds in the same one
            idf = self.idf(term)
            for i, tf in self.postings.get(term, ()):
                if allowed is not None and i not in allowed:
                    continue
                norm = tf + K1 * (1 - B + B * self.lengths[i] / self.avg)
                out[i] += idf * tf * (K1 + 1) / norm
        return out

    def top(
        self, query: list[str], k: int, allowed: set[int] | None = None
    ) -> list[tuple[int, float]]:
        s = self.scores(query, allowed)
        return sorted(s.items(), key=lambda kv: (-kv[1], kv[0]))[:k]
