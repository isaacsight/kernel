# Stack Q&A — Anticipated Interview Questions

Pairs with [`../docs/TECH_STACK.md`](../docs/TECH_STACK.md) (pragmatic) and
[`../docs/STACK_RD_2027.md`](../docs/STACK_RD_2027.md) (forward).

The goal for each answer: **15-45 seconds spoken**. If the interviewer
wants depth, they'll dig. Don't unload.

---

## Section 1 — Why this stack

### Q1. "Why Vite and not Next.js?"

**A.** "Setlist is a logged-in studio app — every view is authenticated.
SSR gives you nothing when there's no public page to index. Next's
value is app-router + server actions + image optimization, and I get
equivalents from React 19 actions and Vite's asset plumbing without
the framework tax. If we had a marketing site or SEO-critical public
playlist pages, I'd flip to Next 15 for those routes specifically — 
probably as a separate app in the monorepo."

### Q2. "Why Cloudflare Workers over Vercel Functions or AWS Lambda?"

**A.** "Three reasons. Global edge by default — a user in Sydney hits a
Worker in Sydney, not a Lambda in us-east. Zero cold-start for WebSocket
upgrades, which matter for a realtime product. And Durable Objects give
me stateful WS connection holders without running Redis. Vercel is great
but their edge runtime is more limited and WebSocket support is still
behind the curve."

### Q3. "Why Supabase?"

**A.** "It bundles the four things I'd otherwise integrate separately —
Postgres with RLS, JWT-issuing auth, S3-compatible storage, and realtime
— so I spend my week on the product instead of glue. The tradeoff is
vendor coupling on auth, which I'd hedge by keeping JWT validation
runtime-agnostic and using Drizzle on the edge so the DB access isn't
Supabase-flavored."

### Q4. "Why WebSockets over Server-Sent Events?"

**A.** "I need client-to-server traffic: the cancel button has to send a
message, not just receive progress. SSE is one-way. If the product were
pure dashboard telemetry, SSE is simpler. For 2027, I'd evaluate
WebTransport — it's WebSocket-quality plus unreliable datagrams for
stale-okay progress updates, plus better behavior on wifi-to-cellular
handoff."

### Q5. "Why Zustand instead of Redux / Jotai / XState?"

**A.** "Zustand for UI state, TanStack Query for server state — that's
the split I reach for until the product has genuinely complex derived
state or multi-step flows. XState is right the moment I'm implementing
a third `if (status === ...)` chain. Redux I'd use on a team where the
DevTools time-travel is worth the boilerplate tax. Here, it isn't."

### Q6. "WaveSurfer vs writing it yourself in WebGL?"

**A.** "WaveSurfer handles the 80% — zoomable waveforms, regions, play
head sync — and I can drop into its renderer hooks for the 20%. Writing
it myself in WebGL is fun but not useful signal in a demo. For visual
effects that WaveSurfer can't do — a spectrogram view, custom
mini-maps — I'd use the audio data and a canvas or WebGPU myself,
keeping WaveSurfer for the primary track strip."

### Q7. "Why not tRPC?"

**A.** "Love tRPC for team apps. For Setlist I wanted the API to be plain
HTTP + OpenAPI, because the product surface could extend to a CLI or a
mobile app that isn't TS. I get similar DX with Hono's RPC client for the
web app, but the contract on the wire is REST + JSON."

---

## Section 2 — The 2027 forward picks

### Q8. "What's one thing in your stack that'll be out of date by 2027?"

**A.** "Honestly — WebSocket. WebTransport is landing across all browsers
and gives you unreliable datagrams on one stream alongside reliable
streams on another. For a generation-progress use case where dropping a
stale progress ping is correct behavior, unreliable transport is
genuinely better. I'd plan to ship WS v1 and add WebTransport behind a
feature flag once server support stabilizes."

### Q9. "You mentioned React Compiler — do you trust it?"

**A.** "Yes, for greenfield. It's been GA since 2026 and the rules of
React are well-documented. Code that was already idiomatic — pure
components, no mutation — gets auto-memoized for free. Where I'm
cautious: mixed-paradigm legacy code where a team has been clever. For
this demo, I can write it Compiler-safe from day one, and `eslint-plugin-react-compiler`
catches violations."

### Q10. "Would you use Server Components here?"

**A.** "Partially. The public share-link view — `/p/:token` — is a clear
win for RSC: no auth, public data, SEO-relevant. The studio view itself
is 100% interactive state; RSC buys less. The honest answer is a
split-app architecture where the public pages are Next + RSC and the
studio is Vite + CSR, sharing a UI package. For a demo I'd do the
simple thing and stay on Vite + CSR."

### Q11. "Why not Zero / Replicache / ElectricSQL for local-first?"

**A.** "It's the architecture I'd reach for if Setlist were
*collaborative* — multi-user live editing a playlist. Single-user studio
doesn't need CRDTs, and the scope to retrofit sync rules, auth policies,
and conflict handlers is 2-4 weeks. If the interview rubric values
ambition over ship-ability, I'd build it. I'm betting it values judgment."

### Q12. "Drizzle over Prisma?"

**A.** "Drizzle because it's edge-compatible (Prisma's engine was a pain
on Workers until Edge Proxy, which adds latency), and because it lets me
write SQL when SQL is clearer — window functions for 'your top-played
tracks this week' aren't pretty in Prisma. For a data model where every
query is `findMany({ where: { userId } })`, Prisma is fine; Setlist has
enough aggregates that Drizzle wins."

### Q13. "Bun in production?"

**A.** "Not on Workers — they don't run Bun. But for dev, CI, and any
Node-hosted sidecar services, yes. The `bun install` speedup alone cuts
CI time by 30%. Bun's test runner is 10x faster than Vitest for pure-TS
tests. The failure mode I've seen is packages with native bindings that
compile for Node's ABI, but that's a small and shrinking set."

### Q14. "Biome over ESLint+Prettier?"

**A.** "Biome for monorepos like this where lint time matters. 35x
speedup on format, 10x on lint. The ecosystem trade is real — Biome
doesn't have every ESLint plugin — but the core rules plus some custom
ones cover 95% of what we care about. Where I still use ESLint: projects
with bespoke rules from `eslint-plugin-*` that haven't ported yet."

---

## Section 3 — Audio-specific

### Q15. "How would you add realtime effects to playback?"

**A.** "AudioWorklet. Spawn a worker on the audio thread that wraps the
`<audio>` source with an AudioNode chain — EQ, compressor, reverb. The
constraint is the audio thread can't allocate or GC, so you write the
DSP in a C-like style and preallocate buffers. For heavier stuff — stem
separation, ML-based — I'd use WebGPU compute shaders off the audio
thread and pipe the output back in as a source."

### Q16. "Why MP3 and not Opus?"

**A.** "Compatibility and demo simplicity. Opus is 40% smaller at equal
quality and gapless, and for a 2027 product I'd ship Opus in HLS
adaptive segments — lower first-byte-to-first-sound latency, cell
network friendly. MP3 is the v1-works-everywhere pick."

### Q17. "How do you scrub to a specific word in a generated vocal?"

**A.** "Out of scope for v1, but the shape: run Whisper (or Suno's
alignment output if they expose it) on the audio → get word-level
timestamps → store as JSON alongside peaks → render word boxes overlaid
on the waveform, click to seek."

### Q18. "How do you handle multiple users playing at once — mix them?"

**A.** "Not in v1. For a future 'listen party' mode, WebRTC for the audio
stream (or HLS from a server-generated mix), Y.js for shared playhead
state, and WebRTC data channels for reactions. PartyKit's Worker
implementation handles the signaling."

---

## Section 4 — Realtime / scaling

### Q19. "Postgres NOTIFY — does that scale?"

**A.** "To about 1000 concurrent listeners on a default Supabase tier.
Past that, you hit connection saturation before throughput. The
migration path is Redis Streams or NATS — same fanout semantics, better
horizontal scaling. I'd make the switch behind an interface so the WS
handler doesn't care."

### Q20. "What if 100k users hit Generate at once?"

**A.** "Three layers. First, per-user rate limit at the edge (Cloudflare
rate limiting rules, keyed on user ID). Second, a queue — I'd use
Cloudflare Queues or Workflows so the edge request returns a job ID fast
and the generation kicks off async. Third, Suno's own quota — we're
their customer and would need to negotiate bandwidth. The UX layer shows
'#324 in line, ETA 2 minutes' for honesty."

### Q21. "How do you recover if the WS dies mid-generation?"

**A.** "Client auto-reconnects with exponential backoff. On reconnect,
the server replays the latest known state for any generation IDs the
client is subscribed to — the source of truth is Postgres, so nothing is
lost. If the generation completed while the WS was dead, the next
reconnect immediately pushes `{ status: 'complete' }`."

### Q22. "Cold start on Workers?"

**A.** "Workers don't cold-start in the Lambda sense — they're
pre-warmed V8 isolates. The only 'cold' is when a new worker script is
pushed, and that's milliseconds. That's a big reason I'm on Workers for
this product — first byte of a WS upgrade in <50ms p99."

---

## Section 5 — Security / reliability

### Q23. "How do you prevent abuse of the Generate endpoint?"

**A.** "Four layers. (1) JWT required, so it's per-user not per-IP.
(2) Rate limit — 10 generations per hour per user in the free tier.
(3) Quota — hard monthly cap synced to billing state. (4) Content
moderation — prompt goes through a classifier before hitting Suno, and
generated output is scanned server-side. Abuse signals feed back into a
shadow-ban list."

### Q24. "Where are API keys stored?"

**A.** "Cloudflare secrets for production (encrypted at rest, never in
the environment dump). Doppler for local dev. Never in source. The
Suno key only exists on the edge — the browser never sees it."

### Q25. "What's your threat model?"

**A.** "Three concrete ones: (1) Someone steals a share token and views
a private playlist — mitigated by short expiry + revocation + one-token-
per-channel. (2) Someone enumerates share tokens by URL — mitigated by
22-char random tokens and rate limits on the share endpoint.
(3) Someone uses prompt injection to generate copyrighted output — this
one requires an allow-list approach or watermarking, neither fully
solved industry-wide. I'd flag it explicitly."

### Q26. "RLS is enabled — why also check ownership in the edge API?"

**A.** "Defense in depth. RLS protects the DB if someone bypasses the
API. Edge checks protect the API from RLS policy bugs or anonymous-key
misconfiguration. Both costs almost nothing and removes whole classes of
bugs."

---

## Section 6 — Process / judgment

### Q27. "What would you cut if you had half the time?"

**A.** "Playlists. Keep generation, keep playback, keep share links on
individual tracks. Playlist UX is multiplicative scope — reorder, cover
art, descriptions, share tokens separate from track shares. Ship tracks
+ shares, add playlists in v2."

### Q28. "What's the biggest risk in this architecture?"

**A.** "Coupling to Suno's API shape. If they change webhook auth, break
the job-id format, or rate-limit us, the whole product is down. Mitigation:
abstract the Suno client behind an interface so we can swap to a different
provider (MusicGen self-hosted, Riffusion) as a fallback. Real mitigation
is a commercial relationship, but the code should be ready."

### Q29. "One thing you'd do differently?"

**A.** "Ship without RSC, but I'd structure the web app so RSC is a
future migration not a rewrite — which means keeping fetch logic out of
components, using route-level loaders, and treating client components as
leaves. That's good hygiene anyway."

### Q30. "What's missing from the demo?"

**A.** "Three honest gaps. (1) No collaborative editing — explicit
scope cut. (2) No mobile-native experience — responsive web only, a
React Native shell is next. (3) No revenue path — I'd add Stripe for
paid tiers in v2, with the quota infrastructure already in place."

---

## How to use this doc

- Skim before the interview. Don't memorize — internalize the shape.
- If asked a Q not here: *pause, name the tradeoff, state a position*,
  and invite them to dig. Good questions are often ones you haven't
  thought about — saying "I'd want to measure X before committing" is
  a fine answer.
- Revisit every 6 months — the stack moves, this doc should move with it.
