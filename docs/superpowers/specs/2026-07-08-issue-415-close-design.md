# ISSUE 415 — STOP PRESS · a `close` spread

_Design record. 2026-07-08. Approved by Isaac in session._
_JP gloss for the feature lockup not yet finalized — draft with a
native check during the copy pass, don't ship a guessed translation._

## Thesis

Every feed the reader has ever used removed one thing on purpose: the
point where it tells you to stop. Social platforms optimize for
engagement via variable-ratio reward, removed stopping cues, social
validation loops, engagement-ranked feeds, streaks, notification
badges, and network-effect obligation — none of which kernel.chat's
six shipped primitives (instrument, compare, sequence, galley, margin,
press) use anywhere, by design. `close` is the seventh primitive and
makes that absence explicit: a feed with no natural end, until the
reader gives it one. The reader is handed the one thing real feeds
withhold — a stop, exactly as easy to find on item one as item forty.

## Identity (per PUBLISHING.md §III)

| Field | Value | Rationale |
|---|---|---|
| number | `415` | one past LATEST_ISSUE (414) |
| feature | `STOP PRESS` | double reading: the print-journalism term for an urgent late insertion, and literally "press [the] stop" |
| spread.type | `close` (**new** — seventh primitive) | names the tool handed to the reader (an ending), not the target being critiqued ("feed") |
| coverStock | `ink` | archival/manifesto/nocturnal — matches this issue's critical register (same stock 371 used for its dark dispatch) |
| accent | `oxblood` | documented fit note is literally "endings" |
| coverLayout | `monument-hero` | issue number IS the cover art — rhymes with the piece's own live-incrementing counter, now fixed and monumental |
| coverOrnament | `full-stop` (**new**) — single heavy period, bleeding off-center | the most literal possible image for what this issue hands the reader |
| audit | drafted in a claude-sonnet-5 Claude Code session | provenance, stamped in the colophon monument per house discipline |

## The mechanic

`Show me one more` (repeatable) and `I'll stop here` (one-time,
terminal) render as siblings at identical visual weight from the very
first item — **the law**: the stop is never demoted, hidden, shrunk,
or delayed relative to "more," at any item count. That's enforced in
the component (shared CSS class, no count-keyed styling), not just in
copy, and is covered by a regression test.

Each press of "more" appends the next line from a fixed, cycling
`filler` array — deliberately flat, non-escalating, non-personalized,
so the demo can't itself become compelling:

> "A photograph of a stranger's dinner." · "A headline written to make
> you feel something before you've read it." · "An update from someone
> you forgot you followed." · "A video that started before you decided
> to watch it." · "A number telling you how many people liked something
> you haven't read yet." · "One more thing, and then one more thing
> after that."

A live readout (item count + `M:SS`) runs the whole time — the number
every real feed keeps and never shows you. A soft `cap` (default 40)
ends it automatically if the reader never presses stop; hitting the
cap is part of the argument, not a hidden implementation limit ("we
stopped this for you — a real feed wouldn't"). Either ending renders a
receipt: items seen, time spent, which way it ended.

**Content shape:** intro states the thesis directly before the
instrument appears, unexplained until after. `dossier` repurposed as a
mechanism rap-sheet — one honest line each on the seven engagement
mechanics named in the thesis, no jargon. `outro` does the "kernel.chat
vs. a real feed" contrast in prose (finite, numbered, dated — issue
415 of a thing that ends) and cites Reuters Graphics' reusable
named-primitive component library and The Pudding's "does this earn
its place" test (both surfaced in this session's interaction-
engineering research) as documented external precedent, not house
idiosyncrasy. `closeNote` (mandatory): *"Nothing above is measured,
stored, or sent anywhere. Reload and it forgets you completely. This
is the number every feed keeps and never shows you — and the stop you
were never offered a reason to take."*

## Data shape (`src/content/issues/index.ts`)

```ts
export interface CloseSpread extends SpreadCommon {
  type: 'close'
  dossier?: SpreadDossier
  intro?: SpreadSection[]
  closeKicker?: string
  filler: string[]
  cap?: number // default 40
  closeNote: string
  outro?: SpreadSection[]
  pullQuote?: SpreadPullQuote
}
```

Add `CloseSpread` to the `IssueSpread` union.

## Component — boundary decisions

- **Interaction ≠ motion.** `useState` for `itemsShown`, `stopped`,
  `reason: 'voluntary' | 'capped' | null`. No motion library; any
  per-item fade-in is CSS-only and respects `prefers-reduced-motion`.
- **Loads with 1 item already present and the clock already running**
  (rule 1: the untouched page shows a complete state, never empty).
- **`aria-live="polite"` only on the receipt transition** — the
  per-second counter is a plain text update, not announced, to avoid
  spamming screen readers every tick.
- **All state stays client-side, session-only** — no network calls,
  no persistence, matching every other primitive.
- **Print** always renders the receipt — final if stopped/capped, an
  honest in-progress snapshot otherwise ("N items, M:SS, at print
  time") — never the live buttons. Same print-shows-the-outcome
  pattern as `press`/`margin`/`galley`.
- Router `case 'close'`; add `close: 'oxblood'` to
  `DEFAULT_ACCENT_BY_SPREAD` (both required by exhaustiveness checks).
- New `IssueCoverOrnament` union member: `'full-stop'`.

## Verification

tsc + build clean · unit tests: initial render (1 item, both controls
present, identical class/attributes), press-more increments + cycles
filler, press-stop → receipt(`voluntary`), reaching `cap` → receipt
(`capped`) under fake timers, `aria-live` fires exactly once (on
transition, never per tick). **Law test:** assert both buttons share
identical classes/attributes at item counts 1, 20, and 39, so no
future edit can quietly de-emphasize the stop as the count climbs.
Playwright: click through to both endings, keyboard-only pass, mobile
390px, print-emulation (receipt only, no live controls), zero console
errors. Commit on branch → ff-merge main → deploy only on Isaac's go.
