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
import { ISSUE_370 } from './370'
import { ISSUE_371 } from './371'
import { ISSUE_372 } from './372'
import { ISSUE_373 } from './373'
import { ISSUE_374 } from './374'
import { ISSUE_375 } from './375'
import { ISSUE_376 } from './376'
import { ISSUE_377 } from './377'
import { ISSUE_378 } from './378'
import { ISSUE_379 } from './379'
import { ISSUE_380 } from './380'
import { ISSUE_381 } from './381'
import { ISSUE_382 } from './382'
import { ISSUE_383 } from './383'
import { ISSUE_384 } from './384'
import { ISSUE_385 } from './385'
import { ISSUE_386 } from './386'
import { ISSUE_387 } from './387'
import { ISSUE_388 } from './388'
import { ISSUE_389 } from './389'
import { ISSUE_390 } from './390'
import { ISSUE_391 } from './391'

// Re-export accent types so issue files can import from a single place.
export type { IssueAccent, InkSeedName, InkSeed } from './accents'
export { INK_SEEDS, defaultAccentFor, resolveAccentHex, isPopeyeSafe, contrastRatio, STOCK_HEX } from './accents'

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
  stock?: 'cream' | 'butter' | 'kraft' | 'ivory' | 'ink' | 'ledger'
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
 *  - filmstrip:  contact strip of frames, rendered after dossier
 *                (NEW — introduced ISSUE 371 for visual subjects)
 *  - dataBlock:  "by the numbers" grid inserted between sections
 *  - references: works-cited block at the foot */
export interface EssaySpread extends SpreadCommon {
  type: 'essay'
  sections: SpreadSection[]
  pullQuote?: SpreadPullQuote
  dossier?: SpreadDossier
  filmstrip?: SpreadFilmstrip
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

/** A single frame in the cinema-strip module — a still pulled
 *  from one of the subject's takes, rendered as a contact-strip
 *  cell. `image` is optional: when absent, the frame renders as
 *  a caption-only cell so the strip can ship before the source
 *  files arrive, and the stills drop in later without touching
 *  the layout. Introduced ISSUE 371 (cinematographer profile);
 *  reusable on any spread whose subject is visual. */
export interface SpreadFilmstripFrame {
  /** Take label, e.g. "TAKE 01". Padded for alignment. */
  take: string
  /** Venue or event the frame was pulled from. */
  venue: string
  /** Date or timestamp — Courier metadata under the venue. */
  date: string
  /** Optional still URL. When omitted, renders caption-only. */
  image?: string
}

/** A horizontal strip of contact-sheet frames. Format-neutral —
 *  available on essays (under the dossier) and on interviews
 *  (between intro and Q&A). Built for cinematographer profiles. */
export interface SpreadFilmstrip {
  /** Section kicker — e.g. "CINEMA STRIP · 撮影". */
  kicker: string
  /** One-line note under the kicker (optional). */
  note?: string
  frames: SpreadFilmstripFrame[]
}

export interface InterviewSpread extends SpreadCommon {
  type: 'interview'
  subject: InterviewSubject
  exchanges: InterviewExchange[]
  /** Optional intro block before the Q&A begins. */
  intro?: string
  /** Optional contact-strip module rendered between intro and
   *  Q&A. Introduced ISSUE 371; orthogonal for prior interviews. */
  filmstrip?: SpreadFilmstrip
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

/** ─── review ──────────────────────────────────────────────────
 *  A graded survey — the editorial form for "we tested N things,
 *  here is how they stack up." Distinct grammar from essay (one
 *  argument), interview (one subject), forecast (forward-leaning),
 *  and dispatch (timed news filing). The review form is measured,
 *  comparative, and committed to a verdict at the top.
 *
 *  Used for: tools, models, gear, releases, services. Anything that
 *  benefits from a head-to-head with named criteria. The first
 *  intended use is grading frontier security capabilities.
 *  ────────────────────────────────────────────────────────────── */

/** A criterion in the rubric — what was tested. Numbered to read
 *  as a methods-paper checklist rather than a bullet list. */
export interface ReviewCriterion {
  /** Catalog number, padded — "01", "02", ... */
  n: string
  /** Short label, sentence case. */
  label: string
  /** Optional Japanese subtitle. */
  labelJp?: string
  /** Optional weight string, e.g. "30%". */
  weight?: string
  /** Optional one-sentence elaboration shown under the label. */
  description?: string
}

/** A single graded subject. Renders as a card in the review grid. */
export interface ReviewSubject {
  /** 1-indexed rank — used for sort order and display. */
  rank: number
  /** Subject name, e.g. "Claude Mythos Preview". */
  name: string
  /** Optional Japanese subtitle. */
  nameJp?: string
  /** One-line characterisation — italic serif under the name. */
  read: string
  /** Numeric score (e.g. "87") or letter grade ("A-") — rendered
   *  as a monument-style block. The shape is editorial, not strict. */
  score: string
  /** Optional 0–5 stars (rendered as filled tomato lozenges). */
  stars?: number
  /** Free-form price label, e.g. "BYOK", "$20/mo", "Allowlist". */
  priceLabel?: string
  /** Optional symbolic price band — '$' to '$$$$'. */
  priceBand?: string
  /** Bullet list of pros, sentence case. */
  pros: string[]
  /** Bullet list of cons, sentence case. */
  cons: string[]
  /** Optional bold-serif single-line verdict under pros/cons. */
  verdict?: string
}

/** Standout pull-out — best-in-class, best-value, dark-horse
 *  callout that sits between the criteria and the grid. */
export interface ReviewStandout {
  /** Award label, uppercase, e.g. "BEST IN CLASS", "BEST VALUE". */
  label: string
  /** Subject this award attaches to. */
  subjectName: string
  /** One-sentence reason — italic serif. */
  reason: string
}

export interface ReviewSpread extends SpreadCommon {
  type: 'review'
  /** Optional repeating Courier band at the top — e.g.
   *  "TESTED · CRITIQUED · GRADED". When omitted, the spread
   *  opens directly with the kicker. */
  slug?: string
  /** Top-line verdict — single italic sentence, large display.
   *  This is the loudest line on the page; commit to it. */
  verdict: string
  /** Standfirst prose before the rubric — what was tested,
   *  for whom, with what apparatus. 1–3 short paragraphs. */
  intro?: string
  /** Numbered rubric — the criteria the subjects were judged
   *  against. Set as a dossier card. */
  criteria: ReviewCriterion[]
  /** Optional standout award between rubric and grid. */
  standout?: ReviewStandout
  /** N graded subjects. Order is used as written; the rank field
   *  is rendered, not used for sort. */
  subjects: ReviewSubject[]
  /** Closing paragraph — final recommendation, single short prose
   *  block. Optional; some reviews carry the verdict at the top
   *  and let the grid speak. */
  outro?: string
}

/** Discriminated union — add new editorial tools here. */
export type IssueSpread =
  | EssaySpread
  | InterviewSpread
  | ForecastSpread
  | DispatchSpread
  | ReviewSpread

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
 *  visually distinct at a glance. Defaults to 'cream'.
 *
 *  Stock cabinet (what each stock signals):
 *  - 'cream'   — anchor stock, the default; warm magazine paper
 *  - 'butter'  — pale yellow, summer/leisure register
 *  - 'kraft'   — recycled brown, field-report / outdoor register
 *  - 'ivory'   — slightly cooler than cream, serious-sober register
 *  - 'ink'     — dark stock for night / after-hours (introduced 371)
 *  - 'ledger'  — pale graph-ruled accountant's paper, audit register
 *               (introduced 372: THE AUDIT — debuts with the
 *                postmark dateline mechanic; the cover IS the audit)
 */
export type IssueStock = 'cream' | 'butter' | 'kraft' | 'ivory' | 'ink' | 'ledger'

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
export type IssueCoverLayout =
  | 'classic'
  | 'monument-hero'
  | 'asymmetric-left'
  /** 'ledger-rule' — horizontal rules + numbered totals across the
   *  cover; the cover IS the audit. Introduced 372: THE AUDIT.
   *  Pairs naturally with `coverStock: 'ledger'`. */
  | 'ledger-rule'
  /** 'numbered-catalog' — monument-hero number + a 1–N catalog
   *  lockup as secondary art, rather than a single feature
   *  monument. Introduced 375: THE SIX BORROWS. Suits issues
   *  whose argument *is* the numbered route. */
  | 'numbered-catalog'

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
 * - 'flash-burn'  — an overexposed white wedge from the upper-right
 *                   corner with soft falloff into the paper, miming
 *                   a Boiler-Room-style on-camera flash hitting the
 *                   page. Introduced for 371 (cinematographer of
 *                   nightlife); pairs naturally with ink stock and
 *                   the after-hours palette. The monument number
 *                   sits inside the burn as negative space.
 *
 * Most issues do not set this; leaving it undefined is the default.
 */
export type IssueCoverOrnament =
  | 'ink-spread'
  | 'warty-spots'
  | 'flash-burn'
  /** 'asterisk-stamp' — a small asterisk rendered as a postmark-
   *  style stamp (rotated, slightly off-register), placed where a
   *  reader would expect a footnote pointer. Distinct from the
   *  system-glyph asterisk that travels through every folio. The
   *  metaphor: the asterisk that should have shipped with the
   *  headline number. Introduced 374: AGAINST VIRAL BENCHMARKS. */
  | 'asterisk-stamp'

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

/** Postmark dateline — the fourth starred mechanic borrowed from
 *  PAPERSKY (see docs/design-language.md). Small-caps Latin lockup
 *  anchored at the bottom centre of the cover, separate from the
 *  monument and the seal. The format is `<PLACE> · <DATE>`, where
 *  place is a specific location (city, room, beat) and date is the
 *  POPEYE-style Roman-numeral month + two-digit year (e.g. `IV·26`).
 *
 *  Held back from 360–371 because no subject earned the geographic
 *  grounding it implies. First fired in 372: THE AUDIT — where the
 *  honest dateline is the room and the night the cut happened. */
export interface IssueCoverPostmark {
  /** Place label, small-caps Latin (e.g. "ROOM 503", "TOKYO",
   *  "OAKLAND"). Specific. The postmark is a claim about where
   *  the work happened, not where the magazine is filed. */
  place: string
  /** Date stamp, POPEYE-grammar Roman-numeral month + 2-digit
   *  year (e.g. "IV·26" for April 2026). */
  date: string
}

/**
 * Optional back-cover specification.
 *
 * The verso surface — the magazine's recurring back cover, introduced
 * by the spec at docs/back-cover-spec.md. One still-life subject per
 * issue, photographed under one light setup, laid out on one paper
 * stock, with the issue's dateline and tomato spot beneath. The setup
 * never changes; the subject rotates. By the tenth issue the back
 * covers form a series; by the thirtieth they read as the magazine's
 * second face.
 *
 * Set this field when the issue has commissioned (or placeholder)
 * back-cover art. Leave undefined to omit the verso for that issue —
 * the absence is fine; not every issue earns a back.
 */
export interface BackCoverSpec {
  /** Subject name in English, set as a small-caps caption beneath
   *  the image (e.g., "HAND-STAMPED NOTARY MARK"). */
  subject: string
  /** Subject name in Japanese, set in italic above the English
   *  caption (e.g., "公証印"). */
  subjectJp: string
  /** Optional image asset path (relative to public/). When omitted,
   *  the renderer falls back to a textured stock-coloured placeholder
   *  with the subject set across the centre — useful for issues that
   *  ship before the photograph is commissioned. */
  image?: string
  /** Paper stock for the back cover. Inherits the issue's front
   *  `coverStock` if omitted. Deliberate exceptions are documented
   *  in §V of docs/back-cover-spec.md (ledger for ink fronts, cream
   *  for paper subjects, kraft for industrial subjects). */
  stock?: IssueStock
  /** Optional photographer credit. Appears in the colophon (not on
   *  the back cover itself). */
  photographer?: string
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
  /** Optional postmark dateline at the bottom-centre of the cover.
   *  The fourth starred PAPERSKY mechanic (see
   *  docs/design-language.md). Use only when the subject is
   *  geographically grounded; otherwise leave undefined. */
  coverPostmark?: IssueCoverPostmark
  /** Optional back-cover specification. When set, the issue carries
   *  a verso surface — a recurring still-life subject under the
   *  established back-cover layout. Subject rotates per issue;
   *  layout is fixed. Full design spec at docs/back-cover-spec.md;
   *  the move was named in ISSUE 379 (ON BECOMING A REAL MAGAZINE)
   *  and ratified in ISSUE 381 (ON PROVENANCE). */
  backCover?: BackCoverSpec
  /** Adaptive issue accent — either a named seed from INK_SEEDS
   *  (e.g., 'cobalt') or a raw hex string. Drives the entire
   *  issue's color palette via five CSS-derived tones. When
   *  omitted, falls back to the spread type's default (see
   *  DEFAULT_ACCENT_BY_SPREAD in accents.ts). Existing issues
   *  without this field inherit 'tomato' naturally. */
  accent?: import('./accents').IssueAccent
  /** Optional long-form editorial feature (prose, no images). */
  spread?: IssueSpread
  /** Optional masthead / editorial team credits. */
  credits?: IssueCredits
  /** Optional named series this issue belongs to. Series group issues
   *  thematically across the back catalog (e.g., a multi-issue arc on
   *  one topic). Surfaces on cover + in the catalog index for grouping.
   *  Introduced in ISSUE 388 to anchor the "Agentic Substrates for the
   *  Frontier" series. */
  series?: IssueSeries
}

export interface IssueSeries {
  /** The series name (used as a tag/label on covers + indexes). */
  name: string
  /** Optional Japanese rendering of the series name. */
  nameJp?: string
  /** Optional one-sentence description of what the series covers. */
  about?: string
  /** Optional 1-based position of this issue within the series. */
  position?: number
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
  ISSUE_370,
  ISSUE_371,
  ISSUE_372,
  ISSUE_373,
  ISSUE_374,
  ISSUE_375,
  ISSUE_376,
  ISSUE_377,
  ISSUE_378,
  ISSUE_379,
  ISSUE_380,
  ISSUE_381,
  ISSUE_382,
  ISSUE_383,
  ISSUE_384,
  ISSUE_385,
  ISSUE_386,
  ISSUE_387,
  ISSUE_388,
  ISSUE_389,
  ISSUE_390,
  ISSUE_391,
]

/** The latest published issue — drives the landing cover. */
export const LATEST_ISSUE: IssueRecord = ALL_ISSUES[ALL_ISSUES.length - 1]

/** Lookup helper for /issues/:number routes. */
export function findIssue(number: string): IssueRecord | undefined {
  return ALL_ISSUES.find((i) => i.number === number)
}
