import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * `label` is required rather than optional: every button in this app renders an
 * SVG glyph only, so without it the accessible name would be empty.
 */
interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  label: string;
  title?: string;
  children: ReactNode;
}

export function IconButton({
  label,
  title,
  className,
  type = "button",
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={title ?? label}
      className={[
        "inline-flex items-center justify-center rounded-[6px] text-ink-soft",
        "transition-colors hover:bg-surface-sunken hover:text-ink",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
