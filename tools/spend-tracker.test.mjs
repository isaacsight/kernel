import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { checkAndUpdateSpend, getLocalDateString, parseSpendLimit } from './spend-tracker.mjs'

const TEST_TRACKER = join(process.cwd(), 'output', 'test-spend-tracker.json')

describe('spend-tracker', () => {
  beforeEach(async () => {
    try { await rm(TEST_TRACKER) } catch {}
  })
  afterEach(async () => {
    try { await rm(TEST_TRACKER) } catch {}
  })

  it('correctly formats local date', () => {
    const dStr = getLocalDateString()
    expect(dStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('tracks spend accumulation and respects limit', async () => {
    const res1 = await checkAndUpdateSpend(0.40, { limit: 1.00, trackerPath: TEST_TRACKER })
    expect(res1.newSpent).toBe(0.40)
    expect(res1.limit).toBe(1.00)

    const res2 = await checkAndUpdateSpend(0.50, { limit: 1.00, trackerPath: TEST_TRACKER })
    expect(res2.newSpent).toBe(0.90)

    await expect(checkAndUpdateSpend(0.15, { limit: 1.00, trackerPath: TEST_TRACKER }))
      .rejects.toThrow('Daily spend limit exceeded')
  })

  it('supports infinite/zero spend limit', async () => {
    const res1 = await checkAndUpdateSpend(100.00, { limit: '0', trackerPath: TEST_TRACKER })
    expect(res1.limit).toBe(Infinity)
    expect(res1.newSpent).toBe(100.00)
  })

  it('resets spend on date change', async () => {
    await checkAndUpdateSpend(0.80, { limit: 1.00, date: '2026-07-17', trackerPath: TEST_TRACKER })
    const res = await checkAndUpdateSpend(0.30, { limit: 1.00, date: '2026-07-18', trackerPath: TEST_TRACKER })
    expect(res.newSpent).toBe(0.30)
  })

  it('rejects malformed limits instead of silently weakening the cap', () => {
    expect(() => parseSpendLimit('-1')).toThrow('positive dollar amount')
    expect(() => parseSpendLimit('10oops')).toThrow('positive dollar amount')
    expect(parseSpendLimit(undefined)).toBe(10)
  })

  it('requires explicit refunds and never lets spend become negative', async () => {
    await checkAndUpdateSpend(0.40, { limit: 1, trackerPath: TEST_TRACKER })
    await expect(checkAndUpdateSpend(-0.10, { limit: 1, trackerPath: TEST_TRACKER }))
      .rejects.toThrow('allowRefund')
    const refunded = await checkAndUpdateSpend(-1, { limit: 1, trackerPath: TEST_TRACKER, allowRefund: true })
    expect(refunded.newSpent).toBe(0)
  })

  it('fails closed when the tracker is corrupt', async () => {
    await mkdir(join(process.cwd(), 'output'), { recursive: true })
    await writeFile(TEST_TRACKER, '{not json')
    await expect(checkAndUpdateSpend(0.10, { limit: 1, trackerPath: TEST_TRACKER }))
      .rejects.toThrow('Spend tracker is unreadable')
  })
})
