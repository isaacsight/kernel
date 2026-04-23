# What's Coming for 2027 — The Landscape and the Stack

Sibling doc to [`STACK_RD_2027.md`](./STACK_RD_2027.md). That one is
demo-specific; this one is **the industry view**. What shifts between
now (early-to-mid 2026) and late 2027, what's hype vs real, and what a
stack built for 2027 looks like head-on.

---

## TL;DR — The 2027 stack in one screen

```
┌─ UI ────────────────────────────────────────────────────────────┐
│ React 19 + Compiler (stable)  ·  Vue 4  ·  Svelte 6  ·  Solid 2 │
│ Streaming RSC (Next 16, Waku, Redwood SDK)                      │
│ View Transitions v2  ·  Anchor Positioning  ·  Scope            │
│ WebGPU shipped everywhere incl. Safari                          │
└─────────────────────────────────────────────────────────────────┘
┌─ Runtime / Build ───────────────────────────────────────────────┐
│ Bun 2  ·  Deno 3  ·  Node 24 (native TS, no transpile)          │
│ Vite 7 + Rolldown (Rust)  ·  Turbopack in Next  ·  Rsbuild      │
│ Biome 2 replacing ESLint+Prettier in most shops                 │
│ JSR alongside npm                                               │
└─────────────────────────────────────────────────────────────────┘
┌─ Edge / Backend ────────────────────────────────────────────────┐
│ Hono dominant for edge APIs   ·  Elysia on Bun                  │
│ Cloudflare Workers + Durable Objects + Workflows + Queues       │
│ Vercel Functions + Fluid Compute  ·  Deno Deploy (Fresh)        │
│ Effect-TS for structured error handling                         │
└─────────────────────────────────────────────────────────────────┘
┌─ Data ──────────────────────────────────────────────────────────┐
│ Postgres everywhere  ·  Neon (branching) + Turso (embedded)     │
│ PGlite in browser (wasm Postgres)                               │
│ Drizzle + postgres.js   ·   Kysely (pure SQL + types)           │
│ Zero (Rocicorp) for local-first sync  ·  ElectricSQL            │
│ DuckDB for analytics workloads                                  │
└─────────────────────────────────────────────────────────────────┘
┌─ Realtime ──────────────────────────────────────────────────────┐
│ WebTransport replacing WebSocket for new projects               │
│ PartyKit (CF) for multiplayer infra                             │
│ Yjs / Automerge for CRDTs                                       │
└─────────────────────────────────────────────────────────────────┘
┌─ Auth / Payments ───────────────────────────────────────────────┐
│ Passkeys (WebAuthn) default  ·  magic-link fallback             │
│ Clerk / Supabase Auth / WorkOS for teams                        │
│ Stripe still dominant  ·  Apple Pay + Google Pay on web         │
└─────────────────────────────────────────────────────────────────┘
┌─ AI ────────────────────────────────────────────────────────────┐
│ Claude 5 / GPT-6 / Gemini 3 mainstream (~10M tokens, cheap)     │
│ Agentic flows: tool use + structured output + extended thinking │
│ Edge inference (Workers AI, Cloudflare R2 model weights)        │
│ In-browser: Transformers.js, WebLLM, ONNX Web (WebGPU backed)   │
│ Vercel AI SDK / Anthropic SDK / Vercel AI Elements for UI       │
└─────────────────────────────────────────────────────────────────┘
┌─ Observability / DX ────────────────────────────────────────────┐
│ OpenTelemetry everywhere  ·  Honeycomb + Axiom + Datadog        │
│ Sentry for errors + session replay  ·  Highlight for SMB        │
│ Claude Code / Cursor / Antigravity / Zed AI the default IDE     │
│ Playwright 2 CT + Storybook 9                                   │
└─────────────────────────────────────────────────────────────────┘
┌─ Mobile / Desktop / Cross-platform ─────────────────────────────┐
│ React Native New Arch stable  ·  Expo Router 5                  │
│ Tauri 2 for desktop (not Electron)                              │
│ Capacitor / Ionic for PWA-native hybrid                         │
│ visionOS 3 + Meta Quest 4  ·  WebXR still a niche               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1 — What actually ships between Apr 2026 and late 2027

### Web platform

| Feature | Status Apr 2026 | Status late 2027 | Impact |
|---|---|---|---|
| **WebGPU** | Chrome/Edge/Firefox shipping, Safari landed | Everywhere, tooling mature | Browser-based pro tools (Figma-class) go mainstream |
| **WebTransport** | Chrome, Firefox shipping, Safari behind flag | Everywhere | WebSocket usage declines for new projects |
| **WebCodecs** | Shipping | Mature, tooling | In-browser video/audio editing becomes normal |
| **View Transitions Level 2** | Level 1 shipping | Level 2 with cross-document shipping | Feels-like-native SPA navigation without JS routers |
| **Anchor Positioning** | Chrome only | All browsers | Native tooltips, menus, popovers without JS libs |
| **CSS `@scope`** | Chrome + Safari | All browsers | Scoped styles without CSS-in-JS |
| **Temporal** | Stage 3 | Shipping (all browsers) | `new Date()` rage finally ends |
| **Iterator helpers** | Shipping | Used everywhere | `.map`, `.filter` on iterators without arrays |
| **Import attributes** | Shipping | Normal | `import x from './foo.json' with { type: 'json' }` |
| **Async Context** | Stage 2 | Stage 3/4 | Request-scoped context in Node/Deno without hacks |
| **Compression Streams** | Shipping | Normal | gzip/brotli in browser without wasm blobs |
| **Navigation API** | Shipping | Normal | Router libraries shrink |

### JS runtimes

- **Node 24** ships with native TS execution (`node --experimental-strip-types`
  graduates). No more `tsx`/`ts-node`. This alone removes a whole tooling layer.
- **Bun 2** becomes production-default for greenfield — not because Node
  is bad, but because `bun install` + `bun test` + `bun build` in one
  binary is a productivity tax nobody wants to pay. Bun's Elysia
  framework competes with Hono for edge APIs.
- **Deno 3** consolidates around JSR, Fresh 2, and Deno Deploy. Remains
  niche but growing.
- **Workers runtime (`workerd`)** holds edge crown. Cloudflare keeps
  shipping: Workflows (Temporal-lite), AI Gateway, Vectorize, D1, R2.

### React and the framework wars

- **React Compiler** is just "how React works." Code that writes
  `useMemo`/`useCallback` is either pre-2026 or legacy.
- **Server Components** finally make it past "only in Next." Waku,
  Redwood SDK, and Remix 3 all ship non-Next RSC.
- **Next 16** consolidates App Router, kills Pages Router. Turbopack stable.
- **Remix / React Router 7 merge** (happened late 2024) means the
  "Remix loaders" pattern is just how React Router works. Data APIs
  mature.
- **Svelte 6** lands with runes everywhere, SvelteKit 3 adds RSC-like
  streaming.
- **Solid 2** continues to win performance benchmarks, moderate uptake.
- **Vue 4** with Vapor mode ships — compiles components to imperative
  DOM like Solid. Vue stays dominant in China + Southeast Asia.
- **Qwik** stalls; resumability didn't convert enough people.
- **HTMX + Alpine** mini-renaissance for content sites. Still not the
  answer for apps.

### CSS

- **Tailwind v4** (CSS-first config) mainstream. v3 legacy.
- **Linaria / vanilla-extract / Panda** hold niche. Styled-components
  and Emotion fade (runtime cost too visible).
- **`@scope`** kills most CSS-in-JS use cases.
- **Container queries** in every design system.
- **`color-mix()`, `oklch()`, relative color syntax** — color math
  moves from JS to CSS.

### Databases

- **Postgres dominance consolidates.** Neon (branching + serverless),
  Turso (embedded replicas, SQLite at the edge), Supabase (managed PG
  + BaaS) are the three poles.
- **MongoDB** stays for legacy; few new projects start there.
- **DuckDB** becomes the standard for embedded analytics (BI tools,
  Jupyter alternatives, local dashboards).
- **PGlite** (Postgres-in-wasm) mature. Used for local-first sync
  architectures.
- **Zero (Rocicorp)** and **ElectricSQL** make "local-first" a normal
  pattern, not a research project.

### AI in the stack

This is where 2027 looks most different from 2026.

- **Context**: Claude 5, GPT-6, Gemini 3 all ship ~10M token context.
  Documents + whole codebases fit in a single call.
- **Cost**: Inference cost drops ~10x again. GPT-3.5-class intelligence
  becomes effectively free at the edge.
- **Agentic APIs**: Tool use + structured output + extended thinking
  becomes the default interaction mode, not chat. The "agent" concept
  matures from framework-of-the-week into a primitive.
- **Edge inference**: Cloudflare Workers AI + Vercel's AI infrastructure
  ship small/medium model inference at the edge. Round trips to
  OpenAI/Anthropic are no longer necessary for a lot of routine work.
- **In-browser inference**: Transformers.js + WebLLM + ONNX Runtime
  Web mature. Small models (1-3B) run on-device via WebGPU. Use cases:
  private autocomplete, image tagging, offline captioning.
- **Spec-driven development**: Prompts → code in IDE becomes the
  normal dev flow. Claude Code / Cursor / Antigravity / Zed AI the
  default environment. The IDE is the agent runtime.
- **Multimodal mainstream**: Image-in, audio-in, video-in as first-class
  API features. Generation products (Suno, ElevenLabs, Runway) expose
  web APIs with streaming token semantics.

### Mobile, desktop, XR

- **React Native New Architecture** (Fabric + TurboModules) fully stable.
  Expo Router 5 is the default way to ship RN.
- **Tauri 2** crushes Electron for new projects — 10x smaller binary,
  native webview, Rust plugins.
- **Capacitor** holds for web-first teams shipping to app stores.
- **visionOS 3** (Apple Vision Pro generation 3) ships at lower price
  point; still niche. WebXR usage rises but doesn't mainstream.

### Auth, payments, commerce

- **Passkeys** default. "Create password" flows feel legacy.
- **Clerk, WorkOS, Stytch** hold B2B share. Auth0 legacy. Supabase Auth
  holds SMB + indie.
- **Stripe** still dominant. Apple Pay + Google Pay on web = standard
  checkout. Crypto-as-payment-rail continues to fade (crypto as
  asset/infra remains a separate conversation).

### Observability

- **OpenTelemetry** is table stakes. All new projects start with OTel.
- **Honeycomb** (high cardinality), **Axiom** (edge-friendly, cheap),
  **Datadog** (enterprise), **Sentry** (errors + replay) are the major
  poles.
- Session replay becomes standard — **LogRocket, FullStory, Sentry
  Replay, PostHog** all mature.

---

## Part 2 — A 2027 stack, picked opinionated

Not "one of everything" — what I'd actually pick.

### Frontend

- **React 19 + Compiler** (or **React 20** if GA)
- **Vite 7 + Rolldown** for bundling
- **Tailwind v4** + **shadcn/ui v2**
- **TanStack Query v6** for server state
- **Zustand v5** for UI state
- **React Router v7** with loaders (RSC only where genuinely useful)
- **Motion** for animation; **View Transitions API** for route changes
- **WebGPU** for anything performance-sensitive (canvas, charts, audio)

### Backend / edge

- **Hono v5** on **Cloudflare Workers**
- **Durable Objects** for realtime connection state
- **Workflows** for long-running orchestration
- **Queues** for async jobs
- **Valibot** (or **Zod v4**) for schema validation
- **Effect-TS** selectively for error-handling-heavy modules
- **OpenTelemetry** SDK, exported to **Axiom**

### Data

- **Postgres on Neon** (branching for preview envs is transformative)
- **Drizzle ORM** + **postgres.js** driver
- Migration via Drizzle Kit, PRs gated on migration review
- **Cloudflare R2** for blobs, **Cloudflare KV** for session cache
- **PGlite + Zero** if the product benefits from local-first

### Auth

- **Clerk** for teams app, **Supabase Auth** for SMB/indie
- **Passkeys primary**, magic link fallback, OAuth secondary

### Realtime

- **WebTransport** for new projects (WS fallback)
- **PartyKit** or **Durable Objects + Yjs** for collaborative state
- **Y-sweet** or **y-indexeddb** for offline-ready CRDT persistence

### AI

- **Anthropic SDK (Claude 5)** for quality-first tasks
- **Workers AI** for latency-first small-model inference at the edge
- **Vercel AI SDK** or **Vercel AI Elements** for streaming UI
  components (typewriter, tool-use cards, thinking indicators)
- **Transformers.js** for on-device fallback / private inference

### Tooling

- **Bun** for local dev + CI (`bun install`, `bun test`, `bun build`)
- **Biome 2** for lint + format (no ESLint, no Prettier)
- **Playwright 2** for E2E + component tests
- **Vitest 3** for unit tests (or Bun test, if Vitest compat matures)
- **pnpm** or **Bun** workspaces for monorepo
- **GitHub Actions** or **Dagger** for CI
- **Doppler** for secret management
- **Sentry** + **Axiom** for observability

### IDE / dev

- **Claude Code** (terminal) + **Antigravity** or **Cursor** (IDE)
  as the default — AI-native from day one
- **Zed** if you want a fast local editor
- **GitHub Codespaces** / **Gitpod** for ephemeral environments

### Deploy

- **Cloudflare Pages + Workers** as one unit
- **Neon** for Postgres
- **Axiom** for logs + traces
- **Sentry** for errors + performance + replay
- **GitHub Actions** for CI with preview deploys per PR

---

## Part 3 — What's hype vs real

### Real and betting on

- **AI-native dev loop** (Claude Code / Cursor) → permanent
- **WebGPU in production** → permanent
- **Edge-first backends** (Workers, Deno Deploy) → permanent
- **Passkeys** → permanent
- **OTel + distributed tracing** → permanent
- **Postgres as default** → permanent
- **Bun as dev-tool runtime** → permanent
- **Tauri over Electron** → permanent
- **React Compiler** → permanent
- **Local-first for specific products** → permanent for collaboration
  tools, niche for others

### Uncertain (watch, don't bet)

- **Everyone goes RSC** — probably only for content-heavy apps
- **CRDT-everywhere** — great for collab, overkill for CRUD
- **WebTransport replacing WebSocket universally** — happens, but slower
  than people think
- **Bun on production servers replacing Node** — happens in
  greenfield, not migrations
- **Effect-TS mainstream** — possible but requires team buy-in
- **WebXR mainstream** — requires Apple to push it hard, unclear

### Hype, don't commit

- **Web3 as a frontend architecture** — dead, stays dead
- **"The blockchain for everything"** — dead
- **Microservices as default architecture** — admitted mistake
- **NoSQL for transactional workloads** — admitted mistake
- **GraphQL everywhere** — remains right for specific shapes, wrong as
  default
- **Every app needs real-time** — no
- **Every app needs AI** — no (but most UX can be improved by AI
  somewhere)
- **Mono-repo for solo projects** — overkill

---

## Part 4 — What this means for a candidate in 2027

What interviewers will probe for, beyond "can you code":

1. **Can you pick the right abstraction tier?**
   Know when to use RSC vs CSR vs SSR vs SSG. Know when Postgres RLS
   is enough vs needing a real authorization framework. Know when a
   CRDT is the answer vs a mutex vs optimistic locking.

2. **Can you reason about cost?**
   AI inference cost. Egress cost. Postgres connection cost. Edge
   cold-start cost. Bundle cost. Engineer-hours cost. The candidate
   who thinks in cost curves is worth 2x the one who thinks only in
   features.

3. **Can you reason about latency budgets?**
   16ms input→paint for interactive UX. <100ms first contentful for
   marketing. <600ms first generation frame for AI products. <50ms p99
   for API. If you can't quote the budget, you can't engineer to it.

4. **Do you have opinions, and can you defend them and change them?**
   The test isn't "use my stack." It's "tell me your stack, tell me
   what would change your mind." Strong opinions, weakly held.

5. **Do you ship or do you architect?**
   Everyone has architecture opinions. Fewer people ship fast and
   iterate. The 2027 market prizes ship rate heavily — AI tooling
   makes slow engineers look even slower.

6. **Do you understand the product you're interviewing for?**
   If it's Suno: can you talk about streaming token UIs, audio
   rendering, generation reliability, cost-per-generation?
   If it's Procreate: can you talk about latency budgets, GPU
   pipelines, color management, file formats, input pipelines?
   Generic competence is background noise in 2027. Domain curiosity
   is signal.

---

## Part 5 — Open questions — things I'd still be watching

- **Does React Compiler kill signals?** (Solid, Preact-signals, Angular)
- **Does Bun eat Node's production share?** (or stay a dev tool?)
- **Does RSC actually reach >50% of new React apps?**
- **Does anyone solve the CRDT migration story gracefully?**
- **Does Apple finally open up the Pencil API to 3rd-party browsers?**
  (Affects any web-drawing product competing with Procreate.)
- **Does on-device inference start replacing cloud API calls?**
  (Cost curves + WebGPU + small models → plausible.)
- **Does the "one app for everything" trend reverse?**
  (Suno does music, Procreate does illustration, specialized wins.)

---

## Part 6 — What to internalize before the interview

Three lines:

1. **Stack choices are cost + latency + team-shape bets, not
   religion.** I can switch stacks. I can't switch judgment.
2. **AI collapses the distance between idea and ship.** The stack
   that wins is the one that makes agent loops fast (clean APIs,
   typed contracts, good tests, fast CI).
3. **The boring parts (auth, billing, observability, deploy) are
   still 80% of the work.** Know them cold.

If you can say those three out loud, you're in the top 10% of
candidates who can reason about a 2027 stack rather than just name-drop
it.
