"use client";

import { Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./theme";

/** A page with a short rule at its foot: the footnote. The foot line is the marker's pink. */
export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
      <rect x="4" y="2.5" width="12" height="15" fill="none" className="stroke-ink" strokeWidth="1.5" />
      <line x1="7" y1="6.5" x2="13" y2="6.5" className="stroke-ink-3" strokeWidth="1.5" />
      <line x1="7" y1="9.5" x2="11.5" y2="9.5" className="stroke-ink-3" strokeWidth="1.5" />
      <line x1="7" y1="13.5" x2="11" y2="13.5" className="stroke-mark" strokeWidth="2.5" />
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
    <header className="sticky top-0 z-30 border-b border-rule bg-ground">
      <div className="mx-auto flex h-14 w-full max-w-[1128px] items-center gap-1 px-4 sm:gap-8 sm:px-6">
        <Link href="/" className="flex h-11 items-center gap-2 text-[16px] font-extrabold tracking-tight">
          <Logo />
          Footnote
        </Link>
        <nav aria-label="Main" className="flex h-full items-stretch gap-0.5 sm:gap-3">
          {LINKS.map((link) => {
            const current = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`-mb-px inline-flex items-center whitespace-nowrap border-b-2 px-1.5 text-[13.5px] transition-colors duration-150 ease-out sm:px-2 sm:text-[14px] ${current ? "border-ink font-bold text-ink" : "border-transparent font-medium text-ink-2 hover:text-ink"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <a
            href="https://github.com/f20230125-sudo/footnote"
            className="tlink hidden min-h-9 items-center px-2 text-[14px] font-medium text-ink-2 hover:text-ink sm:inline-flex"
          >
            GitHub
          </a>
          <button
            type="button"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-field text-ink-2 transition-colors duration-150 ease-out hover:bg-leaf-2 hover:text-ink"
          >
            {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
