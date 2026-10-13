"use client";

import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import type { Corpus } from "@/lib/corpus";
import type { Filing } from "@/lib/data";
import { bestWindow, pieces } from "@/lib/highlight";
import { citation, filingLabel } from "@/lib/labels";
import { CopyButton } from "./CopyButton";

export type LeafProps = {
  /** A result is an `article`; the sample on the first screen is a `figure`, so nothing counts it as a result. */
  as?: "article" | "figure";
  ariaLabel?: string;
  ariaLabelledBy?: string;
  rank: number;
  score: number;
  page: number;
  /** "Best Buy, 10-K 2023" */
  label: string;
  /** The line to paste into a note. */
  citation: string;
  source?: string;
  /** The page's text, exactly as extracted. */
  full: string;
  /** The question's words to mark. */
  terms: string[];
  isGold?: boolean;
  /** Which stretch of the page to show before it is opened in full. Default: where the question's words are densest. */
  view?: { start: number; end: number };
};

/**
 * A leaf: one page of a filing as it came out of the PDF, with the page number
 * loudest, the question's words marked, and its citation set as the footnote.
 */
export function Leaf({ as: Root = "article", ariaLabel, ariaLabelledBy, rank, score, page, label, citation: cite, source, full, terms, isGold = false, view }: LeafProps) {
  const [open, setOpen] = useState(false);
  const termSet = useMemo(() => new Set(terms), [terms]);
  const win = useMemo(() => view ?? bestWindow(full, termSet), [view, full, termSet]);
  const text = open ? full : full.slice(win.start, win.end);
  const parts = useMemo(() => pieces(text, termSet), [text, termSet]);
  const shorter = full.length > win.end - win.start;

  return (
    <Root className="leaf" data-gold={isGold ? "" : undefined} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}>
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="folio">p.&nbsp;{page}</span>
        <span className="text-[15px] font-bold">{label}</span>
        {isGold && <span className="text-[13px] font-semibold">FinanceBench&rsquo;s evidence page</span>}
        <span className="tabular ml-auto flex gap-3 pr-1 text-[13px] text-ink-3">
          <span>#{rank}</span>
          <span title="Search score: higher means the page's words match the question more closely">score {score.toFixed(1)}</span>
        </span>
      </header>
      {/* Opened in full, a long page scrolls inside its own recess instead of pushing everything else far down. */}
      <div
        className={`mt-4 ${open ? "page-text page-text-open" : "page-text"}`}
        {...(open ? { tabIndex: 0, role: "region", "aria-label": `Full text of page ${page}` } : {})}
      >
        {!open && win.start > 0 ? "…\n" : ""}
        {parts.map((p, i) => (p.marked ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
        {!open && win.end < full.length ? "\n…" : ""}
      </div>
      {shorter && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="tlink mt-2 inline-flex min-h-9 items-center text-[13px] font-semibold hover:bg-leaf-2 sm:min-h-8">
          {open ? "Show less" : "Show the whole page"}
        </button>
      )}
      <div className="footnote-rule mt-4" />
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-0.5">
        <span className="text-[14px] font-bold">
          {label}, page {page}
        </span>
        <CopyButton text={cite} label="Copy citation" />
        {source && (
          <a href={source} target="_blank" rel="noopener noreferrer" className="tlink inline-flex min-h-9 items-center gap-1.5 text-[13px] font-semibold hover:bg-leaf-2 sm:min-h-8">
            Open the filing
            <ExternalLink size={13} aria-hidden="true" />
            <span className="sr-only">(opens the company&rsquo;s site)</span>
          </a>
        )}
      </div>
    </Root>
  );
}

/** One result: a page of a filing, ranked by the search. */
export function PageCard({
  hit,
  rank,
  corpus,
  filing,
  terms,
  isGold,
}: {
  hit: { doc: string; page: number; score: number };
  rank: number;
  corpus: Corpus;
  filing: Filing | undefined;
  terms: Set<string>;
  isGold: boolean;
}) {
  const termList = useMemo(() => [...terms], [terms]);
  return (
    <Leaf
      rank={rank}
      score={hit.score}
      page={hit.page}
      label={filing ? filingLabel(filing) : hit.doc}
      citation={citation(filing, hit.doc, hit.page)}
      source={filing?.source}
      full={corpus.text(hit.doc, hit.page) ?? ""}
      terms={termList}
      isGold={isGold}
      ariaLabel={`Rank ${rank}: ${hit.doc}, page ${hit.page}`}
    />
  );
}
