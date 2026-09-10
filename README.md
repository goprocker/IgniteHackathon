# Pazhamozhi AI

Pazhamozhi AI is a local-first Tamil proverb contextual recommender. Given a
situation in Tamil, English, or Tanglish, it returns culturally appropriate
Tamil proverbs with transliteration, meaning, and an explanation of why each
one fits.

The product and engineering specification lives in [docs/PRD.md](docs/PRD.md).

## Current status

The repository is in product-definition and bootstrap stage. Application code
will follow the milestones and acceptance criteria defined in the PRD.

## Development workflow

- `main` is the stable branch.
- Product changes use short-lived `feat/*`, `fix/*`, `docs/*`, or `chore/*`
  branches.
- Every change after repository bootstrap is submitted through a pull request.
- Commits use Conventional Commits, for example `feat: add proverb retrieval`.
- Meaningful bugs are recorded as GitHub issues and linked from the fixing PR.
