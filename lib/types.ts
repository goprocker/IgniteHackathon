/**
 * Single source of truth for types shared between the API routes and the UI.
 *
 * Both sides import from this file, so a contract drift surfaces as a type
 * error rather than a runtime surprise.
 */

/** Languages the recommender accepts and classifies. */
export type LanguageCode = "ta" | "en" | "tanglish";

/**
 * How a set of results was produced.
 *
 * `local` is the deterministic lexical/theme ranking. `ollama` is reserved for
 * the semantic pipeline in a later milestone, and `fallback` marks a response
 * where nothing matched and results were filled by review standing alone.
 * Declaring all three now means adding Ollama does not change the contract.
 */
export type RecommendMode = "ollama" | "local" | "fallback";

/** Curation state of a corpus entry. Draft entries never reach the demo index. */
export type ReviewStatus = "draft" | "native-reviewed" | "verified";

/** A situation showing how a proverb is used, written in one language. */
export interface ExampleSituation {
  language: LanguageCode;
  text: string;
}

/** Where a proverb was sourced from, for attribution and later review. */
export interface ProverbSource {
  title: string;
  url?: string;
  license?: string;
}

/**
 * One curated proverb. Every recommendation the app displays must resolve to
 * a record of this shape — nothing is ever generated or paraphrased.
 */
export interface ProverbRecord {
  id: string;
  proverbTamil: string;
  transliteration: string;
  englishMeaning: string;
  explanationTamil: string;
  explanationEnglish: string;
  themes: string[];
  emotions: string[];
  keywordsTamil: string[];
  keywordsEnglish: string[];
  tanglishAliases: string[];
  exampleSituations: ExampleSituation[];
  source: ProverbSource;
  reviewStatus: ReviewStatus;
}

/** A single ranked result as returned to the client. */
export interface Recommendation {
  id: string;
  proverbTamil: string;
  transliteration: string;
  englishMeaning: string;
  theme: string;
  contextualFitTamil: string;
  contextualFitEnglish: string;
  /** Absolute 35-96 band. Never 0 or 100 — both misrepresent a lexical match. */
  confidence: number;
}

/** Payload of a successful `POST /api/recommend`. */
export interface RecommendData {
  query: string;
  language: LanguageCode;
  mode: RecommendMode;
  results: Recommendation[];
  latencyMs: number;
}

/** Payload of a successful `GET /api/health`. */
export interface HealthData {
  status: "ok";
  corpusCount: number;
  fallbackReady: boolean;
  ollamaReachable: boolean;
}

/** Machine-readable error codes. Messages are safe to show to users. */
export type ErrorCode =
  | "INVALID_INPUT"
  | "EMPTY_CORPUS"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL";

export interface ApiError {
  code: ErrorCode;
  message: string;
}

/** Every API response uses this envelope. */
export type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

/** Input bounds from PRD FR-1. */
export const MIN_QUERY_LENGTH = 3;
export const MAX_QUERY_LENGTH = 1200;

/** Number of proverbs returned per successful recommendation (PRD FR-2). */
export const RESULT_COUNT = 3;
