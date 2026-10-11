import type { Filing } from "./data";

const TYPE_LABEL: Record<string, string> = { "10k": "10-K", "10q": "10-Q", "8k": "8-K", earnings: "Earnings" };

/** "Best Buy, 10-K 2023": the filing as a person would name it. */
export function filingLabel(f: Pick<Filing, "company" | "type" | "period">): string {
  return `${f.company}, ${TYPE_LABEL[f.type] ?? f.type} ${f.period}`;
}

/** The line to paste into a note: which filing, which page, where to read it. */
export function citation(f: Filing | undefined, doc: string, page: number): string {
  if (!f) return `${doc}, page ${page}`;
  return `${filingLabel(f)}, page ${page}${f.source ? ` (${f.source})` : ""}`;
}
