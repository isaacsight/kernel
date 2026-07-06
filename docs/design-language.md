# Design Language — kernel.chat

> An editorial homage to **POPEYE Magazine** (Tokyo, Magazine House Co.).
>
> The site itself never names this inspiration. This document is for
> contributors so the design system stays coherent across future pages
> and issues.

---

## Why POPEYE

POPEYE — *Magazine for City Boys* — is a 50-year-old Japanese style
magazine. Its design grammar is one of the most disciplined editorial
systems in print: warm paper stocks, a single spot color (tomato red),
bracketed kicker categories, numbered catalogs, bilingual JP/Latin
lockups, and a confident feature monument on every cover.

We borrowed all of that.

The thought experiment that shaped the redesign:

> *What would a POPEYE × kernel.chat collab issue look like if Magazine
> House let the kbot terminal write the field reports?*

Answer: warm editorial frame around a quiet utility core. Loud cover,
quiet command line. Bilingual everywhere. Tomato as the only spot
color. Every release is **ISSUE N · MONTH YEAR** — like a magazine
back-catalog, not a changelog.

The site never says "POPEYE." The grammar carries the homage on its own.

---

## Editorial neighbours

POPEYE is the spine. Around it we keep a working file of **editorial
neighbours** — magazines whose mechanics we want to learn from
without imitating. Each entry below is a quick decode (what makes
the cover read as that magazine) plus a short list of transferable
mechanics (what we could borrow without it reading as homage to a
second magazine on top of POPEYE). This section grows as we
encounter new references; future entries follow the same shape.

### PAPERSKY

PAPERSKY (Tokyo, 2002–present, founded by
Lucas Badtke-Berkow / Knee High Media — rebranded as PAPERSKY Inc.
in 2024) is a quieter cross-reference. Self-described as **"a
different way to travel,"** it runs roughly quarterly, bilingual
JP/EN, anchored each issue to a single place — most issues built
around a walking, hiking or cycling route through it. The
SHIMANAMI issue (#69 "Dreamy") is built around the Setouchi
Shimanami Kaido, the ~70 km route from Onomichi (Hiroshima) to
Imabari (Ehime) across the Seto Inland Sea.

We do not want to look like PAPERSKY — its serene white-bordered
single-photo cover is so identifiably PAPERSKY that direct mimicry
would read as homage to a second magazine on top of the first.
What we want from it is a **small set of mechanics** the POPEYE
grammar doesn't already give us.

#### The PAPERSKY cover, decoded

| Element | What it does | Notes |
|---|---|---|
| Single full-bleed photograph in natural light | Functions as the cover headline; no cover lines compete with it | Available light, candid, place-led. Editorial brief, not layout rule |
| Generous white border around the photo | Reads as gallery print, not magazine bleed | Margin, not bleed |
| Sans-serif white wordmark set high, modest scale | Stable masthead across every issue | Geometric sans, all-caps, tight tracking |
| All-caps Latin subtitle ("A DIFFERENT WAY TO TRAVEL") | Stable tagline under the wordmark | Tracked tight |
| Custom JP display lettering for the issue's place name | Per-issue signature gesture | Hand-drawn or commissioned per issue — never a system font |
| Paper-airplane glyph below the place word | Recurring folio / wayfinding mark | The "paper" + "sky" rebus, used as a small system element |
| Centred place dateline at the bottom (e.g. "HIROSHIMA & EHIME") | Postmark, not subtitle | Small-caps Latin |

#### Transferable mechanics

Things kernel.chat could borrow without copying the silence:

1. **Per-issue custom display lettering for the topic word**, paired
   with the stable Latin wordmark — gives every issue an identity
   without breaking the masthead. Our equivalent is the
   `headline.emphasis` italic-tomato word; the move PAPERSKY suggests
   is occasionally commissioning a hand-drawn JP word for
   `featureJp` or for the cover's secondary lockup, instead of
   defaulting to the body type.
2. **A small recurring glyph as a system folio mark** — PAPERSKY
   uses a paper airplane. We could reserve a single mark (a tomato
   spot, a kernel, a caret, a block-quote bracket) and use it
   consistently as the cover/section/page-number ornament. We
   already have `<PopIcon>` infrastructure for this; the discipline
   we lack is using **one** glyph as a system thread, not eleven.
3. **Centred place / topic dateline as postmark** — small-caps Latin
   anchored at the bottom centre of the cover, separate from the
   monument. Could co-exist with the existing bottom-right monument
   on `classic` layout, or replace it on a future `postmark` cover
   variant.
4. **One-photo cover with a real margin** — for the rare future
   issue where photography is the right voice (a place dispatch, a
   field report, a maker profile). Resist cover lines; let the
   image be the headline. We have not shipped this yet — would
   need a new `coverLayout: 'photo-postmark'` variant.
5. **Photographic register rule** — when we do use photography,
   commit to natural light, place-led, candid, no studio gloss.
   This is a brief to photographers, not a CSS rule.
6. **Issue-as-place** — anchor each issue to one subject (a route,
   a problem, a maker, a fish) rather than a mixed bag. We already
   do this; PAPERSKY confirms the discipline.

#### What's PAPERSKY-distinctive vs widely shared

The bilingual parallel text and the place-anchored issue concept
are **table stakes** in the JP indie ecosystem (POPEYE, &Premium,
Brutus, Subsequence). The **distinctive** PAPERSKY moves are the
per-issue custom JP display word, the paper-airplane folio glyph,
the postmark dateline, and the disciplined white margin around a
single quiet hero image. Borrow the mechanics; do not borrow the
silence — kernel.chat has a louder voice.

#### What PAPERSKY adds that POPEYE doesn't

POPEYE is dense, urban, catalog-led — a packed magazine for city
boys. PAPERSKY is spare, place-led, slow — a quiet magazine for
travellers. Seven things the second has that the first doesn't,
ranked by usefulness to kernel.chat:

1. **Restraint as a tool.** ★ POPEYE packs the cover. PAPERSKY
   shows what one big photograph and a real white margin can carry.
   The discipline of *not* putting things on the cover is itself a
   design move. We tend toward POPEYE's density; banking a single
   restraint move per year (one quiet cover among the loud ones)
   would extend our range.
2. **A single recurring system glyph.** ★ POPEYE's identity is the
   wordmark plus the layout grammar; it has no small graphic
   shorthand that travels across cover, section openers, and page
   numbers. PAPERSKY's paper-airplane does. We have `<PopIcon>`
   infrastructure for this — what we lack is the discipline to
   reserve **one** mark as a system thread instead of using eleven.
3. **Per-issue commissioned display lettering.** POPEYE's
   typography is largely systemized (a confident type lockup is the
   brand). PAPERSKY commissions a unique JP display word per place.
   A different relationship to type: bespoke per issue, not a font
   choice. For us this could mean occasionally hand-drawing the
   `featureJp` word rather than setting it.
4. **Place-and-route as issue spine.** ★ POPEYE is *theme-and-
   catalog* ("Italy," "Long Stays," "Reading"). PAPERSKY is
   *place-and-route* (Shimanami built around the cycling road, not
   "the cycling issue"). The structure is geographic and kinetic.
   Every kernel.chat issue could ask: *what is the route through
   this subject?* — not just *what is this subject?*
5. **Full bilingual parallel text.** POPEYE is JP-primary with
   selective Latin display. PAPERSKY runs JP/EN side by side. A
   different commitment to readership. We are EN-primary with
   selective JP — the inverse of POPEYE — so PAPERSKY's mode would
   be a stretch but not a reversal.
6. **The postmark grammar.** ★ POPEYE plants a monument number
   bottom-right. PAPERSKY plants a centred place dateline at the
   bottom — geography, not serial time. A future `coverLayout:
   'postmark'` variant could let an issue ground itself in subject
   rather than serial position.
7. **Slowness as a position.** POPEYE is monthly; PAPERSKY is
   quarterly. The cadence itself is a design decision the reader
   can feel. We publish more like POPEYE — fast, frequent — but
   could mark certain issues as *slow* (no dispatch energy, longer
   form, fewer items in the catalog) to use cadence as a tool the
   way PAPERSKY does.

★ marks the four most useful for kernel.chat: **restraint**,
**single-glyph system thread**, **place-and-route structure**,
**postmark dateline**. Adopt these first; the others are
optional.

**Status of the four** (current run, IV·26):

| Mechanic | First exercised | Status |
|---|---|---|
| Restraint (earned quiet cover) | 370 | In active use across 370, 372, 373 |
| Single-glyph system thread (★) | 370 | Ratified — three surfaces (cover dateline, frame masthead, frame footer) |
| Place-and-route structure | 370 (seven stakes) | Re-exercised in 375 (six borrows) at the references layer |
| Postmark dateline | **372** (ROOM 503 · IV·26) | First fired this drop. The fourth chamber, no longer unfired |

### WIRED

WIRED (San Francisco, 1993–present, Condé Nast) is the second
editorial neighbour the magazine reads from. Where PAPERSKY is
the quiet field-trip register, WIRED is the **data-journalism**
register: charts as headlines, fact-boxes as paragraphs, and
footnoted methodology as the editorial value-add. We do not want
to look like WIRED — its cover language (high-saturation acid
yellow + caps-locked single-word headlines + glitch type) is so
specifically WIRED that direct mimicry would read as a third
homage on top of POPEYE × PAPERSKY. What we want is a **small
set of mechanics** that POPEYE and PAPERSKY don't already give
us, drawn from WIRED's discipline at the data layer.

#### The WIRED feature, decoded

| Element | What it does | Notes |
|---|---|---|
| Inline fact-box callouts (mid-paragraph) | Pulls a number out of running prose into a typeset card readers scan first | Tabular nums, tracked tight, accent-rule above |
| Footnoted methodology, set in the same point size as the body | Treats the method as part of the text, not as a back-of-book appendix | Footnote markers in tomato spot, not page-marginal |
| Numbered sources at the foot of long features | Publishes the working bibliography inline, not as a credit page | Author surname + year or arXiv id, never bare URLs |
| Pull-quote with the number, not the sentence | When a feature turns on a measurement, the pull-quote *is* the measurement | "8.8×" sized as the pull-quote, source line below |
| "Methods" sidebar adjacent to the headline | The credibility lives next to the claim, not behind it | Shorter than the lede; longer than the standfirst |

#### Transferable mechanics

Things kernel.chat could borrow without copying the cover voice:

1. **The methods sidebar adjacent to the claim**, not at the end.
   When an issue turns on a measurement (374's `8.8× / 13.9× /
   19.7×`, 372's `670 → 105`), the method sits next to the
   number. We have `EssaySpread.dataBlock` infrastructure for
   this; the discipline we lack is *placing* the data block
   adjacent to the headline rather than after the closing.
2. **Numbered references at the foot of every long feature.**
   PAPERSKY footnotes places. WIRED footnotes papers and
   measurements. We started this in 375 (THE SIX BORROWS) with
   a `references` block credit page; the next move is making
   it standard for any feature whose argument cites a paper,
   benchmark, or external source.
3. **Pull-quote with the number, not the sentence.** When the
   feature is methodologically driven, the quote should be the
   measurement, the unit, and the source line — not the most
   quotable English. Exercised quietly in 374; codify going
   forward.
4. **Footnote markers in tomato spot, set inline.** Tiny lift
   from cover to body: the asterisk is already our system
   glyph; admitting tomato-tinted superscript markers
   (`¹ ² ³`) for in-text footnotes joins the system glyph
   discipline to the footnote discipline. Not yet shipped.

These four sit alongside the four PAPERSKY-starred mechanics.
The two neighbours together give the magazine a complete
working register: PAPERSKY for the quiet-field, WIRED for the
data-grounded. Most issues need neither set fully exercised;
the catalog is for when an issue's subject calls for them.

### Korean lifestyle — Magazine B & AROUND

POPEYE and PAPERSKY are the Japanese spine. The third register is
**Korean** — and it is a *neighbour, not a costume*. We do not add
hanbok motifs or a Korean "theme"; we borrow a small set of mechanics
the way we did from PAPERSKY, for issues whose subject is Seoul, slow
living, craft, or the Asia work the masthead is actually doing.

Two magazines decoded:

- **매거진 B (Magazine B)** — Seoul, single-brand documentary
  monthly. Globally respected for *documentary minimalism*: one
  subject, exhaustively, in restrained type and generous white. The
  transferable move is **subject-as-spine** — closer to WIRED's rigor
  than POPEYE's catalog density, but warmer.
- **어라운드 (AROUND)** — Seoul slow-living magazine. Warm, essayistic,
  hangul-forward, muted-natural palette. The transferable move is
  **여백 (yeobaek) — negative space as the primary tool.** Where
  PAPERSKY banks restraint on the cover, AROUND runs it through the
  whole spread: slower rhythm, more air, fewer marks per page.

The Korean kit (use only when the subject calls for it):

1. **여백 (yeobaek) — negative space.** ★ The Korean cousin of
   PAPERSKY's restraint, but applied to the *interior*, not just the
   cover. A yeobaek spread runs at lower density — wider margins,
   more line-leading, longer pauses between sections. The aesthetic
   of the **달항아리 (moon jar)**: value in what is left empty.
2. **Celadon accent — 청자 / 비색.** The Goryeo celadon glaze, a muted
   grey-jade, is in the cabinet as the `celadon` ink seed
   (`accents.ts`). The Korean neighbour to tomato: never loud, the
   colour of restraint itself.
3. **Hanji paper register.** 한지 (mulberry paper) is warm, fibrous,
   natural — the Korean cousin of the `cream`/`kraft` stocks. Reserved
   as a planned stock (`hanji`); until built, `cream` carries the
   register.
4. **A hangul subtitle layer.** POPEYE-grammar runs JP subtitles
   (`featureJp`, the `街のコーダーたちへ` signoff). A Korean-subject
   issue can carry the **hangul** parallel — e.g. the signoff
   `거리의 코더들에게` ("to the city coders"). Planned as a `featureKr`
   field; the bilingual layer becomes trilingual only when earned.

What we explicitly do **not** do: add a third Latin display face for
hangul (the two-face rule holds — hangul renders in the CJK fallback,
as JP already does, and would be upgraded with a single shared CJK
webfont like Pretendard if ever declared), or theme an issue "Korean"
as decoration. The register is earned by subject, the way PAPERSKY's
place-grammar is.

> Why this is in the file at all: the masthead's real work is moving
> into Asia (Seoul). The grammar should be able to speak in that room
> without abandoning POPEYE — the room is different, the job is the
> same.

---

## Issue identity catalog

> **Principle.** Every issue has its own identity. Every issue
> carries its own set of design decisions, catalogued here.
> Continuity does not come from uniformity — it comes from
> documented per-issue choices that future issues can reach
> for, vary against, or refuse on purpose.

The catalog below is the run's working memory. Each row is one
issue's identity sheet: what stock, what layout, what ornament,
what accent, what mechanics it exercised, what new vocabulary
it introduced. Adding a new issue means adding a row.

The author-notes block at the top of each `src/content/issues/<n>.ts`
file is the long version. This table is the index.

| # | Stock | Layout | Ornament | Seal / Postmark | Accent | Spread | Mechanics exercised | New to the design language |
|---|---|---|---|---|---|---|---|---|
| 360 | cream | classic | — | — | tomato | — | The anchor identity | first issue |
| 361 | butter | classic | — | — | tomato | — | Summer reading register | `butter` stock signal |
| 362 | cream | classic | — | — | tomato | — | Vacation / quiet | — |
| 363 | cream | classic | — | — | tomato | — | Style register | — |
| 364 | cream | classic | — | seal: FORECAST | cobalt | forecast | First forecast spread; cobalt accent | `forecast` spread type, `cobalt` ink seed |
| 365 | kraft | classic | — | — | tomato | — | Craft register | `kraft` stock signal |
| 366 | cream | classic | ink-spread | — | tomato | dispatch | Ornament debut | `ink-spread` ornament, `dispatch` spread type |
| 367 | ivory | classic | — | seal: SIEVE | cobalt | essay | First sieve / preselection essay | `ivory` stock register |
| 368 | cream | asymmetric-left | — | — | tomato | essay | First Anthropic-Labs profile | `asymmetric-left` layout |
| 369 | cream | classic | warty-spots | seal: SHEDD · IV·26 | brick | dispatch | Specimen ornament | `warty-spots` ornament, `brick` ink seed |
| 370 | cream | monument-hero | — | seal: FORECAST · IV·26 | tomato | forecast | **Restraint** ★ + **single-glyph thread (★)** ★ + **place-and-route** ★ — three of four PAPERSKY mechanics ratified | `monument-hero` layout, the asterisk (★) as system glyph |
| 371 | ink | asymmetric-left | flash-burn | seal: AFTER HOURS · APR 2026 | tomato | essay | Cinematographer profile; flash ornament | `ink` stock, `flash-burn` ornament |
| **372** | **ledger** | **ledger-rule** | — | **postmark: ROOM 503 · IV·26** | **graphite** | essay | **Postmark dateline ★** — the unfired fourth PAPERSKY mechanic, fired here | `ledger` stock, `ledger-rule` layout, `graphite` ink seed, `coverPostmark` field |
| 373 | cream | asymmetric-left | — | — | tomato | essay | Editorial-neighbours framework applied at the AI-tools layer; restraint by absence | first under-decorated cover (no ornament + no seal + no accent override) |
| 374 | ivory | classic | **asterisk-stamp** | — | tomato | essay | Numbers-with-methodology piece; first WIRED-mechanic exercise (methods sidebar adjacent to claim) | `asterisk-stamp` ornament |
| 375 | cream | **numbered-catalog** | — | seal: CREDITED · SIX BORROWS | tomato | essay | Place-and-route at the references layer; first **dossier** + **references** spread elements (WIRED's methods + numbered references mechanics) | `numbered-catalog` layout, `dossier` spread element, `references` block as credit page |
| 376 | ivory | classic | — | seal: FILED · STANDARDS · IV·26 | tomato | essay | First WIRED `references` block exercised at full strength as a craft mechanic (seven cited sources at the foot of a 1,500-word spread); confirms 374's ivory + classic + sober register as a repeatable editorial pattern, not a one-off | first issue where the WIRED `references` mechanic does load-bearing editorial work (the route is paper → adoption → local example) |
| 377 | ivory | classic | — | seal: FILED · API TIER · IV·26 | tomato | essay | Second consecutive issue exercising the WIRED `references` block (after 376); ratifies the ivory + classic + sober-register pattern as repeatable. Subject is the convergence — not either company. Zero kbot pitch. | first issue where the WIRED `references` block fires twice in a row, turning the mechanic from one-off into the magazine's standard move for data-led pieces |
| 407 | ivory | classic | — | seal: AUDITED · THE READER'S HAND · VII·26 | amethyst | essay | Retrospective auditing the 399/403/405/406 interactivity arc; `dossier` catalogs the two built shapes (Dial, Switch) + the one reserved (Sequence); `references` block self-cites the four source issues + interaction-language.md, turning the WIRED self-citation mechanic on the magazine's own archive; names in the body the drafting temptation to build a needless fifth interactive spread and why it was refused | first issue whose subject is the magazine's own interaction law rather than an external event or feature |
| 408 | cream | classic | — | seal: BOUNDED · NOT SILENT · VII·26 | pool | sequence | First Sequence — the third interactive shape, reserved since interaction-language.md's first draft; five ordered stages (plan/act/observe/reflect/decide) over kbot's real engineering loop, each stage carrying a verified code artifact, forking to three real exits (success/budget/handback) at the final stage | `sequence` spread type (ARIA tablist/tab/tabpanel); ninth editorial tool; ARIA pattern intentionally allows jumping to any stage (reader reviews a finished run, not a live one) |
| 409 | ink | asymmetric-left | — | seal: ON THE RECORD · ONE VOICE HUMAN · VII·26 | cobalt | colloquy | Second colloquy — ratifies the two-voice form as a pattern (rule-7 economy, the 376→377 move); argues the one question the interaction law leaves open (can a control carry feeling honestly) and ships with ZERO interaction so the form stays neutral — the refusal is the device; dossier carries measured panel token counts (909 + 1,656, $0) and the two-instance engagement-gate evidence | first issue whose source conversation is disclosed as human × machine (ONE VOICE HUMAN); first issue where the absence of interaction is the stated signature move |
| 410 | kraft | classic | — | seal: UNRECORDED · THE PAGE LOOKS AWAY · VII·26 | oxblood | galley (new) | Fourth interactive shape — Galley: N independent aria-pressed strike/stet marks on the prose itself; the reader performs the house discipline (count what gets read; cut what doesn't) on nine passages, four written as darlings on purpose (recorded in author notes, chosen blind); the tally meters only the marks (words kept, passages struck), claims nothing internal; marks unrecorded, session-only, stated in print — FEELS's experiment from 409, run under KNOWS's constraints | `galley` spread type; tenth editorial tool; rule-6 precedent: feeling as side effect of honest work, never a measured target |
| 411 | butter | classic | — | seal: NO GRADE · ONLY CONSEQUENCE · VII·26 | amethyst | tutor (new) | First Tutor — the manual for the interaction grammar; the reader operates a stakes-free version of all four shapes (dial/switch/sequence/galley) in one spread and becomes literate in the language every future interactive spread uses; teach by consequence, never by grade — no control is ever "wrong"; composes the four primitives with minimal inline controls, no machinery extracted (rule 7); closes the loop open since 399 (built a language, finally taught it) | `tutor` spread type; eleventh editorial tool; first spread whose purpose is capability not claim; rule-6 refusal: declines a correctness meter the rules would permit |
| 412 | cream | classic | — | seal: THE MARGIN IS YOURS · VII·26 | coffee | margin (new) | Fifth interaction primitive — Margin: the first contribution control; six passages on marginalia (Fermat's too-narrow margin, scribal complaints, Coleridge, the commonplace book, the surveilled digital margin), each with a ruled margin the reader writes into in their own words; reader's notes in mono against machine-set serif; tally counts notes + words only (counted, never read); notes session-only, reload erases, stated in print with the remedy (copy out what you keep) | `margin` spread type; twelfth editorial tool; the writing rung — watching→choosing→walking→editing→learning→WRITING; rule-6 extension: never let the reader believe you keep what you don't |

★ marks an issue that ratified a PAPERSKY-starred mechanic into
active service. Three are now ratified across the run; the
asterisk in the row marker is the magazine's own bookkeeping.

### How to add a row

When publishing a new issue:

1. Build the issue file at `src/content/issues/<n>.ts` — author
   notes at top explain the identity decisions in long form.
2. Add a row to the catalog above with the issue's identity at
   a glance.
3. If the issue introduces new design vocabulary (a stock, a
   layout, an ornament, an accent seed, a spread element, a
   mechanic), document the introduction in the row's
   "New to the design language" column AND extend the relevant
   type union (`IssueStock`, `IssueCoverLayout`,
   `IssueCoverOrnament`, etc.).
4. If the issue exercises a previously-unfired starred mechanic,
   mark the row with ★ and note the ratification.

### What this catalog is not

It is not a style enforcement table. Two issues with `cream` +
`classic` are not interchangeable; the difference is in the
spread, the prose, the headline, and the ornament-or-absence-of.
The catalog records *which surface decisions an issue made* so
the next issue can choose against the run with eyes open. The
discipline is the same as the editorial-neighbours framework:
collect the references, decode them, borrow without imitating,
make the next thing distinctly itself.

---

## The system

### Tokens (`src/index.css:118-150`)

**Stocks** — warm paper grounds:
- `--pop-ivory` `#FAF9F6` — primary white ground
- `--pop-cream` `#F3E9D2` — warm secondary stock
- `--pop-butter` `#EFD9A0` — summer / reading issue stock
- `--pop-sepia` `#D4C5A9` — muted accent
- `--pop-kraft` `#C8A97E` — camel / outdoor issue
- `--pop-coffee` `#6B4E3D` — warm brown text
- `--pop-ink` `#1F1E1D` — primary dark ground
- `--pop-ledger` (introduced 372) — pale graph-ruled accountant's
  paper. Audit register; pairs with the `graphite` accent.

**Stock cabinet — when each stock signals what:**

| Stock | Signal | First used |
|---|---|---|
| `cream` | Anchor — the default; warm magazine paper | Run-wide |
| `ivory` | Serious-sober — methodological / press-preview register | 374 (AGAINST VIRAL BENCHMARKS) — the lab-bench paper |
| `butter` | Summer / leisure — slow reading | (per-issue) |
| `kraft` | Field-report / outdoor | (per-issue) |
| `ink` | Night / after-hours | 371 (AFTER HOURS) — the tungsten dark |
| **`ledger`** | **Audit / account — graph-ruled accountant's paper** | **372 (THE AUDIT) — debuts with the postmark mechanic** |

**Spot color** — the punch:
- `--pop-tomato` `#E24E1B` — banners, rules, italic em accents,
  catalog numbers, terminal prompt. The only spot color the press
  needs to mix.
- `--pop-tomato-soft` — 8% tomato wash for hover states

**Reserved accents** (defined, not yet used — earmarked for future
issue variants):
- `--pop-cobalt` `#1D4E89` — winter issue
- `--pop-ivy` `#2E4A2E` — nature issue
- `--pop-pool` `#4FB5C8` — terminal agent label

**Editorial rules**:
- `--pop-hairline` — 0.5px ink rule
- `--pop-hairline-soft` — 16% opacity rule
- `--pop-tape` — butter tape overlay

**Terminal traffic-light dots** (mac-style chrome):
- `--pop-term-red`, `--pop-term-yellow`, `--pop-term-green`

### Type stack

- **Display + prose**: EB Garamond → `var(--font-serif)`
- **Meta + code**: Courier Prime → `var(--font-mono)`

Nothing else. No system fonts, no sans-serif.

### System glyph — the kernel.chat folio mark

**The asterisk (★)** — ratified ISSUE 370 — is the magazine's
single recurring small mark, threaded through every folio strip in
the system. Borrowed practice from PAPERSKY (whose paper-airplane
glyph plays the same role), implemented through the existing
`<PopIcon name="asterisk">` SVG and the `.pop-system-glyph` CSS
class in `src/index.css`.

**Where it appears** (one place per surface — never as decoration):

| Surface | Position | Component |
|---|---|---|
| Cover dateline | Leading the issue folio (top-right of every cover) | `IssueCover.tsx` |
| Frame masthead | Leading the issue folio (top of every inner page) | `MagazineFrame.tsx` |
| Frame footer | Leading the issue folio (bottom of every inner page) | `MagazineFrame.tsx` |
| Postmark dateline | Leading `coverPostmark.place` at the bottom-centre of covers that fire the fourth PAPERSKY mechanic (introduced 372) | `IssueCover.tsx` (postmark variant) |

**Spec**: tomato spot color, `0.85em` of the surrounding folio
text, vertically centred, `6px` right margin, `opacity: 0.95`.
Renders the existing `PopIcon` `asterisk` stroke SVG — no new
infrastructure.

**Discipline**: this is the **only** small graphic mark that
travels through the system. The rest of the `<PopIcon>` vocabulary
(`leaf`, `coffee`, `pin`, `quote`, `thread`, etc.) remains
available for *single-use editorial accents* inside specific
issues, but none of them are systemwide. A system with eleven
small marks has none. We have one. Keep it.

**Promotion path** for future surfaces: section openers
(`pop-section-header`), page-number folios on long features,
colophon. Add only if the surface already carries the issue meta
strip — otherwise the asterisk reads as decoration, not as a
thread.

### Primitives (`src/index.css:29320+`)

| Primitive | What it is | Where it appears |
|---|---|---|
| `.pop-rule` | Hairline divider (1px) | Section breaks |
| `.pop-rule--tomato` | 2px tomato spot rule | Section accents |
| `.pop-rule--short` | 64px max-width centered rule | Under kickers |
| `.pop-kicker` | Bracketed `[CATEGORY · 日本語]` mono label | Every section head |
| `.pop-banner` | Tomato tag box (reverses to ivory text) | Issue banner, tags |
| `.pop-hash` | `#tag` chip | Cover stats |
| `.pop-catalog-num` | `001.` numbered item (tabular nums) | Catalog rows, cards |
| `.pop-price` | `¥0 · BYOK` price tag | Cover masthead |
| `.pop-monument` | Stacked issue-number block | Cover bottom-right, colophon |
| `.pop-bilingual` | Latin/JP lockup wrapper (`.pop-latin` + `.pop-jp`) | Catalog cards, specialist cards |
| `.pop-display` | EB Garamond display headline (italic em → tomato) | All section titles |
| `.pop-swash` | Italic coffee accent | Decks, subtitles |
| `.pop-stock-*` | Paper ground (cream/butter/kraft/ivory/ink) | Whole sections |
| `.pop-row` | Catalog row grid (num · label · badge) | Table of contents |
| `.pop-folio` | Page number / byline / date strip | Masthead, frame footer |
| `.pop-section-header` | Editorial lockup (kicker + rule + title) | Every section |
| `.pop-section-title` | Large display title | Section titles |
| `.pop-section-header--on-ink` | Dark mode variant | Field report, Security, Bench |
| `.pop-feature-jp` | Mono Japanese subtitle | Feature hero, page heads |
| `.pop-term-dot` | Terminal traffic-light (red/yellow/green) | All terminal demos |

### MagazineFrame (`src/components/MagazineFrame.tsx`)

A wrapper that gives every inner route the same masthead strip + folio
footer as the cover — wordmark + ISSUE · MONTH YEAR + page kicker on
top, "← BACK TO COVER" + folio on bottom. Optional `title` /
`titleJp` / `deck` for pages that want a full editorial head block,
or just the wrapper strip for pages that keep their own hero. `dark`
mode for ink-ground pages.

### Issue metadata (`src/content/issue.ts`)

Every release is a new issue. Cover, masthead, folios all read from a
single typed `ISSUE` object:

```ts
{ number: '360', month: 'APRIL', year: '2026',
  feature: 'THE URBAN OUTDOORS REVIEW',
  featureJp: '都会のコードと、自然のOS',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために' }
```

Bumping the issue is a one-line change.

### Print stylesheet (`src/index.css` `@media print`)

The design begs to be printable. Print:
- A4 page, ink on white, all stocks collapse
- Tomato preserved as press spot color
- Interactive chrome hidden (CTAs, install pill, nav, buttons)
- URLs exposed beside inline links
- `page-break-inside: avoid` on sections, cards, rows
- Display sizes in points

Print any route (`Cmd+P`) for the printable zine form.

---

## Application matrix

| Route | Wrapper | Stock | Dark | Section heads | Bilingual |
|---|---|---|---|---|---|
| `/` Landing | — (cover) | cream / butter / ivory / ink mixed | mixed | ✓ on every section | ✓ catalog + specialists |
| `/security` | MagazineFrame | ink | ✓ | ✓ tomato kickers, on-ink | section-head only |
| `/bench` | MagazineFrame | ink | ✓ | ✓ tomato kickers, on-ink | section-head only |
| `/privacy` | MagazineFrame | cream | — | h2s get tomato spot rule via CSS | masthead only |
| `/terms` | MagazineFrame | cream | — | h2s get tomato spot rule via CSS | masthead only |

---

## Rules for contributors

1. **Never name the inspiration on the site.** The grammar carries
   the homage. No "POPEYE" copy in user-visible surfaces.
2. **Never hardcode color or font.** Always go through `--pop-*`,
   `--font-serif`, `--font-mono`.
3. **Never use inline styles** for color, font, or spacing. Extract
   to CSS classes per `.claude/rules/components.md`.
4. **Bilingual everywhere it fits.** Catalog items, section heads,
   page titles — wrap in `.pop-bilingual > .pop-latin / .pop-jp`.
5. **Tomato is the only spot color.** Don't introduce a second
   accent without proposing a new issue-variant token (cobalt /
   ivy are reserved for that).
6. **Every release is an issue.** Bump `src/content/issue.ts` on
   each version. Don't ship a kernel.chat update without
   incrementing the issue number — like a real magazine.

---

## Editorial tools — per-feature modules

Different issues need different tools. An essay wants section
kickers, drop caps, and a pull quote. An interview wants a subject
dossier and a Q&A format. A recipe (future) wants an ingredient
list and a method block. Rather than force every feature into one
layout, the `spread` field on `IssueRecord` is a **discriminated
union** — each issue picks the right tool, and the
`IssueFeature` router renders the matching component.

### Current tools

| Tool | `spread.type` | Component | Used by | Grammar |
|---|---|---|---|---|
| Essay | `'essay'` | `EssayFeature` | ISSUE 363 | Mono section kickers, serif prose, drop cap on lead paragraph, tomato pull-quote, sign-off |
| Interview | `'interview'` | `InterviewFeature` | (available) | Subject dossier card with tomato corner badge, alternating Q./A. blocks, drop cap on final answer |
| Forecast | `'forecast'` | `ForecastFeature` | (available) | Cobalt-led forward projection — signals, horizons, confidence bands. Surfaces `forecast_summary` numerics in editorial form |
| Dispatch | `'dispatch'` | `DispatchFeature` | ISSUE 376 | Wire-style news filing — repeating slug band, dateline, numbered propositions with tomato check-squares, mid-spread bulletin, optional bridge to a prior issue, terminator rule |
| Review | `'review'` | `ReviewFeature` | (available, ISSUE 378 candidate) | Olive-led graded survey — top-line italic verdict, numbered rubric (criteria), optional standout award, grid of subject cards with score monument, stars, pros/cons, per-card verdict |

### How to add a new tool

1. Extend `IssueSpread` in `src/content/issues/index.ts` with a new
   member of the union, e.g. `{ type: 'recipe', ... }`.
2. Build `src/components/<Name>Feature.{tsx,css}` following the
   `EssayFeature` / `InterviewFeature` conventions.
3. Add a case to the switch in `src/components/IssueFeature.tsx`.
4. TypeScript's exhaustiveness check will flag any variant that
   isn't handled.

### Tools worth adding next

- **`recipe`** — ingredients list (numbered rows), method block
  (numbered steps), field variables (time, yield, temp). POPEYE
  runs these in food issues.
- **`letters`** — reader letters column: one block per letter
  with italic signature right-aligned.
- **`gallery`** — when images arrive: caption-first photo grid.

---

## The toolkit — four layers

Inspired by how designers work across Illustrator, Photoshop,
InDesign, and Adobe Express (or their Figma equivalents), the
kernel.chat magazine is a four-layer toolkit. Each layer has a
distinct job; each issue picks what it needs from each.

| Layer | Adobe analog | Figma analog | What it does | Status |
|---|---|---|---|---|
| Layout + text flow + features | **InDesign** | Pages + auto-layout | Grid, masthead/frame, feature modules (essay / interview / forecast) | ✅ shipped |
| Ornaments — shape, icon, path-text | **Illustrator** | Components (vector) | Editorial marks that compose inside any feature | ✅ shipped |
| Images + textures | **Photoshop** | Image fills | Photography, overlays, raster texture | ⏸ deliberately skipped |
| Template builders | **Adobe Express** | Community templates | One-call issue helpers so authoring is faster | ⬜ next |

### Ornaments — the Illustrator layer

Three families of decorative primitive, all in `src/components/ornaments/`:

#### `<PopShape />` — geometric marks
Tokenized shapes for editorial badges, corner marks, dividers.
Renders as inline SVG taking `currentColor` so it adopts the ink
of wherever it sits.

| name | use |
|---|---|
| `circle` · `ring` · `dot` | counters, corner badges, index markers |
| `square` · `lozenge` | subject-card corner badges, feature tags |
| `triangle` · `star` | flags, anniversary covers, play buttons |
| `slash` | diagonal accent, strike-through headlines |

Sizes: `sm · md · lg` (all via `clamp()` — mobile-first).
Colors: `tomato · ink · coffee · ivory · current`.
Optional `label` prop centers mono text inside the shape.

```tsx
<PopShape name="lozenge" size="md" color="tomato" />
<PopShape name="circle" size="lg" label="03" />
```

#### `<PopIcon />` — editorial pictograms
Hand-tuned inline SVGs with a slightly thicker editorial stroke.
Not Lucide / Feather / Material — these speak the magazine's
type weight.

Icons: `arrow · asterisk · sparkle · leaf · coffee · sun · moon ·
book · pin · quote · thread · pilcrow`. Sizes: `sm · md · lg`.
Takes `currentColor`.

```tsx
<PopIcon name="asterisk" size="sm" />
<PopIcon name="arrow" aria-label="continue" />
```

#### `<PopPathText />` — writing along a path
SVG `<textPath>` primitive for curved headlines, arc signoffs,
wavy drop-in ornaments.

Presets: `arc-top · arc-bottom · wave`. Custom `d` supported for
bespoke curves.

```tsx
<PopPathText text="Summer is Here" preset="arc-top" color="tomato" />
```

### Editorial tools — per-feature modules (InDesign layer)

Different issues need different tools. An essay wants section
kickers, drop caps, and a pull quote. An interview wants a subject
dossier and a Q&A format. The `spread` field on `IssueRecord` is a
**discriminated union** — each issue picks the right tool, and the
`IssueFeature` router renders the matching component.

| Tool | `spread.type` | Component | Used by | Grammar |
|---|---|---|---|---|
| Essay | `'essay'` | `EssayFeature` | ISSUE 363 | Mono section kickers, serif prose, drop cap on lead paragraph, tomato pull-quote, sign-off |
| Interview | `'interview'` | `InterviewFeature` | (available) | Subject dossier card with PopShape corner lozenge, alternating Q./A. blocks, drop cap on final answer |

#### How to add a new tool

1. Extend `IssueSpread` in `src/content/issues/index.ts` with a new
   member of the union, e.g. `{ type: 'recipe', ... }`.
2. Build `src/components/<Name>Feature.{tsx,css}` following the
   `EssayFeature` / `InterviewFeature` conventions.
3. Add a case to the switch in `src/components/IssueFeature.tsx`.
4. TypeScript's exhaustiveness check will flag any variant that
   isn't handled.

#### Tools worth adding next

- **`recipe`** — ingredient list, method block, field variables.
- **`review`** — product review grid, ratings, pros/cons.
- **`letters`** — reader letters column.
- **`dispatch`** — field report, location/date header.
- **`gallery`** — when images arrive: caption-first photo grid.

---

## Mobile design philosophy

Mobile is **primary**, not responsive. Six principles guide every
layout decision:

1. **Mobile is the cover.** Design at 393px first; scale up.
2. **The thumb is the turn-of-page.** 44px tap targets everywhere,
   no sticky nav, no hamburger menu, no horizontal scroll (except
   deliberate editorial moves like wide tables).
3. **Type-first, never card-first.** No rounded-rectangle UI
   chrome. The pop-* primitives are all typographic — pop-kicker,
   pop-banner, pop-folio, pop-rule.
4. **Warm grounds beat pure white.** Ivory/cream/butter/kraft stocks
   soften mobile blue-light. No pure `#ffffff`. No dark mode (the
   ink stock handles dark sections on a per-section basis).
5. **Generous vertical rhythm, tight horizontal frame.** 18–22px
   horizontal padding on ≤640px; `line-height: 1.6+` for serif
   prose.
6. **One issue per session.** Linear read: cover → feature → next.
   No discovery UI, no menus, no app-shell. The issue is the app.

### Implemented rules

- All `.pop-landing` and `.pop-frame` use `env(safe-area-inset-*)`
  so iPhone notch + home indicator are respected.
- `prefers-reduced-motion` disables transitions site-wide.
- Every layout variant has a mobile-first `clamp()` pass.
- Ornaments (PopShape, PopIcon, PopPathText) use `clamp()` sizing
  by default.

---

## Ambient motion — the two accents

> **Scope:** this contract governs the **editorial surface** — the
> magazine itself (issues, spreads, covers, pressroom, colophon).
> The AI-engine surface (`EnginePage`, chat, panels) is genuinely
> interactive and uses the `motion/react` token system in
> `src/constants/motion.ts` instead; that boundary is defined in
> `.claude/rules/components.md` § "Motion — two surfaces, two
> instruments." The "no Framer Motion" line below is the editorial
> rule, not a codebase-wide ban.

A print-inspired magazine is mostly still on the web. A book
doesn't animate itself. But two very small ambient moves keep
the page from feeling dead — both respect
`prefers-reduced-motion` via the site-wide override in
`src/index.css` (animation-duration collapses to 0.01ms).

| Accent | Where | Spec |
|---|---|---|
| Tomato rule breath | Every `.pop-rule--tomato` | Opacity 0.92 ↔ 1.00, 3.3s period (0.3Hz). CSS keyframe `pop-rule-breath`. |
| Dateline marquee | Cover dateline JP tagline | ~4px/second horizontal drift via `.pop-marquee` + `.pop-marquee-track`. Static folio beside it stays still. Mask gradient softens the entry/exit edges. |

Both are deliberately subtle — a reviewer should have to be told
they exist. The tomato rule breath is also the one motion token
shared with the TikTok grammar, a quiet cross-medium tie-in.

**Rules for new ambient motion:**
1. Must be imperceptibly small (amplitudes ≤ 8% opacity or
   ≤ 4px translate).
2. Must respect `prefers-reduced-motion`.
3. Must be CSS-only — no JS animation libraries, no Framer
   Motion, no `requestAnimationFrame`.
4. Must not trigger layout or repaint hotspots — animate only
   `opacity` and `transform`.
5. Before adding a third ambient accent, audit whether the
   existing two are enough. The site's character is stillness
   with two quiet accents — not a gallery of ambient effects.

---

## Future moves (not yet shipped)

- PDF export per route — actual printable issue file
- Template builder layer (Adobe Express analog): one-call helpers
  like `createEssayIssue({...})` that fill in defaults

(The seasonal accent move shipped: cobalt, ivy, pool are seeded
in `src/content/issues/accents.ts` alongside tomato, brick, olive,
amethyst, oxblood, coffee — nine seeds total, each with a default
spread-type binding.)
