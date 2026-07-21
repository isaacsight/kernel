import { describe, it, expect } from 'vitest'
import { groupIntoVolumes } from './volumes'
import type { IssueRecord } from '../content/issues/schema'

const issue = (number: string, month: string, year: string) =>
  ({ number, month, year }) as IssueRecord

describe('groupIntoVolumes', () => {
  it('groups by cover month, volumes and issues newest-first', () => {
    const vols = groupIntoVolumes([
      issue('425', 'DEC', '2026'),
      issue('426', 'JAN', '2027'),
      issue('427', 'FEB', '2027'),
    ])
    expect(vols.map((v) => v.label)).toEqual(['FEB 2027', 'JAN 2027', 'DEC 2026'])
    expect(vols[0].issues.map((i) => i.number)).toEqual(['427'])
  })

  it('keeps multiple issues of one month newest-first', () => {
    const vols = groupIntoVolumes([
      issue('398', 'JUL', '2026'),
      issue('399', 'JUL', '2026'),
    ])
    expect(vols).toHaveLength(1)
    expect(vols[0].issues.map((i) => i.number)).toEqual(['399', '398'])
  })

  it('renders the Japanese volume label with kanji digits', () => {
    const [v] = groupIntoVolumes([issue('427', 'FEB', '2027')])
    expect(v.labelJp).toBe('二〇二七年二月')
  })

  it('handles all twelve month abbreviations', () => {
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
    const vols = groupIntoVolumes(months.map((m, i) => issue(String(360 + i), m, '2026')))
    expect(vols[0].labelJp.endsWith('十二月')).toBe(true)   // DEC sorts newest
    expect(vols[11].labelJp.endsWith('一月')).toBe(true)    // JAN sorts oldest
  })

  it('normalizes full-word months to their 3-letter abbreviation (registry has APRIL/JUNE alongside APR/JUN)', () => {
    const vols = groupIntoVolumes([issue('370', 'APRIL', '2026')])
    expect(vols[0].label).toBe('APR 2026')
    expect(vols[0].labelJp).toBe('二〇二六年四月')
  })

  it('groups a full-word month issue with its abbreviated-month siblings, not into a separate bucket', () => {
    const vols = groupIntoVolumes([
      issue('392', 'JUNE', '2026'),
      issue('395', 'JUN', '2026'),
    ])
    expect(vols).toHaveLength(1)
    expect(vols[0].label).toBe('JUN 2026')
    expect(vols[0].issues.map((i) => i.number)).toEqual(['395', '392'])
  })
})
