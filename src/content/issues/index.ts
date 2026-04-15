/* ──────────────────────────────────────────────────────────────
   kernel.chat — Issue archive
   The back catalog. Every published issue lives here as a frozen
   snapshot. The landing page always reads from LATEST_ISSUE; past
   issues remain browseable at /issues/:number.

   To publish a new issue:
     1. Add src/content/issues/<number>.ts following the shape below.
     2. Import + push into ALL_ISSUES below.
     3. Bump the cover headline + JP if needed.
     4. Done — the landing flips to the new cover, the back catalog
        gains a row, and the previous issue freezes at its URL.
   ────────────────────────────────────────────────────────────── */

import { ISSUE_360 } from './360'
import { ISSUE_361 } from './361'
import { ISSUE_362 } from './362'

export interface ContentsItem {
  /** Numbered catalog number, padded (e.g. "001") */
  n: string
  /** English title */
  en: string
  /** Japanese subtitle */
  jp: string
  /** Section tag, uppercase (e.g. "FEATURE", "SOUND", "SECURITY") */
  tag: string
}

export interface IssueHeadline {
  /** Leading word(s), regular weight */
  prefix: string
  /** Italic tomato emphasis word (the cover's loudest type) */
  emphasis: string
  /** Trailing word(s), regular weight */
  suffix: string
  /** Italic swash subtitle under the headline */
  swash: string
}

export interface IssueRecord {
  number: string
  month: string
  year: string
  feature: string
  featureJp: string
  price: string
  tagline: string
  headline: IssueHeadline
  contents: ContentsItem[]
}

/** Every issue ever published, oldest first. */
export const ALL_ISSUES: IssueRecord[] = [
  ISSUE_360,
  ISSUE_361,
  ISSUE_362,
]

/** The latest published issue — drives the landing cover. */
export const LATEST_ISSUE: IssueRecord = ALL_ISSUES[ALL_ISSUES.length - 1]

/** Lookup helper for /issues/:number routes. */
export function findIssue(number: string): IssueRecord | undefined {
  return ALL_ISSUES.find((i) => i.number === number)
}
