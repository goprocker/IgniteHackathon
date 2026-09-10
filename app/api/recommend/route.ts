import { getCorpusIndex } from "@/lib/corpus";
import { fail, ok } from "@/lib/http";
import { buildTanglishIndex, detectLanguage } from "@/lib/language";
import { rankProverbs } from "@/lib/rank";
import { recommendRequestSchema } from "@/lib/schema";
import type { RecommendData } from "@/lib/types";

/** Ranking is pure CPU over an in-memory corpus, so Node runtime is the fit. */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const startedAt = performance.now();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("INVALID_INPUT", "Send a JSON body containing a text field.");
  }

  const parsed = recommendRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return fail(
      "INVALID_INPUT",
      "Enter a situation between 3 and 1,200 characters.",
    );
  }

  const { text } = parsed.data;

  try {
    const { records, idf } = getCorpusIndex();
    if (records.length === 0) {
      return fail(
        "EMPTY_CORPUS",
        "No proverbs are available right now. Please try again later.",
      );
    }

    const language = detectLanguage(text, buildTanglishIndex(records));
    const { results, mode } = rankProverbs({
      query: text,
      language,
      records,
      idf,
    });

    const data: RecommendData = {
      query: text,
      language,
      mode,
      results,
      latencyMs: Math.round(performance.now() - startedAt),
    };

    return ok(data);
  } catch (error) {
    // The original error stays server-side; the client gets a generic message.
    console.error("[recommend] ranking failed", error);
    return fail("INTERNAL", "Something went wrong. Please try again.");
  }
}

export async function GET(): Promise<Response> {
  return fail("METHOD_NOT_ALLOWED", "Use POST to request recommendations.");
}
