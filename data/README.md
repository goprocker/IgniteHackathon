# Proverb corpus (`data/proverbs.json`)

The curated Tamil proverb (பழமொழி) corpus. Every recommendation the app shows
resolves to one of these records — nothing is ever generated, paraphrased, or
machine-translated at request time. The file is a JSON array of records loaded
and validated at module load by `lib/corpus.ts`.

## Review status and the accuracy bar

> **These entries currently carry `"native-reviewed"` status pending
> verification by a Tamil speaker before final judging.** The status reflects
> the author's confidence that each proverb is real and widely documented; it is
> not yet a signed-off human review.
>
> **`"verified"` must only ever be set after an actual human review** by a Tamil
> speaker who has confirmed the script, the transliteration, the meaning, and
> the usage. Never set it programmatically, in bulk, or to make a check pass.

A fabricated proverb is the worst failure this product can have. Only add a
proverb you can genuinely attest is a real, widely documented Tamil proverb. If
you are unsure, drop it — fewer solid entries beat more shaky ones. Do not
"translate" an English idiom into Tamil and present it as a proverb.

`"draft"` entries are **excluded from the served index**: `getCorpus()` filters
them out, so they never reach recommendations or the demo. Use `draft` for
entries that are still being written or are awaiting an accuracy check.
`getAllRecords()` returns everything including drafts, for tooling and review.

## Record format

Shape is defined by `ProverbRecord` in `lib/types.ts` and enforced by
`proverbRecordSchema` in `lib/schema.ts`. Those two files are the contract; this
section explains intent.

| Field | Purpose |
| --- | --- |
| `id` | Stable kebab-case slug, derived from the transliteration (see below). Used as the lookup key and in API responses. Never renamed once published. |
| `proverbTamil` | The proverb in Tamil script, correctly and fully formed. Displayed verbatim. |
| `transliteration` | Readable Latin transliteration (ISO-ish, **no** academic diacritics) — e.g. `Alavukku minjinaal amirthamum nanju`. Aimed at a reader who does not read Tamil script. |
| `englishMeaning` | One-line literal or near-literal rendering of what the proverb says. |
| `explanationEnglish` | 1–2 sentences: what the proverb teaches and when to use it. |
| `explanationTamil` | The same guidance in Tamil. |
| `themes` | 1–3 slugs from the closed theme vocabulary. Primary ranking signal for topical fit. |
| `emotions` | 1–3 slugs from the closed emotion vocabulary. The tone the proverb carries when offered as advice. |
| `keywordsEnglish` | 5–10 lowercase single words a user might actually type when describing the situation. Lexical match surface. |
| `keywordsTamil` | 3–6 Tamil words for Tamil-script queries. |
| `tanglishAliases` | 3–6 romanised Tamil words a user types on a Latin keyboard (`pisinari`, `mudhalali`, `aasai`). Bridges Tanglish queries to Tamil concepts. |
| `exampleSituations` | Exactly 3 entries, one each with `language` `"en"`, `"ta"`, `"tanglish"`. **These carry the most ranking weight.** |
| `source` | `{ title, url?, license? }`. Attribution and the trail for later review. |
| `reviewStatus` | `"draft"` \| `"native-reviewed"` \| `"verified"`. See above. |

### Example situations

These are the highest-weighted ranking field, so write them as **modern,
concrete situations a young person would actually describe** — phone addiction,
exam cramming, group projects, overspending, ignoring advice, job bonds,
group-chat arguments. They are not restatements of the proverb and not
period-piece village scenes. Keyword-rich beats elegant: the words a real user
would type should appear in the text.

### `id` convention

Lowercase kebab-case derived from the leading words of the transliteration,
long enough to be unambiguous and short enough to read in a URL — e.g.
`Alavukku minjinaal amirthamum nanju` → `alavukku-minjinaal`. Ids are permanent
identifiers: fix a wrong transliteration without touching the id.

## Closed vocabularies

`themes` — pick 1–3, exactly as spelled:

`moderation`, `patience`, `consequences`, `effort`, `greed`, `unity`, `pride`,
`preparation`, `wisdom`, `appearances`, `thrift`, `gratitude`, `humility`,
`adaptability`, `speech`

`emotions` — pick 1–3, exactly as spelled:

`warning`, `encouragement`, `criticism`, `reassurance`, `regret`, `concern`,
`approval`

Both lists are closed. Adding a value means updating this file, the corpus
tests, and any ranking code that switches on the vocabulary — not just dropping
a new string into a record.

## Contribution rules

1. **Schema validation.** Every record must pass `proverbRecordSchema`.
   `lib/corpus.ts` validates the whole file at module load and throws, naming
   the offending index and id, if it does not. A bad corpus fails the build
   rather than degrading the app at runtime.
2. **Unique ids.** Ids must be unique across the file; the loader throws and
   names the duplicates.
3. **No duplicates.** One record per proverb. Do not add a second entry for a
   variant spelling or a regional wording — extend the existing record's
   keyword and alias lists instead.
4. **Source metadata required.** Every record needs a `source.title`. Add `url`
   and `license` whenever a citable published source exists; that is what makes
   an entry verifiable by the reviewer.
5. **Vocabularies.** Themes and emotions must come from the closed lists above.
6. **Spread the themes.** The corpus exists so ranking has something to
   discriminate on. Prefer a proverb that covers a thin theme over another
   entry on a well-covered one.
7. **Run the tests.** `npm test` — `tests/corpus.test.ts` covers count,
   uniqueness, schema, vocabularies, and the example-situation language cover.
