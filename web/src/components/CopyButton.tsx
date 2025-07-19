"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "done" | "failed";

/** Copies `text` to the clipboard and says so, in words (for a screen reader) and in the label. */
export function CopyButton({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    let next: Phase = "done";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      next = "failed"; // no clipboard permission, or an insecure context
    }
    setPhase(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPhase("idle"), 2200);
  };

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg ${className}`}
      >
        {phase === "done" ? <Check size={13} aria-hidden="true" className="text-ok" /> : <Copy size={13} aria-hidden="true" />}
        {phase === "done" ? "Copied" : phase === "failed" ? "Could not copy" : label}
      </button>
      <span role="status" className="sr-only">
        {phase === "done" ? "Copied to the clipboard." : phase === "failed" ? "Could not copy to the clipboard." : ""}
      </span>
    </>
  );
}
