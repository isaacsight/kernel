# Palmier Pro tool research

## Product thesis

Palmier Pro should own the workflow between a creative brief and a finished, deliverable timeline. Generation platforms such as Higgsfield and Runway optimize for making individual assets. Palmier's defensible advantage is combining imported footage, generated media, agent edits, and finishing operations in one local-first project.

## Best initial content categories

1. Product launches — already validated by Palmier's public portfolio and a strong fit for mixed UI capture, live action, generated footage, and typography.
2. Product demos — a repeatable workflow where an agent can structure raw screen recordings and build proof-first edits.
3. Short-form social — valuable because one master can produce multiple aspect ratios, durations, hooks, and caption variants.
4. Brand films — a higher-value workflow that benefits from continuity references, first/last-frame generation, and human approval gates.

## Tool roadmap

The roadmap is now represented by the executable 32-tool catalog in `tools/palmier/suite/catalog.mjs`. The catalog separates timeline-native workflows from engine-level adapters so professional parity work cannot be mistaken for completed rendering infrastructure.

### Foundation (implemented in this repository)

- `content-plan.mjs`: converts a brief into a timed, structured production plan for launch, demo, social, or brand content.
- `audit-project.mjs`: detects timeline gaps, overlaps, extreme speed changes, linked-audio state, and text clips.
- `cut-sheet.mjs`: renders frames around every edit for visual review.
- `master-export.mjs`: performs two-pass loudness normalization.
- `qc-export.mjs`: validates an export against configurable web, social, or broadcast delivery profiles.

### Next product tools

1. Brief-to-timeline — turn the content plan into markers and placeholders through MCP.
2. Transcript editor — remove filler, pauses, and weak takes while preserving reversible source ranges.
3. Social repurposer — derive 9:16, 1:1, and 16:9 cuts with alternate hooks from a locked master.
4. Continuity inspector — compare adjacent generated shots for subject, wardrobe, lighting, direction, and screen-position drift.
5. Caption designer — transcribe locally, segment semantically, and apply reusable brand-safe caption systems.
6. Product-demo composer — combine screen recordings, cursor emphasis, callouts, voiceover, and result shots.
7. Claims and brand review — flag unsupported claims, stale UI, missing logos, unsafe text margins, and inconsistent typography.
8. Delivery matrix — export and verify every platform variant from one approved timeline.

## Guardrails

- Keep source edits reversible and retain generation prompts and references.
- Require approval before paid generation, destructive timeline replacement, picture lock, or final delivery.
- Prefer showing real product evidence over generated interface footage.
- Treat local processing and project privacy as part of the product, not an implementation detail.

## Sources

- Palmier homepage and FAQ: https://www.palmier.io/
- Palmier documentation: https://www.palmier.io/docs
- Palmier work portfolio: https://www.palmier.io/work
- Palmier pricing: https://www.palmier.io/pricing
- Higgsfield Apps catalog: https://higgsfield.ai/apps
