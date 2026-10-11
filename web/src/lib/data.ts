import { z } from "zod";

// The files the page loads. They are written by pipeline/src/footnote/site_export.py
// and checked here anyway: a file that does not match is an error shown to the
// visitor, not a page that quietly shows nothing.

export const filingSchema = z.object({
  doc: z.string(),
  company: z.string(),
  period: z.union([z.number(), z.string()]),
  type: z.string(),
  pages: z.number().int().positive(),
  source: z.string(),
});
export type Filing = z.infer<typeof filingSchema>;

const rankSchema = z.number().int().positive().nullable();

export const exampleSchema = z.object({
  id: z.string(),
  question: z.string(),
  type: z.string(),
  company: z.string(),
  doc: z.string(),
  gold: z.array(z.object({ doc: z.string(), page: z.number().int().positive() })),
  /** Where the gold page ranked in the demo corpus (null: not in the first 50). */
  rank: z.object({ oracle: rankSchema, filtered: rankSchema, all: rankSchema }),
});
export type Example = z.infer<typeof exampleSchema>;

export const pagesSchema = z.object({ doc: z.string(), pages: z.array(z.string()) });

const table = z.object({
  n: z.number(),
  hit: z.record(z.string(), z.number()),
  allEvidence: z.record(z.string(), z.number()),
  docHit: z.record(z.string(), z.number()),
  mrr: z.number(),
});
const settings = z.object({ oracle: table, full: table, filtered: table });
export type Settings = z.infer<typeof settings>;
export type Table = z.infer<typeof table>;

export const resultsSchema = z.object({
  corpus: z.object({ filings: z.number(), pages: z.number() }),
  questions: z.number(),
  ks: z.array(z.number()),
  overall: settings,
  byType: z.record(z.string(), settings),
  filter: z.object({
    keptRightFiling: z.number(),
    recognised: z.number(),
    recognisedWithoutNicknames: z.number(),
    candidatesWhenRecognised: z.number(),
    namingAYear: z.number(),
    moreThanOneCandidate: z.number(),
    rightFilingAloneWins: z.number(),
    ofThoseCrowdedOut: z.number(),
    nicknames: z.record(z.string(), z.array(z.string())),
    lost: z.array(z.object({ id: z.string(), doc: z.string(), companies: z.array(z.string()), years: z.array(z.number()) })),
  }),
});
export type Results = z.infer<typeof resultsSchema>;

async function getJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status}).`);
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw new Error(`${url} is not in the shape this page expects.`);
  return parsed.data;
}

export const loadFilings = () => getJson("/data/filings.json", z.array(filingSchema));
export const loadExamples = () => getJson("/data/examples.json", z.array(exampleSchema));
export const loadResults = () => getJson("/data/results.json", resultsSchema);
export const loadPages = (doc: string) => getJson(`/data/pages/${encodeURIComponent(doc)}.json`, pagesSchema);
