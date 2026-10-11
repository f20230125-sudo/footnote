import type { Metadata } from "next";
import { ResultsView } from "@/components/ResultsView";
import { resultsSchema } from "@/lib/data";
import raw from "../../../public/data/results.json";

export const metadata: Metadata = {
  title: "Results",
  description: "How often plain keyword search finds the page FinanceBench marks as evidence, with and without a company and year filter.",
};

// Read at build time and checked, so a results file that does not match fails the
// build instead of drawing a chart of nothing.
const results = resultsSchema.parse(raw);

export default function ResultsPage() {
  return <ResultsView results={results} />;
}
