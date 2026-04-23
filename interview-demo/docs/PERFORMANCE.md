# Performance

Two kinds of performance: **measured** (numbers) and **perceived**
(feel). Both are contracts with the user. Neither is optional.

---

## Measured budgets

Enforced in CI. A PR that breaks a budget is a PR that doesn't merge.

### Bundle

| Asset | Target | Enforced via |
|---|---|---|
| Initial JS | < 80 KB gzipped | `size-limit` |
| Initial CSS | < 15 KB gzipped | `size-limit` |
| Per-route lazy chunk | < 40 KB gzipped | `size-limit` |
| Landing → playable bytes | < 250 KB total | Lighthouse CI |
| Largest image | < 100 KB | custom check |
| Font subset (Reckless Neue display) | < 30 KB WOFF2 | font-subset-cli |

### Network

| Metric | Target (p75) | Stretch (p95) |
|---|---|---|
| TTFB on edge route | < 100 ms | < 200 ms |
| API GET (`/tracks`) | < 150 ms | < 350 ms |
| API POST (`/generate`) | < 300 ms (returns id) | < 600 ms |
| WebSocket connect | < 80 ms | < 200 ms |
| First WS message | < 150 ms from connect | < 400 ms |

### Browser

| Metric | Target | Measured with |
|---|---|---|
| LCP (Largest Contentful Paint) | < 1.8 s | CrUX + RUM |
| CLS | < 0.1 | CrUX |
| INP (Interaction to Next Paint) | < 200 ms | CrUX |
| Animation FPS | ≥ 55 avg | Playwright FPS probe |
| Scroll FPS | ≥ 58 avg | Playwright FPS probe |

---

## Perceived performance

The felt tempo of the product. Can't be measured by Lighthouse; can
be designed deliberately.

### The perception ladder

| Latency | User feels | Design response |
|---|---|---|
| 0-100 ms | Instant, direct manipulation | No feedback needed |
| 100-300 ms | Responsive, connected | Micro-feedback (hover, press state) |
| 300-1000 ms | Slow but okay | Skeleton, spinner, optimistic UI |
| 1-3 s | Actively waiting | Progress, cancel, show partial results |
| 3-10 s | Losing patience | Stream results, show ETA, allow parallel work |
| 10 s+ | Abandoned | Background with notification |

### Techniques per rung

- **0-100ms**: nothing to do but not block. Use `useTransition` for
  state changes that cause heavy re-render.
- **100-300ms**: press-state CSS, not JS. No skeleton.
- **300-1000ms**: skeleton (shimmer) over spinner. Layout-preserving.
  Optimistic mutation if idempotent.
- **1-3s**: progress bar + cancel button. Show partial results if
  streaming is possible.
- **3-10s**: commit to streaming. For generation: show first segment
  while rest generates. For lists: virtualize + render visible first.
  Allow navigation to other screens (generation continues in
  background).
- **10s+**: background mode. Notification when done. Let the user
  leave.

### The three perceptions to protect

1. **Input responsiveness**. Every click/tap gets a visible
   acknowledgment within 100ms. Even if the backend takes 2s, the
   UI reacts in 100ms (optimistic state, or pressed-down visual).
2. **Forward motion**. The user should never wonder "is it
   broken?" — progress indicators must advance. A frozen progress
   bar is worse than no progress bar. Use `pulse` on the container
   to signal "still working" even when progress is indeterminate.
3. **Partial utility**. Show what you have. Generation streaming.
   List rendering the visible rows first. Any operation that can
   yield partial results should.

---

## Critical paths

### CP1: Landing → first generation

This is the conversion moment. Budget:

```
0 ms     user clicks link
 ↓ 100ms TTFB (edge)
 ↓ 200ms HTML streams in
 ↓ 400ms LCP (canvas skeleton visible)
 ↓ 800ms JS executed, prompt input interactive
 ↓      user types prompt (30-300s)
 ↓      user hits Generate
 ↓ 50ms  optimistic UI transition to generation state
 ↓ 200ms /generate API returns generation_id
 ↓ 80ms  WS connects, subscribes
 ↓ 3-5s  first audio segment decoded, streaming
 ↓       playback begins
```

Critical: the 800ms "JS executed" is the budget that makes or breaks
this. We hit it by:
- Code-splitting the studio route.
- Preloading critical fonts + icons via `<link rel="preload">`.
- Not shipping any non-critical JS on initial paint.
- Using RSC for the public share view (which doesn't need the full
  studio bundle).

### CP2: Generate → first sound

```
0 ms     user hits Generate
 ↓ 50ms  optimistic UI (prompt animates up, waveform canvas appears)
 ↓ 250ms /generate returns id, WS subscribes
 ↓ 200ms Suno begins generation (varies)
 ↓ 3-5s  first 1 second of audio decoded
 ↓ 50ms  audio buffered, <audio> starts playing
 ↓
total ≈ 4-6 seconds prompt → sound
```

**The 5-second contract.** Below that feels magical. Above it feels
slow. Every piece of the pipeline is budgeted to hit this.

### CP3: Share link → first playback (new user)

```
0 ms     user clicks shared link
 ↓ 80ms  TTFB (edge, SSR)
 ↓ 200ms HTML with metadata + cover streams
 ↓ 400ms audio element ready, click-to-play visible
 ↓       user clicks play
 ↓ 150ms first byte of audio (pre-cached via R2 + CDN)
 ↓ 50ms  audio element starts playback
 ↓
total ≈ 650ms click → sound
```

Share links need to feel like SoundCloud or Bandcamp: instant.

---

## Implementation levers

### React

- **React Compiler** — auto-memo, no `useMemo`/`useCallback` boilerplate.
- **`useTransition`** — for state changes that cause heavy re-render.
- **`<Suspense>` + streaming SSR** — for public share view.
- **Code-splitting** — every route lazy, every heavy component lazy.
- **Avoid context re-render pitfalls** — split contexts by update
  frequency; use selectors (Zustand / Jotai) for frequently-changing
  state.

### Vite

- **Preload hints** for critical chunks.
- **Font subsetting** — ship only the glyphs used.
- **Brotli** compression (R2 serves pre-compressed variants).
- **Asset hashing** — infinite cache on all hashed assets.
- **Modulepreload** for lazy route chunks likely to be needed next.

### Edge API

- **Streaming JSON** for large responses (via `text/event-stream` or
  chunked transfer).
- **HTTP/3** (Workers support) — better under loss, better on mobile.
- **ETag + If-None-Match** on cacheable GETs.
- **Parallel fan-out** — any API that hits multiple downstreams uses
  `Promise.all`, not sequential.

### Database

- **Composite indexes** on all list queries (`owner_id, created_at DESC`).
- **`EXPLAIN ANALYZE`** required in PRs that touch query paths.
- **Connection pooling** via PgBouncer (transaction mode).
- **`SELECT` only what's needed** — no `SELECT *` in hot paths.
- **Paginate** — never unbounded lists.

### Audio

- **Pre-rendered peaks JSON** — waveform loads in <100ms vs 800ms if
  decoded in-browser.
- **HLS adaptive** for long-form audio (tracks > 90s): segments
  stream only as needed.
- **Opus over MP3** (2027 upgrade) — 40% smaller at equal quality,
  gapless.
- **Audio element pooling** — reuse `<audio>` nodes across track
  swaps; don't create/destroy.

### Images

- **`<img loading="lazy">`** for below-the-fold.
- **`<img sizes fetchpriority="high">`** for the hero.
- **AVIF first, WebP fallback, PNG last** — served via
  Cloudflare Image Resizing.
- **Cover gradient as CSS** not PNG when derivable.

---

## Monitoring

### RUM (real user monitoring)

- **Web Vitals** beacon on every session — LCP, CLS, INP, TTFB,
  FCP.
- **Custom timers** for generation latency, first-sound latency,
  share-link TTFB.
- **Error tracking** with Sentry — including performance issues
  (long tasks, jank).
- **Segmented by** device class, network, geography, authed/anon.

### Synthetic

- **Lighthouse CI** runs on every PR against preview deploy.
  Fails if LCP regresses > 200ms from baseline.
- **Playwright perf probes** check animation FPS, interaction delay
  on 5 critical flows.
- **k6 load tests** on API routes — 100 RPS baseline, 1000 RPS
  surge, validates p95 stays under budget.

### Dashboards

Honeycomb (OTel traces) + Axiom (logs) + Sentry (errors) feed into
one ops dashboard with:
- Web Vitals percentiles (last 24h)
- Generation latency histogram
- Error rate by route
- WebSocket reconnect rate
- Revenue per active user (business metric as a health signal)

---

## Regression prevention

- CI: `size-limit` blocks bundle growth > 5%.
- CI: Lighthouse CI blocks LCP regression > 200ms.
- CI: Playwright FPS probes block animations dropping below 55fps.
- CI: `pnpm explain` on every new dep > 20KB — needs approval in PR.
- PR template: "Any performance impact?" required answer.
- Monthly review: top 10 slowest routes, top 10 largest bundles,
  top 10 memory offenders.

---

## Handling slowness — the user-facing side

When things are slow (they will be), communicate honestly:

- "Generating… this one's taking longer than usual. You can close
  this tab — we'll email you when it's done."
- "Loading your library (500+ tracks)…" → virtualize + show first
  20 immediately.
- "The server is slow right now. We're working on it." → banner on
  detected degraded p95.

A product that's honest about slowness feels faster than one that
lies. Users forgive latency; they don't forgive dishonesty.
