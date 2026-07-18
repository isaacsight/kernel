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
import { MODELS, getModel, estimateUsd, effectiveSeconds, buildInput, pickEndpoint, extractVideoUrl, extractImageUrl, mapCatalogItem, parsePerImageUsd, TTS_ENDPOINT, estimateSpeechUsd, extractAudioUrl } from './video-models.mjs'

const PORT = Number(process.env.VIDEO_SERVER_PORT || 5412)
const FAL_KEY = process.env.FAL_KEY || ''
const OUT_DIR = join(process.cwd(), 'output', 'videos')
const AUDIO_DIR = join(process.cwd(), 'output', 'audio')
const IMAGE_DIR = join(process.cwd(), 'output', 'images')
const FAL_QUEUE = 'https://queue.fal.run'

/** jobId -> { kind: 'video'|'audio', statusUrl, responseUrl, status, videoUrl, audioUrl, error } */
const jobs = new Map()

const JOB_KINDS = {
  video: { dir: OUT_DIR, ext: 'mp4', route: 'videos', extract: extractVideoUrl },
  audio: { dir: AUDIO_DIR, ext: 'mp3', route: 'audio', extract: extractAudioUrl },
  image: { dir: IMAGE_DIR, ext: 'png', route: 'images', extract: extractImageUrl },
}

// Extra model parameters callers may pass straight through to fal
// (resolution, duration, seed, aspect_ratio, negative_prompt, ...).
// Plain JSON scalars only — no nested payload smuggling.
function cleanParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return {}
  const out = {}
  for (const [key, value] of Object.entries(params)) {
    if (!/^[a-z][a-z0-9_]{0,40}$/i.test(key)) continue
    if (['string', 'number', 'boolean'].includes(typeof value)) out[key] = value
  }
  return out
}

// fal.ai catalog cache: category -> { at, items }. The catalog endpoint is
// fal's site API (undocumented) — cache generously and fail soft; the curated
// MODELS registry keeps working if fal changes the shape.
const CATALOG_TTL_MS = 60 * 60 * 1000
const CATALOG_CATEGORIES = new Set(['text-to-video', 'image-to-video', 'text-to-image', 'image-to-image'])
const catalogCache = new Map()
const ENDPOINT_SLUG = /^[\w.-]+(?:\/[\w.-]+)+$/

async function fetchCatalog(category) {
  const cached = catalogCache.get(category)
  if (cached && Date.now() - cached.at < CATALOG_TTL_MS) return cached.items
  const raw = []
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`https://fal.ai/api/models?categories=${category}&page=${page}&total=40`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`fal catalog error ${res.status}`)
    const payload = await res.json()
    const batch = payload.items || []
    raw.push(...batch)
    if (!batch.length || raw.length >= (payload.total || 0)) break
  }
  const items = raw.map(mapCatalogItem).filter(item => item.endpointId && item.title)
  catalogCache.set(category, { at: Date.now(), items })
  return items
}

function catalogEntry(endpointId) {
  for (const { items } of catalogCache.values()) {
    const hit = items.find(item => item.endpointId === endpointId)
    if (hit) return hit
  }
  return null
}

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
  if (!res.ok) {
    const detail = payload.detail ?? payload.error
    const message = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : `fal.ai error ${res.status}`
    throw new Error(message)
  }
  return payload
}

async function submitJob({ prompt, model, endpoint: rawEndpoint, durationSeconds, imageUrl, params }) {
  // Catalog passthrough: an explicit endpoint slug wins over the curated
  // registry. Input schemas vary across the catalog, so passthrough sends
  // the universally-accepted fields plus caller-chosen params (resolution,
  // seed, aspect_ratio, ...) validated to plain scalars.
  const endpoint = rawEndpoint || pickEndpoint(model, Boolean(imageUrl))
  const input = rawEndpoint
    ? { prompt, ...(imageUrl ? { image_url: imageUrl } : {}), ...cleanParams(params) }
    : { ...buildInput(model, prompt, durationSeconds, imageUrl), ...cleanParams(params) }
  return queueJob('video', endpoint, input)
}

async function queueJob(kind, endpoint, input) {
  const submitted = await falFetch(`${FAL_QUEUE}/${endpoint}`, { method: 'POST', body: JSON.stringify(input) })
  const jobId = submitted.request_id
  if (!jobId) throw new Error('fal.ai returned no request_id')
  jobs.set(jobId, {
    kind,
    statusUrl: submitted.status_url,
    responseUrl: submitted.response_url,
    status: 'queued',
    videoUrl: null,
    audioUrl: null,
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
      const spec = JOB_KINDS[job.kind || 'video']
      const result = await falFetch(job.responseUrl)
      const remoteUrl = spec.extract(result)
      if (!remoteUrl) throw new Error(`fal.ai result contained no ${job.kind || 'video'} url`)
      await mkdir(spec.dir, { recursive: true })
      const clip = await fetch(remoteUrl)
      if (!clip.ok) throw new Error(`could not download result (${clip.status})`)
      await writeFile(join(spec.dir, `${jobId}.${spec.ext}`), Buffer.from(await clip.arrayBuffer()))
      const localUrl = `http://localhost:${PORT}/${spec.route}/${jobId}.${spec.ext}`
      job.sourceUrl = remoteUrl // fal-hosted copy; usable as image_url input for downstream image-to-video
      const kind = job.kind || 'video'
      if (kind === 'audio') job.audioUrl = localUrl
      else if (kind === 'image') job.imageUrl = localUrl
      else job.videoUrl = localUrl
      job.status = 'done'
      console.log(`[video-server] job ${jobId} done -> output/${spec.route}/${jobId}.${spec.ext}`)
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

  if (req.method === 'GET' && url.pathname === '/v1/catalog') {
    const category = url.searchParams.get('category') || 'text-to-video'
    if (!CATALOG_CATEGORIES.has(category)) return json(res, 400, { error: `unknown category: ${category}` })
    try {
      return json(res, 200, { items: await fetchCatalog(category) })
    } catch (err) {
      return json(res, 502, { error: err.message })
    }
  }

  if (req.method === 'POST' && url.pathname === '/v1/videos/estimate') {
    const body = await readBody(req)
    if (body?.endpoint) {
      const entry = catalogEntry(body.endpoint)
      const seconds = Number(body.durationSeconds) || 5
      return json(res, 200, {
        usd: entry?.usdPerSecond != null ? Math.round(entry.usdPerSecond * seconds * 100) / 100 : null,
        seconds,
        pricingText: entry?.pricingText || '',
      })
    }
    if (!body?.model) return json(res, 400, { error: 'model is required' })
    return json(res, 200, {
      usd: estimateUsd(body.model, body.durationSeconds),
      seconds: effectiveSeconds(body.model, body.durationSeconds),
    })
  }

  if (req.method === 'POST' && url.pathname === '/v1/videos/generations') {
    if (!FAL_KEY) return json(res, 402, { error: 'FAL_KEY not set — add it to .env and restart: npm run video-server' })
    const body = await readBody(req)
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt) return json(res, 400, { error: 'prompt is required' })
    if (body?.endpoint) {
      if (!ENDPOINT_SLUG.test(body.endpoint)) return json(res, 400, { error: `bad endpoint slug: ${body.endpoint}` })
    } else if (!getModel(body.model)) {
      return json(res, 400, { error: `unknown model: ${body?.model}` })
    }
    try {
      const jobId = await submitJob(body)
      console.log(`[video-server] submitted ${body.model} job ${jobId}: ${prompt.slice(0, 80)}`)
      return json(res, 200, { jobId })
    } catch (err) {
      return json(res, 502, { error: err.message })
    }
  }

  if (req.method === 'POST' && url.pathname === '/v1/images/fal') {
    if (!FAL_KEY) return json(res, 402, { error: 'FAL_KEY not set — add it to .env and restart: npm run video-server' })
    const body = await readBody(req)
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt) return json(res, 400, { error: 'prompt is required' })
    if (!body?.endpoint || !ENDPOINT_SLUG.test(body.endpoint)) return json(res, 400, { error: `bad endpoint slug: ${body?.endpoint}` })
    try {
      const input = {
        prompt,
        ...(typeof body.imageUrl === 'string' && body.imageUrl ? { image_url: body.imageUrl } : {}),
        ...cleanParams(body.params),
      }
      const jobId = await queueJob('image', body.endpoint, input)
      console.log(`[video-server] submitted image job ${jobId} on ${body.endpoint}: ${prompt.slice(0, 60)}`)
      return json(res, 200, { jobId })
    } catch (err) {
      return json(res, 502, { error: err.message })
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/images/')) {
    const file = url.pathname.split('/').pop()
    if (!/^[\w-]+\.png$/.test(file)) return json(res, 400, { error: 'bad filename' })
    try {
      const data = await readFile(join(IMAGE_DIR, file))
      res.writeHead(200, { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' })
      return res.end(data)
    } catch {
      return json(res, 404, { error: 'not found' })
    }
  }

  if (req.method === 'POST' && url.pathname === '/v1/audio/estimate') {
    const body = await readBody(req)
    const text = typeof body?.text === 'string' ? body.text : ''
    return json(res, 200, { usd: estimateSpeechUsd(text), characters: text.length })
  }

  if (req.method === 'POST' && url.pathname === '/v1/audio/speech') {
    if (!FAL_KEY) return json(res, 402, { error: 'FAL_KEY not set — add it to .env and restart: npm run video-server' })
    const body = await readBody(req)
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    if (!text) return json(res, 400, { error: 'text is required' })
    try {
      const input = { text, ...(typeof body.voice === 'string' && body.voice ? { voice: body.voice } : {}) }
      const jobId = await queueJob('audio', TTS_ENDPOINT, input)
      console.log(`[video-server] submitted speech job ${jobId}: ${text.slice(0, 60)}`)
      return json(res, 200, { jobId })
    } catch (err) {
      return json(res, 502, { error: err.message })
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/v1/videos/jobs/')) {
    const jobId = url.pathname.split('/').pop()
    if (!jobs.has(jobId)) return json(res, 404, { error: 'unknown job' })
    const job = await refreshJob(jobId)
    return json(res, 200, { status: job.status, videoUrl: job.videoUrl, audioUrl: job.audioUrl, imageUrl: job.imageUrl ?? null, sourceUrl: job.sourceUrl ?? null, error: job.error })
  }

  if (req.method === 'GET' && url.pathname.startsWith('/audio/')) {
    const file = url.pathname.split('/').pop()
    if (!/^[\w-]+\.mp3$/.test(file)) return json(res, 400, { error: 'bad filename' })
    try {
      const data = await readFile(join(AUDIO_DIR, file))
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*' })
      return res.end(data)
    } catch {
      return json(res, 404, { error: 'not found' })
    }
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
