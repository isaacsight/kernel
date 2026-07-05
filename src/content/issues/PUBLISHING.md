# Publishing a new issue of kernel.chat

> **READ ME FIRST** if you are asked to "write the next issue", "make an
> issue about X", "ship a new issue", "publish a new drop", etc.
>
> This file is the single source of truth for the publishing workflow.
> It is loaded from `src/content/issues/` so it lives next to the work.

---

## I. What kernel.chat is

kernel.chat is an **editorial magazine**, not an app. Every drop is
`ISSUE N · MONTH YEAR`. The publication voice is POPEYE-inspired:
warm paper stocks, a single tomato spot color, EB Garamond + Courier
Prime, bilingual JP/Latin lockups, numbered catalogs, a monument
number, a MagazineFrame wrapper.

**Never name the inspiration on the site.** No "POPEYE" in user-visible
copy. The grammar carries the homage.

Magazine vocabulary (issue, feature, spread, folio, kicker, monument,
colophon, masthead, dateline, bulletin) — not app vocabulary
(dashboard, panel, card, widget, modal).

---

## II. Where issues live

```
src/content/issues/
├── index.ts         ← the archive + all type definitions
├── 360.ts ... 368.ts ← frozen snapshots, one per issue
└── PUBLISHING.md    ← this file
```

Cover and spread rendering:

```
src/components/
├── IssueCover.tsx        ← cover (used on landing + permanent URL)
├── IssueFeature.tsx      ← router: dispatches to the right spread type
├── EssayFeature.{tsx,css}
├── InterviewFeature.{tsx,css}
├── ForecastFeature.{tsx,css}
└── DispatchFeature.{tsx,css}
```

Cover layout CSS lives in `src/pages/LandingPage.css` — the
`.pop-cover`, `.pop-cover--classic`, `.pop-cover--monument-hero`,
`.pop-cover--asymmetric-left`, and ornament/seal rules are all there.

---

## III. Deciding the next issue's identity

Before touching code, answer these five questions. They determine the
issue's entire visual grammar. **No two recent issues should share all
five answers** — that is how we keep each cover feeling like its own
object.

### 1. What number?

Always one more than `LATEST_ISSUE` in `src/content/issues/index.ts`.
If another branch is also drafting the next issue, check git:

```bash
git log --all --oneline --grep="ISSUE $((N+1))\|ISSUE $((N+2))"
```

If a collision exists, **renumber to the next free slot** rather than
fighting over the number. Both issues can ship — see §VII.

### 2. What format? (`spread.type`)

Pick the editorial tool that fits the content:

| Type | Used for | Visual grammar |
|---|---|---|
| `essay` | Culture, style, long-form observation, profile-of-a-visual-subject | Drop cap, section kickers, pull quote. Optional: dossier / filmstrip / dataBlock / references modules |
| `interview` | Profiles of people (real, fictional, composite) — **only** when the subject's voice is on tape | Subject dossier + Q&A exchanges. Optional: filmstrip module |
| `forecast` | Manifestos, predictions, numbered declarations | Tomato ring badges + bold titles + prose body |
| `dispatch` | News reactions filed against a deadline | Wire slug marquee, dateline, dossier card, checkbox numbering, mid-spread bulletin, bridge line, `— 30 —` terminator |
| `review` | Graded surveys — "we tested N things, here's the ranking" | Top-line verdict, numbered rubric, graded subject cards, optional standout award |
| `colloquy` | A single argument carried by **two co-equal voices** (no host) | Voices legend (two stances), numbered movements of attributed turns, optional terms dossier + pull quote. The two voices are positions, not people — a private conversation is mined, never transcribed (see 398). |
| `instrument` | A **calibrated control handed to the reader** — the interactive tool | Fixed prompt; N dial stops (roving radiogroup); the same prompt answered at each depth with a meter line. Interaction is React state; motion stays CSS-only; all panels stay in the DOM and print renders them stacked. Meter readings must be honestly labelled when representative, or genuinely measured (see 399, 405). |
| `compare` | A **binary switch between two irreducible lenses** on one fact set — not depths, positions with no medium between them | Two-lens switch (ARIA `role="switch"`, not radiogroup); a shared fact list, each fact read differently under each lens; optional verdict, left undefined when the piece declines to resolve (see 406). |
| `sequence` | A **real ordered process in discrete, complete stages** — each stage's account depends on the one before it, not a spectrum or a binary | Numbered rail (ARIA `role="tablist"`/`tab`/`tabpanel`, standard Tabs keyboard behaviour, no forward-lock); a panel per stage with an optional artifact line; the final stage may attach the process's real terminal outcomes. All stages stay in the DOM and print renders them stacked, in order (see 408). |

**Profile of a person → essay, not interview**, unless you have the
subject's actual answers. The magazine never publishes invented
quotes attributed to a real person. A profile written from
description (third party, public record, the writer's own
observation) is an `essay` with a `dossier` and optional `filmstrip` —
see 371 (Dañiel Aügust). Reserve `interview` for issues where the
subject sat for the conversation.

If none fit, **add a new spread type** — don't force a format. See §V.

### 3. What paper stock? (`coverStock`)

Five options: `cream` · `butter` · `kraft` · `ivory` · `ink`

Pick the one whose material quality reinforces the topic. Cream is the
default; butter is lamplight-warm; kraft is fashion/field-report;
ivory is lab-bench or press-preview white; ink is manifesto / archival
/ nocturnal.

### 4. What cover layout? (`coverLayout`)

Three options:

- `classic` — centered, monument bottom-right (default)
- `monument-hero` — issue number IS the cover art, headline shrinks (use when the number is thematic: anniversary, absence, milestone)
- `asymmetric-left` — left-aligned lockup, editorial-column rhythm (fashion, culture, dispatch)

### 4.5. What accent? (THE INK CABINET — introduced 371)

Every issue now picks one **accent color** that drives the cover's
spot color and every `.pop-kicker--tomato` / `.pop-rule--tomato` /
`.pop-monument strong` / `<em>` inside the issue. Tomato remains
the default — omit `accent` entirely and the magazine picks it
based on your spread type (essay→tomato, interview→coffee,
forecast→cobalt, dispatch→brick). Declare an accent when the
issue's personality calls for a different register.

**The cabinet** (see `src/content/issues/accents.ts` for hexes + fit notes):

| Seed | Fit |
|---|---|
| `tomato` | THE default — 370+ issues |
| `brick` | Deeper, archival — literature, memory, record-of-record |
| `cobalt` | Winter, nocturnal, nightlife (introduced 371) |
| `pool` | Systems, terminal, code, infrastructure |
| `ivy` | Nature, outdoor, agriculture |
| `olive` | Field work, labor, cartography |
| `amethyst` | When the issue is about kernel.chat itself — mastheads, anniversaries |
| `oxblood` | Literature, wine, memory, endings |
| `coffee` | Interviews, craft, slow work |

```ts
accent: 'cobalt'          // named seed (preferred)
accent: '#5E4A22'         // raw hex — must pass isPopeyeSafe()
```

**How it adapts**: from one hex, CSS derives five tones (base,
strong, muted, whisper, ink) via `oklch(from ...)`. Each paper
stock sets `--issue-accent-lift` so the same accent reads
correctly on ivory, butter, kraft, cream, and ink. Dark mode +
high-contrast media queries shift the lift further so accents
hold up in every render mode.

**Adding a new seed**: propose via PR. The seed must pass
`isPopeyeSafe()` (rejects neon, zero-chroma grays, pure digital
primaries) and carry a one-line "fit" note. No new seed ships
without review — that stopped the electric-ultramarine mistake
when 371 was being drafted.

**Motion is NOT part of the palette**. Motion stays authored per
issue when an issue needs distinctive motion, not derived
systematically from the seed. Two instances before a pattern.

### 5. What signature move? (optional but preferred)

One distinctive element that makes THIS cover recognizable at a glance.
Examples in use:

- **coverOrnament: 'ink-spread'** — tomato blot bleeding off the corner (368)
- **coverOrnament: 'warty-spots'** — scattered tomato papillae drifting across the full cover; reads as a specimen's spotted dermis (369)
- **coverOrnament: 'flash-burn'** — overexposed white wedge from upper-right; reads as an on-camera flash hitting the cover. Pairs naturally with ink stock (371). Issue monument number sits inside the burn as ivory-on-bright.
- **coverSeal: { label, date }** — circular rubber-stamp in top-right (368, 369, 371)

New ornaments live as new members of the `IssueCoverOrnament` union
in `index.ts`; new seals reuse the existing component.

Propose new ones when the topic calls for them — these are meant to
grow with the archive.

**On color (updated 371)**: the magazine now picks ONE accent per
issue from the Ink Cabinet (§III.4.5). Tomato remains the default;
issues declare a different seed when the personality calls for it.
A prior attempt to introduce a second simultaneous spot color
(ultramarine alongside tomato, an "after-hours palette" for 371)
was withdrawn — two live spot colors fight the magazine's warm
grammar. The adaptive palette replaces that idea: the second
register is expressed by SWITCHING the accent, not adding one.

---

## IV. Writing the issue file

Create `src/content/issues/<N>.ts` following the shape of the most
recent same-format issue (`371.ts` for essay-as-profile,
`402.ts` for essay-as-argument (dossier + pull quote),
`400.ts` for essay-with-dataBlock, `401.ts` for dispatch,
`403.ts` for forecast, `365.ts` for interview,
`404.ts` for review (graded survey),
`398.ts` for colloquy (two-voice),
`405.ts` for instrument (interactive dial, second instance, measured meter),
`406.ts` for compare (interactive binary switch — first instance),
`408.ts` for sequence (interactive ordered stages — first instance)). Every issue needs:

- A leading block comment explaining the identity decisions
- `number`, `month`, `year`, `feature`, `featureJp`, `price`, `tagline`
- `coverStock`, `coverLayout`, optional `coverOrnament`, `coverSeal`
- `headline` — `{ prefix, emphasis, suffix, swash }` — the emphasis is
  the loudest italic-tomato word on the cover
- `contents` — numbered catalog items with EN + JP + TAG
- `spread` — the editorial body
- `credits` — the masthead

Then register in `index.ts`:

1. Add `import { ISSUE_<N> } from './<N>'`
2. Push `ISSUE_<N>` onto `ALL_ISSUES` (order matters — oldest first)
3. `LATEST_ISSUE` automatically flips to the new cover

### Voice

Write like the magazine. Match the existing cadence:

- EB Garamond for prose, Courier Prime for metadata
- Short sentences next to long ones
- Declarations, then caveats
- Japanese subtitles for structural elements (title, contents, section
  headings, kicker). Use real Japanese, not machine glosses — ask if
  unsure rather than inventing
- Em-dashes, not hyphens or parentheses, for asides
- Cite companies/products explicitly when the issue is about them
  (dispatch partners) — but keep the cover headline editorial, not
  news-feed

### Signoff

Every spread ends with a signoff line, usually beginning
`街のコーダーたちへ` ("for the city coders") followed by an em-dash
and a short imperative.

---

## V. Adding a new editorial tool

When no existing spread type fits, add one. The pattern:

1. **Extend the discriminated union** in `src/content/issues/index.ts`:
   ```ts
   export interface RecipeSpread extends SpreadCommon {
     type: 'recipe'
     // ... fields
   }
   export type IssueSpread = EssaySpread | InterviewSpread | ForecastSpread | DispatchSpread | RecipeSpread
   ```

2. **Build the component**: `src/components/RecipeFeature.{tsx,css}` —
   copy the structure of the closest existing feature, replace the
   body rendering.

3. **Register in the router**: add a `case 'recipe':` in
   `src/components/IssueFeature.tsx`. TypeScript will flag missing
   cases via the exhaustiveness check at the bottom of the switch.

4. **Document the new type** in §III above (this file).

Keep new types orthogonal — don't extend existing ones unless the new
field is genuinely optional for every existing issue of that type.

**Interactive tools** additionally comply with
[`docs/interaction-language.md`](../../../docs/interaction-language.md)
— the seven rules ratified in 399 and declared in 403 (calm by
default, calibrated controls only, CSS-only ambient motion, all
states in the DOM + print stacks them, established ARIA patterns
only, honest meters, two instances before a pattern).

---

## VI. Verifying before shipping

Always run all three:

```bash
npx tsc --noEmit         # type-check — MUST be clean
npm run build            # vite build — MUST be clean
```

Then preview the new issue visually:

```bash
npm run dev              # starts at localhost:5173
```

Browse:
- `/` — the landing, should show the new cover as `LATEST_ISSUE`
- `/issues/<N>` — the permanent URL for this issue
- `/issues/<N-1>` — the prior issue, which now shows as `PREVIOUSLY`
- Check mobile breakpoint (≤640px) — the cover should still read

---

## VII. Publishing

**Main is the only publisher.** Pushing to `main` triggers the CI
deployer (`.github/workflows/deploy.yml`), which type-checks, builds
with the production secrets, and publishes `dist/` to `gh-pages`
stamped with the source commit. Live within ~90 seconds.

```bash
git push origin main     # that IS the deploy
```

**Verify by provenance, not asset hashes** — CI builds carry env
secrets a local build lacks, so the same commit produces different
asset fingerprints in different environments. Check that gh-pages
was built from your commit:

```bash
git fetch origin gh-pages
git log FETCH_HEAD --oneline -1   # message reads "deploy: <your main SHA>"
```

**Emergency re-publish** (CI hiccup, cache poison): re-run the same
pipeline by hand — `gh workflow run deploy.yml`. There is no other
path: the manual `npm run deploy` script was **retired** per
ISSUE 399's own prescription (two uncoordinated writers on one
target; last write wins). The script now prints a refusal and
points here.

### If your branch is NOT main

Nothing you do on a feature branch touches the live site — only a
push to `main` publishes. Merge (fast-forward preferred), push, done.

### Collision: another branch also drafted this issue number

Both issues can ship. Renumber the later one to the next free slot
and pull the earlier one into your branch:

```bash
# Find the other branch's commit
git log --all --oneline --grep="ISSUE <N>"

# Rename yours to <N+1>
git mv src/content/issues/<N>.ts src/content/issues/<N+1>.ts
# (then update ISSUE_<N> → ISSUE_<N+1> constant, number field,
#  and any hardcoded number in slug/bulletin/terminator strings)

# Pull the other branch's issue file into your branch
git show <other-sha>:src/content/issues/<N>.ts > src/content/issues/<N>.ts

# If the other branch added new type definitions or component
# updates (e.g. new EssaySpread modules), pull those too:
git show <other-sha>:src/components/<Component>.tsx > src/components/<Component>.tsx

# Register both in index.ts, typecheck, build, push main (CI deploys)
```

---

## VIII. Writing the commit message

Match the existing style — title line is `ISSUE <N> — <TITLE>`,
followed by a 2–3 paragraph body explaining identity decisions and
any new types / components introduced.

Always include:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## IX. After publishing

- Update `SCRATCHPAD.md` with what shipped
- If a new spread type was added, update `docs/design-language.md`
  (if it exists and documents the current spread types)
- If the user asked for it, post to socials via `kbot_social` MCP
  tools — otherwise don't
- **Keep this playbook current.** When you ship issue N, do two small
  edits to this file before you commit:
  1. **Update the "Last updated" line at the very bottom** to match
     the issue you just shipped (e.g. `_Last updated: ISSUE 369 · MAY 2026._`)
  2. **Refresh the §III.2 spread-type examples** if the previous
     example issue for that spread type is now three or more issues
     behind — just change the parenthetical number so readers are
     pointed at a recent template, not a stale one
  3. **Update the §IV "most recent same-format issue" reference** if
     a newer example now exists for the format you shipped
  This is a 30-second hygiene pass. Don't skip it — a playbook whose
  examples are a year stale quietly stops being trusted.

---

## X. Recipes for common asks

### "Make the next issue about X"

1. Read X (WebFetch if it's a URL, otherwise ask for source material)
2. Decide identity per §III — pick format, stock, layout, signature move
3. Create `<N>.ts` using the most relevant existing issue as a template
4. Register in `index.ts`
5. Typecheck → build → preview → deploy

### "Give this issue more character"

Propose the signature move first (§III.5). Then, if the user agrees,
either reuse an existing ornament/seal or propose a new `spread.type`
extension. Keep new editorial tools to issues that genuinely need them
— this is a magazine, not a pattern library.

### "Ship it"

Typecheck → build → commit on the current branch with the format in
§VIII → merge to main (fast-forward preferred) → `git push origin
main`. CI deploys; verify by provenance (§VII). Never deploy from a
branch — only main publishes.

---

_Last updated: ISSUE 406 · JUL 2026 (seven-issue press day: 400–406;
interaction language + system architecture codified in docs/; 405 is
the second instrument with a measured meter; 406 introduces `compare`,
the eighth editorial tool and second interactive spread — a binary
switch, the cabinet's first shape distinct from the Dial)._
