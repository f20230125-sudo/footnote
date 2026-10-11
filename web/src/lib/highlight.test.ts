import { describe, expect, it } from "vitest";
import { bestWindow, markTerms, pieces } from "./highlight";

describe("markTerms", () => {
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
