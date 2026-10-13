// The page shown on the first screen before anything is asked: a real page of a
// real filing, found by running the real search at build time. Nothing here is
// typed in except the question and which page to show; the rank, the score, the
// marked words and the words left plain are what the search returns, so the
// caption cannot drift from the data (src/lib/sample.test.ts checks it).

import { Corpus } from "./corpus";
import type { Filing } from "./data";
import { DocResolver } from "./filters";
import { bestWindow, distinctTerms, markTerms, pieces } from "./highlight";
import { citation, filingLabel } from "./labels";

export const SAMPLE_QUESTION = "What was Best Buy's capital expenditure in fiscal 2023?";
/** The page of that filing to show: the one whose table the question is about. Pages count from 1. */
export const SAMPLE_PAGE = 30;
const SEARCHED = 50;

export type Sample = {
  question: string;
  doc: string;
  page: number;
  /** Where this search ranks the page among the pages of the filing it searched. */
  rank: number;
  score: number;
  /** "Best Buy, 10-K 2023" */
  label: string;
  source: string;
  citation: string;
  /** The page's text, exactly as extracted. */
  full: string;
  /** The question's words that are marked on the page. */
  terms: string[];
  /** The question's words left plain, because they are on most of the pages searched. */
  left: string[];
  /** The stretch of the page to show: a slice of `full`, starting at the line of its first marked word. */
  view: { start: number; end: number };
  /** What the data holds, for the line under the headline. */
  facts: { filings: number; pages: number; companies: string[] };
};

/** `pagesOf(doc)` returns the page texts of one filing, in order. */
export function buildSample(filings: Filing[], pagesOf: (doc: string) => string[]): Sample {
  const corpus = new Corpus(filings.map((f) => ({ doc: f.doc, pages: pagesOf(f.doc) })));
  const resolver = new DocResolver(filings.map((f) => ({ doc: f.doc, company: f.company, period: f.period })));

  // The sample is the search as the site runs it with "Narrow by the company and year" on.
  const resolution = resolver.resolve(SAMPLE_QUESTION);
  if (!resolution.narrowed || resolution.docs.length !== 1) throw new Error("The sample question must name exactly one filing.");
  const doc = resolution.docs[0];
  const filing = filings.find((f) => f.doc === doc);
  if (!filing) throw new Error(`The sample filing ${doc} is not in the data.`);

  const hits = corpus.search(SAMPLE_QUESTION, SEARCHED, resolution.docs);
  const at = hits.findIndex((h) => h.doc === doc && h.page === SAMPLE_PAGE);
  if (at < 0) throw new Error(`Page ${SAMPLE_PAGE} of ${doc} is not in the first ${SEARCHED} results for the sample question.`);
  const full = corpus.text(doc, SAMPLE_PAGE);
  if (full === null) throw new Error(`Page ${SAMPLE_PAGE} of ${doc} has no text.`);

  const all = markTerms(SAMPLE_QUESTION);
  const { marked, left } = distinctTerms(all, corpus.termShare(all, resolution.docs));
  return {
    question: SAMPLE_QUESTION,
    doc,
    page: SAMPLE_PAGE,
    rank: at + 1,
    score: hits[at].score,
    label: filingLabel(filing),
    source: filing.source,
    citation: citation(filing, doc, SAMPLE_PAGE),
    full,
    terms: [...marked],
    left,
    view: firstMarkView(full, marked),
    facts: { filings: filings.length, pages: corpus.size, companies: [...new Set(filings.map((f) => f.company))] },
  };
}

/**
 * The window a result would show (the stretch holding most marked words), moved
 * down to the line of its first marked word, so the first screen shows a mark
 * straight away. Same length, still a verbatim slice of the page.
 */
export function firstMarkView(full: string, terms: Set<string>): { start: number; end: number } {
  const win = bestWindow(full, terms);
  let at = win.start;
  for (const p of pieces(full.slice(win.start, win.end), terms)) {
    if (p.marked) break;
    at += p.text.length;
  }
  const start = full.lastIndexOf("\n", at - 1) + 1;
  return { start, end: Math.min(full.length, start + (win.end - win.start)) };
}

const ORDINAL = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];

/** "fifth" for 5; "#12" past ten, where a word would be longer than the number. */
export function ordinal(rank: number): string {
  return ORDINAL[rank - 1] ?? `#${rank}`;
}
