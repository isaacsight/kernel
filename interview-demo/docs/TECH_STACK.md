# Tech Stack

Every choice is a bet. Here's each bet and why.

## Frontend

| Pick | Why | Runner-up | Why not |
|---|---|---|---|
| **React 19** | Actions, `useOptimistic`, `use()` for streaming — built for this product | Svelte 5 | Smaller ecosystem for audio libs; React 19 concurrent features matter here |
| **Vite** | Instant HMR, ESM-native, 100x faster than Webpack | Next.js | Don't need SSR for a logged-in studio app; adds complexity |
| **TypeScript (strict)** | Non-negotiable for API surface clarity | — | — |
| **Tailwind v4** | Design-token driven, no `styled-components` runtime cost | CSS Modules | Slower to iterate on |
| **shadcn/ui** | Copy-paste, fully owned, a11y out of the box | MUI | Bundle size + opinionated look |
| **Zustand** | Tiny, no Provider, works outside React | Redux Toolkit | Overkill for this scale |
| **TanStack Query** | Server state, cache invalidation, optimistic updates | SWR | Fewer features for mutations |
| **React Router v7** | Standard, loaders/actions pattern | TanStack Router | Smaller community |
| **WaveSurfer.js** | Battle-tested waveform UI, peaks from JSON | Peaks.js | Less active maintenance |
| **Motion (Framer)** | Layout animations for drawer + track list | CSS `@keyframes` | Can't do shared layout transitions cleanly |

## Backend / Edge

| Pick | Why | Runner-up | Why not |
|---|---|---|---|
| **Hono** | 10kb, Workers-native, Zod middleware, WebSocket support | Express | Not Workers-native |
| **Cloudflare Workers** | Global edge, 0ms cold start, cheap, WS via Durable Objects | Vercel Functions | Cold starts; per-region |
| **Durable Objects** | Stateful WS connection holder, single-writer guarantees | Redis pub/sub | Extra service to run |
| **Zod** | Schema validation shared client↔server | Yup | Worse TS inference |

## Data

| Pick | Why | Runner-up | Why not |
|---|---|---|---|
| **Supabase** | Postgres + Auth + Storage + RLS, one dashboard | Firebase | Document model is wrong shape for this data |
| **Postgres 15** | RLS, `LISTEN/NOTIFY`, `jsonb`, trigrams for search | SQLite | No concurrent write path |
| **Supabase Auth** | Magic link + OAuth out of box, JWT issuer | Clerk | Extra vendor |
| **Cloudflare R2** | S3-compat, $0 egress, co-located with Workers | Supabase Storage | Higher egress cost |

## Audio

| Pick | Why |
|---|---|
| **Suno API** | The product we're demoing to. First-class integration. |
| **WaveSurfer.js** | Rendering + scrubbing |
| **audio-decode + fft.js (server)** | Generate peaks JSON once, cache forever |
| **FFmpeg-wasm (client, fallback)** | If we need mid-client transcoding (probably skip for v1) |

## Testing

| Layer | Tool |
|---|---|
| Unit | Vitest |
| Component | Vitest + @testing-library/react + happy-dom |
| API (edge) | Vitest + miniflare |
| E2E | Playwright (Chromium + Mobile Safari profile) |
| Visual regression | Playwright screenshots (per-route) |

## Tooling

| Purpose | Tool |
|---|---|
| Package manager | pnpm |
| Monorepo | pnpm workspaces (apps/web, apps/edge, packages/shared) |
| Linting | ESLint 9 flat config + Prettier 3 |
| Git hooks | simple-git-hooks + lint-staged |
| CI | GitHub Actions |
| Secrets | Doppler (dev) + Cloudflare secrets (prod) |

## What I'm NOT using (and why)

- **Next.js** — SSR/SSG adds complexity for a studio app that's 100% authed.
- **GraphQL** — REST + TS types is simpler at this scale.
- **tRPC** — Fine choice, but I want plain HTTP so the API could be consumed
  by a mobile app or CLI without TS.
- **Redux** — Zustand + React Query covers it.
- **Docker for dev** — Supabase CLI + `wrangler dev` is faster to onboard.
- **Microservices** — One Worker is enough. Split only when a bottleneck proves itself.
- **Kafka / SQS** — Postgres `NOTIFY` carries us to ~1000 QPS. Ship, measure, upgrade if needed.

## Bundle budget

| Bundle | Target (gzipped) |
|---|---|
| Initial JS | < 80 KB |
| Initial CSS | < 15 KB |
| Per-route lazy chunk | < 40 KB |
| Total transfer (landing → playable) | < 250 KB |

Enforced via `size-limit` in CI. See [`PERFORMANCE.md`](./PERFORMANCE.md).

## Versions (pinned in root `package.json`)

```json
{
  "engines": { "node": ">=20.11", "pnpm": ">=9" },
  "react": "^19.0.0",
  "vite": "^6.0.0",
  "typescript": "^5.6.0",
  "hono": "^4.6.0",
  "@supabase/supabase-js": "^2.45.0",
  "wavesurfer.js": "^7.8.0",
  "zod": "^3.23.0",
  "zustand": "^5.0.0",
  "@tanstack/react-query": "^5.59.0"
}
```
