// Showing why a page matched: the question's words marked in the page text, and
// the stretch of the page where most of them sit. Display only; ranking is bm25.ts.

import { tokenize } from "./bm25";

// Words that appear in nearly every question and every page. Marking them would
// colour half the page, so they are left plain. Ranking is unaffected: BM25
// already gives them almost no weight.
const PLAIN = new Set(
  "a an and are as at be by did do does for from has have how in is it its of on or that the this to was were what when which who with would".split(" "),
);

const WORD = /[a-z0-9]+(?:[.,][0-9]+)*/gi;

/** The words of a question worth marking: its tokens, minus the plain ones and stray letters (the "s" of "Buy's"). */
export function markTerms(query: string): Set<string> {
  return new Set(tokenize(query).filter((t) => !PLAIN.has(t) && (t.length > 1 || /\d/.test(t))));
}

/**
 * Which of the question's words are worth marking on THESE pages. A word found on
 * most of the searched pages (the company's name once the search is narrowed to
 * its filing, "fiscal", the year) says nothing about which page is the right one,
 * and marking it buries the words that do. Too few pages to judge, or nothing
 * left after dropping: keep every word. Display only; the ranking is untouched.
 */
export function distinctTerms(
  terms: Set<string>,
  seen: { pages: number; share: Map<string, number> },
  most = 0.4,
  minPages = 20,
): { marked: Set<string>; left: string[] } {
  if (seen.pages < minPages) return { marked: terms, left: [] };
  const left = [...terms].filter((t) => (seen.share.get(t) ?? 0) > most);
  if (left.length === 0 || left.length === terms.size) return { marked: terms, left: [] };
  return { marked: new Set([...terms].filter((t) => !left.includes(t))), left };
}

function normal(word: string): string {
  const lower = word.toLowerCase();
  return /^[0-9]/.test(lower) ? lower.replaceAll(",", "") : lower;
}

export type Piece = { text: string; marked: boolean };

/** Cuts `text` into pieces, each either plain or a marked word. Joined, they give `text` back. */
export function pieces(text: string, terms: Set<string>): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  for (const m of text.matchAll(WORD)) {
    const at = m.index ?? 0;
    if (!terms.has(normal(m[0]))) continue;
    if (at > last) out.push({ text: text.slice(last, at), marked: false });
    out.push({ text: m[0], marked: true });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), marked: false });
  return out;
}

/** The `size`-character stretch of `text` holding the most marked words, starting at a line start when it can. */
export function bestWindow(text: string, terms: Set<string>, size = 700): { start: number; end: number } {
  if (text.length <= size) return { start: 0, end: text.length };
  const at: number[] = [];
  for (const m of text.matchAll(WORD)) if (terms.has(normal(m[0]))) at.push(m.index ?? 0);
  if (at.length === 0) return { start: 0, end: size };
  let bestFrom = at[0];
  let bestCount = 0;
  let j = 0;
  for (let i = 0; i < at.length; i++) {
    if (j < i) j = i;
    while (j < at.length && at[j] < at[i] + size - 80) j++;
    if (j - i > bestCount) {
      bestCount = j - i;
      bestFrom = at[i];
    }
  }
  let start = Math.max(0, bestFrom - 60);
  const lineStart = text.lastIndexOf("\n", start);
  if (lineStart >= 0 && start - lineStart < 120) start = lineStart + 1;
  return { start, end: Math.min(text.length, start + size) };
}
