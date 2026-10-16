import raw from "../../public/data/live-evaluation.json";
import { z } from "zod";

const interval = z.array(z.number()).length(2);
const schema = z.object({
  complete: z.boolean(),
  updated: z.string(),
  answerModels: z.array(z.string()),
  judgeModels: z.array(z.string()),
  manifest: z.object({
    questionIds: z.array(z.string()),
    filings: z.number(),
    pages: z.number(),
  }),
  summary: z.record(
    z.string(),
    z.object({
      n: z.number(),
      correct: z.number(),
      accuracy: z.number(),
      accuracy95: interval,
      refused: z.number(),
      unjudged: z.number(),
      medianAnswerSeconds: z.number(),
      meanAnswerTokens: z.number(),
      apiEquivalentUsdIncludingJudge: z.number(),
      answersWithCheckedQuotes: z.number(),
      allQuotesPresent: z.number(),
    }),
  ),
  paired: z.object({
    n: z.number(),
    accuracyDifference: z.number(),
    difference95: interval,
  }),
  limits: z.array(z.string()),
  pairedQuestionTypes: z.record(z.string(), z.number()).optional(),
});
const data = schema.parse(raw);
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

export function LiveResults() {
  return (
    <section aria-labelledby="live-heading" className="space-y-4">
      <div className="footnote-rule" />
      <h2 id="live-heading" className="h2">
        Real-model answers: retrieval versus the agent
      </h2>
      <p className="prose-text text-ink-2">
        {data.complete ? "Completed" : "Partial"} evaluation: {data.paired.n}{" "}
        completed pairs from a planned stratified sample of{" "}
        {data.manifest.questionIds.length} FinanceBench questions, searching{" "}
        {data.manifest.filings} filings. C1 receives the top five keyword-search
        pages. C5 can search, read pages and calculate before answering, with
        citation checks enforced.
      </p>
      <div
        className="overflow-x-auto"
        role="region"
        aria-label="Real-model results table"
        tabIndex={0}
      >
        <table className="w-full text-sm">
          <caption className="sr-only">Real-model evaluation results</caption>
          <thead>
            <tr>
              {[
                "Configuration",
                "Questions",
                "Correct",
                "95% interval",
                "Refused",
                "Median answer time",
              ].map((s) => (
                <th key={s} className="p-2 text-left">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.summary).map(([id, s]) => (
              <tr key={id} className="border-t border-rule">
                <th className="p-2 text-left">
                  {id === "C1" ? "C1 · basic retrieval" : "C5 · agent"}
                </th>
                <td className="p-2">{s.n}</td>
                <td className="p-2">
                  {s.correct} ({pct(s.accuracy)})
                </td>
                <td className="p-2">{s.accuracy95.map(pct).join(" to ")}</td>
                <td className="p-2">{s.refused}</td>
                <td className="p-2">{s.medianAnswerSeconds.toFixed(1)} s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="prose-text">
        Agent minus basic retrieval:{" "}
        {(100 * data.paired.accuracyDifference).toFixed(1)} percentage points
        across {data.paired.n} paired questions; 95% paired bootstrap interval{" "}
        {data.paired.difference95.map((v) => (100 * v).toFixed(1)).join(" to ")}{" "}
        points.
        {data.paired.difference95[0] <= 0 && data.paired.difference95[1] >= 0
          ? " This sample does not establish an improvement."
          : ""}
      </p>
      <p className="text-sm text-ink-2">
        Answer model: {data.answerModels.join(", ")}. Judge:{" "}
        {data.judgeModels.join(", ")}. Refusals count as unsuccessful answers.
        Unjudged answers remain visible in the downloadable metrics. Completed
        pairs by question type:{" "}
        {Object.entries(data.pairedQuestionTypes ?? {})
          .map(([name, n]) => `${name}: ${n}`)
          .join("; ")}
        .
      </p>
      <details>
        <summary>Quote checks, usage and evaluation limits</summary>
        <ul className="space-y-2 mt-3">
          {Object.entries(data.summary).map(([id, s]) => (
            <li key={id}>
              {id}: all quotes found for {s.allQuotesPresent} of{" "}
              {s.answersWithCheckedQuotes} non-refused answers with checked
              citations; {s.meanAnswerTokens.toFixed(0)} mean answer tokens; $
              {s.apiEquivalentUsdIncludingJudge.toFixed(3)} API-equivalent
              estimate including judging.
            </li>
          ))}
          {data.limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </details>
      <a href="/data/live-evaluation.json" className="tlink">
        Download the manifest and per-question scores
      </a>
    </section>
  );
}
