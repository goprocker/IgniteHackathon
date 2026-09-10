/**
 * Text normalisation shared by language detection, theme matching and ranking.
 *
 * Every function here is pure and deterministic: the same string in always
 * produces the same tokens out, on any machine. Ranking depends on that, so
 * nothing in this file may consult a locale, a clock or the environment.
 */

/**
 * Common English function words. They appear in nearly every query and every
 * record, so leaving them in would let "the" dominate a lexical score.
 */
export const ENGLISH_STOPWORDS: ReadonlySet<string> = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "am",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "here",
  "him",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "just",
  "me",
  "my",
  "no",
  "not",
  "of",
  "on",
  "or",
  "our",
  "out",
  "own",
  "she",
  "so",
  "some",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "up",
  "us",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "which",
  "who",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

/**
 * Tamil clitics, pronouns and postpositions. These carry no topical signal but
 * are extremely frequent in natural Tamil queries.
 */
export const TAMIL_STOPWORDS: ReadonlySet<string> = new Set([
  "அது",
  "இது",
  "அவன்",
  "அவள்",
  "அவர்",
  "அவர்கள்",
  "நான்",
  "நீ",
  "நாம்",
  "நாங்கள்",
  "நீங்கள்",
  "ஒரு",
  "ஒன்று",
  "என்று",
  "என்ன",
  "எப்படி",
  "மற்றும்",
  "ஆனால்",
  "அல்லது",
  "இல்லை",
  "ஆம்",
  "மிக",
  "மிகவும்",
  "அந்த",
  "இந்த",
  "அங்கே",
  "இங்கே",
  "ஏன்",
  "யார்",
  "எது",
  "போன்ற",
  "மேலும்",
  "பிறகு",
  "முன்",
  "உள்ள",
  "ஆக",
  "தான்",
  "கூட",
  "வரை",
  "இருந்து",
  "மட்டும்",
  "மேல்",
  "கீழ்",
  "என",
]);

/** Zero-width joiner and non-joiner: invisible, and they break equality tests. */
const ZERO_WIDTH = /[\u200C\u200D]/gu;

/** Token boundary: any run of whitespace, punctuation or symbols. */
const TOKEN_BOUNDARY = /[\s\p{P}\p{S}]+/u;

/** Any character in the Tamil Unicode block, including combining marks. */
const TAMIL_CHAR = /[\u0B80-\u0BFF]/u;

/** A token written wholly in Tamil, with nothing Latin mixed in. */
const TAMIL_ONLY = /^[\u0B80-\u0BFF]+$/u;

/** Suffixes stripped by the light stemmer, longest first so "es" beats "s". */
const STEM_SUFFIXES = ["ing", "ed", "es", "s"] as const;

/** Shortest stem the stemmer will produce. Below this, stripping loses meaning. */
const MIN_STEM_LENGTH = 3;

/**
 * Shortest Tamil form allowed to act as a stem.
 *
 * Two characters is often a bare syllable that prefixes half the language, so
 * a shorter form would match almost anything.
 */
const MIN_TAMIL_PREFIX = 3;

/**
 * Canonical form of a string: NFC, lowercase, no zero-width marks, single
 * spaces, trimmed.
 *
 * Lowercasing is safe for Tamil, which is unicameral — it only affects the
 * Latin half of a Tanglish query.
 */
export function normalizeText(input: string): string {
  return input
    .normalize("NFC")
    .toLowerCase()
    .replace(ZERO_WIDTH, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Split normalised text into raw tokens, dropping empties. */
export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  if (normalized === "") {
    return [];
  }
  return normalized.split(TOKEN_BOUNDARY).filter((token) => token !== "");
}

/**
 * Tokens that carry meaning: stopwords removed and English inflections
 * flattened so "waiting" and "waited" collide with "wait".
 */
export function contentTokens(input: string): string[] {
  const kept: string[] = [];
  for (const token of tokenize(input)) {
    if (ENGLISH_STOPWORDS.has(token) || TAMIL_STOPWORDS.has(token)) {
      continue;
    }
    kept.push(stem(token));
  }
  return kept;
}

/**
 * Strip one English inflection suffix.
 *
 * Only the first matching suffix is considered, and only when what remains is
 * long enough to still be a word — so "wishes" becomes "wish" while "goes" and
 * "cats" are left alone. Tamil is agglutinative and its suffixes are not these,
 * so any token carrying Tamil characters is returned untouched.
 */
function stem(token: string): string {
  if (TAMIL_CHAR.test(token)) {
    return token;
  }
  for (const suffix of STEM_SUFFIXES) {
    if (!token.endsWith(suffix)) {
      continue;
    }
    const candidate = token.slice(0, token.length - suffix.length);
    return candidate.length > MIN_STEM_LENGTH ? candidate : token;
  }
  return token;
}

/** True when every character of `token` is Tamil. */
export function isTamilToken(token: string): boolean {
  return TAMIL_ONLY.test(token);
}

/**
 * True when two Tamil tokens share a root, judged by prefix containment.
 *
 * Tamil is agglutinative: case, tense and postposition suffixes are glued onto
 * the root, so a user's பொறுமையாக will essentially never equal a corpus
 * பொறுமை. Real morphological stripping needs a full suffix grammar; prefix
 * containment captures most of the same pairs with none of the guesswork.
 *
 * Deliberately Tamil-only — applied to Latin it would match "car" against
 * "cardiology".
 */
export function tamilPrefixMatch(a: string, b: string): boolean {
  if (!isTamilToken(a) || !isTamilToken(b)) {
    return false;
  }
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length < MIN_TAMIL_PREFIX) {
    return false;
  }
  return longer.startsWith(shorter);
}

/**
 * Bounded Levenshtein: true when `a` can be edited into `b` in `max` steps.
 *
 * Ranking calls this once per query token per alias, so it bails as soon as
 * the cheapest cell in a row already exceeds the budget rather than filling
 * the whole matrix.
 */
export function levenshteinWithin(a: string, b: string, max: number): boolean {
  if (a === b) {
    return true;
  }
  if (max < 0) {
    return false;
  }
  // Each length unit of difference costs at least one insertion or deletion.
  if (Math.abs(a.length - b.length) > max) {
    return false;
  }

  const columns = b.length;
  let previous: number[] = new Array<number>(columns + 1);
  for (let j = 0; j <= columns; j += 1) {
    previous[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    const current: number[] = new Array<number>(columns + 1);
    current[0] = i;
    let bestInRow = i;
    for (let j = 1; j <= columns; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const deletion = (previous[j] ?? Number.MAX_SAFE_INTEGER) + 1;
      const insertion = (current[j - 1] ?? Number.MAX_SAFE_INTEGER) + 1;
      const substitution = (previous[j - 1] ?? Number.MAX_SAFE_INTEGER) + cost;
      const value = Math.min(deletion, insertion, substitution);
      current[j] = value;
      if (value < bestInRow) {
        bestInRow = value;
      }
    }
    if (bestInRow > max) {
      return false;
    }
    previous = current;
  }

  return (previous[columns] ?? Number.MAX_SAFE_INTEGER) <= max;
}
