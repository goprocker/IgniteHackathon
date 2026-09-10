"use client";

import { useState } from "react";

import { IconButton } from "@/components/ui/icon-button";
import type { Recommendation } from "@/lib/types";

export type FeedbackValue = "up" | "down";

interface ProverbCardProps {
  recommendation: Recommendation;
  /** Position in the result list, used only for the stagger. */
  index: number;
  onCopied?: () => void;
  onFeedback?: (proverbId: string, value: FeedbackValue | null) => void;
}

/** Milliseconds of delay added per card so the three results arrive in order. */
const STAGGER_STEP_MS = 80;

function CopyIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

function ThumbUpIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M7 21V10l4.5-7A2.2 2.2 0 0 1 14 5.4L13 10h4.9a2 2 0 0 1 2 2.4l-1.3 6.4a2.4 2.4 0 0 1-2.3 1.9H7Z" />
      <path d="M7 10H3.6v11H7" />
    </svg>
  );
}

function ThumbDownIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17 3v11l-4.5 7A2.2 2.2 0 0 1 10 19.6L11 15H6.1a2 2 0 0 1-2-2.4l1.3-6.4A2.4 2.4 0 0 1 7.7 4.3H17Z" />
      <path d="M17 14h3.4V3H17" />
    </svg>
  );
}

export function ProverbCard({
  recommendation,
  index,
  onCopied,
  onFeedback,
}: ProverbCardProps) {
  const [feedback, setFeedback] = useState<FeedbackValue | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function handleCopy() {
    const payload = [
      recommendation.proverbTamil,
      recommendation.transliteration,
      recommendation.englishMeaning,
    ].join(" — ");

    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setCopyFailed(false);
      onCopied?.();
      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      // Clipboard access is denied in insecure contexts and some embedded
      // webviews; the card stays usable, the user just copies by hand.
      setCopyFailed(true);
    }
  }

  function handleFeedback(value: FeedbackValue) {
    const next = feedback === value ? null : value;
    setFeedback(next);
    onFeedback?.(recommendation.id, next);
  }

  return (
    <article
      className="pz-rise rounded-[8px] border border-line bg-surface-raised p-4 sm:p-5"
      style={{ animationDelay: `${index * STAGGER_STEP_MS}ms` }}
    >
      <p className="tamil text-lg text-ink sm:text-xl">
        {recommendation.proverbTamil}
      </p>
      <p className="mt-1 text-sm italic text-ink-soft">
        {recommendation.transliteration}
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-ink">
        {recommendation.englishMeaning}
      </p>

      <div className="mt-4 rounded-[6px] border border-line bg-surface-sunken px-3 py-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Why this fits
        </h4>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          {recommendation.contextualFitEnglish}
        </p>
        <p className="tamil mt-1.5 text-sm text-ink-soft">
          {recommendation.contextualFitTamil}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="rounded-full border border-leaf/30 bg-leaf/10 px-2.5 py-0.5 text-xs text-leaf">
          {recommendation.theme}
        </span>

        {/* Confidence is never colour-only: the number is the primary signal
            and the bar is a redundant, decorative echo of it. */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-faint">Confidence</span>
          <span className="text-xs font-medium tabular-nums text-ink">
            {recommendation.confidence}%
          </span>
          <span
            aria-hidden="true"
            className="h-1.5 w-16 overflow-hidden rounded-full bg-line"
          >
            <span
              className="block h-full rounded-full bg-leaf"
              style={{ width: `${recommendation.confidence}%` }}
            />
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {copyFailed ? (
            <span className="mr-1 text-xs text-clay">Copy unavailable</span>
          ) : copied ? (
            <span className="mr-1 text-xs text-leaf">Copied</span>
          ) : null}
          <IconButton
            label={`Copy "${recommendation.transliteration}"`}
            title="Copy proverb"
            onClick={() => {
              void handleCopy();
            }}
            className="h-8 w-8"
          >
            <CopyIcon />
          </IconButton>
          <IconButton
            label="This proverb fits"
            aria-pressed={feedback === "up"}
            onClick={() => {
              handleFeedback("up");
            }}
            className={`h-8 w-8 ${feedback === "up" ? "bg-leaf/15 text-leaf" : ""}`}
          >
            <ThumbUpIcon />
          </IconButton>
          <IconButton
            label="This proverb does not fit"
            aria-pressed={feedback === "down"}
            onClick={() => {
              handleFeedback("down");
            }}
            className={`h-8 w-8 ${feedback === "down" ? "bg-clay/15 text-clay" : ""}`}
          >
            <ThumbDownIcon />
          </IconButton>
        </div>
      </div>
    </article>
  );
}
