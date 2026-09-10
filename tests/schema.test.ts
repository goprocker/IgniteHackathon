import { describe, expect, it } from "vitest";
import {
  proverbRecordSchema,
  recommendRequestSchema,
} from "@/lib/schema";
import {
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  type ProverbRecord,
} from "@/lib/types";

/**
 * A valid record built from the hand-written interface. If `ProverbRecord` and
 * `proverbRecordSchema` ever drift apart, this stops compiling — which is the
 * point of the test.
 */
const validRecord: ProverbRecord = {
  id: "sample-proverb",
  proverbTamil: "அளவுக்கு மிஞ்சினால் அமிர்தமும் நஞ்சு",
  transliteration: "Alavukku minjinaal amirthamum nanju",
  englishMeaning: "Even nectar becomes poison in excess.",
  explanationTamil: "எதிலும் அளவுடன் இருக்க வேண்டும்.",
  explanationEnglish: "Anything good becomes harmful past a limit.",
  themes: ["moderation"],
  emotions: ["warning"],
  keywordsTamil: ["அளவு"],
  keywordsEnglish: ["excess", "limit"],
  tanglishAliases: ["alavu"],
  exampleSituations: [{ language: "en", text: "Someone works without rest." }],
  source: { title: "Widely documented Tamil proverb" },
  reviewStatus: "native-reviewed",
};

describe("proverbRecordSchema", () => {
  it("accepts a record that satisfies the ProverbRecord interface", () => {
    expect(proverbRecordSchema.parse(validRecord)).toEqual(validRecord);
  });

  it("rejects a record with no themes", () => {
    const result = proverbRecordSchema.safeParse({ ...validRecord, themes: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a record with no example situations", () => {
    const result = proverbRecordSchema.safeParse({
      ...validRecord,
      exampleSituations: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown review status", () => {
    const result = proverbRecordSchema.safeParse({
      ...validRecord,
      reviewStatus: "approved",
    });
    expect(result.success).toBe(false);
  });

  it("keeps url and license optional on the source", () => {
    expect(
      proverbRecordSchema.safeParse({
        ...validRecord,
        source: { title: "A book", url: "https://example.com", license: "CC0" },
      }).success,
    ).toBe(true);
  });
});

describe("recommendRequestSchema", () => {
  it("trims surrounding whitespace before validating", () => {
    const parsed = recommendRequestSchema.parse({ text: "   hello there   " });
    expect(parsed.text).toBe("hello there");
  });

  it("rejects whitespace-only input as too short", () => {
    // Without the trim-then-check ordering this would pass a raw length test.
    const result = recommendRequestSchema.safeParse({ text: "        " });
    expect(result.success).toBe(false);
  });

  it("rejects input below the minimum length", () => {
    const short = "a".repeat(MIN_QUERY_LENGTH - 1);
    expect(recommendRequestSchema.safeParse({ text: short }).success).toBe(
      false,
    );
  });

  it("rejects input above the maximum length", () => {
    const long = "a".repeat(MAX_QUERY_LENGTH + 1);
    expect(recommendRequestSchema.safeParse({ text: long }).success).toBe(false);
  });

  it("accepts input exactly at both bounds", () => {
    expect(
      recommendRequestSchema.safeParse({ text: "a".repeat(MIN_QUERY_LENGTH) })
        .success,
    ).toBe(true);
    expect(
      recommendRequestSchema.safeParse({ text: "a".repeat(MAX_QUERY_LENGTH) })
        .success,
    ).toBe(true);
  });

  it("rejects a missing or non-string text field", () => {
    expect(recommendRequestSchema.safeParse({}).success).toBe(false);
    expect(recommendRequestSchema.safeParse({ text: 42 }).success).toBe(false);
  });
});
