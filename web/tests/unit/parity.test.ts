import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tokenize } from "@/lib/bm25";
import { Corpus } from "@/lib/corpus";
import { filingSchema, pagesSchema, resultsSchema, exampleSchema } from "@/lib/data";
import { DocResolver, NICKNAMES, spaced } from "@/lib/filters";

// The browser search must rank pages exactly as the Python search does, since the
// Results page and the README quote the Python numbers. The expected values were
// written by `python -m footnote.site_export` from the same filings.

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => JSON.parse(readFileSync(join(ROOT, ...p), "utf-8"));

const filings = (read("public", "data", "filings.json") as unknown[]).map((f) => filingSchema.parse(f));
const corpus = new Corpus(filings.map((f) => pagesSchema.parse(read("public", "data", "pages", `${f.doc}.json`))));
const resolver = new DocResolver(filings.map((f) => ({ doc: f.doc, company: f.company, period: f.period })));

type Hit = { doc: string; page: number; score: number };
type Fixture = {
  query: string;
  tokens: string[];
  resolve: { docs: string[]; companies: string[]; years: number[]; narrowed: boolean };
  all: Hit[];
  filtered: Hit[];
};
const fixtures = read("tests", "fixtures", "parity.json") as Fixture[];

const pairs = (hits: Array<{ doc: string; page: number }>) => hits.map((h) => `${h.doc}#${h.page}`);

describe("the browser search matches the Python search", () => {
  it("has the filings and the fixtures it expects", () => {
    expect(filings).toHaveLength(7);
    expect(corpus.size).toBe(filings.reduce((n, f) => n + f.pages, 0));
    expect(fixtures.length).toBeGreaterThanOrEqual(37);
  });

  it("tokenises every query the same way", () => {
    for (const f of fixtures) expect(tokenize(f.query), f.query).toEqual(f.tokens);
  });

  it("resolves company and year the same way", () => {
    for (const f of fixtures) expect(resolver.resolve(f.query), f.query).toEqual(f.resolve);
  });

  it("ranks the same top 10 pages over every filing", () => {
    for (const f of fixtures) {
      const got = corpus.search(f.query, 10);
      expect(pairs(got), f.query).toEqual(pairs(f.all));
      got.forEach((h, i) => expect(Math.abs(h.score - f.all[i].score), f.query).toBeLessThan(2e-5));
    }
  });

  it("ranks the same top 10 pages inside the filings the filter allows", () => {
    for (const f of fixtures) {
      const got = corpus.search(f.query, 10, f.resolve.docs);
      expect(pairs(got), f.query).toEqual(pairs(f.filtered));
      got.forEach((h, i) => expect(Math.abs(h.score - f.filtered[i].score), f.query).toBeLessThan(2e-5));
    }
  });
});

describe("pieces of the port", () => {
  it("spaced pads and splits on punctuation", () => {
    expect(spaced("3M's capex, FY2018")).toBe(" 3m s capex fy2018 ");
  });

  it("numbers lose thousands commas but a sentence comma does not join numbers", () => {
    expect(tokenize("Capex was $1,577 million")).toEqual(["capex", "was", "1577", "million"]);
    expect(tokenize("in 2018, sales rose")).toEqual(["in", "2018", "sales", "rose"]);
    expect(tokenize("margin 12.5%")).toEqual(["margin", "12.5"]);
  });

  it("names match whole words only", () => {
    expect(resolver.companiesIn("about 13mm units of blockchain")).toEqual([]);
    expect(resolver.companiesIn("What was 3M's revenue?")).toEqual(["3M"]);
  });

  it("a year with no filing does not empty the set", () => {
    expect(resolver.resolve("What did 3M report in 1999?").docs).toEqual(["3M_2023Q2_10Q"]);
  });

  it("an unknown company means every filing, not narrowed", () => {
    const r = resolver.resolve("Who won the vote?");
    expect(r.narrowed).toBe(false);
    expect(r.docs).toHaveLength(7);
  });

  it("an empty search or an unknown filing finds nothing", () => {
    expect(corpus.search("", 5)).toEqual([]);
    expect(corpus.search("revenue", 5, ["NOPE"])).toEqual([]);
  });
});

describe("the exported files", () => {
  it("keep the nickname list in step with the Python filter", () => {
    const results = resultsSchema.parse(read("public", "data", "results.json"));
    expect(NICKNAMES).toEqual(results.filter.nicknames);
  });

  it("only list pages that exist, and examples whose gold page is in a demo filing", () => {
    const examples = (read("public", "data", "examples.json") as unknown[]).map((e) => exampleSchema.parse(e));
    expect(examples).toHaveLength(31);
    for (const e of examples) for (const g of e.gold) expect(corpus.text(g.doc, g.page), e.id).not.toBeNull();
  });

  it("have a pages file for every filing and nothing else", () => {
    expect(readdirSync(join(ROOT, "public", "data", "pages")).sort()).toEqual(filings.map((f) => `${f.doc}.json`).sort());
  });
});
