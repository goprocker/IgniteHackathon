"use client";

import { useEffect, useState } from "react";

/**
 * Phase copy is decorative reassurance, not information: it is never announced
 * to screen readers (the polite live region already says "Finding proverbs…"),
 * and the whole block is `aria-hidden`.
 */
const PHASES = [
  "Reading your situation…",
  "Matching themes…",
  "Ranking proverbs…",
] as const;

const PHASE_INTERVAL_MS = 450;

export function ThinkingIndicator() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhase((current) => (current + 1) % PHASES.length);
    }, PHASE_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-3 rounded-[8px] border border-line bg-surface-raised px-4 py-3"
    >
      <span className="flex items-end gap-1">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="pz-dot block h-1.5 w-1.5 rounded-full bg-leaf"
            style={{ animationDelay: `${dot * 160}ms` }}
          />
        ))}
      </span>
      {/* Text carries the meaning; the dots only decorate it. */}
      <span className="text-sm text-ink-soft">{PHASES[phase]}</span>
    </div>
  );
}
