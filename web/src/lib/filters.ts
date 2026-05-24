// Which filings could a question be about? A port of pipeline/src/footnote/filters.py.
// It returns a candidate set. When the question names no company it returns every
// filing, so a miss makes the search wider, never wrong.

export type FilingInfo = { doc: string; company: string; period: number | string };

export type Resolution = {
  docs: string[];
  companies: string[];
  years: number[];
  narrowed: boolean;
};

// Nicknames a question may use instead of the company name. Written after seeing
// which FinanceBench questions the plain name match missed; see the Results page.
// A test checks this list against the one the Python side exports.
export const NICKNAMES: Record<string, string[]> = {
  "American Express": ["amex"],
  "Johnson & Johnson": ["jnj"],
  JPMorgan: ["jpm"],
  "MGM Resorts": ["mgm"],
  "Ulta Beauty": ["ulta"],
};

const YEAR = /\b(?:fy\s?)?((?:19|20)\d{2})\b/g;

/** Lower-case words separated by single spaces, padded so " alias " matches whole words. */
export function spaced(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

export class DocResolver {
  private readonly aliases = new Map<string, Set<string>>();
  readonly allDocs: string[];

  constructor(
    private readonly infos: FilingInfo[],
    nicknames: Record<string, string[]> = NICKNAMES,
  ) {
    this.allDocs = infos.map((i) => i.doc);
    for (const info of infos) {
      const prefix = info.doc.split("_")[0].toLowerCase();
      const names = this.aliases.get(info.company) ?? new Set<string>();
      names.add(spaced(info.company));
      names.add(` ${prefix} `);
      for (const n of nicknames[info.company] ?? []) names.add(` ${n} `);
      this.aliases.set(info.company, names);
    }
  }

  companiesIn(question: string): string[] {
    const q = spaced(question);
    return [...this.aliases]
      .filter(([, names]) => [...names].some((a) => q.includes(a)))
      .map(([company]) => company)
      .sort();
  }

  resolve(question: string): Resolution {
    const companies = this.companiesIn(question);
    const years = [...new Set([...question.toLowerCase().matchAll(YEAR)].map((m) => Number(m[1])))].sort((a, b) => a - b);
    if (companies.length === 0) return { docs: this.allDocs, companies: [], years, narrowed: false };
    let mine = this.infos.filter((i) => companies.includes(i.company));
    if (years.length) {
      const byYear = mine.filter((i) => years.includes(Number(i.period)));
      if (byYear.length) mine = byYear; // a year with no filing of ours must not empty the set
    }
    return { docs: mine.map((i) => i.doc), companies, years, narrowed: true };
  }
}
