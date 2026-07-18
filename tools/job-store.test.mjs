import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadJobs, saveJobs } from './job-store.mjs'

const TEST_STORE = join(process.cwd(), 'output', 'test-job-registry.json')

afterEach(async () => { await rm(TEST_STORE, { force: true }) })

describe('job registry persistence', () => {
  it('round-trips resumable queue metadata', async () => {
    const jobs = new Map([['job-1', {
      kind: 'video', status: 'running', statusUrl: 'https://queue.fal.run/status/1',
      responseUrl: 'https://queue.fal.run/result/1', videoUrl: null, error: null,
    }]])
    await saveJobs(jobs, TEST_STORE)
    expect(await loadJobs(TEST_STORE)).toEqual(jobs)
  })

  it('returns an empty registry when no store exists', async () => {
    expect(await loadJobs(TEST_STORE)).toEqual(new Map())
  })

  it('fails visibly instead of trusting corrupt state', async () => {
    await mkdir(join(process.cwd(), 'output'), { recursive: true })
    await writeFile(TEST_STORE, '{not json')
    await expect(loadJobs(TEST_STORE)).rejects.toThrow('Job registry is unreadable')
  })
})
