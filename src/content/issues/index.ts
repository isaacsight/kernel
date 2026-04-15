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

/** ──────────────────────────────────────────────────────────────
 *  ISSUE FEATURES — the editorial "tool" used for a given issue.
 *
 *  Different issues need different tools. An essay wants section
 *  kickers, drop caps, and a pull quote. An interview wants a
 *  subject dossier and Q&A format. A recipe wants ingredient lists
 *  and method steps. Rather than force every feature into one
 *  layout, `spread` is a discriminated union: each issue picks the
 *  right tool, and the IssueFeature router renders the matching
 *  component.
 *
 *  To add a new editorial tool (e.g. 'photo-diary', 'review',
 *  'letters', 'recipe'):
 *    1. Add a new interface with its own `type` literal below.
 *    2. Add it to the IssueSpread union.
 *    3. Create src/components/<Name>Feature.{tsx,css}.
 *    4. Register it in src/components/IssueFeature.tsx's switch.
 *  ────────────────────────────────────────────────────────────── */

/** Shared base — fields every feature type needs regardless of
 *  which editorial tool the issue uses. */
interface SpreadCommon {
  /** Editorial kicker above the feature, e.g. "STYLE SPREAD · スタイル" */
  kicker: string
  /** Feature title */
  title: string
  /** Japanese title */
  titleJp: string
  /** Italic standfirst under the title */
  deck: string
  /** Byline — who wrote / interviewed / shot it */
  byline: string
  /** Closing sign-off line (italic) */
  signoff: string
  /** Paper stock for the feature — usually different from cover */
  stock?: 'cream' | 'butter' | 'kraft' | 'ivory'
}

/** A section within a long-form essay — mono kicker + serif prose. */
export interface SpreadSection {
  heading: string
  headingJp?: string
  paragraphs: string[]
}

/** A pull quote — the large italic tomato callout inside an essay. */
export interface SpreadPullQuote {
  text: string
  attribution: string
}

/** ─── essay ────────────────────────────────────────────────────
 *  Long-form prose with drop cap, section kickers, pull quote.
 *  Used for culture / style / field-of-thought features. */
export interface EssaySpread extends SpreadCommon {
  type: 'essay'
  sections: SpreadSection[]
  pullQuote?: SpreadPullQuote
}

/** ─── interview ────────────────────────────────────────────────
 *  Q&A with a subject dossier at the top. Used for profiles of
 *  people — real, fictional, or composite. */
export interface InterviewSubject {
  name: string
  nameJp?: string
  role: string
  roleJp?: string
  location: string
}

export interface InterviewExchange {
  q: string
  a: string
}

export interface InterviewSpread extends SpreadCommon {
  type: 'interview'
  subject: InterviewSubject
  exchanges: InterviewExchange[]
  /** Optional intro block before the Q&A begins. */
  intro?: string
}

/** Discriminated union — add new editorial tools here. */
export type IssueSpread = EssaySpread | InterviewSpread

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
