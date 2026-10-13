import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { filingSchema, pagesSchema } from "./data";
import { buildSample, type Sample } from "./sample";

/** Reads the site's own data files from disk and builds the sample. Server only: the home page calls it at build. */
export function loadSample(root = process.cwd()): Sample {
  const read = (...parts: string[]): unknown => JSON.parse(readFileSync(join(root, "public", "data", ...parts), "utf-8"));
  const filings = z.array(filingSchema).parse(read("filings.json"));
  const pages = new Map(filings.map((f) => [f.doc, pagesSchema.parse(read("pages", `${f.doc}.json`)).pages]));
  return buildSample(filings, (doc) => pages.get(doc) ?? []);
}
