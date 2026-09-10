import { describe, expect, it } from "vitest";
import {
  getAllRecords,
  getById,
  getCorpus,
  getCorpusIndex,
} from "@/lib/corpus";
import { proverbRecordSchema } from "@/lib/schema";
import type { LanguageCode } from "@/lib/types";

const EXPECTED_ENTRY_COUNT = 15;

/** Closed vocabularies. A record using anything outside these fails review. */
const ALLOWED_THEMES: ReadonlySet<string> = new Set([
  "moderation",
  "patience",
  "consequences",
  "effort",
  "greed",
  "unity",
  "pride",
  "preparation",
  "wisdom",
  "appearances",
  "thrift",
  "gratitude",
  "humility",
  "adaptability",
  "speech",
]);

const ALLOWED_EMOTIONS: ReadonlySet<string> = new Set([
  "warning",
  "encouragement",
  "criticism",
  "reassurance",
  "regret",
  "concern",
  "approval",
]);

const REQUIRED_LANGUAGES: readonly LanguageCode[] = ["ta", "en", "tanglish"];

describe("corpus loading", () => {
  it("loads the seed corpus", () => {
    expect(getAllRecords()).toHaveLength(EXPECTED_ENTRY_COUNT);
    expect(getCorpus()).toHaveLength(EXPECTED_ENTRY_COUNT);
  });

  it("gives every record a unique id", () => {
    const ids = getAllRecords().map((record) => record.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("validates every record against proverbRecordSchema", () => {
    for (const record of getAllRecords()) {
      expect(proverbRecordSchema.safeParse(record).success).toBe(true);
    }
  });
});

describe("corpus vocabularies", () => {
  it("uses only the closed theme vocabulary", () => {
    for (const record of getAllRecords()) {
      expect(record.themes.length).toBeGreaterThan(0);
      expect(record.themes.length).toBeLessThanOrEqual(3);
      for (const theme of record.themes) {
        expect(ALLOWED_THEMES.has(theme)).toBe(true);
      }
    }
  });

  it("uses only the closed emotion vocabulary", () => {
    for (const record of getAllRecords()) {
      for (const emotion of record.emotions) {
        expect(ALLOWED_EMOTIONS.has(emotion)).toBe(true);
      }
    }
  });

  it("gives every record three example situations covering ta, en and tanglish", () => {
    for (const record of getAllRecords()) {
      expect(record.exampleSituations).toHaveLength(3);
      const languages = record.exampleSituations.map(
        (situation) => situation.language,
      );
      expect([...languages].sort()).toEqual([...REQUIRED_LANGUAGES].sort());
    }
  });
});

describe("corpus accessors", () => {
  it("excludes drafts from the served corpus", () => {
    const served = getCorpus();
    expect(served.every((record) => record.reviewStatus !== "draft")).toBe(true);

    const nonDrafts = getAllRecords().filter(
      (record) => record.reviewStatus !== "draft",
    );
    expect(served).toHaveLength(nonDrafts.length);
  });

  it("round-trips every id through getById", () => {
    for (const record of getAllRecords()) {
      expect(getById(record.id)).toBe(record);
    }
  });

  it("returns undefined for an unknown id", () => {
    expect(getById("no-such-proverb")).toBeUndefined();
  });
});

describe("corpus index", () => {
  it("memoises the index across calls", () => {
    const first = getCorpusIndex();
    const second = getCorpusIndex();
    expect(second).toBe(first);
    expect(second.idf).toBe(first.idf);
  });

  it("reports the served document count", () => {
    const index = getCorpusIndex();
    expect(index.documentCount).toBe(getCorpus().length);
    expect(index.records).toEqual(getCorpus());
  });

  it("produces finite, positive idf weights", () => {
    const { idf } = getCorpusIndex();
    expect(idf.size).toBeGreaterThan(0);
    for (const weight of idf.values()) {
      expect(Number.isFinite(weight)).toBe(true);
      expect(weight).toBeGreaterThan(0);
    }
  });

  it("scores a term common to many records below a rare one", () => {
    const { idf, records } = getCorpusIndex();

    // Recompute document frequency independently so the assertion tests the
    // weighting, not the loader's own bookkeeping.
    const documentFrequency = new Map<string, number>();
    for (const record of records) {
      const terms = new Set(
        [
          record.englishMeaning,
          record.explanationEnglish,
          ...record.keywordsEnglish,
          ...record.exampleSituations.map((situation) => situation.text),
        ]
          .join(" ")
          .toLowerCase()
          .split(/[\s\p{P}\p{S}]+/u)
          .filter((token) => token.length > 0),
      );
      for (const term of terms) {
        documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
      }
    }

    let commonTerm: string | undefined;
    let commonFrequency = 0;
    let rareTerm: string | undefined;
    for (const [term, frequency] of documentFrequency) {
      if (frequency > commonFrequency) {
        commonTerm = term;
        commonFrequency = frequency;
      }
      if (frequency === 1 && rareTerm === undefined) {
        rareTerm = term;
      }
    }

    expect(commonTerm).toBeDefined();
    expect(rareTerm).toBeDefined();
    expect(commonFrequency).toBeGreaterThan(1);

    const commonWeight = idf.get(commonTerm ?? "");
    const rareWeight = idf.get(rareTerm ?? "");
    expect(commonWeight).toBeDefined();
    expect(rareWeight).toBeDefined();
    expect(commonWeight ?? 0).toBeLessThan(rareWeight ?? 0);
  });
});
