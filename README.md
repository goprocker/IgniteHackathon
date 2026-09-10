# Pazhamozhi AI

**Describe a situation in Tamil, English, or Tanglish — get the Tamil proverbs
(பழமொழி) that actually fit it.**

Not keyword search. You describe what happened, and it finds the proverb whose
*meaning* matches, then explains why.

```
"My friend ignored everyone's advice and now regrets his decision"

  81%  ஆழம் அறியாமல் காலை விடாதே
       Aazham ariyaamal kaalai vidaathe
       "Do not step in before you know the depth."
       Why this fits: acting without understanding the situation first.

  66%  தான் செய்த வினை தன்னைச் சுடும்
       Thaan seitha vinai thannai sudum
       "The deed you do is the deed that burns you."
```

Runs entirely on your machine. No API keys, no accounts, no network calls.

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Quick start](#quick-start)
- [Commands](#commands)
- [How matching works](#how-matching-works)
- [API reference](#api-reference)
- [Data model](#data-model)
- [Corpus and curation policy](#corpus-and-curation-policy)
- [Architecture](#architecture)
- [Accessibility and internationalisation](#accessibility-and-internationalisation)
- [Testing](#testing)
- [Development workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)
- [Limitations and roadmap](#limitations-and-roadmap)

---

## Why this exists

Tamil proverbs compress generations of lived experience into a handful of words.
Plenty of younger Tamil speakers understand conversational Tamil perfectly well
but have never learned *when* a proverb applies — so the tradition thins out one
generation at a time.

Existing proverb collections are alphabetical lists. They require you to already
know the words you are looking for, which is exactly the knowledge you are
missing. This inverts the problem: describe the situation in whichever language
comes naturally, and get the proverb whose meaning matches.

The interesting technical problem is **semantic matching across scripts and
languages** — recognising that "he kept going despite everything" and
"முயற்சி" and "avan give up panne le" point at the same idea, even when the
query and the proverb share no words at all.

The full product specification is in [docs/PRD.md](docs/PRD.md).

---

## Quick start

**Requires Node.js 20.9 or newer.** Developed on 22.11. Nothing else — no
database, no API keys, no model server.

```bash
git clone https://github.com/goprocker/ignite.git
cd ignite
npm install
npm run dev
```

Open <http://localhost:3000>.

Try these to see all three input modes working:

| Input | What it exercises |
| --- | --- |
| `our group project only worked because everyone helped each other` | English → unity, 94% |
| `நான் மிகவும் பொறுமையாக காத்திருந்தேன்` | Tamil script → patience, 80% |
| `avan romba pisinari, yaarukkum help panna maatan` | Tanglish → thrift, 83% |
| `zzzz qqqq xxxx` | No-match fallback, all results at the 35% floor |

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (`eslint-config-next` flat config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |

CI runs `lint`, `typecheck`, `test`, and `build` on every pull request.

---

## How matching works

There is **no embedding model and no LLM** in this build. Matching is
deterministic, which makes it fast (single-digit milliseconds), reproducible,
and testable.

```
user text
   ↓  normalise      NFC, lowercase, strip ZWJ/ZWNJ, tokenize, drop stopwords
   ↓  detect language ta | en | tanglish
   ↓  score           IDF-weighted field overlap + theme triggers
   ↓  diversify       at most one result per primary theme
   ↓  top 3
```

### Language detection

Computed over letters only, ignoring digits, spaces and punctuation:

- Tamil-block character ratio ≥ 0.30 → `ta`
- otherwise, any token hitting the Tanglish alias index → `tanglish`
  (exact match, or edit distance ≤ 1 for tokens of 5+ characters, since
  romanised Tamil spelling varies wildly between writers)
- otherwise → `en`

### Scoring

Each proverb accumulates a score across its fields. Inverse document frequency
is computed once over the whole corpus, so words common to every record cannot
dominate on a corpus this small.

| Field | Weight | | Field | Weight |
| --- | ---: | --- | --- | ---: |
| `keywordsTamil` | 3.0 | | `emotions` | 1.5 |
| `keywordsEnglish` | 3.0 | | `proverbTamil` | 1.2 |
| `tanglishAliases` | 2.5 | | `englishMeaning` | 1.0 |
| `exampleSituations` | 2.2 | | `transliteration` | 1.0 |
| `themes` | 2.0 | | | |

```
fieldScore(f) = Σ idf(t) · m(t) / √(|F| + 3)
final         = 0.70·tanh(lex / 3) + 0.20·themeScore + 0.10·reviewWeight
confidence    = clamp(round(35 + 61·final), 35, 96)
```

Match strength `m` is tiered: **1.0** exact, **0.8** Tamil shared root,
**0.6** romanised fuzzy. Field weights are further multiplied by a language
factor — a Tamil query leans on Tamil fields, a Tanglish one on romanised
aliases.

### Tamil is agglutinative

This is the single most important detail in the ranker. A user writes
**பொறுமையாக**; the corpus stores the root **பொறுமை**. Tamil glues case, tense,
and postposition suffixes onto roots, so *exact token equality essentially never
fires* for real Tamil input.

Wholly-Tamil tokens therefore match by **prefix containment** when the shorter
side is at least 3 Tamil characters, scored at 0.8 — below an exact hit, above a
romanised fuzzy match. Latin and mixed-script tokens are excluded from this
rule, so `car` can never match `cardiology`.

Before this was handled, every inflected Tamil query scored exactly zero and
fell through to the no-match path.

### Two load-bearing properties

**Nothing is generated.** Every recommendation resolves to a record in
`data/proverbs.json` by immutable id, and the "why this fits" text is assembled
by template from that record's *own* explanation plus its matched theme labels.
No model ever writes prose about a proverb, so no model can invent one. This
makes the "zero invented proverbs" requirement true by construction rather than
by trusting a model to behave.

**Results are deterministic.** Ordering never relies on `Array.sort` stability;
every comparison ends in a total tie-break on id (score → themes matched →
review standing → id). The same query returns the same three proverbs every
time, which is what lets the test suite assert exact ordering.

### Confidence is absolute

Confidence is a monotonic function of the same score used for ordering, so a
result can never display a lower percentage than the one beneath it. It is
absolute rather than relative to the best match in the run — a query matching
nothing reads as 35%, not as "best of a bad set". It is also clamped to 35–96:
neither 0% nor 100% honestly describes a lexical match.

---

## API reference

### `POST /api/recommend`

**Request**

```json
{ "text": "My friend ignored every warning and now regrets it" }
```

`text` is trimmed, then must be 3–1200 characters.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "query": "My friend ignored every warning and now regrets it",
    "language": "en",
    "mode": "local",
    "latencyMs": 6,
    "results": [
      {
        "id": "aazham-ariyaamal-kaalai-vidaathe",
        "proverbTamil": "ஆழம் அறியாமல் காலை விடாதே",
        "transliteration": "Aazham ariyaamal kaalai vidaathe",
        "englishMeaning": "Do not step in before you know the depth.",
        "theme": "wisdom",
        "contextualFitTamil": "...",
        "contextualFitEnglish": "...",
        "confidence": 81
      }
    ]
  }
}
```

`mode` is one of:

| Value | Meaning |
| --- | --- |
| `local` | Deterministic ranking found real matches |
| `fallback` | Nothing matched; results are corpus defaults at the confidence floor |
| `ollama` | Reserved for semantic retrieval; not emitted yet |

**Error response**

```json
{ "success": false, "error": { "code": "INVALID_INPUT", "message": "..." } }
```

| Code | Status | Cause |
| --- | ---: | --- |
| `INVALID_INPUT` | 400 | Malformed JSON, missing `text`, or length out of bounds |
| `METHOD_NOT_ALLOWED` | 405 | `GET` on `/api/recommend` |
| `EMPTY_CORPUS` | 503 | No servable proverbs |
| `INTERNAL` | 500 | Unexpected failure |

Error `message` values are always author-written. Internal exception text,
stack traces, and filesystem paths never reach the client — the original error
is logged server-side only.

### `GET /api/health`

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "corpusCount": 15,
    "fallbackReady": true,
    "ollamaReachable": true
  }
}
```

`ollamaReachable` is **informational only**. Semantic retrieval is not wired up,
and an unreachable model server never prevents the deterministic ranker from
serving — `fallbackReady` depends solely on the corpus.

---

## Data model

Every record in `data/proverbs.json`:

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | `string` | Immutable kebab-case slug. **Never change one** — stored user feedback references it |
| `proverbTamil` | `string` | The proverb in Tamil script |
| `transliteration` | `string` | Readable Latin, not academic diacritics |
| `englishMeaning` | `string` | What it means |
| `explanationTamil` / `explanationEnglish` | `string` | What it teaches and when to use it |
| `themes` | `string[]` | 1–3 from the closed vocabulary; `themes[0]` is primary and drives diversity |
| `emotions` | `string[]` | warning, encouragement, criticism, reassurance, regret, concern, approval |
| `keywordsTamil` / `keywordsEnglish` | `string[]` | Words a *user* would type — not vocabulary lifted from the proverb |
| `tanglishAliases` | `string[]` | How people really type Tamil on a Latin keyboard, spelling variants included |
| `exampleSituations` | `{language, text}[]` | Exactly 3, one each `ta`/`en`/`tanglish` |
| `source` | `{title, url?, license?}` | Attribution |
| `reviewStatus` | `enum` | `draft` \| `native-reviewed` \| `verified` |

**Closed theme vocabulary** (15): moderation, patience, consequences, effort,
greed, unity, pride, preparation, wisdom, appearances, thrift, gratitude,
humility, adaptability, speech.

`exampleSituations` carry the heaviest ranking weight, so they must describe
**modern, concrete situations** — phone addiction, exam cramming, group projects,
overspending — never a restatement of the proverb itself.

The corpus is validated against a Zod schema **at module load**. A malformed
record is a build-time data bug, not a runtime condition to degrade around, so
the app refuses to boot rather than serve data the ranker cannot trust. The
error names the entry index, its id, and the failing field path.

Format details and contribution rules: [data/README.md](data/README.md).

---

## Corpus and curation policy

**Entries are `native-reviewed`, not `verified`.** Promotion to `verified`
requires review by a Tamil speaker.

During curation, six candidates were rejected and replaced:

| Rejected | Why |
| --- | --- |
| பார்ப்பதெல்லாம் பொன்னல்ல | Calque of "all that glitters is not gold" |
| பேசாமல் இருப்பது பொன் | Calque of "silence is golden" |
| விதைப்பது எதுவோ அறுப்பதும் அதுவே | Biblical echo circulating in Tamil, not native |
| ஆசையே துன்பத்திற்குக் காரணம் | Buddhist doctrinal statement, not a பழமொழி |
| ஒற்றுமையே பலம் | Modern slogan rather than a documented proverb |
| வாய்ச்சொல்லில் வீரர் | Bharathi line; proverb status not certain enough |

That bar is the whole point. **A fabricated proverb is invisible to precisely
the audience this is built for** — someone who already knew would not need the
app. Coverage was traded for confidence every time, and anyone extending the
corpus is expected to do the same.

---

## Architecture

```
app/
  layout.tsx              Fonts, metadata                          [server]
  page.tsx                Renders <ChatApp/>                        [server]
  globals.css             Design tokens, Tamil typography rules
  api/recommend/route.ts  POST — validate → rank → envelope
  api/health/route.ts     GET  — status, corpus count, Ollama probe
components/
  chat/chat-app.tsx       ← the single "use client" boundary
  chat/composer.tsx       Autosize textarea, IME guard, validation
  chat/transcript.tsx     Scroll container, stick-to-bottom
  chat/proverb-card.tsx   Result card, copy, feedback
  chat/empty-state.tsx    Kolam motif, greeting, example chips
  ui/                     Icon button, live regions
lib/
  types.ts    Shared domain + API types — single source of truth
  schema.ts   Zod mirrors; a type test pins them to types.ts
  http.ts     ok() / fail() envelope helpers
  corpus.ts   Load, validate, memoised IDF index
  normalize.ts / language.ts / themes.ts / rank.ts
  chat-reducer.ts
data/    Corpus + its documentation
tests/   Vitest unit and API integration suites
.claude/agents/   Subagent definitions used to build and extend this project
```

**The client boundary sits in exactly one place.** `layout.tsx` and `page.tsx`
are server components; `ChatApp` and everything below it is client. Conversation
state, clipboard, focus management, and scroll position are all inherently
client concerns — pushing the boundary lower would mean prop-drilling `dispatch`
across a server boundary, which is impossible.

Composer draft text lives in the composer's **own** state, never the shared
reducer, so a keystroke cannot re-render the transcript.

`rankProverbs` takes records and the IDF index as **parameters** rather than
importing `lib/corpus.ts`, which keeps it pure and testable against small inline
fixtures.

---

## Accessibility and internationalisation

**IME composition.** Tamil phonetic keyboards commit candidates with **Enter**.
The composer ignores Enter while `event.nativeEvent.isComposing` is true —
without it, users typing Tamil submit a half-finished word every time they pick
a candidate. Invisible to anyone testing in English; it breaks the primary input
method for the target audience.

**Tamil text rendering.** Noto Sans Tamil via `next/font` with a Nirmala UI
fallback, 1.9 line-height (combining marks sit above and below the base glyph
and clip at tight leading), and explicit rules preventing `word-break: break-all`
and ellipsis truncation — both split grapheme clusters and render nonsense.

**Screen readers.** One `aria-live="polite"` region for status, a separate
`role="alert"` for errors. Thinking-phase changes are deliberately *not*
announced — narrating every step is spam. Every icon button requires a `label`
prop, typed so it cannot be omitted.

**Colour.** Confidence is shown as a number alongside its bar, never encoded by
colour alone. Light and dark themes are both driven by the same token set.

---

## Testing

```bash
npm run test
```

96 tests across 6 suites:

| Suite | Covers |
| --- | --- |
| `schema.test.ts` | Type/schema drift, trim-before-length ordering, bounds |
| `corpus.test.ts` | Schema validity, unique ids, closed vocabularies, IDF weighting |
| `normalize.test.ts` | NFC, ZWJ/ZWNJ, stopwords, stemming guards, Tamil prefix matching |
| `language.test.ts` | Script ratio thresholds, alias hits, fuzzy Tanglish |
| `rank.test.ts` | Determinism, tie-breaks, diversity, monotonic confidence, fallback floor |
| `api-recommend.test.ts` | Envelope contract, validation, error-leak prevention |

Two assertions worth knowing about:

```ts
// Every returned id must resolve to a real corpus entry —
// the strongest guard that a result is a genuine proverb.
const knownIds = new Set(getCorpus().map(r => r.id));
for (const r of data.results) expect(knownIds.has(r.id)).toBe(true);

// The JSON parser's own wording must never reach the client.
expect(error.message).not.toMatch(/SyntaxError|Unexpected token|at position \d+/i);
```

---

## Development workflow

- `main` is stable. `preprod` is the integration branch.
- Work lands on short-lived `feat/*`, `fix/*`, `chore/*`, `ci/*`, or `docs/*`
  branches via pull request into `preprod`.
- Conventional Commits, each focused enough to revert independently.
- CI gates every PR on lint, typecheck, tests, and a production build.

`.claude/agents/` holds three specialist subagent definitions — `corpus-curator`,
`ranking-engineer`, and `chat-ui-builder` — encoding the rules above so they
survive beyond the session that wrote them.

---

## Troubleshooting

**Port 3000 already in use** — `npm run dev -- -p 3001`.

**`ollamaReachable: false`** — expected and harmless. Ollama is optional; the
recommender does not use it yet.

**Tamil renders as boxes** — the system font fallback is missing. `next/font`
should fetch Noto Sans Tamil at build time; check network access during
`npm install` / `npm run build`.

**Corpus fails to load with a schema error** — the message names the entry index,
its id, and the failing field. Fix `data/proverbs.json`; the app is refusing to
serve untrustworthy data by design.

**A Tamil query returns the 35% fallback** — the root form is probably missing
from `keywordsTamil` on the record you expected. Prefix matching needs at least
3 Tamil characters of shared root.

---

## Limitations and roadmap

**Known limitations**

- **Corpus is 15 proverbs** against a 150–300 target.
- **English coverage is uneven.** "phone all night, can't wake up for class"
  ranks *thrift* above *moderation* — thin keyword coverage on those records, a
  corpus-tuning problem rather than an algorithm one.
- **No semantic retrieval.** The deterministic ranker does all the work, so
  paraphrases sharing no vocabulary with a record will miss.
- **Conversations are not persisted** between reloads, and feedback is local to
  each card.
- **No Playwright end-to-end suite.**
- Verified on Windows / Node 22.11 only.

**Next**

1. Ollama semantic retrieval — `nomic-embed-text` for candidate recall,
   `qwen2.5:7b` for reranking, with the deterministic path kept as the fallback.
2. Corpus expansion with native-speaker verification.
3. A 60-item gold evaluation set (20 Tamil / 20 English / 20 Tanglish) measuring
   Top-1, Top-3, and MRR by language.
4. Conversation history and persisted feedback.

---

## License

Not yet specified.
