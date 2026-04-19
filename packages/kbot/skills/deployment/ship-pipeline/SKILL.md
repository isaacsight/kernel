---
name: ship-pipeline
description: Use before any release to kernel.chat or npm publish of kbot. Six gates, each must pass. Skipping a gate is how regressions ship.
version: 1.0.0
author: kbot
license: MIT
metadata:
  kbot:
    tags: [deploy, release, ship, quality, gates]
    related_skills: [test-driven-development, systematic-debugging]
---

# Ship Pipeline

Six gates, in order. Each must be green before the next runs. The `/ship` slash command executes them; you can run them manually when investigating.

## Iron Law

```
NO GATE SKIPS. NO REORDERING. NO "I'LL RUN IT AFTER DEPLOY."
```

A gate that's inconvenient is a gate that's catching something. Skipping is how regressions ship to 4,800 weekly-download users.

## The Gates

### 1. Security (`guardian`)

- Secret scan — no API keys, tokens, or `.env` content in the diff.
- Dependency audit — `npm audit` clean or documented exceptions.
- OWASP checks on anything touching user input or external calls.
- SSRF guards present on new fetch calls.

### 2. QA (`qa`)

- `npx tsc --noEmit` — strict typecheck.
- `npm run test` — full test suite green.
- Any UI change: dev server + browser verification for the golden path AND one edge case.
- No `console.log`, no commented-out code in the diff.

### 3. Design (`aesthete` / `designer`)

- Design tokens used, not raw values. `--rubin-primary`, not `#6B5B95`.
- Spacing uses the scale (`--space-*`), not magic numbers.
- A11y: keyboard nav works, contrast meets AA, screen reader labels present.
- Motion: reduced-motion media query respected.

### 4. Performance (`performance`)

- Bundle budget: main JS < 300KB gzip, CSS < 150KB gzip.
- No new dependencies > 50KB gzip without discussion.
- Lazy-load still works for route-level components.
- Service worker cache invalidation tested.

### 5. DevOps (`devops`)

- Edge functions deploy cleanly to Supabase.
- Migrations are reversible.
- GitHub Pages build succeeds locally.
- Version bumped correctly in package.json.

### 6. Product (`product`)

- Feature actually does what the issue says it does.
- Mobile-first: tested at 375px width.
- Empty state, loading state, error state all present.
- The change is something a user would *notice* — not invisible plumbing shipped as a feature.

## Running It

- `/ship` in Claude Code runs all six in sequence.
- Manually: `/security-audit` → `/qa` → `/design-check` → `/perf` → `/devops` → `/team` (product review).
- For kbot itself: `cd packages/kbot && npm run typecheck && npm run test && npm run build && npm publish --dry-run`.

## Anti-Pattern

Running the gates in parallel "to save time." They're sequential because later gates depend on earlier ones passing (no point running design checks on a build that won't compile). The serial wait is the feature.

## Rollback Plan

Every deploy must have one. For kernel.chat: previous gh-pages tag. For kbot: `npm deprecate @kernel.chat/kbot@<version>` + publish a patched version. Know the rollback before shipping, not after breaking.
