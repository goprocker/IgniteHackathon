import {
  contentTokens,
  isTamilToken,
  levenshteinWithin,
  tamilPrefixMatch,
  tokenize,
} from "@/lib/normalize";
import { matchThemes, themeLabel } from "@/lib/themes";
import { RESULT_COUNT } from "@/lib/types";
import type {
  LanguageCode,
  ProverbRecord,
  RecommendMode,
  Recommendation,
  ReviewStatus,
} from "@/lib/types";

/**
 * Deterministic lexical + theme ranking.
 *
 * Everything here is pure: the corpus index arrives as a parameter, nothing is
 * read from disk or the network, and no result text is generated — contextual
 * fit is assembled from fields the record already carries.
 */

/** Scored fields of a record, in the order they contribute to `lex`. */
type FieldName =
  | "keywordsTamil"
  | "keywordsEnglish"
  | "tanglishAliases"
  | "exampleSituations"
  | "themes"
  | "emotions"
  | "proverbTamil"
  | "englishMeaning"
  | "transliteration";

/** How much each field is worth. Curated keyword lists outrank free prose. */
const FIELD_WEIGHTS: Record<FieldName, number> = {
  keywordsTamil: 3.0,
  keywordsEnglish: 3.0,
  tanglishAliases: 2.5,
  exampleSituations: 2.2,
  themes: 2.0,
  emotions: 1.5,
  proverbTamil: 1.2,
  englishMeaning: 1.0,
  transliteration: 1.0,
};

const FIELD_NAMES = Object.keys(FIELD_WEIGHTS) as FieldName[];

/**
 * Fields where a near miss still counts.
 *
 * Romanised Tamil has no fixed spelling ("kadhal" / "kadal"), so only those
 * fields tolerate an edit. Fuzzy matching English prose would just add noise.
 */
const FUZZY_FIELDS: ReadonlySet<FieldName> = new Set<FieldName>([
  "tanglishAliases",
  "transliteration",
]);

/**
 * Multipliers per kind of token hit.
 *
 * The ordering matters more than the values: an exact hit must always outrank
 * a shared Tamil root, which must outrank a romanised spelling guess.
 */
const EXACT_MATCH = 1.0;
const TAMIL_STEM_MATCH = 0.8;
const FUZZY_MATCH = 0.6;

/** Below this length a one-edit neighbourhood is too wide to mean anything. */
const MIN_FUZZY_LENGTH = 5;

/** Score for a query word the corpus has never seen, so it still counts a little. */
const DEFAULT_IDF = 0.5;

/** Damping added inside the sqrt so a one-word field is not automatically best. */
const LENGTH_DAMPING = 3;

/** Curation standing, folded into the final score so drafts sink. */
const REVIEW_WEIGHTS: Record<ReviewStatus, number> = {
  verified: 1.0,
  "native-reviewed": 0.85,
  draft: 0.4,
};

const LEX_SHARE = 0.7;
const THEME_SHARE = 0.2;
const REVIEW_SHARE = 0.1;

const MIN_CONFIDENCE = 35;
const MAX_CONFIDENCE = 96;
const CONFIDENCE_RANGE = 61;

/**
 * Divisor inside the tanh that squashes an unbounded lexical score into 0..1.
 *
 * Chosen so a solid multi-keyword hit lands in the high band without one
 * enormous score saturating the scale for everything else.
 */
const LEX_SCALE = 3;

export interface RankInput {
  query: string;
  language: LanguageCode;
  records: ProverbRecord[];
  idf: Map<string, number>;
}

export interface RankedResult {
  record: ProverbRecord;
  lex: number;
  themeScore: number;
  final: number;
  confidence: number;
  matchedThemes: string[];
}

/**
 * Rank a corpus against a query and return the display-ready top results.
 *
 * `mode` is `fallback` when nothing matched lexically at all, so the caller can
 * be honest with the user rather than presenting review standing as relevance.
 *
 * `final` is deliberately absolute — no term is normalised against the best
 * score in the run. A run-relative term would hand the top result a perfect
 * lexical share by construction, so a nonsense query would still display high
 * confidence. It also makes ordering and confidence the same quantity, so the
 * displayed numbers descend with the list instead of contradicting it.
 */
export function rankProverbs(input: RankInput): {
  results: Recommendation[];
  mode: RecommendMode;
} {
  const queryTokens = uniqueTokens(contentTokens(input.query));
  const themeHits = matchThemes(input.query, tokenize(input.query));

  const scored: RankedResult[] = input.records.map((record) =>
    scoreRecord(record, queryTokens, themeHits, input),
  );

  const anyLexicalMatch = scored.some((entry) => entry.lex > 0);
  if (!anyLexicalMatch) {
    // Nothing matched, so curation standing is the only ordering left and the
    // displayed number must say exactly that: the floor, not a score.
    const byStanding = [...scored].sort(compareByStanding);
    const results = byStanding
      .slice(0, RESULT_COUNT)
      .map((entry) => toRecommendation(entry, MIN_CONFIDENCE));
    return { results, mode: "fallback" };
  }

  const ranked = [...scored].sort(compareRanked);
  const selected = selectDiverse(ranked).sort(compareRanked);
  return {
    results: selected.map((entry) => toRecommendation(entry, entry.confidence)),
    mode: "local",
  };
}

/** Duplicate query words would double-count a single intent, so collapse them. */
function uniqueTokens(tokens: string[]): string[] {
  return [...new Set(tokens)];
}

function scoreRecord(
  record: ProverbRecord,
  queryTokens: string[],
  themeHits: ReadonlySet<string>,
  input: RankInput,
): RankedResult {
  let lex = 0;
  for (const field of FIELD_NAMES) {
    const fieldSet = fieldTokenSet(record, field);
    const score = fieldScore(queryTokens, fieldSet, field, input.idf);
    if (score === 0) {
      continue;
    }
    lex += FIELD_WEIGHTS[field] * langMultiplier(input.language, field) * score;
  }

  const matchedThemes = record.themes.filter((theme) => themeHits.has(theme));
  const themeScore = matchedThemes.length / Math.max(1, record.themes.length);

  const final =
    LEX_SHARE * Math.tanh(lex / LEX_SCALE) +
    THEME_SHARE * themeScore +
    REVIEW_SHARE * REVIEW_WEIGHTS[record.reviewStatus];

  return {
    record,
    lex,
    themeScore,
    final,
    confidence: toConfidence(final),
    matchedThemes,
  };
}

/** Content tokens of one field, flattened across array and object shapes. */
function fieldTokenSet(record: ProverbRecord, field: FieldName): Set<string> {
  switch (field) {
    case "keywordsTamil":
      return tokenSetOf(record.keywordsTamil);
    case "keywordsEnglish":
      return tokenSetOf(record.keywordsEnglish);
    case "tanglishAliases":
      return tokenSetOf(record.tanglishAliases);
    case "exampleSituations":
      return tokenSetOf(record.exampleSituations.map((example) => example.text));
    case "themes":
      return tokenSetOf(record.themes);
    case "emotions":
      return tokenSetOf(record.emotions);
    case "proverbTamil":
      return tokenSetOf([record.proverbTamil]);
    case "englishMeaning":
      return tokenSetOf([record.englishMeaning]);
    case "transliteration":
      return tokenSetOf([record.transliteration]);
  }
}

function tokenSetOf(values: string[]): Set<string> {
  const tokens = new Set<string>();
  for (const value of values) {
    for (const token of contentTokens(value)) {
      tokens.add(token);
    }
  }
  return tokens;
}

/**
 * Weighted overlap between the query and one field.
 *
 * Dividing by sqrt of the field size discounts long fields without erasing
 * them the way a plain length division would.
 */
function fieldScore(
  queryTokens: string[],
  fieldSet: ReadonlySet<string>,
  field: FieldName,
  idf: Map<string, number>,
): number {
  if (fieldSet.size === 0 || queryTokens.length === 0) {
    return 0;
  }

  const allowFuzzy = FUZZY_FIELDS.has(field);
  let total = 0;
  for (const token of queryTokens) {
    const weight = idf.get(token) ?? DEFAULT_IDF;
    if (fieldSet.has(token)) {
      total += weight * EXACT_MATCH;
      continue;
    }
    // A Tamil query word is inflected; the corpus keyword is a root. Exact
    // equality would score almost every Tamil query at zero.
    if (isTamilToken(token) && hasSharedRoot(token, fieldSet)) {
      total += weight * TAMIL_STEM_MATCH;
      continue;
    }
    if (allowFuzzy && token.length >= MIN_FUZZY_LENGTH && hasNearMatch(token, fieldSet)) {
      total += weight * FUZZY_MATCH;
    }
  }

  return total === 0 ? 0 : total / Math.sqrt(fieldSet.size + LENGTH_DAMPING);
}

function hasSharedRoot(token: string, fieldSet: ReadonlySet<string>): boolean {
  for (const candidate of fieldSet) {
    if (tamilPrefixMatch(token, candidate)) {
      return true;
    }
  }
  return false;
}

function hasNearMatch(token: string, fieldSet: ReadonlySet<string>): boolean {
  for (const candidate of fieldSet) {
    if (levenshteinWithin(token, candidate, 1)) {
      return true;
    }
  }
  return false;
}

/**
 * Tilt field weights toward the script the user wrote in.
 *
 * A Tamil query should be answered mostly out of the Tamil side of a record,
 * and vice versa; Tanglish leans on the romanised surface forms instead.
 */
function langMultiplier(language: LanguageCode, field: FieldName): number {
  if (language === "ta") {
    if (field === "keywordsTamil" || field === "proverbTamil") {
      return 1.3;
    }
    if (field === "keywordsEnglish" || field === "englishMeaning") {
      return 0.8;
    }
    return 1.0;
  }

  if (language === "en") {
    if (field === "keywordsEnglish" || field === "englishMeaning") {
      return 1.3;
    }
    if (field === "keywordsTamil" || field === "proverbTamil") {
      return 0.8;
    }
    return 1.0;
  }

  if (field === "tanglishAliases") {
    return 1.5;
  }
  if (field === "transliteration") {
    return 1.3;
  }
  return 1.0;
}

/**
 * Map the 0..1 final score onto the honest 35-96 band.
 *
 * The band never reaches 0 or 100: a lexical match is evidence, not proof, and
 * a zero would claim certainty the ranker does not have either way.
 */
function toConfidence(final: number): number {
  const raw = Math.round(MIN_CONFIDENCE + CONFIDENCE_RANGE * final);
  return Math.min(MAX_CONFIDENCE, Math.max(MIN_CONFIDENCE, raw));
}

/**
 * Total order over results.
 *
 * Every tier is compared explicitly and the id breaks the last tie, so the
 * output never depends on `Array.prototype.sort` being stable or on the order
 * records happen to sit in the corpus file.
 */
function compareRanked(a: RankedResult, b: RankedResult): number {
  if (a.final !== b.final) {
    return b.final - a.final;
  }
  if (a.themeScore !== b.themeScore) {
    return b.themeScore - a.themeScore;
  }
  const reviewA = REVIEW_WEIGHTS[a.record.reviewStatus];
  const reviewB = REVIEW_WEIGHTS[b.record.reviewStatus];
  if (reviewA !== reviewB) {
    return reviewB - reviewA;
  }
  return compareIds(a.record.id, b.record.id);
}

/** Fallback order: nothing matched, so only curation standing and id remain. */
function compareByStanding(a: RankedResult, b: RankedResult): number {
  const reviewA = REVIEW_WEIGHTS[a.record.reviewStatus];
  const reviewB = REVIEW_WEIGHTS[b.record.reviewStatus];
  if (reviewA !== reviewB) {
    return reviewB - reviewA;
  }
  return compareIds(a.record.id, b.record.id);
}

/** Code-unit comparison — `localeCompare` varies by ICU build and platform. */
function compareIds(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

/**
 * Take the best result per primary theme first, then backfill.
 *
 * Three near-identical proverbs about patience are a worse answer than three
 * angles on the situation, but a thin corpus must still return a full set.
 */
function selectDiverse(ranked: RankedResult[]): RankedResult[] {
  const chosen: RankedResult[] = [];
  const usedThemes = new Set<string>();

  for (const entry of ranked) {
    if (chosen.length >= RESULT_COUNT) {
      break;
    }
    const primary = primaryTheme(entry.record);
    if (usedThemes.has(primary)) {
      continue;
    }
    usedThemes.add(primary);
    chosen.push(entry);
  }

  if (chosen.length < RESULT_COUNT) {
    const taken = new Set(chosen.map((entry) => entry.record.id));
    for (const entry of ranked) {
      if (chosen.length >= RESULT_COUNT) {
        break;
      }
      if (taken.has(entry.record.id)) {
        continue;
      }
      chosen.push(entry);
    }
  }

  return chosen;
}

function primaryTheme(record: ProverbRecord): string {
  return record.themes[0] ?? "";
}

/**
 * Build the client-facing result.
 *
 * Both contextual-fit strings are templates over fields the record already
 * owns — the record's own explanation plus the labels of themes the query
 * matched. No sentence about the proverb's meaning is ever composed here.
 */
function toRecommendation(entry: RankedResult, confidence: number): Recommendation {
  const labels = entry.matchedThemes.map((theme) => themeLabel(theme));
  const { record } = entry;

  return {
    id: record.id,
    proverbTamil: record.proverbTamil,
    transliteration: record.transliteration,
    englishMeaning: record.englishMeaning,
    theme: primaryTheme(record),
    contextualFitTamil: contextualFitTamil(record.explanationTamil, labels),
    contextualFitEnglish: contextualFitEnglish(record.explanationEnglish, labels),
    confidence,
  };
}

function contextualFitEnglish(explanation: string, labels: string[]): string {
  if (labels.length === 0) {
    return explanation;
  }
  return `${explanation} This fits your situation around ${joinLabels(labels)}.`;
}

function contextualFitTamil(explanation: string, labels: string[]): string {
  if (labels.length === 0) {
    return explanation;
  }
  return `${explanation} ${joinLabels(labels)} — இந்தத் தலைப்பில் உங்கள் சூழ்நிலைக்கு இது பொருந்துகிறது.`;
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) {
    return labels[0] ?? "";
  }
  const head = labels.slice(0, -1).join(", ");
  const tail = labels[labels.length - 1] ?? "";
  return `${head} and ${tail}`;
}
