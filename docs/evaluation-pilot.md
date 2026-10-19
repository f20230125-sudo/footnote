# What the real-model pilot established

The planned run fixes 50 questions, balanced across FinanceBench's three question types, before any inference. Claude's weekly subscription limit stopped it after **16 completed pairs** and one additional baseline answer. The results table compares only the completed pairs; the extra baseline answer remains cached for resuming.

The completed prefix contains eight domain-relevant and eight novel-generated questions, with no metrics-generated questions yet. It is not representative of the planned sample or the full benchmark.

| System | Correct | Refused | Incorrect |
|---|---:|---:|---:|
| Basic BM25 retrieval, C1 | 1/16 | 15/16 | 0/16 |
| Bounded agent, C5 | 5/16 | 5/16 | 6/16 |

The paired difference is +25 percentage points, but its 95% bootstrap interval runs from 0 to +50 points. This pilot does not establish a reliable improvement. Answering used Claude Sonnet 5; grading used Claude Haiku 4.5. These are automated judgements, not human-verified correctness labels.

**A useful failure finding:** all eleven non-refused agent answers passed the quote-presence check, but six were judged incorrect. Checking that a quote exists does not establish that the answer uses the correct period, includes every requested item or draws a valid conclusion. The public artifact exposes accuracy and quote checks separately.

C1 and C5 differ in filtering, page access, calculation and enforced citation checks, so this comparison cannot attribute an improvement to agent reasoning alone. Closed-book and embedding-reranked configurations remain planned.

## Reproduce or resume

Follow the PowerShell command in the main README. The private manifest, answer files and model-call cache are in `data/runs/live-v1` and `data/cache`. Completed questions are skipped, including the extra baseline response. Model configuration, corpus, question IDs and a fingerprint of inference semantics must match; Git commits that only update documentation do not prevent resuming.

Public outputs are `results/live-evaluation.json`, `results/live-evaluation.md` and the results page. They contain scores and IDs, not benchmark questions, reference answers or filing excerpts. Source provenance records the base commit and that this pilot ran with the feature-branch changes. A separate API-backed run must use a new output directory and remain a distinct cohort.

The blocked continuation is explicit: 34 paired questions still need completion when inference becomes available. The current code and report do not mark the 50-question evaluation complete.
