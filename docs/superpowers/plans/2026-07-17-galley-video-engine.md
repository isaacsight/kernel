# GALLEY Video Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Creative Canvas `video` node a real fal.ai-backed generation path with per-run cost confirmation.

**Architecture:** A local proxy server (`tools/local-video-server.mjs`, `127.0.0.1:5412`) holds `FAL_KEY` and wraps fal.ai's queue API (submit → poll → download MP4 to `output/videos/`). The canvas video node fetches an estimate, shows a cost-confirm dialog, then submits and polls. Mirrors `tools/local-image-server.mjs` exactly. Spec: `docs/superpowers/specs/2026-07-17-galley-video-engine-design.md`.

**Tech Stack:** Node `node:http` (no new deps), `node --env-file` for `.env`, Vitest, React (existing canvas page), vanilla CSS.

## Global Constraints

- `FAL_KEY` server-side only; never `VITE_`-prefixed; never logged; never displayed. `.env` is never edited or displayed by Claude.
- No emojis in code or user-visible copy.
- Vanilla CSS only in canvas styles; EB Garamond / Courier Prime typography tokens already in `CreativeCanvasPage.css`.
- Tests never call real APIs (mock fal HTTP). Exactly one live smoke at the end, only after Isaac's explicit in-session approval.
- GALLEY loop / run-graph may never auto-fire a paid generation.
- `npx tsc --noEmit` must pass before any commit that touches `.ts(x)`.

---

### Task 1: Model registry + pure helpers (`tools/video-models.mjs`)

**Files:**
- Create: `tools/video-models.mjs`
- Test: `tools/video-models.test.mjs`

**Interfaces:**
- Produces: `MODELS` (array of model configs), `getModel(id)`, `estimateUsd(modelId, durationSeconds)` → `number|null`, `buildInput(modelId, prompt, durationSeconds, imageUrl?)` → request body object, `pickEndpoint(modelId, hasImage)` → fal endpoint string, `extractVideoUrl(payload)` → `string|null`. Task 3's server and Task 2's verification consume all of these.

- [ ] **Step 1: Write the failing tests**

```js
// tools/video-models.test.mjs
import { describe, it, expect } from 'vitest'
import { MODELS, getModel, estimateUsd, buildInput, pickEndpoint, extractVideoUrl } from './video-models.mjs'

describe('video model registry', () => {
  it('every model has the required fields', () => {
    expect(MODELS.length).toBeGreaterThanOrEqual(3)
    for (const m of MODELS) {
      expect(typeof m.id).toBe('string')
      expect(typeof m.label).toBe('string')
      expect(typeof m.textEndpoint).toBe('string')
      expect(m.textEndpoint.startsWith('fal-ai/')).toBe(true)
      expect(typeof m.usdPerSecond).toBe('number')
      expect(m.maxDurationSeconds).toBeGreaterThanOrEqual(m.defaultDurationSeconds)
    }
  })
  it('getModel returns null for unknown ids', () => {
    expect(getModel('nope')).toBeNull()
  })
})

describe('estimateUsd', () => {
  it('multiplies per-second price by duration, rounded to cents', () => {
    const m = MODELS[0]
    expect(estimateUsd(m.id, 5)).toBeCloseTo(Math.round(m.usdPerSecond * 5 * 100) / 100, 2)
  })
  it('returns null for unknown model (never fabricates a price)', () => {
    expect(estimateUsd('nope', 5)).toBeNull()
  })
  it('clamps duration to the model max', () => {
    const m = MODELS[0]
    expect(estimateUsd(m.id, 9999)).toBeCloseTo(Math.round(m.usdPerSecond * m.maxDurationSeconds * 100) / 100, 2)
  })
})

describe('buildInput / pickEndpoint', () => {
  it('text-to-video input carries prompt and duration', () => {
    const m = MODELS[0]
    const input = buildInput(m.id, 'a city after midnight', 5)
    expect(input.prompt).toBe('a city after midnight')
    expect(input).not.toHaveProperty('image_url')
  })
  it('image input adds image_url and switches endpoint when supported', () => {
    const m = MODELS.find(x => x.imageEndpoint)
    const input = buildInput(m.id, 'p', 5, 'data:image/png;base64,AAAA')
    expect(input.image_url).toBe('data:image/png;base64,AAAA')
    expect(pickEndpoint(m.id, true)).toBe(m.imageEndpoint)
    expect(pickEndpoint(m.id, false)).toBe(m.textEndpoint)
  })
})

describe('extractVideoUrl', () => {
  it('finds the url in the common fal result shapes', () => {
    expect(extractVideoUrl({ video: { url: 'https://x/v.mp4' } })).toBe('https://x/v.mp4')
    expect(extractVideoUrl({ data: { video: { url: 'https://y/v.mp4' } } })).toBe('https://y/v.mp4')
    expect(extractVideoUrl({ videos: [{ url: 'https://z/v.mp4' }] })).toBe('https://z/v.mp4')
    expect(extractVideoUrl({})).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tools/video-models.test.mjs`
Expected: FAIL — cannot find module `./video-models.mjs`

- [ ] **Step 3: Write the implementation**

```js
// tools/video-models.mjs
// Curated fal.ai video model registry for the Creative Canvas video node.
// Prices are USD per output second as listed on fal.ai model pages —
// re-verify against https://fal.ai/models when adding or bumping a model.

export const MODELS = [
  {
    id: 'veo-3-fast',
    label: 'Veo 3.1 Fast',
    textEndpoint: 'fal-ai/veo3/fast',
    imageEndpoint: 'fal-ai/veo3/fast/image-to-video',
    usdPerSecond: 0.25,
    defaultDurationSeconds: 8,
    maxDurationSeconds: 8,
    durationParam: null, // fixed-length model; fal ignores duration
  },
  {
    id: 'kling-pro',
    label: 'Kling (Pro)',
    textEndpoint: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
    imageEndpoint: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
    usdPerSecond: 0.07,
    defaultDurationSeconds: 5,
    maxDurationSeconds: 10,
    durationParam: 'duration',
  },
  {
    id: 'seedance-lite',
    label: 'Seedance (Lite)',
    textEndpoint: 'fal-ai/bytedance/seedance/v1/lite/text-to-video',
    imageEndpoint: 'fal-ai/bytedance/seedance/v1/lite/image-to-video',
    usdPerSecond: 0.04,
    defaultDurationSeconds: 5,
    maxDurationSeconds: 10,
    durationParam: 'duration',
  },
  {
    id: 'luma-ray',
    label: 'Luma Ray',
    textEndpoint: 'fal-ai/luma-dream-machine/ray-2',
    imageEndpoint: null,
    usdPerSecond: 0.1,
    defaultDurationSeconds: 5,
    maxDurationSeconds: 9,
    durationParam: 'duration',
  },
]

export function getModel(id) {
  return MODELS.find(m => m.id === id) ?? null
}

export function estimateUsd(modelId, durationSeconds) {
  const model = getModel(modelId)
  if (!model) return null
  const seconds = Math.min(Number(durationSeconds) || model.defaultDurationSeconds, model.maxDurationSeconds)
  return Math.round(model.usdPerSecond * seconds * 100) / 100
}

export function pickEndpoint(modelId, hasImage) {
  const model = getModel(modelId)
  if (!model) return null
  return hasImage && model.imageEndpoint ? model.imageEndpoint : model.textEndpoint
}

export function buildInput(modelId, prompt, durationSeconds, imageUrl) {
  const model = getModel(modelId)
  if (!model) return null
  const input = { prompt }
  if (model.durationParam) {
    const seconds = Math.min(Number(durationSeconds) || model.defaultDurationSeconds, model.maxDurationSeconds)
    input[model.durationParam] = String(seconds)
  }
  if (imageUrl && model.imageEndpoint) input.image_url = imageUrl
  return input
}

export function extractVideoUrl(payload) {
  if (!payload || typeof payload !== 'object') return null
  return payload.video?.url ?? payload.data?.video?.url ?? payload.videos?.[0]?.url ?? null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tools/video-models.test.mjs`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add tools/video-models.mjs tools/video-models.test.mjs
git commit -m "feat(video): fal.ai model registry with estimate and input builders"
```

---

### Task 2: Verify fal catalog slugs and prices against the live site

**Files:**
- Modify: `tools/video-models.mjs` (constants only, if verification finds drift)

**Interfaces:**
- Consumes: `MODELS` from Task 1.
- Produces: a registry whose `textEndpoint`/`imageEndpoint` slugs return HTTP 200 on fal.ai and whose `usdPerSecond` matches the listed price.

- [ ] **Step 1: Check every endpoint slug resolves**

```bash
cd "/Users/isaachernandez/blog design" && node -e '
import("./tools/video-models.mjs").then(async ({ MODELS }) => {
  for (const m of MODELS) {
    for (const ep of [m.textEndpoint, m.imageEndpoint].filter(Boolean)) {
      const r = await fetch(`https://fal.ai/models/${ep}`, { method: "HEAD" })
      console.log(`${r.ok ? "OK " : "MISS"} ${ep} (${r.status})`)
    }
  }
})'
```

Expected: every line `OK`. Any `MISS` line means the slug moved — browse `https://fal.ai/models?categories=text-to-video` (WebFetch) to find the current slug for that family (e.g. a newer Kling or Seedance version) and update the constant.

- [ ] **Step 2: Verify prices from each model page**

For each model, WebFetch `https://fal.ai/models/<textEndpoint>` and read the listed price ("$X per second" or "$X per video"). Update `usdPerSecond` where it differs (per-video prices divide by `defaultDurationSeconds`). Prices shown in the confirm dialog must never be lower than fal's listed price.

- [ ] **Step 3: Re-run tests**

Run: `npx vitest run tools/video-models.test.mjs`
Expected: PASS

- [ ] **Step 4: Commit (only if constants changed)**

```bash
git add tools/video-models.mjs
git commit -m "fix(video): sync model slugs and prices with fal.ai live catalog"
```

---

### Task 3: Local video server (`tools/local-video-server.mjs`)

**Files:**
- Create: `tools/local-video-server.mjs`
- Modify: `package.json` (add script)
- Modify: `.env.example` (document `FAL_KEY` — note: `.env.example` only, NEVER `.env`)

**Interfaces:**
- Consumes: everything from `tools/video-models.mjs`.
- Produces HTTP contract for Task 4:
  - `GET /health` → `{ ok: true, hasKey: boolean }`
  - `GET /v1/models` → `{ models: [{ id, label, usdPerSecond, defaultDurationSeconds, maxDurationSeconds, supportsImage }] }`
  - `POST /v1/videos/estimate` `{ model, durationSeconds }` → `{ usd: number|null }`
  - `POST /v1/videos/generations` `{ prompt, model, durationSeconds?, imageUrl? }` → `{ jobId }` (402 if `FAL_KEY` missing, 400 on bad input, 502 on fal error)
  - `GET /v1/videos/jobs/<jobId>` → `{ status: 'queued'|'running'|'done'|'error', videoUrl?, error? }` — `videoUrl` is `http://localhost:5412/videos/<jobId>.mp4`
  - `GET /videos/<file>` → serves MP4 from `output/videos/`

- [ ] **Step 1: Write the server**

```js
// tools/local-video-server.mjs
// Local video generation proxy — backs the Creative Canvas video nodes.
// Holds FAL_KEY server-side and wraps fal.ai's queue API; completed clips
// are downloaded to output/videos/ so generations are owned locally.
//
//   npm run video-server   (node --env-file=.env tools/local-video-server.mjs)
//
// Spec: docs/superpowers/specs/2026-07-17-galley-video-engine-design.md

import { createServer } from 'node:http'
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { MODELS, getModel, estimateUsd, buildInput, pickEndpoint, extractVideoUrl } from './video-models.mjs'

const PORT = Number(process.env.VIDEO_SERVER_PORT || 5412)
const FAL_KEY = process.env.FAL_KEY || ''
const OUT_DIR = join(process.cwd(), 'output', 'videos')
const FAL_QUEUE = 'https://queue.fal.run'

/** jobId -> { statusUrl, responseUrl, status, videoUrl, error } */
const jobs = new Map()

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  })
  res.end(JSON.stringify(body))
}

async function readBody(req) {
  let body = ''
  for await (const chunk of req) body += chunk
  try { return JSON.parse(body) } catch { return null }
}

async function falFetch(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload.detail || payload.error || `fal.ai error ${res.status}`)
  return payload
}

async function submitJob({ prompt, model, durationSeconds, imageUrl }) {
  const endpoint = pickEndpoint(model, Boolean(imageUrl))
  const input = buildInput(model, prompt, durationSeconds, imageUrl)
  const submitted = await falFetch(`${FAL_QUEUE}/${endpoint}`, { method: 'POST', body: JSON.stringify(input) })
  const jobId = submitted.request_id
  if (!jobId) throw new Error('fal.ai returned no request_id')
  jobs.set(jobId, {
    statusUrl: submitted.status_url,
    responseUrl: submitted.response_url,
    status: 'queued',
    videoUrl: null,
    error: null,
  })
  return jobId
}

async function refreshJob(jobId) {
  const job = jobs.get(jobId)
  if (!job || job.status === 'done' || job.status === 'error') return job
  try {
    const status = await falFetch(job.statusUrl)
    if (status.status === 'COMPLETED') {
      const result = await falFetch(job.responseUrl)
      const remoteUrl = extractVideoUrl(result)
      if (!remoteUrl) throw new Error('fal.ai result contained no video url')
      await mkdir(OUT_DIR, { recursive: true })
      const clip = await fetch(remoteUrl)
      if (!clip.ok) throw new Error(`could not download result (${clip.status})`)
      await writeFile(join(OUT_DIR, `${jobId}.mp4`), Buffer.from(await clip.arrayBuffer()))
      job.videoUrl = `http://localhost:${PORT}/videos/${jobId}.mp4`
      job.status = 'done'
      console.log(`[video-server] job ${jobId} done -> output/videos/${jobId}.mp4`)
    } else if (status.status === 'IN_PROGRESS') {
      job.status = 'running'
    }
  } catch (err) {
    job.status = 'error'
    job.error = err.message
    console.error(`[video-server] job ${jobId} failed: ${err.message}`)
  }
  return job
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {})
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, hasKey: Boolean(FAL_KEY) })
  }

  if (req.method === 'GET' && url.pathname === '/v1/models') {
    return json(res, 200, {
      models: MODELS.map(m => ({
        id: m.id, label: m.label, usdPerSecond: m.usdPerSecond,
        defaultDurationSeconds: m.defaultDurationSeconds, maxDurationSeconds: m.maxDurationSeconds,
        supportsImage: Boolean(m.imageEndpoint),
      })),
    })
  }

  if (req.method === 'POST' && url.pathname === '/v1/videos/estimate') {
    const body = await readBody(req)
    if (!body?.model) return json(res, 400, { error: 'model is required' })
    return json(res, 200, { usd: estimateUsd(body.model, body.durationSeconds) })
  }

  if (req.method === 'POST' && url.pathname === '/v1/videos/generations') {
    if (!FAL_KEY) return json(res, 402, { error: 'FAL_KEY not set — add it to .env and restart: npm run video-server' })
    const body = await readBody(req)
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt) return json(res, 400, { error: 'prompt is required' })
    if (!getModel(body.model)) return json(res, 400, { error: `unknown model: ${body?.model}` })
    try {
      const jobId = await submitJob(body)
      console.log(`[video-server] submitted ${body.model} job ${jobId}: ${prompt.slice(0, 80)}`)
      return json(res, 200, { jobId })
    } catch (err) {
      return json(res, 502, { error: err.message })
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/v1/videos/jobs/')) {
    const jobId = url.pathname.split('/').pop()
    if (!jobs.has(jobId)) return json(res, 404, { error: 'unknown job' })
    const job = await refreshJob(jobId)
    return json(res, 200, { status: job.status, videoUrl: job.videoUrl, error: job.error })
  }

  if (req.method === 'GET' && url.pathname.startsWith('/videos/')) {
    const file = url.pathname.split('/').pop()
    if (!/^[\w-]+\.mp4$/.test(file)) return json(res, 400, { error: 'bad filename' })
    try {
      const data = await readFile(join(OUT_DIR, file))
      res.writeHead(200, { 'Content-Type': 'video/mp4', 'Access-Control-Allow-Origin': '*' })
      return res.end(data)
    } catch {
      return json(res, 404, { error: 'not found' })
    }
  }

  return json(res, 404, { error: 'Not found' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[video-server] listening on http://localhost:${PORT} (key ${FAL_KEY ? 'loaded' : 'MISSING'})`)
})
```

- [ ] **Step 2: Add the npm script**

In `package.json` scripts, next to `"image-server"`:

```json
"video-server": "node --env-file=.env tools/local-video-server.mjs"
```

- [ ] **Step 3: Document the key in `.env.example`**

Append to `.env.example` (this file only — never `.env`):

```
# fal.ai (Video generation — Creative Canvas video nodes, server-side only)
FAL_KEY=
```

- [ ] **Step 4: Smoke the free endpoints (no spend)**

```bash
cd "/Users/isaachernandez/blog design" && npm run video-server &
sleep 1
curl -s localhost:5412/health
curl -s localhost:5412/v1/models | head -c 300
curl -s -X POST localhost:5412/v1/videos/estimate -H 'Content-Type: application/json' -d '{"model":"seedance-lite","durationSeconds":5}'
```

Expected: `{"ok":true,"hasKey":true}`, a models list, `{"usd":0.2}` (or the Task-2-verified price × 5). No fal request is made by any of these. Kill the background server after.

- [ ] **Step 5: Commit**

```bash
git add tools/local-video-server.mjs package.json .env.example
git commit -m "feat(video): local fal.ai proxy server on :5412 with queue polling and local MP4 ownership"
```

---

### Task 4: Canvas video node — confirm, generate, poll, preview

**Files:**
- Modify: `src/pages/CreativeCanvasPage.tsx` (StudioNode interface ~line 65; stub at ~line 668; node card render ~line 1357; runGraph ~line 737)
- Modify: `src/pages/CreativeCanvasPage.css` (confirm overlay + video preview styles)

**Interfaces:**
- Consumes: Task 3's HTTP contract (`/v1/videos/estimate`, `/v1/videos/generations`, `/v1/videos/jobs/:id`).
- Produces: `StudioNode.videoUrl?: string`; `videoConfirm` state of type `{ nodeId: string; prompt: string; model: string; imageUrl?: string; usd: number | null } | null`; `runNode(id, opts?: { auto?: boolean })`.

- [ ] **Step 1: Add endpoint constant and node field**

Below `LOCAL_IMAGE_ENDPOINT` (~line 33):

```ts
const LOCAL_VIDEO_ENDPOINT = 'http://localhost:5412'
```

In the `StudioNode` interface, after `imageUrl?: string`:

```ts
videoUrl?: string
```

- [ ] **Step 2: Add the video engine helpers (below `canvasImage`)**

```ts
interface VideoModelInfo { id: string; label: string; usdPerSecond: number; defaultDurationSeconds: number; maxDurationSeconds: number; supportsImage: boolean }

async function videoEstimate(model: string, durationSeconds: number): Promise<number | null> {
  try {
    const res = await fetch(`${LOCAL_VIDEO_ENDPOINT}/v1/videos/estimate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, durationSeconds }),
    })
    const payload = await res.json()
    return typeof payload.usd === 'number' ? payload.usd : null
  } catch {
    throw new Error('Local video server offline — run: npm run video-server')
  }
}

async function videoGenerate(body: { prompt: string; model: string; durationSeconds?: number; imageUrl?: string }): Promise<string> {
  const res = await fetch(`${LOCAL_VIDEO_ENDPOINT}/v1/videos/generations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload.error || `Video server error (${res.status})`)
  return payload.jobId as string
}

async function videoPoll(jobId: string): Promise<string> {
  const deadline = Date.now() + 10 * 60 * 1000
  while (Date.now() < deadline) {
    const res = await fetch(`${LOCAL_VIDEO_ENDPOINT}/v1/videos/jobs/${jobId}`)
    const payload = await res.json().catch(() => ({}))
    if (payload.status === 'done' && payload.videoUrl) return payload.videoUrl as string
    if (payload.status === 'error') throw new Error(payload.error || 'Generation failed')
    await new Promise(resolve => setTimeout(resolve, 3000))
  }
  throw new Error('Generation timed out after 10 minutes')
}
```

- [ ] **Step 3: Map registry ids and add confirm state**

The node's `model` field holds a display label (`modelsByKind.video = ['Veo 3.1', 'Seedance 2.0', 'Kling 3.0', 'Runway Gen-4.5']` at ~line 184). Update that list to match served models and add a label→id map next to it:

```ts
// in modelsByKind (line ~184), replace the video entry:
video: ['Veo 3.1 Fast', 'Kling (Pro)', 'Seedance (Lite)', 'Luma Ray'],

// beside modelsByKind:
const videoModelIds: Record<string, string> = {
  'Veo 3.1 Fast': 'veo-3-fast',
  'Kling (Pro)': 'kling-pro',
  'Seedance (Lite)': 'seedance-lite',
  'Luma Ray': 'luma-ray',
}
```

Inside the component, near the other `useState` calls:

```ts
const [videoConfirm, setVideoConfirm] = useState<{ nodeId: string; prompt: string; model: string; imageUrl?: string; usd: number | null } | null>(null)
```

- [ ] **Step 4: Replace the stub in `runNode` (lines 668–675)**

`runNode` gains an options parameter — change the signature to
`async (id: string, opts?: { auto?: boolean })` — and the video branch becomes:

```ts
if (node.kind === 'video') {
  if (opts?.auto) {
    updateNode(id, { status: 'idle', result: 'Ready — awaiting cost confirmation. Run this node directly to generate.' })
    return
  }
  const modelId = videoModelIds[node.model ?? ''] ?? 'seedance-lite'
  const upstreamImage = graphEdges
    .filter(edge => edge.to === id)
    .map(edge => graphNodes.find(item => item.id === edge.from))
    .find(source => source?.kind === 'image' && source.imageUrl)?.imageUrl
  const prompt = [upstream, node.content].filter(Boolean).join('\n\nMotion direction:\n')
  if (!prompt.trim()) {
    updateNode(id, { status: 'error', result: 'Add a motion direction or connect an upstream node first.' })
    return
  }
  updateNode(id, { status: 'running', result: 'Fetching cost estimate…' })
  try {
    const usd = await videoEstimate(modelId, 5)
    updateNode(id, { status: 'idle', result: '' })
    setVideoConfirm({ nodeId: id, prompt, model: modelId, imageUrl: upstreamImage, usd })
  } catch (error) {
    updateNode(id, { status: 'error', result: error instanceof Error ? error.message : 'Video server unavailable' })
    showToast(error instanceof Error ? error.message : 'Video server unavailable')
  }
  return
}
```

Add the confirm handler beside `runNode`:

```ts
const confirmVideoRun = useCallback(async () => {
  if (!videoConfirm) return
  const { nodeId, prompt, model, imageUrl } = videoConfirm
  setVideoConfirm(null)
  updateNode(nodeId, { status: 'running', result: 'Generating — this takes one to six minutes…' })
  try {
    const jobId = await videoGenerate({ prompt, model, durationSeconds: 5, imageUrl })
    const videoUrl = await videoPoll(jobId)
    updateNode(nodeId, { status: 'done', videoUrl, result: `Rendered via ${model} — saved to output/videos/` })
    showToast('Video rendered')
  } catch (error) {
    updateNode(nodeId, { status: 'error', result: error instanceof Error ? error.message : 'Generation failed' })
    showToast('Video generation failed')
  }
}, [videoConfirm, updateNode, showToast])
```

- [ ] **Step 5: Park video nodes during graph runs**

In `runGraph` (~line 737), find where each node is executed and pass the flag: `await runNode(node.id, { auto: true })`. Apply the same to any GALLEY-loop execution path that calls `runNode` (search the file for other `runNode(` call sites; every call not initiated by the node's own Run button passes `{ auto: true }`).

- [ ] **Step 6: Render the preview and the confirm dialog**

At ~line 1357 replace the placeholder line:

```tsx
{node.kind === 'video' && !node.videoUrl && <div className="cc-video-preview"><span>Run to render</span><small>Cost shown before anything is charged</small></div>}
{node.kind === 'video' && node.videoUrl && <video className="cc-video-player" src={node.videoUrl} controls loop />}
```

Near the toast render at the end of the component JSX, add the dialog:

```tsx
{videoConfirm && (
  <div className="cc-video-confirm" role="dialog" aria-label="Confirm paid generation">
    <div className="cc-video-confirm-card">
      <h3>Paid generation</h3>
      <p className="cc-video-confirm-model">{videoConfirm.model}{videoConfirm.imageUrl ? ' — image to video' : ''} · 5s</p>
      <p className="cc-video-confirm-price">{videoConfirm.usd !== null ? `Estimated $${videoConfirm.usd.toFixed(2)}` : 'Price unknown — check fal.ai before confirming'}</p>
      <div className="cc-video-confirm-actions">
        <button onClick={() => setVideoConfirm(null)}>Cancel</button>
        <button className="cc-video-confirm-go" onClick={confirmVideoRun}>Generate</button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 7: Styles**

Append to `src/pages/CreativeCanvasPage.css` (uses existing token vars from the file — match its ivory/ink/tomato palette exactly as neighboring rules do):

```css
.cc-video-player { width: 100%; border-radius: 8px; display: block; }
.cc-video-confirm { position: fixed; inset: 0; background: rgba(31, 30, 29, 0.55); display: grid; place-items: center; z-index: 60; }
.cc-video-confirm-card { background: var(--color-ivory, #FAF9F6); color: var(--color-ink, #1F1E1D); padding: 24px 28px; border-radius: 10px; max-width: 340px; font-family: 'EB Garamond', serif; }
.cc-video-confirm-card h3 { margin: 0 0 8px; }
.cc-video-confirm-model { font-family: 'Courier Prime', monospace; font-size: 13px; margin: 0 0 4px; }
.cc-video-confirm-price { font-weight: 600; margin: 0 0 16px; }
.cc-video-confirm-actions { display: flex; gap: 10px; justify-content: flex-end; }
.cc-video-confirm-actions button { min-height: 44px; padding: 0 18px; cursor: pointer; }
.cc-video-confirm-go { background: var(--color-tomato, #E24E1B); color: #FAF9F6; border: none; border-radius: 6px; }
```

- [ ] **Step 8: Type-check and unit tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS

- [ ] **Step 9: Browser verification (no spend)**

Start the dev server (preview_start with the launch.json entry) and the video server. On `#/canvas-creative`: add a video node, type a motion direction, press its Run → confirm dialog appears with a dollar figure → press **Cancel** → node returns to idle, nothing charged. Run the full graph → video node parks with "Ready — awaiting cost confirmation". Screenshot both states.

- [ ] **Step 10: Commit**

```bash
git add src/pages/CreativeCanvasPage.tsx src/pages/CreativeCanvasPage.css
git commit -m "feat(canvas): video nodes generate via local fal.ai proxy with per-run cost confirmation"
```

---

### Task 5: Live smoke (permission-gated) and wrap-up

**Files:**
- Modify: `SCRATCHPAD.md` (session log)

**Interfaces:**
- Consumes: the full stack from Tasks 1–4.

- [ ] **Step 1: Ask Isaac for spend approval**

STOP. Ask in chat: "Ready for the live smoke — one Seedance (Lite) clip at 5 seconds, estimated ~$0.20 [use the Task-2-verified price]. Approve?" Do not proceed without an explicit yes. If no, skip to Step 4 and note the smoke as deferred.

- [ ] **Step 2: Run the smoke through the real UI**

With both servers up, run one video node (prompt: "slow dolly across a letterpress print floor, warm ivory light") using Seedance (Lite), click Generate in the confirm dialog, wait for completion.

- [ ] **Step 3: Verify the artifact**

```bash
ls -la "/Users/isaachernandez/blog design/output/videos/"
```

Expected: one `<jobId>.mp4` with nonzero size; the node shows a playing `<video>` preview. Screenshot it.

- [ ] **Step 4: Update SCRATCHPAD.md and commit**

Append a session entry describing: video engine shipped, files touched, smoke result (or deferred), verified prices, and the standing rule that graph/loop runs never auto-fire video nodes.

```bash
git add SCRATCHPAD.md
git commit -m "docs(scratchpad): GALLEY video engine ship log"
```
