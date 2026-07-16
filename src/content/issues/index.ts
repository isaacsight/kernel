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
import { ISSUE_392 } from './392'
import { ISSUE_393 } from './393'
import { ISSUE_394 } from './394'
import { ISSUE_395 } from './395'
import { ISSUE_396 } from './396'
import { ISSUE_397 } from './397'
import { ISSUE_398 } from './398'
import { ISSUE_399 } from './399'
import { ISSUE_400 } from './400'
import { ISSUE_401 } from './401'
import { ISSUE_402 } from './402'
import { ISSUE_403 } from './403'
import { ISSUE_404 } from './404'
import { ISSUE_405 } from './405'
import { ISSUE_406 } from './406'
import { ISSUE_407 } from './407'
import { ISSUE_408 } from './408'
import { ISSUE_409 } from './409'
import { ISSUE_410 } from './410'
import { ISSUE_411 } from './411'
import { ISSUE_412 } from './412'
import { ISSUE_413 } from './413'
import { ISSUE_414 } from './414'
import { ISSUE_415 } from './415'
import { ISSUE_416 } from './416'
import { ISSUE_417 } from './417'
import { ISSUE_418 } from './418'
import { ISSUE_419 } from './419'
import { ISSUE_420 } from './420'
import { ISSUE_421 } from './421'
import { ISSUE_422 } from './422'
import { ISSUE_423 } from './423'

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

/** ─── colloquy ────────────────────────────────────────────────
 *  A two-voice dialogue — the editorial form for an argument that
 *  is carried by *two co-equal positions* rather than one author
 *  (essay), one subject-plus-interviewer (interview), a list of
 *  claims (forecast), a timed filing (dispatch), or a graded field
 *  (review). Where an interview has a hierarchy — the interviewer
 *  asks, the subject answers — a colloquy has none: two voices hold
 *  two stances and neither is the host.
 *
 *  Introduced ISSUE 398 (NO MORE QUESTIONS). The material was a
 *  recorded conversation; the magazine never reproduces private
 *  talk or attributes invented quotes to a real person, so the two
 *  voices are POSITIONS, not people — labelled by the stance they
 *  hold, written for the page, disclosed as such in the dossier.
 *  The form enacts the thesis: two-directional Q&A, staged as the
 *  question collapses into "show the work."
 *  ────────────────────────────────────────────────────────────── */

/** One of the two voices in a colloquy. Labelled by stance, not
 *  identity. `id` is referenced by each turn to attribute the line. */
export interface ColloquyVoice {
  /** Stable id referenced by each turn (e.g. 'asks', 'builds'). */
  id: string
  /** Short per-turn mark, uppercase (e.g. 'ASKS'). */
  label: string
  /** Legend label — Japanese (e.g. '問う者'). */
  labelJp: string
  /** One-line stance — the position this voice holds. */
  stance: string
}

/** A single line in the exchange. `voice` must match a
 *  ColloquyVoice id in the spread's `voices`. */
export interface ColloquyTurn {
  voice: string
  text: string
}

/** A named movement of the dialogue — a mono kicker heading over an
 *  ordered run of turns. Movements let the exchange build an arc
 *  the way an essay's sections do. */
export interface ColloquyMovement {
  heading: string
  headingJp?: string
  turns: ColloquyTurn[]
}

export interface ColloquySpread extends SpreadCommon {
  type: 'colloquy'
  /** The two voices in the exchange — exactly two, co-equal. */
  voices: [ColloquyVoice, ColloquyVoice]
  /** The dialogue, grouped into named movements. */
  movements: ColloquyMovement[]
  /** Optional "THE TERMS" dossier — reused from the essay toolkit;
   *  on a colloquy it doubles as the provenance disclosure. */
  dossier?: SpreadDossier
  /** Optional pull quote lifted from the exchange. */
  pullQuote?: SpreadPullQuote
}

/** ─── instrument ──────────────────────────────────────────────
 *  A calibrated control handed to the reader — the magazine's first
 *  interactive editorial tool. One fixed prompt; N stops on a dial;
 *  selecting a stop renders the same prompt answered at that depth,
 *  with a meter line (tokens · time · price). The form enacts the
 *  subject: intelligence as a per-request variable, not a property
 *  of the machine.
 *
 *  Introduced ISSUE 399 (HOW HARD TO THINK). Boundary decisions,
 *  ratified there: interaction (React state + CSS transitions) is
 *  permitted on the editorial surface; MOTION stays CSS-only within
 *  ambient amplitudes; all stops remain in the DOM and print media
 *  renders them stacked, so on paper the instrument becomes a table
 *  of depths. Meter readings must be labelled honestly when they are
 *  representative rather than measured — see `meterNote`.
 *  ────────────────────────────────────────────────────────────── */

/** One stop on the instrument's dial. */
export interface InstrumentStop {
  /** Stable id (e.g. 'low', 'max'). Referenced by `defaultStop`. */
  id: string
  /** Dial label, uppercase (e.g. 'LOW'). */
  label: string
  /** Single-glyph Japanese label under the dial stop (e.g. '低'). */
  labelJp?: string
  /** Meter line rendered under the answer at this stop. */
  reading: { tokens: string; time: string; price: string }
  /** One-line characterization of this depth (italic, under label). */
  note?: string
  /** The same prompt, answered at this stop's depth. */
  answer: string[]
}

export interface InstrumentSpread extends SpreadCommon {
  type: 'instrument'
  /** Optional spec dossier above the prose (reused essay module). */
  dossier?: SpreadDossier
  /** Prose sections before the instrument. */
  intro?: SpreadSection[]
  /** The fixed question every stop answers. */
  prompt: string
  promptJp?: string
  /** Accessible label for the dial radiogroup. Defaults to
   *  "Effort — how hard the machine thinks" (the 399/405 framing).
   *  Set it when the dial turns a different variable — e.g. register
   *  rather than effort (416). */
  dialLabel?: string
  /** The dial's stops, in order. */
  stops: InstrumentStop[]
  /** id of the initially selected stop. Defaults to the first. */
  defaultStop?: string
  /** Honesty note under the meter — e.g. "readings are
   *  representative of the effort curve, not a benchmark". */
  meterNote?: string
  /** Prose sections after the instrument. */
  outro?: SpreadSection[]
  pullQuote?: SpreadPullQuote
}

/** ─── compare ─────────────────────────────────────────────────
 *  A binary switch between two incommensurable framings of the same
 *  fact set — not depths on a spectrum (that is `instrument`'s job),
 *  but two irreducible lenses that cannot be blended into a middle
 *  position. There is no "medium" between two readings that are not
 *  points on a continuum.
 *
 *  Introduced ISSUE 406 (ONE DAY, TWO READINGS), the first story
 *  this magazine had that a Dial genuinely could not tell: whether a
 *  seven-issue press day was discipline or risk has no third answer
 *  between the two, so a five-stop dial would have had to invent
 *  positions that do not exist.
 *
 *  ARIA pattern: role="switch" (a true two-state toggle, native
 *  Enter/Space activation) — deliberately distinct from
 *  instrument's role="radiogroup" (N ordered positions needing
 *  arrow-key roving tabindex). The fact set is identical under both
 *  lenses; only each fact's reading changes — that identity of
 *  facts is what makes it a comparison rather than two unrelated
 *  answers. See docs/interaction-language.md rule 7: this is the
 *  first instance of this shape; no shared machinery is extracted
 *  until a second story needs the same control.
 *  ────────────────────────────────────────────────────────────── */

/** One of the two lenses in a comparison. Labelled by the stance it
 *  holds, not a neutral name — the reader should feel the two sides
 *  pulling in different directions. */
export interface CompareLens {
  /** Stable id referenced by defaultLens (e.g. 'speed', 'risk'). */
  id: string
  /** Toggle label, uppercase (e.g. 'SPEED'). */
  label: string
  /** Japanese label. */
  labelJp?: string
  /** One-line stance this lens holds — printed under the switch. */
  stance: string
}

/** One fact both lenses must address, with each lens's reading of
 *  it. The fact itself is neutral and identical under both lenses;
 *  only the readings differ. */
export interface CompareFactReading {
  /** The fact, stated neutrally — both lenses see the same event. */
  fact: string
  factJp?: string
  /** How lens A (lenses[0]) reads this fact. */
  readingA: string
  /** How lens B (lenses[1]) reads this fact. */
  readingB: string
}

export interface CompareSpread extends SpreadCommon {
  type: 'compare'
  /** The two lenses — exactly two, mutually exclusive. */
  lenses: [CompareLens, CompareLens]
  /** id of the initially active lens. Defaults to lenses[0]. */
  defaultLens?: string
  /** Standfirst prose before the switch. */
  intro?: SpreadSection[]
  /** The shared fact set, read differently under each lens. */
  facts: CompareFactReading[]
  /** Optional closing verdict, if the piece takes a stance. Leave
   *  undefined when the piece deliberately declines to resolve —
   *  the honest choice when both readings hold up under scrutiny. */
  verdict?: string
  outro?: SpreadSection[]
  pullQuote?: SpreadPullQuote
}

/** ─── sequence ──────────────────────────────────────────────────
 *  An ordered argument in discrete, complete stages — the reader
 *  advances through a real process rather than positions on one
 *  variable (Dial) or between two lenses (Switch). ARIA tablist:
 *  standard Tabs keyboard behaviour, any stage reachable any time
 *  (a reader inspecting a finished run may jump straight to the
 *  end) — the magazine does not invent a forward-locked variant of
 *  an established pattern. Introduced ISSUE 408; see
 *  docs/interaction-language.md for the full rule-by-rule case. */
export interface SequenceStage {
  /** Stable id, e.g. 'plan'. */
  id: string
  label: string
  labelJp?: string
  /** One-line standfirst for this stage, shown on the tab itself. */
  summary: string
  /** The fuller account — one paragraph per array entry. */
  detail: string[]
  /** A concrete, verifiable fact anchoring this stage — a real
   *  function name, file, test count, commit. Never invented for
   *  symmetry (interaction-language.md rule 6, applied to prose
   *  rather than a meter). */
  artifact?: string
}

/** One of the process's real, mutually exclusive terminal outcomes —
 *  rendered attached to the final stage, not reader-selectable
 *  (rule 4: every reachable state stays on the page; these are the
 *  process's own branches, not additional interaction). */
export interface SequenceOutcome {
  id: string
  label: string
  labelJp?: string
  condition: string
  result: string
}

export interface SequenceSpread extends SpreadCommon {
  type: 'sequence'
  dossier?: SpreadDossier
  intro?: SpreadSection[]
  /** The stages, in the order the real process runs them. */
  stages: SequenceStage[]
  /** id of the initially selected stage. Defaults to the first. */
  defaultStage?: string
  /** The process's real terminal branches, shown with the final
   *  stage's panel. Optional — not every sequence forks. */
  outcomes?: SequenceOutcome[]
  outro?: SpreadSection[]
  pullQuote?: SpreadPullQuote
}

/** ─── galley ────────────────────────────────────────────────────
 *  A text the reader marks up — N independent two-state strike/keep
 *  marks applied to the prose itself. The fourth interaction shape
 *  (ISSUE 410): not positions on one variable (Dial), not two
 *  lenses (Compare), not ordered stages (Sequence) — independent
 *  editorial marks on passages. ARIA: one toggle button per
 *  passage, `aria-pressed`, stable accessible name; struck text
 *  stays in the DOM and stays legible (manuscript strikethrough,
 *  never removal). The tally meters ONLY the reader's marks — a
 *  real count of real actions — and claims nothing about any
 *  internal state; marks are client-session state, unrecorded.
 *  See docs/interaction-language.md rule 7 for the birth case. */
export interface GalleyPassage {
  /** Stable id, e.g. 'p1'. */
  id: string
  /** The passage — one paragraph the reader may strike or keep. */
  text: string
}

export interface GalleySpread extends SpreadCommon {
  type: 'galley'
  dossier?: SpreadDossier
  intro?: SpreadSection[]
  /** Mono label above the markup text, e.g. 'THE GALLEY · 校正刷り'. */
  galleyKicker?: string
  /** The passages, in reading order. All default to kept. */
  passages: GalleyPassage[]
  /** Honesty note under the tally — mandatory equipment (rule 6):
   *  states exactly what the tally counts and that marks are
   *  unrecorded. */
  tallyNote: string
  outro?: SpreadSection[]
  pullQuote?: SpreadPullQuote
}

/** ─── tutor ─────────────────────────────────────────────────────
 *  The magazine's first spread whose purpose is capability, not
 *  claim: a manual that teaches the interaction language by having
 *  the reader OPERATE a stakes-free version of each shape (ISSUE
 *  411). Composes the four existing primitives (dial / switch /
 *  sequence / galley) into one teaching flow; per rule 7 it does
 *  NOT extract shared machinery from InstrumentFeature et al. — it
 *  reimplements minimal inline controls, because the tutor is
 *  instance one of a new story (teaching), not a generalisation of
 *  the old ones. Teach by CONSEQUENCE, never by grade: every
 *  control shows what the reader's choice produced, and nothing on
 *  the page is ever "wrong" — correctness of a keystroke would be
 *  honestly auditable (unlike 410's feeling), but the magazine
 *  refuses to grade the reader anyway. That refusal, beyond what
 *  rule 6 requires, is the issue's whole ethic. */
export interface TutorLessonCommon {
  id: string
  label: string
  labelJp?: string
  /** One line: what this shape is for. */
  teaches: string
  /** One paragraph before the practice control. */
  intro: string
  /** What operating the control reveals — teach by consequence,
   *  never by grade. Phrased to read true whether or not the reader
   *  has touched the control (rule 1: calm by default). */
  consequence: string
}
export interface TutorDialLesson extends TutorLessonCommon {
  shape: 'dial'
  prompt: string
  stops: { id: string; label: string; labelJp?: string; reading: string }[]
  defaultStop?: string
}
export interface TutorSwitchLesson extends TutorLessonCommon {
  shape: 'switch'
  lenses: [
    { id: string; label: string; labelJp?: string },
    { id: string; label: string; labelJp?: string },
  ]
  fact: string
  readingA: string
  readingB: string
  defaultLens?: string
}
export interface TutorSequenceLesson extends TutorLessonCommon {
  shape: 'sequence'
  stages: { id: string; label: string; labelJp?: string; detail: string }[]
  defaultStage?: string
}
export interface TutorGalleyLesson extends TutorLessonCommon {
  shape: 'galley'
  passages: { id: string; text: string }[]
  tallyNote: string
}
export type TutorLesson =
  | TutorDialLesson
  | TutorSwitchLesson
  | TutorSequenceLesson
  | TutorGalleyLesson

export interface TutorSpread extends SpreadCommon {
  type: 'tutor'
  dossier?: SpreadDossier
  intro?: SpreadSection[]
  /** The lessons, in teaching order — one operable control each. */
  lessons: TutorLesson[]
  outro?: SpreadSection[]
  pullQuote?: SpreadPullQuote
}

/** ─── margin ────────────────────────────────────────────────────
 *  A text with a writable margin — the fifth interaction primitive
 *  (ISSUE 412), and the first where the reader CONTRIBUTES content
 *  rather than choosing among author-provided states. Each passage
 *  carries an adjacent margin field; the reader annotates in their
 *  own words. Control: a native <textarea> per passage — the most
 *  established input pattern that exists (rule 5 by definition).
 *  The reader's notes are session-state only: nothing recorded,
 *  nothing sent, and — the new honesty duty this shape adds — the
 *  page must SAY PLAINLY that notes vanish on reload, so no reader
 *  mistakes an honest margin for a saving one (`marginNote` is
 *  mandatory equipment). Print keeps the reader's notes: you print
 *  your own annotated copy; empty margins print as ruled space a
 *  pencil can use. */
export interface MarginPassage {
  /** Stable id, e.g. 'm1'. */
  id: string
  /** The passage the margin sits beside. */
  text: string
}

export interface MarginSpread extends SpreadCommon {
  type: 'margin'
  dossier?: SpreadDossier
  intro?: SpreadSection[]
  /** Mono label above the annotated text, e.g. 'THE MARGIN · 余白'. */
  marginKicker?: string
  /** The passages, each with a writable margin beside it. */
  passages: MarginPassage[]
  /** Honesty note under the tally — mandatory (rule 6, extended):
   *  states what the tally counts, that notes are unrecorded and
   *  session-only, and that reloading erases them — copy out what
   *  you want to keep. */
  marginNote: string
  outro?: SpreadSection[]
  pullQuote?: SpreadPullQuote
}

/** ─── press ─────────────────────────────────────────────────────
 *  The composing instrument — the sixth interaction shape (ISSUE
 *  413) and the first ARTIFACT control: the reader operates the
 *  magazine's real production grammar (the actual stock cabinet,
 *  the actual nine ink seeds, the actual cover layouts, their own
 *  headline and seal) and a cover assembles live under their hands.
 *  Where every prior shape produced a READING, the press produces
 *  a THING — printable, theirs, unkept by us.
 *
 *  The law travels with the instruments: the choice sets ARE the
 *  cabinet, so a reader cannot compose an off-grammar cover — one
 *  spot color, two faces, POPEYE-safe seeds only, by construction
 *  rather than by validation. Controls: three radiogroups (stock /
 *  accent / layout) + labelled text inputs (headline lockup, seal,
 *  number) — all established patterns. Session-state only; print
 *  renders the reader's cover (the artifact leaves with them). */
export type PressLayout = 'classic' | 'monument-hero' | 'asymmetric-left'

export interface PressDefaults {
  stock: IssueStock
  /** A named seed from the Ink Cabinet (accents.ts). */
  accent: string
  layout: PressLayout
  /** The headline lockup the page loads with — rule 1: the
   *  untouched page shows a complete, composed cover. */
  prefix: string
  emphasis: string
  suffix: string
  /** Seal label; empty string = no seal (declining to stamp is a
   *  legitimate composition — see 373). */
  seal: string
  /** The reader's issue number, e.g. '001'. */
  number: string
}

export interface PressSpread extends SpreadCommon {
  type: 'press'
  dossier?: SpreadDossier
  intro?: SpreadSection[]
  /** Mono label above the instruments. */
  pressKicker?: string
  /** The composition the page loads with. */
  defaults: PressDefaults
  /** Honesty note under the colophon line — mandatory: selections
   *  are session-only, nothing recorded, print to keep the cover. */
  pressNote: string
  outro?: SpreadSection[]
  pullQuote?: SpreadPullQuote
}

/** Discriminated union — add new editorial tools here. */

/** ─── close ─────────────────────────────────────────────────────
 *  A feed with no natural end — the seventh interaction primitive
 *  (ISSUE 415). Demonstrates the social-media "removed stopping
 *  cue" mechanic: "Show me one more" and "I'll stop here" render as
 *  siblings at IDENTICAL visual weight from the very first item.
 *  The law: the stop is never demoted, hidden, shrunk, or delayed
 *  relative to "more," at any item count — enforced in the
 *  component via one shared CSS class, not just in copy, and
 *  covered by a regression test (see CloseFeature.test.tsx).
 *
 *  Each press of "more" appends the next line from `filler`
 *  (cycling) — deliberately flat and non-escalating so the demo
 *  cannot itself become compelling. A soft `cap` ends the demo
 *  automatically if the reader never presses stop; hitting the cap
 *  is part of the argument, not a hidden implementation limit. */
export interface CloseSpread extends SpreadCommon {
  type: 'close'
  dossier?: SpreadDossier
  intro?: SpreadSection[]
  closeKicker?: string
  /** Cycles on each "show me one more" press — deliberately flat,
   *  non-escalating, non-personalized. */
  filler: string[]
  /** Soft cap on items shown. Default 40 if omitted. */
  cap?: number
  /** Mandatory honesty note — states nothing is measured/stored,
   *  reload resets everything. */
  closeNote: string
  outro?: SpreadSection[]
  pullQuote?: SpreadPullQuote
}
/** ─── proof ─────────────────────────────────────────────────────
 *  The correction pass — the eighth interaction shape (ISSUE 417)
 *  and the cabinet's act of ADJUDICATION: a machine has completed
 *  a draft screen before the reader arrived, and the reader's
 *  remaining act is judgment, line by line — KEEP MACHINE / TAKE
 *  THE HAND / STRIKE. Decisions compose live into a resolved
 *  screen and a provenance ledger (N machine · N hand · N struck).
 *  Completes the print-shop line the cabinet already speaks:
 *  galley (410, raw type) → proof (417, the correction pass) →
 *  press (413, the composing).
 *  Rule-6 doubled: the ledger counts only the reader's marks
 *  (session-only, unrecorded — `ledgerNote` mandatory), and the
 *  machine lines are REAL local-model output, never hand-edited,
 *  disclosed in `machineNote` and filed in the audit. Rule 1: all
 *  lines default to KEEP MACHINE — untouched, the page shows the
 *  machine's finished screen. Rule 4: all three versions of every
 *  line stay in the DOM; print stacks them. ARIA: one three-radio
 *  radiogroup per line. */
export interface ProofLine {
  /** Stable id, e.g. 'p1'. */
  id: string
  /** The screen slot, e.g. 'HEADLINE', 'PRIMARY ACTION'. */
  slot: string
  slotJp?: string
  /** Real machine output — never hand-edited (rule 6). */
  machine: string
  /** The house rewrite — the warm/specific counter-voice. */
  hand: string
}

export interface ProofSpread extends SpreadCommon {
  type: 'proof'
  dossier?: SpreadDossier
  intro?: SpreadSection[]
  /** Mono label above the proof, e.g. 'THE PROOF · 校正刷り'. */
  proofKicker?: string
  /** The machine's draft screen, in slot order. All default to
   *  KEEP MACHINE. */
  lines: ProofLine[]
  /** Honesty note under the ledger (rule 6, mandatory): what the
   *  ledger counts, that marks are session-only and unrecorded. */
  ledgerNote: string
  /** Provenance disclosure (rule 6, mandatory): which real model
   *  drafted the lines, where it ran, where raw output is filed. */
  machineNote: string
  outro?: SpreadSection[]
  pullQuote?: SpreadPullQuote
}

/** ─── day ───────────────────────────────────────────────────────
 *  An authored metropolitan day carrying delegation moments — the
 *  ninth interaction shape (ISSUE 418), and the first whose axis
 *  is TIME LIVED rather than a variable, a text, or an artifact.
 *  Nine time-stamped moments, 06:10 → 00:40, each an ambient city
 *  vignette with one calibrated two-state control: LET IT RIDE /
 *  STEP IN. Rule 4 is load-bearing here: BOTH authored consequences
 *  are printed and stay legible at all times — the reader's mark
 *  selects which one is theirs, it never hides the other. The
 *  ledger at midnight meters ONLY real reader actions (marks,
 *  changes of mind, the session clock — the 415 precedent); moment
 *  copy and attention costs are authored representative composites,
 *  disclosed in the dossier. Marks are session-state only, nothing
 *  recorded, nothing sent — `ledgerNote` is mandatory equipment
 *  (rule 6). ARIA: one radiogroup per moment, two radio buttons.
 *  See docs/interaction-language.md for the birth entry. */
export interface DayMoment {
  /** Stable id, e.g. 'd1'. */
  id: string
  /** Clock time, 24h, e.g. '07:42'. */
  time: string
  /** Mono label, e.g. 'THE REROUTE'. */
  label: string
  labelJp?: string
  /** Which ambient vignette the moment renders inside. */
  vignette: 'kettle' | 'train' | 'crosswalk' | 'desk' | 'market' | 'window'
  /** The city + what the agent just did on your behalf. */
  situation: string
  /** Authored consequence if the reader lets it ride. */
  ride: string
  /** Authored consequence if the reader steps in. */
  stepIn: string
  /** The attention toll of stepping in, e.g. '+6 MIN OF YOUR
   *  ATTENTION' — authored, representative, disclosed. */
  cost: string
}

export interface DaySpread extends SpreadCommon {
  type: 'day'
  dossier?: SpreadDossier
  intro?: SpreadSection[]
  /** Mono label above the day, e.g. 'THE DAY · 一日'. */
  dayKicker?: string
  /** The delegation moments, in clock order. */
  moments: DayMoment[]
  /** Mandatory honesty note under the ledger (rule 6): what the
   *  ledger counts, that marks are session-only and unrecorded,
   *  and that the moments themselves are authored composites. */
  ledgerNote: string
  /** Works-cited block — the behavioral-science file. */
  references?: SpreadReferences
  outro?: SpreadSection[]
  pullQuote?: SpreadPullQuote
}

/** ─── plate ────────────────────────────────────────────────────
 *  The tenth interaction shape (ISSUE 419) — the WORKING MODEL:
 *  an operable miniature of an external system, built in-house,
 *  running live inside a framed plate on the page. The reader
 *  arranges the model's blocks, pulls the proof, and watches the
 *  model's own signal move — the first shape whose subject is a
 *  MECHANISM rather than a text, a process, or a day.
 *
 *  Honesty apparatus (rule 6, doubled again after 417):
 *  - `plateNote` is MANDATORY: the model is a simulation drawn
 *    in-house — nothing on the plate is generated by the product
 *    being modeled; the ledger counts only the reader's actions,
 *    session-only, unrecorded.
 *  - Every drawn proof carries its SEED on the artwork. The
 *    drawing algorithm is deterministic from that seed, so any
 *    state the reader ever saw can be re-drawn from its printed
 *    number — reproducibility standing in where "all states in
 *    the DOM" cannot literally hold for generative frames
 *    (the rule-4 amendment argued in 419's header and ratified
 *    in docs/interaction-language.md).
 */
export interface PlateBlock {
  /** Stable id, e.g. 'b1'. */
  id: string
  /** Mono label, e.g. 'BLOCK 01 · TEXT'. */
  label: string
  labelJp?: string
  /** What the block holds: a fixed prompt, or a drawn proof. */
  kind: 'text' | 'image' | 'video'
  /** For text blocks — the model's input, verbatim on the plate. */
  prompt?: string
  /** For image/video blocks — REAL model names the block may draw
   *  from (real products of the system being modeled; the drawing
   *  itself is still the house simulation, per plateNote). */
  models?: string[]
  /** Initial position, percent of the stage (0–100 each axis). */
  x: number
  y: number
}

/** A wire between two blocks — intent flows from → to. */
export interface PlateWire {
  from: string
  to: string
}

/** A numbered catalog row in the galley register — the artifact
 *  composition's entries (01 THE SHEET · 紙面 · body …). */
export interface PlateCatalogEntry {
  n: string
  en: string
  jp?: string
  body: string
}

export interface PlateSpread extends SpreadCommon {
  type: 'plate'
  /** Rendering grammar for proof canvases. The default preserves
   *  419's botanical engravings; routing renders expert fields. */
  proofStyle?: 'botanical' | 'routing'
  dossier?: SpreadDossier
  intro?: SpreadSection[]
  /** Monument headline, stacked — the galley register's header.
   *  When set, replaces the plain title rendering; the last line
   *  takes the issue accent. */
  titleLines?: string[]
  /** The stockroom strip — model names drifting in a CSS-only
   *  ticker (weather; reduced-motion and print still it). */
  ticker?: string[]
  tickerLabel?: string
  /** Numbered catalog rows, rendered after the plate. */
  catalog?: PlateCatalogEntry[]
  catalogKicker?: string
  /** Mono label above the plate, e.g. 'PLATE No.1 — WORKING MODEL · 作動模型'. */
  plateKicker?: string
  /** Operating hint printed under the kicker. */
  plateHint?: string
  /** FIG. caption under the plate. */
  plateCaption?: string
  /** The model's blocks, wires between them. */
  blocks: PlateBlock[]
  wires: PlateWire[]
  /** Run-control labels, e.g. '★ PULL THE PROOF' / '★ PULL AGAIN — 再校'. */
  runLabel: string
  runAgainLabel?: string
  /** Mandatory honesty note (rule 6): the simulation disclosure +
   *  what the ledger counts + the seed-reproducibility promise. */
  plateNote: string
  outro?: SpreadSection[]
  pullQuote?: SpreadPullQuote
  references?: SpreadReferences
}

/** ─── bore ─────────────────────────────────────────────────────
 *  The eleventh interaction shape (ISSUE 420) — the DEPTH control:
 *  a probe lowered stratum by stratum through a mechanism's
 *  interior on a gauge rail. Born from its reservation when the
 *  editor promoted CORE SAMPLE No.1 (the artifact that
 *  demonstrated it) to the issue of record. Complies with the
 *  depth doctrine (docs/artifact-language.md §III): a named axis
 *  with a real gauge; CARRIED CONTEXT (the picked-up sort re-inks
 *  the strata below); a floor that resolves; emphasis-never-
 *  existence (every stratum and all three answers legible at
 *  rest — the probe raises into the accent, never conjures); one
 *  honestly-geared traversal control (a button on a winch).
 *  Inherits the plate's rule-3 working-model exception: script
 *  moves the probe and paints the plates inside the bore frame
 *  only, timer-robust, reduced-motion collapsed. */
export interface BoreStratumMeta {
  /** Gauge stop label, e.g. '0m' or '−3'. */
  gauge: string
  /** Gauge stop JP gloss, e.g. '表層'. */
  gaugeJp?: string
  /** Stratum head label, e.g. 'STRATUM −1 · THE TYPE CASE'. */
  label: string
  labelJp?: string
  /** FIG. caption under the stratum. */
  caption: string
}

/** One temperature stop of the sampling stratum. */
export interface BoreTempStop {
  id: string
  /** Control label, e.g. 'WARM · 温'. */
  label: string
  /** Candidate continuations with authored shares (disclosed
   *  representative — never measured). Exactly one is drawn. */
  candidates: { word: string; share: number; drawn?: boolean }[]
  /** The authored answer that surfaces at this temperature. */
  answer: string
}

export interface BoreSpread extends SpreadCommon {
  type: 'bore'
  /** Monument headline lines (galley register), last line accented. */
  titleLines?: string[]
  dossier?: SpreadDossier
  intro?: SpreadSection[]
  boreKicker?: string
  boreHint?: string
  /** The surface question, verbatim. */
  prompt: string
  /** The prompt broken into sorts, in order. */
  sorts: string[]
  /** Which sort is carried at rest. */
  defaultCarried: string
  /** Authored companions per sort, drawn near it in the
   *  constellation stratum (disclosed representative). */
  neighbors: Record<string, string[]>
  /** The sampling stratum's temperature stops. */
  tempStops: BoreTempStop[]
  defaultTemp: string
  /** Exactly six strata: surface, type case, constellation,
   *  loom, dice, return. */
  strata: BoreStratumMeta[]
  runLabel: string
  winchLabel: string
  /** On-surface disclosure for the candidates (rule 6). */
  candidatesNote: string
  /** Mandatory honesty note: what the ledger counts, that the
   *  strata are drawn (nothing run), seeds printed. */
  boreNote: string
  outro?: SpreadSection[]
  pullQuote?: SpreadPullQuote
  references?: SpreadReferences
}

export interface FourierSpread extends SpreadCommon {
  type: 'fourier'
  titleLines?: string[]
  dossier: SpreadDossier
  intro?: SpreadSection[]
  fourierKicker?: string
  fourierHint?: string
  defaultWaveform: 'sine' | 'sawtooth' | 'square' | 'triangle'
  defaultHarmonicsCount: number
  defaultInharmonicity: number
  fourierNote: string
  outro?: SpreadSection[]
  pullQuote?: SpreadPullQuote
  references?: SpreadReferences
}

export interface AuditChannel {
  key: string
  label: string
  jp: string
}

/**
 * ISSUE 422 — the SESSION control, and the first MERGER issue
 * (artifact-language §I as amended: apparatus whole, no reduction).
 * The reader's own attention is the axis: a treasury of strata
 * where every meter counts the reader's hands and dwell, and the
 * floor reconciles declared against revealed. Kept by no one.
 */
export interface AuditSpread extends SpreadCommon {
  type: 'audit'
  titleLines?: string[]
  dossier: SpreadDossier
  /** The authored flat deck the Wealth wades and the Zone deals from. */
  deckItems: string[]
  /** The claim, word-scrubbed: authored lead, then the attributed quote. */
  claimLead: string
  claimQuote: string
  claimCite: string
  /** The five channels of the hundred-unit declared budget. */
  channels: AuditChannel[]
  /** Mandatory disclosure: session-only, unrecorded, reload erases. */
  auditNote: string
  pullQuote?: SpreadPullQuote
  references?: SpreadReferences
}

export type IssueSpread =
  | EssaySpread
  | InterviewSpread
  | ForecastSpread
  | DispatchSpread
  | ReviewSpread
  | ColloquySpread
  | InstrumentSpread
  | CompareSpread
  | SequenceSpread
  | GalleySpread
  | TutorSpread
  | MarginSpread
  | PressSpread
  | CloseSpread
  | ProofSpread
  | DaySpread
  | PlateSpread
  | BoreSpread
  | FourierSpread
  | AuditSpread

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
  /** 'full-stop' — a single heavy period, bleeding off the bottom
   *  edge of the cover. The most literal possible image for what
   *  ISSUE 415 (the close primitive) hands the reader: an ending.
   *  Renders under .pop-cover--ornament-full-stop. Introduced 415. */
  | 'full-stop'

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
  /** Optional shorter standfirst for the cover. The full headline swash
   *  remains available to the feature, while the cover keeps its poster
   *  rhythm on small screens. */
  coverDeck?: string
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
  /** Optional provenance audit — the "audit as monument" colophon
   *  (THE AUDIT). When present, the issue renders a ColophonMonument
   *  at its foot: the production receipt, staged as the showpiece. */
  audit?: IssueAudit
}

/** The provenance audit staged as a designed artifact. Every row is a
 *  true claim about how the issue was made — render only the rows
 *  provided; never fabricate. An honest magazine's audit must be true. */
export interface IssueAudit {
  /** Who/what drafted it, e.g. 'magazine-editor · japanese-editor'. */
  drafted?: string
  /** What was verified, e.g. 'critic — 7 claims, 7 cited'. */
  verified?: string
  /** Design-grammar adherence, e.g. '0 raw hex · design-system layer'. */
  adherence?: string
  /** Words kept vs cut, e.g. '2,400 kept · 900 cut'. */
  readCut?: string
  /** When it was pressed, e.g. 'V·26 · build 3b3598a'. */
  pressed?: string
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
  ISSUE_392,
  ISSUE_393,
  ISSUE_394,
  ISSUE_395,
  ISSUE_396,
  ISSUE_397,
  ISSUE_398,
  ISSUE_399,
  ISSUE_400,
  ISSUE_401,
  ISSUE_402,
  ISSUE_403,
  ISSUE_404,
  ISSUE_405,
  ISSUE_406,
  ISSUE_407,
  ISSUE_408,
  ISSUE_409,
  ISSUE_410,
  ISSUE_411,
  ISSUE_412,
  ISSUE_413,
  ISSUE_414,
  ISSUE_415,
  ISSUE_416,
  ISSUE_417,
  ISSUE_418,
  ISSUE_419,
  ISSUE_420,
  ISSUE_421,
  ISSUE_422,
  ISSUE_423,
]

/** The latest published issue — drives the landing cover. */
export const LATEST_ISSUE: IssueRecord = ALL_ISSUES[ALL_ISSUES.length - 1]

/** Lookup helper for /issues/:number routes. */
export function findIssue(number: string): IssueRecord | undefined {
  return ALL_ISSUES.find((i) => i.number === number)
}
