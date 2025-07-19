"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { Results, Table } from "@/lib/data";

type Setting = "full" | "filtered" | "oracle";

// Fixed order, and each keeps its colour whatever else is shown: the colour
// follows the way of searching, never its rank. The words always say it too.
const SERIES: Array<{ key: Setting; label: string; short: string; note: string; color: string }> = [
  { key: "full", label: "Search all 360 filings", short: "All filings", note: "Keywords only, no help.", color: "var(--series-1)" },
  { key: "filtered", label: "+ company and year filter", short: "With filter", note: "First pick the filings that fit the company and year in the question.", color: "var(--series-2)" },
  { key: "oracle", label: "Right filing given (a ceiling)", short: "Right filing", note: "Told which filing to look in: the best this search can do.", color: "var(--series-3)" },
];

const KS = ["1", "3", "5", "10"] as const;

const pct = (v: number) => `${Math.round(v * 100)}%`;

function groupName(key: string): string {
  return key === "all" ? "All questions" : key;
}

const TERMS: Array<{ term: string; means: string }> = [
  {
    term: "FinanceBench",
    means:
      "A public set of 150 questions about real company filings. For each, experts marked the page that holds the evidence. That marked page is what this site tries to find.",
  },
  {
    term: "Filing",
    means:
      "A document a company publishes about its finances: a 10-K (annual report), a 10-Q (quarterly report), an 8-K (a report of one event) or an earnings release.",
  },
  {
    term: "Top 10",
    means: "Whether the marked page is among the first 10 pages the search returns. “Top 1” is the strictest: the very first result.",
  },
  {
    term: "Keyword search (BM25)",
    means: "Ranks pages by how well their words match the question's words, giving rare words more weight. It does not understand meaning.",
  },
  {
    term: "Company and year filter",
    means: "A rule that reads the company and year in the question and searches only the filings that fit, so a Best Buy question is not answered from an AMD page.",
  },
  {
    term: "Ceiling",
    means: "The score when the search is told the right filing. No setting without that help can beat it, so it shows how much of the difficulty is the search itself.",
  },
  {
    term: "MRR",
    means: "Mean reciprocal rank: 1 divided by the rank of the first marked page (1 for first, ½ for second, ⅓ for third), averaged over the questions. Higher is better, at most 1.",
  },
];

export function ResultsView({ results }: { results: Results }) {
  const [k, setK] = useState<(typeof KS)[number]>("10");
  const kId = useId();
  const groups: Array<{ key: string; n: number; tables: Record<Setting, Table> }> = [
    { key: "all", n: results.questions, tables: results.overall },
    ...Object.entries(results.byType).map(([key, tables]) => ({ key, n: tables.oracle.n, tables })),
  ];

  const all = results.overall;
  const full = all.full.hit[k];
  const ceiling = all.oracle.hit[k];
  const filtered = all.filtered.hit[k];
  const closed = ceiling > full ? Math.round(((filtered - full) / (ceiling - full)) * 100) : 0;
  const f = results.filter;

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What has been measured</h1>
        <p className="max-w-[70ch] text-[15px] leading-relaxed text-muted">
          FinanceBench has {results.questions} questions about real filings, and for each it marks the page that holds the evidence. Here, a plain keyword
          search (BM25) reads the question and ranks the pages of {results.corpus.filings} filings ({results.corpus.pages.toLocaleString("en-US")} pages). The
          score is how often a marked page is among the first few results. No language model is involved.{" "}
          <a href="#words" className="font-medium text-accent underline underline-offset-2">
            New to these terms? See what they mean.
          </a>
        </p>
      </section>

      <section aria-labelledby="chart-heading" className="panel space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="chart-heading" className="text-lg font-semibold tracking-tight">
              Is the evidence page in the top {k} results?
            </h2>
            <p className="mt-1 text-[13px] text-muted">Share of questions where it is. Choose how many results count:</p>
          </div>
          <fieldset className="flex items-center gap-1 rounded-xl border border-line bg-bg p-1">
            <legend className="sr-only">How many results count</legend>
            {KS.map((value) => (
              <label key={value} className="cursor-pointer">
                <input type="radio" name={kId} value={value} checked={k === value} onChange={() => setK(value)} className="peer sr-only" />
                <span className="inline-flex h-8 min-w-12 items-center justify-center rounded-lg px-3 text-[13px] font-medium text-muted transition-colors peer-checked:bg-surface peer-checked:text-fg peer-checked:shadow-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                  top {value}
                </span>
              </label>
            ))}
          </fieldset>
        </div>

        {/* The headline, in three numbers; they double as the key to the colours below. */}
        <ul aria-label={`All ${results.questions} questions`} className="grid gap-3 sm:grid-cols-3">
          {SERIES.map((s) => (
            <li key={s.key} className="rounded-xl border border-line bg-bg p-3.5">
              <p className="flex items-center gap-2 text-[12.5px] font-medium">
                <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: s.color }} />
                {s.label}
              </p>
              <p className="tabular mt-1 text-3xl font-semibold tracking-tight">{pct(all[s.key].hit[k])}</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{s.note}</p>
            </li>
          ))}
        </ul>

        <p className="max-w-[72ch] text-[14px] leading-relaxed">
          <strong className="font-semibold">In plain words:</strong> given only the question, keyword search puts a page FinanceBench marks into the top {k} for{" "}
          {pct(full)} of questions. Picking the right company and year first lifts that to {pct(filtered)}. Even told the exact filing, it reaches only{" "}
          {pct(ceiling)}, so a large part of the weakness is vocabulary: questions and filings use different words (more below).
        </p>

        <div>
          <h3 className="mb-3 text-[13.5px] font-semibold">By type of question</h3>
          <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.key} role="group" aria-labelledby={`${kId}-${g.key}`}>
                <h4 id={`${kId}-${g.key}`} className="text-[13px] font-semibold">
                  {groupName(g.key)} <span className="font-normal text-faint">· {g.n} questions</span>
                </h4>
                <ul className="mt-2 space-y-1.5">
                  {SERIES.map((s) => {
                    const v = g.tables[s.key].hit[k];
                    return (
                      <li key={s.key} className="grid grid-cols-[6.25rem_1fr_2.75rem] items-center gap-2 text-[12.5px] sm:grid-cols-[6.75rem_1fr_2.75rem]">
                        <span className="text-muted">{s.short}</span>
                        <span aria-hidden="true" className="h-3.5 overflow-hidden rounded-full bg-surface-2">
                          <span
                            className="block h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300"
                            style={{ width: `${Math.max(v * 100, v > 0 ? 1.5 : 0)}%`, background: s.color }}
                          />
                        </span>
                        <span className="tabular text-right font-semibold">{pct(v)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="reading-heading" className="space-y-3">
        <h2 id="reading-heading" className="text-lg font-semibold tracking-tight">
          What to take from it
        </h2>
        <ul className="max-w-[72ch] list-disc space-y-2 pl-5 text-[14.5px] leading-relaxed text-muted marker:text-faint">
          <li>
            <strong className="font-semibold text-fg">Plain search is weak.</strong> Over all filings it puts a marked page in the top {k} for {pct(full)} of
            questions. Even told the right filing, it manages {pct(ceiling)}. Questions and filings use different words (a question says &ldquo;capital
            expenditure&rdquo;, the filing says &ldquo;Purchases of property, plant and equipment&rdquo;), which is what embeddings and a query-rewriting
            agent are for. They are built but not yet run.
          </li>
          <li>
            <strong className="font-semibold text-fg">The company and year filter helps a lot:</strong> {pct(filtered)}, which closes {closed}% of the gap to
            the ceiling. It keeps the right filing for {f.keptRightFiling} of {results.questions} questions and narrows to about{" "}
            {f.candidatesWhenRecognised.toFixed(0)} filings of {results.corpus.filings}.
          </li>
          <li>
            <strong className="font-semibold text-fg">It stops short of the ceiling, and not for lack of a year.</strong> {f.namingAYear} of the{" "}
            {results.questions} questions name a year. A year does not pin down one filing: a company has a 10-K, 10-Qs, 8-Ks and earnings releases for the same
            year, so {f.moreThanOneCandidate} of the {f.recognised} recognised questions still have more than one candidate. Of the {f.rightFilingAloneWins}{" "}
            questions that the right filing alone gets right and the filter does not, {f.ofThoseCrowdedOut} were crowded out by another filing of the same
            company.
          </li>
          <li>
            <strong className="font-semibold text-fg">The filter&rsquo;s recognition is partly tuned on this benchmark.</strong> By company name alone it
            recognises {f.recognisedWithoutNicknames} of {results.questions} questions. I then added five nicknames ({Object.values(f.nicknames).flat().join(", ").toUpperCase()})
            after seeing which questions it missed, which brings it to {f.recognised}. The honest figure for questions it has not seen is the first.
          </li>
          <li>
            <strong className="font-semibold text-fg">The page numbers are checked.</strong> Searching with the evidence text itself finds its own page at rank
            1 for 97% of questions, so the low numbers above are not an indexing mistake. FinanceBench counts pages from 0, which the evaluation measured
            instead of assuming.
          </li>
        </ul>
      </section>

      <section id="words" aria-labelledby="words-heading" className="scroll-mt-20 space-y-3">
        <h2 id="words-heading" className="text-lg font-semibold tracking-tight">
          What the words mean
        </h2>
        <dl className="grid max-w-[78ch] gap-x-6 gap-y-3 text-[14px] leading-relaxed sm:grid-cols-[11rem_1fr]">
          {TERMS.map((t) => (
            <div key={t.term} className="contents">
              <dt className="font-semibold">{t.term}</dt>
              <dd className="mb-2 text-muted sm:mb-0">{t.means}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[13px] text-muted">
          More on how each part works, and which parts have not been run, is on{" "}
          <Link href="/how" className="font-medium text-accent underline underline-offset-2">
            How it works
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="table-heading" className="space-y-3">
        <h2 id="table-heading" className="text-lg font-semibold tracking-tight">
          Every number
        </h2>
        <p className="text-[12.5px] text-faint sm:hidden">The table is wider than the screen: swipe it sideways to see every column.</p>
        <div className="panel overflow-x-auto" tabIndex={0} role="region" aria-label="Table of every number; scrolls sideways">
          <table className="tabular w-full min-w-[640px] border-collapse text-left text-[13px]">
            <caption className="sr-only">Share of questions whose evidence page is among the top results, and mean reciprocal rank, by question group and way of searching.</caption>
            <thead>
              <tr className="border-b border-line text-[12px] text-faint">
                <th scope="col" className="px-4 py-3 font-medium">
                  Questions
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Search
                </th>
                {KS.map((value) => (
                  <th key={value} scope="col" className="px-3 py-3 text-right font-medium">
                    top {value}
                  </th>
                ))}
                <th scope="col" className="px-3 py-3 text-right font-medium">
                  <abbr title="Mean reciprocal rank: the average of 1 divided by the rank of the first marked page">MRR</abbr>
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.flatMap((g) =>
                SERIES.map((s, si) => (
                  <tr key={`${g.key}-${s.key}`} className={`border-b border-line last:border-0 ${si === 0 ? "border-t-2 border-t-line-strong" : ""}`}>
                    {si === 0 ? (
                      <th scope="rowgroup" rowSpan={SERIES.length} className="px-4 py-2 align-top font-semibold">
                        {groupName(g.key)}
                        <span className="block text-[11.5px] font-normal text-faint">{g.n} questions</span>
                      </th>
                    ) : null}
                    <td className="px-4 py-2">
                      <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: s.color }} />
                      {s.short}
                    </td>
                    {KS.map((value) => (
                      <td key={value} className={`px-3 py-2 text-right ${value === k ? "font-semibold" : ""}`}>
                        {pct(g.tables[s.key].hit[value])}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">{g.tables[s.key].mrr.toFixed(3)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[12.5px] text-faint">Question-type names are FinanceBench&rsquo;s own. Full text of the run: results/ in the repository.</p>
      </section>

      <section aria-labelledby="gaps-heading" className="panel space-y-2 border-l-4 border-l-warn p-4 sm:p-5">
        <h2 id="gaps-heading" className="text-lg font-semibold tracking-tight">
          Not measured yet
        </h2>
        <p className="max-w-[72ch] text-[14px] leading-relaxed text-muted">
          Nothing on this page involves a language model. The answering, the citation checks, the agent and the judge are written and tested against scripted
          stand-ins, and have not been run against a real model, so there is no accuracy figure yet: not for the closed-book baseline, not for retrieval-augmented
          answers, not for the agent. Those will be added here with their sample sizes and intervals, including any that come out badly.
        </p>
      </section>
    </div>
  );
}
