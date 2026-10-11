// BM25 over pages: the same tokeniser and the same arithmetic as
// pipeline/src/footnote/bm25.py, so a page that ranks first there ranks first
// here. tests/unit/parity.test.ts checks that against the Python output.
// Change both together.

const TOKEN = /[a-z0-9]+(?:[.,][0-9]+)*/g;
const K1 = 1.5;
const B = 0.75;

/** Lower-case words and numbers. "1,577" and "1577" are the same token. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const m of text.toLowerCase().matchAll(TOKEN)) {
    let tok = m[0];
    if (tok.charCodeAt(0) >= 48 && tok.charCodeAt(0) <= 57) tok = tok.replaceAll(",", "");
    out.push(tok);
  }
  return out;
}

export class BM25 {
  readonly n: number;
  private readonly lengths: number[];
  private readonly avg: number;
  private readonly postings = new Map<string, Array<[number, number]>>();

  constructor(docs: string[][]) {
    this.n = docs.length;
    this.lengths = docs.map((d) => d.length);
    this.avg = this.n ? this.lengths.reduce((a, b) => a + b, 0) / this.n : 0;
    docs.forEach((toks, i) => {
      const counts = new Map<string, number>();
      for (const t of toks) counts.set(t, (counts.get(t) ?? 0) + 1);
      for (const [term, tf] of counts) {
        const list = this.postings.get(term);
        if (list) list.push([i, tf]);
        else this.postings.set(term, [[i, tf]]);
      }
    });
  }

  private idf(term: string): number {
    const df = this.postings.get(term)?.length ?? 0;
    return Math.log(1 + (this.n - df + 0.5) / (df + 0.5));
  }

  /** How many documents contain the term (only counting the allowed ones, when given). Display only. */
  count(term: string, allowed?: Set<number> | null): number {
    const list = this.postings.get(term) ?? [];
    return allowed ? list.reduce((n, [i]) => n + (allowed.has(i) ? 1 : 0), 0) : list.length;
  }

  scores(query: string[], allowed?: Set<number> | null): Map<number, number> {
    const out = new Map<number, number>();
    // A fixed term order, as in Python, so the floating-point sums come out the same.
    for (const term of [...new Set(query)].sort()) {
      const idf = this.idf(term);
      for (const [i, tf] of this.postings.get(term) ?? []) {
        if (allowed && !allowed.has(i)) continue;
        const norm = tf + (K1 * (1 - B + (B * this.lengths[i]) / this.avg));
        out.set(i, (out.get(i) ?? 0) + (idf * tf * (K1 + 1)) / norm);
      }
    }
    return out;
  }

  top(query: string[], k: number, allowed?: Set<number> | null): Array<[number, number]> {
    return [...this.scores(query, allowed)].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, k);
  }
}
