import json

from footnote.evals import live


def record(question_id, verdict="correct", refused=False):
    return {
        "id": question_id,
        "type": "test",
        "verdict": verdict,
        "rule_match": True,
        "page_hit": True,
        "judge_model": "judge-model",
        "judge_cost_usd": 0.01,
        "reason": "PRIVATE REFERENCE REASONING",
        "run": {
            "answer": {"answer": "PRIVATE BENCHMARK ANSWER", "refused": refused},
            "grounding": {"cited": 1, "supported": 1, "issues": ["PRIVATE QUOTE"]},
            "steps": [
                {"kind": "model", "name": "answer-model", "duration_ms": 1200, "cost_usd": 0.02}
            ],
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "stop": "finished",
        },
    }


def test_public_export_contains_scores_but_no_benchmark_text_and_counts_only_paired_ids(
    tmp_path, monkeypatch
):
    monkeypatch.setattr(live, "ROOT", tmp_path)
    (tmp_path / "web/public/data").mkdir(parents=True)
    out = tmp_path / "runs"
    out.mkdir()
    for name, rows in [("C1", [record("q1"), record("q2")]), ("C5", [record("q1")])]:
        (out / f"{name}_full.jsonl").write_text(
            "\n".join(json.dumps(r) for r in rows), encoding="utf-8"
        )
    manifest = {"configs": ["C1", "C5"], "questionIds": ["q1", "q2"], "filings": 2, "pages": 4}
    result = live.publish(out, manifest, target=tmp_path / "published")
    assert result["paired"]["n"] == 1 and not result["complete"]
    content = (tmp_path / "published/live-evaluation.json").read_text()
    assert "PRIVATE" not in content
    assert result["summary"]["C1"]["apiEquivalentUsdIncludingJudge"] == 0.03


def test_refused_answer_does_not_inflate_successful_quote_check_denominator():
    result = live.summarise([record("q1"), record("q2", "refused", True)])
    assert result["answersWithCheckedQuotes"] == 1
    assert result["refused"] == 1 and result["accuracy"] == 0.5
