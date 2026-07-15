// Local image server — backs the Creative Canvas image nodes when working
// locally without a login. Wraps mflux (MLX, Apple Silicon) behind a tiny
// OpenAI-images-compatible endpoint so the browser can generate for free.
//
//   npm run image-server        (or: node tools/local-image-server.mjs)
//
//   POST /v1/images/generations { "prompt": "...", "width"?, "height"? }
//     → { "data": [{ "b64_json": "<png>" }], "backend": "mflux/z-image-turbo" }
//   GET  /health → { ok, backend, busy }
//
// First generation downloads the Z-Image Turbo weights from Hugging Face
// (one-time, several GB). Generations run one at a time.

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = Number(process.env.IMAGE_SERVER_PORT || 5411)
const GENERATOR = process.env.IMAGE_SERVER_CMD || 'mflux-generate-z-image-turbo'
const QUANTIZE = process.env.IMAGE_SERVER_QUANTIZE || '4'
const BACKEND = `mflux/${GENERATOR.replace('mflux-generate-', '') || 'z-image-turbo'}`

let busy = false

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  })
  res.end(payload)
}

function generate(prompt, width, height) {
  return new Promise(async (resolve, reject) => {
    const dir = await mkdtemp(join(tmpdir(), 'canvas-img-'))
    const output = join(dir, 'out.png')
    const args = [
      '--prompt', prompt,
      '--quantize', QUANTIZE,
      '--width', String(width),
      '--height', String(height),
      '--output', output,
    ]
    const child = spawn(GENERATOR, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', chunk => { stderr += chunk })
    child.stdout.on('data', chunk => process.stdout.write(chunk))
    child.on('error', err => reject(new Error(`${GENERATOR} not found — install with: uv tool install mflux (${err.message})`)))
    child.on('close', async code => {
      try {
        if (code !== 0) {
          reject(new Error(`${GENERATOR} exited ${code}: ${stderr.slice(-400)}`))
          return
        }
        const image = await readFile(output)
        resolve(image.toString('base64'))
      } catch (err) {
        reject(err)
      } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => {})
      }
    })
  })
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {})
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true, backend: BACKEND, busy })
  if (req.method !== 'POST' || !req.url?.startsWith('/v1/images/generations')) return json(res, 404, { error: 'Not found' })

  let body = ''
  for await (const chunk of req) body += chunk
  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' })
  }
  const prompt = typeof parsed.prompt === 'string' ? parsed.prompt.trim() : ''
  if (!prompt) return json(res, 400, { error: 'prompt is required' })
  if (busy) return json(res, 429, { error: 'A generation is already running — try again shortly' })

  // Z-Image works best at multiples of 64; clamp to sane local sizes.
  const clamp = (v, fallback) => Math.min(1536, Math.max(512, Math.round((Number(v) || fallback) / 64) * 64))
  const width = clamp(parsed.width, 1024)
  const height = clamp(parsed.height, 1024)

  busy = true
  const started = Date.now()
  console.log(`[image-server] generating ${width}x${height}: ${prompt.slice(0, 80)}…`)
  try {
    const b64 = await generate(prompt, width, height)
    console.log(`[image-server] done in ${((Date.now() - started) / 1000).toFixed(1)}s`)
    json(res, 200, { data: [{ b64_json: b64 }], backend: BACKEND, seconds: (Date.now() - started) / 1000 })
  } catch (err) {
    console.error(`[image-server] failed: ${err.message}`)
    json(res, 500, { error: err.message })
  } finally {
    busy = false
  }
})

server.listen(PORT, () => {
  console.log(`[image-server] ${BACKEND} listening on http://localhost:${PORT}`)
  console.log('[image-server] first generation downloads model weights (one-time, several GB)')
})
