"use client";

import { ExternalLink, Search as SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Corpus } from "@/lib/corpus";
import { loadExamples, loadFilings, loadPages, type Example, type Filing } from "@/lib/data";
import { DocResolver } from "@/lib/filters";
import { bestWindow, markTerms, pieces } from "@/lib/highlight";

type Loaded = { filings: Filing[]; examples: Example[]; corpus: Corpus; resolver: DocResolver };
type State = { status: "loading" } | { status: "error"; message: string } | ({ status: "ready" } & Loaded);

const SHOWN = 5;
const SEARCHED = 50;

const TYPE_LABEL: Record<string, string> = { "10k": "10-K", "10q": "10-Q", "8k": "8-K", earnings: "Earnings" };

function filingLabel(f: Filing): string {
  return `${f.company}, ${TYPE_LABEL[f.type] ?? f.type} ${f.period}`;
}

export function Search() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [text, setText] = useState("");
  const [asked, setAsked] = useState<{ query: string; example: Example | null } | null>(null);
  const [scope, setScope] = useState("all");
  const [narrow, setNarrow] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [filings, examples] = await Promise.all([loadFilings(), loadExamples()]);
        const pages = await Promise.all(filings.map((f) => loadPages(f.doc)));
        if (cancelled) return;
        const resolver = new DocResolver(filings.map((f) => ({ doc: f.doc, company: f.company, period: f.period })));
        setState({ status: "ready", filings, examples, corpus: new Corpus(pages), resolver });
      } catch (e) {
        if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : "Could not load the filings." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <p role="status" className="py-16 text-center text-sm text-muted">
        Loading 7 filings (about 2 MB) into your browser…
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="panel p-5 text-sm text-bad">
        {state.message} Reload the page to try again.
      </p>
    );
  }

  const { filings, examples, corpus, resolver } = state;

  const ask = (query: string, example: Example | null) => {
    setText(query);
    setAsked({ query: query.trim(), example });
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Find the page behind the figure.</h1>
        <p className="max-w-[68ch] text-[15px] leading-relaxed text-muted">
          Footnote searches company filings and points to the page that holds the answer. This demo runs in your browser on {filings.length}{" "}
          filings ({corpus.size} pages), with no server and no key.
        </p>
        <p className="max-w-[68ch] rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-muted">
          <strong className="font-semibold text-fg">What this does not do yet:</strong> it finds pages, it does not write answers. Writing an answer needs a
          language model, and none has been run on this project yet. What has been measured is on the{" "}
          <Link href="/results" className="font-medium text-accent underline underline-offset-2">
            Results
          </Link>{" "}
          page.
        </p>
      </section>

      <form
        className="panel space-y-4 p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) ask(text, examples.find((x) => x.question === text) ?? null);
        }}
      >
        <div>
          <label htmlFor="question" className="mb-1.5 block text-[13px] font-medium">
            Your question
          </label>
          <textarea
            id="question"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="What was Best Buy's capital expenditure in fiscal 2023?"
            className="w-full resize-y rounded-xl border border-line bg-bg px-3 py-2.5 text-[14px] leading-relaxed placeholder:text-faint"
          />
        </div>

        <div>
          <label htmlFor="example" className="mb-1.5 block text-[13px] font-medium">
            Or try one of the {examples.length} FinanceBench questions about these filings
          </label>
          <select
            id="example"
            value={asked?.example?.id ?? ""}
            onChange={(e) => {
              const ex = examples.find((x) => x.id === e.target.value);
              if (ex) {
                setScope("all");
                ask(ex.question, ex);
              }
            }}
            className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-[13px]"
          >
            <option value="">Choose a question…</option>
            {filings.map((f) => {
              const mine = examples.filter((x) => x.doc === f.doc);
              if (!mine.length) return null;
              return (
                <optgroup key={f.doc} label={filingLabel(f)}>
                  {mine.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.question.length > 110 ? `${x.question.slice(0, 108)}…` : x.question}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="scope" className="mb-1.5 block text-[13px] font-medium">
              Search in
            </label>
            <select
              id="scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-[13px]"
            >
              <option value="all">All {filings.length} filings</option>
              {filings.map((f) => (
                <option key={f.doc} value={f.doc}>
                  {filingLabel(f)} ({f.pages} pages)
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2.5 text-[13px]">
            <input type="checkbox" checked={narrow} onChange={(e) => setNarrow(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            Narrow by the company and year in the question
          </label>
          <button
            type="submit"
            disabled={!text.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-5 text-[14px] font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <SearchIcon size={16} aria-hidden="true" />
            Find the pages
          </button>
        </div>
      </form>

      {asked && (
        <Results query={asked.query} example={asked.example} scope={scope} narrow={narrow} filings={filings} corpus={corpus} resolver={resolver} />
      )}
    </div>
  );
}

function Results({
  query,
  example,
  scope,
  narrow,
  filings,
  corpus,
  resolver,
}: {
  query: string;
  example: Example | null;
  scope: string;
  narrow: boolean;
  filings: Filing[];
  corpus: Corpus;
  resolver: DocResolver;
}) {
  const terms = useMemo(() => markTerms(query), [query]);
  const resolution = useMemo(() => resolver.resolve(query), [resolver, query]);
  const hits = useMemo(() => {
    const docs = scope !== "all" ? [scope] : narrow && resolution.narrowed ? resolution.docs : null;
    return corpus.search(query, SEARCHED, docs);
  }, [corpus, query, scope, narrow, resolution]);
  const shown = hits.slice(0, SHOWN);
  const byDoc = new Map(filings.map((f) => [f.doc, f]));

  const gold = example?.gold[0] ?? null;
  const goldRank = gold ? hits.findIndex((h) => example!.gold.some((g) => g.doc === h.doc && g.page === h.page)) + 1 : 0;

  let scopeLine = `Searched all ${filings.length} filings.`;
  if (scope !== "all") scopeLine = `Searched inside ${byDoc.get(scope) ? filingLabel(byDoc.get(scope)!) : scope}.`;
  else if (narrow && resolution.narrowed)
    scopeLine = `Recognised ${resolution.companies.join(" and ")}${resolution.years.length ? ` and ${resolution.years.join(", ")}` : ""}: searched ${resolution.docs.length} of ${filings.length} filings.`;
  else if (narrow) scopeLine = `No company recognised in the question, so searched all ${filings.length} filings.`;

  return (
    <section aria-labelledby="results-heading" className="space-y-4">
      <div>
        <h2 id="results-heading" className="text-lg font-semibold tracking-tight">
          {shown.length ? `The ${shown.length} best pages` : "No page matches"}
        </h2>
        <p role="status" className="mt-1 text-[13px] text-muted">
          {scopeLine}
        </p>
      </div>

      {gold && (
        <div className="panel space-y-2 border-l-4 border-l-accent p-4 sm:p-5">
          <p className="eyebrow">What FinanceBench says</p>
          <p className="text-[14px] leading-relaxed">
            The benchmark marks <strong>page {gold.page}</strong> of <span className="font-mono text-[13px]">{gold.doc}</span> as where the answer is
            {example!.gold.length > 1 ? ` (and ${example!.gold.length - 1} other page${example!.gold.length > 2 ? "s" : ""})` : ""}.{" "}
            {goldRank > 0 ? (
              <>
                This search ranks it <strong>#{goldRank}</strong> of {hits.length} pages
                {goldRank <= SHOWN ? ", so it is shown below." : "."}
              </>
            ) : (
              <>This search does not have it in its first {Math.min(SEARCHED, hits.length || SEARCHED)} pages.</>
            )}
          </p>
          <p className="text-[12.5px] text-muted tabular">
            The same question three ways: right filing given {rankText(example!.rank.oracle)} · company/year filter {rankText(example!.rank.filtered)} · all
            filings {rankText(example!.rank.all)}.
          </p>
          {goldRank > SHOWN && <PageCard hit={hits[goldRank - 1]} rank={goldRank} corpus={corpus} filing={byDoc.get(hits[goldRank - 1].doc)} terms={terms} isGold />}
          {goldRank === 0 && <GoldPage doc={gold.doc} page={gold.page} corpus={corpus} />}
        </div>
      )}

      <ol className="space-y-3">
        {shown.map((hit, i) => (
          <li key={`${hit.doc}#${hit.page}`}>
            <PageCard
              hit={hit}
              rank={i + 1}
              corpus={corpus}
              filing={byDoc.get(hit.doc)}
              terms={terms}
              isGold={!!example?.gold.some((g) => g.doc === hit.doc && g.page === hit.page)}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

function rankText(rank: number | null): string {
  return rank === null ? "not in the top 50" : `#${rank}`;
}

function PageCard({
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
  const cut = !open && full.length > win.end - win.start;

  return (
    <article className="panel rise-in p-4 sm:p-5" aria-label={`Rank ${rank}: ${hit.doc}, page ${hit.page}`}>
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="tabular inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-surface-2 px-1.5 text-[12px] font-semibold">#{rank}</span>
        <span className="text-[13.5px] font-semibold">{filing ? filingLabel(filing) : hit.doc}</span>
        <span className="text-[13px] text-muted">page {hit.page}</span>
        <span className="tabular text-[12px] text-faint">score {hit.score.toFixed(1)}</span>
        {isGold && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11.5px] font-medium text-accent">FinanceBench&rsquo;s evidence page</span>}
        {filing?.source && (
          <a
            href={filing.source}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-[12px] text-muted underline underline-offset-2 hover:text-fg"
          >
            The filing
            <ExternalLink size={12} aria-hidden="true" />
            <span className="sr-only">(opens the company&rsquo;s site)</span>
          </a>
        )}
      </header>
      <div className="page-text rounded-lg bg-bg p-3 text-fg">
        {!open && win.start > 0 ? "…\n" : ""}
        {parts.map((p, i) => (p.marked ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
        {cut ? "\n…" : ""}
      </div>
      {full.length > win.end - win.start && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-2 text-[12.5px] font-medium text-accent underline underline-offset-2">
          {open ? "Show less" : "Show the whole page"}
        </button>
      )}
    </article>
  );
}

function GoldPage({ doc, page, corpus }: { doc: string; page: number; corpus: Corpus }) {
  const [open, setOpen] = useState(false);
  const text = corpus.text(doc, page);
  if (!text) return null;
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-[12.5px] font-medium text-accent underline underline-offset-2">
        {open ? "Hide that page" : "Show that page"}
      </button>
      {open && <div className="page-text mt-2 rounded-lg bg-bg p-3">{text}</div>}
    </div>
  );
}
