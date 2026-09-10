import { getCorpus } from "@/lib/corpus";
import { fail, ok } from "@/lib/http";
import type { HealthData } from "@/lib/types";

export const runtime = "nodejs";

/** Never cache: the point of this route is the state right now. */
export const dynamic = "force-dynamic";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const OLLAMA_TIMEOUT_MS = 1_500;

/**
 * Probe Ollama without blocking the response.
 *
 * Semantic retrieval is not wired up yet, so this is purely informational — a
 * report of false must never stop the deterministic ranker from serving.
 */
async function isOllamaReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function GET(): Promise<Response> {
  try {
    const corpusCount = getCorpus().length;

    const data: HealthData = {
      status: "ok",
      corpusCount,
      // Deterministic ranking needs nothing but the corpus itself.
      fallbackReady: corpusCount > 0,
      ollamaReachable: await isOllamaReachable(),
    };

    return ok(data);
  } catch (error) {
    console.error("[health] check failed", error);
    return fail("INTERNAL", "Health check failed.");
  }
}
