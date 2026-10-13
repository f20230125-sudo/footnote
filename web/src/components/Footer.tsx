import Link from "next/link";

const link = "tlink inline-flex min-h-11 items-center hover:text-ink sm:min-h-8";

export function Footer() {
  return (
    <footer className="border-t border-rule bg-ground">
      <div className="mx-auto flex w-full max-w-[1128px] flex-col gap-3 px-5 py-8 text-[13.5px] leading-relaxed text-ink-2 sm:px-6">
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 font-semibold">
          <Link href="/" className={link}>
            Search
          </Link>
          <Link href="/results" className={link}>
            Results
          </Link>
          <Link href="/how" className={link}>
            How it works
          </Link>
          <a href="https://github.com/f20230125-sudo/footnote" className={link}>
            Code on GitHub
          </a>
        </nav>
        <p className="max-w-[78ch]">
          Filing text comes from the companies&rsquo; own public filings. The questions are from{" "}
          <a href="https://github.com/patronus-ai/financebench" className="tlink inline-block py-1.5 hover:text-ink">
            FinanceBench
          </a>{" "}
          (Patronus AI), used here to measure, not republished. This is an evaluation project, not investment advice, and the search can be wrong: check a
          figure on the page before relying on it.
        </p>
      </div>
    </footer>
  );
}
