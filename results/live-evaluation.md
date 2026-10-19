# Real-model evaluation

Status: partial. Fixed sample: 50 questions. Corpus: 360 filings, 53,399 pages.

| Configuration | n | Correct | 95% interval | Refused | Median answer seconds | API-equivalent USD, with judge |
|---|---:|---:|---|---:|---:|---:|
| C1: naive RAG: BM25 top-5 pages | 16 | 1 (6%) | 0% to 19% | 15 | 5.7 | $0.414 |
| C5: agent with tools and calculator | 16 | 5 (31%) | 12% to 56% | 5 | 39.7 | $1.544 |

Paired C5 minus C1: +25.0 percentage points (95% interval +0.0 to +50.0; n=16).

Answer models: claude-sonnet-5.
Judge models: claude-haiku-4-5-20251001.

Reference answers, questions, evidence excerpts and private traces are not redistributed. The JSON includes question IDs and scores so the paired result can be audited.

- A fixed stratified sample, not the full benchmark; intervals reflect sample uncertainty.
- Tables compare only completed pairs. A quota-limited prefix of the planned stratified sample is not necessarily stratified itself.
- Quote checks verify text exists on a page, not that it supports every inference.
- A different model judges answers; this is automated grading, not human validation.
- C1 and C5 differ in filtering, page access, calculation and citation enforcement; this comparison does not isolate agent reasoning alone.
- CLI cannot set temperature or max output tokens; its tools and customizations are disabled.
- Costs are API-equivalent estimates reported by CLI, not subscription charges.
- Latency sums recorded answer-model calls; cached replays retain original call latency.

Completed pairs by question type: domain-relevant: 8, novel-generated: 8.
