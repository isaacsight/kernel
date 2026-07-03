# ISSUE 399 — HOW HARD TO THINK · an `instrument` spread

_Design record. 2026-07-03. Approved by Isaac in session._

## Thesis

With Fable-class models, intelligence stopped being a property of the
machine and became a variable of the request. Thinking is always on;
the only control left is depth (`effort`, low→max). The issue's
argument IS the dial, and the reader operates it: one fixed question,
five stops, the same question answered at each depth, with a meter.

## Identity (per PUBLISHING.md §III)

| Field | Value | Rationale |
|---|---|---|
| number | `399` | one past LATEST_ISSUE (398) |
| feature | `HOW HARD TO THINK` / 思考の深さ | pairs with 396 (THE PRICE OF THINKING): 396 priced it, 399 measures it |
| spread.type | `instrument` (**new**) | a calibrated control handed to the reader; named generically for reuse |
| coverStock | `ivory` | lab-bench white — instruments read on a bench |
| accent | `pool` | systems/terminal; identity distinct from 396 via stock+format+layout |
| coverLayout | `classic` | the cover stays still; the instrument lives inside |
| coverSeal | `CALIBRATED · FIVE STOPS` · VII·26 | the cover stamps the calibration |
| audit | drafted by a claude-fable-5 session | true provenance, stamped in the colophon monument |

## The mechanic

Five stops: LOW 低 · MEDIUM 中 · HIGH 高 · XHIGH 超 · MAX 極.
Fixed prompt drawn from the house's own operational history (the
two-deployers-overwrite bug — which recurred the morning this issue
was set: manual deploy raced the CI deploy). Each stop renders a
characteristic answer + a meter line (tokens · time · price).

**Honesty rule:** meter readings are representative of the effort
curve, not a benchmark run — the spread says so in print (`meterNote`).
The magazine never fabricates a measurement, so it labels an
illustration as one. MAX's answer concludes the dial did not need to
be at max for this question — the instrument critiques itself.

## Data shape (`src/content/issues/index.ts`)

```ts
interface InstrumentStop {
  id: string; label: string; labelJp?: string
  reading: { tokens: string; time: string; price: string }
  note?: string
  answer: string[]
}
interface InstrumentSpread extends SpreadCommon {
  type: 'instrument'
  dossier?: SpreadDossier
  intro?: SpreadSection[]
  prompt: string; promptJp?: string
  stops: InstrumentStop[]
  defaultStop?: string        // 'high' — the API's own default
  meterNote?: string
  outro?: SpreadSection[]
  pullQuote?: SpreadPullQuote
}
```

## Component — first interactive spread; boundary decisions

- **Interaction ≠ motion.** `useState` active stop. Dial =
  `role="radiogroup"` of `role="radio"` buttons; 44px targets;
  ArrowLeft/Right moves selection + focus; `aria-checked`.
- **Editorial motion contract holds:** answer swap is a CSS opacity
  fade within ambient amplitudes; site-wide `prefers-reduced-motion`
  override collapses it. No motion/react, no rAF.
- **All five panels stay in the DOM**; inactive ones hidden by class.
  `@media print` shows all stacked — on paper the instrument becomes
  a table of depths.
- Router `case 'instrument'`; `DEFAULT_ACCENT_BY_SPREAD.instrument
  = 'pool'` (both demanded by exhaustiveness checks).

## Verification

tsc + build clean · Playwright: click every stop (answer + meter
swap), keyboard-drive the radiogroup, mobile 390px, print-emulation
(all stops stacked), zero console errors. Commit on branch →
ff-merge main → deploy only on Isaac's go.
