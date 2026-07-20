import { describe, expect, it } from "vitest";
import { bestWindow, distinctTerms, markTerms, pieces } from "./highlight";

describe("distinctTerms", () => {
  const terms = new Set(["best", "buy", "capital", "expenditure"]);
  const seen = (pages: number, share: Record<string, number>) => ({ pages, share: new Map(Object.entries(share)) });

  it("leaves plain the words found on most of the searched pages", () => {
    const out = distinctTerms(terms, seen(75, { best: 0.9, buy: 0.9, capital: 0.3, expenditure: 0.2 }));
    expect([...out.marked].sort()).toEqual(["capital", "expenditure"]);
    expect(out.left.sort()).toEqual(["best", "buy"]);
  });

  it("keeps every word when there are too few pages to judge by", () => {
    const out = distinctTerms(terms, seen(9, { best: 1, buy: 1, capital: 1, expenditure: 1 }));
    expect(out.marked).toBe(terms);
    expect(out.left).toEqual([]);
  });

  it("keeps every word rather than mark nothing", () => {
    const out = distinctTerms(terms, seen(75, { best: 0.9, buy: 0.9, capital: 0.9, expenditure: 0.9 }));
    expect(out.marked).toBe(terms);
    expect(out.left).toEqual([]);
  });
});

describe("markTerms", () => {
  it("does not mark the stray letter a possessive leaves behind", () => {
    expect([...markTerms("What was Best Buy's capital expenditure?")].sort()).toEqual(["best", "buy", "capital", "expenditure"]);
    expect(markTerms("Form 8 K and item 5").has("8")).toBe(true);
  });

  it("drops plain words and keeps the rest, with numbers normalised", () => {
    expect([...markTerms("What was the capital expenditure of 3M in 1,577 million?")].sort()).toEqual(
      ["1577", "3m", "capital", "expenditure", "million"].sort(),
    );
  });
});

describe("pieces", () => {
  it("marks only the words asked for and joins back to the original", () => {
    const text = "Revenue was $1,577 million; net income rose.";
    const out = pieces(text, new Set(["1577", "revenue"]));
    expect(out.filter((p) => p.marked).map((p) => p.text)).toEqual(["Revenue", "1,577"]);
    expect(out.map((p) => p.text).join("")).toBe(text);
  });

  it("returns the whole text when nothing matches, and nothing for no text", () => {
    expect(pieces("plain text", new Set(["zzz"]))).toEqual([{ text: "plain text", marked: false }]);
    expect(pieces("", new Set(["a"]))).toEqual([]);
  });

  it("marks words whatever their case", () => {
    expect(pieces("CAPEX Capex", new Set(["capex"])).filter((p) => p.marked)).toHaveLength(2);
  });
});

describe("bestWindow", () => {
  it("is the whole text when it is short", () => {
    expect(bestWindow("short", new Set(["short"]))).toEqual({ start: 0, end: 5 });
  });

  it("finds the stretch where the marked words cluster", () => {
    const text = `${"filler ".repeat(300)}\ncapital expenditure purchases of property\n${"filler ".repeat(300)}`;
    const w = bestWindow(text, new Set(["capital", "expenditure", "purchases", "property"]), 400);
    const shown = text.slice(w.start, w.end);
    expect(shown).toContain("capital expenditure purchases of property");
    expect(w.end - w.start).toBeLessThanOrEqual(400);
  });

  it("starts at the top of the page when no word matches", () => {
    expect(bestWindow("x".repeat(2000), new Set(["zzz"]), 500)).toEqual({ start: 0, end: 500 });
  });
});
