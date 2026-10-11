import { BM25, tokenize } from "./bm25";

export type PageHit = { doc: string; page: number; score: number };

export type FilingPages = { doc: string; pages: string[] };

/** The pages of the demo filings, searchable. Pages are numbered from 1, as in a PDF viewer. */
export class Corpus {
  private readonly pages: Array<{ doc: string; page: number; text: string }> = [];
  private readonly byDoc = new Map<string, Set<number>>();
  private readonly index = new Map<string, number>();
  private readonly bm25: BM25;

  constructor(filings: FilingPages[]) {
    for (const f of filings) {
      const ids = new Set<number>();
      f.pages.forEach((text, i) => {
        ids.add(this.pages.length);
        this.index.set(`${f.doc}\u0000${i + 1}`, this.pages.length);
        this.pages.push({ doc: f.doc, page: i + 1, text });
      });
      this.byDoc.set(f.doc, ids);
    }
    this.bm25 = new BM25(this.pages.map((p) => tokenize(p.text)));
  }

  get size(): number {
    return this.pages.length;
  }

  text(doc: string, page: number): string | null {
    const i = this.index.get(`${doc}\u0000${page}`);
    return i === undefined ? null : this.pages[i].text;
  }

  /** BM25 over every page, or only over the pages of the given filings. */
  search(query: string, k = 10, docs?: string[] | null): PageHit[] {
    let allowed: Set<number> | null = null;
    if (docs) {
      allowed = new Set<number>();
      for (const d of docs) for (const i of this.byDoc.get(d) ?? []) allowed.add(i);
      if (allowed.size === 0) return [];
    }
    return this.bm25
      .top(tokenize(query), k, allowed)
      .map(([i, score]) => ({ doc: this.pages[i].doc, page: this.pages[i].page, score }));
  }
}
