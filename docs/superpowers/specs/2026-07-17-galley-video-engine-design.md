# GALLEY Video Engine — Design

Date: 2026-07-17
Status: Approved approach (A) — local video proxy server
Owner: Isaac

## Purpose

Give the unified Creative Canvas (`#/canvas-creative`) a real video-generation
path. Today the `video` node kind is a stub — running it prints "Connect a
video-generation endpoint to render the final clip"
(`src/pages/CreativeCanvasPage.tsx:671`). This design fills that socket with a
general-purpose engine backed by fal.ai, so one API key reaches Kling, Veo,
Seedance, Luma Ray and future models.

Decisions made during brainstorming:

- **Scope:** general video engine (not issue-film-specific tooling).
- **Model access:** one fal.ai aggregator key.
- **Home:** GALLEY canvas `video` node first; other surfaces later.
- **Spend guard:** cost-confirm per run — every paid generation shows an
  estimated dollar figure and waits for an explicit click.

## Architecture

Mirrors the existing local image path (`tools/local-image-server.mjs` on
`:5411`). The browser never holds the fal.ai key.

```
Canvas video node ──HTTP──▶ tools/local-video-server.mjs (127.0.0.1:5412)
                                   │  holds FAL_KEY (server-side .env)
                                   ▼
                              fal.ai queue API (submit → poll → result)
                                   │
                                   ▼
                       output/videos/<jobId>.mp4 (downloaded, owned locally)
```

## Components

### 1. `tools/local-video-server.mjs`

Node ESM server, binds `127.0.0.1:5412`, reads `FAL_KEY` from `.env`
(no `VITE_` prefix — must never enter the client bundle).

Endpoints:

| Route | Purpose |
|---|---|
| `GET /v1/models` | Curated model registry with pricing metadata |
| `POST /v1/videos/estimate` | `{model, durationSeconds, resolution}` → `{usd}` |
| `POST /v1/videos/generations` | `{prompt, model, durationSeconds, imageUrl?}` → submit to fal queue → `{jobId}` |
| `GET /v1/videos/jobs/:id` | `{status: queued\|running\|done\|error, videoUrl?, error?}` |
| `GET /videos/:file` | Serves downloaded results from `output/videos/` |

Model registry (initial; fal endpoint slugs and prices verified against
fal.ai's live catalog at implementation time, not hardcoded from memory):

- Veo 3.1 Fast — cheap default, audio, text→video and image→video
- Kling — best quality-per-dollar clips
- Seedance — fast/cheap iteration
- Luma Ray — prompt-adherence pick

On job completion the server downloads the MP4 into `output/videos/` and
returns a localhost URL — generations are owned locally, not just hosted on
fal (own-your-output).

### 2. Canvas changes (`src/pages/CreativeCanvasPage.tsx`)

- `LOCAL_VIDEO_ENDPOINT = 'http://localhost:5412'` alongside the image one.
- `StudioNode` gains `videoUrl?: string`.
- Replace the stub execution: on run, the node
  1. resolves upstream context (nearest upstream `image` node with an
     `imageUrl` becomes image→video input; prompt text composed the same way
     other nodes compose upstream context),
  2. fetches an estimate, opens a **cost-confirm dialog** (model, duration,
     estimated `$`) — Confirm fires the job, Cancel aborts with no spend,
  3. polls the job every 3s while `status: 'running'`,
  4. on completion stores `videoUrl` and renders an inline `<video controls>`
     preview replacing the `cc-video-preview` placeholder.
- **GALLEY loop rule:** the autonomous loop and chat-driven runs may create
  and prepare video nodes but never auto-fire them. A prepared node parks as
  "ready — awaiting cost confirmation"; only the human click spends money.
- Server offline → toast: "Local video server offline — run:
  `npm run video-server`" (same pattern as the image server).

### 3. Config

- `.env`: `FAL_KEY=` (Isaac creates the fal.ai account and pastes the key —
  Claude never handles the secret value).
- `.env.example`: documented `FAL_KEY=` entry under a "Video generation" section.
- `package.json`: `"video-server": "node tools/local-video-server.mjs"`.

## Error handling

- Missing `FAL_KEY` → server starts but every generation returns a clear
  "FAL_KEY not set" error; canvas surfaces it as a toast.
- fal API errors → passed through with fal's message; node `status: 'error'`.
- Job timeout: 10 minutes of polling → node errors with "generation timed out";
  the jobId remains queryable.
- Estimate unavailable (unknown model) → confirm dialog shows "price unknown —
  check fal.ai" rather than a fabricated number; still requires explicit confirm.

## Testing

- Vitest: model registry shape, estimate math, job-state mapping —
  fal HTTP mocked, never called in tests (per testing rules).
- Type gate: `npx tsc --noEmit`.
- Live smoke (per the live-smoke rule): exactly one real generation with the
  cheapest model at minimum duration, only after Isaac explicitly approves the
  spend in-session.

## Security

- `FAL_KEY` server-side only; server binds loopback; key never logged.
- No client-side secrets; no `VITE_FAL_*` variables, ever.

## Out of scope (explicitly)

- Supabase edge-function deployment (phase 2 if the canvas returns to the
  public site).
- kbot tool surface and standalone-service refactor.
- Editing/assembly (Palmier owns that); this engine produces clips.
