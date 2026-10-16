import type { Metadata } from "next";
import Link from "next/link";
import examples from "../../../public/data/examples.json";
import filings from "../../../public/data/filings.json";
import results from "../../../public/data/results.json";

export const metadata: Metadata = {
  title: "How it works",
  description: "What each part of Footnote does, and which parts have been measured, tested against stand-ins, or not run at all.",
};

type State = "measured" | "checked" | "tested" | "standin" | "notrun" | "live";

// The words carry the meaning; the drawn square is only a marker (filled, half, hollow), so colour never says it.
const STATE: Record<State, { label: string; square: "full" | "half" | "none" }> = {
  live: { label: 'Evaluated with real models on a fixed sample', square: 'full' },
  measured: { label: `Measured on all ${results.questions} questions`, square: "full" },
  checked: { label: "Checked against the real filings", square: "full" },
  tested: { label: "Unit-tested, including refusals", square: "full" },
  standin: { label: "Tested with a stand-in model only", square: "half" },
  notrun: { label: "Built, not run", square: "none" },
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
    state: "live",
  },
  {
    name: "Calculator",
    what: "Ratios and changes go through a calculator that parses arithmetic and nothing else: no eval, no names, no function calls beyond abs, round, min and max.",
    state: "tested",
  },
  {
    name: "Agent",
    what: "Searches, reads a page, calculates, and finishes, within a budget of six tool calls. Rebuilds a compact prompt each turn so each call fits a free tier's per-minute limit.",
    state: "live",
  },
  {
    name: "Judge",
    what: "A second model compares an answer with FinanceBench's reference answer, cross-checked by a rule that compares a single reference number.",
    state: "live",
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

const STEPS: Array<{ step: string; run: boolean }> = [
  { step: "Question", run: true },
  { step: "Filter by company and year", run: true },
  { step: "Rank pages", run: true },
  { step: "Answer with citations", run: false },
  { step: "Check the citations", run: false },
];

// What this site ships, counted from the files it ships.
const SHIPPED_FILINGS = filings.length;
const SHIPPED_PAGES = filings.reduce((n, f) => n + f.pages, 0);
const SHIPPED_QUESTIONS = examples.length;

export default function How() {
  return (
    <div className="notes-layout">
      <div className="nl-intro">
        <h1 className="h1">How it works</h1>
        <p className="dek mt-4 max-w-[72ch]">
          Footnote answers questions about company filings and shows the page behind every figure. The project is a measurement as much as a tool: each part is
          added one at a time and scored against the same {results.questions} questions from FinanceBench, whose own README reports that GPT-4-Turbo with
          retrieval answered 81% of them wrongly or refused. Retrieval is measured on all questions; generated answers are evaluated on a fixed sample.
        </p>
      </div>
      <div className="nl-limits note">
        <p>
          <strong>Stand-in.</strong> &ldquo;Stand-in&rdquo; means the code runs end to end in tests against a scripted fake of the model, which proves the plumbing
          and the rules but not how a real model behaves with these prompts. Nothing has been run against Gemini or Groq yet.
        </p>
      </div>

      <div className="nl-body space-y-12">
        <section aria-labelledby="short-heading" className="space-y-4">
          <h2 id="short-heading" className="h2">
            In short
          </h2>
          <div className="prose-text space-y-3">
            <p>
              <strong className="run-in">What it is.</strong> A tool for checking a number in a company&rsquo;s filing. You ask a question; it shows the pages
              most likely to hold the answer, so you can read the figure at its source.
            </p>
            <p>
              <strong className="run-in">What works today.</strong> Finding pages, in your browser, for {SHIPPED_FILINGS} filings. It has been scored on all{" "}
              {results.questions} FinanceBench questions (see{" "}
              <Link href="/results" className="tlink font-semibold">
                Results
              </Link>
              ).
            </p>
            <p>
              <strong className="run-in">Generated answers.</strong> A separate offline evaluation compares basic retrieval with the agent using real models.
              The Results page includes the sample size, errors, refusals and uncertainty. This browser interface continues to show source pages.
            </p>
          </div>
          <p>
            <Link href="/" className="btn-primary sm:w-auto">
              Try the search
            </Link>
          </p>
        </section>

        <section aria-labelledby="flow-heading" className="space-y-4">
          <h2 id="flow-heading" className="h2">
            The path of a question
          </h2>
          <ol className="path">
            {STEPS.map(({ step, run }) => (
              <li key={step} data-run={run ? "yes" : "no"}>
                <span aria-hidden="true" className="state-sq" data-s={run ? "full" : "none"} />
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="prose-text text-ink-2">
            The demo on the{" "}
            <Link href="/" className="tlink inline-block py-1 font-semibold text-ink">
              Search
            </Link>{" "}
            page does steps 1 to 3, the filled stops. Steps 4 and 5, the hollow ones, need a language model.
          </p>
        </section>

        <section aria-labelledby="parts-heading" className="space-y-3">
          <h2 id="parts-heading" className="h2">
            Each part, and how far it has been checked
          </h2>
          <p className="text-[13px] text-ink-3 sm:hidden">The table is wider than the screen: swipe it sideways to read every column.</p>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Parts of Footnote and their state; scrolls sideways">
            <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
              <caption className="sr-only">The parts of Footnote, what each does, and its state.</caption>
              <thead>
                <tr className="border-b-2 border-ink text-[13px]">
                  <th scope="col" className="py-3 pr-4 font-bold">
                    Part
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    What it does
                  </th>
                  <th scope="col" className="min-w-[12rem] py-3 pl-4 font-bold">
                    State
                  </th>
                </tr>
              </thead>
              <tbody>
                {PARTS.map((p) => (
                  <tr key={p.name} className="border-b border-rule align-top">
                    <th scope="row" className="py-3 pr-4 font-bold">
                      {p.name}
                    </th>
                    <td className="px-4 py-3 leading-relaxed text-ink-2">{p.what}</td>
                    <td className="py-3 pl-4">
                      <span className="inline-flex items-start gap-2 font-semibold leading-snug">
                        <span aria-hidden="true" className="state-sq mt-[3px]" data-s={STATE[p.state].square} />
                        {STATE[p.state].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="choices-heading" className="space-y-4">
          <div className="footnote-rule" />
          <h2 id="choices-heading" className="h2">
            Choices and limits
          </h2>
          <div className="prose-text space-y-3 text-ink-2">
            <p>
              <strong className="run-in">Free hosted models only.</strong> Gemini and Groq free tiers, no card, nothing that can bill anyone. Their daily limits
              decide how many questions can be answered, so every result will state its sample size.
            </p>
            <p>
              <strong className="run-in">What this site ships.</strong> The text of {SHIPPED_FILINGS} filings ({SHIPPED_PAGES} pages), published by the
              companies themselves (each card links to its filing), and {SHIPPED_QUESTIONS} benchmark questions with the page FinanceBench points to. It does not
              ship FinanceBench&rsquo;s reference answers or evidence text: the benchmark states no licence, so it is used to evaluate and not redistributed.
            </p>
            <p>
              <strong className="run-in">Not covered.</strong> Fine-tuning, local models, a hosted vector database, multi-agent setups.
            </p>
          </div>
          <p className="text-[14px] text-ink-2">
            Code, tests and the full write-up:{" "}
            <a href="https://github.com/f20230125-sudo/footnote" className="tlink inline-block py-1 font-semibold text-ink">
              github.com/f20230125-sudo/footnote
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
