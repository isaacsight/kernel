/* THE STACKS — volume grouping.
   A volume is one cover month of the catalog; the room walks
   newest volume to oldest. Pure over the registry so it tests
   without the renderer. */
import type { IssueRecord } from '../content/issues/schema'

export interface Volume {
  /** EN lockup, e.g. 'FEB 2027' */
  label: string
  /** JP lockup with kanji digits, e.g. '二〇二七年二月' */
  labelJp: string
  issues: IssueRecord[]
}

const MONTH_ORDER = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_JP = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']
const DIGIT_JP: Record<string, string> = {
  '0': '〇', '1': '一', '2': '二', '3': '三', '4': '四',
  '5': '五', '6': '六', '7': '七', '8': '八', '9': '九',
}

function yearJp(year: string): string {
  return year.split('').map((d) => DIGIT_JP[d] ?? d).join('')
}

/** The registry is not uniform: most issues carry a 3-letter month
 *  ('JUL'), but a run of 18 April issues and 2 June issues spell the
 *  month out in full ('APRIL', 'JUNE'). Every full name's first three
 *  letters equal the standard abbreviation, so normalize on that
 *  instead of touching twenty content files. */
function normalizeMonth(month: string): string {
  return month.toUpperCase().slice(0, 3)
}

function monthIndex(month: string): number {
  return MONTH_ORDER.indexOf(normalizeMonth(month))
}

export function groupIntoVolumes(issues: IssueRecord[]): Volume[] {
  const byKey = new Map<string, IssueRecord[]>()
  for (const issue of issues) {
    const key = `${issue.year}-${String(monthIndex(issue.month)).padStart(2, '0')}`
    const bucket = byKey.get(key)
    if (bucket) bucket.push(issue)
    else byKey.set(key, [issue])
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([, group]) => {
      const sorted = [...group].sort((a, b) => Number(b.number) - Number(a.number))
      const { month, year } = sorted[0]
      return {
        label: `${normalizeMonth(month)} ${year}`,
        labelJp: `${yearJp(year)}年${MONTH_JP[monthIndex(month)]}`,
        issues: sorted,
      }
    })
}
