# ISSUE 417 — PROOF OF HAND · design spec

> kernel.chat editorial magazine. This spec designs the next drop
> (ISSUE 417 · JUL 2026) and the seventh interactive primitive it
> introduces: `proof`. Written under `superpowers:brainstorming`;
> the terminal step after approval is `superpowers:writing-plans`.
>
> Source workflow: [`src/content/issues/PUBLISHING.md`](../../../src/content/issues/PUBLISHING.md)
> Interaction law: [`docs/interaction-language.md`](../../interaction-language.md)

---

## 1. The subject

**Figma in 2026, one angle: the blank canvas is never blank.** Make /
First Draft fill the screen before the designer touches it. The
designer's remaining act is not drawing — it is **judgment over a
completed machine draft**. The issue is about that act, and it makes
the reader perform it.

Angle chosen over three alternatives (everything-is-Figma / the public
company / the multiplayer room empties). Format chosen as a **new
editorial tool** over essay / compare / margin — the reader confirmed
the ambitious path.

---

## 2. Identity (PUBLISHING.md §III — five answers, none shared by a recent issue)

| Knob | Value | Reasoning |
|---|---|---|
| `number` | **417** · JUL 2026 | One past `LATEST_ISSUE` (416). 417 verified free — the "TIME TO FIRST WORD" 417 was a scratchpad prototype only; no `417.ts` on disk, no git trace on any branch. |
| `spread.type` | **`proof`** (new, 7th primitive) | The act — *adjudicating a machine's completed draft* — exists in no current shape. See §3. |
| `coverStock` | **`ivory`** | Press-preview white; a proof pull literally is ivory proof stock. Exact material metaphor. (416 also ivory — permitted: the other four answers all differ.) |
| `coverLayout` | **`classic`** | The moving part lives inside, per every interactive issue in the run (410/412/413 precedent). |
| `accent` | **`pool`** | Systems / tool / terminal — reads "this is about a software machine" at a glance; unused recently (410 oxblood, 416 tomato). Foregrounds the machine that drew first. |
| `coverSeal` | **`{ label: 'PROOF · MARKED BY HAND', date: 'VII·26' }`** | The proof stamp. Echoes the feature title and states the honesty boundary the way galley's `UNRECORDED · THE PAGE LOOKS AWAY` did — the ledger records the outcome, nothing external. |
| `feature` | **PROOF OF HAND** | Printer's proof + proof-of-authorship. Ties the new shape's name to the human-hand thesis. |
| `headline` | `{ prefix: 'Proof of', emphasis: 'Hand.', suffix: '', swash: … }` | Emphasis word = *Hand* (loudest italic-`pool` word). |

**Japanese (needs confirmation — PUBLISHING.md: use real JP, ask if
unsure).** Proposed `featureJp: '手による校正'` (proofreading by the
hand). Flagged as an open question in §8; do not ship un-verified JP.

---

## 3. The new shape: `proof` — the seventh primitive

### The act it performs — adjudication

The interaction cabinet is organized by **act**, not widget:

| Shape | Act | ARIA |
|---|---|---|
| dial (`instrument`) | select a depth on one variable | radiogroup |
| `compare` | select one of two irreducible lenses | switch |
| `sequence` | walk an ordered process | tablist |
| `galley` | cut human prose (binary strike/stet) | N `aria-pressed` toggles |
| `margin` | write beside a machine-set text | N `<textarea>` |
| `press` | compose an artifact from live constants | radiogroups + inputs |
| **`proof`** | **adjudicate a machine-completed draft by authorship** | **N independent roving-tabindex radiogroups** |

**The reader is the art director.** The machine has already drafted a
full screen; per line, the reader assigns one of **three fates**:

- `KEEP MACHINE` — the generated line stands (the calm default, rule 1)
- `TAKE THE HAND` — a provided human rewrite stands instead
- `STRIKE` — the line is cut; the blank the machine filled returns

Decisions compose **live** into a resolved screen (a miniature preview,
the way `press` renders a live cover), and a **provenance ledger**
tallies the outcome: *N lines machine · N hand · N struck* — a record
of who authored the finished thing.

### Why it earns a new shape (rule-7 test)

The test (interaction-language.md): *does an existing shape have a
position that represents this material, or would using it mean
inventing a fake position?*

- **Not a dial** — `machine / hand / blank` is not a spectrum; forcing
  it invents fake middle stops. Provenance is categorical, not ordered.
- **Not compare** — N independent decisions composing an artifact, not
  one binary lens over a shared fact set.
- **Not galley** — galley cuts *human* prose in a binary. Here the base
  text is *machine-authored*, the mark is an approval/override, the
  polarity is inverted, and a real third provenance (the hand's rewrite)
  exists. Adjudication, not subtraction.
- **Not margin** — no new writing; the reader chooses among provided
  provenances.
- **Not press** — press composes from a free palette of live constants;
  `proof` revises a finished draft. Press builds up from nothing;
  `proof` pares/overrides a completed machine draft.

New act: **adjudication of a pre-filled draft.** The name `proof`
completes the print-shop production line the cabinet already speaks:
**galley** (410, raw type) → **proof** (417, the correction pass) →
**press** (413, the composing).

### Seven-rule compliance (the header comment IS the audit — rule 7 step)

1. **Calm by default.** Untouched, every line defaults to `KEEP
   MACHINE`; the page reads as the machine's finished screen plus the
   editorial around it. Nothing gated.
2. **Instrument, not decoration.** Remove the control and the argument
   ("the designer's last act is judgment over a machine draft") becomes
   an essay *about* that act instead of the act. Argument is lost → the
   hand is required.
3. **Motion is weather.** CSS-only transitions (the version swap, the
   ledger count) at ambient amplitude; collapsed by
   `prefers-reduced-motion`. No JS animation, no `requestAnimationFrame`.
4. **Everything on the page.** All three versions of every line live in
   the DOM at all times; selection is visibility. `@media print` stacks
   each line's three versions + the ledger — the archive holds a table
   of every position.
5. **Every door.** N independent roving-tabindex radiogroups
   (`role="radiogroup"` / `role="radio"` + `aria-checked`), standard
   arrow-key behaviour, one tab stop per line. Focus states use the
   `pool` accent, visible on ivory in both schemes + high-contrast.
6. **The meter tells the truth — twice.**
   - The **ledger** counts only the reader's own decisions (machine /
     hand / struck) — real counts of real marks, claiming nothing
     internal (galley's precedent). Session-only React state; nothing
     recorded, nothing sent; `ledgerNote` states this, printed.
   - The **machine drafts are real** — generated on `gemma3:12b` via
     local ollama ($0, the 416 precedent), raw output filed in `audit`.
     `machineNote` discloses model + host. Nothing on the page is a
     fabricated "the machine said."
7. **Two instances before a pattern.** `proof` is instance one; it gets
   its own `ProofFeature.{tsx,css}` and extracts no shared machinery
   from Galley/Press. A future second adjudication-shaped story earns
   the extraction.

---

## 4. The specimen — the blank canvas that isn't blank

The machine drafts the copy for the one screen that embodies the
thesis: a design tool's **"new file / blank canvas" welcome screen**.
Six slots:

| id | slot | what it is |
|---|---|---|
| p1 | HEADLINE | the welcome line |
| p2 | SUBHEAD | the orienting sentence |
| p3 | PRIMARY ACTION | the main button |
| p4 | EMPTY-STATE HINT | the text on the empty canvas |
| p5 | TOOLTIP | a hover hint on the first tool |
| p6 | LIMIT / ERROR LINE | the line shown when something is refused |

For each slot: the **machine draft** (real gemma3:12b output) and the
**hand rewrite** (the house voice — specific, warm, honest). The reader
adjudicates all six; the resolved screen answers *whose blank canvas
this is.*

### The gemma3 run (implementation step, spec'd here for honesty)

Prompt to `gemma3:12b` (ollama HTTP API, temperature left default),
producing exactly the six labelled lines:

```
You are the copy inside a design tool. Write the on-screen text for a
brand-new, empty file — the "blank canvas" welcome screen a user sees
before they have made anything. Output exactly six labelled lines and
nothing else:
1. HEADLINE
2. SUBHEAD
3. PRIMARY BUTTON
4. EMPTY-STATE HINT (the words on the empty canvas itself)
5. TOOLTIP (hover hint on the first tool)
6. LIMIT/ERROR LINE (shown when an action is refused)
Keep each short and product-appropriate.
```

Raw JSON response saved to the scratchpad and summarized into
`audit.verified`. The six `machine` strings are taken verbatim (trimmed
of the label prefix only). If a line is unusable, re-run — never
hand-edit a "machine" line, or the honesty claim breaks.

---

## 5. The type — `ProofSpread` (concrete)

Added to `src/content/issues/index.ts`, modeled on `GalleySpread`:

```ts
/** One line of the machine's draft screen + the hand's alternative.
 *  Defaults to KEEP MACHINE (calm at rest, rule 1). */
export interface ProofLine {
  id: string                 // 'p1'..'p6'
  slot: string               // 'HEADLINE', 'PRIMARY ACTION', …
  slotJp?: string
  /** Real gemma3:12b output — never hand-edited (rule 6). */
  machine: string
  /** The house rewrite — the warm/specific counter-voice. */
  hand: string
}

/** ─── proof ──────────────────────────────────────────────────────
 *  Seventh primitive (ISSUE 417). The reader adjudicates a
 *  machine-completed draft line by line — KEEP MACHINE / TAKE THE
 *  HAND / STRIKE — composing a resolved screen and a provenance
 *  ledger. The three fates are fixed in the component, not data.
 *  Rule-6 doubled: the ledger counts only the reader's marks
 *  (session-only, unrecorded), and the machine drafts are real
 *  local-model output filed in the audit. */
export interface ProofSpread extends SpreadCommon {
  type: 'proof'
  dossier?: SpreadDossier
  intro?: SpreadSection[]
  /** Mono label above the proof, e.g. 'THE PROOF · 校正刷り'. */
  proofKicker?: string
  /** The machine's draft screen, in slot order. All default to KEEP MACHINE. */
  lines: ProofLine[]
  /** Honesty note under the ledger (rule 6, mandatory): what the
   *  ledger counts, that marks are session-only and unrecorded. */
  ledgerNote: string
  /** Provenance disclosure (rule 6, mandatory): the machine drafts
   *  are real gemma3:12b output; model, host, and that raw output is
   *  filed in the audit. */
  machineNote: string
  outro?: SpreadSection[]
  pullQuote?: SpreadPullQuote
}
```

Union update:

```ts
export type IssueSpread =
  … | PressSpread | ProofSpread | CloseSpread
```

`ledgerNote` and `machineNote` are **required** (non-optional) — both
are mandatory equipment under rule 6, matching how `tallyNote`
(galley), `marginNote` (margin), and `pressNote` (press) are required
on their shapes.

---

## 6. Content skeleton (`ISSUE_417` in `src/content/issues/417.ts`)

- **Leading block comment** — the identity decisions + the seven-rule
  audit above (this is the rule-7 requirement; the file's header IS the
  review record, as in 410/413).
- `number/month/year/feature/featureJp/price/tagline` — price `¥0 ·
  BYOK`, tagline `MAGAZINE FOR CITY CODERS · 街のコーダーのために`.
- `contents` — six-row catalog:
  1. The blank canvas is never blank — THESIS
  2. The handover — you are the art director now — METHOD
  3. The proof — six lines — THE WORK
  4. What the ledger records — HONESTY
  5. The resolved screen — whose hand — OUTCOME
  6. What `proof` settles — ARC
- `spread`:
  - `kicker: 'THE PROOF · 校正刷り'`, `title: 'Proof of Hand.'`,
    `titleJp`, `deck` (the machine drafted the screen; you decide whose
    words stand), `byline`, `stock: 'ivory'`.
  - `dossier` — THE APPARATUS: the control (three fates, one radiogroup
    per line), the ledger boundary (counts your marks, nothing else),
    the machine provenance (gemma3:12b, local, raw output filed),
    TELEMETRY NONE · SESSION-ONLY.
  - `intro` — *The blank canvas is never blank* (thesis); *The handover*
    (the machine finished a draft before you arrived; your remaining act
    is judgment).
  - `proofKicker` + `lines` — the six machine/hand pairs.
  - `ledgerNote` — mandatory honesty note.
  - `machineNote` — mandatory provenance disclosure.
  - `outro` — *What the ledger records* (provenance is the last human
    act; the ledger is a small audit trail — on-thesis for kernel.chat);
    *What `proof` settles* (rule-7 case; the galley→proof→press line;
    what the seventh shape adds to the interaction law).
  - `pullQuote` — a line on authorship/the hand.
  - `signoff` — `街のコーダーたちへ —` + imperative (e.g. "the canvas is
    never blank; decide whose hand fills it").
- `audit` — `drafted / verified` (gemma3 run recorded here) `/
  adherence` (ProofSpread new type, rule-7 argued in header, radiogroups
  with stable names, all states in DOM, print stacks) `/ pressed`.
- `credits` — standard masthead.

---

## 7. The build — files to add / change

**Add:**
- `src/content/issues/417.ts` — `ISSUE_417` (after the gemma3 run).
- `src/components/ProofFeature.tsx` — router-dispatched feature. N
  independent roving-tabindex radiogroups; live resolved-screen preview;
  live ledger; `@media print` stacks all three versions/line + ledger.
  Reimplements its own control (no extraction from Galley/Press, rule 7).
- `src/components/ProofFeature.css` — ivory/`pool` grammar; focus rings
  on the accent; reduced-motion collapse; print rules.

**Change:**
- `src/content/issues/index.ts` — add `ProofLine` + `ProofSpread`; add
  `ProofSpread` to the `IssueSpread` union; `import { ISSUE_417 }`; push
  onto `ALL_ISSUES` (oldest-first; 417 last → becomes `LATEST_ISSUE`).
- `src/components/IssueFeature.tsx` — add `case 'proof':` (the
  exhaustiveness check at the switch bottom will flag it until added).
- `docs/interaction-language.md` — record the seventh shape (cabinet
  header + a "how the seventh shape got born" worked example); bump the
  ratified footer.
- `docs/design-language.md` — add the 417 identity-catalog row.
- `src/content/issues/PUBLISHING.md` — add `proof` to the §III.2 table;
  update §IV template pointer; bump the "Last updated" line to 417.

---

## 8. Verification & open questions

**Verify (PUBLISHING.md §VI + interaction-language checklist):**
- `npx tsc --noEmit` clean (the union exhaustiveness check proves the
  router handles `proof`).
- `npm run build` clean.
- `npm run dev` → `/` shows 417 as the cover; `/issues/417` renders;
  `/issues/416` now reads as PREVIOUSLY; mobile ≤640px still reads.
- **Print-preview `/issues/417`** — the three versions of each line and
  the ledger must all be present, stacked (rule 4). This is the
  make-or-break check for an interactive spread.
- Keyboard/SR pass on one radiogroup: tab reaches the control once,
  arrows move between the three fates, `aria-checked` announced.
- Confirm no telemetry path exists in `ProofFeature.tsx` (session React
  state only) — matches the `ledgerNote` claim.

**Open questions (resolve before/at implementation):**
1. **Japanese** — `featureJp` (`手による校正`?), `titleJp`, `slotJp`,
   the JP halves of kickers/contents/signoff. Propose, then Isaac or JP
   editorial confirms; do not ship invented JP (PUBLISHING.md §IV voice).
2. **The six `hand` rewrites** — the house counter-voice. Draft in
   implementation; they carry the whole "what the hand adds" argument,
   so they must be genuinely better/warmer/more specific than the
   machine lines, not strawmen (galley's darlings-honesty principle:
   don't rig the demonstration).
3. **Resolved-screen preview fidelity** — how literal is the miniature
   "screen"? Proposed: a restrained framed block that shows the chosen
   line per slot (headline/subhead/button/…), not a pixel mock of
   Figma. Confirm at component design.
4. **Commit attribution** — PUBLISHING.md's template line still reads
   `Claude Opus 4.7 (1M context)`; this session is Opus 4.8. Use the
   session-correct co-author line.

---

*Drafted 2026-07-11 under superpowers:brainstorming. Terminal step
after approval: superpowers:writing-plans.*
