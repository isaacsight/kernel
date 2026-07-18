# GALLEY engine: operator reference

GALLEY exposes image, video, and speech generation over plain HTTP. Both
generation servers bind to `127.0.0.1`; callers need no provider SDK and cannot
read `FAL_KEY`, which stays in the video server process.

This file is the contract for agents operating the engine. Read it before
making requests. Inspecting models, catalogs, health, estimates, and job status
is free. Generation through port 5412 is paid.

## Start and verify

From the repository root:

```bash
cd "/Users/isaachernandez/blog design"
npm run engine
```

This foreground process starts the local mflux image server on `:5411` and the
fal proxy on `:5412`. Keep it running in a separate terminal; `Ctrl-C` stops
both. To run only one service, use `npm run image-server` or
`npm run video-server`.

Read-only smoke checks:

```bash
curl -sS http://127.0.0.1:5411/health
curl -sS http://127.0.0.1:5412/health
curl -sS http://127.0.0.1:5412/v1/models
```

Port 5411 reports `{ok, backend, busy}`. Port 5412 reports
`{ok, hasKey, spendLimit, spentToday, jobsTracked}`; `spendLimit: null` means
the cap is disabled. Paid work requires both `ok: true` and `hasKey: true`.
When spend state cannot be trusted, health reports `ok: false` with
`spendError` and paid requests fail closed.

## Non-negotiable paid-call protocol

Before every request marked **PAID** below:

1. Fetch the applicable estimate or catalog price.
2. If the price is unknown, stop; do not infer a price from another model.
3. Present the per-item price, quantity, and batch total to the human.
4. Wait for explicit approval of that total.
5. Submit only the approved work, then report job IDs and final status.

An earlier approval does not authorize a retry or a larger batch. The HTTP
server cannot verify human approval; the caller is responsible for this gate.

## fal proxy — `http://127.0.0.1:5412`

All POST bodies are JSON and require `Content-Type: application/json`.

| Route | Cost | Request / response |
|---|---:|---|
| `GET /health` | free | Key availability and today's spend-cap state |
| `GET /v1/models` | free | Curated video models and normalized prices |
| `GET /v1/catalog?category=CATEGORY` | free | fal endpoints and their published pricing text |
| `POST /v1/videos/estimate` | free | `{model, durationSeconds}` or `{endpoint, durationSeconds}` → `{usd, seconds, pricingText?}` |
| `POST /v1/videos/generations` | **PAID** | Curated model or catalog endpoint → `{jobId}` |
| `POST /v1/images/estimate` | free | `{endpoint}` → `{usd, pricingText, unit}` |
| `POST /v1/images/fal` | **PAID** | Premium image endpoint → `{jobId}` |
| `POST /v1/audio/estimate` | free | `{text}` → `{usd, characters}` |
| `POST /v1/audio/speech` | **PAID** | `{text, voice?}` → `{jobId}` |
| `GET /v1/videos/jobs/JOB_ID` | free | Poll any video, image, or audio job |
| `GET /videos/FILE`, `/images/FILE`, `/audio/FILE` | free | Serve completed local artifacts |

Valid catalog categories are `text-to-video`, `image-to-video`,
`text-to-image`, and `image-to-image`. Catalog data is cached for one hour.

### Curated video flow

Use model IDs returned by `/v1/models`. Estimate first:

```bash
curl -sS -X POST http://127.0.0.1:5412/v1/videos/estimate \
  -H 'Content-Type: application/json' \
  -d '{"model":"seedance-lite","durationSeconds":5}'
```

After explicit approval, submit the same model and duration:

```bash
# PAID: do not run without approval of the estimate above.
curl -sS -X POST http://127.0.0.1:5412/v1/videos/generations \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"A paper boat drifting slowly downstream","model":"seedance-lite","durationSeconds":5}'
```

For image-to-video, add `"imageUrl":"https://..."`. A curated model without
image support falls back to its text endpoint, so check `supportsImage` in
`/v1/models` before promising image conditioning.

### Catalog video flow

Catalog endpoint estimates only know prices already loaded into the server's
one-hour catalog cache. Fetch the relevant category first, select its exact
`endpointId`, and retain its `pricingText`:

```bash
curl -sS 'http://127.0.0.1:5412/v1/catalog?category=image-to-video'
curl -sS -X POST http://127.0.0.1:5412/v1/videos/estimate \
  -H 'Content-Type: application/json' \
  -d '{"endpoint":"fal-ai/EXACT-ENDPOINT","durationSeconds":5}'
```

If `usd` is `null`, show `pricingText` to the human and stop unless the price
can be unambiguously calculated from that text. After approval:

```bash
# PAID
curl -sS -X POST http://127.0.0.1:5412/v1/videos/generations \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Subtle camera push-in","endpoint":"fal-ai/EXACT-ENDPOINT","imageUrl":"https://...","durationSeconds":5,"params":{"resolution":"720p","duration":5,"seed":42,"aspect_ratio":"16:9"}}'
```

`endpoint` must be an exact fal slug. `params` accepts only flat JSON strings,
numbers, and booleans; nested objects and arrays are discarded. Endpoint
schemas differ, so copy field names and allowed values from the selected
catalog model rather than assuming the example fits every endpoint.

### Premium images and speech

Load `text-to-image` or `image-to-image` first so the endpoint and price are in
the catalog cache, then request the estimate. Stop if `usd` is null and
`pricingText` does not yield an unambiguous price.

```bash
curl -sS 'http://127.0.0.1:5412/v1/catalog?category=text-to-image'
curl -sS -X POST http://127.0.0.1:5412/v1/images/estimate \
  -H 'Content-Type: application/json' \
  -d '{"endpoint":"fal-ai/EXACT-ENDPOINT"}'

# PAID
curl -sS -X POST http://127.0.0.1:5412/v1/images/fal \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Editorial paper collage of a tiny studio","endpoint":"fal-ai/EXACT-ENDPOINT","params":{"aspect_ratio":"16:9"}}'
```

Estimate speech using the final text, since price is character-based:

```bash
curl -sS -X POST http://127.0.0.1:5412/v1/audio/estimate \
  -H 'Content-Type: application/json' \
  -d '{"text":"The final narration goes here."}'

# PAID, after approval
curl -sS -X POST http://127.0.0.1:5412/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"text":"The final narration goes here."}'
```

Speech uses ElevenLabs Turbo v2.5 through fal. `voice` is optional.

### Polling and artifact ownership

Poll every few seconds, not in a tight loop:

```bash
curl -sS http://127.0.0.1:5412/v1/videos/jobs/JOB_ID
```

Statuses are `queued`, `running`, `done`, and `error`. On `done`, exactly one
of `videoUrl`, `imageUrl`, or `audioUrl` identifies the local copy. `sourceUrl`
is fal's remote result and is useful for chaining into another fal job because
fal cannot fetch `localhost`; treat remote URLs as temporary.

A non-null `pollError` is a transient status or download failure; the job stays
pollable and the server retries on the next status request. A terminal fal
`FAILED` or `CANCELLED` state returns `status: "error"` and `error`.

Completed files are downloaded to `output/videos/`, `output/images/`, or
`output/audio/`. Queue metadata is persisted in `output/job-registry.json`, so
queued, running, completed, and failed jobs remain pollable after a normal
server restart. Corrupt registry state is ignored with a startup warning; it
never blocks new work or invents job status.

## Local image server — `http://127.0.0.1:5411`

This route runs mflux Z-Image Turbo on the Mac and does not call fal:

```bash
curl -sS -X POST http://127.0.0.1:5411/v1/images/generations \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"A quiet machine on a desk","width":1024,"height":1024}'
```

It returns `{data:[{b64_json}], backend, seconds}`. Dimensions are rounded to
multiples of 64 and clamped to 512–1536. Only one generation runs at a time;
concurrent requests return HTTP 429. The first generation may download several
gigabytes of model weights. It has no provider cost but does consume local
compute, storage, and time.

## Spend cap and accounting

`FAL_DAILY_SPEND_LIMIT` in `.env` defaults to `$10.00` per local calendar day.
Set a positive dollar value to change it; set `0` to disable the cap. Restart
the video server after changing it. State lives in
`output/spend-tracker.json`, and a request that would exceed the cap returns
HTTP 402 before submission.

The tracker records the engine's estimate at queue submission, not fal's final
invoice. It refunds a submission that fal rejects immediately, but it does not
reconcile a job that fails later. For catalog endpoints absent from the cache,
the cap uses fallback accounting of `$0.40/output-second` for video and `$0.15`
per image. Those fallbacks are guardrails, not price quotes; callers must still
obtain an explicit price and approval before submitting.

Spend and job state are written atomically. Invalid limit configuration or a
corrupt spend tracker blocks paid work instead of silently resetting the total.

## Local browser boundary

Both services reject browser requests whose `Origin` is not localhost or
`127.0.0.1`; command-line agents without an `Origin` header continue to work.
To permit another trusted browser origin, add it to the comma-separated
`ENGINE_ALLOWED_ORIGINS` value in `.env` and restart. This is an origin and
cross-site-spend boundary, not authentication for hostile local processes.

Reference build: the 59-second film used `$0.20` smoke test + `$0.04` voice +
`$1.04` stills + `$18.20` motion (12 × 5-second Seedance 2.0 clips), about
`$19.50`. See `docs/video/2026-07-18-what-we-made.md`.

## Errors and recovery

| HTTP/status | Meaning | Action |
|---|---|---|
| 400 | Invalid JSON fields, model, endpoint, or filename | Correct the request; do not retry unchanged |
| 403 | Browser origin is outside the local allowlist | Stop or explicitly configure a trusted origin |
| 402 | Missing `FAL_KEY` or spend cap exceeded | Stop and report the exact error |
| 429 | Local image generator is busy | Wait, then retry the free local request |
| 502 | fal/catalog/submission failure | Report it; a paid retry requires new approval |
| job `error` | fal status, response, or download failed | Report `error`; a retry requires new approval |

Do not expose `.env`, print `FAL_KEY`, delete the spend tracker, or modify the
cap merely to make a request pass.

## Palmier Pro editing MCP

Palmier's Streamable HTTP MCP endpoint is `http://127.0.0.1:19789/mcp`. The
film project is `/Users/isaachernandez/Documents/Palmier Pro/what-we-made.palmier`.
MCP clients should inspect the live tool schemas because Palmier owns that API.
The production sequence is:

1. `manage_project {action:'open', name:...}` first; sessions bind per project.
2. `import_media {source:{path}}`, then `add_clips` with the returned media ref.
3. Use `get_transcript` at segment or word granularity; its times are project
   frames, so cut picture to those frame numbers.
4. Never call `remove_clips` on an embedded-audio partner: the link group can
   remove its video too. Silence it with `set_clip_properties {volume:0}`.
5. Export with `export_project {mode:'video', outputPath:...}`. Use FCPXML when
   handing the timeline to another editor.

## Source map

| Concern | File |
|---|---|
| Curated models, pricing, and result extraction | `tools/video-models.mjs` |
| fal HTTP proxy, queue polling, artifact download | `tools/local-video-server.mjs` |
| Daily spend accounting | `tools/spend-tracker.mjs` |
| Browser-origin and parameter validation | `tools/engine-safety.mjs` |
| Restart-safe job registry | `tools/job-store.mjs` |
| Local mflux server | `tools/local-image-server.mjs` |
| One-command launcher | `tools/engine.mjs` |
| Canvas integration | `src/pages/CreativeCanvasPage.tsx` |
| Design and implementation records | `docs/superpowers/specs/`, `docs/superpowers/plans/` |
| Film production record | `docs/video/2026-07-18-what-we-made.md` |
