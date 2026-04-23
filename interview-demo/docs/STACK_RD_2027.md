# R&D: A 2027-Forward Stack

`TECH_STACK.md` is the **pragmatic 2026 pick**: what I'd ship Monday. This
doc is **research** — the forward-leaning choices I'd defend in an interview
for a role that starts mid-2026 and ships through 2027+.

The goal isn't "use every new thing." It's to show I know *which* new things
are real vs hype, *when* I'd pull them forward, and *what they cost*.

## Summary: the 2027 reshape

| Layer | 2026 pragmatic | 2027 forward | Why upgrade |
|---|---|---|---|
| UI framework | React 19 | **React 19 + React Compiler** | Auto-memo, kills `useMemo`/`useCallback` boilerplate |
| Rendering | CSR | **RSC + streaming** (via Waku or Next 15 app router) | First-contentful audio in <600ms from cold |
| Build | Vite 6 | **Vite 7 + Rolldown** | Rust bundler, 10-20x faster prod builds |
| Runtime | Node 20 | **Bun 2.x** | One binary: runtime + package manager + test runner + bundler |
| Edge | Hono on Workers | **Hono on Workers + Workflows + AI Gateway** | Durable multi-step orchestration for generation pipelines |
| Realtime transport | WebSocket | **WebTransport (HTTP/3)** | Better mobile, unreliable datagrams for cursors/progress |
| Realtime state | Bespoke WS + NOTIFY | **Zero (Rocicorp)** or **PartyKit** | Local-first sync, CRDT conflict resolution |
| DB access | supabase-js | **Drizzle ORM + postgres.js** | Typed, no client bundle bloat, edge-compatible |
| Local DB | — | **PGlite** (in-browser Postgres, wasm) | Offline-first, instant reads, sync via Zero |
| Validation | Zod | **Valibot** | 10x smaller bundle, tree-shakeable, same DX |
| Error handling | try/catch + React Query | **Effect-TS** (selectively) | Typed errors in the edge API, not UI |
| Lint/format | ESLint 9 + Prettier 3 | **Biome 2.x** | Single tool, Rust-based, 35x faster |
| Auth | Supabase Auth (magic link + OAuth) | **Passkeys (WebAuthn) + magic link fallback** | Phishing-resistant, 0 friction on modern devices |
| Audio DSP | WaveSurfer | **WaveSurfer + AudioWorklet + WebGPU** | Realtime effects chain, parallel FFT |
| Audio codec | MP3 | **Opus + HLS adaptive** | 40% smaller at equal quality, gapless, adaptive bitrate |
| Observability | Sentry + console | **OpenTelemetry → Honeycomb** | Distributed traces across edge → Suno → webhook |
| Background jobs | Postgres + cron | **Inngest** or **Cloudflare Workflows** | Typed, replayable, step-level observability |

---

## R1: React Compiler + RSC

### The bet

React Compiler GA'd in 2026. By 2027, not using it is a tell. RSC on a
non-Next runtime (Waku, or `react-server-dom-*` direct) is mainstream.

### What it buys

- **Auto-memoization** — delete ~90% of `useMemo` / `useCallback`. Cleaner
  code, fewer perf bugs.
- **Server-rendered first paint** — in a streaming-generation product,
  getting the shell + skeleton in <200ms before the JS bundle matters.
- **Smaller client bundle** — push music theory helpers, date formatting,
  markdown rendering to the server.

### What it costs

- Waku is younger than Next. Pin versions carefully.
- RSC mental model shift — "this component runs on the server unless I
  say otherwise" is a real migration for a team.
- Debug tools (RSC DevTools) still maturing.

### Decision for demo

Use React Compiler ✅. Stay on Vite/CSR for now ❌ RSC — adds scope. Call
it out in the interview as "what I'd do if we were staffing a team
and had 2 quarters."

---

## R2: Bun over Node

### The bet

Bun 1.0 shipped Sept 2023. By 2026 it's at 1.9+ and production-stable for
most workloads. By 2027, using Node for a greenfield project is a
defensible-but-dated choice.

### What it buys

- **One binary** — no `pnpm` + `vitest` + `tsx` + `node` zoo. `bun install`,
  `bun test`, `bun run`, `bun build`.
- **~3x faster `bun install`** vs pnpm.
- **Built-in SQLite** — useful for local fixtures.
- **Native `fetch` + streams** — no import dance.
- **Sub-1s test runner** (Bun's Jest-compatible runner, not Vitest).

### What it costs

- Some npm packages with native bindings still have edge cases.
- Cloudflare Workers don't run Bun (they run Workerd/V8-ish) — so Bun is
  local-dev + CI only, not runtime.
- Team familiarity — "what's `bun.lockb`?"

### Decision for demo

Use Bun for dev + CI ✅. Ship on Workers ✅. Document both.

---

## R3: WebTransport over WebSocket

### The bet

WebTransport (HTTP/3, QUIC-based) hit browser parity (Chrome, Firefox,
Safari) through 2026. By 2027 it's the default for new realtime apps.

### What it buys

- **Unreliable datagrams** — for generation progress pings, dropping a
  stale progress update is free. WS forces ordered+reliable on everything.
- **Multiple streams per connection** — separate progress updates, audio
  chunks, and user cursors without head-of-line blocking.
- **Better mobile** — QUIC handles network switches (wifi→cell) without
  reconnect. WS sessions die on network switch.

### What it costs

- Server support is less mature than WS. Cloudflare Workers support
  WebTransport behind a flag; Node has `@fails-components/webtransport`.
- Tooling (DevTools network panel) is weaker.
- No fallback story if a user is on a legacy network that blocks UDP/443.

### Decision for demo

Ship with WebSocket for v1 ✅. Add WebTransport behind a feature flag with
WS fallback ✅. Call it out in the interview as a migration I'd lead.

---

## R4: Local-first with Zero / PGlite

### The bet

Rocicorp's Zero (successor to Replicache) plus PGlite (Postgres in wasm)
enables "feels like Linear" UX: every interaction is 0ms because it hits
local state, then syncs.

### What it buys

- **Instant UI** — track rename, playlist reorder, adding to a playlist
  all feel like native desktop apps.
- **Offline support** — create playlists on a plane, sync when you land.
- **Simpler state management** — the DB *is* the state store. No Zustand
  for domain data.

### What it costs

- Complex migration story — partial sync rules, conflict resolution
  invariants, permission model re-cast as `zero.permissions`.
- Large bundle (~200KB for PGlite + Zero client).
- Debugging sync bugs is hard.
- Zero is still pre-1.0 as of early 2026.

### Decision for demo

**Skip for v1** — too much scope for a demo ❌. Reference it in the
interview as the answer to "how would you make this feel like Linear?"
to show awareness.

---

## R5: Valibot over Zod

### The bet

Valibot: 90% of Zod's API, 10% of the bundle, tree-shakeable. Zod author
(Colin McDonnell) started Zod v4 with similar goals, shipping 2026.

### What it buys

- **Bundle**: Zod ~13KB gzipped minimum, Valibot ~1.2KB for typical
  schema set.
- **Tree-shakeable** — only pay for the validators you use.

### What it costs

- Smaller community, fewer third-party integrations.
- Slightly different ergonomics (functional `pipe` vs chainable).

### Decision for demo

Zod v4 if GA by build time, else Valibot. Same shape either way.

---

## R6: Drizzle over supabase-js (for DB access)

### The bet

`supabase-js` is great for RLS-authed client reads, but on the edge API
side, you want real typed SQL. Drizzle gives you:

```ts
const tracks = await db
  .select()
  .from(tracksTable)
  .where(eq(tracksTable.ownerId, userId))
  .orderBy(desc(tracksTable.createdAt))
  .limit(20);
```

### What it buys

- **Full SQL** — aggregates, window functions, CTEs, without dropping to
  `rpc()`.
- **Migrations-as-code** — schema in TS, diff → SQL.
- **Edge compatible** — works on Workers via postgres.js.
- **No client bundle impact** — it's a server-only dep.

### What it costs

- Duplicates Supabase's own migration story. Pick one.
- More code than `.from('tracks').select('*')`.

### Decision for demo

Use Drizzle on the edge API ✅. Keep supabase-js in the browser for
auth + realtime only.

---

## R7: Passkeys (WebAuthn)

### The bet

By 2027, passwords are legacy. Apple, Google, Microsoft all default to
passkeys. Magic links remain a fine fallback for cross-device.

### What it buys

- **Phishing-resistant** — domain-bound, can't be replayed.
- **One-tap auth** — FaceID/TouchID/Windows Hello.
- **No "forgot password"** flow to build.

### What it costs

- Recovery UX is non-obvious (what if you lose your phone?).
- Server-side libs (simplewebauthn) are solid but not trivial.
- Supabase Auth added passkey support in 2025 — check current status.

### Decision for demo

Use Supabase Auth passkey flow if available, magic link fallback ✅.

---

## R8: Audio — WebGPU + AudioWorklet

### The bet

Web Audio API's built-in nodes are enough for playback. For *effects*
(reverb, EQ, compression) in realtime, AudioWorklet is the bar. For
heavy DSP (FFT-based analysis, ML-based stem separation), WebGPU
compute shaders crush CPU.

### What it buys

- **Realtime effects chain** — per-track EQ, reverb, compressor in the
  browser without server round-trips.
- **Stem separation in-browser** — Demucs-lite or similar wasm model
  running on WebGPU: take a generated track, pull the drums out.
- **Visualizations** — smooth 60fps FFT spectrums.

### What it costs

- WebGPU Safari support lagged until 2025. Now solid.
- Writing AudioWorklet processors is C-like — careful around the audio
  thread constraints (no allocations, no GC).
- Demo scope.

### Decision for demo

**V1**: WaveSurfer + native `<audio>` ✅.
**V2 demo stretch**: AudioWorklet-based EQ + compressor on the playback
path ✅ (impressive, bounded scope).
**V3 reference**: WebGPU stem separation — mention in interview, don't
build.

---

## R9: Workflows over ad-hoc retries

### The bet

Cloudflare Workflows (GA 2025) = Temporal-lite on the edge. Each step is
durable, replayable, typed. For a generation pipeline with Suno + storage
upload + peaks computation + notification, this is the right shape.

### What it buys

- **Durable retries** — Suno 503? Automatic retry with backoff, state
  preserved.
- **Observability** — see every step, timing, failure reason in the CF
  dashboard.
- **Simpler code** — no manual state machines.

### What it costs

- Newer product, smaller community.
- Vendor lock-in (but so is Workers).

### Decision for demo

Ship v1 with a simple Postgres-backed state machine ✅. Migrate to
Workflows when we have >1 pipeline ✅. Mention in interview.

---

## R10: Observability — OpenTelemetry → Honeycomb

### The bet

By 2027, OTel is how observability is done. Sentry for errors, Honeycomb
(or Datadog/Axiom) for traces.

### What it buys

- **Distributed traces** — single view of: browser click → edge request
  → Suno call → webhook → DB update → WS push → browser state change.
  This is the single most valuable debugging tool for this product.
- **High-cardinality** — filter traces by `user_id`, `prompt_length`,
  `suno_model_version` without pre-aggregation.

### What it costs

- Non-trivial setup on Workers (limited APM SDK support in 2026).
- Honeycomb isn't free at scale.

### Decision for demo

Ship v1 with structured console logs + Sentry ✅. Add OTel instrumentation
on the edge with Axiom as backend ✅ (generous free tier). Demo the trace
UI in the interview.

---

## Cumulative "demo upgrade" picks

What I'd actually add to the scaffold, in priority order:

1. **React Compiler** (flip a flag, basically free) 🟢
2. **Biome** over ESLint+Prettier 🟢
3. **Drizzle** on the edge 🟢
4. **Passkeys + magic link** 🟢
5. **Valibot** (or Zod 4 when stable) 🟢
6. **AudioWorklet-based EQ on playback** 🟡 (impressive, bounded)
7. **OTel + Axiom** 🟡
8. **Cloudflare Workflows** for generation pipeline 🟡
9. **WebTransport** behind flag 🔴 (too speculative for a demo)
10. **Zero / PGlite** 🔴 (scope bomb — reference only)

🟢 = in the demo. 🟡 = stretch goal. 🔴 = talking point only.

---

## What I'd NOT pull forward (and why)

- **Server Components everywhere** — great for marketing sites and CRUD
  apps, fighting the tool for a realtime DAW. Use sparingly.
- **HTMX** — lovely for forms, wrong shape for streaming audio + waveforms.
- **Tauri / Electron native shell** — unless Suno has a desktop app
  roadmap, web-only is stronger signal.
- **Full CRDT stack (Yjs + Liveblocks)** — if collab were core (it's not
  in v1), yes. For single-user studio, overkill.
- **Event sourcing** — interesting academic fit, but "tracks" and
  "playlists" are CRUD. Don't over-architect.
- **GraphQL** — still fine, not a 2027 upgrade. REST + typed client is
  simpler.

---

## The meta-point

In the interview, the insight I want to land:

> "The stack in TECH_STACK.md is what I'd ship week one.
> STACK_RD_2027.md is what I'd *migrate toward* over the following year,
> prioritizing the upgrades that change the product (Workflows for
> generation reliability, Zero for instant UX) over the ones that just
> change the code (Biome over ESLint)."

That's the signal: technical ambition, tempered by pragmatism.

See [`/interview/STACK_QA.md`](../interview/STACK_QA.md) for the specific
questions this doc is designed to answer.
