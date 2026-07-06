# The Interaction Language

> The rules for when and how a kernel.chat editorial surface may
> accept the reader's hand. Ratified across ISSUE 399 (the first
> instrument) and ISSUE 403 (THE READER'S HAND — the declarations).
> The issue persuades; this document enforces. When they disagree,
> fix the disagreement before shipping anything.
>
> **The cabinet, as of ISSUE 412:** five primitives built — Dial
> (`instrument`, ARIA radiogroup, N ordered positions on one
> variable), Compare (`compare`, ARIA switch, two irreducible
> lenses with no position between them), Sequence (`sequence`,
> ARIA tablist, an ordered process in discrete, complete stages
> where each stage's account depends on the one before it), Galley
> (`galley`, per-passage ARIA toggle buttons, N independent
> strike/stet marks applied to the prose itself — the reader
> performs an editorial act on the text), and Margin (`margin`,
> per-passage native text fields — the first CONTRIBUTION control:
> the reader writes their own words into ruled margin space,
> counted but never read, kept by no one) — plus the Tutor
> (`tutor`, ISSUE 411), a COMPOSITE that teaches the primitives by
> having the reader operate a stakes-free version of each. Any
> further primitive waits, unbuilt, for a real story that needs it
> — see rule 7 for how a reservation becomes a build, and for why
> ISSUE 407 refused to manufacture one.

Status: **LAW** — reviewed each time a new interactive spread is
proposed. Two documents govern the visual grammar and this one
governs the hand; see `docs/design-language.md` for color, type,
stock, and motion vocabulary.

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
No `requestAnimationFrame` choreography in a `*Feature.tsx`.

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
commit.*
