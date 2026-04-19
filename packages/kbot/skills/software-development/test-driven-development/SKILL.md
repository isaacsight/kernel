---
name: test-driven-development
description: Use when adding any new behavior or fixing any bug. Red → Green → Refactor, enforced.
version: 1.0.0
author: kbot
license: MIT
metadata:
  kbot:
    tags: [tdd, testing, quality, vitest]
    related_skills: [systematic-debugging, ship-pipeline]
---

# Test-Driven Development

## Iron Law

```
THE FIRST COMMIT ON ANY BEHAVIOR CHANGE IS A FAILING TEST.
```

No exceptions. Not "I'll add tests after." Not "this is too small." The failing test proves you understood the behavior before you wrote it.

## Why

- Writing the test first forces you to design the interface, not the implementation.
- A failing test that turns green is the only honest proof the fix works.
- Tests written after the fact confirm what you already did, not what you should have done.
- Coverage that grows alongside code never has a "we should add tests" backlog.

## The Cycle

### RED

1. Decide what the new behavior is, in one sentence.
2. Write the smallest test that would fail if the behavior is missing.
3. Run it. Confirm it fails for the *right reason* (not a typo, not a missing import).

### GREEN

1. Write the minimum code that makes the test pass.
2. No extra features. No refactoring yet. No "while I'm here."
3. Run the test. Confirm green.

### REFACTOR

1. Now — and only now — clean up the implementation.
2. Rename, extract, deduplicate. Tests still green the whole time.
3. If a refactor turns a test red, you changed behavior — revert and think.

## kbot Toolchain

- Framework: **Vitest** (`.test.ts` next to source).
- Runner: `npx vitest run` (one-shot) or `npx vitest` (watch).
- Typecheck gate: `npx tsc --noEmit` before every commit. Strict mode is non-negotiable.
- UI tests: `@testing-library/react`.
- E2E: Playwright (`npm run test:e2e`).

## Mocking Policy

- Mock Supabase. Never call the real API in tests.
- Mock the Claude proxy. Never call the real API in tests.
- Do NOT mock your own pure functions — test them directly.
- Do NOT mock file I/O — use `tmpdir()` fixtures.

## Anti-Patterns

- Tests that assert implementation details (internal method calls) instead of observable behavior.
- Tests that share state between cases. Each test starts clean.
- Test names like `it('works')`. Name the behavior: `it('rejects unauthenticated requests')`.
- "Fix the test" when the test correctly catches a regression. Fix the code.

## When kbot Should Run Tests Autonomously

After any edit under `src/` or `packages/kbot/src/`, kbot runs `npm run typecheck` and `npx vitest run <affected>` before reporting success. No UI claim without a browser check (see `ship-pipeline`).
