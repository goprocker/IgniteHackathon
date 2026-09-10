import { contentTokens, levenshteinWithin, normalizeText, tokenize } from "@/lib/normalize";
import type { LanguageCode, ProverbRecord } from "@/lib/types";

/** The Tamil Unicode block, letters and combining marks alike. */
export const TAMIL_BLOCK = /[\u0B80-\u0BFF]/;

/** Letters and combining marks. Digits, spaces and punctuation say nothing about language. */
const LETTER_OR_MARK = /[\p{L}\p{M}]/u;

/** Share of Tamil letters at which a query counts as Tamil rather than mixed. */
const TAMIL_RATIO_THRESHOLD = 0.3;

/** Below this length a one-edit neighbourhood is too wide to mean anything. */
const MIN_FUZZY_LENGTH = 5;

/**
 * Classify a query as Tamil, English or Tanglish.
 *
 * Script decides first: Tamil characters cannot be typed by accident. Only when
 * the query is written in Latin do we ask whether its words are Tamil words —
 * that is what `tanglishIndex` holds, built from the corpus itself so the
 * detector never depends on a hand-written romanisation dictionary.
 */
export function detectLanguage(
  input: string,
  tanglishIndex: ReadonlySet<string>,
): LanguageCode {
  const normalized = normalizeText(input);

  let letterCount = 0;
  let tamilCount = 0;
  for (const character of normalized) {
    if (!LETTER_OR_MARK.test(character)) {
      continue;
    }
    letterCount += 1;
    if (TAMIL_BLOCK.test(character)) {
      tamilCount += 1;
    }
  }

  // Digits, punctuation or nothing at all: no evidence, so default to English.
  if (letterCount === 0) {
    return "en";
  }
  if (tamilCount / letterCount >= TAMIL_RATIO_THRESHOLD) {
    return "ta";
  }

  for (const token of contentTokens(normalized)) {
    if (tanglishIndex.has(token)) {
      return "tanglish";
    }
    if (token.length < MIN_FUZZY_LENGTH) {
      continue;
    }
    for (const alias of tanglishIndex) {
      if (levenshteinWithin(token, alias, 1)) {
        return "tanglish";
      }
    }
  }

  return "en";
}

/**
 * Every romanised Tamil surface form the corpus knows about.
 *
 * Whole aliases are indexed alongside their tokens so that a multi-word alias
 * still contributes each of its words to detection, which only ever sees one
 * token at a time.
 */
export function buildTanglishIndex(records: ProverbRecord[]): ReadonlySet<string> {
  const index = new Set<string>();
  for (const record of records) {
    for (const alias of record.tanglishAliases) {
      const normalized = normalizeText(alias);
      if (normalized !== "") {
        index.add(normalized);
      }
      for (const token of tokenize(alias)) {
        index.add(token);
      }
    }
    for (const token of tokenize(record.transliteration)) {
      index.add(token);
    }
  }
  return index;
}
