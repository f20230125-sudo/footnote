import { describe, expect, it } from "vitest";
import { readSearch, writeSearch } from "./urlState";

const DOCS = ["AMD_2022_10K", "BESTBUY_2023_10K"];

describe("readSearch", () => {
  it("reads a question, a filing and the filter switch", () => {
    expect(readSearch("?q=AMD+revenue&in=AMD_2022_10K&filter=off", DOCS)).toEqual({ q: "AMD revenue", scope: "AMD_2022_10K", narrow: false });
  });

  it("falls back to the defaults for anything missing or unknown", () => {
    expect(readSearch("", DOCS)).toEqual({ q: "", scope: "all", narrow: true });
    expect(readSearch("?q=x&in=NOT_A_FILING", DOCS).scope).toBe("all");
    expect(readSearch("?filter=maybe", DOCS).narrow).toBe(true);
  });

  it("trims the question and cuts one that is absurdly long", () => {
    expect(readSearch("?q=%20%20hello%20", DOCS).q).toBe("hello");
    expect(readSearch(`?q=${"a".repeat(5000)}`, DOCS).q).toHaveLength(400);
  });
});

describe("writeSearch", () => {
  it("writes nothing for an empty question, and only what differs from the defaults", () => {
    expect(writeSearch({ q: "  ", scope: "all", narrow: true })).toBe("");
    expect(writeSearch({ q: "AMD revenue", scope: "all", narrow: true })).toBe("q=AMD+revenue");
    expect(writeSearch({ q: "AMD revenue", scope: "AMD_2022_10K", narrow: false })).toBe("q=AMD+revenue&in=AMD_2022_10K&filter=off");
  });

  it("round-trips, including characters that need escaping", () => {
    const state = { q: "What's R&D spend in 2022? 50% up", scope: "BESTBUY_2023_10K", narrow: false };
    expect(readSearch(`?${writeSearch(state)}`, DOCS)).toEqual(state);
  });
});
