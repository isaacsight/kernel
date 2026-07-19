// Local video generation proxy — backs the Creative Canvas video nodes.
// Holds FAL_KEY server-side and wraps fal.ai's queue API; completed clips
// are downloaded to output/videos/ so generations are owned locally.
//
//   npm run video-server   (node --env-file=.env tools/local-video-server.mjs)
//
// Spec: docs/superpowers/specs/2026-07-17-galley-video-engine-design.md

import { createServer } from 'node:http'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { MODELS, getModel, estimateUsd, effectiveSeconds, buildInput, pickEndpoint, extractVideoUrl, extractImageUrl, mapCatalogItem, getTtsProvider, DEFAULT_TTS_PROVIDER, estimateSpeechUsd, extractAudioUrl, getSfxProvider, estimateSfxUsd } from './video-models.mjs'
import { catalogSeconds, cleanParams, isAllowedArtifactUrl, isAllowedOrigin, isFalQueueUrl, positiveSeconds } from './engine-safety.mjs'
import { createQuote, isAuthorized, loadOrCreateEngineToken, verifyQuote } from './engine-auth.mjs'
import { loadJobs, saveJobs } from './job-store.mjs'
import { checkAndUpdateSpend } from './spend-tracker.mjs'

const PORT = Number(process.env.VIDEO_SERVER_PORT || 5412)
const FAL_KEY = process.env.FAL_KEY || ''
const OUT_DIR = join(process.cwd(), 'output', 'videos')
const AUDIO_DIR = join(process.cwd(), 'output', 'audio')
const IMAGE_DIR = join(process.cwd(), 'output', 'images')
const JOBS_PATH = join(process.cwd(), 'output', 'job-registry.json')
const TOKEN_PATH = process.env.ENGINE_TOKEN_PATH || join(homedir(), '.config', 'kernel', 'galley-engine-token')
const FAL_QUEUE = 'https://queue.fal.run'
const EXTRA_ALLOWED_ORIGINS = process.env.ENGINE_ALLOWED_ORIGINS || ''
const EXTRA_ARTIFACT_HOSTS = process.env.ENGINE_ARTIFACT_HOSTS || ''
const MAX_BODY_BYTES = 1024 * 1024
const MAX_PROMPT_CHARS = 20_000
const MAX_SPEECH_CHARS = 100_000

const { token: ENGINE_TOKEN, created: ENGINE_TOKEN_CREATED } = await loadOrCreateEngineToken(TOKEN_PATH)
const QUOTE_SECRET = ENGINE_TOKEN

let spendLock = Promise.resolve()

async function checkAndUpdateSpendLocked(estimatedCost, config = {}) {
  return new Promise((resolve, reject) => {
    spendLock = spendLock.then(async () => {
      try {
        const res = await checkAndUpdateSpend(estimatedCost, config)
        resolve(res)
      } catch (err) {
        reject(err)
      }
    })
  })
}


/** jobId -> persisted fal queue metadata and current local status. */
const jobs = new Map()
let jobPersistLock = Promise.resolve()

function persistJobsLocked() {
  const snapshot = new Map(jobs)
  jobPersistLock = jobPersistLock.catch(() => {}).then(() => saveJobs(snapshot, JOBS_PATH))
  return jobPersistLock
}

const JOB_KINDS = {
  video: { dir: OUT_DIR, ext: 'mp4', route: 'videos', extract: extractVideoUrl, mime: 'video/mp4', maxBytes: 750 * 1024 * 1024 },
  audio: { dir: AUDIO_DIR, ext: 'mp3', route: 'audio', extract: extractAudioUrl, mime: 'audio/mpeg', maxBytes: 100 * 1024 * 1024 },
  image: { dir: IMAGE_DIR, ext: 'png', route: 'images', extract: extractImageUrl, mime: 'image/png', maxBytes: 100 * 1024 * 1024 },
}

const CONTENT_EXTENSIONS = new Map([
  ['image/png', ['png', 'image/png']],
  ['image/jpeg', ['jpg', 'image/jpeg']],
  ['image/webp', ['webp', 'image/webp']],
  ['audio/mpeg', ['mp3', 'audio/mpeg']],
  ['audio/wav', ['wav', 'audio/wav']],
  ['audio/x-wav', ['wav', 'audio/wav']],
  ['video/mp4', ['mp4', 'video/mp4']],
  ['video/quicktime', ['mov', 'video/quicktime']],
])

function artifactFormat(response, spec) {
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
  const [ext, mime] = CONTENT_EXTENSIONS.get(contentType) || [spec.ext, spec.mime]
  return { ext, mime }
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

function json(res, status, body, origin) {
  const corsOrigin = origin ?? res.engineOrigin
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  }
  if (corsOrigin && isAllowedOrigin(corsOrigin, EXTRA_ALLOWED_ORIGINS)) headers['Access-Control-Allow-Origin'] = corsOrigin
  res.writeHead(status, headers)
  res.end(JSON.stringify(body))
}

async function readBody(req, res) {
  let body = ''
  let bytes = 0
  for await (const chunk of req) {
    bytes += chunk.length
    if (bytes > MAX_BODY_BYTES) {
      req.resume()
      json(res, 413, { error: `JSON body exceeds ${MAX_BODY_BYTES} bytes` })
      return null
    }
    body += chunk
  }
  try { return JSON.parse(body) } catch {
    json(res, 400, { error: 'Invalid JSON body' })
    return null
  }
}

async function falFetch(url, init = {}) {
  if (!isFalQueueUrl(url)) throw new Error('Refusing to send fal credentials outside queue.fal.run')
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

function paidBody(body) {
  const { quoteToken: _quoteToken, ...request } = body || {}
  return request
}

function requirePaidAuthorization(req, res) {
  if (isAuthorized(req, ENGINE_TOKEN)) return true
  json(res, 401, { error: 'Missing or invalid engine capability token' })
  return false
}

function quoteFor(route, body, cost) {
  return Number.isFinite(cost) ? createQuote(QUOTE_SECRET, route, paidBody(body), cost) : null
}

function quotedCost(route, body) {
  return verifyQuote(QUOTE_SECRET, body?.quoteToken, route, paidBody(body))
}

async function downloadArtifact(response, destination, maxBytes) {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`artifact exceeds ${maxBytes} bytes`)
  if (!response.body) throw new Error('artifact response contained no body')
  const tempPath = `${destination}.${process.pid}.tmp`
  let received = 0
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length
      callback(received > maxBytes ? new Error(`artifact exceeds ${maxBytes} bytes`) : null, chunk)
    },
  })
  try {
    await pipeline(Readable.fromWeb(response.body), limiter, createWriteStream(tempPath, { mode: 0o600 }))
    await rename(tempPath, destination)
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {})
    throw error
  }
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
  if (!submitted.status_url || !submitted.response_url) throw new Error('fal.ai returned incomplete queue metadata')
  if (!isFalQueueUrl(submitted.status_url) || !isFalQueueUrl(submitted.response_url)) {
    throw new Error('fal.ai returned queue metadata outside queue.fal.run')
  }
  jobs.set(jobId, {
    kind,
    statusUrl: submitted.status_url,
    responseUrl: submitted.response_url,
    status: 'queued',
    videoUrl: null,
    audioUrl: null,
    error: null,
    pollError: null,
  })
  await persistJobsLocked().catch(err => {
    console.error(`[video-server] could not persist job ${jobId}: ${err.message}`)
  })
  return jobId
}

async function refreshJob(jobId) {
  const job = jobs.get(jobId)
  if (!job || job.status === 'done' || job.status === 'error') return job
  let changed = false
  try {
    const status = await falFetch(job.statusUrl)
    if (status.status === 'COMPLETED') {
      const spec = JOB_KINDS[job.kind || 'video']
      const result = await falFetch(job.responseUrl)
      const remoteUrl = spec.extract(result)
      if (!remoteUrl) throw new Error(`fal.ai result contained no ${job.kind || 'video'} url`)
      if (!isAllowedArtifactUrl(remoteUrl, EXTRA_ARTIFACT_HOSTS)) throw new Error('fal.ai returned an artifact URL outside the allowed media hosts')
      await mkdir(spec.dir, { recursive: true })
      const clip = await fetch(remoteUrl)
      if (!clip.ok) throw new Error(`could not download result (${clip.status})`)
      const format = artifactFormat(clip, spec)
      await downloadArtifact(clip, join(spec.dir, `${jobId}.${format.ext}`), spec.maxBytes)
      const localUrl = `http://127.0.0.1:${PORT}/${spec.route}/${jobId}.${format.ext}`
      job.sourceUrl = remoteUrl // fal-hosted copy; usable as image_url input for downstream image-to-video
      job.contentType = format.mime
      const kind = job.kind || 'video'
      if (kind === 'audio') job.audioUrl = localUrl
      else if (kind === 'image') job.imageUrl = localUrl
      else job.videoUrl = localUrl
      job.status = 'done'
      job.pollError = null
      changed = true
      console.log(`[video-server] job ${jobId} done -> output/${spec.route}/${jobId}.${format.ext}`)
    } else if (status.status === 'IN_PROGRESS') {
      if (job.status !== 'running') {
        job.status = 'running'
        changed = true
      }
      if (job.pollError) {
        job.pollError = null
        changed = true
      }
    } else if (status.status === 'FAILED' || status.status === 'CANCELLED') {
      const detail = status.error ?? status.detail
      job.status = 'error'
      job.error = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : `fal.ai job ${status.status.toLowerCase()}`
      changed = true
    }
  } catch (err) {
    // Queue status and artifact downloads are safe to retry. Only fal's
    // explicit FAILED/CANCELLED states above are terminal.
    job.pollError = err.message
    changed = true
    console.warn(`[video-server] job ${jobId} poll failed (will retry): ${err.message}`)
  }
  if (changed) await persistJobsLocked().catch(err => {
    console.error(`[video-server] could not persist job ${jobId}: ${err.message}`)
  })
  return job
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin
  if (!isAllowedOrigin(origin, EXTRA_ALLOWED_ORIGINS)) return json(res, 403, { error: 'origin not allowed' })
  res.engineOrigin = origin
  if (req.method === 'OPTIONS') return json(res, 204, {}, origin)
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (req.method === 'GET' && url.pathname === '/health') {
    try {
      const { tracker, limit } = await checkAndUpdateSpendLocked(0, { dryRun: true })
      return json(res, 200, {
        ok: true,
        hasKey: Boolean(FAL_KEY),
        spendLimit: limit === Infinity ? null : limit,
        spentToday: tracker.spent,
        jobsTracked: jobs.size,
      })
    } catch (err) {
      return json(res, 200, {
        ok: false, hasKey: Boolean(FAL_KEY), spendLimit: null, spentToday: null,
        jobsTracked: jobs.size, spendError: err.message,
      })
    }
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
    const body = await readBody(req, res)
    if (!body) return
    if (body?.endpoint) {
      const entry = catalogEntry(body.endpoint)
      const seconds = catalogSeconds(body)
      if (!ENDPOINT_SLUG.test(body.endpoint)) return json(res, 400, { error: `bad endpoint slug: ${body.endpoint}` })
      if (seconds == null) return json(res, 400, { error: 'durationSeconds must be a positive number' })
      const usd = entry?.usdPerSecond != null ? Math.round(entry.usdPerSecond * seconds * 100) / 100 : null
      const request = { ...body, durationSeconds: seconds }
      return json(res, 200, {
        usd,
        seconds,
        pricingText: entry?.pricingText || '',
        quoteToken: typeof body.prompt === 'string' && body.prompt.trim() && usd != null ? quoteFor('/v1/videos/generations', request, usd) : null,
      })
    }
    if (!body?.model) return json(res, 400, { error: 'model is required' })
    if (!getModel(body.model)) return json(res, 400, { error: `unknown model: ${body.model}` })
    if (body.durationSeconds !== undefined && positiveSeconds(body.durationSeconds) == null) {
      return json(res, 400, { error: 'durationSeconds must be a positive number' })
    }
    const usd = estimateUsd(body.model, body.durationSeconds)
    const seconds = effectiveSeconds(body.model, body.durationSeconds)
    const request = { ...body, durationSeconds: seconds }
    return json(res, 200, { usd, seconds, quoteToken: typeof body.prompt === 'string' && body.prompt.trim() ? quoteFor('/v1/videos/generations', request, usd) : null })
  }

  if (req.method === 'POST' && url.pathname === '/v1/videos/generations') {
    if (!requirePaidAuthorization(req, res)) return
    if (!FAL_KEY) return json(res, 402, { error: 'FAL_KEY not set — add it to .env and restart: npm run video-server' })
    const body = await readBody(req, res)
    if (!body) return
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt) return json(res, 400, { error: 'prompt is required' })
    if (prompt.length > MAX_PROMPT_CHARS) return json(res, 413, { error: `prompt exceeds ${MAX_PROMPT_CHARS} characters` })
    if (body?.endpoint) {
      if (!ENDPOINT_SLUG.test(body.endpoint)) return json(res, 400, { error: `bad endpoint slug: ${body.endpoint}` })
    } else if (!getModel(body.model)) {
      return json(res, 400, { error: `unknown model: ${body?.model}` })
    }
    const requestedSeconds = body?.endpoint ? catalogSeconds(body) : positiveSeconds(body.durationSeconds, getModel(body.model)?.defaultDurationSeconds || 5)
    if (requestedSeconds == null) return json(res, 400, { error: 'duration must be a positive number' })

    let cost
    try { cost = quotedCost('/v1/videos/generations', body) } catch (error) { return json(res, 409, { error: error.message }) }

    try {
      const spendInfo = await checkAndUpdateSpendLocked(cost)
      try {
        const jobId = await submitJob(paidBody(body))
        console.log(`[video-server] submitted ${body.model || body.endpoint} job ${jobId}: ${prompt.slice(0, 80)}`)
        console.log(`[video-server] Spend cap check: debited $${cost.toFixed(4)}. Daily total: $${spendInfo.newSpent.toFixed(4)} / $${spendInfo.limit === Infinity ? 'Unlimited' : spendInfo.limit.toFixed(2)}`)
        return json(res, 200, { jobId })
      } catch (submitErr) {
        await checkAndUpdateSpendLocked(-cost, { allowRefund: true })
        throw submitErr
      }
    } catch (err) {
      const status = err.message.includes('limit exceeded') ? 402 : 502
      return json(res, status, { error: err.message })
    }
  }

  if (req.method === 'POST' && url.pathname === '/v1/images/estimate') {
    const body = await readBody(req, res)
    if (!body) return
    if (!body?.endpoint || !ENDPOINT_SLUG.test(body.endpoint)) {
      return json(res, 400, { error: `bad endpoint slug: ${body?.endpoint}` })
    }
    const entry = catalogEntry(body.endpoint)
    const usd = entry?.usdPerImage ?? null
    return json(res, 200, {
      usd,
      pricingText: entry?.pricingText || '',
      unit: 'image',
      quoteToken: typeof body.prompt === 'string' && body.prompt.trim() && usd != null ? quoteFor('/v1/images/fal', body, usd) : null,
    })
  }

  if (req.method === 'POST' && url.pathname === '/v1/images/fal') {
    if (!requirePaidAuthorization(req, res)) return
    if (!FAL_KEY) return json(res, 402, { error: 'FAL_KEY not set — add it to .env and restart: npm run video-server' })
    const body = await readBody(req, res)
    if (!body) return
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt) return json(res, 400, { error: 'prompt is required' })
    if (prompt.length > MAX_PROMPT_CHARS) return json(res, 413, { error: `prompt exceeds ${MAX_PROMPT_CHARS} characters` })
    if (!body?.endpoint || !ENDPOINT_SLUG.test(body.endpoint)) return json(res, 400, { error: `bad endpoint slug: ${body?.endpoint}` })

    let cost
    try { cost = quotedCost('/v1/images/fal', body) } catch (error) { return json(res, 409, { error: error.message }) }

    try {
      const spendInfo = await checkAndUpdateSpendLocked(cost)
      try {
        const request = paidBody(body)
        const input = {
          prompt,
          ...(typeof request.imageUrl === 'string' && request.imageUrl ? { image_url: request.imageUrl } : {}),
          ...cleanParams(request.params),
        }
        const jobId = await queueJob('image', body.endpoint, input)
        console.log(`[video-server] submitted image job ${jobId} on ${body.endpoint}: ${prompt.slice(0, 60)}`)
        console.log(`[video-server] Spend cap check: debited $${cost.toFixed(4)}. Daily total: $${spendInfo.newSpent.toFixed(4)} / $${spendInfo.limit === Infinity ? 'Unlimited' : spendInfo.limit.toFixed(2)}`)
        return json(res, 200, { jobId })
      } catch (submitErr) {
        await checkAndUpdateSpendLocked(-cost, { allowRefund: true })
        throw submitErr
      }
    } catch (err) {
      const status = err.message.includes('limit exceeded') ? 402 : 502
      return json(res, status, { error: err.message })
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/images/')) {
    const file = url.pathname.split('/').pop()
    if (!/^[\w-]+\.(?:png|jpe?g|webp)$/.test(file)) return json(res, 400, { error: 'bad filename' })
    try {
      const data = await readFile(join(IMAGE_DIR, file))
      const contentType = file.endsWith('.webp') ? 'image/webp' : /\.jpe?g$/.test(file) ? 'image/jpeg' : 'image/png'
      res.writeHead(200, {
        'Content-Type': contentType,
        ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
      })
      return res.end(data)
    } catch {
      return json(res, 404, { error: 'not found' })
    }
  }

  if (req.method === 'POST' && url.pathname === '/v1/audio/estimate') {
    const body = await readBody(req, res)
    if (!body) return
    const text = typeof body?.text === 'string' ? body.text : ''
    if (text.length > MAX_SPEECH_CHARS) return json(res, 413, { error: `text exceeds ${MAX_SPEECH_CHARS} characters` })
    if (body?.provider && !getTtsProvider(body.provider)) return json(res, 400, { error: `unknown tts provider: ${body.provider}` })
    const usd = estimateSpeechUsd(text, body?.provider)
    return json(res, 200, { usd, characters: text.length, provider: body?.provider ?? DEFAULT_TTS_PROVIDER, quoteToken: text.trim() ? quoteFor('/v1/audio/speech', body, usd) : null })
  }

  if (req.method === 'POST' && url.pathname === '/v1/audio/speech') {
    if (!requirePaidAuthorization(req, res)) return
    if (!FAL_KEY) return json(res, 402, { error: 'FAL_KEY not set — add it to .env and restart: npm run video-server' })
    const body = await readBody(req, res)
    if (!body) return
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    if (!text) return json(res, 400, { error: 'text is required' })
    if (text.length > MAX_SPEECH_CHARS) return json(res, 413, { error: `text exceeds ${MAX_SPEECH_CHARS} characters` })

    let cost
    try { cost = quotedCost('/v1/audio/speech', body) } catch (error) { return json(res, 409, { error: error.message }) }

    const providerSpec = getTtsProvider(body.provider)
    if (!providerSpec) return json(res, 400, { error: `unknown tts provider: ${body.provider}` })

    // ElevenLabs premium runs direct (subscription credits, zero fal spend).
    if (providerSpec.direct === 'elevenlabs') {
      const elevenKey = process.env.ELEVENLABS_API_KEY || ''
      if (!elevenKey) return json(res, 402, { error: 'ELEVENLABS_API_KEY not set in the server environment' })
      const voiceId = typeof body.voice === 'string' && /^[A-Za-z0-9]{10,40}$/.test(body.voice) ? body.voice : null
      if (!voiceId) return json(res, 400, { error: 'voice must be an ElevenLabs voice id' })
      try {
        const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
          method: 'POST',
          headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            model_id: providerSpec.modelId,
            voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.35 },
          }),
        })
        if (!resp.ok) {
          const detail = await resp.text().catch(() => '')
          throw new Error(`ElevenLabs error ${resp.status}: ${detail.slice(0, 200)}`)
        }
        const jobId = crypto.randomUUID()
        await mkdir(AUDIO_DIR, { recursive: true })
        await writeFile(join(AUDIO_DIR, `${jobId}.mp3`), Buffer.from(await resp.arrayBuffer()))
        jobs.set(jobId, {
          kind: 'audio', status: 'done', videoUrl: null, imageUrl: null,
          audioUrl: `http://localhost:${PORT}/audio/${jobId}.mp3`,
          sourceUrl: null, error: null, statusUrl: null, responseUrl: null,
        })
        await persistJobsLocked().catch(() => {})
        console.log(`[video-server] elevenlabs direct speech ${jobId}: ${text.slice(0, 60)}`)
        return json(res, 200, { jobId })
      } catch (err) {
        return json(res, 502, { error: err.message })
      }
    }

    try {
      const spendInfo = await checkAndUpdateSpendLocked(cost)
      try {
        const provider = providerSpec
        const input = provider.buildInput(text, typeof body.voice === 'string' && body.voice ? body.voice : undefined)
        const jobId = await queueJob('audio', provider.endpoint, input)
        console.log(`[video-server] submitted speech job ${jobId}: ${text.slice(0, 60)}`)
        console.log(`[video-server] Spend cap check: debited $${cost.toFixed(4)}. Daily total: $${spendInfo.newSpent.toFixed(4)} / $${spendInfo.limit === Infinity ? 'Unlimited' : spendInfo.limit.toFixed(2)}`)
        return json(res, 200, { jobId })
      } catch (submitErr) {
        await checkAndUpdateSpendLocked(-cost, { allowRefund: true })
        throw submitErr
      }
    } catch (err) {
      const status = err.message.includes('limit exceeded') ? 402 : 502
      return json(res, status, { error: err.message })
    }
  }

  if (req.method === 'POST' && url.pathname === '/v1/audio/sfx/estimate') {
    const body = await readBody(req, res)
    if (!body) return
    const text = typeof body?.text === 'string' ? body.text : ''
    if (text.length > MAX_SPEECH_CHARS) return json(res, 413, { error: `text exceeds ${MAX_SPEECH_CHARS} characters` })
    const provider = body?.provider ?? 'elevenlabs-sfx'
    if (!getSfxProvider(provider)) return json(res, 400, { error: `unknown sfx provider: ${provider}` })
    const usd = estimateSfxUsd(body?.durationSeconds, provider)
    if (usd == null) return json(res, 400, { error: 'durationSeconds must be a positive number' })
    return json(res, 200, { usd, provider, quoteToken: text.trim() ? quoteFor('/v1/audio/sfx', body, usd) : null })
  }

  if (req.method === 'POST' && url.pathname === '/v1/audio/sfx') {
    if (!requirePaidAuthorization(req, res)) return
    if (!FAL_KEY) return json(res, 402, { error: 'FAL_KEY not set — add it to .env and restart: npm run video-server' })
    const body = await readBody(req, res)
    if (!body) return
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    if (!text) return json(res, 400, { error: 'text is required' })
    if (text.length > MAX_SPEECH_CHARS) return json(res, 413, { error: `text exceeds ${MAX_SPEECH_CHARS} characters` })

    let cost
    try { cost = quotedCost('/v1/audio/sfx', body) } catch (error) { return json(res, 409, { error: error.message }) }

    const providerSpec = getSfxProvider(body.provider ?? 'elevenlabs-sfx')
    if (!providerSpec) return json(res, 400, { error: `unknown sfx provider: ${body.provider}` })

    try {
      const spendInfo = await checkAndUpdateSpendLocked(cost)
      try {
        const input = providerSpec.buildInput(text, body.durationSeconds)
        const jobId = await queueJob('audio', providerSpec.endpoint, input)
        console.log(`[video-server] submitted sfx job ${jobId}: ${text.slice(0, 60)}`)
        console.log(`[video-server] Spend cap check: debited $${cost.toFixed(4)}. Daily total: $${spendInfo.newSpent.toFixed(4)} / $${spendInfo.limit === Infinity ? 'Unlimited' : spendInfo.limit.toFixed(2)}`)
        return json(res, 200, { jobId })
      } catch (submitErr) {
        await checkAndUpdateSpendLocked(-cost, { allowRefund: true })
        throw submitErr
      }
    } catch (err) {
      const status = err.message.includes('limit exceeded') ? 402 : 502
      return json(res, status, { error: err.message })
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/v1/videos/jobs/')) {
    const jobId = url.pathname.split('/').pop()
    if (!jobs.has(jobId)) return json(res, 404, { error: 'unknown job' })
    const job = await refreshJob(jobId)
    return json(res, 200, {
      status: job.status, videoUrl: job.videoUrl, audioUrl: job.audioUrl,
      imageUrl: job.imageUrl ?? null, sourceUrl: job.sourceUrl ?? null,
      error: job.error, pollError: job.pollError ?? null,
    })
  }

  if (req.method === 'GET' && url.pathname.startsWith('/audio/')) {
    const file = url.pathname.split('/').pop()
    if (!/^[\w-]+\.(?:mp3|wav)$/.test(file)) return json(res, 400, { error: 'bad filename' })
    try {
      const data = await readFile(join(AUDIO_DIR, file))
      res.writeHead(200, {
        'Content-Type': file.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg',
        ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
      })
      return res.end(data)
    } catch {
      return json(res, 404, { error: 'not found' })
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/videos/')) {
    const file = url.pathname.split('/').pop()
    if (!/^[\w-]+\.(?:mp4|mov)$/.test(file)) return json(res, 400, { error: 'bad filename' })
    try {
      const data = await readFile(join(OUT_DIR, file))
      res.writeHead(200, {
        'Content-Type': file.endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
        ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
      })
      return res.end(data)
    } catch {
      return json(res, 404, { error: 'not found' })
    }
  }

  return json(res, 404, { error: 'Not found' })
})

try {
  const restored = await loadJobs(JOBS_PATH)
  for (const [jobId, job] of restored) jobs.set(jobId, job)
  if (jobs.size) console.log(`[video-server] restored ${jobs.size} job${jobs.size === 1 ? '' : 's'} from disk`)
} catch (err) {
  console.error(`[video-server] could not restore job registry: ${err.message}`)
}

server.listen(PORT, '127.0.0.1', async () => {
  let limitMsg = 'limit $10.00'
  try {
    const { limit } = await checkAndUpdateSpendLocked(0, { dryRun: true })
    limitMsg = limit === Infinity ? 'spend limit: Unlimited' : `spend limit: $${limit.toFixed(2)}/day`
  } catch {}
  console.log(`[video-server] listening on http://localhost:${PORT} (key ${FAL_KEY ? 'loaded' : 'MISSING'}, ${limitMsg})`)
  console.log(`[video-server] paid routes require the owner-only capability token at ${TOKEN_PATH}${ENGINE_TOKEN_CREATED ? ' (created now)' : ''}`)
})
