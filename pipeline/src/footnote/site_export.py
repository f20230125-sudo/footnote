"""Write the data the website shows. Run: python -m footnote.site_export

Everything on the site is computed here, by the same code the evaluation uses, so the page cannot
drift from the measurements. Written to web/public/data (served files) and web/tests/fixtures
(what the browser port of the search must reproduce exactly).

Not exported: FinanceBench's reference answers and evidence text. The site shows the questions and
which page the benchmark points to, which is the part that needs no licence to explain.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from . import ROOT
from .bm25 import tokenize
from .dataset import DocInfo, Question, load_docs, load_questions
from .evals.retrieval import KS, RetrievalScore, score
from .filters import NICKNAMES, DocResolver
from .ingest import ingest, read_pages
from .retrieve import Corpus

DEMO_DOCS = [
    "AMD_2022_10K",
    "BOEING_2022_10K",
    "AMCOR_2023_10K",
    "BESTBUY_2023_10K",
    "3M_2023Q2_10Q",
    "JOHNSON_JOHNSON_2023_8K_dated-2023-08-30",
    "ULTABEAUTY_2023Q4_EARNINGS",
]
EXTRA_QUERIES = [
    "How much cash did Best Buy have at the end of fiscal 2023?",
    "What are the main risk factors for Boeing?",
    "AMD revenue by segment in 2022",
    "3M litigation and environmental liabilities in the second quarter",
    "Which company mentions a separation or spin-off?",
    "net sales decreased gross profit margin",
]
OUT = ROOT / "web" / "public" / "data"
FIXTURES = ROOT / "web" / "tests" / "fixtures"
TOP = 10


def score_dict(s: RetrievalScore) -> dict:
    return {
        "n": s.n,
        "hit": {str(k): round(s.hit_at[k], 4) for k in KS},
        "allEvidence": {str(k): round(s.all_at[k], 4) for k in KS},
        "docHit": {str(k): round(s.doc_hit_at[k], 4) for k in KS},
        "mrr": round(s.mrr, 4),
    }


def rank_of(hits: list[tuple[tuple[str, int], float]], gold: set[tuple[str, int]]) -> int | None:
    for i, (h, _) in enumerate(hits, start=1):
        if h in gold:
            return i
    return None


def write(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def export_demo(qs: list[Question], infos: list[DocInfo]) -> None:
    by_name = {i.doc_name: i for i in infos}
    missing = [d for d in DEMO_DOCS if d not in by_name]
    assert not missing, f"demo filings are missing from the dataset: {missing}"
    demo_infos = [by_name[d] for d in DEMO_DOCS]  # the order the browser lists them in
    for d in DEMO_DOCS:
        ingest(d)
    corpus = Corpus(DEMO_DOCS)
    resolver = DocResolver(demo_infos)

    filings = []
    for d in DEMO_DOCS:
        info = next(i for i in demo_infos if i.doc_name == d)
        pages = [p["text"].strip() for p in read_pages(d)]
        filings.append(
            {
                "doc": d,
                "company": info.company,
                "period": info.period,
                "type": info.doc_type,
                "pages": len(pages),
                "source": info.link,
            }
        )
        write(OUT / "pages" / f"{d}.json", {"doc": d, "pages": pages})
    write(OUT / "filings.json", filings)

    examples = []
    parity = []
    demo_qs = [q for q in qs if q.doc_name in DEMO_DOCS]
    for q in demo_qs:
        gold = q.gold_pages
        res = resolver.resolve(q.question)
        oracle = corpus.search(q.question, 50, docs=[q.doc_name])
        filtered = corpus.search(q.question, 50, docs=res.docs)
        every = corpus.search(q.question, 50)
        examples.append(
            {
                "id": q.id,
                "question": q.question,
                "type": q.question_type,
                "company": q.company,
                "doc": q.doc_name,
                "gold": [{"doc": d, "page": p} for d, p in sorted(gold)],
                "rank": {
                    "oracle": rank_of(oracle, gold),
                    "filtered": rank_of(filtered, gold),
                    "all": rank_of(every, gold),
                },
            }
        )
    examples.sort(key=lambda e: (DEMO_DOCS.index(e["doc"]), e["id"]))
    write(OUT / "examples.json", examples)

    queries = [q.question for q in demo_qs] + EXTRA_QUERIES
    for text in queries:
        res = resolver.resolve(text)
        parity.append(
            {
                "query": text,
                "tokens": tokenize(text),
                "resolve": {
                    "docs": res.docs,
                    "companies": res.companies,
                    "years": res.years,
                    "narrowed": res.narrowed,
                },
                "all": [
                    {"doc": d, "page": p, "score": round(s, 5)}
                    for (d, p), s in corpus.search(text, TOP)
                ],
                "filtered": [
                    {"doc": d, "page": p, "score": round(s, 5)}
                    for (d, p), s in corpus.search(text, TOP, docs=res.docs)
                ],
            }
        )
    write(FIXTURES / "parity.json", parity)
    print(f"demo: {len(DEMO_DOCS)} filings, {len(corpus.pages)} pages, {len(examples)} questions")


def export_results(qs: list[Question], infos: list[DocInfo]) -> None:
    needed = {e.doc_name for q in qs for e in q.evidence}
    docs = sorted({i.doc_name for i in infos} | needed)
    for d in docs:
        ingest(d)
    corpus = Corpus(docs)
    infos_in = [i for i in infos if i.doc_name in set(docs)]
    resolver = DocResolver(infos_in)
    plain = DocResolver(infos_in, nicknames={})

    def rank(q: Question, docs_: list[str] | None = None):
        return [h for h, _ in corpus.search(q.question, 10, docs=docs_)]

    settings = {
        "oracle": lambda q: rank(q, [q.doc_name]),
        "full": lambda q: rank(q),
        "filtered": lambda q: rank(q, resolver.resolve(q.question).docs),
    }
    by_type = {}
    for t in sorted({q.question_type for q in qs}):
        sub = [q for q in qs if q.question_type == t]
        by_type[t] = {name: score_dict(score(sub, fn)) for name, fn in settings.items()}
    res = [(q, resolver.resolve(q.question)) for q in qs]
    narrowed = [r for _, r in res if r.narrowed]
    company_of = {i.doc_name: i.company for i in infos}
    year = re.compile(r"\b(?:fy\s?)?((?:19|20)\d{2})\b", re.IGNORECASE)
    # Questions the right filing alone gets right and the filter does not, and how many of those
    # had another filing of the same company in the filtered top 10.
    gap = {"oracleOnly": 0, "crowded": 0}
    for q in qs:
        gold = q.gold_pages
        top = settings["filtered"](q)
        if gold & set(settings["oracle"](q)) and not gold & set(top):
            gap["oracleOnly"] += 1
            gap["crowded"] += any(
                d != q.doc_name and company_of.get(d) == company_of.get(q.doc_name) for d, _ in top
            )
    data = {
        "corpus": {"filings": len(docs), "pages": len(corpus.pages)},
        "questions": len(qs),
        "ks": list(KS),
        "overall": {name: score_dict(score(qs, fn)) for name, fn in settings.items()},
        "byType": by_type,
        "filter": {
            "keptRightFiling": sum(q.doc_name in r.docs for q, r in res),
            "recognised": len(narrowed),
            "recognisedWithoutNicknames": sum(plain.resolve(q.question).narrowed for q in qs),
            "candidatesWhenRecognised": round(
                sum(len(r.docs) for r in narrowed) / max(len(narrowed), 1), 2
            ),
            "namingAYear": sum(bool(year.search(q.question)) for q in qs),
            "moreThanOneCandidate": sum(len(r.docs) > 1 for r in narrowed),
            "rightFilingAloneWins": gap["oracleOnly"],
            "ofThoseCrowdedOut": gap["crowded"],
            "nicknames": {c: n for c, n in NICKNAMES.items()},
            "lost": [
                {"id": q.id, "doc": q.doc_name, "companies": r.companies, "years": r.years}
                for q, r in res
                if q.doc_name not in r.docs
            ],
        },
    }
    write(OUT / "results.json", data)
    print(f"results: {data['corpus']}, filter kept {data['filter']['keptRightFiling']}/{len(qs)}")


def main() -> None:
    """`python -m footnote.site_export` writes everything; add `demo` for only the demo files
    (seconds), since the results take several minutes to compute over all 360 filings."""
    qs, infos = load_questions(), load_docs()
    export_demo(qs, infos)
    if "demo" not in sys.argv[1:]:
        export_results(qs, infos)


if __name__ == "__main__":
    main()
