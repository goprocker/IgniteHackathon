import type { CSSProperties } from "react";

/**
 * No `sr-only` utility is configured in globals.css, so the clip technique is
 * written out here. `clip-path: inset(50%)` is the modern half; the legacy
 * `clip` rect is kept for older assistive-technology pairings.
 */
const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  borderWidth: 0,
};

interface LiveRegionProps {
  /** Non-urgent progress and confirmation copy. */
  status: string;
  /** Failures. Announced immediately, interrupting the polite queue. */
  error: string;
}

export function LiveRegion({ status, error }: LiveRegionProps) {
  return (
    <>
      <div style={visuallyHidden} aria-live="polite" aria-atomic="true">
        {status}
      </div>
      <div style={visuallyHidden} role="alert">
        {error}
      </div>
    </>
  );
}
