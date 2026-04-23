# API

REST over HTTPS + WebSocket for realtime. Every route typed (Zod/Valibot
schemas shared client↔server), every route authed except where noted.

Base URL: `https://api.setlist.app/api/v1`

---

## Auth

All routes except `/auth/*`, `/share/:token`, and `/health` require
a Bearer JWT from Supabase Auth.

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR...
```

JWT claims:
```ts
{
  sub: string;           // user UUID
  email: string;
  role: 'authenticated';
  exp: number;
}
```

Edge verifies JWT signature locally (no round-trip to Supabase).

### Error format

Every error is the same shape. Always.

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many generations this hour. Try again in 12 min.",
    "retry_after": 720,
    "trace_id": "01JQMT..."
  }
}
```

Error codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`,
`RATE_LIMITED`, `QUOTA_EXCEEDED`, `UPSTREAM_FAILURE`, `INTERNAL`.

Every error includes `trace_id` for support.

---

## Generation

### `POST /generate`

Kicks off a new generation.

**Request**:
```json
{
  "prompt": "lo-fi piano, 72 BPM, after rain",
  "style_tags": ["lofi", "piano"],
  "duration_sec": 120,
  "lyrics": null
}
```

**Response** (202 Accepted):
```json
{
  "generation_id": "gen_01JQMT...",
  "status": "queued",
  "estimated_ready_sec": 18
}
```

**Rate limit**: 10/hour (free), 100/hour (pro).

**Error cases**:
- `VALIDATION` — prompt empty, duration out of range, style_tags > 10
- `RATE_LIMITED` — hourly limit hit
- `QUOTA_EXCEEDED` — monthly cap
- `UPSTREAM_FAILURE` — Suno API down; retry-safe

### `GET /generations/:id`

Current status of a generation. Prefer WebSocket for realtime updates.

**Response**:
```json
{
  "id": "gen_01JQMT...",
  "status": "generating",
  "progress_pct": 45,
  "prompt": "...",
  "created_at": "2026-04-23T15:22:00Z",
  "track_id": null
}
```

`status`: `queued` | `generating` | `complete` | `failed` | `cancelled`

### `POST /generations/:id/cancel`

Cancel in-flight generation. Idempotent.

**Response** (200 OK): updated generation record.

### `POST /generations/:id/retry`

Retry a failed generation. Doesn't regenerate tokens already
produced — picks up from last good segment if possible.

---

## Tracks

### `GET /tracks`

List user's tracks.

**Query**:
- `cursor` (opaque, for pagination)
- `limit` (default 20, max 100)
- `sort` = `created_desc` | `created_asc` | `duration_desc`

**Response**:
```json
{
  "items": [
    {
      "id": "trk_...",
      "title": "Untitled",
      "prompt": "...",
      "duration_sec": 120,
      "audio_url": "https://cdn.setlist.app/...",
      "peaks_url": "https://cdn.setlist.app/...peaks.json",
      "is_public": false,
      "created_at": "..."
    }
  ],
  "next_cursor": "eyJjcmVhdGVkX..."
}
```

### `GET /tracks/:id`

Single track. 404 if not owner and not public.

### `PATCH /tracks/:id`

Update title, tags, visibility. Partial update.

```json
{ "title": "Rainy afternoon", "is_public": true }
```

### `DELETE /tracks/:id`

Soft delete (30-day recovery window). Returns the tombstone.

### `POST /tracks/:id/regenerate-segment`

Regenerate a time range of an existing track.

**Request**:
```json
{
  "start_sec": 45,
  "end_sec": 65,
  "prompt_override": "same vibe but with violin"
}
```

**Response**: new `generation_id` (same shape as `/generate`).

---

## Playlists

### `GET /playlists`

List user's playlists.

### `GET /playlists/:id`

Single playlist with tracks.

```json
{
  "id": "pl_...",
  "title": "Rainy sessions",
  "description": "",
  "cover_url": "...",
  "tracks": [ /* ordered */ ],
  "track_count": 7
}
```

### `POST /playlists`

Create.

```json
{ "title": "New playlist", "description": "" }
```

### `PATCH /playlists/:id`

Update fields.

### `DELETE /playlists/:id`

Delete. Tracks not deleted.

### `POST /playlists/:id/tracks`

Add a track.

```json
{
  "track_id": "trk_...",
  "position": 1024.5  // optional; appends if omitted
}
```

### `DELETE /playlists/:id/tracks/:track_id`

Remove.

### `PATCH /playlists/:id/tracks/:track_id`

Reorder.

```json
{ "position": 512.25 }
```

---

## Sharing

### `POST /playlists/:id/shares`

Create a share token for a playlist.

```json
{
  "label": "discord",
  "expires_at": "2026-05-23T00:00:00Z",
  "allow_forking": false
}
```

**Response**:
```json
{
  "id": "shr_...",
  "token": "XYZ23ab_-pqMNOpqrstuv",
  "url": "https://setlist.app/p/XYZ23ab_-pqMNOpqrstuv"
}
```

### `GET /playlists/:id/shares`

List active shares for a playlist.

### `DELETE /shares/:id`

Revoke.

### `GET /share/:token` (unauthenticated)

Public read of a shared playlist.

**Response**: sanitized playlist (no internal IDs, no other users'
data).

**Cache**: `Cache-Control: public, max-age=60, s-maxage=300` so R2 +
Cloudflare edge can cache hot share links.

**Rate limit**: 60 requests/min per IP (prevents token enumeration).

---

## Webhook (inbound, from Suno)

### `POST /webhooks/suno`

Suno-side callback when generation finishes.

**Headers**:
- `X-Suno-Signature: <HMAC>` — verified against
  `SUNO_WEBHOOK_SECRET`.
- `X-Suno-Event: generation.complete` | `generation.failed`

**Body** (Suno-defined):
```json
{
  "job_id": "...",
  "status": "complete",
  "audio_url": "...",
  "metadata": { ... }
}
```

Processing:
1. Verify HMAC. If invalid → 401 and alert.
2. Look up `generation` by `suno_job_id`.
3. Download audio, upload to R2, generate peaks JSON.
4. Update `generations` row → `complete`.
5. Trigger `NOTIFY` → WS fans out to client.

Idempotent: if the webhook fires twice for the same job, step 4's
update is a no-op because `status` is already `complete`.

---

## WebSocket

### `GET /ws` (upgrade)

Single WS per session, multiplexed.

**Connection**:
- Authenticated via query param `?token=<jwt>` or Sec-WebSocket-Protocol.
- Server echoes `{ "type": "hello", "session_id": "..." }` within 100ms.

**Client → Server messages**:

```ts
// Subscribe to a generation
{ "type": "subscribe", "generation_id": "gen_..." }

// Unsubscribe
{ "type": "unsubscribe", "generation_id": "gen_..." }

// Ping (client-initiated, for RTT measurement)
{ "type": "ping", "ts": 1719000000000 }

// Cancel an in-flight generation
{ "type": "cancel", "generation_id": "gen_..." }
```

**Server → Client messages**:

```ts
// Handshake
{ "type": "hello", "session_id": "..." }

// Progress update
{
  "type": "progress",
  "generation_id": "gen_...",
  "progress_pct": 35,
  "status": "generating"
}

// Completion
{
  "type": "complete",
  "generation_id": "gen_...",
  "track_id": "trk_...",
  "track": { /* full track */ }
}

// Failure
{
  "type": "failed",
  "generation_id": "gen_...",
  "error": { "code": "UPSTREAM_FAILURE", "message": "..." }
}

// Heartbeat (server-initiated)
{ "type": "heartbeat", "ts": 1719000000000 }

// Pong
{ "type": "pong", "ts_echo": 1719000000000, "ts_server": 1719000000050 }
```

**Reconnect**: client auto-reconnects with exponential backoff
(1s, 2s, 5s, 10s, 20s, cap). On reconnect, re-sends all
subscriptions. Server replays latest state for each subscribed ID.

**Durable Objects**: each session's WS state lives in a single
Durable Object instance, so messages are strictly ordered per-session.
Pub/sub across sessions via Postgres NOTIFY.

---

## Pagination

Cursor-based, always. Never offset — it's O(n) at scale and inconsistent
under concurrent writes.

```
GET /tracks?cursor=eyJjcmVhdGVkX2F0IjoiMjAyNi0wNC0yM1QxNTowMDowMFoifQ
```

Cursor is opaque base64-encoded JSON: `{ "created_at": "...", "id": "..." }`.

---

## Rate limiting

Enforced at the edge via Cloudflare Rate Limiting Rules.

| Route | Limit | Window |
|---|---|---|
| `/auth/*` | 20 | 1 min per IP |
| `/generate` | 10 | 1 hour per user (free) / 100 pro |
| `/tracks` (writes) | 60 | 1 min per user |
| `/share/:token` (anon read) | 60 | 1 min per IP |
| `/ws` connect | 10 | 1 min per user |
| Everything else | 300 | 1 min per user |

Headers on every response:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1719003600
```

---

## Versioning

URL path: `/api/v1/...`. Bumping to `v2` requires a 12-month
deprecation window for `v1`. `Deprecation` and `Sunset` headers on
`v1` routes once `v2` ships.

Never version route-by-route — only wholesale.

---

## OpenAPI

`api/openapi.json` auto-generated from Zod/Valibot schemas via
`@hono/zod-openapi`. Published at `/api/openapi` for tooling. Used
by:
- Internal client codegen (TanStack Query wrappers).
- Postman / Insomnia import.
- API docs site.

---

## Latency budgets (per-route p95)

| Route | p95 | Failure mode |
|---|---|---|
| `POST /generate` | 300 ms (queue insert + Suno handoff) | retry with backoff |
| `GET /tracks` | 150 ms | stale cache if PG slow |
| `GET /generations/:id` | 80 ms | N/A |
| `GET /share/:token` | 100 ms edge-cached / 200 ms cold | N/A |
| `POST /webhooks/suno` | < 1 s processing | 500 + Suno retries |
| WS first message | 150 ms from connect | reconnect loop |

---

## Examples

### End-to-end generation

```bash
# 1. Kick off
curl -X POST https://api.setlist.app/api/v1/generate \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"jazz trio, blue note era","duration_sec":90}'
# → { "generation_id": "gen_01...", "status":"queued" }

# 2. (or) Subscribe over WS instead of polling
wscat -H "Authorization: Bearer $JWT" \
  -c wss://api.setlist.app/api/v1/ws
> {"type":"subscribe","generation_id":"gen_01..."}
< {"type":"progress","generation_id":"gen_01...","progress_pct":15}
< {"type":"progress","progress_pct":60}
< {"type":"complete","track_id":"trk_01..."}

# 3. Fetch the track
curl https://api.setlist.app/api/v1/tracks/trk_01... \
  -H "Authorization: Bearer $JWT"
```

### Share and load

```bash
# Create share
curl -X POST https://api.setlist.app/api/v1/playlists/pl_01.../shares \
  -H "Authorization: Bearer $JWT" \
  -d '{"label":"discord","expires_at":null}'
# → { "url": "https://setlist.app/p/XYZ..." }

# Anon load
curl https://api.setlist.app/api/v1/share/XYZ...
# → sanitized playlist JSON
```
