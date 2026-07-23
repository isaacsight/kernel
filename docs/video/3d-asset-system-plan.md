# 3D Asset Tournament

Status: PARKED — reference plan only. Do not implement, subscribe, generate, or spend without a new explicit request.

## Purpose

Add persistent physical assets to the cinematic system when a film needs real camera parallax, repeatable subjects, stable props, or reusable environments. The system should own provider selection, comparison, cleanup, provenance, and delivery instead of depending on one generation company.

## Proposed provider roles

| Role | Provider |
|---|---|
| Default hosted generation | Tripo |
| Premium hero-asset challenger | Hyper3D Rodin |
| Rigging and animation specialist | Meshy |
| Local research route | TRELLIS.2 and Hunyuan3D |
| Cleanup and final authority | Blender |
| Optional real-time delivery | Unity |

No provider is the permanent winner. Models remain replaceable stages.

## Pipeline

```text
approved references
        ↓
provider candidates
        ↓
local download and provenance receipt
        ↓
Blender normalization and inspection
        ↓
standardized turntable renders
        ↓
geometry, material, and continuity scoring
        ↓
human selection
        ↓
cleanup, rigging, and animation
        ↓
cinematic render or Unity handoff
        ↓
HyperFrames typography and finishing
```

## Evaluation rubric

Every candidate should be inspected under identical lighting and camera conditions for:

- silhouette fidelity;
- multiview consistency;
- manifold geometry and hidden surfaces;
- topology and deformation readiness;
- polygon budget;
- UV integrity and texture seams;
- PBR map completeness;
- scale, orientation, origin, and pivot correctness;
- rig deformation where applicable;
- Blender and Unity import health;
- continuity with the approved references and neighboring shots.

Hard failures are non-manifold geometry that prevents intended use, missing load-bearing surfaces, severe identity drift, unusable UVs, corrupted exports, or license/provenance uncertainty.

## Recommended pilot

Budget ceiling: $50.

1. Generate ten reference assets through Tripo.
2. Send the strongest five references through Meshy.
3. Compare no more than two hero assets with Rodin.
4. Import every candidate into Blender.
5. Normalize scale, orientation, pivot, camera, and lighting.
6. Render identical turntables and inspection passes.
7. Score results without showing the evaluator the provider name.
8. Record quality, failure rate, latency, and actual cost per accepted asset.
9. Decide whether a multi-provider system beats a Tripo-only pipeline by enough to justify its complexity.

## Expected operating cost

Indicative only; re-verify provider pricing before activation.

- Lean stack without Rodin: approximately $30–$80 per month.
- Tripo + Meshy + Rodin pilot stack: approximately $150–$250 per month.
- Three-provider comparison: approximately $0.90–$1.40 per asset before retakes.
- Adding a cloud-hosted open model may raise a comparison to approximately $1.40–$4.40.
- Broad candidate tournaments may cost approximately $4–$13 per accepted asset.

## Implementation phases

### Phase 1 — provider-neutral contract

Define job submission, status, result download, estimated cost, supported inputs, output formats, and immutable receipts. Reuse GALLEY's existing estimate-before-spend and local-ownership rules.

### Phase 2 — Tripo adapter

Support text, image, and multiview generation; PBR options; topology controls; async polling; and local GLB download. This is the first integration because it offers the best balance of breadth, cost, and accessibility.

### Phase 3 — Blender inspection

Automate import, transforms, manifold checks, polygon counts, material inventory, missing texture detection, UV checks, turntable setup, and inspection renders. Blender becomes the authoritative asset record.

### Phase 4 — provider tournament

Add Meshy and Rodin adapters behind the same contract. Generate controlled candidates, blind the evaluator to provider identity, retain rejected alternatives, and promote only candidates clearing the rubric.

### Phase 5 — local research models

Evaluate TRELLIS.2 and Hunyuan3D when suitable compute is available. Use them for private drafts, cost control, and scientific independence rather than assuming they automatically replace hosted production services.

### Phase 6 — delivery

Add optional rigging, animation, cinematic Blender rendering, Unity validation, and HyperFrames compositing. Ship the asset, source references, license context, prompts, costs, checks, and transformation history together.

## Activation conditions

Do not begin implementation until a real film or interactive artifact needs at least one of:

- the same object from several camera angles;
- persistent character or prop identity across shots;
- physically correct camera parallax or occlusion;
- a reusable environment;
- a deliverable GLB, FBX, OBJ, USDZ, or Unity asset.

At activation time, re-check provider models, API availability, prices, retention, training policy, commercial terms, and rate limits. Never handle provider secrets in the repository, and never submit a paid task without the existing explicit approval gate.
