import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { isFalQueueUrl } from './engine-safety.mjs'

const JOB_ID = /^[\w-]+$/
const KINDS = new Set(['video', 'image', 'audio'])
const STATUSES = new Set(['queued', 'running', 'done', 'error'])

function validJob(id, job) {
  return JOB_ID.test(id)
    && job && typeof job === 'object'
    && KINDS.has(job.kind)
    && STATUSES.has(job.status)
    && isFalQueueUrl(job.statusUrl)
    && isFalQueueUrl(job.responseUrl)
}

export async function loadJobs(path) {
  let payload
  try {
    payload = JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return new Map()
    throw new Error(`Job registry is unreadable: ${error.message}`)
  }
  if (payload?.version !== 1 || !Array.isArray(payload.jobs)) {
    throw new Error('Job registry has an unsupported format')
  }
  return new Map(payload.jobs.filter(entry => Array.isArray(entry) && validJob(entry[0], entry[1])))
}

export async function saveJobs(jobs, path) {
  const entries = [...jobs.entries()].filter(([id, job]) => validJob(id, job))
  const tempPath = `${path}.${process.pid}.tmp`
  await mkdir(dirname(path), { recursive: true })
  await writeFile(tempPath, JSON.stringify({ version: 1, jobs: entries }, null, 2), { mode: 0o600 })
  await rename(tempPath, path)
}
