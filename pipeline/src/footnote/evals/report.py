"""Turn run files into the table in the README. Small n, so every difference carries an interval."""

from __future__ import annotations

import random
from dataclasses import dataclass
from pathlib import Path

from .answers import RUNS, read_records


def bootstrap_ci(xs: list[float], reps: int = 2000, seed: int = 0) -> tuple[float, float]:
    """95% percentile interval for the mean. (0, 0) for an empty list."""
    if not xs:
        return 0.0, 0.0
    rng = random.Random(seed)
    n = len(xs)
    means = sorted(sum(xs[rng.randrange(n)] for _ in range(n)) / n for _ in range(reps))
    return means[int(0.025 * reps)], means[int(0.975 * reps) - 1]


def paired_diff(a: dict[str, float], b: dict[str, float]) -> tuple[float, tuple[float, float], int]:
    """Mean of (b - a) over the questions both have, its interval, and how many questions."""
    ids = sorted(set(a) & set(b))
    d = [b[i] - a[i] for i in ids]
    if not d:
        return 0.0, (0.0, 0.0), 0
    return sum(d) / len(d), bootstrap_ci(d), len(d)


@dataclass
class Row:
    config: str
    setting: str
    n: int
    accuracy: float
    ci: tuple[float, float]
    refused: float
    page_hit: float | None
    faithful: float | None
    rule_agree: float | None
    tokens: float
    calls: float


def summarise(config: str, setting: str, records: list[dict]) -> Row:
    n = len(records)
    correct = [1.0 if r["verdict"] == "correct" else 0.0 for r in records]
    hits = [r["page_hit"] for r in records if r["page_hit"] is not None]
    graded = [
        r
        for r in records
        if r["run"]["grounding"] and r["run"]["grounding"]["cited"] > 0 and r["run"]["answer"]
    ]
    faithful = [
        1.0 if r["run"]["grounding"]["supported"] == r["run"]["grounding"]["cited"] else 0.0
        for r in graded
    ]
    both = [
        r
        for r in records
        if r["rule_match"] is not None and r["verdict"] in ("correct", "incorrect")
    ]
    agree = [1.0 if (r["verdict"] == "correct") == r["rule_match"] else 0.0 for r in both]
    return Row(
        config=config,
        setting=setting,
        n=n,
        accuracy=sum(correct) / n if n else 0.0,
        ci=bootstrap_ci(correct),
        refused=sum(r["verdict"] == "refused" for r in records) / n if n else 0.0,
        page_hit=sum(hits) / len(hits) if hits else None,
        faithful=sum(faithful) / len(faithful) if faithful else None,
        rule_agree=sum(agree) / len(agree) if agree else None,
        tokens=sum(r["run"]["prompt_tokens"] + r["run"]["completion_tokens"] for r in records) / n
        if n
        else 0.0,
        calls=sum(r["run"]["model_calls"] for r in records) / n if n else 0.0,
    )


def _pct(x: float | None) -> str:
    return "n/a" if x is None else f"{100 * x:.0f}%"


def table(rows: list[Row]) -> str:
    head = (
        "| config | setting | n | correct | 95% interval | refused | right page shown | "
        "citations verified | judge = rule | tokens/q | calls/q |"
    )
    lines = [head, "|" + "---|" * 11]
    for r in rows:
        lines.append(
            f"| {r.config} | {r.setting} | {r.n} | {_pct(r.accuracy)} | "
            f"{_pct(r.ci[0])} to {_pct(r.ci[1])} | {_pct(r.refused)} | {_pct(r.page_hit)} | "
            f"{_pct(r.faithful)} | {_pct(r.rule_agree)} | {r.tokens:.0f} | {r.calls:.1f} |"
        )
    return "\n".join(lines)


def load_rows(out: Path = RUNS, only_ids: set[str] | None = None) -> tuple[list[Row], dict]:
    rows, by_key = [], {}
    for path in sorted(out.glob("*.jsonl")):
        config, setting = path.stem.split("_", 1)
        recs = read_records(path)
        if only_ids is not None:
            recs = [r for r in recs if r["id"] in only_ids]
        if recs:
            rows.append(summarise(config, setting, recs))
            by_key[(config, setting)] = {
                r["id"]: 1.0 if r["verdict"] == "correct" else 0.0 for r in recs
            }
    return rows, by_key


def comparisons(by_key: dict, setting: str, order: list[str]) -> str:
    """Each configuration against the one before it, on the questions both ran."""
    lines = ["| step | questions | change in correct | 95% interval |", "|---|---|---|---|"]
    prev = None
    for c in order:
        cur = by_key.get((c, setting))
        if cur is None:
            continue
        if prev is not None and by_key.get((prev, setting)):
            d, (lo, hi), n = paired_diff(by_key[(prev, setting)], cur)
            span = f"{100 * lo:+.0f} to {100 * hi:+.0f}"
            lines.append(f"| {prev} to {c} | {n} | {100 * d:+.0f} points | {span} |")
        prev = c
    return "\n".join(lines)
