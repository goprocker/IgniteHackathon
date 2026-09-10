"use client";

import { ProverbCard } from "@/components/chat/proverb-card";
import type { FeedbackValue } from "@/components/chat/proverb-card";
import type { RecommendData } from "@/lib/types";

interface AssistantMessageProps {
  data: RecommendData;
  onCopied?: () => void;
  onFeedback?: (proverbId: string, value: FeedbackValue | null) => void;
}

export function AssistantMessage({
  data,
  onCopied,
  onFeedback,
}: AssistantMessageProps) {
  const count = data.results.length;
  const isFallback = data.mode === "fallback";

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">
        {count === 0
          ? "No proverbs matched that one."
          : isFallback
            ? "Nothing matched closely, so here is what elders reach for anyway."
            : count === 1
              ? "Here is the proverb that fits."
              : `Here are ${count} proverbs that fit.`}
      </p>

      {isFallback ? (
        <p className="inline-flex items-center gap-2 rounded-[6px] border border-turmeric/40 bg-turmeric-soft px-2.5 py-1 text-xs text-ink-soft">
          <span
            aria-hidden="true"
            className="block h-1.5 w-1.5 rounded-full bg-turmeric"
          />
          No strong match — showing widely applicable proverbs
        </p>
      ) : null}

      <div className="space-y-3">
        {data.results.map((recommendation, index) => (
          <ProverbCard
            key={recommendation.id}
            recommendation={recommendation}
            index={index}
            onCopied={onCopied}
            onFeedback={onFeedback}
          />
        ))}
      </div>
    </div>
  );
}
