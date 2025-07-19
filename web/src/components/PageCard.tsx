"use client";

import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import type { Corpus } from "@/lib/corpus";
import type { Filing } from "@/lib/data";
import { bestWindow, pieces } from "@/lib/highlight";
import { citation, filingLabel } from "@/lib/labels";
import { CopyButton } from "./CopyButton";

/** One page of a filing: where it is, why it matched (the question's words marked), and how to cite it. */
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
  const [open, setOpen] = useState(false);
  const full = corpus.text(hit.doc, hit.page) ?? "";
  const win = useMemo(() => bestWindow(full, terms), [full, terms]);
  const text = open ? full : full.slice(win.start, win.end);
  const parts = useMemo(() => pieces(text, terms), [text, terms]);
  const shorter = full.length > win.end - win.start;

  return (
    <article className="panel rise-in p-4 sm:p-5" aria-label={`Rank ${rank}: ${hit.doc}, page ${hit.page}`}>
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="tabular inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-surface-2 px-1.5 text-[12px] font-semibold">#{rank}</span>
        <span className="text-[13.5px] font-semibold">{filing ? filingLabel(filing) : hit.doc}</span>
        <span className="text-[13px] text-muted">page {hit.page}</span>
        <span className="tabular text-[12px] text-faint" title="Search score: higher means the page's words match the question more closely">
          score {hit.score.toFixed(1)}
        </span>
        {isGold && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11.5px] font-medium text-accent">FinanceBench&rsquo;s evidence page</span>}
        <span className="ml-auto flex items-center gap-1">
          <CopyButton text={citation(filing, hit.doc, hit.page)} label="Copy citation" />
          {filing?.source && (
            <a
              href={filing.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-muted underline underline-offset-2 transition-colors hover:bg-surface-2 hover:text-fg"
            >
              Open the filing
              <ExternalLink size={12} aria-hidden="true" />
              <span className="sr-only">(opens the company&rsquo;s site)</span>
            </a>
          )}
        </span>
      </header>
      {/* Opened in full, a long page scrolls inside its own box instead of pushing everything else far down. */}
      <div
        className={`page-text rounded-lg bg-bg p-3 text-fg ${open ? "max-h-[30rem] overflow-y-auto" : ""}`}
        {...(open ? { tabIndex: 0, role: "region", "aria-label": `Full text of page ${hit.page}` } : {})}
      >
        {!open && win.start > 0 ? "…\n" : ""}
        {parts.map((p, i) => (p.marked ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
        {!open && win.end < full.length ? "\n…" : ""}
      </div>
      {shorter && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-2 text-[12.5px] font-medium text-accent underline underline-offset-2">
          {open ? "Show less" : "Show the whole page"}
        </button>
      )}
    </article>
  );
}
