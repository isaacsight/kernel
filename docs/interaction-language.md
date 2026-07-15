# The Interaction Language

> The rules for when and how a kernel.chat editorial surface may
> accept the reader's hand. Ratified across ISSUE 399 (the first
> instrument) and ISSUE 403 (THE READER'S HAND — the declarations).
> The issue persuades; this document enforces. When they disagree,
> fix the disagreement before shipping anything.
>
> **The cabinet, as of ISSUE 419:** ten shapes built — Dial
> (`instrument`, ARIA radiogroup, N ordered positions on one
> variable), Compare (`compare`, ARIA switch, two irreducible
> lenses with no position between them), Sequence (`sequence`,
> ARIA tablist, an ordered process in discrete, complete stages
> where each stage's account depends on the one before it), Galley
> (`galley`, per-passage ARIA toggle buttons, N independent
> strike/stet marks applied to the prose itself — the reader
> performs an editorial act on the text), Margin (`margin`,
> per-passage native text fields — the first CONTRIBUTION control:
> the reader writes their own words into ruled margin space,
> counted but never read, kept by no one), and Press (`press`,
> ISSUE 413 — the first ARTIFACT control: the reader operates the
> real production grammar and composes a printable cover of their
> own; selection and contribution composing toward a thing, not a
> reading), Close (`close`, ISSUE 415 — a feed with no natural end,
> "one more" and "stop" as siblings at identical weight), Proof
> (`proof`, ISSUE 417 — a machine-completed draft the reader
> adjudicates line by line), Day (`day`, ISSUE 418 — time lived as
> the axis: an authored metropolitan day marked moment by moment),
> and Plate (`plate`, ISSUE 419 — the WORKING MODEL: an operable
> in-house miniature of an external mechanism, ratifying the rule-3
> and rule-4 amendments below) — plus the Tutor (`tutor`, ISSUE
> 411), a COMPOSITE that teaches the primitives by having the
> reader operate a stakes-free version of each, and one shape
> RESERVED: the Bore (`bore`, the depth control), demonstrated in
> the artifact register by CORE SAMPLE No.1 and waiting for the
> story that needs a descent on the spread itself — see the
> reservation below. Any further shape
> waits, unbuilt, for a real story that needs it — see rule 7 for
> how a reservation becomes a build, and for why ISSUE 407 refused
> to manufacture one.

Status: **LAW** — reviewed each time a new interactive spread is
proposed. Three documents now govern the publication: this one
governs the hand on the SITE spread; `docs/design-language.md`
governs color, type, and stock on both surfaces; and
`docs/artifact-language.md` (ratified after 419) governs the
ARTIFACT EDITION — the standalone interactive animated rendering
every issue now also ships, where the expressive register leads.
When the two laws disagree about an artifact, artifact-language
wins; about a spread, this file wins.

---

## The seven rules

### 1. The page is calm by default

An editorial surface at rest is complete. Interaction never gates
the first reading — a reader who touches nothing misses nothing
essential. The touch deepens; it never unlocks.

**Enforcement:** every state a control can reach must be readable
without the control (see rule 4). If removing all interactivity
leaves a page that no longer makes its argument, the spread is
rejected at review.

### 2. Interaction is an instrument, not decoration

The only admitted species of interactivity is the **calibrated
control**: a fixed question, a bounded set of positions, an honest
reading at each stop. The reader's hand adjusts a variable the
story is *about*, and the page answers.

**Refused by type:** hover garnish, scroll-triggered reveals,
parallax, cursor effects, any element that reacts merely to prove
it can. Test: cut the interaction — if nothing true is lost, it
does not ship.

### 3. Motion is weather, not action

Interaction and motion are **separate budgets**. Admitting the
hand did not grow the motion budget:

- Motion stays **CSS-only** — transitions and keyframes. Script
  changes state; it never choreographs.
- Amplitudes stay ambient — the movement of paper in a room.
  Transition durations on the order of a page-turn, not a scene.
- The ruling predates the instrument (the ISSUE 371 after-hours
  motion system was withdrawn) and survives it.

**Enforcement:** no JS animation libraries on editorial surfaces.
No `requestAnimationFrame` choreography in a `*Feature.tsx` —
except inside a working model's plate frame, under the amendment
below.

**AMENDED — ISSUE 419, the working-model exception.** When a
spread's subject is a *mechanism* and the page carries a working
model of it (the `plate` shape), script may move the model's own
signal — a pulse walking a wire, a frame drawing its proof —
because that motion **is the subject under review**, not
decoration. The exception is narrow and travels with four
constraints, all mandatory:

1. **Confined to the plate frame.** Script-driven motion lives
   inside the framed working model only; everything outside the
   frame keeps the CSS-only contract at weather amplitude.
2. **Timer-robust.** Every animation step must advance on a timer
   as well as a frame callback (race `requestAnimationFrame`
   against `setTimeout`, first past wins). A model sequenced on
   rAF alone provably stalls in throttled and background tabs —
   419's own galley stalled in an embedded pane where rAF never
   fires. A model that can hang mid-pull is a broken instrument,
   and a broken instrument is a false meter (rule 6).
3. **Reduced-motion collapses it.** Under
   `prefers-reduced-motion`, the pulse is skipped and states
   change instantly. The model still works; it just doesn't move.
4. **Ambient inside the frame too.** Even the model's own motion
   keeps paper-room amplitude — a swaying video frame stays ≤4px.
   The exception admits script, not spectacle.

### 4. Everything stays on the page

- Every reachable state exists in the DOM at all times. Selection
  is visibility, not existence. Nothing is conjured on demand or
  destroyed on departure.
- **Print renders everything, stacked.** `@media print` must lay
  the control's states out in full — on paper the instrument
  becomes a table of its positions. An issue is a frozen,
  reproducible object; content that lives only behind interaction
  is content the archive cannot hold.

**Enforcement:** print-preview every interactive spread before
shipping (§VI of PUBLISHING.md). If a state matters enough to
build, it matters enough to print.

**AMENDED — ISSUE 419, the seed is the state's address.** A
working model with generative frames cannot hold every reachable
state in the DOM — the states are combinatorial. The rule's
purpose (the archive holds everything the reader ever saw) is
preserved by **reproducibility** instead, under three mandatory
conditions:

1. **Deterministic drawing.** Every generated frame is drawn by a
   deterministic algorithm from a seed. Same seed, same proof, on
   any copy of the issue, forever.
2. **The seed prints on the artwork.** Every frame carries its
   seed number on its own face (No.###) — a printed seed is a
   state the archive can re-draw. Print renders the current
   frames with their seeds, plus a snapshot line listing them.
3. **The resting state is fixed.** The page opens on a completed
   pull whose seeds derive from the issue number, so an untouched
   copy is complete (rule 1) and identical to every other
   untouched copy — the frozen-object promise kept exactly where
   randomness could have broken it.

### 5. The hand arrives by every door

The magazine does not invent interaction grammars. Every control
maps to an **established ARIA pattern** with its standard keyboard
behaviour, or it does not ship.

- The instrument dial is a **roving-tabindex radiogroup**: one tab
  stop for the whole control, arrow keys move between stops,
  `role="radiogroup"` / `role="radio"` + `aria-checked` announced
  exactly as a native control would.
- Focus states use the issue accent, visible on every stock,
  in both color-scheme modes and high-contrast.
- Touch targets meet platform minimums; the control works with
  mouse, keyboard, touch, and screen reader from day one — not
  as a follow-up.

### 6. The meter tells the truth

Interactive surfaces make claims (cost, time, depth). Every
displayed reading is either **measured** or **labelled
representative, in words, on the surface, next to the number**
(the `meterNote` field — mandatory equipment, precedent ISSUE 399).
An unlabelled fake gauge is grounds for rejection; a dial
dramatising invented numbers is decoration wearing a lab coat.

### 7. Two instances before a pattern

No shared "interactive spread machinery" is extracted until a
**second** story arrives that cannot be told without a hand on it.
The first instance lives in its own `*Feature.tsx`. When the second
real need appears, extract what the two genuinely share — never
generalise from the first enthusiasm. (This is the magazine's
general law of novelty; it applies to ornaments, seals, motion,
and accents identically.)

**How a new shape gets born (worked example: Compare, ISSUE 406).**
The test before building anything new is: *does the existing shape
have a position that represents this material, or would using it
mean inventing a fake position that doesn't exist?* 406's material
was whether a seven-issue press day was disciplined or risky — two
complete, opposed readings of one fact set, with no "medium" between
them that means anything. Forcing that into the Dial would have
required inventing three fake intermediate stops. That failure is
the signal: Compare shipped as ARIA `switch` (true two-state,
native Enter/Space activation) rather than a two-stop `radiogroup`,
because the interaction model is genuinely different, not just
smaller. **Compare is now itself at instance one** — its own shared
machinery waits for a second switch-shaped story before anything
gets extracted.

**How the third shape got born (worked example: Sequence, ISSUE
408), and the reservation that nearly wasn't refused.** ISSUE 407 —
a retrospective auditing 399/403/405/406 — was drafted with the
instinct to reach for a new interactive mechanic simply because two
existed; that instinct was named and refused in the piece itself,
and 407 shipped as a plain essay. The real story arrived separately:
kbot's engineering loop (`packages/kbot/src/engineering-loop.ts`,
29 passing tests) runs five ordered phases — plan, act, observe,
reflect, decide — where each phase's account depends on what the
one before it produced, and the final phase forks to one of three
real, mutually exclusive exits (`success` / `budget` / `handback`).
Neither built shape fit: it is not a spectrum with a "medium"
between plan and decide (ruling out Dial), and it is not two
readings of one fact set (ruling out Compare) — it is a real
process with an actual order, which is exactly what Sequence was
reserved for. It shipped as ARIA `tablist`/`tab`/`tabpanel` — the
established Tabs pattern, standard keyboard behaviour, no
forward-lock invented on top of it, because a reader here is
reviewing a *finished* run's journal, not driving a live one, so
jumping straight to `decide` is a legitimate way to read it.
**Sequence is now itself at instance one** — its own shared
machinery waits for a second stage-shaped story before anything
gets extracted.

**How the fourth shape got born (worked example: Galley, ISSUE
410), and what it settles about rule 6.** ISSUE 409's two voices
argued whether a control can carry feeling honestly and declined
to resolve it; 410 resolved it by building the instance. The
story: the house discipline itself — count what gets read; cut
what doesn't — where the argument (the reluctance before the
strikethrough is *felt*, not calculated) is genuinely lost without
the reader's hand. The shape test ruled out all three existing
shapes: a reader may cut none, all, or any subset of passages in
any order — N *independent* two-state marks on the text, not
positions, lenses, or stages. It shipped as one `aria-pressed`
toggle button per passage with a stable accessible name; struck
text stays in the DOM and stays legible (manuscript strikethrough,
never removal); print keeps the reader's marks. The rule-6
precedent it sets: **a control may be designed knowing feeling
will arrive, so long as the feeling is a side effect of honest
work and never a measured target.** The tally meters only the
reader's marks (words kept, passages struck — real counts of real
actions); it claims nothing about any internal state; marks are
client-session state, unrecorded, and the page says so in print.
An emotional register without an emotional claim keeps the meter
honest. **Galley is now itself at instance one** — its own shared
machinery waits for a second markup-shaped story before anything
gets extracted.

**The composite case, and a refusal beyond the rules (Tutor, ISSUE
411).** The run built four shapes and never taught a reader to use
them. 411 is the manual: a `tutor` spread that composes stakes-free
versions of all four controls into one teaching flow, so operating
each once makes the reader literate in the grammar. Two things it
settles. First, on rule 7: a composite that *teaches* the
primitives is a genuinely new story (capability, not claim), so it
is instance one of its own shape — and it reimplements minimal
inline controls rather than importing the four full feature
components, because extraction still waits for a *second* composite,
not for the first one's convenience. Second, on rule 6: teaching
tempts you toward correctness, and a keystroke's correctness is
honestly auditable — unlike 410's feeling, a right answer is a real,
checkable fact, so the magazine *could* grade the reader and stay
inside the meter rule. It refuses anyway. Nothing in a tutor is ever
"wrong"; each control shows only what the reader's choice produced.
**Teach by consequence, never by grade.** Declining a measurement
the rules would permit, because grading the reader turns a magazine
into a test, is the strongest form of the calm-by-default principle:
the page never watches you to decide whether to reward you.

**How the fifth primitive got born (worked example: Margin, ISSUE
412), and the honesty duty it adds to rule 6.** Every prior shape
offers SELECTION among author-provided states — stops, lenses,
stages, strikes. 412's story (marginalia: when machines set the
text, the reader's note is the last unautomatable writing on the
page) required CONTRIBUTION — the reader adds content that did not
exist before their hand. That is a categorically different
interaction model, so it earned a new primitive rather than a
variant. It shipped as one native labelled `<textarea>` per
passage — the most established input pattern on the web, rule 5
satisfied by definition — with the reader's words rendered in the
house mono against the machine-set serif (two voices, two faces,
inside the two-face rule). The rule-6 extension it codifies: **an
input control implies keeping, so an honest one must state plainly
that it keeps nothing.** Notes are session-state only — no storage,
no network — the tally counts notes and words without reading them,
reload erases everything, and the page says so in print and teaches
the four-century-old remedy (copy out what you keep — the
commonplace-book move). The honesty rule now runs in both
directions: never fake a meter, and never let the reader believe
you keep what you don't. **Margin is now itself at instance one** —
its own shared machinery waits for a second contribution-shaped
story before anything gets extracted.

**How the sixth shape got born (worked example: Press, ISSUE 413),
and the principle it adds: the law travels with the instruments.**
The story was the composing rung — after writing comes the press
itself — and its material was the magazine's own production
grammar. No existing shape held it: every prior control produced a
READING; the press produces an ARTIFACT (a composed, printable
cover that did not exist before the reader's hands). The design
decision that matters: the choice sets are the LIVE system
constants — the real `IssueStock` union, the real `INK_SEEDS`
cabinet, the principal layouts — not copies and not a sandbox. An
off-grammar cover is therefore impossible by construction rather
than by validation: the reader cannot pick a neon because
`isPopeyeSafe()` ran when the cabinet was curated, cannot add a
third face because the press only owns two. **Handing over a tool
with its constraints intact is the only honest way to hand over a
tool** — a "safe copy" would be a toy, and a validator slapping
the reader's hand would be a grade. Which is the second thing 413
settles: the colophon line states the reader's composition (stock ·
ink · layout) and refuses to score it — 411's no-grade ethic at
higher stakes. Taste is not meterable, and a scored press teaches
composing for the score. **Press is now itself at instance one** —
its own shared machinery waits for a second artifact-shaped story
before anything gets extracted.

---

**The eighth shape — Proof (`proof`, ISSUE 417), and the act it
adds: adjudication.** The machine has completed a draft before the
reader arrived; the reader's remaining act is judgment, line by
line — KEEP MACHINE / TAKE THE HAND / STRIKE — composing a resolved
screen and a provenance ledger (N machine · N hand · N struck).
Completes the print-shop sentence the cabinet already speaks:
galley (410, raw type) → proof (417, the correction pass) → press
(413, the composing). Not a galley: the base text is
machine-authored, the polarity is inverted (what must a machine
draft *earn*, not what can a human text *lose*), and a real third
provenance — the hand's rewrite — exists. What it settles: rule 6
runs doubled when a machine speaks on the page — the ledger counts
only the reader's marks (session-only, unrecorded), AND the machine
lines must be real model output, never hand-edited, disclosed
on-surface (`machineNote`) and filed in the audit. Calm default is
the thesis itself: untouched, every line keeps the machine — which
is exactly the 2026 default the issue is about. **Proof is at
instance one** — no machinery extracted from Galley/Press.

---

**The tenth shape — Plate (`plate`, ISSUE 419), and the two
amendments it ratifies.** Every prior shape hands the reader a
text, a process, a comparison, an artifact, or a day. The Plate
hands them a MECHANISM: a working model of an external system
(419's subject: FLORA's node canvas — blocks carry models, wires
carry intent), built in-house, framed like a plate in a natural
history volume, and operable — arrange the blocks, pull the
proof, redraw a frame. The shape test that earned it: a review of
a process-product cannot be made in prose alone (rule 2 — the
claim IS the operating of it), and no existing shape holds a live
mechanism. Controls are plain buttons (run + per-frame redraw);
block arrangement is material, not a control — no reading depends
on it — but still arrives by every door (focusable, arrow-key
movable, `aria-roledescription`). What it amends, argued in its
header and ratified here in the same commit per this file's
amendment clause: rule 3 gains the **working-model exception**
(script may move the model's own signal, confined to the frame,
timer-robust, reduced-motion collapsed, ambient amplitude) and
rule 4 gains **seeded reproducibility** (deterministic drawing,
the seed printed on the artwork, a fixed issue-number-seeded
resting state). And rule 6 doubles again, after 417's precedent:
when the page models an external product, the mandatory
`plateNote` discloses the simulation — drawn in-house, nothing
generated, the ledger counting only the reader's own pulls.
**Plate is at instance one** — its machinery waits for a second
mechanism-shaped story before anything is extracted.

---

**The eleventh shape — RESERVED: Bore (`bore`), the depth control.**
Demonstrated 2026-07-15 in the artifact register by CORE SAMPLE
No.1 (THE DESCENT OF A PROMPT): a probe lowered stratum by stratum
through a mechanism's interior on a gauge rail, with CARRIED
CONTEXT — a choice made in an upper stratum (the picked-up sort)
re-inking every stratum below it — and a floor where the descent
resolves (the answer, winched back up). The axis it would add is
DEPTH: the reader's position inside a vertical traversal. The
shape test that distinguishes it: not a Sequence (a finished
process reviewed in any order — the bore is a traversal the reader
*performs*, with position state and memory of their hands), not a
Dial (positions on a variable the page answers — depth is a place
the reader is, not a setting the page reads), not a Plate (the
working model runs where you stand — the bore moves you through
it). Per rule 7 it stays RESERVED: the artifact register carries
the depth work under artifact-language.md §III (the depth
doctrine) until a story arrives that needs the reader's descent on
the spread itself; when it does, the bore ships as a single-button
winch (established control), all strata legible at rest, the probe
raising into the accent — emphasis, never existence, the
correction Core Sample No.1 took in the field. This is 407's
lesson honored in advance: the demonstration exists, so the
temptation to manufacture a site story for it is named here and
refused until one is real.

---

**The ninth shape — Day (`day`, ISSUE 418), and the axis it adds.**
Every prior shape gave the reader's hand a variable (Dial), a
comparison (Compare), a process (Sequence), a text (Galley, Margin),
an artifact (Press), an ending (Close), or an adjudication (Proof).
The Day gives it TIME LIVED: an authored metropolitan day of delegation moments, each
carrying one two-state control — LET IT RIDE / STEP IN — and a
midnight ledger that meters only the reader's real actions (marks,
changes of mind, the session clock; the 415 clock precedent).
What it settles: rule 4 can carry a *choice* shape without
branching — both authored consequences stay printed and legible at
every state; the mark selects which is the reader's, it never
reveals or hides. And rule 6 runs double here: the reader's numbers
are measured; the day itself (moments, attention costs) is authored
representative composite, disclosed in the dossier — the two kinds
of number are never allowed to blur. The no-grade ethic (411) holds:
no split is scored; the ledger is a portrait, not a verdict.
**Day is at instance one** — its machinery waits for a second
time-lived story before anything is extracted.

---

## Adding a new interactive spread — checklist

1. Does the story *require* the reader's hand? (Rule 2 test:
   remove the interaction — is the argument lost?)
2. Write the spread type per PUBLISHING.md §V — discriminated
   union member, own `*Feature.tsx/css`, router case.
3. Map the control to a named ARIA pattern before writing JSX.
   Name the pattern in the file's header comment.
4. All states in the DOM; `@media print` stacks them; verify in
   print preview.
5. Motion: CSS transitions only, ambient amplitude.
6. Every reading measured or labelled representative
   (`meterNote` or equivalent, on-surface).
7. Propose in the issue's header comment which rule(s) the spread
   stresses, and why it still complies — the comment is the audit.

---

*Ratified VII·26 — ISSUE 399 built the first instrument; ISSUE 403
declared the law; this file enforces it. Amend by shipping an issue
that argues the amendment, then editing this file in the same
commit. First exercised in anger by ISSUE 419, which amended rules
3 and 4 to admit the working model.*
