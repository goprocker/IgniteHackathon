"use client";

import { KolamMark } from "@/components/chat/kolam-mark";

interface Example {
  /** `true` when the text is Tamil script and needs the `.tamil` metrics. */
  tamil: boolean;
  text: string;
}

/**
 * Deliberately spans all three input modes the recommender accepts, so the
 * first thing a user sees tells them Tanglish is welcome.
 */
const EXAMPLES: readonly Example[] = [
  {
    tamil: false,
    text: "My manager keeps taking credit for work my team did",
  },
  {
    tamil: true,
    text: "நண்பன் கடன் வாங்கிவிட்டு பேசுவதையே நிறுத்திவிட்டான்",
  },
  {
    tamil: false,
    text: "Interview la romba nervous ah irukken, enna panrathunu theriyala",
  },
  {
    tamil: false,
    text: "I start a new side project every month and finish none of them",
  },
];

interface EmptyStateProps {
  onPick: (text: string) => void;
  disabled: boolean;
}

export function EmptyState({ onPick, disabled }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-1 py-10 text-center sm:py-16">
      <KolamMark size={56} className="text-leaf" />

      <h1 className="tamil mt-5 text-2xl text-ink">வணக்கம்</h1>
      <p className="mt-1 text-lg font-medium tracking-tight text-ink">
        What are you working through?
      </p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
        Describe the situation in Tamil, English, or Tanglish. You will get
        three curated Tamil proverbs that speak to it — never invented, always
        sourced.
      </p>

      <ul className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
        {EXAMPLES.map((example) => (
          <li key={example.text} className="flex">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onPick(example.text);
              }}
              className={[
                "w-full rounded-[8px] border border-line bg-surface-raised px-3.5 py-3",
                "text-left text-sm leading-relaxed text-ink-soft transition-colors",
                "hover:border-line-strong hover:text-ink",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf",
                "disabled:cursor-not-allowed disabled:opacity-50",
                example.tamil ? "tamil" : "",
              ].join(" ")}
            >
              {example.text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
