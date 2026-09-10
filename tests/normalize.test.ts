import { describe, expect, it } from "vitest";
import {
  ENGLISH_STOPWORDS,
  TAMIL_STOPWORDS,
  contentTokens,
  isTamilToken,
  levenshteinWithin,
  normalizeText,
  tamilPrefixMatch,
  tokenize,
} from "@/lib/normalize";

describe("normalizeText", () => {
  it("composes decomposed sequences to NFC", () => {
    const decomposed = "a\u0301"; // a + combining acute
    expect(normalizeText(decomposed)).toBe("\u00E1");
    expect(normalizeText(decomposed)).toHaveLength(1);
  });

  it("strips zero-width joiners and non-joiners", () => {
    const withJoiners = "\u0B85\u200C\u0BAE\u200D\u0BAE";
    expect(normalizeText(withJoiners)).toBe("\u0B85\u0BAE\u0BAE");
  });

  it("collapses whitespace and trims", () => {
    expect(normalizeText("  too    many \n\t spaces  ")).toBe("too many spaces");
  });

  it("lowercases Latin while leaving Tamil untouched", () => {
    expect(normalizeText("Kadhal அமம")).toBe("kadhal அமம");
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(normalizeText("   \n  ")).toBe("");
  });
});

describe("tokenize", () => {
  it("splits on punctuation and symbols", () => {
    expect(tokenize("hello, world! (test) — again")).toEqual([
      "hello",
      "world",
      "test",
      "again",
    ]);
  });

  it("keeps Tamil words intact", () => {
    expect(tokenize("அவஸரம் வேண்டாம்")).toEqual([
      "அவஸரம்",
      "வேண்டாம்",
    ]);
  });

  it("returns an empty array for empty, whitespace-only and punctuation-only input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("    ")).toEqual([]);
    expect(tokenize("!!! ??? ... ---")).toEqual([]);
  });
});

describe("contentTokens", () => {
  it("drops English stopwords", () => {
    expect(contentTokens("the cat is on the mat")).toEqual(["cat", "mat"]);
  });

  it("drops Tamil stopwords", () => {
    const query = "இந்த பரவை"; // "இந்த பறவை"
    expect(contentTokens(query)).toEqual(["பரவை"]);
  });

  it("strips ing, ed, es and s suffixes", () => {
    expect(contentTokens("running walked wishes birds")).toEqual([
      "runn",
      "walk",
      "wish",
      "bird",
    ]);
  });

  it("leaves a token alone when the stem would not exceed three characters", () => {
    // "cats" -> "cat" (3) and "goes" -> "go" (2) are both too short to strip.
    expect(contentTokens("cats goes sing")).toEqual(["cats", "goes", "sing"]);
  });

  it("never stems a token containing Tamil characters", () => {
    const mixed = "அமமாing";
    expect(contentTokens(mixed)).toEqual([mixed]);
    expect(contentTokens("பரவைகள்")).toEqual([
      "பரவைகள்",
    ]);
  });

  it("returns an empty array for empty and punctuation-only input", () => {
    expect(contentTokens("")).toEqual([]);
    expect(contentTokens("   ")).toEqual([]);
    expect(contentTokens("...!!!")).toEqual([]);
  });

  it("exposes non-empty stopword sets", () => {
    expect(ENGLISH_STOPWORDS.has("the")).toBe(true);
    expect(ENGLISH_STOPWORDS.has("proverb")).toBe(false);
    expect(TAMIL_STOPWORDS.has("ஒரு")).toBe(true); // "ஒரு"
    expect(TAMIL_STOPWORDS.size).toBeGreaterThan(20);
  });
});

describe("tamilPrefixMatch", () => {
  it("matches an inflected Tamil form against its root", () => {
    // பொறுமையாக ("patiently") against the corpus root பொறுமை ("patience").
    expect(tamilPrefixMatch("பொறுமையாக", "பொறுமை")).toBe(true);
    expect(tamilPrefixMatch("பொறுமை", "பொறுமையாக")).toBe(true);
    expect(tamilPrefixMatch("காத்திருந்தேன்", "காத்திரு")).toBe(true);
  });

  it("rejects Tamil words that merely start alike below the length floor", () => {
    // "பொ" is two characters — a bare syllable, not a root.
    expect(tamilPrefixMatch("பொறுமை", "பொ")).toBe(false);
  });

  it("rejects unrelated Tamil words", () => {
    expect(tamilPrefixMatch("பொறுமை", "ஒற்றுமை")).toBe(false);
  });

  it("never prefix-matches Latin tokens", () => {
    expect(tamilPrefixMatch("cardiology", "car")).toBe(false);
    expect(tamilPrefixMatch("car", "cardiology")).toBe(false);
  });

  it("rejects mixed-script tokens", () => {
    expect(tamilPrefixMatch("பொறுமைly", "பொறுமை")).toBe(false);
  });
});

describe("isTamilToken", () => {
  it("accepts wholly Tamil tokens and rejects everything else", () => {
    expect(isTamilToken("பொறுமை")).toBe(true);
    expect(isTamilToken("poruthaar")).toBe(false);
    expect(isTamilToken("பொறுமைly")).toBe(false);
    expect(isTamilToken("")).toBe(false);
  });
});

describe("levenshteinWithin", () => {
  it("is true for identical strings at any budget", () => {
    expect(levenshteinWithin("kadhal", "kadhal", 0)).toBe(true);
  });

  it("accepts a single edit within budget", () => {
    expect(levenshteinWithin("kanavu", "kanavv", 1)).toBe(true);
    expect(levenshteinWithin("kanavu", "kanav", 1)).toBe(true);
    expect(levenshteinWithin("kanavu", "kaanavu", 1)).toBe(true);
  });

  it("rejects edits beyond budget", () => {
    expect(levenshteinWithin("kanavu", "kadhal", 1)).toBe(false);
    expect(levenshteinWithin("kitten", "sitting", 2)).toBe(false);
    expect(levenshteinWithin("kitten", "sitting", 3)).toBe(true);
  });

  it("exits early when the length gap alone exceeds the budget", () => {
    expect(levenshteinWithin("abc", "abcdef", 1)).toBe(false);
    expect(levenshteinWithin("", "abcdef", 2)).toBe(false);
  });

  it("rejects a negative budget for differing strings", () => {
    expect(levenshteinWithin("a", "b", -1)).toBe(false);
  });
});
