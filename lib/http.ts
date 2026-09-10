import type { ApiEnvelope, ApiError, ErrorCode } from "@/lib/types";

/** HTTP status paired with each error code. */
const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_INPUT: 400,
  EMPTY_CORPUS: 503,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL: 500,
};

/** Wrap a payload in the success envelope. */
export function ok<T>(data: T, init?: ResponseInit): Response {
  const body: ApiEnvelope<T> = { success: true, data };
  return Response.json(body, { status: 200, ...init });
}

/**
 * Wrap an error in the failure envelope.
 *
 * `message` is always author-written and safe to display. Internal exception
 * text never reaches this function — see the route handlers, which log the
 * original error server-side and pass a generic message here.
 */
export function fail(code: ErrorCode, message: string): Response {
  const error: ApiError = { code, message };
  const body: ApiEnvelope<never> = { success: false, error };
  return Response.json(body, { status: STATUS_BY_CODE[code] });
}
