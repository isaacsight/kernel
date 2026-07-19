// Poll an existing engine job and download its artifact when done.
// Usage: node poll.mjs <jobId> <outPath> [maxMinutes]
import { writeFile } from 'node:fs/promises'
const [jobId, outPath, maxMin = '45'] = process.argv.slice(2)
const deadline = Date.now() + Number(maxMin) * 60000
let job
while (Date.now() < deadline) {
  await new Promise(r => setTimeout(r, 10000))
  job = await (await fetch(`http://localhost:5412/v1/videos/jobs/${jobId}`)).json()
  if (job.status === 'done' || job.status === 'error') break
}
if (job?.status !== 'done') throw new Error(`job ${jobId} ended: ${job?.status} ${job?.error ?? ''}`)
const url = job.videoUrl ?? job.imageUrl ?? job.audioUrl
await writeFile(outPath, Buffer.from(await (await fetch(url)).arrayBuffer()))
console.log(`saved: ${outPath}`)
