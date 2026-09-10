# Product Requirements Document: Pazhamozhi AI

| Field | Value |
| --- | --- |
| Status | Approved for MVP implementation |
| Version | 1.0 |
| Date | 2026-09-11 |
| Repository | `goprocker/ignite` |
| Product type | Local-first bilingual web application |
| Primary audience | Young bilingual Tamil speakers |

## 1. Product summary

Pazhamozhi AI recommends the Tamil proverb that best matches a situation or
piece of writing supplied in Tamil, English, or Tanglish. It presents the
proverb in Tamil, provides a readable transliteration and English meaning, and
explains the contextual connection without inventing or rewriting proverbs.

The hackathon MVP will run locally on a laptop, use the existing Ollama models,
and provide a polished conversational interface inspired by the ergonomics of
modern AI chat products while retaining an original Tamil visual identity.

## 2. Problem and opportunity

Tamil proverbs compress cultural experience into short, memorable expressions,
but many younger speakers understand conversational Tamil without knowing when
or how traditional proverbs apply. Existing proverb lists require exact keyword
search and rarely explain contextual relevance. Users need a low-friction way
to move from a modern situation to culturally grounded traditional wisdom.

The technical challenge is semantic matching across Tamil and English rather
than literal translation. The product must recognize themes such as patience,
moderation, cooperation, pride, preparation, and consequence even when the
input shares no words with the recommended proverb.

## 3. Goals and success measures

### Product goals

1. Recommend three contextually relevant Tamil proverbs from free-form input.
2. Support Tamil, English, and common Tanglish phrasing in one composer.
3. Teach meaning and usage through concise bilingual explanations.
4. Operate without paid APIs or internet access during the live demo.
5. Make recommendation quality measurable and easy to improve.

### MVP success measures

| Metric | Target |
| --- | --- |
| Gold proverb appears in top three | At least 80% on the reviewed evaluation set |
| Top result judged contextually relevant | At least 4/5 mean human rating |
| Tamil and English input parity | Less than 10 percentage-point Top-3 gap |
| Unsupported or invented proverbs | 0 in evaluation runs |
| Warm recommendation latency | Under 8 seconds on the target laptop |
| Deterministic fallback latency | Under 500 ms |
| Critical user flow completion | 100% in supported desktop and mobile browsers |

### Non-goals for the hackathon MVP

- User accounts, social graphs, or cloud synchronization
- Automatic web scraping of proverb collections
- User-submitted proverbs entering the trusted corpus without review
- Speech recognition, image OCR, or voice synthesis
- A public production deployment dependent on local Ollama
- Generating new sayings and presenting them as traditional proverbs

## 4. Users and key scenarios

### Primary persona

A Tamil speaker aged 15-30 who is comfortable reading English, understands
spoken Tamil, and wants to use culturally appropriate proverbs in conversation,
schoolwork, social posts, or creative writing.

### Secondary personas

- A non-Tamil learner using transliteration and English explanations
- A teacher demonstrating how traditional sayings apply to modern situations
- A writer looking for a proverb that reinforces a paragraph or dialogue scene

### Core user journey

1. The user opens the application and sees a focused chat composer plus example
   situations.
2. The user writes a situation in Tamil, English, or Tanglish and submits it.
3. The conversation immediately shows the user message and an analysis state.
4. The assistant returns three ranked proverbs with meaning and contextual fit.
5. The user copies a proverb, rates the answer, or asks about another situation.
6. The conversation remains available locally until the user starts a new chat.

## 5. Functional requirements

### FR-1: Conversational input

- Accept plain text from 3 to 1,200 characters.
- Detect Tamil script, English, or Tanglish without a language selector.
- Submit with the send button or Enter; Shift+Enter inserts a newline.
- Reject empty and oversized input with an inline, accessible error.
- Provide curated example prompts before the first message.

### FR-2: Recommendations

- Return exactly three ranked results when at least three corpus entries exist.
- Use only proverbs identified by an immutable corpus ID.
- Display Tamil text, transliteration, English meaning, primary theme,
  contextual explanation, and confidence.
- Clearly distinguish a fast local fallback result when Ollama is unavailable.
- Never expose raw model prompts, stack traces, or internal exception messages.

### FR-3: Chat experience

- Use a familiar chat layout: history/navigation sidebar, scrollable message
  transcript, assistant and user turns, and a composer anchored at the bottom.
- On mobile, replace the persistent sidebar with an accessible navigation drawer.
- Preserve the active conversation in browser storage.
- Support starting a new chat without deleting the underlying proverb corpus.
- Show local AI status without blocking deterministic fallback use.

### FR-4: Result actions

- Copy an individual Tamil proverb and its meaning.
- Record thumbs-up or thumbs-down feedback locally with the query and result IDs.
- Prevent repeated rapid submissions while a request is in progress.
- Announce loading, success, copy, and error states to assistive technology.

### FR-5: Corpus exploration

- The MVP chat response may expose theme labels for discovery.
- A dedicated browse page is deferred until the core recommendation quality and
  chat flow meet acceptance criteria.

## 6. Experience and visual direction

The first viewport is the working recommender, not a marketing landing page.
The empty conversation state uses an original Tamil cultural image and example
prompts, while subsequent turns prioritize readable content density.

The design uses charcoal, white, leaf green, turmeric yellow, and restrained red
accents. Tamil text receives generous line height and a font stack with robust
Tamil glyph support. Repeated proverb results may use compact cards with a
maximum 8 px radius; sections and the overall conversation remain unframed.

Buttons use familiar icons for send, copy, feedback, menu, and new conversation,
with labels or tooltips where their purpose is not immediately obvious. The UI
must not copy another product's logo, trademark, exact colors, or proprietary
visual details.

## 7. Recommendation system

### Processing pipeline

```text
User text
  -> validation and Unicode normalization
  -> lightweight language classification
  -> lexical scoring across multilingual corpus fields
  -> semantic retrieval with nomic-embed-text
  -> top candidate set
  -> structured reranking and explanation with qwen2.5:7b
  -> schema validation against corpus IDs
  -> three results or deterministic fallback
```

### Retrieval

- `nomic-embed-text:latest` supplies local embeddings through Ollama.
- Corpus embeddings are built lazily and cached in server memory.
- Candidate score combines semantic similarity and deterministic lexical/theme
  overlap so a weak embedding cannot completely suppress an exact cultural cue.
- The top eight candidates are eligible for reranking.

### Reranking and explanation

- `qwen2.5:7b` receives the input and candidate IDs with trusted corpus fields.
- The model returns structured JSON containing only candidate IDs, a fit score,
  and short Tamil and English contextual explanations.
- Output is validated; unknown IDs, duplicates, malformed scores, or missing
  results are discarded.
- Valid model rankings are merged with retrieval scores and capped at three.

### Fallback behavior

If Ollama, the embedding model, or the language model is unavailable, the API
returns the lexical/theme ranking with corpus-authored usage explanations. The
interface labels the response as fallback mode but remains fully usable.

## 8. Proverb data contract

The starter corpus will contain 150-300 entries before final judging. An initial
smaller reviewed slice may be used while building the interface and pipeline.

```ts
type ProverbRecord = {
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
  exampleSituations: Array<{
    language: "ta" | "en" | "tanglish";
    text: string;
  }>;
  source: {
    title: string;
    url?: string;
    license?: string;
  };
  reviewStatus: "draft" | "native-reviewed" | "verified";
};
```

Every displayed recommendation must resolve to one of these records. Draft
records may be used during development but are excluded from the final demo
index. Corpus changes require schema validation, duplicate detection, source
metadata, and Tamil-speaker review.

## 9. Public interfaces

### `POST /api/recommend`

Request:

```json
{
  "text": "My friend ignored every warning and now regrets it."
}
```

Successful response:

```json
{
  "success": true,
  "data": {
    "query": "My friend ignored every warning and now regrets it.",
    "language": "en",
    "mode": "ollama",
    "results": [
      {
        "id": "proverb-id",
        "proverbTamil": "...",
        "transliteration": "...",
        "englishMeaning": "...",
        "theme": "consequences",
        "contextualFitTamil": "...",
        "contextualFitEnglish": "...",
        "confidence": 86
      }
    ],
    "latencyMs": 1240
  }
}
```

Failure response:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Enter a situation between 3 and 1,200 characters."
  }
}
```

### `GET /api/health`

Returns application status, Ollama reachability, required model availability,
corpus count, and whether fallback mode is ready. It must not reveal filesystem
paths or unrelated locally installed models.

## 10. Technical architecture

- **Application:** Next.js App Router with TypeScript and strict type checking
- **UI:** React client component for chat state; server components for the shell
- **API:** Node.js route handlers with schema-validated JSON envelopes
- **Inference:** Local Ollama at configurable `OLLAMA_BASE_URL`
- **Models:** `nomic-embed-text:latest` and `qwen2.5:7b`
- **Storage:** Versioned corpus in the repository; browser storage for chats and
  feedback; in-memory embedding cache
- **Testing:** Vitest for unit/integration coverage and Playwright for the main
  browser journey
- **Deployment target:** Local Windows laptop for the hackathon MVP

No Python service, database, authentication provider, or paid external API is
required for the MVP. This keeps installation, startup, and demo recovery simple.

### Planned repository shape

```text
app/                  Next.js pages and API routes
components/           Chat and proverb result components
data/                 Versioned proverb corpus and data documentation
lib/                  Validation, retrieval, Ollama, and recommendation logic
public/               Local visual assets
tests/                Unit, integration, and end-to-end tests
docs/                 Product, architecture, and evaluation documentation
.agents/              Antigravity agent configuration managed separately
```

## 11. Security, privacy, and reliability

- User text remains on the local machine and is sent only to local Ollama.
- Input is length-limited, normalized, and treated as untrusted data.
- Model output is parsed as data and never rendered as raw HTML.
- Prompts instruct the model to choose only supplied IDs; server validation
  enforces that boundary regardless of model behavior.
- Logs omit complete user submissions by default.
- Requests use timeouts and return a fallback instead of hanging the UI.
- No secrets, model binaries, generated vector indexes, or local chat history
  are committed to Git.

## 12. Evaluation plan

Create a gold dataset of at least 60 situations: 20 Tamil, 20 English, and 20
Tanglish. Each item contains one preferred proverb, up to two acceptable
alternatives, themes, and reviewer notes. At least two Tamil speakers review
each final item; disagreements are resolved before scoring.

Automated evaluation reports Top-1 accuracy, Top-3 recall, mean reciprocal rank,
language split, average latency, fallback rate, and invalid-ID rate. Human review
scores contextual fit, cultural correctness, clarity, and usefulness from 1-5.

## 13. Test and acceptance plan

### Automated tests

- Unicode normalization and language classification for Tamil, English, mixed,
  Tanglish, punctuation-only, and whitespace-heavy input
- Corpus schema, unique IDs, required source metadata, and review-state filtering
- Lexical scoring, cosine similarity, stable tie-breaking, and top-k limits
- Valid and malformed Ollama embedding/reranking responses
- Timeout, connection failure, unknown candidate ID, and fallback paths
- API validation for malformed JSON, short input, oversized input, and success
- Chat submission, loading state, result rendering, copy, feedback, persistence,
  new conversation, keyboard behavior, and mobile navigation

### Definition of done

- All acceptance metrics in section 3 are met or documented with evidence.
- Type checking, linting, unit tests, production build, and E2E tests pass.
- Core modules achieve at least 80% statement and branch coverage.
- No critical or high-severity security findings remain.
- Desktop and mobile screenshots show no overlap, clipping, blank media, or
  inaccessible controls.
- The demo can recover automatically when Ollama is stopped or a model times out.
- README contains exact setup, model verification, development, test, and demo
  commands verified on the target laptop.

## 14. Delivery milestones

### Milestone 1: Foundation

Bootstrap Next.js, define schemas, add the initial reviewed corpus, implement
deterministic ranking, and establish CI checks.

### Milestone 2: Local AI pipeline

Add Ollama health checks, cached embeddings, structured reranking, validation,
timeouts, and deterministic fallback tests.

### Milestone 3: Conversational interface

Build the responsive chat shell, empty state, examples, result presentation,
copy/feedback actions, local persistence, and accessible loading/error states.

### Milestone 4: Quality and demo readiness

Expand the corpus, complete gold-set evaluation, tune retrieval weights, run
browser verification, document the live demo script, and record known limits.

## 15. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Installed embedding model performs poorly on Tamil | Blend semantic and lexical signals; evaluate by language; rely on reranking |
| Local model latency interrupts the demo | Warm models before presenting, enforce timeout, and keep fallback instant |
| Model invents or alters a proverb | Pass trusted IDs and fields, validate IDs, and render corpus text only |
| Corpus contains inaccurate or regional variants | Require sources, review states, and native-speaker approval |
| Tanglish spelling varies widely | Store aliases, normalize common forms, and include Tanglish evaluation cases |
| Two development sessions modify the same files | Keep work on separate branches and integrate through reviewed pull requests |

## 16. GitHub delivery policy

- The repository bootstrap may land directly on the empty `main` branch.
- Every later product change uses a short-lived branch and pull request.
- Pull requests include a purpose summary, linked issue when applicable, test
  evidence, UI screenshots for visual changes, and known limitations.
- CI must run formatting/lint, type checking, tests, coverage, and production
  build before merge.
- Meaningful bugs receive an issue with reproduction steps, expected behavior,
  severity, and the fixing PR link. Minor defects found and fixed within the
  same active change may remain documented in that PR.
- Commit messages follow Conventional Commits and remain focused enough to
  revert independently.
