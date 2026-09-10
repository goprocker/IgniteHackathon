import { describe, expect, it } from "vitest";
import { buildTanglishIndex, detectLanguage } from "@/lib/language";
import type { ProverbRecord } from "@/lib/types";

const EMPTY_INDEX: ReadonlySet<string> = new Set<string>();

function makeRecord(overrides: Partial<ProverbRecord> = {}): ProverbRecord {
  return {
    id: "p-001",
    proverbTamil: "அமமா",
    transliteration: "adikkadi paarkkum kanavu",
    englishMeaning: "A dream seen often.",
    explanationTamil: "அமமா விளக்கம்",
    explanationEnglish: "Explanation.",
    themes: ["patience"],
    emotions: ["hope"],
    keywordsTamil: ["கனவு"],
    keywordsEnglish: ["dream"],
    tanglishAliases: ["kanavu", "periya kanavu"],
    exampleSituations: [{ language: "en", text: "Dreaming of a promotion." }],
    source: { title: "Test fixture" },
    reviewStatus: "verified",
    ...overrides,
  };
}

describe("detectLanguage", () => {
  it("classifies pure Tamil script as ta", () => {
    expect(detectLanguage("பனி மழை", EMPTY_INDEX)).toBe("ta");
    expect(
      detectLanguage("நான் மிகவும் பொறுமையாக காத்திருந்தேன்", EMPTY_INDEX),
    ).toBe("ta");
  });

  it("classifies plain English as en", () => {
    expect(detectLanguage("i am spending too much money", EMPTY_INDEX)).toBe("en");
  });

  it("treats a mixed query at or above the 0.30 ratio as ta", () => {
    // 7 Latin letters, 3 Tamil letters -> exactly 0.30.
    expect(detectLanguage("abcdefg அமம", EMPTY_INDEX)).toBe("ta");
  });

  it("treats a mixed query below the 0.30 ratio as en", () => {
    // 10 Latin letters, 1 Tamil letter -> 0.09.
    expect(detectLanguage("hello world அ", EMPTY_INDEX)).toBe("en");
  });

  it("classifies a query as tanglish on an exact alias hit", () => {
    const index = buildTanglishIndex([makeRecord()]);
    expect(detectLanguage("enakku periya kanavu irukku", index)).toBe("tanglish");
  });

  it("classifies a query as tanglish on a one-edit typo of a long token", () => {
    const index = buildTanglishIndex([makeRecord()]);
    expect(detectLanguage("enakku kanavv irukku", index)).toBe("tanglish");
  });

  it("does not fuzzy-match tokens shorter than five characters", () => {
    const index: ReadonlySet<string> = new Set(["kani"]);
    expect(detectLanguage("kana", index)).toBe("en");
  });

  it("returns en for digits and punctuation only", () => {
    expect(detectLanguage("123 456 !!! ???", EMPTY_INDEX)).toBe("en");
  });

  it("returns en for empty and whitespace-only input", () => {
    expect(detectLanguage("", EMPTY_INDEX)).toBe("en");
    expect(detectLanguage("   \n ", EMPTY_INDEX)).toBe("en");
  });
});

describe("buildTanglishIndex", () => {
  it("indexes aliases, their words and transliteration tokens", () => {
    const index = buildTanglishIndex([makeRecord()]);
    expect(index.has("kanavu")).toBe(true);
    expect(index.has("periya kanavu")).toBe(true);
    expect(index.has("periya")).toBe(true);
    expect(index.has("adikkadi")).toBe(true);
    expect(index.has("paarkkum")).toBe(true);
  });

  it("returns an empty set for an empty corpus", () => {
    expect(buildTanglishIndex([]).size).toBe(0);
  });
});
