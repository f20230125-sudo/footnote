"""Paired, resumable real-model comparison; publishes metrics, never benchmark text.

    FOOTNOTE_PROVIDER=claude-cli python -m footnote.evals.live --subset 50

Question IDs are fixed before inference. Configurations alternate per question so
a quota interruption leaves a paired sample, rather than one complete arm only.
Full answers and reference material stay under git-ignored data/.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import statistics
import subprocess
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

from .. import DATA, ROOT
from ..filters import DocResolver
from ..retrievers import Retrievers
from ..settings import build_runtime
from .__main__ import _corpus
from .answers import CONFIGS, Context, read_records, run_questions, stratified_subset
from .report import bootstrap_ci, paired_diff


def digest(value: object) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def inference_fingerprint() -> str:
    """Ignore formatting and Git metadata; preserve prompts and inference semantics."""
    package = Path(__file__).resolve().parents[1]
    names = [
        "agent.py",
        "answer.py",
        "generate.py",
        "judge.py",
        "rag.py",
        "tools.py",
        "prompts.py",
        "retrieve.py",
        "filters.py",
        "dataset.py",
        "bm25.py",
        "llm/claude_cli.py",
        "llm/router.py",
    ]
    return digest(
        {name: ast.dump(ast.parse((package / name).read_text(encoding="utf-8"))) for name in names}
    )


def summarise(records: list[dict]) -> dict:
    scores = [float(r["verdict"] == "correct") for r in records]
    quoted = [
        r
        for r in records
        if (r["run"].get("grounding") or {}).get("cited", 0)
        and not (r["run"].get("answer") or {}).get("refused", True)
    ]
    supported = [
        r for r in quoted if r["run"]["grounding"]["supported"] == r["run"]["grounding"]["cited"]
    ]
    latencies, tokens, costs = [], [], []
    for r in records:
        steps = [s for s in r["run"]["steps"] if s["kind"] == "model"]
        latencies.append(sum(s["duration_ms"] for s in steps) / 1000)
        tokens.append(r["run"]["prompt_tokens"] + r["run"]["completion_tokens"])
        amounts = [s.get("cost_usd") for s in steps] + [r.get("judge_cost_usd")]
        costs.append(sum(a for a in amounts if a is not None))
    return {
        "n": len(records),
        "correct": int(sum(scores)),
        "accuracy": statistics.mean(scores) if scores else 0,
        "accuracy95": list(bootstrap_ci(scores)),
        "refused": sum(r["verdict"] == "refused" for r in records),
        "unjudged": sum(r["verdict"] == "unjudged" for r in records),
        "answersWithCheckedQuotes": len(quoted),
        "allQuotesPresent": len(supported),
        "medianAnswerSeconds": statistics.median(latencies) if latencies else 0,
        "meanAnswerTokens": statistics.mean(tokens) if tokens else 0,
        "apiEquivalentUsdIncludingJudge": sum(costs),
        "questions": [
            {
                "id": r["id"],
                "type": r["type"],
                "verdict": r["verdict"],
                "pageHit": r["page_hit"],
                "stop": r["run"]["stop"],
                "ruleMatch": r["rule_match"],
                "grounding": {
                    k: (r["run"].get("grounding") or {}).get(k, 0) for k in ("cited", "supported")
                },
            }
            for r in records
        ],
    }


def publish(out: Path, manifest: dict, target: Path = ROOT / "results") -> dict:
    records = {cid: read_records(out / f"{cid}_full.jsonl") for cid in manifest["configs"]}
    common = set.intersection(*[{r["id"] for r in rows} for rows in records.values()])
    summaries = {
        cid: summarise([r for r in rows if r["id"] in common]) for cid, rows in records.items()
    }
    ids = set(manifest["questionIds"])
    complete = all({r["id"] for r in rows} == ids for rows in records.values())
    configs = manifest["configs"]
    a, b = [{r["id"]: float(r["verdict"] == "correct") for r in records[c]} for c in configs]
    diff, interval, paired = paired_diff(a, b)
    payload = {
        "manifest": manifest,
        "complete": complete,
        "updated": datetime.now(UTC).isoformat(),
        "summary": summaries,
        "completedByConfig": {cid: len(rows) for cid, rows in records.items()},
        "pairedQuestionTypes": dict(
            Counter(r["type"] for r in records[configs[0]] if r["id"] in common)
        ),
        "answerModels": sorted(
            {
                s["name"]
                for rows in records.values()
                for r in rows
                for s in r["run"]["steps"]
                if s["kind"] == "model"
            }
        ),
        "judgeModels": sorted(
            {r["judge_model"] for rows in records.values() for r in rows if r["judge_model"]}
        ),
        "paired": {
            "a": configs[0],
            "b": configs[1],
            "n": paired,
            "accuracyDifference": diff,
            "difference95": list(interval),
        },
        "limits": [
            "A fixed stratified sample, not the full benchmark; "
            "intervals reflect sample uncertainty.",
            "Tables compare only completed pairs. A quota-limited prefix of the planned "
            "stratified sample is not necessarily stratified itself.",
            "Quote checks verify text exists on a page, not that it supports every inference.",
            "A different model judges answers; this is automated grading, not human validation.",
            "C1 and C5 differ in filtering, page access, calculation and citation enforcement; "
            "this comparison does not isolate agent reasoning alone.",
            "CLI cannot set temperature or max output tokens; "
            "its tools and customizations are disabled.",
            "Costs are API-equivalent estimates reported by CLI, not subscription charges.",
            "Latency sums recorded answer-model calls; "
            "cached replays retain original call latency.",
        ],
    }
    target.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, indent=2) + "\n"
    (target / "live-evaluation.json").write_text(text, encoding="utf-8")
    public = ROOT / "web" / "public" / "data" / "live-evaluation.json"
    public.write_text(text, encoding="utf-8")
    lines = [
        "# Real-model evaluation",
        "",
        f"Status: {'complete' if complete else 'partial'}. "
        f"Fixed sample: {len(ids)} questions. Corpus: {manifest['filings']} filings, "
        f"{manifest['pages']:,} pages.",
        "",
        "| Configuration | n | Correct | 95% interval | Refused | Median answer seconds | "
        "API-equivalent USD, with judge |",
        "|---|---:|---:|---|---:|---:|---:|",
    ]
    for cid, s in summaries.items():
        lo, hi = s["accuracy95"]
        lines.append(
            f"| {cid}: {CONFIGS[cid].label} | {s['n']} | {s['correct']} "
            f"({s['accuracy']:.0%}) | {lo:.0%} to {hi:.0%} | {s['refused']} | "
            f"{s['medianAnswerSeconds']:.1f} | ${s['apiEquivalentUsdIncludingJudge']:.3f} |"
        )
    lines += [
        "",
        f"Paired {configs[1]} minus {configs[0]}: {100 * diff:+.1f} percentage points "
        f"(95% interval {100 * interval[0]:+.1f} to {100 * interval[1]:+.1f}; n={paired}).",
        "",
        f"Answer models: {', '.join(payload['answerModels'])}.",
        f"Judge models: {', '.join(payload['judgeModels'])}.",
        "",
        "Reference answers, questions, evidence excerpts and private traces are not redistributed. "
        "The JSON includes question IDs and scores so the paired result can be audited.",
        "",
    ]
    lines += [f"- {s}" for s in payload["limits"]]
    lines += [
        "",
        "Completed pairs by question type: "
        + ", ".join(f"{name}: {n}" for name, n in payload["pairedQuestionTypes"].items())
        + ".",
    ]
    (target / "live-evaluation.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--subset", type=int, default=50)
    parser.add_argument("--docs", choices=["needed", "all"], default="all")
    parser.add_argument("--out", type=Path, default=DATA / "runs" / "live-v1")
    parser.add_argument("--configs", nargs=2, choices=["C1", "C5"], default=["C1", "C5"])
    args = parser.parse_args()
    if not 1 <= args.subset <= 150 or len(set(args.configs)) != 2:
        parser.error("choose 1..150 questions and two distinct configurations")
    qs, infos, docs, corpus = _corpus(args)
    subset = stratified_subset(qs, args.subset)
    rt = build_runtime()
    manifest = {
        "schemaVersion": 1,
        "provider": rt.answer.endpoints[0].provider.name,
        "inferenceFingerprint": inference_fingerprint(),
        "questionIds": [q.id for q in subset],
        "questionTypes": dict(Counter(q.question_type for q in subset)),
        "configs": args.configs,
        "setting": "full",
        "filings": len(docs),
        "pages": len(corpus.pages),
        "corpusFingerprint": digest(
            [(p.doc, p.page, hashlib.sha256(p.text.encode()).hexdigest()) for p in corpus.pages]
        ),
        "benchmarkFingerprint": digest([q.model_dump() for q in qs]),
        "answerModelAliases": rt.answer_models,
        "judgeModelAliases": rt.judge_models,
        "sourceCommit": subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True
        ).stdout.strip(),
    }
    args.out.mkdir(parents=True, exist_ok=True)
    manifest_path = args.out / "manifest.json"
    if manifest_path.exists():
        existing = json.loads(manifest_path.read_text())
        identity = [k for k in manifest if k != "sourceCommit"]
        if any(existing.get(k) != manifest[k] for k in identity):
            raise SystemExit(
                "Run identity changed: choose a new --out directory to avoid mixing runs"
            )
        # A documentation-only commit must not prevent resuming a rate-limited run.
        manifest = existing
    manifest.pop("stopReason", None)
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    resolver = DocResolver([i for i in infos if i.doc_name in set(docs)])
    ctx = Context(rt.answer, rt.judge, corpus, resolver, Retrievers(corpus, resolver, rt.embedder))
    for index, q in enumerate(subset, 1):
        for cid in args.configs:
            print(f"Question {index}/{len(subset)}: {cid}", flush=True)
            _, finished = run_questions(ctx, CONFIGS[cid], [q], "full", out=args.out)
            if not finished:
                manifest["stopReason"] = "provider_limit"
                manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
                publish(args.out, manifest)
                return 2
            manifest.pop("stopReason", None)
            publish(args.out, manifest)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
