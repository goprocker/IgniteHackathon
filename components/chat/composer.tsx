"use client";

import { useId, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, Ref } from "react";

import { IconButton } from "@/components/ui/icon-button";
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH } from "@/lib/types";

/** Beyond this the textarea stops growing and scrolls instead. */
const MAX_TEXTAREA_HEIGHT = 200;

/** The counter only appears once the limit is close enough to matter. */
const COUNTER_THRESHOLD = Math.floor(MAX_QUERY_LENGTH * 0.8);

export interface ComposerHandle {
  /** Used by the example chips: drop text in, then send it. */
  fillAndSubmit: (text: string) => void;
}

interface ComposerProps {
  pending: boolean;
  onSubmit: (text: string) => void;
  ref?: Ref<ComposerHandle>;
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 19V5" />
      <path d="M5.5 11.5 12 5l6.5 6.5" />
    </svg>
  );
}

export function Composer({ pending, onSubmit, ref }: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [attempted, setAttempted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const counterId = `${fieldId}-counter`;

  const trimmed = draft.trim();
  const tooLong = draft.length > MAX_QUERY_LENGTH;
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH;
  const isValid = trimmed.length >= MIN_QUERY_LENGTH && !tooLong;

  const validationError = tooLong
    ? `That is ${draft.length - MAX_QUERY_LENGTH} characters over the ${MAX_QUERY_LENGTH} character limit.`
    : tooShort
      ? `Please write at least ${MIN_QUERY_LENGTH} characters.`
      : null;

  // Over-length is shown live because the user can see it coming; too-short is
  // held back until they actually try to send, so typing is not nagged at.
  const shownError = tooLong || attempted ? validationError : null;
  const showCounter = draft.length >= COUNTER_THRESHOLD;

  /*
   * useLayoutEffect, not useEffect: measuring and resizing after paint leaves a
   * one-frame flash where the textarea is the wrong height on every keystroke.
   */
  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;

    element.style.height = "auto";
    const next = Math.min(element.scrollHeight, MAX_TEXTAREA_HEIGHT);
    element.style.height = `${next}px`;
    element.style.overflowY =
      element.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, [draft]);

  function send(text: string) {
    const candidate = text.trim();
    if (
      pending ||
      candidate.length < MIN_QUERY_LENGTH ||
      text.length > MAX_QUERY_LENGTH
    ) {
      setAttempted(true);
      return;
    }

    onSubmit(candidate);
    setDraft("");
    setAttempted(false);
  }

  useImperativeHandle(
    ref,
    () => ({
      fillAndSubmit: (text: string) => {
        setDraft(text);
        send(text);
      },
    }),
    // `send` is recreated every render; the handle only needs the latest one,
    // which is exactly what an unmemoised dependency list gives us here.
  );

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;

    /*
     * Tamil phonetic IMEs commit a candidate with Enter. Submitting on that
     * keystroke sends a half-typed word and swallows the composition, so the
     * composing flag must win over the submit shortcut.
     */
    if (event.nativeEvent.isComposing) return;

    event.preventDefault();
    send(draft);
  }

  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        send(draft);
      }}
    >
      <div
        className={[
          "flex items-end gap-2 rounded-[8px] border bg-surface-raised px-3 py-2.5",
          "focus-within:border-line-strong",
          shownError ? "border-clay" : "border-line",
        ].join(" ")}
      >
        <textarea
          id={fieldId}
          ref={textareaRef}
          rows={1}
          value={draft}
          disabled={pending}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          aria-label="Describe your situation"
          aria-invalid={shownError !== null}
          aria-describedby={
            [shownError ? errorId : null, showCounter ? counterId : null]
              .filter((value) => value !== null)
              .join(" ") || undefined
          }
          placeholder="Describe a situation — Tamil, English, or Tanglish…"
          className="tamil min-w-0 flex-1 resize-none bg-transparent text-[15px] text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-60"
        />
        <IconButton
          type="submit"
          label={pending ? "Finding proverbs" : "Send"}
          disabled={pending || !isValid}
          className="h-9 w-9 shrink-0 rounded-[6px] bg-leaf text-surface hover:bg-leaf hover:text-surface disabled:bg-line-strong disabled:text-surface"
        >
          <SendIcon />
        </IconButton>
      </div>

      <div className="mt-1.5 flex min-h-5 items-start justify-between gap-3 px-1">
        {shownError ? (
          <p id={errorId} className="text-xs text-clay">
            {shownError}
          </p>
        ) : (
          <p className="text-xs text-ink-faint">
            Enter to send · Shift + Enter for a new line
          </p>
        )}
        {showCounter ? (
          <p
            id={counterId}
            className={`shrink-0 text-xs tabular-nums ${
              tooLong ? "text-clay" : "text-ink-faint"
            }`}
          >
            {draft.length} / {MAX_QUERY_LENGTH}
          </p>
        ) : null}
      </div>
    </form>
  );
}
