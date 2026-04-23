# Architecture

## One-page view

```
┌────────────────────────────────────────────────────────────────────┐
│                          Browser (React 19)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────┐      │
│  │ Prompt   │  │ Player   │  │ Playlist │  │ Share/Public    │      │
│  │ Studio   │  │ + Wave   │  │ Drawer   │  │ Link Viewer     │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬────────┘      │
│       │             │             │                 │               │
│       └──── Zustand (state) ──── React Query (server state) ───┐    │
│             │                                                   │    │
│             │  HTTPS (REST)           WSS (progress stream)     │    │
└─────────────┼──────────────────────────────────┬────────────────┼────┘
              │                                  │                │
              ▼                                  ▼                │
      ┌────────────────────────────────────────────────┐          │
      │         Edge API (Hono on Cloudflare)          │          │
      │  /api/v1/generate    /api/v1/tracks            │          │
      │  /api/v1/playlists   /api/v1/share/:token      │          │
      │  /api/v1/ws          (websocket upgrade)       │          │
      └────────┬──────────────────────┬────────────────┘          │
               │                      │                           │
               ▼                      ▼                           │
      ┌────────────────┐      ┌─────────────────────┐             │
      │  Supabase      │      │  Suno API           │             │
      │  Postgres +    │      │  (generation)       │◀────────────┘
      │  Auth +        │      │  + webhook callback │
      │  Storage +     │      └─────────┬───────────┘
      │  Realtime      │                │
      └───────┬────────┘                ▼
              │                  ┌────────────────┐
              │                  │ Storage (R2/   │
              │                  │ Supabase       │
              └─────────────────▶│ Storage)       │
                                 └────────────────┘
```

## Layers

### 1. Browser — React 19 + Vite

- **State**: Zustand stores for UI state (which drawer open, which track
  selected). React Query (TanStack Query) for server state — tracks,
  playlists, generations.
- **Routing**: React Router v7 with lazy-loaded route modules.
- **Realtime**: one `WebSocket` connection per session, multiplexed by
  `generation_id`. Falls back to polling if WS fails twice in a row.
- **Audio**: `<audio>` element driven by a Zustand store. Waveform rendered
  via WaveSurfer.js from a pre-computed peaks JSON (generated server-side
  to avoid decoding 5MB of audio on first paint).

### 2. Edge API — Hono on Cloudflare Workers

- Single Worker, Hono router, Zod validation per route.
- JWT auth middleware that validates Supabase JWTs (no round-trip — verifies
  signature locally).
- Per-route rate limits via Cloudflare Rate Limiting rules (keyed on
  `user_id` for authed, IP for anon).
- WebSocket upgrade handled on `/api/v1/ws` using the Workers WebSocket API
  with a Durable Object for connection state.

### 3. Data — Supabase

- **Auth**: Supabase Auth (email magic link + Google OAuth).
- **Postgres**: tables described in [`DATA_MODEL.md`](./DATA_MODEL.md).
  Row-level security (RLS) on every user-owned row.
- **Storage**: S3-compatible buckets for generated audio + peaks JSON.
  Signed URLs (24hr) for private tracks; public URLs for shared tracks.
- **Realtime**: Postgres `NOTIFY` triggers broadcast generation status
  changes. Edge API subscribes and fans out to connected WebSockets.

### 4. External — Suno API

- Synchronous `/generate` returns a `generation_id` immediately.
- Webhook callback on completion hits `/api/v1/webhooks/suno` → updates
  `generations` row → Postgres `NOTIFY` → WebSocket push to the browser.
- Webhook is HMAC-signed; edge verifies before processing.

## Request lifecycle: "generate a track"

1. User types prompt, hits Generate.
2. Client POSTs `/api/v1/generate` with `{ prompt, style_tags, duration }`.
3. Edge API:
   - Validates JWT
   - Rate-limit check (10 gens/hour/user)
   - Inserts `generations` row with status `queued`
   - Calls Suno API `/generate`, stores returned `suno_job_id`
   - Updates row to `generating`
   - Returns `{ generation_id }` to client
4. Client shows streaming UI, opens WS to `/api/v1/ws?generation_id=...`.
5. WS handler subscribes to Postgres NOTIFY channel for that `generation_id`.
6. Suno webhook arrives → edge verifies HMAC → updates row to `complete` →
   uploads audio to Storage → generates peaks JSON → NOTIFY fires.
7. WS receives NOTIFY, pushes `{ status: 'complete', audio_url, peaks_url }`
   to client.
8. Client swaps streaming UI for playable track.

## Failure modes + what happens

| Failure | Detection | Recovery |
|---|---|---|
| Suno API 5xx | HTTP status on initial call | Exponential backoff, 3 retries, then user-facing error with retry button |
| Webhook never arrives | 5min timeout on `generating` row | Background job polls Suno `/status/:id`, updates row |
| WS drops mid-generation | `onclose` in client | Auto-reconnect with backoff; server replays last known state |
| Storage upload fails | Caught in webhook handler | Mark generation `failed`, show user retry option, keep Suno job_id to avoid re-billing |
| Rate limit hit | 429 from edge | Client shows "try again in 12min" with countdown |
| RLS denies read | 403 from Supabase | Client treats as 404 (don't leak existence) |

## Deployment topology

```
                  ┌──────────────────────┐
                  │  Cloudflare (global) │
                  │  ├─ Workers (edge)   │
                  │  ├─ R2 (audio)       │
                  │  └─ Pages (SPA)      │
                  └──────────┬───────────┘
                             │
                  ┌──────────▼───────────┐
                  │  Supabase (us-east)  │
                  │  ├─ Postgres         │
                  │  ├─ Auth             │
                  │  └─ Storage (fallback│
                  │      if R2 down)     │
                  └──────────────────────┘
```

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for CI/CD.

## Why this shape

- **Edge over monolith** — generation requests are I/O bound, not CPU bound.
  Workers give global low-latency entry without managing servers.
- **Postgres `NOTIFY` over a separate pub/sub** — one less system to run.
  Works up to ~1000 concurrent listeners, well above demo scale.
- **WebSockets over SSE** — need client→server (cancel requests), not just
  server→client.
- **Peaks pre-computed** — first paint of waveform in <100ms vs decoding
  a 5MB MP3 in-browser (~800ms on a mid-tier phone).

See [`TRADEOFFS.md`](./TRADEOFFS.md) for the ones I'd revisit.
