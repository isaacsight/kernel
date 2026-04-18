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
import { ISSUE_364 } from './364'
import { ISSUE_365 } from './365'
import { ISSUE_366 } from './366'
import { ISSUE_367 } from './367'
import { ISSUE_368 } from './368'
import { ISSUE_369 } from './369'

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
  stock?: 'cream' | 'butter' | 'kraft' | 'ivory' | 'ink'
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

/** A labeled data row for the abstract dossier at the top of an
 *  essay — reads like the front matter of a methods paper. */
export interface SpreadDossierItem {
  label: string
  labelJp?: string
  value: string
  valueJp?: string
}

/** A methods-paper-style abstract block that can sit above the
 *  essay body — mono labels, tomato values, numbered rows. */
export interface SpreadDossier {
  kicker: string
  note?: string
  items: SpreadDossierItem[]
}

/** A single statistic in a "by the numbers" data block —
 *  large tomato display type, caption underneath. */
export interface SpreadStat {
  n: string
  label: string
  labelJp?: string
  source?: string
}

/** A mid-essay data block. Interrupts the prose rhythm with a
 *  grid of large statistics. `afterSection` is the 0-indexed
 *  position where the block should appear (inserts *after* that
 *  section). */
export interface SpreadDataBlock {
  kicker: string
  heading?: string
  headingJp?: string
  afterSection: number
  stats: SpreadStat[]
}

/** A single cited work for the works-cited block. Mono type,
 *  hanging-indent layout. */
export interface SpreadReference {
  authors: string
  year: string
  title: string
  journal?: string
}

/** The works-cited block at the foot of the essay. Gives an
 *  editorial essay the weight of a methods paper when the topic
 *  calls for it. */
export interface SpreadReferences {
  kicker: string
  note?: string
  items: SpreadReference[]
}

/** ─── essay ────────────────────────────────────────────────────
 *  Long-form prose with drop cap, section kickers, pull quote.
 *  Used for culture / style / field-of-thought features.
 *
 *  Optional modules for issues that want more expression:
 *  - dossier:    abstract block at the top (methods-paper card)
 *  - dataBlock:  "by the numbers" grid inserted between sections
 *  - references: works-cited block at the foot */
export interface EssaySpread extends SpreadCommon {
  type: 'essay'
  sections: SpreadSection[]
  pullQuote?: SpreadPullQuote
  dossier?: SpreadDossier
  dataBlock?: SpreadDataBlock
  references?: SpreadReferences
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

/** ─── forecast ────────────────────────────────────────────────
 *  Numbered propositions — a manifesto / forecast / declaration
 *  of stance. Used when the issue's thesis is a *list of claims*
 *  rather than a narrative or a conversation. */
export interface ForecastProposition {
  /** Catalog number, padded — "01", "02", etc. */
  n: string
  /** Short declaration — one sentence, bold serif. */
  title: string
  /** Japanese subtitle for the proposition. */
  titleJp?: string
  /** Prose explanation, 1–3 short paragraphs. */
  body: string[]
}

export interface ForecastSpread extends SpreadCommon {
  type: 'forecast'
  /** Standfirst prose block between the deck and the first
   *  proposition — optional, used to set the frame. */
  intro?: string
  propositions: ForecastProposition[]
  /** Closing meditation paragraph after the last proposition. */
  outro?: string
}

/** ─── dispatch ────────────────────────────────────────────────
 *  A wire-style news dispatch — numbered stakes filed against a
 *  deadline, the night a specific event happened. Forecast is
 *  general outlook; dispatch is reactive and dated. The grammar
 *  is borrowed from the newswire: a repeating wire-slug band at
 *  the top, a proper dateline, a dossier card with FILED / STATUS
 *  / PARTNERS, checkbox-numbered items (things verified before
 *  filing, not declarations from on high), a mid-spread bulletin
 *  pull-quote, and an optional bridge sentence that links the
 *  dispatch to the preceding issue so the magazine reads as a
 *  running serial. */
export interface DispatchPartner {
  /** Partner name, uppercase (e.g. "CANVA"). */
  name: string
  /** One-line role / reason they appear in the roll. */
  role: string
}

export interface DispatchProposition {
  /** Catalog number, padded — "01", "02", etc. */
  n: string
  /** Short declaration — one sentence, bold serif. */
  title: string
  /** Japanese subtitle for the proposition. */
  titleJp?: string
  /** Prose explanation, 1–3 short paragraphs. */
  body: string[]
  /** Optional Courier overline tag above the title — pulls the
   *  matching CONTENTS tag into the body (e.g. "FIELD", "TASTE").
   *  Ties the back-of-book catalog to the prose. */
  overline?: string
  /** Optional wire-style timestamp rendered in a thin Courier
   *  rail to the left of the item on desktop (e.g. "23:47 JST").
   *  Hidden on mobile — the rail is a desktop-only flourish. */
  filedAt?: string
}

export interface DispatchBulletin {
  /** The single loudest line lifted out of the propositions.
   *  Rendered as an em-dashed wire bulletin callout mid-spread. */
  text: string
  /** Optional attribution under the bulletin. */
  attribution?: string
}

export interface DispatchBridge {
  /** Issue number referenced (e.g. "366"). */
  issue: string
  /** Italic bridge sentence connecting this dispatch to that
   *  issue, printed at the top of the spread — makes the mag
   *  read as a continuing serial rather than episodic. */
  text: string
}

export interface DispatchSpread extends SpreadCommon {
  type: 'dispatch'
  /** Repeating wire-slug band (Courier mono marquee at top). */
  slug: string
  /** Newspaper dateline, e.g. "SAN FRANCISCO — APR 17 — ..." */
  dateline: string
  /** Filed-at stamp shown in the dossier card. */
  filedAt: string
  /** Status stamp — "WET", "FILED", "EMBARGO LIFTED", etc. */
  status: string
  /** Partners / players attached to the story. Rendered as a
   *  numbered sample card inset into the spread. */
  partners?: DispatchPartner[]
  /** Editorial bridge to an adjacent issue. */
  bridge?: DispatchBridge
  /** Standfirst prose block before the first proposition. */
  intro?: string
  /** Numbered stakes. Rendered with checkbox numbering —
   *  hollow tomato squares with a hand-stroked check inside —
   *  to read as "verified before filing" rather than forecast
   *  circles reading as "declared from on high". */
  propositions: DispatchProposition[]
  /** Mid-spread wire bulletin — a single sharp line lifted
   *  out of the propositions and set as a billboard. */
  bulletin?: DispatchBulletin
  /** Closing paragraph after the last proposition. */
  outro?: string
  /** Wire terminator — the `— 30 —` line that closed old AP
   *  dispatches, rendered as a single Courier rule at the very
   *  end of the spread. Optional; when omitted, the dispatch
   *  closes with the signoff and monument. */
  terminator?: string
}

/** Discriminated union — add new editorial tools here. */
export type IssueSpread =
  | EssaySpread
  | InterviewSpread
  | ForecastSpread
  | DispatchSpread

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

/**
 * Optional cover ornament — a decorative mark that reinforces
 * the issue's theme. Currently:
 *
 * - 'ink-spread'  — a tomato ink blot bleeding off the lower-right
 *                   margin of the cover. Pairs with dispatch-style
 *                   issues whose swash names the ink literally.
 * - 'warty-spots' — a scattered field of irregular tomato papillae
 *                   drifting across the cover like the spotted
 *                   dermis of a reef specimen. Introduced for 369
 *                   (warty frogfish); reusable any time a cover
 *                   wants "speckled" rather than "blotted."
 *
 * Most issues do not set this; leaving it undefined is the default.
 */
export type IssueCoverOrnament = 'ink-spread' | 'warty-spots'

/** Optional press-preview wax seal rendered in the top-right
 *  corner of the cover. Reads as a rubber stamp or embargo seal;
 *  pairs naturally with dispatch issues but can be used on any
 *  cover where a one-line stamp adds editorial weight. */
export interface IssueCoverSeal {
  /** Upper arc label, e.g. "EMBARGO LIFTED". */
  label: string
  /** Center-bottom date, e.g. "IV·26". */
  date: string
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
  /** Cover paper stock. Defaults to 'cream'. */
  coverStock?: IssueStock
  /** Cover composition variant. Defaults to 'classic'. */
  coverLayout?: IssueCoverLayout
  /** Optional decorative cover ornament. Set per-issue; most
   *  issues omit it. */
  coverOrnament?: IssueCoverOrnament
  /** Optional press-preview wax seal in the cover's top-right
   *  corner. Orthogonal to the ornament — issues can use both,
   *  either, or neither. */
  coverSeal?: IssueCoverSeal
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
  ISSUE_364,
  ISSUE_365,
  ISSUE_366,
  ISSUE_367,
  ISSUE_368,
  ISSUE_369,
]

/** The latest published issue — drives the landing cover. */
export const LATEST_ISSUE: IssueRecord = ALL_ISSUES[ALL_ISSUES.length - 1]

/** Lookup helper for /issues/:number routes. */
export function findIssue(number: string): IssueRecord | undefined {
  return ALL_ISSUES.find((i) => i.number === number)
}
