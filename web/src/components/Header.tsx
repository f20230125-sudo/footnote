"use client";

import { Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./theme";

/** A page with a small mark at its foot: the footnote. */
export function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
      <rect x="2" y="1.5" width="14" height="15" rx="2.5" fill="none" className="stroke-fg" strokeWidth="1.5" />
      <line x1="5" y1="6" x2="13" y2="6" className="stroke-faint" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5" y1="9" x2="11" y2="9" className="stroke-faint" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5" y1="13" x2="9" y2="13" className="stroke-accent" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const LINKS = [
  { href: "/", label: "Search" },
  { href: "/results", label: "Results" },
  { href: "/how", label: "How it works" },
];

export function Header() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1100px] items-center gap-2 px-3 sm:gap-6 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-md text-[15px] font-semibold tracking-tight sm:gap-2.5">
          <Logo />
          Footnote
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {LINKS.map((link) => {
            const current = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors sm:px-2.5 ${current ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <a
            href="https://github.com/f20230125-sudo/footnote"
            className="hidden rounded-lg px-2 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg sm:inline"
          >
            GitHub
          </a>
          <button
            type="button"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={toggleTheme}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </header>
  );
}
