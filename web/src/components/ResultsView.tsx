"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { Results, Table } from "@/lib/data";

type Setting = "full" | "filtered" | "oracle";

// Fixed order. The three ways of searching are three steps of one thing (how
// much help the search gets), so they are drawn as three steps of one ink:
// solid ink, mid ink, and an outline for the ceiling. The words always say it too.
const SERIES: Array<{ key: Setting; label: (filings: number) => string; short: string; note: string }> = [
  { key: "full", label: (n) => `Search all ${n} filings`, short: "All filings", note: "Keywords only, no help." },
  { key: "filtered", label: () => "+ company and year filter", short: "With filter", note: "First pick the filings that fit the company and year in the question." },
  { key: "oracle", label: () => "Right filing given (a ceiling)", short: "Right filing", note: "Told which filing to look in: the best this search can do." },
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
  // The tallest column at any depth, so the plot is only as tall as it ever needs to be and does not jump when the depth changes.
  const tallest = Math.max(...KS.flatMap((depth) => SERIES.map((s) => all[s.key].hit[depth])));

  return (
    <div className="notes-layout">
      <div className="nl-intro">
        <h1 className="h1">What has been measured</h1>
        <p className="dek mt-4 max-w-[72ch]">
          FinanceBench has {results.questions} questions about real filings, and for each it marks the page that holds the evidence. Here, a plain keyword
          search (BM25) reads the question and ranks the pages of {results.corpus.filings} filings ({results.corpus.pages.toLocaleString("en-US")} pages). The
          score is how often a marked page is among the first few results. No language model is involved.
        </p>
      </div>
      <div className="nl-limits note">
        <p>
          <strong>Limits.</strong> Only retrieval has been measured: nothing on this page involves a language model, and there is no accuracy figure for answers yet.{" "}
          <a href="#words" className="tlink font-semibold text-ink">
            New to these terms? See what they mean.
          </a>
        </p>
      </div>

      <div className="nl-body space-y-12">
        <section aria-labelledby="chart-heading" className="space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div className="min-w-0">
              <h2 id="chart-heading" className="h2">
                Is the evidence page in the top {k} results?
              </h2>
              <p className="mt-2 text-[14px] text-ink-2">Share of questions where it is. Choose how many results count:</p>
            </div>
            <fieldset className="flex items-center gap-3 sm:gap-5">
              <legend className="sr-only">How many results count</legend>
              {KS.map((value) => (
                <label key={value} className="cursor-pointer">
                  <input type="radio" name={kId} value={value} checked={k === value} onChange={() => setK(value)} className="peer sr-only" />
                  <span className="inline-flex min-h-11 min-w-14 items-center justify-center border-b-[3px] border-transparent px-1 text-[15px] font-medium text-ink-2 transition-colors duration-150 ease-out hover:text-ink peer-checked:border-ink peer-checked:font-bold peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                    top {value}
                  </span>
                </label>
              ))}
            </fieldset>
          </div>

          {/* The headline: three columns of true height on one rule, 0 to 100%. */}
          <ul aria-label={`All ${results.questions} questions`} className="res-cols" style={{ "--res-max": tallest } as React.CSSProperties}>
            {SERIES.map((s) => (
              <li key={s.key} className="res-col min-w-0">
                <div className="res-plot">
                  <p className="res-fig">{pct(all[s.key].hit[k])}</p>
                  <span aria-hidden="true" className="res-bar" data-k={s.key} style={{ "--v": all[s.key].hit[k] } as React.CSSProperties} />
                </div>
                <p className="text-[14px] font-semibold leading-snug">{s.label(results.corpus.filings)}</p>
                <p className="mt-1 text-[13.5px] leading-snug text-ink-2">{s.note}</p>
              </li>
            ))}
          </ul>

          <p className="max-w-[72ch] text-[17px] leading-[1.5]">
            <strong className="run-in">In plain words.</strong> Given only the question, keyword search puts a page FinanceBench marks into the top {k} for{" "}
            {pct(full)} of questions. Picking the right company and year first lifts that to {pct(filtered)}. Even told the exact filing, it reaches only{" "}
            {pct(ceiling)}, so a large part of the weakness is vocabulary: questions and filings use different words (more below).
          </p>

          <div>
            <h3 className="h3 mb-4">By type of question</h3>
            <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
              {groups.map((g) => (
                <div key={g.key} role="group" aria-labelledby={`${kId}-${g.key}`} className="min-w-0">
                  <h4 id={`${kId}-${g.key}`} className="text-[14px] font-bold">
                    {groupName(g.key)} <span className="font-normal text-ink-3">{g.n} questions</span>
                  </h4>
                  <div className="mini-row mt-2" aria-hidden="true">
                    {SERIES.map((s) => (
                      <div key={s.key} className="mini-cell">
                        <span className="tabular mb-1 text-[16px] font-bold leading-none">{pct(g.tables[s.key].hit[k])}</span>
                        <span className="mini-bar res-bar" data-k={s.key} style={{ "--v": g.tables[s.key].hit[k] } as React.CSSProperties} />
                      </div>
                    ))}
                  </div>
                  <ul className="mt-2 grid grid-cols-3 gap-x-4 text-[13px] leading-snug text-ink-2">
                    {SERIES.map((s) => (
                      <li key={s.key} className="min-w-0">
                        <span className="sr-only">{pct(g.tables[s.key].hit[k])}, </span>
                        {s.short}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="reading-heading" className="space-y-4">
          <h2 id="reading-heading" className="h2">
            What to take from it
          </h2>
          <div className="prose-text space-y-4 text-ink-2">
            <p>
              <strong className="run-in">Plain search is weak.</strong> Over all filings it puts a marked page in the top {k} for {pct(full)} of questions. Even
              told the right filing, it manages {pct(ceiling)}. Questions and filings use different words (a question says &ldquo;capital expenditure&rdquo;, the
              filing says &ldquo;Purchases of property, plant and equipment&rdquo;), which is what embeddings and a query-rewriting agent are for. They are built
              but not yet run.
            </p>
            <p>
              <strong className="run-in">The company and year filter helps a lot:</strong> {pct(filtered)}, which closes {closed}% of the gap to the ceiling. It
              keeps the right filing for {f.keptRightFiling} of {results.questions} questions and narrows to about {f.candidatesWhenRecognised.toFixed(0)} filings
              of {results.corpus.filings}.
            </p>
            <p>
              <strong className="run-in">It stops short of the ceiling, and not for lack of a year.</strong> {f.namingAYear} of the {results.questions} questions
              name a year. A year does not pin down one filing: a company has a 10-K, 10-Qs, 8-Ks and earnings releases for the same year, so{" "}
              {f.moreThanOneCandidate} of the {f.recognised} recognised questions still have more than one candidate. Of the {f.rightFilingAloneWins} questions
              that the right filing alone gets right and the filter does not, {f.ofThoseCrowdedOut} were crowded out by another filing of the same company.
            </p>
            <p>
              <strong className="run-in">The filter&rsquo;s recognition is partly tuned on this benchmark.</strong> By company name alone it recognises{" "}
              {f.recognisedWithoutNicknames} of {results.questions} questions. I then added five nicknames (
              {Object.values(f.nicknames).flat().join(", ").toUpperCase()}) after seeing which questions it missed, which brings it to {f.recognised}. The honest
              figure for questions it has not seen is the first.
            </p>
            <p>
              <strong className="run-in">The page numbers are checked.</strong> Searching with the evidence text itself finds its own page at rank 1 for 97% of
              questions, so the low numbers above are not an indexing mistake. FinanceBench counts pages from 0, which the evaluation measured instead of
              assuming.
            </p>
          </div>
        </section>

        <section id="words" aria-labelledby="words-heading" className="scroll-mt-20 space-y-4">
          <h2 id="words-heading" className="h2">
            What the words mean
          </h2>
          <dl className="max-w-[78ch] text-[15px] leading-relaxed">
            {TERMS.map((t) => (
              <div key={t.term} className="grid gap-x-6 border-t border-rule py-3 sm:grid-cols-[11rem_1fr]">
                <dt className="font-bold">{t.term}</dt>
                <dd className="text-ink-2">{t.means}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[14px] text-ink-2">
            More on how each part works, and which parts have not been run, is on{" "}
            <Link href="/how" className="tlink inline-block py-1 font-semibold text-ink">
              How it works
            </Link>
            .
          </p>
        </section>

        <section aria-labelledby="table-heading" className="space-y-3">
          <h2 id="table-heading" className="h2">
            Every number
          </h2>
          <p className="text-[13px] text-ink-3 sm:hidden">The table is wider than the screen: swipe it sideways to see every column.</p>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Table of every number; scrolls sideways">
            <table className="tabular w-full min-w-[640px] border-collapse text-left text-[14px]">
              <caption className="sr-only">Share of questions whose evidence page is among the top results, and mean reciprocal rank, by question group and way of searching.</caption>
              <thead>
                <tr className="border-b-2 border-ink text-[13px]">
                  <th scope="col" className="py-3 pr-4 font-bold">
                    Questions
                  </th>
                  <th scope="col" className="py-3 pr-4 font-bold">
                    Search
                  </th>
                  {KS.map((value) => (
                    <th key={value} scope="col" className={`px-3 py-3 text-right ${value === k ? "font-extrabold" : "font-bold"}`}>
                      top {value}
                    </th>
                  ))}
                  <th scope="col" className="py-3 pl-3 text-right font-bold">
                    <abbr title="Mean reciprocal rank: the average of 1 divided by the rank of the first marked page">MRR</abbr>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.flatMap((g) =>
                  SERIES.map((s, si) => (
                    <tr key={`${g.key}-${s.key}`} className={`border-b border-rule ${si === 0 ? "border-t border-t-edge" : ""}`}>
                      {si === 0 ? (
                        <th scope="rowgroup" rowSpan={SERIES.length} className="py-2 pr-4 align-top font-bold">
                          {groupName(g.key)}
                          <span className="block text-[12.5px] font-normal text-ink-3">{g.n} questions</span>
                        </th>
                      ) : null}
                      <td className="py-2 pr-4">
                        <span aria-hidden="true" className="res-key" data-k={s.key} />
                        {s.short}
                      </td>
                      {KS.map((value) => (
                        <td key={value} className={`px-3 py-2 text-right ${value === k ? "font-bold" : ""}`}>
                          {pct(g.tables[s.key].hit[value])}
                        </td>
                      ))}
                      <td className="py-2 pl-3 text-right">{g.tables[s.key].mrr.toFixed(3)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[13px] text-ink-3">Question-type names are FinanceBench&rsquo;s own. Full text of the run: results/ in the repository.</p>
        </section>

        <section aria-labelledby="gaps-heading" className="space-y-3">
          <div className="footnote-rule" />
          <h2 id="gaps-heading" className="h2">
            Not measured yet
          </h2>
          <p className="prose-text text-ink-2">
            Nothing on this page involves a language model. The answering, the citation checks, the agent and the judge are written and tested against scripted
            stand-ins, and have not been run against a real model, so there is no accuracy figure yet: not for the closed-book baseline, not for
            retrieval-augmented answers, not for the agent. Those will be added here with their sample sizes and intervals, including any that come out badly.
          </p>
        </section>
      </div>
    </div>
  );
}
