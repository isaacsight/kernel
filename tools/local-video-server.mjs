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
import { MODELS, getModel, estimateUsd, effectiveSeconds, buildInput, pickEndpoint, extractVideoUrl } from './video-models.mjs'

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
