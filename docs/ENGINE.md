# GALLEY Engine — API quick reference for any agent

The generation engine is plain HTTP on localhost. Any LLM, agent, or script
that can make a web request can drive it — no SDK, no client library, no
provider lock-in. FAL_KEY stays inside the server process (loaded from `.env`);
callers never see or send credentials.

## Boot

```bash
cd "/Users/isaachernandez/blog design"
npm run engine        # image :5411 (local mflux, free) + video :5412 (fal proxy)
```

Health: `GET :5411/health`, `GET :5412/health` (expect `{"ok":true,"hasKey":true}`).

## Video server — 127.0.0.1:5412

All POST bodies are JSON. Paid routes return `{jobId}`; poll the job route.

| Route | Cost | Purpose |
|---|---|---|
| `GET /health` | free | `{ok, hasKey}` |
| `GET /v1/models` | free | curated registry (verified prices) |
| `GET /v1/catalog?category=` | free | full fal catalog. Categories: `text-to-video`, `image-to-video`, `text-to-image`, `image-to-image` |
| `POST /v1/videos/estimate` | free | `{model}` or `{endpoint}` + `durationSeconds` → `{usd, seconds, pricingText?}` — usd is null rather than ever fabricated |
| `POST /v1/videos/generations` | PAID | `{prompt, model}` (curated) or `{prompt, endpoint, imageUrl?, params?}` (any catalog slug) → `{jobId}` |
| `POST /v1/images/fal` | PAID | `{prompt, endpoint, imageUrl?, params?}` → `{jobId}` — premium stills (Nano Banana 2, Seedream, Flux...) |
| `POST /v1/audio/estimate` | free | `{text}` → `{usd, characters}` ($0.05 / 1000 chars) |
| `POST /v1/audio/speech` | PAID | `{text, voice?}` → `{jobId}` — ElevenLabs Turbo v2.5 via fal |
| `GET /v1/videos/jobs/:id` | free | `{status, videoUrl, imageUrl, audioUrl, sourceUrl, error}` — status: queued/running/done/error |
| `GET /videos/:f` `/images/:f` `/audio/:f` | free | serves the locally-owned artifacts from `output/` |

Notes:
- `params` is an open object merged into the fal input (e.g. `{"resolution":"720p","duration":5,"seed":42,"aspect_ratio":"16:9"}`). Scalars only.
- `sourceUrl` on a done job is the fal-hosted copy — feed it as `imageUrl`
  to chain image → video (fal cannot fetch localhost URLs).
- Completed media is ALWAYS downloaded to `output/videos|images|audio/` —
  local ownership is the contract.

## Image server — 127.0.0.1:5411 (free, local)

`POST /v1/images/generations` `{prompt, width, height}` → mflux (Z-Image
Turbo) on-device. Free and unlimited; first call downloads weights.

## Palmier Pro (editing) — 127.0.0.1:19789/mcp

Streamable-HTTP MCP server (also registered as `palmier-pro` for Claude Code).
Any MCP client can connect. Key flow learned in production:
1. `manage_project {action:'open', name:...}` first — sessions bind per project.
2. `import_media {source:{path}}` → `add_clips {entries:[{mediaRef, startFrame, source:[s0,s1]}]}`.
3. `get_transcript {granularity:'segments'|'words'}` returns narration in
   project frames — cut picture to these numbers.
4. NEVER `remove_clips` on an embedded-audio partner — link groups delete the
   video too. Silence with `set_clip_properties {volume: 0}` instead.
5. `export_project {mode:'video', outputPath}`.

## Cost discipline (applies to every caller, human or model)

- Estimates are free; call them first, always.
- Displayed prices are never below fal's listed rate; unparseable prices
  surface fal's own pricing text instead of a guess.
- Nothing auto-fires: the canvas parks video nodes in graph/loop runs, and
  scripts should present a total before a batch.
- Reference build: 59s film = $0.20 smoke + $0.04 VO + $1.04 stills +
  $18.20 motion (12 x 5s Seedance 2.0 720p) ~= $19.50. See
  `docs/video/2026-07-18-what-we-made.md`.
