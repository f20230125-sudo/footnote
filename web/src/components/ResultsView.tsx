"use client";

import { useId, useState } from "react";
import type { Results, Table } from "@/lib/data";

type Setting = "full" | "filtered" | "oracle";

// Fixed order, and each keeps its colour whatever else is shown: the colour
// follows the way of searching, never its rank.
const SERIES: Array<{ key: Setting; label: string; short: string; color: string }> = [
  { key: "full", label: "Search all 360 filings", short: "All filings", color: "var(--series-1)" },
  { key: "filtered", label: "+ company and year filter", short: "With filter", color: "var(--series-2)" },
  { key: "oracle", label: "Right filing given (a ceiling)", short: "Right filing", color: "var(--series-3)" },
];

const KS = ["1", "3", "5", "10"] as const;

const pct = (v: number) => `${Math.round(v * 100)}%`;

// Chart geometry, in SVG units; the SVG scales to its container.
const W = 760;
const H = 300;
const LEFT = 44;
const RIGHT = 12;
const TOP = 22;
const BOTTOM = 56;
const PLOT_H = H - TOP - BOTTOM;
const BAR = 40;
const GAP = 2; // a 2px surface gap between neighbouring fills
const R = 4;

/** A bar that is square at the baseline and rounded at the data end. */
function barPath(x: number, y: number, w: number, base: number): string {
  const h = base - y;
  const r = Math.min(R, h, w / 2);
  if (r <= 0) return `M${x},${base - 1}H${x + w}V${base}H${x}Z`;
  return `M${x},${base}V${y + r}a${r},${r} 0 0 1 ${r},${-r}H${x + w - r}a${r},${r} 0 0 1 ${r},${r}V${base}Z`;
}

function groupName(key: string): string {
  return key === "all" ? "All questions" : key;
}

export function ResultsView({ results }: { results: Results }) {
  const [k, setK] = useState<(typeof KS)[number]>("10");
  const kId = useId();
  const groups: Array<{ key: string; n: number; tables: Record<Setting, Table> }> = [
    { key: "all", n: results.questions, tables: results.overall },
    ...Object.entries(results.byType).map(([key, tables]) => ({ key, n: tables.oracle.n, tables })),
  ];
  const slot = (W - LEFT - RIGHT) / groups.length;
  const cluster = SERIES.length * BAR + (SERIES.length - 1) * GAP;
  const base = TOP + PLOT_H;
  const y = (v: number) => base - v * PLOT_H;

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
          score is how often a marked page is among the first few results. No language model is involved.
        </p>
      </section>

      <section aria-labelledby="chart-heading" className="panel space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="chart-heading" className="text-lg font-semibold tracking-tight">
              Is the evidence page in the top {k} results?
            </h2>
            <p className="mt-1 text-[13px] text-muted">Share of questions, by FinanceBench&rsquo;s question types.</p>
          </div>
          <fieldset className="flex items-center gap-1 rounded-xl border border-line bg-bg p-1">
            <legend className="sr-only">How many results count</legend>
            {KS.map((value) => (
              <label key={value} className="cursor-pointer">
                <input
                  type="radio"
                  name={kId}
                  value={value}
                  checked={k === value}
                  onChange={() => setK(value)}
                  className="peer sr-only"
                />
                <span className="inline-flex h-8 min-w-12 items-center justify-center rounded-lg px-3 text-[13px] font-medium text-muted transition-colors peer-checked:bg-surface peer-checked:text-fg peer-checked:shadow-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                  top {value}
                </span>
              </label>
            ))}
          </fieldset>
        </div>

        <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-[13px]">
              <span aria-hidden="true" className="h-3 w-3 rounded-[3px]" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>

        {/* On a phone the chart keeps a readable size and scrolls sideways, instead of shrinking its labels to nothing. */}
        <div className="-mx-1 overflow-x-auto px-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Bar chart: share of questions whose evidence page is in the top ${k} results, for three ways of searching, over ${groups.length} groups of questions. The table below has every number.`}
          className="h-auto w-full min-w-[620px]"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={LEFT} x2={W - RIGHT} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={t === 0 ? 1.5 : 1} />
              <text x={LEFT - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--faint)">
                {pct(t)}
              </text>
            </g>
          ))}
          {groups.map((g, gi) => {
            const x0 = LEFT + gi * slot + (slot - cluster) / 2;
            return (
              <g key={g.key}>
                {SERIES.map((s, si) => {
                  const v = g.tables[s.key].hit[k];
                  const x = x0 + si * (BAR + GAP);
                  return (
                    <g key={s.key}>
                      <path d={barPath(x, y(v), BAR, base)} fill={s.color}>
                        <title>{`${groupName(g.key)}, ${s.label}: ${pct(v)} of ${g.n} questions`}</title>
                      </path>
                      <text x={x + BAR / 2} y={y(v) - 6} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--fg)">
                        {pct(v)}
                      </text>
                    </g>
                  );
                })}
                <text x={LEFT + gi * slot + slot / 2} y={base + 20} textAnchor="middle" fontSize="12.5" fontWeight="500" fill="var(--fg)">
                  {groupName(g.key)}
                </text>
                <text x={LEFT + gi * slot + slot / 2} y={base + 36} textAnchor="middle" fontSize="11" fill="var(--faint)">
                  {g.n} questions
                </text>
              </g>
            );
          })}
        </svg>
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

      <section aria-labelledby="table-heading" className="space-y-3">
        <h2 id="table-heading" className="text-lg font-semibold tracking-tight">
          Every number
        </h2>
        <div className="panel overflow-x-auto">
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
