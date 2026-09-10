"use client";

import { useEffect, useRef } from "react";
import type { ReactNode, UIEvent } from "react";

import { AssistantMessage } from "@/components/chat/assistant-message";
import type { FeedbackValue } from "@/components/chat/proverb-card";
import { ThinkingIndicator } from "@/components/chat/thinking-indicator";
import { UserMessage } from "@/components/chat/user-message";
import type { Turn } from "@/lib/chat-reducer";

/**
 * How close to the bottom still counts as "following along". Wide enough to
 * survive sub-pixel rounding and the composer's own resize.
 */
const PIN_THRESHOLD_PX = 48;

interface TranscriptProps {
  turns: Turn[];
  pending: boolean;
  onCopied?: () => void;
  onFeedback?: (proverbId: string, value: FeedbackValue | null) => void;
  /** Rendered above the log when the transcript is empty. */
  children?: ReactNode;
}

export function Transcript({
  turns,
  pending,
  onCopied,
  onFeedback,
  children,
}: TranscriptProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastTurnRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // A ref, not state: the scroll handler fires continuously and must never
  // re-render the transcript.
  const isPinnedRef = useRef(true);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    isPinnedRef.current =
      element.scrollTop + element.clientHeight >=
      element.scrollHeight - PIN_THRESHOLD_PX;
  }

  useEffect(() => {
    if (!isPinnedRef.current) return;

    const target = lastTurnRef.current ?? sentinelRef.current;
    if (!target) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    /*
     * `block: "start"` rather than scrolling to the absolute bottom: a set of
     * three proverb cards is taller than the viewport, and bottom-anchoring
     * would land the reader past the first proverb.
     */
    target.scrollIntoView({
      block: "start",
      behavior: reduced ? "auto" : "smooth",
    });
  }, [turns.length, pending]);

  const lastIndex = turns.length - 1;

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto overflow-x-hidden"
    >
      <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-4 sm:px-6">
        {turns.length === 0 ? children : null}

        <div role="log" className="space-y-6">
          {turns.map((turn, index) => (
            <div
              key={turn.id}
              ref={index === lastIndex ? lastTurnRef : null}
              className="scroll-mt-4"
            >
              {turn.kind === "user" ? <UserMessage text={turn.text} /> : null}

              {turn.kind === "assistant" ? (
                <AssistantMessage
                  data={turn.data}
                  onCopied={onCopied}
                  onFeedback={onFeedback}
                />
              ) : null}

              {turn.kind === "error" ? (
                <p className="rounded-[8px] border border-clay/40 bg-clay-soft px-4 py-3 text-sm text-ink">
                  {turn.message}
                </p>
              ) : null}
            </div>
          ))}

          {pending ? <ThinkingIndicator /> : null}
        </div>

        {/* Anchoring here would fight the explicit scrollIntoView above. */}
        <div
          ref={sentinelRef}
          aria-hidden="true"
          style={{ overflowAnchor: "none" }}
          className="h-px"
        />
      </div>
    </div>
  );
}
