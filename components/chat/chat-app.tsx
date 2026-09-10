"use client";

import { useCallback, useReducer, useRef, useState } from "react";

import { Composer } from "@/components/chat/composer";
import type { ComposerHandle } from "@/components/chat/composer";
import { EmptyState } from "@/components/chat/empty-state";
import { KolamMark } from "@/components/chat/kolam-mark";
import { Transcript } from "@/components/chat/transcript";
import { LiveRegion } from "@/components/ui/live-region";
import { chatReducer, INITIAL_CHAT_STATE } from "@/lib/chat-reducer";
import type { ApiEnvelope, RecommendData } from "@/lib/types";

/**
 * A local corpus lookup can return in ~20ms. Flashing the thinking indicator
 * for two frames reads as a glitch, so the pending state is held open.
 */
const MIN_PENDING_MS = 900;

const GENERIC_ERROR = "Something went wrong. Please try again.";

type Outcome =
  | { ok: true; data: RecommendData }
  | { ok: false; message: string };

async function requestRecommendation(text: string): Promise<Outcome> {
  try {
    const response = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const envelope = (await response.json()) as ApiEnvelope<RecommendData>;

    if (!envelope.success) {
      return { ok: false, message: envelope.error.message };
    }
    if (!response.ok) {
      return { ok: false, message: GENERIC_ERROR };
    }
    return { ok: true, data: envelope.data };
  } catch {
    // Covers both a rejected fetch (offline, DNS) and a body that is not JSON
    // (an HTML error page from a proxy, most often).
    return { ok: false, message: GENERIC_ERROR };
  }
}

function holdPendingFloor(startedAt: number): Promise<void> {
  const remaining = MIN_PENDING_MS - (Date.now() - startedAt);
  if (remaining <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, remaining);
  });
}

export function ChatApp() {
  const [state, dispatch] = useReducer(chatReducer, INITIAL_CHAT_STATE);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const composerRef = useRef<ComposerHandle | null>(null);

  const pending = state.status === "pending";

  const handleSubmit = useCallback(async (text: string) => {
    const startedAt = Date.now();

    dispatch({
      type: "submit",
      id: crypto.randomUUID(),
      text,
      createdAt: new Date().toISOString(),
    });
    setErrorMessage("");
    setStatusMessage("Finding proverbs…");

    const outcome = await requestRecommendation(text);
    await holdPendingFloor(startedAt);

    if (outcome.ok) {
      dispatch({
        type: "resolved",
        id: crypto.randomUUID(),
        data: outcome.data,
        createdAt: new Date().toISOString(),
      });
      const count = outcome.data.results.length;
      setStatusMessage(
        count === 1 ? "One proverb found" : `${count} proverbs found`,
      );
      return;
    }

    dispatch({
      type: "failed",
      id: crypto.randomUUID(),
      message: outcome.message,
      createdAt: new Date().toISOString(),
    });
    setStatusMessage("");
    setErrorMessage(outcome.message);
  }, []);

  const submit = useCallback(
    (text: string) => {
      void handleSubmit(text);
    },
    [handleSubmit],
  );

  const handleCopied = useCallback(() => {
    setStatusMessage("Copied");
  }, []);

  return (
    /* `md:pl-64` reserves the gutter the conversation sidebar will occupy;
       the sidebar itself is another agent's file. */
    <div className="flex h-dvh flex-col bg-surface md:pl-64">
      {/* Two keyframe sets, declared once at the single client boundary rather
          than duplicated inside every card and dot that uses them. */}
      <style>{`
        @keyframes pz-rise {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: none; }
        }
        .pz-rise { animation: pz-rise 320ms ease-out both; }
        @keyframes pz-dot {
          0%, 100% { opacity: 0.25; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-2px); }
        }
        .pz-dot { animation: pz-dot 1.1s ease-in-out infinite; }
      `}</style>

      <header className="shrink-0 border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2.5 px-4 py-3 sm:px-6">
          <KolamMark size={24} className="shrink-0 text-leaf" />
          <span className="text-sm font-semibold tracking-tight text-ink">
            Pazhamozhi AI
          </span>
          <span className="hidden text-xs text-ink-faint sm:inline">
            Tamil proverbs for the situation you are in
          </span>
        </div>
      </header>

      <Transcript
        turns={state.turns}
        pending={pending}
        onCopied={handleCopied}
      >
        <EmptyState
          disabled={pending}
          onPick={(text) => {
            composerRef.current?.fillAndSubmit(text);
          }}
        />
      </Transcript>

      <div className="sticky bottom-0 shrink-0 border-t border-line bg-surface">
        <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-3 sm:px-6">
          <Composer ref={composerRef} pending={pending} onSubmit={submit} />
        </div>
      </div>

      <LiveRegion status={statusMessage} error={errorMessage} />
    </div>
  );
}
