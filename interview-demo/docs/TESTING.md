# Testing

Three layers, each answering a different question.

| Layer | Tool | Question it answers |
|---|---|---|
| Unit | Vitest | Does this pure function return the right thing? |
| Integration | Vitest + miniflare / Supabase CLI | Does this module work with its real dependencies? |
| E2E | Playwright | Does the product work from the user's perspective? |
| Visual regression | Playwright screenshots + Chromatic | Did any pixel change unintentionally? |
| Perf probe | Playwright + custom FPS harness | Did animations slow down? |

---

## Unit (Vitest)

Fast, deterministic, no I/O. Every pure function with non-trivial
logic has at least one test.

```ts
// tokens/share.test.ts
import { generateShareToken, validateShareToken } from './share';

test('generateShareToken produces 22-char URL-safe string', () => {
  const t = generateShareToken();
  expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/);
});

test('100 tokens are all unique', () => {
  const set = new Set(Array.from({ length: 100 }, generateShareToken));
  expect(set.size).toBe(100);
});
```

### Conventions

- File next to source: `share.ts` + `share.test.ts`.
- One describe block per function/class, one test per behavior.
- AAA pattern (Arrange, Act, Assert) — blank lines between sections.
- No mocking inside unit tests. If a function is hard to test because
  it has dependencies, that's a design smell — refactor.

### Coverage

Target ≥ 80% line coverage on `packages/shared` and `apps/edge/src/lib`.
Not enforced as a hard gate (coverage chasing → bad tests) but tracked
monthly.

---

## Integration (Vitest + miniflare / Supabase local)

Tests a module against a real dependency. Slower than unit, much
faster than E2E.

### Edge API tests

Miniflare runs the Workers runtime locally. We spin it up with a real
Postgres (via `supabase start` → local Postgres container).

```ts
// api/generate.integration.test.ts
import { describe, it, beforeAll, expect } from 'vitest';
import { unstable_dev } from 'wrangler';

describe('POST /generate', () => {
  let worker;
  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      local: true,
      env: 'test',
    });
  });

  it('creates a generation row and returns id', async () => {
    const res = await worker.fetch('/api/v1/generate', {
      method: 'POST',
      headers: { authorization: `Bearer ${TEST_JWT}` },
      body: JSON.stringify({ prompt: 'test', duration_sec: 30 }),
    });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.generation_id).toMatch(/^gen_/);
  });

  it('rejects missing auth', async () => {
    const res = await worker.fetch('/api/v1/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
    });
    expect(res.status).toBe(401);
  });
});
```

### DB tests

Every migration gets a test that verifies: (a) it applies cleanly,
(b) RLS policies behave correctly, (c) indexes exist as expected.

```ts
// migrations/202604_add_shares.test.ts
import { createClient } from '@supabase/supabase-js';

test('share policy: user can read their own shares', async () => {
  const alice = createClient(URL, ALICE_JWT);
  const bob = createClient(URL, BOB_JWT);

  const { data: aliceShare } = await alice
    .from('shares').insert({ playlist_id: ALICE_PLAYLIST }).select().single();

  const { data: aliceRead } = await alice
    .from('shares').select().eq('id', aliceShare.id).single();
  expect(aliceRead).toBeTruthy();

  const { data: bobRead, error } = await bob
    .from('shares').select().eq('id', aliceShare.id).single();
  expect(bobRead).toBeNull();
  expect(error?.code).toBe('PGRST116'); // row not found via RLS
});
```

### Mock Suno

Integration tests never call Suno. A `fake-suno` module mounts a
miniflare Worker that mimics the Suno API with configurable
latency + failure modes. Used in:

- Success-path generation tests
- Timeout tests (fake-suno holds the request 30s)
- Webhook auth tests (fake-suno fires webhook with correct/incorrect
  HMAC)

---

## E2E (Playwright)

The product works for the user. We run against a deployed preview env
(CF Pages + Workers) on every PR.

### Critical flows covered

1. **Signup → first generation → play** (CP1 + CP2 from
   [`PERFORMANCE.md`](./PERFORMANCE.md))
2. Regenerate a segment
3. Create playlist, add tracks, reorder
4. Create share link, open in anon window, play
5. Revoke share, anon window gets 404
6. Offline generation queue + reconnect sync
7. Keyboard-only navigation through studio
8. Screen reader flow (via axe-playwright)

### Profiles

Tests run on:
- Desktop Chromium
- Desktop Safari (Webkit)
- Mobile Safari (simulated iPhone 15)
- Mobile Chrome (Pixel 7)

iPad profile added for the Procreate angle. Apple Pencil inputs
simulated via `pointerEvents` with pressure/tilt.

### Fixtures

Each test starts with a clean DB seeded with a standard fixture user
+ 3 tracks + 1 playlist. Seed is in `tests/fixtures/seed.sql`. Test
teardown truncates user-owned tables; public tables stay.

### Example

```ts
// tests/e2e/generate.spec.ts
import { test, expect } from '@playwright/test';

test('first generation plays within 10s', async ({ page }) => {
  await page.goto('/studio');
  await page.fill('[data-testid=prompt]', 'lofi piano, 72 BPM');
  await page.click('[data-testid=generate]');

  // Wait for streaming UI
  await expect(page.locator('[data-testid=waveform]')).toBeVisible({
    timeout: 2000,
  });

  // Wait for audio element to have src and be playing
  const audioReady = await page.waitForFunction(
    () => {
      const a = document.querySelector('audio');
      return a && a.readyState >= 3 && !a.paused;
    },
    { timeout: 10_000 }
  );
  expect(audioReady).toBeTruthy();
});
```

---

## Visual regression (Chromatic / Playwright screenshots)

Every component in Storybook captured on every PR. Pixel diffs
surface in PR comments — reviewer approves or rejects. Design
engineer and the relevant designer tagged on any diff.

Config:
- Resolution: 1x + 2x (retina)
- Viewports: 375px (mobile), 1024px (tablet), 1440px (desktop)
- Modes: light, dark, reduced-motion

Thresholds:
- Anti-aliasing + subpixel fuzziness ignored.
- 0.1% pixel change threshold for flag.

---

## Perf probe

Playwright-based FPS harness runs on 5 critical interactions:

1. Open the command palette (Cmd-K).
2. Drag a track row in playlist (reorder).
3. Scrub the waveform at speed.
4. Open and close the settings drawer rapidly 10×.
5. Scroll through a 500-item library list.

Each records FPS histogram via `performance.timeline`. CI fails if:
- Average < 55fps on desktop profile
- Average < 45fps on mid-tier mobile profile
- Any single frame > 33ms (one dropped frame at 60fps)

---

## Accessibility testing

Three layers:

1. **Automated via axe** — every E2E test runs `axe-playwright`
   on the final state. Fails on any violation.
2. **Keyboard-only E2E** — dedicated spec that completes CP1 without
   ever using the mouse.
3. **Manual screen-reader pass** — quarterly, via NVDA + Firefox and
   VoiceOver + Safari iOS. Documented in
   `tests/accessibility/sr-checklist.md`.

---

## Security testing

- **SAST**: Semgrep on every PR. Rules from Cloudflare OWASP pack +
  custom.
- **Secret scan**: Gitleaks pre-commit + CI.
- **Dependency scan**: Renovate + Snyk + `pnpm audit --audit-level high`
  fail CI.
- **RLS policy tests**: see Integration section.
- **Auth fuzz**: Playwright spec hits `/auth/*` with malformed
  tokens, expired tokens, and bypass attempts.

---

## Test data

Production data never enters test environments. Period.

Seeds are synthetic:
- Users have fake emails (@test.setlist.app).
- Tracks reference real but licensed audio clips (stored in
  `tests/fixtures/audio/`).
- Seed committed to repo (small files only).

---

## Flaky tests

A test that fails once without code changing is quarantined same day
(moved to `tests/quarantine/` + ticket filed). We fix flakes, we
don't live with them.

Triage rule: if `quarantine/` > 5 tests, engineering pauses feature
work until it's back to ≤ 2.

---

## CI pipeline

```
PR opened:
  1. Lint (Biome)                      — 20s
  2. Typecheck (tsc --noEmit)          — 60s
  3. Unit tests (Vitest)               — 45s
  4. Integration tests (Vitest + PG)   — 120s
  5. Build + size-limit                 — 90s
  6. Deploy preview env (CF Pages)      — 60s
  7. E2E against preview (Playwright)   — 180s
  8. Visual regression (Chromatic)      — 60s
  9. Perf probe                         — 45s
  10. Lighthouse CI                     — 60s

Total: ~13 minutes end-to-end. Parallel-safe.
```

Steps 1-5 can fail without deploying a preview (fail fast). Steps
6-10 require preview. Steps 7-10 can run in parallel.

---

## On local dev

`pnpm test:watch` — Vitest watch, runs affected tests on change.
`pnpm test:e2e` — Playwright in headed mode (visual debugging).
`pnpm test:e2e:debug` — Playwright with inspector.
`pnpm test:all` — full suite locally (rare; usually CI).

Pre-push hook runs lint + typecheck + unit tests. Fails prevent push.

---

## The philosophy

Tests are a debugging aid that lasts forever. Write them for the
person six months from now who's reading the test to understand what
the code was supposed to do.

A well-written test is documentation. A badly-written test is a tax.
The difference: a well-written test fails clearly and rarely, tells
you what broke, and survives refactors.

- Test behaviors, not implementations.
- Prefer one clear assertion per test.
- Name tests as "when X, then Y" sentences.
- If a test breaks on every refactor, it's testing too much.
- If a test never breaks, it's not testing anything.
