import proverbsJson from "@/data/proverbs.json";
import { proverbCorpusSchema } from "@/lib/schema";
import type { ProverbRecord } from "@/lib/types";

/**
 * The corpus plus the inverse-document-frequency weights the ranker needs.
 *
 * `documentCount` is carried alongside `idf` so a scorer never has to re-derive
 * N from `records.length` and risk drifting from the numbers the map was built
 * with.
 */
export interface CorpusIndex {
  records: ProverbRecord[];
  idf: Map<string, number>;
  documentCount: number;
}

/**
 * Minimal local tokeniser.
 *
 * A shared `normalize` module is being built in parallel; this stays private to
 * the loader so the two efforts do not collide, and is deliberately small
 * enough to be replaced by a one-line import later.
 */
function tokenize(value: string): string[] {
  return value
    .normalize("NFC")
    .toLowerCase()
    .split(/[\s\p{P}\p{S}]+/u)
    .filter((token) => token.length > 0);
}

/** Every searchable string on a record, flattened for tokenisation. */
function documentTerms(record: ProverbRecord): Set<string> {
  const fields: string[] = [
    record.proverbTamil,
    record.transliteration,
    record.englishMeaning,
    record.explanationTamil,
    record.explanationEnglish,
    ...record.themes,
    ...record.emotions,
    ...record.keywordsTamil,
    ...record.keywordsEnglish,
    ...record.tanglishAliases,
    ...record.exampleSituations.map((situation) => situation.text),
  ];

  const terms = new Set<string>();
  for (const field of fields) {
    for (const token of tokenize(field)) {
      terms.add(token);
    }
  }
  return terms;
}

/**
 * Parse the bundled JSON.
 *
 * A malformed corpus is a build-time data bug, not a runtime condition to
 * degrade around, so this throws rather than returning a partial corpus — the
 * app must not boot on data the ranker cannot trust.
 */
function parseCorpus(): ProverbRecord[] {
  // Only `id` is read, and only to make a validation failure identifiable.
  const rawRecords: ReadonlyArray<{ id?: unknown }> = proverbsJson;
  const parsed = proverbCorpusSchema.safeParse(proverbsJson);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => {
        const index = issue.path[0];
        if (typeof index !== "number") {
          return `corpus root: ${issue.message}`;
        }
        const id = rawRecords[index]?.id;
        const label =
          typeof id === "string" ? `entry ${index} (id "${id}")` : `entry ${index}`;
        return `${label} at "${issue.path.join(".")}": ${issue.message}`;
      })
      .join("; ");

    throw new Error(`data/proverbs.json failed schema validation — ${details}`);
  }

  return parsed.data;
}

function assertUniqueIds(records: readonly ProverbRecord[]): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const record of records) {
    if (seen.has(record.id)) {
      duplicates.add(record.id);
    }
    seen.add(record.id);
  }

  if (duplicates.size > 0) {
    const listed = [...duplicates].sort().join(", ");
    throw new Error(`data/proverbs.json has duplicate ids: ${listed}`);
  }
}

const ALL_RECORDS: ProverbRecord[] = parseCorpus();
assertUniqueIds(ALL_RECORDS);

/** Lookup table so `getById` stays O(1) instead of scanning on every call. */
const RECORDS_BY_ID: Map<string, ProverbRecord> = new Map(
  ALL_RECORDS.map((record) => [record.id, record]),
);

const SERVED_RECORDS: ProverbRecord[] = ALL_RECORDS.filter(
  (record) => record.reviewStatus !== "draft",
);

let cachedIndex: CorpusIndex | null = null;

/** Records eligible for recommendation. Drafts are withheld from the index. */
export function getCorpus(): ProverbRecord[] {
  return SERVED_RECORDS;
}

/** Every record on disk, drafts included. For tooling and review workflows. */
export function getAllRecords(): ProverbRecord[] {
  return ALL_RECORDS;
}

export function getById(id: string): ProverbRecord | undefined {
  return RECORDS_BY_ID.get(id);
}

/**
 * IDF weights over the served corpus, computed once per process.
 *
 * The `1 +` terms keep the result finite and strictly positive even when a term
 * appears in every document, so a scorer never has to guard against zero or
 * negative weights.
 */
export function getCorpusIndex(): CorpusIndex {
  if (cachedIndex !== null) {
    return cachedIndex;
  }

  const records = getCorpus();
  const documentCount = records.length;
  const documentFrequency = new Map<string, number>();

  for (const record of records) {
    for (const term of documentTerms(record)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, frequency] of documentFrequency) {
    idf.set(term, Math.log(1 + documentCount / (1 + frequency)));
  }

  cachedIndex = { records, idf, documentCount };
  return cachedIndex;
}
