# Claude Instructions for singjam-connect

singjam-connect is a platform for musicians to find jam partners based on shared repertoire.

## Branching

- Never commit directly to `main`
- All work — including small fixes — must be done in a new branch
- Branch names should follow the pattern: `type/short-description` (e.g. `feat/jam-invite`, `fix/auth-redirect`, `chore/update-deps`)
- Open a pull request to merge into `main`

## Commit Messages

Use a hybrid of conventional and descriptive style:
- Prefix with a type: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- Follow with a short, plain-English description of what changed and why
- Example: `feat: add match score to jam card so users can prioritise by compatibility`

## Code Style

- Use **server components** by default; only use `"use client"` when interactivity is required
- Use **Tailwind CSS** for all styling — no inline styles
- Third-party UI libraries require explicit approval before being added — propose in a PR description or issue first
- Keep solutions simple — do not add features, abstractions, or refactors beyond what was asked
- Do not add comments unless the logic is genuinely non-obvious

## Database

- All schema changes **must** include a new migration file in `supabase/migrations/`
- Never modify the schema directly via the Supabase dashboard without a corresponding migration file
- Migration files should be named with an incrementing number prefix: `002_description.sql`

## Testing

- All new features must include tests before merging
- Focus especially on: auth flows, data mutations, and matching logic

## Pull Requests

Every PR must include:
- **What changed** — a clear summary of the changes
- **Why** — the motivation or context behind the change
- **Screenshots** — before/after visuals for any UI changes
- **Verification steps** — how to manually test or confirm the change works
- **Build check** — confirm `npm run build` passes locally before opening the PR
