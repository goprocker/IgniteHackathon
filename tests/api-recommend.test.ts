import { describe, expect, it } from "vitest";
import { GET as healthGet } from "@/app/api/health/route";
import { GET as recommendGet, POST } from "@/app/api/recommend/route";
import { MAX_QUERY_LENGTH } from "@/lib/types";
import type { ApiEnvelope, HealthData, RecommendData } from "@/lib/types";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/recommend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function envelopeOf<T>(response: Response): Promise<ApiEnvelope<T>> {
  return (await response.json()) as ApiEnvelope<T>;
}

describe("POST /api/recommend", () => {
  it("returns three ranked results for a valid situation", async () => {
    const response = await POST(
      postRequest({ text: "My friend ignored every warning and now regrets it" }),
    );
    expect(response.status).toBe(200);

    const envelope = await envelopeOf<RecommendData>(response);
    expect(envelope.success).toBe(true);
    if (!envelope.success) return;

    const { data } = envelope;
    expect(data.results).toHaveLength(3);
    expect(data.language).toBe("en");
    expect(["local", "fallback"]).toContain(data.mode);
    expect(data.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns results whose ids all resolve to real corpus entries", async () => {
    // The strongest guard against a recommendation that is not a real proverb.
    const { getCorpus } = await import("@/lib/corpus");
    const knownIds = new Set(getCorpus().map((record) => record.id));

    const response = await POST(
      postRequest({ text: "everyone worked together and it finally succeeded" }),
    );
    const envelope = await envelopeOf<RecommendData>(response);
    expect(envelope.success).toBe(true);
    if (!envelope.success) return;

    for (const result of envelope.data.results) {
      expect(knownIds.has(result.id)).toBe(true);
      expect(result.proverbTamil.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(35);
      expect(result.confidence).toBeLessThanOrEqual(96);
    }
  });

  it("never returns the same proverb twice in one response", async () => {
    const response = await POST(
      postRequest({ text: "he wasted all his savings on things he did not need" }),
    );
    const envelope = await envelopeOf<RecommendData>(response);
    expect(envelope.success).toBe(true);
    if (!envelope.success) return;

    const ids = envelope.data.results.map((result) => result.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("echoes the trimmed query rather than the raw body", async () => {
    const response = await POST(postRequest({ text: "   patience matters   " }));
    const envelope = await envelopeOf<RecommendData>(response);
    expect(envelope.success).toBe(true);
    if (!envelope.success) return;
    expect(envelope.data.query).toBe("patience matters");
  });

  it("is deterministic across repeated identical requests", async () => {
    const text = "she keeps boasting about her achievements";
    const first = await envelopeOf<RecommendData>(await POST(postRequest({ text })));
    const second = await envelopeOf<RecommendData>(await POST(postRequest({ text })));

    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(first.data.results.map((r) => r.id)).toEqual(
      second.data.results.map((r) => r.id),
    );
  });

  it("rejects input shorter than the minimum", async () => {
    const response = await POST(postRequest({ text: "hi" }));
    expect(response.status).toBe(400);

    const envelope = await envelopeOf<RecommendData>(response);
    expect(envelope.success).toBe(false);
    if (envelope.success) return;
    expect(envelope.error.code).toBe("INVALID_INPUT");
  });

  it("rejects whitespace-only input", async () => {
    const response = await POST(postRequest({ text: "          " }));
    expect(response.status).toBe(400);
  });

  it("rejects input longer than the maximum", async () => {
    const response = await POST(
      postRequest({ text: "a".repeat(MAX_QUERY_LENGTH + 1) }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a malformed JSON body without leaking parser detail", async () => {
    const response = await POST(postRequest("{ not json"));
    expect(response.status).toBe(400);

    const envelope = await envelopeOf<RecommendData>(response);
    expect(envelope.success).toBe(false);
    if (envelope.success) return;
    expect(envelope.error.code).toBe("INVALID_INPUT");
    // PRD section 11: internal exception text must never reach the client.
    // "JSON" alone is fine — the author-written message uses it as guidance;
    // what must not appear is the parser's own diagnostic wording.
    expect(envelope.error.message).not.toMatch(
      /SyntaxError|Unexpected token|at position \d+|JSON\.parse/i,
    );
  });

  it("rejects a missing text field", async () => {
    const response = await POST(postRequest({}));
    expect(response.status).toBe(400);
  });

  it("refuses GET with a method-not-allowed envelope", async () => {
    const response = await recommendGet();
    expect(response.status).toBe(405);

    const envelope = await envelopeOf<RecommendData>(response);
    expect(envelope.success).toBe(false);
    if (envelope.success) return;
    expect(envelope.error.code).toBe("METHOD_NOT_ALLOWED");
  });
});

describe("GET /api/health", () => {
  it("reports corpus count and fallback readiness", async () => {
    const response = await healthGet();
    expect(response.status).toBe(200);

    const envelope = await envelopeOf<HealthData>(response);
    expect(envelope.success).toBe(true);
    if (!envelope.success) return;

    const { data } = envelope;
    expect(data.status).toBe("ok");
    expect(data.corpusCount).toBeGreaterThan(0);
    expect(data.fallbackReady).toBe(true);
    expect(typeof data.ollamaReachable).toBe("boolean");
  });

  it("exposes no filesystem paths or unrelated model names", async () => {
    const response = await healthGet();
    const raw = await response.text();
    expect(raw).not.toMatch(/[A-Za-z]:\\|\/Users\/|node_modules/);
    // Named models installed locally must not be enumerated (PRD section 9).
    // Matching on bare "llama" would false-positive on `ollamaReachable`.
    expect(raw).not.toMatch(/gemma\d|qwen\d|llama\d|nomic-embed/i);

    // Whitelist the payload shape outright: anything added later has to be a
    // deliberate decision rather than an accidental disclosure.
    const envelope = JSON.parse(raw) as ApiEnvelope<HealthData>;
    expect(envelope.success).toBe(true);
    if (!envelope.success) return;
    expect(Object.keys(envelope.data).sort()).toEqual([
      "corpusCount",
      "fallbackReady",
      "ollamaReachable",
      "status",
    ]);
  });
});
