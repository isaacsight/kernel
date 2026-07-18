import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const DEFAULT_LIMIT = 10

export function parseSpendLimit(value) {
  if (value === undefined || value === null || String(value).trim() === '') return DEFAULT_LIMIT
  const text = String(value).trim()
  if (text === '0') return Infinity
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error('FAL_DAILY_SPEND_LIMIT must be a positive dollar amount or 0 to disable')
  const limit = Number(text)
  if (!Number.isFinite(limit) || limit <= 0) throw new Error('FAL_DAILY_SPEND_LIMIT must be a positive dollar amount or 0 to disable')
  return limit
}

export function getLocalDateString() {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  const localDate = new Date(d.getTime() - (offset * 60 * 1000))
  return localDate.toISOString().split('T')[0]
}

export async function checkAndUpdateSpend(estimatedCost, config = {}) {
  const envLimit = config.limit ?? process.env.FAL_DAILY_SPEND_LIMIT
  const trackerPath = config.trackerPath ?? join(process.cwd(), 'output', 'spend-tracker.json')
  const limit = parseSpendLimit(envLimit)
  if (!Number.isFinite(estimatedCost)) throw new Error('Estimated cost must be a finite number')
  if (estimatedCost < 0 && !config.allowRefund) throw new Error('Negative spend updates require allowRefund')

  const localDate = config.date ?? getLocalDateString()

  let tracker = { date: localDate, spent: 0 }
  try {
    const data = await readFile(trackerPath, 'utf-8')
    const parsed = JSON.parse(data)
    if (!parsed || typeof parsed.date !== 'string' || !Number.isFinite(parsed.spent) || parsed.spent < 0) {
      throw new Error('invalid tracker contents')
    }
    if (parsed.date === localDate) {
      tracker = parsed
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw new Error(`Spend tracker is unreadable: ${error.message}`)
  }

  const newSpent = Math.max(0, Math.round((tracker.spent + estimatedCost) * 10000) / 10000)
  if (newSpent > limit) {
    throw new Error(`Daily spend limit exceeded. Spent today: $${tracker.spent.toFixed(2)}, limit: $${limit.toFixed(2)}, request cost: $${estimatedCost.toFixed(2)}.`)
  }

  tracker.spent = newSpent

  if (!config.dryRun) {
    const tempPath = `${trackerPath}.${process.pid}.tmp`
    await mkdir(dirname(trackerPath), { recursive: true })
    await writeFile(tempPath, JSON.stringify(tracker, null, 2))
    await rename(tempPath, trackerPath)
  }

  return {
    tracker,
    limit,
    newSpent
  }
}
