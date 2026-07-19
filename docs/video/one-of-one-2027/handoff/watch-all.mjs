import { readFile, writeFile } from 'node:fs/promises'
const list = JSON.parse(await readFile(process.argv[2], 'utf8'))
const pending = new Map(list.map(j => [j.jobId, j.out]))
const deadline = Date.now() + 60 * 60000
while (pending.size && Date.now() < deadline) {
  await new Promise(r => setTimeout(r, 15000))
  for (const [jobId, out] of [...pending]) {
    try {
      const job = await (await fetch(`http://localhost:5412/v1/videos/jobs/${jobId}`)).json()
      if (job.status === 'done') {
        const url = job.videoUrl ?? job.imageUrl ?? job.audioUrl
        await writeFile(out, Buffer.from(await (await fetch(url)).arrayBuffer()))
        console.log(`DONE ${out}`)
        pending.delete(jobId)
      } else if (job.status === 'error') {
        console.log(`ERROR ${out}: ${job.error}`); pending.delete(jobId)
      }
    } catch {}
  }
}
console.log(`watcher exit; ${pending.size} unresolved`)
