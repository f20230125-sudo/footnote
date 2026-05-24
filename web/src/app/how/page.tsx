import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works",
  description: "What each part of Footnote does, and which parts have been measured, tested against stand-ins, or not run at all.",
};

type State = "measured" | "checked" | "tested" | "standin" | "notrun";

// The words carry the meaning; the dot is only a marker, so colour alone never says it.
const STATE: Record<State, { label: string; dot: string }> = {
  measured: { label: "Measured on all 150 questions", dot: "bg-ok" },
  checked: { label: "Checked against the real filings", dot: "bg-ok" },
  tested: { label: "Unit-tested, including refusals", dot: "bg-ok" },
  standin: { label: "Tested with a stand-in model only", dot: "bg-warn" },
  notrun: { label: "Built, not run", dot: "bg-warn" },
};

const PARTS: Array<{ name: string; what: string; state: State }> = [
  {
    name: "Reading the pages",
    what: "Turns each filing's PDF into numbered pages. FinanceBench counts pages from 0; this was measured on all 183 evidence records, not assumed.",
    state: "checked",
  },
  {
    name: "Keyword search (BM25)",
    what: "Ranks pages by how well they match the question's words. This site runs a TypeScript port that a test holds to the Python ranking, page for page.",
    state: "measured",
  },
  {
    name: "Company and year filter",
    what: "Reads the company and year in the question and searches only the filings that fit. Rules, no model.",
    state: "measured",
  },
  {
    name: "Embedding rerank",
    what: "Re-orders BM25's top 50 pages by meaning, using Gemini's free embeddings, and fuses the two rankings.",
    state: "standin",
  },
  {
    name: "Typed, cited answers",
    what: "A model must answer as structured data with a page and an exact quote for every figure. A rule checks each quote really appears on that page; an answer that fails gets one retry, then becomes a refusal.",
    state: "standin",
  },
  {
    name: "Calculator",
    what: "Ratios and changes go through a calculator that parses arithmetic and nothing else: no eval, no names, no function calls beyond abs, round, min and max.",
    state: "tested",
  },
  {
    name: "Agent",
    what: "Searches, reads a page, calculates, and finishes, within a budget of six tool calls. Rebuilds a compact prompt each turn so each call fits a free tier's per-minute limit.",
    state: "standin",
  },
  {
    name: "Judge",
    what: "A second model compares an answer with FinanceBench's reference answer, cross-checked by a rule that compares a single reference number.",
    state: "notrun",
  },
  {
    name: "Free-tier budgeting",
    what: "Every model call is cached; per-minute limits are waited out; a spent daily limit moves to the next model or stops the run to resume tomorrow.",
    state: "standin",
  },
  {
    name: "MCP server",
    what: "The same four tools (list filings, search, get a page, calculate) for Claude Desktop or Claude Code, run as a real subprocess against the real filings.",
    state: "checked",
  },
];

export default function How() {
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h1>
        <p className="max-w-[70ch] text-[15px] leading-relaxed text-muted">
          Footnote answers questions about company filings and shows the page behind every figure. The project is a measurement as much as a tool: each
          part is added one at a time and scored against the same {150} questions from FinanceBench, whose own README reports that GPT-4-Turbo with retrieval
          answered 81% of them wrongly or refused. Right now only the first three parts have numbers.
        </p>
      </section>

      <section aria-labelledby="flow-heading" className="space-y-3">
        <h2 id="flow-heading" className="text-lg font-semibold tracking-tight">
          The path of a question
        </h2>
        <ol className="grid gap-3 sm:grid-cols-5">
          {["Question", "Filter by company and year", "Rank pages", "Answer with citations", "Check the citations"].map((step, i) => (
            <li key={step} className="panel flex items-start gap-2 p-3 text-[13px] font-medium leading-snug">
              <span aria-hidden="true" className="tabular mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] text-muted">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <p className="max-w-[70ch] text-[13px] text-muted">
          The demo on the <Link href="/" className="font-medium text-accent underline underline-offset-2">Search</Link> page does steps 1 to 3. Steps 4 and 5
          need a language model.
        </p>
      </section>

      <section aria-labelledby="parts-heading" className="space-y-3">
        <h2 id="parts-heading" className="text-lg font-semibold tracking-tight">
          Each part, and how far it has been checked
        </h2>
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-[13.5px]">
            <caption className="sr-only">The parts of Footnote, what each does, and its state.</caption>
            <thead>
              <tr className="border-b border-line text-[12px] text-faint">
                <th scope="col" className="px-4 py-3 font-medium">
                  Part
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  What it does
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  State
                </th>
              </tr>
            </thead>
            <tbody>
              {PARTS.map((p) => (
                <tr key={p.name} className="border-b border-line align-top last:border-0">
                  <th scope="row" className="px-4 py-3 font-semibold">
                    {p.name}
                  </th>
                  <td className="px-4 py-3 leading-relaxed text-muted">{p.what}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-fg">
                      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${STATE[p.state].dot}`} />
                      {STATE[p.state].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="max-w-[72ch] text-[13px] leading-relaxed text-muted">
          &ldquo;Stand-in&rdquo; means the code runs end to end in tests against a scripted fake of the model, which proves the plumbing and the rules but
          not how a real model behaves with these prompts. Nothing has been run against Gemini or Groq yet.
        </p>
      </section>

      <section aria-labelledby="choices-heading" className="space-y-3">
        <h2 id="choices-heading" className="text-lg font-semibold tracking-tight">
          Choices and limits
        </h2>
        <ul className="max-w-[72ch] list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-muted marker:text-faint">
          <li>
            <strong className="font-semibold text-fg">Free hosted models only.</strong> Gemini and Groq free tiers, no card, nothing that can bill anyone. Their
            daily limits decide how many questions can be answered, so every result will state its sample size.
          </li>
          <li>
            <strong className="font-semibold text-fg">What this site ships.</strong> The text of 7 filings (670 pages), published by the companies themselves
            (each card links to its filing), and 31 benchmark questions with the page FinanceBench points to. It does not ship FinanceBench&rsquo;s reference
            answers or evidence text: the benchmark states no licence, so it is used to evaluate and not redistributed.
          </li>
          <li>
            <strong className="font-semibold text-fg">Not covered:</strong> fine-tuning, local models, a hosted vector database, multi-agent setups.
          </li>
        </ul>
        <p className="text-[13px] text-muted">
          Code, tests and the full write-up:{" "}
          <a href="https://github.com/f20230125-sudo/footnote" className="font-medium text-accent underline underline-offset-2">
            github.com/f20230125-sudo/footnote
          </a>
          .
        </p>
      </section>
    </div>
  );
}
