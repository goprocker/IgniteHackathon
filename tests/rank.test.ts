import { describe, expect, it } from "vitest";
import { rankProverbs } from "@/lib/rank";
import type { RankInput } from "@/lib/rank";
import { RESULT_COUNT } from "@/lib/types";
import type { ProverbRecord } from "@/lib/types";

/**
 * Fixtures are built inline so the ranking contract is pinned by this file
 * alone — a change to the real corpus can never turn these tests red or green.
 */
function makeRecord(overrides: Partial<ProverbRecord> & { id: string }): ProverbRecord {
  return {
    proverbTamil: "காட்டு ஓநாய்",
    transliteration: "kaattu oonaai",
    englishMeaning: "A saying about the forest.",
    explanationTamil: `${overrides.id} தமிழ் விளக்கம்`,
    explanationEnglish: `${overrides.id} english explanation.`,
    themes: ["patience"],
    emotions: ["fear"],
    keywordsTamil: ["ஓநாய்"],
    keywordsEnglish: ["wolf", "howling"],
    tanglishAliases: ["oonaai"],
    exampleSituations: [{ language: "en", text: "A situation from the village." }],
    source: { title: "Test fixture" },
    reviewStatus: "verified",
    ...overrides,
  };
}

/** A query with no theme triggers, so only the lexical term moves the score. */
const NEUTRAL_QUERY = "the wolf howls loudly at night";

function makeInput(records: ProverbRecord[], overrides: Partial<RankInput> = {}): RankInput {
  return {
    query: NEUTRAL_QUERY,
    language: "en",
    records,
    idf: new Map<string, number>(),
    ...overrides,
  };
}

describe("rankProverbs", () => {
  it("returns exactly RESULT_COUNT results when the corpus is large enough", () => {
    const records = [
      makeRecord({ id: "p-1", themes: ["patience"] }),
      makeRecord({ id: "p-2", themes: ["greed"] }),
      makeRecord({ id: "p-3", themes: ["unity"] }),
      makeRecord({ id: "p-4", themes: ["effort"] }),
      makeRecord({ id: "p-5", themes: ["wisdom"] }),
    ];

    const { results, mode } = rankProverbs(makeInput(records));

    expect(results).toHaveLength(RESULT_COUNT);
    expect(mode).toBe("local");
  });

  it("returns however many records exist when there are fewer than RESULT_COUNT", () => {
    const records = [
      makeRecord({ id: "p-1", themes: ["patience"] }),
      makeRecord({ id: "p-2", themes: ["greed"] }),
    ];

    const { results } = rankProverbs(makeInput(records));

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.id)).toEqual(["p-1", "p-2"]);
  });

  it("returns no results for an empty corpus", () => {
    const { results, mode } = rankProverbs(makeInput([]));

    expect(results).toEqual([]);
    expect(mode).toBe("fallback");
  });

  it("is deterministic across repeated runs and input orderings", () => {
    const records = [
      makeRecord({ id: "p-1", themes: ["patience"], keywordsEnglish: ["wolf", "howling", "night"] }),
      makeRecord({ id: "p-2", themes: ["greed"] }),
      makeRecord({ id: "p-3", themes: ["unity"], keywordsEnglish: ["wolf"] }),
      makeRecord({ id: "p-4", themes: ["effort"], keywordsEnglish: ["wolf"] }),
    ];

    const first = rankProverbs(makeInput(records)).results.map((result) => result.id);
    const second = rankProverbs(makeInput(records)).results.map((result) => result.id);
    const reversed = rankProverbs(makeInput([...records].reverse())).results.map(
      (result) => result.id,
    );

    expect(second).toEqual(first);
    expect(reversed).toEqual(first);
  });

  it("breaks ties between identical scores by id ascending", () => {
    const records = [
      makeRecord({ id: "p-c", themes: ["patience"] }),
      makeRecord({ id: "p-a", themes: ["greed"] }),
      makeRecord({ id: "p-b", themes: ["unity"] }),
    ];

    const { results } = rankProverbs(makeInput(records));

    expect(results.map((result) => result.id)).toEqual(["p-a", "p-b", "p-c"]);
  });

  it("skips a second record with the same primary theme while alternatives exist", () => {
    const records = [
      // Strongest match, and it claims the "patience" slot.
      makeRecord({
        id: "p-1",
        themes: ["patience"],
        keywordsEnglish: ["wolf", "howling", "night"],
      }),
      makeRecord({ id: "p-2", themes: ["patience"] }),
      makeRecord({ id: "p-3", themes: ["greed"], keywordsEnglish: ["wolf"] }),
      makeRecord({ id: "p-4", themes: ["unity"], keywordsEnglish: ["wolf"] }),
    ];

    const { results } = rankProverbs(makeInput(records));
    const themes = results.map((result) => result.theme);

    expect(results.map((result) => result.id)).toEqual(["p-1", "p-3", "p-4"]);
    expect(new Set(themes).size).toBe(themes.length);
  });

  it("relaxes diversity rather than returning short", () => {
    const records = [
      makeRecord({ id: "p-1", themes: ["patience"], keywordsEnglish: ["wolf", "howling", "night"] }),
      makeRecord({ id: "p-2", themes: ["patience"] }),
      makeRecord({ id: "p-3", themes: ["patience"], keywordsEnglish: ["wolf"] }),
    ];

    const { results } = rankProverbs(makeInput(records));

    expect(results).toHaveLength(RESULT_COUNT);
  });

  it("falls back to review standing when nothing matches lexically", () => {
    const records = [
      makeRecord({ id: "p-1", themes: ["patience"], reviewStatus: "draft" }),
      makeRecord({ id: "p-2", themes: ["greed"], reviewStatus: "verified" }),
      makeRecord({ id: "p-3", themes: ["unity"], reviewStatus: "native-reviewed" }),
      makeRecord({ id: "p-4", themes: ["effort"], reviewStatus: "verified" }),
    ];

    const { results, mode } = rankProverbs(
      makeInput(records, { query: "zzzz qqqq wwww" }),
    );

    expect(mode).toBe("fallback");
    expect(results.map((result) => result.id)).toEqual(["p-2", "p-4", "p-3"]);
    for (const result of results) {
      expect(result.confidence).toBe(35);
    }
  });

  it("keeps confidence inside the 35-96 band", () => {
    const records = [
      makeRecord({
        id: "p-1",
        themes: ["patience"],
        keywordsEnglish: ["wolf", "howling", "night", "loudly"],
        keywordsTamil: ["ஓநாய்"],
      }),
      makeRecord({ id: "p-2", themes: ["greed"] }),
      makeRecord({ id: "p-3", themes: ["unity"], keywordsEnglish: ["forest"] }),
    ];

    const idf = new Map<string, number>([
      ["wolf", 9],
      ["howl", 9],
      ["night", 9],
      ["loudly", 9],
    ]);

    const { results } = rankProverbs(makeInput(records, { idf }));

    for (const result of results) {
      expect(result.confidence).toBeGreaterThanOrEqual(35);
      expect(result.confidence).toBeLessThanOrEqual(96);
      expect(Number.isInteger(result.confidence)).toBe(true);
    }
  });

  it("never shows a lower confidence above a higher one", () => {
    const records = [
      makeRecord({
        id: "p-pride",
        themes: ["pride"],
        keywordsEnglish: ["boasting"],
        keywordsTamil: [],
      }),
      makeRecord({
        id: "p-thrift",
        themes: ["thrift"],
        keywordsEnglish: ["money", "spending", "budget"],
        keywordsTamil: [],
      }),
      makeRecord({
        id: "p-patience",
        themes: ["patience"],
        keywordsTamil: ["பொறுமை"],
        keywordsEnglish: ["wait"],
      }),
      makeRecord({ id: "p-unity", themes: ["unity"], keywordsEnglish: ["together"] }),
      makeRecord({ id: "p-wisdom", themes: ["wisdom"], keywordsEnglish: ["lesson"] }),
    ];

    const queries: Array<{ query: string; language: RankInput["language"] }> = [
      { query: "she keeps bragging about her marks to everyone", language: "en" },
      { query: "நான் மிகவும் பொறுமையாக காத்திருந்தேன்", language: "ta" },
      { query: "i am spending money without a budget", language: "en" },
      { query: NEUTRAL_QUERY, language: "en" },
      { query: "zzzz qqqq xxxx", language: "en" },
    ];

    for (const { query, language } of queries) {
      const { results } = rankProverbs(makeInput(records, { query, language }));
      for (let index = 1; index < results.length; index += 1) {
        const previous = results[index - 1]?.confidence ?? 0;
        const current = results[index]?.confidence ?? 0;
        expect(
          current,
          `confidence rose from ${previous} to ${current} at position ${index} for "${query}"`,
        ).toBeLessThanOrEqual(previous);
      }
    }
  });

  it("keeps a strong exact match high on the absolute scale", () => {
    const records = [
      makeRecord({
        id: "p-thrift",
        themes: ["thrift"],
        keywordsEnglish: ["money", "spending", "budget"],
        keywordsTamil: [],
      }),
      makeRecord({ id: "p-unity", themes: ["unity"], keywordsEnglish: ["together"] }),
      makeRecord({ id: "p-wisdom", themes: ["wisdom"], keywordsEnglish: ["lesson"] }),
    ];

    const { results } = rankProverbs(
      makeInput(records, { query: "i am spending money without a budget" }),
    );

    expect(results[0]?.id).toBe("p-thrift");
    expect(results[0]?.confidence).toBeGreaterThanOrEqual(70);
  });

  it("keeps a nonsense query at the floor rather than scoring it relatively", () => {
    const records = [
      makeRecord({ id: "p-1", themes: ["patience"] }),
      makeRecord({ id: "p-2", themes: ["greed"] }),
      makeRecord({ id: "p-3", themes: ["unity"] }),
    ];

    const { results, mode } = rankProverbs(
      makeInput(records, { query: "zzzz qqqq xxxx" }),
    );

    expect(mode).toBe("fallback");
    for (const result of results) {
      expect(result.confidence).toBe(35);
    }
  });

  it("scores unseen query words with the default idf so matches still rank", () => {
    const records = [
      makeRecord({ id: "p-1", themes: ["patience"], keywordsEnglish: ["wolf"] }),
      makeRecord({ id: "p-2", themes: ["greed"], keywordsEnglish: ["forest"] }),
      makeRecord({ id: "p-3", themes: ["unity"], keywordsEnglish: ["river"] }),
    ];

    const { results, mode } = rankProverbs(makeInput(records));

    expect(mode).toBe("local");
    expect(results[0]?.id).toBe("p-1");
    expect(results[0]?.confidence).toBeGreaterThan(35);
  });

  it("assembles contextual fit from the record's own explanation and theme labels", () => {
    const record = makeRecord({
      id: "p-1",
      themes: ["thrift"],
      keywordsEnglish: ["money", "spending"],
    });

    const { results } = rankProverbs(
      makeInput([record], { query: "i am wasting money and spending too much" }),
    );

    const first = results[0];
    expect(first).toBeDefined();
    expect(first?.contextualFitEnglish).toContain(record.explanationEnglish);
    expect(first?.contextualFitEnglish).toContain("Thrift and saving");
    expect(first?.contextualFitTamil).toContain(record.explanationTamil);
    expect(first?.theme).toBe("thrift");
  });

  it("falls back to the bare explanation when no theme is triggered", () => {
    const record = makeRecord({ id: "p-1", themes: ["patience"] });

    const { results } = rankProverbs(makeInput([record]));

    expect(results[0]?.contextualFitEnglish).toBe(record.explanationEnglish);
    expect(results[0]?.contextualFitTamil).toBe(record.explanationTamil);
  });

  it("carries corpus fields through untouched", () => {
    const record = makeRecord({ id: "p-1", themes: ["patience"] });

    const { results } = rankProverbs(makeInput([record]));

    expect(results[0]).toMatchObject({
      id: record.id,
      proverbTamil: record.proverbTamil,
      transliteration: record.transliteration,
      englishMeaning: record.englishMeaning,
      theme: "patience",
    });
  });

  it("matches an inflected Tamil query against the root keyword in the corpus", () => {
    const records = [
      makeRecord({
        id: "p-ta",
        themes: ["patience"],
        keywordsTamil: ["பொறுமை"],
        keywordsEnglish: [],
      }),
      makeRecord({ id: "p-x", themes: ["greed"], keywordsTamil: ["பேராசை"], keywordsEnglish: [] }),
      makeRecord({ id: "p-y", themes: ["unity"], keywordsTamil: ["ஒற்றுமை"], keywordsEnglish: [] }),
    ];

    const { results, mode } = rankProverbs(
      makeInput(records, {
        query: "நான் மிகவும் பொறுமையாக காத்திருந்தேன்",
        language: "ta",
      }),
    );

    expect(mode).toBe("local");
    expect(results[0]?.id).toBe("p-ta");
    expect(results[0]?.confidence).toBeGreaterThan(35);
  });

  it("reaches themes from Tamil input, not just English", () => {
    const record = makeRecord({
      id: "p-ta",
      themes: ["patience"],
      keywordsTamil: ["பொறுமை"],
      keywordsEnglish: [],
    });

    const { results } = rankProverbs(
      makeInput([record], { query: "பொறுமையாக இருந்தேன்", language: "ta" }),
    );

    // The label only appears when matchThemes fired on the Tamil trigger.
    expect(results[0]?.contextualFitEnglish).toContain("Patience and timing");
    expect(results[0]?.contextualFitTamil).toContain(record.explanationTamil);
  });

  it("ranks an exact Tamil match above a shared-root match", () => {
    const records = [
      // Alphabetically first, so winning on id alone would put the stem match on top.
      makeRecord({
        id: "p-a-stem",
        themes: ["thrift"],
        keywordsTamil: ["பொறுமை"],
        keywordsEnglish: [],
      }),
      makeRecord({
        id: "p-b-exact",
        themes: ["appearances"],
        keywordsTamil: ["பொறுமையாக"],
        keywordsEnglish: [],
      }),
    ];

    const { results } = rankProverbs(
      makeInput(records, { query: "பொறுமையாக", language: "ta" }),
    );

    expect(results.map((result) => result.id)).toEqual(["p-b-exact", "p-a-stem"]);
  });

  it("never prefix-matches Latin tokens", () => {
    const records = [
      makeRecord({ id: "p-1", themes: ["patience"], keywordsEnglish: ["cardiology"] }),
      makeRecord({ id: "p-2", themes: ["greed"], keywordsEnglish: ["cardiology"] }),
    ];

    const { mode } = rankProverbs(
      makeInput(records, { query: "car parking", language: "en" }),
    );

    expect(mode).toBe("fallback");
  });

  it("does not let a two-character Tamil token match a root", () => {
    const records = [
      makeRecord({ id: "p-1", themes: ["patience"], keywordsTamil: ["பொறுமை"], keywordsEnglish: [] }),
    ];

    const { mode } = rankProverbs(makeInput(records, { query: "பொ", language: "ta" }));

    expect(mode).toBe("fallback");
  });

  it("prefers Tamil fields for a Tamil query and English fields for an English one", () => {
    const tamilSide = makeRecord({
      id: "p-ta",
      themes: ["greed"],
      keywordsTamil: ["ஓநாய்"],
      keywordsEnglish: [],
    });
    const englishSide = makeRecord({
      id: "p-en",
      themes: ["unity"],
      keywordsTamil: [],
      keywordsEnglish: ["wolf"],
    });
    const records = [tamilSide, englishSide];

    const english = rankProverbs(makeInput(records, { query: "a lone wolf" }));
    const tamil = rankProverbs(
      makeInput(records, { query: "ஓநாய்", language: "ta" }),
    );

    expect(english.results[0]?.id).toBe("p-en");
    expect(tamil.results[0]?.id).toBe("p-ta");
  });
});
