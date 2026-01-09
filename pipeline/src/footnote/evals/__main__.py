"""python -m footnote.evals retrieval [--docs 84|all]"""

from __future__ import annotations

import argparse

from ..dataset import load_docs, load_questions
from ..ingest import ingest
from ..retrieve import Corpus
from .retrieval import format_table, score


def cmd_retrieval(args: argparse.Namespace) -> None:
    qs = load_questions()
    needed = sorted({e.doc_name for q in qs for e in q.evidence})
    docs = (
        needed if args.docs == "needed" else sorted({d.doc_name for d in load_docs()} | set(needed))
    )
    for d in docs:
        ingest(d)
    corpus = Corpus(docs)
    print(f"corpus: {len(docs)} filings, {len(corpus.pages)} pages")

    def oracle(q):
        return [h for h, _ in corpus.search(q.question, 10, doc=q.doc_name)]

    def full(q):
        return [h for h, _ in corpus.search(q.question, 10)]

    rows = {"BM25, oracle filing": score(qs, oracle), "BM25, full corpus": score(qs, full)}
    print(format_table(rows))
    for t in sorted({q.question_type for q in qs}):
        sub = [q for q in qs if q.question_type == t]
        print(f"\n{t} (n={len(sub)})")
        print(format_table({"oracle": score(sub, oracle), "full": score(sub, full)}))


def main() -> None:
    p = argparse.ArgumentParser(prog="footnote.evals")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("retrieval", help="retrieval scores against gold evidence pages")
    r.add_argument("--docs", choices=["needed", "all"], default="needed")
    r.set_defaults(fn=cmd_retrieval)
    args = p.parse_args()
    args.fn(args)


main()
