# Tradeoffs

Every engineering decision has a cost. Documenting them openly beats
pretending they don't exist.

Structure: decision, what we got, what we gave up, what would flip
the decision.

---

## D1. Vite over Next.js

**Got**: Fast HMR, simple mental model, no framework tax, CSR fits a
logged-in studio app.

**Gave up**: Built-in SSR/SSG, image optimization, middleware
conventions, route-colocated data loading.

**Flip if**: SEO matters (we add a public marketing page), or the
public share view grows beyond a few routes and needs server-rendered
metadata at scale.

---

## D2. Cloudflare Workers over Vercel Functions

**Got**: Near-zero cold start, global edge by default, Durable
Objects for stateful WS, R2 egress-free.

**Gave up**: Larger ecosystem of Node-native libs, Vercel's git-based
preview workflow (we replicate with CF Pages, but smoother on Vercel).

**Flip if**: We need to run a library that depends on Node APIs not
polyfilled in Workers (common case: a media-processing lib that needs
`fs`), or the team heavily prefers Vercel's DX.

---

## D3. Supabase over rolled-our-own Postgres + auth

**Got**: Auth, DB, storage, realtime in one dashboard. RLS as a
first-class primitive.

**Gave up**: Multi-region Postgres (Supabase is regional; Neon is
better here). Fine-grained auth control (Supabase Auth's flows are
fixed).

**Flip if**: Multi-region latency requirements force a move to
Neon + separate auth (Clerk). Or we outgrow Supabase's RLS semantics
and need a real authorization service.

---

## D4. WebSocket over Server-Sent Events

**Got**: Bidirectional channel — cancel, subscribe, unsubscribe from
client.

**Gave up**: SSE simplicity (just HTTP streaming), automatic
reconnect via `EventSource`.

**Flip if**: Product becomes pure server-push (e.g., read-only
dashboard). Or WebTransport matures enough to replace both.

---

## D5. WebSocket (not WebTransport)

**Got**: Universal browser support, mature tooling, stable server
ecosystem.

**Gave up**: Unreliable datagrams for stale-okay progress updates,
HTTP/3 network-switching resilience, multi-stream-per-connection.

**Flip if**: Cloudflare's WebTransport server support graduates and
we verify mobile network-handoff improvement is real.

---

## D6. Postgres NOTIFY over Redis pub/sub

**Got**: One less service to run, transactional consistency
(NOTIFY fires on commit), no separate ops burden.

**Gave up**: Horizontal scaling past ~1000 concurrent listeners,
multi-region fanout.

**Flip if**: We hit >1000 concurrent WS and can't vertical-scale
Postgres, or we go multi-region.

---

## D7. Drizzle over Prisma

**Got**: Edge-compatible (no Prisma engine), full SQL when useful
(window functions, CTEs), migrations-as-code in TS.

**Gave up**: Prisma's broader community, its studio UI (Drizzle
Studio exists but is newer), its RSC-first integrations.

**Flip if**: The team prefers Prisma's ergonomics, or we adopt
a framework with Prisma first-class support.

---

## D8. WaveSurfer.js over custom WebGL

**Got**: Weeks of work saved. Mature zoom, regions, scrubbing.

**Gave up**: Bundle size (~40KB gzipped), exact rendering control.

**Flip if**: We need a visual effect WaveSurfer can't do (spectrogram
mode with real-time deformations, custom minimap animations). We'd
drop into `<canvas>` directly for the specific case, not rewrite the
whole thing.

---

## D9. CSR over SSR / RSC

**Got**: Simpler mental model, faster dev loop, no server-render
coordination.

**Gave up**: First-contentful-paint from cold. SEO on public pages.
Streaming HTML for slow networks.

**Flip if**: Public share view traffic grows and SEO matters, or
cold-start latency on authed routes becomes user-visible.

---

## D10. shadcn/ui (copy-paste) over MUI / Radix standalone

**Got**: Full ownership of component code, tree-shakeable, easy to
customize.

**Gave up**: Framework-maintained components (security fixes,
accessibility improvements flow automatically). Larger out-of-box
component set.

**Flip if**: The team grows such that owning component internals
becomes a burden, or we need a component shadcn doesn't cover (data
grid, complex table).

---

## D11. Zustand over Redux / XState

**Got**: Minimal boilerplate, no Provider, works outside React (WS
handler can read store directly).

**Gave up**: Redux DevTools time-travel (there's a Zustand
equivalent but less rich). XState's declarative state machines for
complex flows.

**Flip if**: Product develops a multi-step flow (e.g., a wizard with
10+ branching states) where a state machine is the right abstraction.

---

## D12. TanStack Query over SWR

**Got**: Richer mutations API, better optimistic updates, focus
listeners.

**Gave up**: SWR's smaller bundle and simpler mental model.

**Flip if**: We only needed fetch-and-cache and no mutations. Not
this product.

---

## D13. Tailwind v4 over CSS Modules / vanilla-extract

**Got**: Design-token driven, no runtime cost, quick iteration.

**Gave up**: Scoped CSS per component (Tailwind is global-by-
convention). Less explicit design system (though we mitigate with
semantic tokens).

**Flip if**: Team hates atomic-CSS, or we need dynamic theme values
that Tailwind JIT can't statically know.

---

## D14. Motion (ex Framer Motion) over CSS animations

**Got**: Layout animations, shared-element transitions, spring
physics, interruptibility.

**Gave up**: Bundle size (~30KB gzipped). CSS-only fallback path.

**Flip if**: We can do the motions with View Transitions API +
CSS `@scope` — genuinely plausible for a 2027 refactor, see
[`FUTURE_2027.md`](./FUTURE_2027.md).

---

## D15. Biome over ESLint + Prettier

**Got**: Single tool, 10-35x faster, simpler config.

**Gave up**: Ecosystem of ESLint plugins, custom rule authorship.

**Flip if**: We need a rule that Biome doesn't support and is a
community ESLint plugin.

---

## D16. Playwright over Cypress / TestCafe

**Got**: Multi-browser (Chromium, Firefox, Webkit), better mobile
emulation, faster execution.

**Gave up**: Cypress's debugging DX (time-travel debugger).

**Flip if**: Team has strong Cypress history and Playwright's DX
feels regressive.

---

## D17. Vitest over Jest / Bun test

**Got**: Fast, Vite-integrated, Jest-compat API.

**Gave up**: Bun test's raw speed (~10x faster).

**Flip if**: Bun test's Jest-compat matures (it's close but not
there for all edge cases), and we've migrated dev tooling to Bun.

---

## D18. pnpm over npm / Bun

**Got**: Faster installs, disk-efficient (content-addressable store),
strict dep resolution.

**Gave up**: Bun's speed + single-tool ergonomics.

**Flip if**: Bun's workspace support reaches parity and the team
is ready for a single-binary workflow.

---

## D19. No GraphQL

**Got**: Simpler implementation, OpenAPI for typed client, REST
cacheable.

**Gave up**: GraphQL's composability, selective fetching, real-time
subscriptions.

**Flip if**: We end up implementing many endpoints that are "get me
N of object X with Y related" — at some point GraphQL is the right
shape.

---

## D20. No microservices (one Worker)

**Got**: Simple deploy, single source of truth, no service mesh.

**Gave up**: Independent scaling of subsystems (generation vs.
playlists), language freedom per service.

**Flip if**: Generation traffic dwarfs other routes AND we need to
scale them independently OR a subsystem needs a non-JS runtime.

---

## D21. MP3 over Opus for audio

**Got**: Universal browser support, no format surprises.

**Gave up**: 40% smaller files at equal quality. Gapless playback
out of the box.

**Flip if**: 2027 upgrade path — move to Opus in HLS adaptive
segments once we've verified decode paths on Safari mobile.

---

## D22. Storing audio on R2, not streaming from Suno

**Got**: Consistent CDN latency, revocable share links (Suno URLs
aren't revocable), offline playback via ServiceWorker cache.

**Gave up**: Time-to-first-byte on brand-new generations (we have to
upload to R2 before serving). Storage cost.

**Flip if**: Storage cost becomes dominant AND Suno offers a
branded CDN with revocable URLs.

---

## D23. Inline edit over modal edit

**Got**: Faster editing, no modal overhead, feels modern.

**Gave up**: Slightly more complex state management (editing state
per row). Validation UX requires care (inline errors).

**Flip if**: Fields become complex enough (rich text, multi-field)
that a modal is genuinely better.

---

## D24. Soft delete over hard delete

**Got**: 30-day recovery window, audit trail, undo UX.

**Gave up**: Storage cost (trivial for tracks, real for large media).
Query complexity (always filter `deleted_at IS NULL`).

**Flip if**: Storage cost becomes a problem AND business can't
accept longer recovery windows.

---

## D25. Float `position` over integer `order`

**Got**: O(1) reorder (insert between positions 512 and 1024 →
768). No renumber cascades.

**Gave up**: Float precision eventually runs out after many
reorders in the same gap (takes 50+ reorders in the same row pair).

**Flip if**: We observe precision bugs. Mitigation is periodic
renumber (O(n) but rare).

---

## The meta-tradeoff

Every decision above has a shape: "we chose X because Y was not
worth the cost at this stage, and we'd flip when Z happens."

That's the skill — not "picking the right tool" (no such thing in
isolation) but picking the tool that fits the *current* stage and
knowing the specific trigger that would flip the decision.

In an interview, the ability to articulate the *flip condition* is
what separates a junior "I picked X because I like X" from a senior
"I picked X because Y. Here's what would make me pick Y instead."
