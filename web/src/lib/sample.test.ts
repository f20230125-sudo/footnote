import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Corpus } from "./corpus";
import { DocResolver } from "./filters";
import { bestWindow, distinctTerms, markTerms, pieces } from "./highlight";
import { firstMarkView, ordinal, SAMPLE_PAGE, SAMPLE_QUESTION } from "./sample";
import { loadSample } from "./sampleLoad";

// The first screen shows a real page with its rank and score. These tests run the
// search again on the data files, so the sample cannot say something the search
// does not. The static share image (src/app/opengraph-image.png) was taken from
// this sample: if a figure pinned below changes, retake the image.

const read = (...parts: string[]) => JSON.parse(readFileSync(join(process.cwd(), "public", "data", ...parts), "utf-8"));
const filings = read("filings.json") as Array<{ doc: string; company: string; period: number | string }>;
const pagesOf = (doc: string) => read("pages", `${doc}.json`).pages as string[];

const sample = loadSample();

describe("the first-screen sample", () => {
  it("is a verbatim page of the filing the question names", () => {
    expect(sample.doc).toBe("BESTBUY_2023_10K");
    expect(sample.page).toBe(SAMPLE_PAGE);
    expect(sample.full).toBe(pagesOf(sample.doc)[SAMPLE_PAGE - 1]);
    expect(sample.full).toContain("Total capital expenditures");
    expect(sample.label).toBe("Best Buy, 10-K 2023");
    expect(sample.citation).toMatch(/^Best Buy, 10-K 2023, page 30 \(https?:\/\//);
  });

  it("carries the rank, score and plain words that the search returns, run again here", () => {
    const corpus = new Corpus(filings.map((f) => ({ doc: f.doc, pages: pagesOf(f.doc) })));
    const resolution = new DocResolver(filings).resolve(SAMPLE_QUESTION);
    expect(resolution.docs).toEqual([sample.doc]);

    const hits = corpus.search(SAMPLE_QUESTION, 50, resolution.docs);
    const at = hits.findIndex((h) => h.doc === sample.doc && h.page === SAMPLE_PAGE);
    expect(sample.rank).toBe(at + 1);
    expect(sample.score).toBe(hits[at].score);

    const all = markTerms(SAMPLE_QUESTION);
    const { marked, left } = distinctTerms(all, corpus.termShare(all, resolution.docs));
    expect([...sample.terms].sort()).toEqual([...marked].sort());
    expect(sample.left).toEqual(left);

    expect(sample.facts.filings).toBe(filings.length);
    expect(sample.facts.pages).toBe(corpus.size);
    expect(sample.facts.companies).toEqual([...new Set(filings.map((f) => f.company))]);
  });

  it("shows the figures the share image was taken from", () => {
    // Pinned on purpose: a change here means retaking src/app/opengraph-image.png.
    expect(sample.rank).toBe(5);
    expect(sample.score.toFixed(1)).toBe("15.8");
    expect(sample.left).toEqual(["best", "buy", "fiscal", "2023"]);
  });

  it("marks only the question's own words, in the window the results would show", () => {
    const terms = new Set(sample.terms);
    const win = bestWindow(sample.full, terms);
    const marked = pieces(sample.full.slice(win.start, win.end), terms)
      .filter((p) => p.marked)
      .map((p) => p.text.toLowerCase());
    expect(marked.length).toBeGreaterThan(0);
    expect(marked.every((w) => terms.has(w))).toBe(true);
    expect(marked).toContain("capital");
    // "buy" is on most pages of the filing, so it is left plain.
    expect(marked).not.toContain("buy");
  });

  it("shows a verbatim slice that opens on the line of its first marked word", () => {
    const terms = new Set(sample.terms);
    const { start, end } = sample.view;
    expect(sample.view).toEqual(firstMarkView(sample.full, terms));
    const text = sample.full.slice(start, end);
    expect(start === 0 || sample.full[start - 1] === "\n").toBe(true);
    const firstLine = text.split("\n")[0];
    expect(pieces(firstLine, terms).some((p) => p.marked)).toBe(true);
    expect(text.length).toBeGreaterThan(400);
  });

  it("says a rank in words up to ten", () => {
    expect(ordinal(1)).toBe("first");
    expect(ordinal(5)).toBe("fifth");
    expect(ordinal(10)).toBe("tenth");
    expect(ordinal(11)).toBe("#11");
  });
});
