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
import { ISSUE_363 } from './363'

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

/** A section within a long-form spread feature — a mono kicker
 *  heading and a run of prose paragraphs beneath it. */
export interface SpreadSection {
  /** Uppercase mono kicker, e.g. "THE UNIFORM IS QUIETER NOW" */
  heading: string
  /** Optional Japanese subtitle for the section */
  headingJp?: string
  /** Body paragraphs, prose in serif */
  paragraphs: string[]
}

/** A pull quote — the large italic tomato callout inside a spread. */
export interface SpreadPullQuote {
  text: string
  attribution: string
}

/** Long-form editorial feature rendered by FashionSpread. Prose,
 *  drop caps, pull quotes — no images. */
export interface IssueSpread {
  /** Editorial kicker above the spread, e.g. "STYLE SPREAD · スタイル" */
  kicker: string
  /** Section title — the essay's title */
  title: string
  /** Japanese title */
  titleJp: string
  /** Italic standfirst under the title */
  deck: string
  /** Byline — who wrote it */
  byline: string
  /** Body of the essay, broken into section runs */
  sections: SpreadSection[]
  /** Optional pull quote — renders big italic tomato */
  pullQuote?: SpreadPullQuote
  /** Closing sign-off line (italic) */
  signoff: string
  /** Paper stock for the spread — different from default cover */
  stock?: 'cream' | 'butter' | 'kraft' | 'ivory'
}

export interface IssueCredits {
  editorInChief: string
  creativeDirection: string
  artDirection: string
  copy: string
  styling?: string
  photography?: string
  japanese: string
  production: string
}

/** Cover paper stock — each issue picks one so the covers are
 *  visually distinct at a glance. Defaults to 'cream'. */
export type IssueStock = 'cream' | 'butter' | 'kraft' | 'ivory' | 'ink'

/**
 * Cover layout variant — controls the composition of the cover,
 * not just the content. Gives each issue its own visual rhythm.
 *
 * - 'classic'         — centered, monument bottom-right (the default).
 * - 'monument-hero'   — the issue number itself becomes the cover art;
 *                       headline shrinks to subtitle. Best for issues
 *                       whose theme IS the number (anniversaries,
 *                       absence, milestones).
 * - 'asymmetric-left' — left-aligned everything, editorial rhythm;
 *                       suits fashion / culture features.
 */
export type IssueCoverLayout = 'classic' | 'monument-hero' | 'asymmetric-left'

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
  /** Cover paper stock. Defaults to 'cream'. */
  coverStock?: IssueStock
  /** Cover composition variant. Defaults to 'classic'. */
  coverLayout?: IssueCoverLayout
  /** Optional long-form editorial feature (prose, no images). */
  spread?: IssueSpread
  /** Optional masthead / editorial team credits. */
  credits?: IssueCredits
}

/** Every issue ever published, oldest first. */
export const ALL_ISSUES: IssueRecord[] = [
  ISSUE_360,
  ISSUE_361,
  ISSUE_362,
  ISSUE_363,
]

/** The latest published issue — drives the landing cover. */
export const LATEST_ISSUE: IssueRecord = ALL_ISSUES[ALL_ISSUES.length - 1]

/** Lookup helper for /issues/:number routes. */
export function findIssue(number: string): IssueRecord | undefined {
  return ALL_ISSUES.find((i) => i.number === number)
}
