"use client";

import Link from "next/link";
import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Corpus } from "@/lib/corpus";
import { loadExamples, loadFilings, loadPages, type Example, type Filing } from "@/lib/data";
import { DocResolver } from "@/lib/filters";
import { distinctTerms, markTerms } from "@/lib/highlight";
import { filingLabel } from "@/lib/labels";
import { ordinal, type Sample } from "@/lib/sample";
import { readSearch, writeSearch } from "@/lib/urlState";
import { CopyButton } from "./CopyButton";
import { Leaf, PageCard } from "./PageCard";

type Loaded = { filings: Filing[]; examples: Example[]; corpus: Corpus; resolver: DocResolver };
type State = { status: "loading"; done: number; total: number } | { status: "error" } | ({ status: "ready" } & Loaded);

const SHOWN = 5;
const SEARCHED = 50;
const RESORT_MS = 260;

// One-click questions. Each is a benchmark question (so the page can say where
// FinanceBench puts the answer) except the first, which is typed freely.
const QUICK: Array<{ id?: string; question?: string; label: string }> = [
  { question: "What was Best Buy's capital expenditure in fiscal 2023?", label: "Best Buy's capital spending" },
  { id: "financebench_id_00494", label: "Boeing's production rates for 2023" },
  { id: "financebench_id_01198", label: "What drove AMD's revenue change" },
  { id: "financebench_id_00941", label: "3M's registered debt securities" },
  { id: "financebench_id_01490", label: "J&J's gain on the Kenvue split" },
];

/**
 * The page and its margin. On a phone everything is one column in reading order
 * (the limits straight after the headline, the options after the question).
 * From 1024 px the notes sit in the right-hand margin; see .notes-layout.
 */
export function Search({ sample }: { sample: Sample }) {
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
      } catch {
        // The cause (a network failure, a file in the wrong shape) is for the console, not the visitor.
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <div className="notes-layout">
      {state.status === "ready" ? (
        <Desk {...state} sample={sample} retried={attempt > 0} />
      ) : (
        <>
          <Intro compact={false} facts={sample.facts} />
          <LimitsNote />
          <div className="nl-ask">
            {state.status === "loading" ? (
              <Loading done={state.done} total={state.total} focusOnMount={attempt > 0} />
            ) : (
              <LoadError
                onRetry={() => {
                  setState({ status: "loading", done: 0, total: 0 });
                  setAttempt((n) => n + 1);
                }}
              />
            )}
          </div>
          <div className="nl-margin">
            <MarksNote left={sample.left} />
          </div>
          <div className="nl-main">
            <SampleLeaf sample={sample} />
          </div>
        </>
      )}
    </div>
  );
}

function Intro({ compact, facts }: { compact: boolean; facts: Sample["facts"] }) {
  const { companies } = facts;
  return (
    <div className="nl-intro">
      <h1 className={compact ? "h1 h1-compact" : "h1"}>
        Find the page behind <br className="hidden sm:inline" />
        the figure.
      </h1>
      <p className="dek mt-4">
        Ask a question about a company&rsquo;s filing and Footnote shows the pages most likely to hold the answer, so you can check a figure at its source.
        {` This demo runs in your browser on ${facts.filings} filings (${facts.pages} pages) from ${companies.slice(0, -1).join(", ")} and ${companies.at(-1)}, with no server and no key.`}
      </p>
    </div>
  );
}

function LimitsNote() {
  return (
    <div className="nl-limits note">
      <p>
        <strong>Search and evaluation.</strong> This browser search returns source pages. Generated answers are measured separately in an offline real-model comparison on the{" "}
        <Link href="/results" className="tlink font-semibold text-ink">
          Results
        </Link>{" "}
        page.
      </p>
    </div>
  );
}

function MarksNote({ left }: { left: string[] }) {
  return (
    <p className="note">
      <strong>Marks.</strong> <span className="swatch">Pink</span> is a word from the question, found on the page.
      {left.length ? ` Some words are left plain because they are on most of the pages searched: ${left.join(", ")}.` : ""}
    </p>
  );
}

/** What a result is, before anything is asked: a real page, computed from the repo's own data at build. */
function SampleLeaf({ sample }: { sample: Sample }) {
  return (
    <>
      <p id="sample-caption" className="mb-3 text-[13px] leading-snug text-ink-3">
        A sample, not your search: this question, searched in {sample.label} only. This page came {ordinal(sample.rank)}.
      </p>
      <Leaf
        as="figure"
        ariaLabelledBy="sample-caption"
        rank={sample.rank}
        score={sample.score}
        page={sample.page}
        label={sample.label}
        citation={sample.citation}
        source={sample.source}
        full={sample.full}
        terms={sample.terms}
        view={sample.view}
      />
    </>
  );
}

function Loading({ done, total, focusOnMount }: { done: number; total: number; focusOnMount: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // After "Try again" the button is gone; keep the keyboard here instead of dropping it on the page.
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);
  return (
    <div ref={ref} role="status" tabIndex={-1} className="min-h-[9rem] outline-none">
      <p className="text-[14px] font-semibold">Loading the filings</p>
      <p className="mt-1 text-[14px] text-ink-2">
        {total ? `Loading the filings into your browser: ${done} of ${total} (about 2 MB, once)…` : "Loading the filings into your browser…"}
      </p>
      <div className="mt-3 h-1 max-w-sm bg-rule" aria-hidden="true">
        <div className="h-full bg-ink transition-[width] duration-200 ease-out" style={{ width: total ? `${(done / total) * 100}%` : "8%" }} />
      </div>
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="min-h-[9rem] space-y-3">
      <p className="text-[15px] font-semibold text-alert">The filings could not be loaded.</p>
      <p className="text-[14px] text-ink-2">Check your connection, then try again.</p>
      <button type="button" onClick={onRetry} className="btn-primary">
        Try again
      </button>
    </div>
  );
}

type Asked = { query: string; example: Example | null };

/** The search itself: what was found, which of the question's words are marked, and which are left plain. */
function useSearchView(asked: Asked | null, scope: string, narrow: boolean, corpus: Corpus, resolver: DocResolver) {
  const query = asked?.query ?? "";
  const resolution = useMemo(() => resolver.resolve(query), [resolver, query]);
  const searched = useMemo(
    () => (scope !== "all" ? [scope] : narrow && resolution.narrowed ? resolution.docs : null),
    [scope, narrow, resolution],
  );
  const hits = useMemo(() => (query ? corpus.search(query, SEARCHED, searched) : []), [corpus, query, searched]);
  const { terms, left } = useMemo(() => {
    const all = markTerms(query);
    const { marked, left } = distinctTerms(all, corpus.termShare(all, searched));
    return { terms: marked, left };
  }, [corpus, query, searched]);
  return { query, resolution, hits, terms, left };
}

function Desk({ filings, examples, corpus, resolver, sample, retried }: Loaded & { sample: Sample; retried: boolean }) {
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
  const tops = useRef<Map<string, number> | null>(null);

  const view = useSearchView(asked, scope, narrow, corpus, resolver);

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

  // The one moment of motion. When the visitor changes what is searched, the pages
  // that stay on the list slide to their new rank. Positions are measured just before
  // the change (remember) and the slide plays right after it (the effect below). Pages
  // that are new simply appear; a new question never animates. Focus is not touched.
  const remember = () => {
    if (!asked) return;
    const map = new Map<string, number>();
    document.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => map.set(el.dataset.flip ?? "", el.getBoundingClientRect().top));
    tops.current = map;
  };
  useLayoutEffect(() => {
    const before = tops.current;
    tops.current = null;
    if (!before || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => {
      const was = before.get(el.dataset.flip ?? "");
      if (was === undefined) return;
      const dy = was - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 2) return;
      el.animate({ translate: [`0 ${dy}px`, "0 0"] }, { duration: RESORT_MS, easing: "ease-out" });
    });
  }, [scope, narrow]);

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

  // After "Try again" the loading line held the keyboard; hand it to the question.
  useEffect(() => {
    if (retried) inputRef.current?.focus();
  }, [retried]);

  return (
    <>
      <Intro compact={!!asked} facts={sample.facts} />
      <LimitsNote />

      <form
        id="ask"
        className="nl-ask"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="question" className="field-label">
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
          placeholder={sample.question}
          aria-describedby={empty ? "question-hint question-error" : "question-hint"}
          aria-invalid={empty || undefined}
          className="field min-h-24 resize-y px-3.5 py-3 text-[17px] leading-[1.4] sm:min-h-[4.5rem]"
        />
        <p id="question-hint" className="hint">
          Press Enter to search, Shift+Enter for a new line.
        </p>
        {empty && (
          <p id="question-error" role="alert" className="mt-2 text-[14px] font-semibold text-alert">
            Type a question first, or pick one of the examples.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="submit" className="btn-primary">
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
              className="tlink inline-flex min-h-11 items-center px-2 text-[14px] font-semibold hover:bg-leaf-2"
            >
              Start over
            </button>
          )}
        </div>
      </form>

      <div className="nl-margin">
        <div className="nl-m-examples">
          <p id="quick-label" className="field-label mb-1">
            Try an example
          </p>
          <div role="group" aria-labelledby="quick-label" className="-mx-2 flex flex-col items-start">
            {quick.map((q) => (
              <button
                key={q.question}
                type="button"
                form="ask"
                title={q.question}
                onClick={() => {
                  setScope("all");
                  ask(q.question, q.example);
                }}
                className="tlink inline-flex min-h-11 w-full items-center px-2 text-left text-[15px] hover:bg-leaf-2 sm:min-h-8"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="example" className="field-label">
            Or try one of the {examples.length} FinanceBench questions about these filings
          </label>
          <select
            id="example"
            form="ask"
            value={asked?.example?.id ?? ""}
            onChange={(e) => {
              const ex = examples.find((x) => x.id === e.target.value);
              if (ex) {
                setScope("all");
                ask(ex.question, ex);
              }
            }}
            className="field h-11 px-3 text-[14px]"
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

        <div>
          <label htmlFor="scope" className="field-label">
            Search in
          </label>
          <select
            id="scope"
            form="ask"
            value={scope}
            onChange={(e) => {
              remember();
              setScope(e.target.value);
            }}
            className="field h-11 px-3 text-[14px]"
          >
            <option value="all">All {filings.length} filings</option>
            {filings.map((f) => (
              <option key={f.doc} value={f.doc}>
                {filingLabel(f)} ({f.pages} pages)
              </option>
            ))}
          </select>
          <label className="mt-1 flex min-h-11 cursor-pointer items-start gap-3 py-2.5 text-[14px] leading-snug">
            <input
              type="checkbox"
              form="ask"
              checked={narrow}
              onChange={(e) => {
                remember();
                setNarrow(e.target.checked);
              }}
              className="h-6 w-6 shrink-0 cursor-pointer accent-ink"
            />
            Narrow by the company and year in the question
          </label>
        </div>

        <div className="nl-m-wide">
          <MarksNote left={asked ? view.left : sample.left} />
        </div>

        <details className="nl-m-wide">
          <summary className="min-h-11 cursor-pointer py-2.5 text-[14px] font-semibold">Which filings can I ask about?</summary>
          <p className="note mt-1">Only these {filings.length}. A question about any other company will still return pages, but they will not be about it.</p>
          <ul className="mt-2">
            {filings.map((f) => (
              <li key={f.doc} className="flex flex-wrap items-center gap-x-3 py-0.5 text-[14px]">
                <span className="font-semibold">{filingLabel(f)}</span>
                <span className="tabular text-ink-3">{f.pages} pages</span>
                {f.source && (
                  <a href={f.source} target="_blank" rel="noopener noreferrer" className="tlink inline-flex min-h-11 items-center text-ink-2 hover:text-ink sm:min-h-8">
                    Open the filing<span className="sr-only"> for {filingLabel(f)} (opens the company&rsquo;s site)</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </details>

      </div>

      <div className="nl-main">
        {asked ? (
          <Results
            view={view}
            example={asked.example}
            scope={scope}
            narrow={narrow}
            filings={filings}
            corpus={corpus}
            sectionRef={sectionRef}
            headingRef={headingRef}
          />
        ) : (
          <SampleLeaf sample={sample} />
        )}
      </div>
    </>
  );
}

function Results({
  view,
  example,
  scope,
  narrow,
  filings,
  corpus,
  sectionRef,
  headingRef,
}: {
  view: ReturnType<typeof useSearchView>;
  example: Example | null;
  scope: string;
  narrow: boolean;
  filings: Filing[];
  corpus: Corpus;
  sectionRef: RefObject<HTMLElement | null>;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const { query, resolution, hits, terms } = view;
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
    <section ref={sectionRef} aria-labelledby="results-heading" className="scroll-mt-20 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1 basis-80">
          <h2 id="results-heading" ref={headingRef} tabIndex={-1} className="h2 outline-none">
            {shown.length ? `The ${shown.length} best pages` : "No page matches"}
          </h2>
          <p role="status" className="note mt-2 max-w-[72ch]">
            {scopeLine}
          </p>
        </div>
        <CopyButton text={shareUrl} label="Copy link to this search" />
      </div>

      {!shown.length && (
        <div className="space-y-2 text-[15px] leading-relaxed text-ink-2">
          <p>None of the words in your question appear in the pages searched. Some things to try:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Use the words a filing would use: &ldquo;revenue&rdquo;, &ldquo;net income&rdquo;, &ldquo;purchases of property and equipment&rdquo;.</li>
            <li>Name the company, and the year, so the search can narrow to the right filing.</li>
            <li>Turn off &ldquo;Narrow by the company and year&rdquo;, or search in all {filings.length} filings.</li>
          </ul>
        </div>
      )}

      {gold && (
        <div className="space-y-2 text-[15px] leading-relaxed">
          <p>
            <strong className="run-in">What FinanceBench says.</strong> The benchmark marks <strong className="font-semibold">page {gold.page}</strong> of{" "}
            <span className="font-semibold">{gold.doc}</span> as where the answer is
            {example!.gold.length > 1 ? ` (and ${example!.gold.length - 1} other page${example!.gold.length > 2 ? "s" : ""})` : ""}.{" "}
            {goldRank > 0 ? (
              <>
                This search ranks it <strong className="font-semibold">#{goldRank}</strong> of {hits.length} pages
                {goldRank <= SHOWN ? ", so it is shown below." : "."}
              </>
            ) : (
              <>This search does not have it in its first {Math.min(SEARCHED, hits.length || SEARCHED)} pages.</>
            )}
          </p>
          <p className="tabular text-[13.5px] text-ink-2">
            The same question three ways: right filing given {rankText(example!.rank.oracle)}, company/year filter {rankText(example!.rank.filtered)}, all
            filings {rankText(example!.rank.all)}.
          </p>
          {goldRank === 0 && <GoldPage doc={gold.doc} page={gold.page} corpus={corpus} />}
        </div>
      )}

      {goldRank > SHOWN && (
        <PageCard hit={hits[goldRank - 1]} rank={goldRank} corpus={corpus} filing={byDoc.get(hits[goldRank - 1].doc)} terms={terms} isGold />
      )}

      <ol className="space-y-8">
        {shown.map((hit, i) => (
          <li key={`${hit.doc}#${hit.page}`} data-flip={`${hit.doc}#${hit.page}`}>
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
        <p className="max-w-[72ch] text-[14px] leading-relaxed text-ink-2">
          A high rank means the page&rsquo;s words match your question, not that the page answers it.
          Use &ldquo;Open the filing&rdquo; to check a figure at its source.
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
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="tlink inline-flex min-h-9 items-center text-[13px] font-semibold hover:bg-leaf-2 sm:min-h-8">
        {open ? "Hide that page" : "Show that page"}
      </button>
      {open && (
        <div className="page-text page-text-open mt-2" tabIndex={0} role="region" aria-label={`Full text of page ${page}`}>
          {text}
        </div>
      )}
    </div>
  );
}
