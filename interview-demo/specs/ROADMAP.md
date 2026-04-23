# Roadmap

Phased build plan. Each phase is time-boxed so scope creep is
visible. Phase completion = demo-ready milestone.

---

## Phase 0 — Setup (0.5 day)

Goal: every developer can run the app locally end-to-end.

- [ ] Repo scaffold, `pnpm-workspace.yaml`
- [ ] Node/pnpm/Supabase CLI installed and versioned (`.nvmrc`)
- [ ] `apps/web` bootstrapped: Vite + React 19 + TS strict
- [ ] `apps/edge` bootstrapped: Hono + Wrangler + Zod
- [ ] `packages/shared` with first schema + type
- [ ] `packages/ui` with `<Button>` + first Storybook story
- [ ] Supabase local: `supabase start` works, migrations apply, seed
      runs
- [ ] `pnpm dev` runs web + edge + supabase concurrently
- [ ] Git hooks (lint-staged + Biome on commit)
- [ ] CI: lint + typecheck + unit tests on every PR

**Deliverable**: Hello-world React app calling `/health` on the edge
API, returning 200 with a DB round-trip.

---

## Phase 1 — Auth + first track (2 days)

Goal: a user can sign in and generate their first track.

### Backend

- [ ] Supabase Auth configured (magic link + Google)
- [ ] `profiles` table + trigger on signup
- [ ] JWT middleware on edge API
- [ ] `POST /generate` route (calls fake-suno in dev)
- [ ] `fake-suno` mock Worker
- [ ] `generations` + `tracks` tables
- [ ] Webhook handler for `generation.complete`
- [ ] Audio upload to Supabase Storage (R2 later)
- [ ] Peaks JSON generation (server-side FFT)
- [ ] WebSocket: Durable Object + progress events

### Frontend

- [ ] Landing / sign-in page (S1)
- [ ] Studio page shell (S2)
- [ ] Prompt input with validation
- [ ] Generate button → POST + WS subscribe
- [ ] Streaming waveform UI (S3)
- [ ] WaveSurfer integration
- [ ] Track detail page (S4)
- [ ] Basic playback controls

### Design system pieces

- [ ] Tokens (colors, type, space, motion)
- [ ] Button, Input, Dialog, Toast primitives
- [ ] Waveform composed component
- [ ] Motion vocabulary: appear, disappear, fill

**Deliverable**: Sign in with magic link, type a prompt, see a
waveform fill, hear audio. First-sound within 5s of pressing Generate
(using fake-suno timings that simulate real Suno latency).

---

## Phase 2 — Library + playlists (1.5 days)

Goal: user's tracks are findable and organizable.

### Backend

- [ ] `GET /tracks` with cursor pagination
- [ ] `PATCH /tracks/:id` for metadata edits
- [ ] `DELETE /tracks/:id` soft delete
- [ ] `playlists` + `playlist_tracks` tables
- [ ] Playlist CRUD routes
- [ ] Reorder via `position` float

### Frontend

- [ ] Library view (left rail + grid/list)
- [ ] Virtualized list for scale
- [ ] Playlist create/rename
- [ ] Add-to-playlist menu on track row
- [ ] Playlist detail view (S5)
- [ ] Drag-reorder with FLIP
- [ ] Cover gradient from spectral data

### Design system pieces

- [ ] TrackRow component
- [ ] PlaylistCard component
- [ ] ContextMenu primitive
- [ ] Motion: slide, crossfade, expand/collapse
- [ ] Keyboard navigation (j/k in lists)

**Deliverable**: 20+ tracks in library, sortable, searchable by title.
Three playlists with reorderable tracks and cover gradients.

---

## Phase 3 — Sharing + public view (1 day)

Goal: user can share a playlist as a URL; anon users can play it.

### Backend

- [ ] `shares` table + token generation
- [ ] `POST /playlists/:id/shares` create
- [ ] `DELETE /shares/:id` revoke
- [ ] `GET /share/:token` unauthenticated read
- [ ] Server-rendered public view (separate route handler that
      returns HTML)
- [ ] OG image auto-generation (server-side SVG → PNG)
- [ ] Rate limiting on `/share/:token`

### Frontend

- [ ] Share dialog (channel label, expiration)
- [ ] Public share view (S6) — could be a separate Vite entry or
      plain HTML template
- [ ] Copy-to-clipboard UX
- [ ] Revoke UI in playlist settings

### Design system pieces

- [ ] ShareDialog component
- [ ] Copy feedback pulse motion

**Deliverable**: Share a playlist, paste URL in incognito, hear it
play. Revoke → URL is dead within 60s.

---

## Phase 4 — Polish + performance (1 day)

Goal: the product *feels* shipped.

- [ ] Accessibility pass: axe + keyboard + screen reader
- [ ] Empty states for every list and view
- [ ] Error states for every fetch
- [ ] Loading skeletons
- [ ] First-generation micro-celebration
- [ ] Command palette (Cmd-K) with top 10 actions
- [ ] Keyboard shortcuts documented
- [ ] `prefers-reduced-motion` respected everywhere
- [ ] Performance budgets enforced (size-limit, Lighthouse CI)
- [ ] LCP < 1.8s on mid-tier mobile
- [ ] CLS < 0.1
- [ ] Sentry + Axiom wired up

**Deliverable**: Lighthouse score ≥ 95 on all metrics. Axe-clean.
Feels real.

---

## Phase 5 — Deploy (0.5 day)

Goal: production deploy pipeline works.

- [ ] Cloudflare Pages connected to repo
- [ ] Cloudflare Workers deploy via wrangler in CI
- [ ] Supabase/Neon production project provisioned
- [ ] Migration deploy step in CI
- [ ] DNS (setlist.app or whatever domain)
- [ ] Secrets in CF + Doppler
- [ ] CSP in enforce mode
- [ ] Smoke tests against prod
- [ ] Status page

**Deliverable**: `https://setlist.app` works end to end. First real
Suno-generated track plays.

---

## Phase 6 — Interview prep (0.5 day)

Goal: the demo walkthrough is tight.

- [ ] Demo script rehearsed 3× (see
      [`../interview/DEMO_SCRIPT.md`](../interview/DEMO_SCRIPT.md))
- [ ] Known questions → answers reviewed (see
      [`../interview/STACK_QA.md`](../interview/STACK_QA.md))
- [ ] Questions-for-them ready (see
      [`../interview/QUESTIONS_FOR_COMPANY.md`](../interview/QUESTIONS_FOR_COMPANY.md))
- [ ] One-pager talking points (see
      [`../interview/TALKING_POINTS.md`](../interview/TALKING_POINTS.md))
- [ ] Backup plan for live-demo fail (screenshots + recorded video)

**Deliverable**: I can walk into the room and own the 30-minute slot.

---

## Total: ~6.5 days

Realistically 2 weeks elapsed at sustainable pace (8h/day, weekends
off). Compressible to 1 week flat-out if the interview is next
Monday.

---

## What Phase 1 is NOT

Not fully polished. Phase 1 just needs to work. Polish happens in
Phase 4. The temptation to polish as you go kills velocity. Resist.

## What Phase 4 is NOT

Not adding features. Only making the Phase 1-3 features feel
shipped. If you catch yourself building a new feature in Phase 4,
stop — it belongs in the [`FEATURES.md`](./FEATURES.md) P1 list for
next cycle.

---

## Cuts, if time is tight

In order of what to cut first:

1. **Cover gradient from spectral data** — keep a static gradient
   per playlist color instead. Saves 3 hours.
2. **Playlist drag-reorder** — keep up/down arrows. Saves 2 hours.
3. **Virtualized library** — ceiling at 100 tracks. Saves 2 hours.
4. **Playlists entirely** — demo with tracks only, share single
   tracks. Saves 1.5 days but weakens the demo.
5. **Share links** — cut last. Share links are the product hook.

**Don't cut**:
- Streaming waveform UI (CP2 is the demo's heartbeat).
- Accessibility baseline.
- Loading / empty / error states.
- First-generation micro-celebration (it's the emotional hook).

---

## What NOT to build (yet)

Deferred to P1 / P2 unless the interviewer asks:

- Regenerate segment
- Export to MP3/Opus
- Mobile PWA
- Collaborative playlists
- `.setlist` file format
- Token visualization
- Stem separation
- Billing

Each of these is a talking point in the interview. "I considered
[feature] and here's why I cut it from v1" is a stronger signal than
a bloated half-built version.

---

## Risks

| Risk | Mitigation |
|---|---|
| Suno API rate-limits us mid-build | Use fake-suno for 95% of dev; hit real Suno only for final E2E |
| WebSocket + Durable Objects has a gotcha | Spike it in Phase 0, not Phase 1 |
| WaveSurfer doesn't handle streaming well | Prototype in Phase 0 with a fake streaming URL |
| Auth + passkey flow is fiddly | Ship magic-link first, passkey in Phase 4 if time |
| Design iteration burns days | Tokens + Storybook in Phase 0 cap iteration cost |
| Deploy is harder than expected | Phase 0 ships a minimal end-to-end prod deploy to prove the pipeline |

---

## Outcome metric

The demo is a success if, at the end:

1. I can walk through CP1 + CP2 + F1.7 (share) in under 5 minutes.
2. The interviewer asks at least one question that digs into a
   tradeoff I already documented.
3. I can answer a stack question cleanly (see
   [`../interview/STACK_QA.md`](../interview/STACK_QA.md)).
4. The interviewer asks "can I see the code?" and I say yes without
   blushing.

That's it. Hired or not, I have a polished artifact.
