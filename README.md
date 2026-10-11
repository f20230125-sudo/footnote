# Footnote

A filings analyst that answers questions about public companies and **cites the page it got each figure from**. It is scored on [FinanceBench](https://github.com/patronus-ai/financebench): 150 questions about real 10-Ks, 10-Qs, 8-Ks and earnings releases, whose own README reports that GPT-4-Turbo with retrieval answered 81% of them wrongly or refused.

The point of the project is the measurement, not the demo: every part (retrieval, the company filter, the typed and checked answer, the agent) is added one at a time and scored against the same questions, with intervals, because 150 questions is a small sample.

**Live: https://footnote-ten.vercel.app** (search the filings in your browser, see the measurements)

> **Status (11 Oct 2026): retrieval is measured; no language model has been run yet.** Everything below the retrieval table is built and tested against scripted fakes only. The first real model run will be the first test of the prompts. This README will be updated with real numbers, including any that come out badly.

## The site

`web/` is a small Next.js site with three pages, and it needs no server beyond static files:

- **Search**: type a question, click one of five examples, or pick one of 31 FinanceBench questions about 7 filings (670 pages, published by the companies themselves). The browser ranks the pages and marks the question's words in them, leaving plain the words found on most of the searched pages (the company's name once the search is narrowed, "fiscal", the year) so the useful words stand out. For a benchmark question it also shows which page FinanceBench points to and where this search ranks it. Results scroll into view (on a phone they would otherwise be off screen), each card has a "Copy citation" button and a link to the filing, and the whole search lives in the address (`?q=...`), so a link reproduces it. A TypeScript port of the search runs in the browser, and a test holds it to the Python ranking, page for page, scores to five decimals; the highlighting is display only and does not touch the ranking.
- **Results**: the measurements below as three headline numbers and bars by question type, switchable between the top 1, 3, 5 and 10 results, a plain-words reading, a glossary (BM25, MRR, "ceiling"...), and every number in a table.
- **How it works**: a short summary, then each part of the system and how far it has been checked (measured, unit-tested, tested only against a stand-in model, or not run).

The site finds pages; it does not write answers, because no language model has been run yet. It ships the text of the 7 filings and the 31 questions, but not FinanceBench's reference answers or evidence text. Its data files are written by `python -m footnote.site_export`, so the page cannot drift from the evaluation. 38 end-to-end tests drive it in a real browser (searching, copying, reloading from a link, the results bars, accessibility scans in both themes, the security headers, a phone-sized screen), plus 30 unit tests.

## What is measured so far (no model, all 150 questions)

Does the page FinanceBench marks as the evidence appear in the top 10 results? Plain BM25 on the question text, over the 360 filings in the corpus (53,399 pages):

| setting | gold page in top 10 |
|---|---|
| the right filing is given to the search | 44% |
| search over all 360 filings | 13% |
| + company and fiscal-year filter | 31% |

Full tables, by question type: [results/retrieval_bm25_360_filings.txt](results/retrieval_bm25_360_filings.txt). Reproduce with `python -m footnote.evals retrieval --docs all`.

Things worth knowing about these numbers:

- **They are low for a real reason.** Searching with the gold evidence text itself finds its page at rank 1 for 97% of questions, so the page mapping and the index are right. Questions and filings use different words ("capital expenditure" against "Purchases of property, plant and equipment"), which is what embeddings and an agent that rewrites its query should recover.
- **FinanceBench counts pages from 0.** I measured it on all 183 evidence records (every one is exactly one page later in a PDF viewer) instead of assuming; a test guards it. Assuming 1-based would have put every score off by one page.
- **The filter** keeps the right filing for 148 of 150 questions and narrows to about 3 filings of 360. It recognised the company in 128 of 150 questions by name; five nicknames (AMEX, JnJ, JPM, MGM, Ulta) were added *after* seeing which questions failed, which brings it to 147 and makes the filtered figure a little optimistic for this benchmark. The two it loses: a forward-looking question that names 2023 but is answered by a Q4 2022 filing, and a Pfizer question that names 2019 and is answered by the 2021 filing.
- Filtered retrieval stays well below "right filing given", and the reason is not a missing year: 131 of the 150 questions name one. A year does not pin down one filing, because a company has a 10-K, 10-Qs, 8-Ks and earnings releases for the same year, so 90 of the 147 questions the filter recognises still have more than one candidate filing. Of the 20 questions the right filing alone gets right and the filter does not, 18 were crowded out by another filing of the same company. (An earlier draft of this README blamed questions with no year; I measured it and that was wrong.)

## How it works

```
question ─► company/year filter ─► BM25 ─► embedding rerank ─► typed answer ─► citation check
                                              (top 50)          (JSON, Pydantic)   (rules, no model)
                                                                      ▲
                          agent: search_filings / get_page / calculate (step budget 6)
```

- **Answers are typed.** `{answer, numbers_used, citations[{doc, page, quote}], confidence, refused}`; an answer with no citation is rejected unless it refuses.
- **Citations are checked by rules, not by a model.** A quote passes only if it is found on the cited page (ignoring whitespace, `$`, thousands commas and case). An answer that fails gets one retry that shows what failed, then becomes a refusal.
- **The calculator parses with `ast` and a whitelist** (numbers, `+ - * / // % **`, `abs round min max`). No `eval`, no names, no attribute access.
- **Free-tier model calls are budgeted.** One SQLite file holds a response cache (so a rerun makes no calls and a crashed run resumes) and daily usage counters (so a restart does not forget how much of today's quota is spent). Per-minute limits are waited out; a spent daily limit moves to the next model or stops the run to resume tomorrow. Groq's 8,000 tokens a minute caps any one call at about 6,500 tokens, which is why the agent rebuilds a compact prompt each turn instead of growing a chat history.
- **The same four tools are an MCP server** (`list_filings`, `search_filings`, `get_page`, `calculate`), so Claude Desktop or Claude Code can query the filings: `claude mcp add footnote -- <repo>/.venv/Scripts/python.exe -m footnote.mcp_server`. It is the same code the evaluated agent calls.
- **Runs export as [Hindsight](https://github.com/f20230125-sudo/hindsight) traces** (`footnote.trace`). The export is checked against the schema's constraints in tests; Hindsight does not read the new source yet.

## Planned comparison

| id | what it adds |
|---|---|
| C0 | closed book, no documents |
| C1 | naive RAG: BM25 top 5 pages |
| C2 | + embedding rerank of BM25's top 50, fused with reciprocal rank |
| C3 | + company/year filter |
| C4 | + citation check enforced |
| C5 | agent with tools and calculator |

Each is run in two settings (right filing given, and the full corpus), graded by a model judge from a different model than the answerer, and cross-checked by a rule that compares a single reference number. Free-tier limits decide the sample: retrieval metrics run on all 150 questions; answer metrics start on a stratified subset of 50 and extend to all 150 as quota allows. Every table will state its n and carry 95% bootstrap intervals, with paired differences between steps. Dense retrieval re-ranks BM25's top 50 pages rather than searching all 53,399, because embedding every page would use far more of the free embedding quota than this question set needs.

## Run it

```
python -m venv .venv && .venv/Scripts/python -m pip install -e "pipeline[dev]"
git clone --depth 1 https://github.com/patronus-ai/financebench data/financebench
cd pipeline && ../.venv/Scripts/python -m pytest -q          # 128 tests, no data or keys needed
../.venv/Scripts/python -m footnote.evals retrieval --docs all   # no key; reads all the PDFs the first time, which takes a while
```

The site: `cd web && npm install && npm run dev` (port 3050); `npm test` includes the parity test, `npm run e2e` the browser tests. The same browser tests run against the live site with `BASE_URL=https://footnote-ten.vercel.app npm run e2e` (38 passed on 12 Oct 2026).

Model runs need `GROQ_API_KEY` and/or `GEMINI_API_KEY` in a git-ignored `.env` (see `.env.example`); neither free tier asks for a card, and nothing in this project can bill anyone.

## Licences and limits

- Code: MIT. It depends on PyMuPDF, which is AGPL-3.0.
- FinanceBench states no licence on its repository, so it is used for evaluation and **not redistributed here**: clone it yourself into `data/financebench`.
- Gemini's free tier may use prompts to improve Google's products; the documents here are public filings.
- Not covered: fine-tuning, local models, a hosted vector database, multi-agent setups.
