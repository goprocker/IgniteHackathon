interface KolamMarkProps {
  /** Rendered size in pixels. The motif is drawn on a 64-unit square grid. */
  size?: number;
  className?: string;
}

type Point = readonly [x: number, y: number];

/** Pulli sitting on the diamond's vertices, where the loops turn. */
const VERTEX_DOTS: readonly Point[] = [
  [32, 4],
  [60, 32],
  [32, 60],
  [4, 32],
];

/** Smaller pulli filling the corner gaps outside the diamond. */
const CORNER_DOTS: readonly Point[] = [
  [14, 14],
  [50, 14],
  [50, 50],
  [14, 50],
];

const CARDINAL_PETAL = "M32 32C24 27 24 17 32 12C40 17 40 27 32 32Z";
const DIAGONAL_PETAL = "M32 32C26 28 26 21 32 18C38 21 38 28 32 32Z";

/**
 * A pulli kolam motif: eight looping petals turning inside a diamond, with the
 * pulli (dots) the loops are traditionally drawn around.
 *
 * Hand-authored rather than imported so the stroke weight stays optically
 * matched to the type, and so it inherits `currentColor` in both themes.
 */
export function KolamMark({ size = 48, className }: KolamMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <g
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M32 4L60 32L32 60L4 32Z" opacity="0.45" />

        {[0, 90, 180, 270].map((angle) => (
          <path
            key={`cardinal-${angle}`}
            d={CARDINAL_PETAL}
            transform={`rotate(${angle} 32 32)`}
          />
        ))}

        {[45, 135, 225, 315].map((angle) => (
          <path
            key={`diagonal-${angle}`}
            d={DIAGONAL_PETAL}
            transform={`rotate(${angle} 32 32)`}
            opacity="0.7"
          />
        ))}
      </g>

      <g fill="currentColor">
        {VERTEX_DOTS.map(([cx, cy]) => (
          <circle key={`vertex-${cx}-${cy}`} cx={cx} cy={cy} r="2" />
        ))}

        {CORNER_DOTS.map(([cx, cy]) => (
          <circle
            key={`corner-${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r="1.5"
            opacity="0.55"
          />
        ))}
      </g>
    </svg>
  );
}
