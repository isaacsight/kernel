# ISSUE 398 — NO MORE QUESTIONS · a `colloquy` spread

_Design record. 2026-07-03._

## Thesis

When the machine answers before you finish asking, the question stops
being the work — the proof becomes the work. In the AI era a claim
that were true "would already have happened," so value migrates from
*asking the right question* to *demonstrating the built thing*. The
human moat is the artifact and the audit.

## Source & ethics

Drawn from a real ~2h18m recorded conversation (2026-07-02). It is
mined for ideas, **not** reproduced. Per PUBLISHING.md §III.2 the
magazine never attributes invented or private quotes to a real
person. Therefore:

- The two speakers become **positions, not people** — no real names.
- No line is a transcript; every line is written for the page.
- The provenance is disclosed on the page itself (the dossier row
  `SOURCE: A RECORDED CONVERSATION · NAMES REMOVED`), consistent with
  the magazine's audit-in-public habit.

## Identity (per PUBLISHING.md §III)

| Field | Value | Rationale |
|---|---|---|
| number | `398` | one past LATEST_ISSUE (397) |
| feature | `NO MORE QUESTIONS` / 問いはもう無い | the thesis, stated flat |
| spread.type | `colloquy` (**new**) | two co-equal voices; the form is the argument |
| coverStock | `ink` | nocturnal, manifesto weight — a long night's argument about an ending |
| accent | `oxblood` | "endings, memory" — the end of the question; a red that pops on ink |
| coverLayout | `asymmetric-left` | two-column dialogue rhythm, not a centered monument |
| coverSeal | `ON TAPE · NAMES REMOVED` · VII·26 | literalizes provenance; reuses the existing seal component |
| kicker | `THE COLLOQUY · 問答` | 問答 (mondō) = question-and-answer / dialogue |

## The two voices

- **ASKS** (問う者) — reality, evidence, the fixed value. *"If it were
  true, it would already have happened."*
- **BUILDS** (作る者) — potential, choice, the made thing. *"You can
  just build things. It depends."*

Neither is the hero. The dramatic engine: ASKS interrogates, BUILDS
deflects, and across five movements the questions thin until the last
one is not a question at all — it is a dare to show the work.

## Arc — five movements

1. **The fixed point** (定点 · VALUE) — is anything non-negotiable?
2. **It would already have happened** (既に起きている · EVIDENCE) — why the machine collapses the question
3. **Portfolio or silence** (実績か沈黙か · RECORD) — credential vs. evidence; potential as the only sellable asset
4. **The floor** (底 · LEVERAGE) — capability without runway; who gets to be "delusional"
5. **What's left** (残るもの · MAKING) — the questions run out; only the built thing answers

Plus a `dossier` ("THE TERMS", doubling as provenance), one
`pullQuote`, and the `街のコーダーたちへ` signoff.

## The new `colloquy` spread type

### Data shape (`src/content/issues/index.ts`)

```ts
export interface ColloquyVoice {
  id: string        // stable id referenced by each turn ('asks' | 'builds')
  label: string     // short per-turn mark, uppercase ('ASKS')
  labelJp: string   // legend label ('問う者')
  stance: string    // one-line position
}
export interface ColloquyTurn {
  voice: string     // matches a ColloquyVoice id
  text: string
}
export interface ColloquyMovement {
  heading: string
  headingJp?: string
  turns: ColloquyTurn[]
}
export interface ColloquySpread extends SpreadCommon {
  type: 'colloquy'
  voices: [ColloquyVoice, ColloquyVoice]  // exactly two
  movements: ColloquyMovement[]
  dossier?: SpreadDossier                 // reused — "THE TERMS"
  pullQuote?: SpreadPullQuote             // reused
}
```

`ColloquySpread` joins the `IssueSpread` union.

### Component (`src/components/ColloquyFeature.{tsx,css}`)

Mirrors `InterviewFeature`. Structure:

- centered header (kicker / title / titleJp / deck / byline)
- optional `dossier` card — "THE TERMS", methods-paper rows
- a two-item **voices legend** rendered from `spread.voices`
  (label + labelJp + stance, each with an accent/ink swatch)
- **movements**: mono heading + JP, then a run of **turns** —
  grid `[label | text]`; voice A's mark takes the issue accent,
  voice B's the coffee tone; a subtle left rule differentiates B
- optional `pullQuote`
- signoff + issue monument

Ink-stock inversions mirror `InterviewFeature.css` (ivory on
near-black, flipped rules and cards).

### Router (`src/components/IssueFeature.tsx`)

Add `case 'colloquy': return <ColloquyFeature ... />`. The existing
`never` exhaustiveness check guarantees nothing is missed.

### Docs

Add the `colloquy` row to PUBLISHING.md §III.2, update the §IV
template reference, and bump the "Last updated" line to 398.

## Verification

`npx tsc --noEmit` clean · `npm run build` clean · preview `/issues/398`
and `/` (new LATEST) and mobile ≤640px. **No deploy without Isaac's
go** — deploy is outward-facing.
