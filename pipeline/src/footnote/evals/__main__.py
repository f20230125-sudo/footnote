"""python -m footnote.evals retrieval | run | report"""

from __future__ import annotations

import argparse

from ..dataset import load_docs, load_questions
from ..filters import DocResolver
from ..ingest import ingest
from ..retrieve import Corpus
from .retrieval import format_table, score


def _corpus(args: argparse.Namespace):
    qs = load_questions()
    infos = load_docs()
    needed = sorted({e.doc_name for q in qs for e in q.evidence})
    docs = needed if args.docs == "needed" else sorted({i.doc_name for i in infos} | set(needed))
    for d in docs:
        ingest(d)
    return qs, infos, docs, Corpus(docs)


def cmd_retrieval(args: argparse.Namespace) -> None:
    qs, infos, docs, corpus = _corpus(args)
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


def cmd_run(args: argparse.Namespace) -> None:
    from ..retrievers import Retrievers
    from ..settings import build_runtime
    from .answers import CONFIGS, Context, run_questions, stratified_subset

    qs, infos, docs, corpus = _corpus(args)
    resolver = DocResolver([i for i in infos if i.doc_name in set(docs)])
    rt = build_runtime()
    print(f"answering with {rt.answer_models}; judging with {rt.judge_models}")
    ctx = Context(rt.answer, rt.judge, corpus, resolver, Retrievers(corpus, resolver, rt.embedder))
    subset = qs if args.subset == 0 else stratified_subset(qs, args.subset)
    for cid in args.config:
        n, finished = run_questions(ctx, CONFIGS[cid], subset, args.setting)
        print(f"{cid}: {n} new, {'finished' if finished else 'stopped early'}")
        if not finished:
            break


def cmd_report(args: argparse.Namespace) -> None:
    from .answers import stratified_subset
    from .report import comparisons, load_rows, table

    only = None
    if args.subset:
        only = {q.id for q in stratified_subset(load_questions(), args.subset)}
    rows, by_key = load_rows(only_ids=only)
    print(table(rows))
    for setting in sorted({r.setting for r in rows}):
        print(f"\n{setting} setting, each step against the one before:")
        print(comparisons(by_key, setting, ["C0", "C1", "C2", "C3", "C4", "C5"]))


def main() -> None:
    p = argparse.ArgumentParser(prog="footnote.evals")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("retrieval", help="retrieval scores against gold evidence pages (no model)")
    r.add_argument("--docs", choices=["needed", "all"], default="needed")
    r.set_defaults(fn=cmd_retrieval)
    u = sub.add_parser("run", help="answer and grade questions with a configuration (needs a key)")
    u.add_argument("--config", nargs="+", required=True, choices=[f"C{i}" for i in range(6)])
    u.add_argument("--setting", choices=["oracle", "full"], default="full")
    u.add_argument("--subset", type=int, default=50, help="stratified subset size; 0 means all 150")
    u.add_argument("--docs", choices=["needed", "all"], default="all")
    u.set_defaults(fn=cmd_run)
    t = sub.add_parser("report", help="the results table from the run files")
    t.add_argument("--subset", type=int, default=0)
    t.set_defaults(fn=cmd_report)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
