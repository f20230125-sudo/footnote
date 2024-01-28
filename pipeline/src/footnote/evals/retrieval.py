"""Retrieval scores against FinanceBench's gold evidence pages. Needs no model and no quota.

Two settings, matching the two FinanceBench describes:
  oracle: the right filing is given, retrieval only has to find the page in it.
  full:   retrieval must find the filing and the page among every filing in the corpus.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from ..dataset import Question

Hit = tuple[str, int]
Ranker = Callable[[Question], list[Hit]]  # ranked pages for one question

KS = (1, 3, 5, 10)


@dataclass
class RetrievalScore:
    n: int
    hit_at: dict[int, float]  # any gold page in the top k
    all_at: dict[int, float]  # every gold page in the top k
    mrr: float  # reciprocal rank of the first gold page, 0 if none in the list
    doc_hit_at: dict[int, float]  # the right filing appears in the top k pages


def score(questions: list[Question], rank: Ranker) -> RetrievalScore:
    hit = dict.fromkeys(KS, 0)
    allg = dict.fromkeys(KS, 0)
    dochit = dict.fromkeys(KS, 0)
    rr = 0.0
    for q in questions:
        ranked = rank(q)
        gold = q.gold_pages
        gold_docs = {d for d, _ in gold}
        first = next((i for i, h in enumerate(ranked, start=1) if h in gold), None)
        if first:
            rr += 1 / first
        for k in KS:
            top = ranked[:k]
            if any(h in gold for h in top):
                hit[k] += 1
            if gold <= set(top):
                allg[k] += 1
            if gold_docs & {d for d, _ in top}:
                dochit[k] += 1
    n = len(questions)
    return RetrievalScore(
        n=n,
        hit_at={k: hit[k] / n for k in KS},
        all_at={k: allg[k] / n for k in KS},
        mrr=rr / n,
        doc_hit_at={k: dochit[k] / n for k in KS},
    )


def format_table(rows: dict[str, RetrievalScore]) -> str:
    head = "| setting | n | " + " | ".join(f"hit@{k}" for k in KS) + " | all@5 | MRR |"
    sep = "|" + "---|" * (len(KS) + 4)
    lines = [head, sep]
    for name, s in rows.items():
        cells = " | ".join(f"{s.hit_at[k]:.2f}" for k in KS)
        lines.append(f"| {name} | {s.n} | {cells} | {s.all_at[5]:.2f} | {s.mrr:.3f} |")
    return "\n".join(lines)
