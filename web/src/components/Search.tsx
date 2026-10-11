"use client";

import { Eraser, Search as SearchIcon } from "lucide-react";
import Link from "next/link";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { Corpus } from "@/lib/corpus";
import { loadExamples, loadFilings, loadPages, type Example, type Filing } from "@/lib/data";
import { DocResolver } from "@/lib/filters";
import { distinctTerms, markTerms } from "@/lib/highlight";
import { filingLabel } from "@/lib/labels";
import { readSearch, writeSearch } from "@/lib/urlState";
import { CopyButton } from "./CopyButton";
import { PageCard } from "./PageCard";

type Loaded = { filings: Filing[]; examples: Example[]; corpus: Corpus; resolver: DocResolver };
type State = { status: "loading"; done: number; total: number } | { status: "error"; message: string } | ({ status: "ready" } & Loaded);

const SHOWN = 5;
const SEARCHED = 50;

// One-click questions. Each is a benchmark question (so the page can say where
// FinanceBench puts the answer) except the first, which is typed freely.
const QUICK: Array<{ id?: string; question?: string; label: string }> = [
  { question: "What was Best Buy's capital expenditure in fiscal 2023?", label: "Best Buy's capital spending" },
  { id: "financebench_id_00494", label: "Boeing's production rates for 2023" },
  { id: "financebench_id_01198", label: "What drove AMD's revenue change" },
  { id: "financebench_id_00941", label: "3M's registered debt securities" },
  { id: "financebench_id_01490", label: "J&J's gain on the Kenvue split" },
];

export function Search() {
  const [state, setState] = useState<State>({ status: "loading", done: 0, total: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [filings, examples] = await Promise.all([loadFilings(), loadExamples()]);
        if (cancelled) return;
        setState({ status: "loading", done: 0, total: filings.length });
        let done = 0;
        const pages = await Promise.all(
          filings.map(async (f) => {
            const p = await loadPages(f.doc);
            done += 1;
            if (!cancelled) setState({ status: "loading", done, total: filings.length });
            return p;
          }),
        );
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
  }, [attempt]);

  const ready = state.status === "ready" ? state : null;
  const companies = ready ? [...new Set(ready.filings.map((f) => f.company))] : [];

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Find the page behind the figure.</h1>
        <p className="max-w-[68ch] text-[15px] leading-relaxed text-muted">
          Ask a question about a company&rsquo;s filing and Footnote shows the pages most likely to hold the answer, so you can check a figure at its source.
          {ready
            ? ` This demo runs in your browser on ${ready.filings.length} filings (${ready.corpus.size} pages) from ${companies.slice(0, -1).join(", ")} and ${companies.at(-1)}, with no server and no key.`
            : " This demo runs in your browser on a handful of real filings, with no server and no key."}
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

      {state.status === "loading" && <Loading done={state.done} total={state.total} />}
      {state.status === "error" && (
        <div role="alert" className="panel space-y-3 p-5 text-sm">
          <p className="text-bad">{state.message}</p>
          <button
            type="button"
            onClick={() => {
              setState({ status: "loading", done: 0, total: 0 });
              setAttempt((n) => n + 1);
            }}
            className="inline-flex h-9 items-center rounded-xl bg-accent px-4 text-[13px] font-medium text-accent-fg hover:opacity-90"
          >
            Try again
          </button>
        </div>
      )}
      {ready && <Desk {...ready} />}
    </div>
  );
}

function Loading({ done, total }: { done: number; total: number }) {
  return (
    <div className="panel p-5" role="status">
      <p className="text-sm text-muted">{total ? `Loading the filings into your browser: ${done} of ${total} (about 2 MB, once)…` : "Loading the filings into your browser…"}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div className="h-full rounded-full bg-accent motion-safe:transition-[width]" style={{ width: total ? `${(done / total) * 100}%` : "8%" }} />
      </div>
    </div>
  );
}

type Asked = { query: string; example: Example | null };

function Desk({ filings, examples, corpus, resolver }: Loaded) {
  const docs = useMemo(() => filings.map((f) => f.doc), [filings]);
  // The address may carry a search (?q=...), so a shared link opens on its results.
  const [initial] = useState(() => readSearch(window.location.search, docs));
  const [text, setText] = useState(initial.q);
  const [asked, setAsked] = useState<Asked | null>(() =>
    initial.q ? { query: initial.q, example: examples.find((x) => x.question === initial.q) ?? null } : null,
  );
  const [scope, setScope] = useState(initial.scope);
  const [narrow, setNarrow] = useState(initial.narrow);
  const [empty, setEmpty] = useState(false);
  const [ticket, setTicket] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const quick = QUICK.flatMap((q) => {
    if (q.question) return [{ label: q.label, question: q.question, example: examples.find((x) => x.question === q.question) ?? null }];
    const example = examples.find((x) => x.id === q.id);
    return example ? [{ label: q.label, question: example.question, example }] : [];
  });

  const ask = (query: string, example: Example | null) => {
    if (!query.trim()) {
      setEmpty(true);
      inputRef.current?.focus();
      return;
    }
    setEmpty(false);
    setText(query);
    setAsked({ query: query.trim(), example });
    setTicket((n) => n + 1);
  };
  const submit = () => ask(text, examples.find((x) => x.question === text.trim()) ?? null);

  // The address follows the search, so "copy the link" and "reload" both keep it.
  useEffect(() => {
    const qs = asked ? writeSearch({ q: asked.query, scope, narrow }) : "";
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", url);
  }, [asked, scope, narrow]);

  // After a new question the results may be far below the form (on a phone, off screen):
  // bring them into view and put the keyboard there, so a screen reader hears them too.
  useEffect(() => {
    if (ticket === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sectionRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    headingRef.current?.focus({ preventScroll: true });
  }, [ticket]);

  return (
    <div className="space-y-6">
      <form
        className="panel space-y-4 p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div>
          <label htmlFor="question" className="mb-1.5 block text-[13px] font-medium">
            Your question
          </label>
          <textarea
            ref={inputRef}
            id="question"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value.trim()) setEmpty(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="What was Best Buy's capital expenditure in fiscal 2023?"
            aria-describedby={empty ? "question-hint question-error" : "question-hint"}
            aria-invalid={empty || undefined}
            className="w-full resize-y rounded-xl border border-line bg-bg px-3 py-2.5 text-[14px] leading-relaxed placeholder:text-faint"
          />
          <p id="question-hint" className="mt-1 text-[12px] text-faint">
            Press Enter to search, Shift+Enter for a new line.
          </p>
          {empty && (
            <p id="question-error" role="alert" className="mt-1 text-[13px] font-medium text-bad">
              Type a question first, or pick one of the examples below.
            </p>
          )}
        </div>

        <div>
          <p id="quick-label" className="mb-1.5 text-[13px] font-medium">
            Try an example
          </p>
          <div role="group" aria-labelledby="quick-label" className="flex flex-wrap gap-2">
            {quick.map((q) => (
              <button
                key={q.question}
                type="button"
                title={q.question}
                onClick={() => {
                  setScope("all");
                  ask(q.question, q.example);
                }}
                className="rounded-full border border-line bg-bg px-3 py-1.5 text-[13px] font-medium transition-colors hover:border-line-strong hover:bg-surface-2"
              >
                {q.label}
              </button>
            ))}
          </div>
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
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-5 text-[14px] font-medium text-accent-fg transition-opacity hover:opacity-90"
          >
            <SearchIcon size={16} aria-hidden="true" />
            Find the pages
          </button>
          {(text || asked) && (
            <button
              type="button"
              onClick={() => {
                setText("");
                setAsked(null);
                setEmpty(false);
                setScope("all");
                inputRef.current?.focus();
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <Eraser size={15} aria-hidden="true" />
              Start over
            </button>
          )}
        </div>
      </form>

      <details className="rounded-xl border border-line bg-surface px-4 py-3 text-[13px]">
        <summary className="cursor-pointer font-medium">Which filings can I ask about?</summary>
        <p className="mt-2 max-w-[68ch] leading-relaxed text-muted">
          Only these {filings.length}. A question about any other company will still return pages, but they will not be about it.
        </p>
        <ul className="mt-2 space-y-1.5">
          {filings.map((f) => (
            <li key={f.doc} className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-medium">{filingLabel(f)}</span>
              <span className="tabular text-faint">{f.pages} pages</span>
              {f.source && (
                <a href={f.source} target="_blank" rel="noopener noreferrer" className="text-muted underline underline-offset-2 hover:text-fg">
                  Open the filing<span className="sr-only"> for {filingLabel(f)} (opens the company&rsquo;s site)</span>
                </a>
              )}
            </li>
          ))}
        </ul>
      </details>

      {asked && (
        <Results
          query={asked.query}
          example={asked.example}
          scope={scope}
          narrow={narrow}
          filings={filings}
          corpus={corpus}
          resolver={resolver}
          sectionRef={sectionRef}
          headingRef={headingRef}
        />
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
  sectionRef,
  headingRef,
}: {
  query: string;
  example: Example | null;
  scope: string;
  narrow: boolean;
  filings: Filing[];
  corpus: Corpus;
  resolver: DocResolver;
  sectionRef: RefObject<HTMLElement | null>;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const resolution = useMemo(() => resolver.resolve(query), [resolver, query]);
  const searched = useMemo(
    () => (scope !== "all" ? [scope] : narrow && resolution.narrowed ? resolution.docs : null),
    [scope, narrow, resolution],
  );
  const hits = useMemo(() => corpus.search(query, SEARCHED, searched), [corpus, query, searched]);
  const { terms, left } = useMemo(() => {
    const all = markTerms(query);
    const { marked, left } = distinctTerms(all, corpus.termShare(all, searched));
    return { terms: marked, left };
  }, [corpus, query, searched]);
  const shown = hits.slice(0, SHOWN);
  // Built from the search itself, not read from the address bar, which is updated a moment later.
  const shareUrl = `${window.location.origin}${window.location.pathname}?${writeSearch({ q: query, scope, narrow })}`;
  const byDoc = new Map(filings.map((f) => [f.doc, f]));
  const companies = [...new Set(filings.map((f) => f.company))];

  const gold = example?.gold[0] ?? null;
  const goldRank = gold ? hits.findIndex((h) => example!.gold.some((g) => g.doc === h.doc && g.page === h.page)) + 1 : 0;

  let scopeLine = `Searched all ${filings.length} filings.`;
  if (scope !== "all") scopeLine = `Searched inside ${byDoc.get(scope) ? filingLabel(byDoc.get(scope)!) : scope}.`;
  else if (narrow && resolution.narrowed)
    scopeLine = `Recognised ${resolution.companies.join(" and ")}${resolution.years.length ? ` and ${resolution.years.join(", ")}` : ""}: searched ${resolution.docs.length} of ${filings.length} filings.`;
  else if (narrow)
    scopeLine = `None of the demo's companies (${companies.join(", ")}) is named in the question, so all ${filings.length} filings were searched. If you asked about another company, these pages will not be about it.`;

  return (
    <section ref={sectionRef} aria-labelledby="results-heading" className="scroll-mt-20 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h2 id="results-heading" ref={headingRef} tabIndex={-1} className="text-lg font-semibold tracking-tight outline-none">
            {shown.length ? `The ${shown.length} best pages` : "No page matches"}
          </h2>
          <p role="status" className="mt-1 max-w-[72ch] text-[13px] leading-relaxed text-muted">
            {scopeLine}
          </p>
        </div>
        <CopyButton text={shareUrl} label="Copy link to this search" className="border border-line" />
      </div>

      {!shown.length && (
        <div className="panel space-y-2 p-4 text-[13.5px] leading-relaxed text-muted sm:p-5">
          <p>None of the words in your question appear in the pages searched. Some things to try:</p>
          <ul className="list-disc space-y-1 pl-5 marker:text-faint">
            <li>Use the words a filing would use: &ldquo;revenue&rdquo;, &ldquo;net income&rdquo;, &ldquo;purchases of property and equipment&rdquo;.</li>
            <li>Name the company, and the year, so the search can narrow to the right filing.</li>
            <li>Turn off &ldquo;Narrow by the company and year&rdquo;, or search in all {filings.length} filings.</li>
          </ul>
        </div>
      )}

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

      {!!shown.length && (
        <p className="max-w-[76ch] text-[12.5px] leading-relaxed text-muted">
          A high rank means the page&rsquo;s words match your question, not that the page answers it. Marked words are your question&rsquo;s own
          {left.length ? `; left plain because they are on most of the pages searched: ${left.join(", ")}` : ""}. Use &ldquo;Open the filing&rdquo; to check a
          figure at its source.
        </p>
      )}
    </section>
  );
}

function rankText(rank: number | null): string {
  return rank === null ? "not in the top 50" : `#${rank}`;
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
      {open && (
        <div className="page-text mt-2 max-h-[30rem] overflow-y-auto rounded-lg bg-bg p-3" tabIndex={0} role="region" aria-label={`Full text of page ${page}`}>
          {text}
        </div>
      )}
    </div>
  );
}
