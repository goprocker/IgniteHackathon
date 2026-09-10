/**
 * Transcript state for the chat surface.
 *
 * The reducer is deliberately ignorant of the network, of time, and of storage:
 * ids and timestamps are minted by the caller inside event handlers so that a
 * server render and the first client render produce byte-identical markup.
 */

import type { RecommendData } from "@/lib/types";

/** One entry in the transcript. Discriminated on `kind` so rendering is total. */
export type Turn =
  | { kind: "user"; id: string; text: string; createdAt: string }
  | { kind: "assistant"; id: string; data: RecommendData; createdAt: string }
  | { kind: "error"; id: string; message: string; createdAt: string };

export interface ChatState {
  turns: Turn[];
  status: "idle" | "pending";
}

export type ChatAction =
  | { type: "submit"; id: string; text: string; createdAt: string }
  | { type: "resolved"; id: string; data: RecommendData; createdAt: string }
  | { type: "failed"; id: string; message: string; createdAt: string }
  | { type: "reset" };

export const INITIAL_CHAT_STATE: ChatState = {
  turns: [],
  status: "idle",
};

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "submit":
      return {
        turns: [
          ...state.turns,
          {
            kind: "user",
            id: action.id,
            text: action.text,
            createdAt: action.createdAt,
          },
        ],
        status: "pending",
      };

    case "resolved":
      return {
        turns: [
          ...state.turns,
          {
            kind: "assistant",
            id: action.id,
            data: action.data,
            createdAt: action.createdAt,
          },
        ],
        status: "idle",
      };

    case "failed":
      return {
        turns: [
          ...state.turns,
          {
            kind: "error",
            id: action.id,
            message: action.message,
            createdAt: action.createdAt,
          },
        ],
        status: "idle",
      };

    case "reset":
      return INITIAL_CHAT_STATE;
  }
}
