# Design Engineering — Aesthetic and Function in Parallel

> **The principle**: every functional primitive has a visual primitive.
> They are designed, reviewed, built, and shipped together. Not "engineer
> builds it, designer skins it." Not "designer mocks it, engineer
> approximates it." One track.

For a product in Suno or Procreate's neighborhood — where the thing being
made is *creative output* — this isn't a nice-to-have. The feel of the
tool is the tool. A latency spike *is* an aesthetic failure. A flat
button *is* a functional failure.

---

## 1. The parallel track model

### How most teams do it (don't do this)

```
  Design                        Engineering
    ↓                               ↓
  Figma mocks                     Architecture doc
    ↓                               ↓
  Design review                   Spike
    ↓                               ↓
  Handoff  ─────────────────────▶  Build
                                     ↓
                                   "Pixel-pushing" PR review
                                     ↓
                                   Ship (missing the feel)
```

Result: engineering and design negotiate *after* decisions are locked.
The product lands somewhere neither team fully owns.

### How we do it

```
  ┌───────── Shared brief (problem + constraints + feel) ─────────┐
  │                                                               │
  ▼                                                               ▼
Aesthetic track                                       Functional track
  ├─ visual language                                    ├─ data model
  ├─ motion language                                    ├─ request flow
  ├─ sound language                                     ├─ error shape
  ├─ haptics                                            ├─ realtime channel
  ├─ empty + error states                               ├─ state machine
  └─ microcopy                                          └─ perf budget
  │                                                               │
  └──────────── Woven: each primitive has both sides ─────────────┘
                                │
                                ▼
                       Prototype (real code,
                       real latency, real data)
                                │
                                ▼
                            Ship together
```

Both tracks are driven by the same engineer-designer pair (or unified
role). Figma is a *scratch space*, not a contract. The contract is the
running prototype.

---

## 2. The primitive pairing

Every functional primitive in the system has an aesthetic partner.
They're specified in the same doc, reviewed in the same PR.

| Functional primitive | Aesthetic partner | Failure if decoupled |
|---|---|---|
| HTTP request | Loading state + perceived latency | Jittery UI, "is it broken?" |
| WebSocket connection | Connection affordance (breathing dot) | Silent failure |
| Generation streaming | Progressive reveal (typewriter, waveform fill) | Cliff transition, feels slower |
| Optimistic mutation | Motion presence + rollback shimmer | Data flicker on error |
| Error response | Recovery affordance + tone | User thinks they broke it |
| Empty list | Seed content + guidance | Dead end |
| Destructive action | Weight (modal/confirm/undo) + color | Regret-driven support tickets |
| Auth gate | Texture/color shift from "public" to "mine" | Vertigo |
| Keyboard shortcut | Hint in the command palette | Discovery hole |
| Permission grant | Trust rhetoric in tone | Drop-off at friction wall |

Each row above is a **pair spec** — one doc, two sections. You don't
ship the function without the form.

---

## 3. Design tokens as contract

Tokens are where the aesthetic becomes code. They're not "design stuff."
They're typed, validated, tested like any other contract.

### Token hierarchy

```
primitives/          ← raw values, never used in components
  color/
    neutral.0 .. 12
    accent.0 .. 12    (per-theme)
  space/
    0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64
  radius/
    none, sm, md, lg, xl, full
  type/
    display.*, body.*, mono.*, caption.*
  motion/
    ease.* , duration.*, spring.*
  shadow/
    elevation.0 .. 5

semantic/           ← what components reference
  surface/
    base, raised, overlay, sunken
  ink/
    primary, secondary, muted, inverse
  border/
    subtle, strong, focus, error
  state/
    idle, hover, active, selected, disabled, error, loading
  action/
    primary, secondary, destructive, constructive
```

Components **never** reference primitives. If a component needs a color
that isn't in `semantic/`, the semantic layer is missing something —
extend it.

### Enforcement

```ts
// tokens/semantic.ts
export const semantic = {
  surface: {
    base: primitives.color.neutral[1],
    raised: primitives.color.neutral[2],
    overlay: primitives.color.neutral[3],
    sunken: primitives.color.neutral[0],
  },
  // ...
} as const;

export type SemanticToken = typeof semantic;
```

Tailwind config imports the semantic layer. ESLint rule forbids raw
color hex in `.tsx` files. PR template includes "Did this touch tokens?
Was it designed with the aesthetic lead?"

---

## 4. Aesthetic engineering principles

These are written like engineering principles because they *are*.

### P1. Latency is aesthetic

Every interaction has a felt tempo. 100ms feels instant. 300ms feels
responsive. 1s feels slow. 3s feels broken.

- Optimistic updates: default for idempotent writes.
- Skeleton screens: for <800ms loads, favor shimmer over spinner.
- Streaming reveal: for >800ms operations, reveal progressively —
  never hang at 0%.
- Cancel affordance: anything >2s gets a cancel button.

Latency budgets from [`PERFORMANCE.md`](./PERFORMANCE.md) are also the
aesthetic budgets.

### P2. Motion carries meaning

Motion is not decoration. It explains state changes.

- Enter vs. exit asymmetry: things enter soft (ease-out),
  leave sharp (ease-in). Mirrors how humans perceive object permanence.
- Layout animations over mount/unmount: when a card moves position,
  it *moves*, not disappear-appear.
- Scale + opacity pair: 0.96 → 1.0 scale + 0 → 1 opacity for entrance
  feels like a thing arriving, not teleporting.
- Disable all motion for `prefers-reduced-motion: reduce`.

See [`MOTION.md`](./MOTION.md) for the full choreography.

### P3. Type is hierarchy

Type scale is an architecture. It's how you navigate a screen without
reading.

- One family for display (EB Garamond / Reckless Neue / Söhne).
- One family for body (Inter / Söhne / system-ui).
- One family for mono (Berkeley Mono / JetBrains Mono).
- Five weights, no more: 400, 500, 600, 700, plus 400italic.
- Modular scale (1.125 or 1.2 ratio) — enforced in tokens.

### P4. Color is temperature

Colors aren't palettes. They're temperatures.

- Base neutral: warm (8-12 mireds toward yellow) for creative tools —
  feels like paper / analog equipment. Cool for data tools.
- Accent: one, maybe two. Setlist: a deep amber (analog tape). Studio:
  a specific graphite blue (wet ink).
- Semantic colors (error, success) inherit the warm/cool temperature.
  Pure red and green feel digital and wrong in a creative tool.

### P5. Empty states are invitations

An empty playlist, a blank canvas — these are the most
important screens in the product. They're where intent forms.

- No "no items yet" with a folder icon. Write actual copy.
- Show seed content (examples, templates) as *peers* not tutorials.
- First action is one-tap away.

### P6. Error states are recoveries

An error is a fork in the road, not a dead-end sign.

- Say what happened, in plain English.
- Say what the user can do next.
- Offer the action inline (retry button, not "try again later").
- Never blame the user ("invalid input"); blame the system ("we didn't
  understand that").

### P7. Silence is presence

Whitespace is a feature, not leftover space. Crowded interfaces feel
busy; sparse interfaces feel confident.

- 8pt grid. Most spacing in multiples of 8.
- Never less than 24px between distinct interactive groups.
- Section breathers (48-64px) mark topic shifts.

### P8. The dense view earns its right

Pros want density. Beginners want breath. Default to breath; offer
density explicitly.

- Density toggle (Compact / Comfortable / Spacious) in settings.
- Defaults: Comfortable on desktop, Spacious on mobile, Compact for
  power-user views (sessions list, generations log).

### P9. Shortcuts are UX

Every primary action has a keyboard shortcut. Every shortcut is
discoverable through a command palette (Cmd-K).

- Shortcuts visible in tooltips and menus.
- Cmd-K is present on every authed screen.
- Single-letter shortcuts for the top 10 actions (g for Generate,
  space for play/pause, j/k for list nav).

### P10. Consistency until it isn't

Design systems are a starting point, not a finish line. Break the
system deliberately, rarely, for *product moments* — the first
successful generation, the first share, the first collaboration. A
system that never breaks is a system that never sings.

---

## 5. The aesthetic review gate

Every feature PR must answer these, in the PR body, before merge:

1. **What does it look like when it's working?**
   Screenshot or 10-sec screen recording.
2. **What does it look like when it's loading?**
   Skeleton, streaming UI, or indeterminate state.
3. **What does it look like when it fails?**
   Error state with recovery action.
4. **What does it look like when there's nothing?**
   Empty state.
5. **How does it move?**
   Motion description (what enters, what leaves, what transitions).
6. **Where's the keyboard shortcut?**
   Cmd-K entry, tooltip hint.
7. **Does it work with `prefers-reduced-motion`?**
8. **Does it work at 320px width?**
9. **Does it work at 200% zoom?**
10. **What does a screen reader say?**

Template in `.github/pull_request_template.md`. No merge without all
ten answered.

---

## 6. Prototyping — the real tool

Figma is where we explore. **The prototype is where we decide.**

For every primary flow, we build a throwaway prototype that:
- Hits real APIs (or good mocks).
- Has real latency (not Figma's 0ms magic).
- Has real data volumes (not 3 perfectly-named rows).
- Runs on real devices (not the designer's M2 MacBook).

Tool: same stack as production, because the aesthetic we're testing
*includes* how React feels.

Budget: 20% of feature time in prototypes. If it feels like waste,
we're measuring wrong — prototypes kill bad ideas before they become
sunk cost.

---

## 7. Tools and where things live

| Layer | Tool | Where it lives |
|---|---|---|
| Tokens | TypeScript + Style Dictionary | `packages/tokens/` |
| Icons | Lucide + custom SVGs | `packages/icons/` |
| Primitives | shadcn/ui forked | `packages/ui/src/primitives/` |
| Composite components | Our own | `packages/ui/src/components/` |
| Motion | Motion (ex Framer) | `packages/ui/src/motion/` |
| Storybook | Storybook 9 | `packages/ui/.storybook/` |
| Visual tests | Playwright screenshots | `apps/web/tests/visual/` |
| Design docs | This repo | `docs/` |
| Figma | Exploration only | Figma workspace (not source of truth) |

---

## 8. Roles, because "design engineer" means different things

On this team, the roles I assume:

- **Design engineer** (my hat): owns the design system, prototypes
  flows, writes tokens, makes decisions about motion and feel.
- **Product designer**: owns problem framing, research, user flows,
  writes the brief.
- **Engineering**: owns architecture, data, perf, integration — but
  every engineer is expected to hit the aesthetic bar in their PRs.

When "design engineer" isn't a role: the PM writes the brief, the
designer and senior engineer co-own design decisions via the Pair
Spec template below.

### Pair Spec template

```markdown
# Feature: [name]

## Problem
[1-3 sentences]

## User story
As a ___, I want to ___, so I can ___.

## Functional spec
- [ ] Data model changes
- [ ] API changes
- [ ] State machine
- [ ] Error cases
- [ ] Perf budget
- [ ] Security considerations

## Aesthetic spec
- [ ] Primary visual (mock or prototype link)
- [ ] Loading state
- [ ] Empty state
- [ ] Error state
- [ ] Motion (enter/exit/transition)
- [ ] Keyboard shortcut
- [ ] Copy (microcopy, button labels, error messages)
- [ ] Accessibility (WCAG level, keyboard nav, screen reader)

## Non-goals
- What we're explicitly not doing

## Measured outcome
- How we'll know this worked (metric or qualitative)
```

Every feature PR references a Pair Spec. No spec = no merge.

---

## 9. The Procreate / Suno cut

### If the target is Procreate

The product *is* the feel. Brush latency, pencil pressure response,
color fidelity — all are aesthetic AND functional. The design engineer
role here isn't optional; it's the job.

Focus areas:
- Input-to-paint latency budget (<16ms p95) = aesthetic contract.
- Color science (Display P3 throughout) = aesthetic contract.
- Canvas feel (paper texture, ink spread) = motion + shader work.
- Tool UI disappears when drawing starts = discovery/focus design.

See [`PROCREATE_ANGLE.md`](./PROCREATE_ANGLE.md) for the full angle.

### If the target is Suno

The product is the output (the song), but the *path to the output* is
where design lives. Generation progress UX, waveform feedback, share
flow, playlist feel.

Focus areas:
- Streaming generation UI (typewriter for lyrics, waveform fill for audio)
  = perceived latency contract.
- Share link landing page = first impression for non-users.
- Playlist reorder choreography = feel of ownership.
- Error recovery ("gen failed, retry?") = emotional resilience.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the Setlist demo.

---

## 10. The interview landing

If asked "how do you work with design?" — the answer is *the same way I
work with backend*. Parallel tracks, shared specs, prototypes as
decisions, tokens as contracts, a review gate that refuses any merge
that treats the UI as an afterthought.

If asked "what's aesthetic engineering?" — it's the recognition that
in a creative tool, the boundary between how something *works* and how
something *feels* is a fiction. You can't separate them without
breaking the product.

> A stuttering generation isn't slow code — it's a broken promise.
> A flat share link isn't plain UI — it's a missed handoff.
> A misaligned waveform isn't a CSS bug — it's a fracture of trust.

That's the thesis.
