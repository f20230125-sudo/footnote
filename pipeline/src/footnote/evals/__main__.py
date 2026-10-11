"""python -m footnote.evals retrieval [--docs needed|all]"""

from __future__ import annotations

import argparse

from ..dataset import load_docs, load_questions
from ..filters import DocResolver
from ..ingest import ingest
from ..retrieve import Corpus
from .retrieval import format_table, score


def cmd_retrieval(args: argparse.Namespace) -> None:
    qs = load_questions()
    infos = load_docs()
    needed = sorted({e.doc_name for q in qs for e in q.evidence})
    docs = needed if args.docs == "needed" else sorted({i.doc_name for i in infos} | set(needed))
    for d in docs:
        ingest(d)
    corpus = Corpus(docs)
    infos_in = [i for i in infos if i.doc_name in set(docs)]
    resolver = DocResolver(infos_in)
    plain = DocResolver(infos_in, nicknames={})
    print(f"corpus: {len(docs)} filings, {len(corpus.pages)} pages")
    print(
        "company recognised without nicknames: "
        f"{sum(plain.resolve(q.question).narrowed for q in qs)}/{len(qs)}"
    )

    def rank(q, docs=None):
        return [h for h, _ in corpus.search(q.question, 10, docs=docs)]

    def oracle(q):
        return rank(q, [q.doc_name])

    def full(q):
        return rank(q)

    def filtered(q):
        return rank(q, resolver.resolve(q.question).docs)

    res = [(q, resolver.resolve(q.question)) for q in qs]
    kept = sum(q.doc_name in r.docs for q, r in res)
    narrowed = [r for _, r in res if r.narrowed]
    print(
        f"filter: right filing kept for {kept}/{len(qs)}; company recognised for "
        f"{len(narrowed)}/{len(qs)}; candidates per question when recognised: "
        f"{sum(len(r.docs) for r in narrowed) / max(len(narrowed), 1):.1f} of {len(docs)}"
    )
    for q, r in res:
        if q.doc_name not in r.docs:
            print(f"  lost {q.id} {q.doc_name}: companies={r.companies} years={r.years}")

    rows = {
        "BM25, oracle filing": score(qs, oracle),
        "BM25, full corpus": score(qs, full),
        "BM25 + company/year filter": score(qs, filtered),
    }
    print(format_table(rows))
    for t in sorted({q.question_type for q in qs}):
        sub = [q for q in qs if q.question_type == t]
        print(f"\n{t} (n={len(sub)})")
        print(
            format_table(
                {
                    "oracle": score(sub, oracle),
                    "full": score(sub, full),
                    "filtered": score(sub, filtered),
                }
            )
        )


def main() -> None:
    p = argparse.ArgumentParser(prog="footnote.evals")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("retrieval", help="retrieval scores against gold evidence pages")
    r.add_argument("--docs", choices=["needed", "all"], default="needed")
    r.set_defaults(fn=cmd_retrieval)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
