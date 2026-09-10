import { z } from "zod";
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH } from "@/lib/types";

export const languageCodeSchema = z.enum(["ta", "en", "tanglish"]);

export const reviewStatusSchema = z.enum([
  "draft",
  "native-reviewed",
  "verified",
]);

export const exampleSituationSchema = z.object({
  language: languageCodeSchema,
  text: z.string().min(1),
});

export const proverbSourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url().optional(),
  license: z.string().min(1).optional(),
});

export const proverbRecordSchema = z.object({
  id: z.string().min(1),
  proverbTamil: z.string().min(1),
  transliteration: z.string().min(1),
  englishMeaning: z.string().min(1),
  explanationTamil: z.string().min(1),
  explanationEnglish: z.string().min(1),
  themes: z.array(z.string().min(1)).min(1),
  emotions: z.array(z.string().min(1)),
  keywordsTamil: z.array(z.string().min(1)),
  keywordsEnglish: z.array(z.string().min(1)),
  tanglishAliases: z.array(z.string().min(1)),
  exampleSituations: z.array(exampleSituationSchema).min(1),
  source: proverbSourceSchema,
  reviewStatus: reviewStatusSchema,
});

export const proverbCorpusSchema = z.array(proverbRecordSchema);

/**
 * Request body for `POST /api/recommend`.
 *
 * Trimming happens before length checks so whitespace-only input is rejected
 * as too short rather than sneaking past a raw `.length` test.
 */
export const recommendRequestSchema = z.object({
  text: z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(MIN_QUERY_LENGTH)
        .max(MAX_QUERY_LENGTH),
    ),
});

export type RecommendRequest = z.infer<typeof recommendRequestSchema>;
