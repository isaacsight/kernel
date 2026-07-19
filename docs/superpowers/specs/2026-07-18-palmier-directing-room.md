# Palmier / GALLEY Directing Room

## Purpose

Capture an idea while it is still small, then develop it through distinct
creative intelligences without confusing planning approval with permission to
spend. The Directing Room belongs before generation and beside the Palmier
timeline. Its deliverable is an editable greenlight packet, not a flattened
film.

## The room

```text
Idea
  → Creative Director — project constitution and refusals
  → Director — treatment, beats, coverage, performance and shots
      ↘ VFX Supervisor — reversible shot construction and feasibility
      ↘ Editor — rhythm, continuity, sound and footage economy
  → Human greenlight packet
  → approved production nodes
  → GALLEY estimate / approve-or-refuse / render / receipt
  → Palmier edit, VFX and finishing
```

The Creative Director protects the whole world. The Director solves the moment
in front of the camera. The VFX Supervisor explains how difficult shots remain
editable. The Editor protects sequence, economy and meaning. Their disagreement
is evidence and stays visible to the human.

## Memory levels

1. **Project constitution:** intent, audience, emotional arc, palette,
   typography, materials, camera, lighting, ALWAYS / AVOID / NEVER rules.
2. **Sequence memory:** beats, rhythm, coverage, sound, continuity and pacing.
3. **Shot memory:** prompts, anchors, protected regions, takes, masks, passes,
   effects, seeds, estimates and generated assets.
4. **Decision ledger:** approvals, refusals, revisions, exceptions, reasons,
   model/version, operator and time.

Each intelligence reads the levels relevant to its work. Only the Creative
Director may propose a constitution change; every change requires human
approval. The Director may file an exception but cannot silently rewrite the
constitution to justify a shot.

## Idea intake

The first input can be one sentence. Missing detail becomes an open question,
not an invented fact. Intake expands gradually:

- idea and intended feeling;
- audience and format;
- references and anti-references;
- budget or spending ceiling;
- schedule and delivery formats;
- people, products or identities that must remain consistent;
- accessibility, legal, brand and safety constraints;
- what success looks like and what must never happen.

The intake remains editable throughout development. A material change reopens
downstream approvals instead of silently inheriting old decisions.

## Human gates

The greenlight packet ends with four separate controls:

- **Approve plan:** freeze the current constitution and treatment.
- **Revise:** return precise notes to the owning intelligence.
- **Refuse:** close the proposal while preserving its record.
- **Approve paid execution:** authorize a priced production batch only after a
  current GALLEY estimate. Plan approval never implies spending approval.

## VFX direction

VFX plans are graphs of reversible operations: source plate, track, camera,
depth, mattes, clean plate, procedural or generated passes, composite, grade
and validation. Generated work should request structured passes—alpha, depth,
normals, shadow and motion—when available. Palmier keeps effects named,
disableable and reconstructable from receipts.

## First implementation

`src/engine/directingRoom.ts` defines a planning-only canvas blueprint. The
Creative Studio exposes it as the **Directing room** template. Loading it creates
no image or video node and cannot spend. Running the graph asks the four roles
to develop the selected idea and compiles their work into a human greenlight
packet.

## Next increments

1. Structured constitution and shot-plan schemas with version migration.
2. A persistent decision ledger with approval invalidation on upstream edits.
3. Storyboard and animatic nodes generated only after plan approval.
4. Palmier timeline objects for masks, tracks, effects and shot receipts.
5. Project-wide continuity inspection and exception review.
6. Estimate aggregation by shot, quality tier and local/paid route.
