// Driver for the local video engine: estimate -> quote -> generate -> poll -> download.
// Usage: node gen.mjs <image|video|sfx> <outPath> <jsonBody>
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const [kind, outPath, bodyJson] = process.argv.slice(2)
const body = JSON.parse(bodyJson)
const BASE = 'http://localhost:5412'
const token = (await readFile(join(homedir(), '.config', 'kernel', 'galley-engine-token'), 'utf8')).trim()

const routes = {
  image: { est: '/v1/images/estimate', gen: '/v1/images/fal' },
  video: { est: '/v1/videos/estimate', gen: '/v1/videos/generations' },
  sfx: { est: '/v1/audio/sfx/estimate', gen: '/v1/audio/sfx' },
}[kind]

async function post(path, payload, auth = false) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`${path} ${res.status}: ${data.error}`)
  return data
}

const est = await post(routes.est, body)
console.log(`quote: $${est.usd} (${est.pricingText?.slice(0, 60) ?? est.provider ?? ''})`)
if (!est.quoteToken) throw new Error('no quote token returned')

// Video estimates hash a server-normalized durationSeconds into the quote;
// echo it back so the generate body matches the quoted hash.
const genBody = { ...body, ...(kind === 'video' && est.seconds != null ? { durationSeconds: est.seconds } : {}), quoteToken: est.quoteToken }
const { jobId } = await post(routes.gen, genBody, true)
console.log(`job: ${jobId}`)

let job
for (let i = 0; i < 240; i++) {
  await new Promise(r => setTimeout(r, 5000))
  const res = await fetch(`${BASE}/v1/videos/jobs/${jobId}`)
  job = await res.json()
  if (job.status === 'done' || job.status === 'error') break
  if (i % 6 === 5) console.log(`  ...${job.status} (${(i + 1) * 5}s)`)
}
if (job.status !== 'done') throw new Error(`job ended: ${job.status} ${job.error ?? ''}`)

const url = job.videoUrl ?? job.imageUrl ?? job.audioUrl
const bin = await fetch(url)
await writeFile(outPath, Buffer.from(await bin.arrayBuffer()))
console.log(`saved: ${outPath} ($${est.usd})`)
