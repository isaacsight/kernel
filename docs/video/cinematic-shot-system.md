# The Shot Is the Unit

Status: production law for generated and HyperFrames-authored films.

The existing system is excellent at making resolved editorial frames. This layer prevents those frames from becoming a slideshow. A frame is now evidence of a shot; the shot is the authored unit.

## The contract

Every storyboard frame must declare these fields:

```md
- visual_mode: cinematic | hybrid | graphic | quiet
- action: The physical event and its consequence.
- camera: The camera's observable path or lens change.
- depth: Foreground, midground, and background behavior.
- transformation: What is irreversibly different by the end.
- surprise: The turn the opening image does not predict.
- start_state: Optional but recommended description of the opening image.
- end_state: Optional but recommended description of the closing image.
```

`action` is not an entrance animation. “The title fades in” describes software. “The title tears through the paper and exposes the workshop behind it” describes an event.

`camera` is not a transition. Crossfade, wipe, and push-slide describe the edit between shots. Orbit, crane, dive, track, rack focus, whip, and pull-back describe perception inside the shot.

`depth` names all three planes and how they interact. Foreground material should occasionally occlude the subject. Midground owns the action. Background establishes scale, atmosphere, or consequence.

`transformation` must change the visual proposition. A larger number is usually not a transformation. A ledger flooding until it becomes a city is.

`surprise` must be visible, not merely narrated. It may be small and quiet, but the opening image must not fully predict it.

## Mode budget

Across a film:

- At least 50% of frames are `cinematic` or `hybrid`.
- `graphic` frames carry measurements, proof, typography, and diagrams.
- `quiet` frames are earned rests and should remain at or below 20%.
- Brand typography and the tomato/ink/ivory palette connect the worlds; they do not have to occupy every pixel.

This is a floor, not a recipe. A generated narrative film may be almost entirely cinematic. A data feature may sit near the minimum and use hybrid mechanisms to carry evidence.

## Shot construction order

Author each beat in this order:

1. Emotional beat — what changes in the viewer.
2. Physical event — what happens in the world.
3. Camera path — how the viewer discovers it.
4. Depth stack — what passes before, around, and behind the subject.
5. Transformation — the ending image and its consequence.
6. Surprise — the turn.
7. Graphic layer — typography, labels, readings, and publication marks.

Layout comes last. The still poster is selected from the shot, not used as the shot's source of truth.

## Rhythm law

Use contrast, not constant frenzy. Name the film's rhythm before building it, for example:

`impact → pursuit → stillness → transformation → proof → eruption → hold`

At least one adjacent pair must change two or more of these dimensions:

- scale: macro / human / architectural
- velocity: still / drifting / fast
- camera: locked / travelling / unstable
- material: paper / light / liquid / physical object / typography
- density: sparse / layered / crowded

Dynamic does not mean everything moves. It means movement changes meaning.

## Hybrid shot recipe

Hybrid is the native kernel.chat mode. It lets factual graphics live inside a physical world:

- A measured number is printed on a ticket moving through a real chute.
- A comparison grid is a wall the camera travels along.
- A waveform becomes a thread that pulls the next scene open.
- A ruled frame is a window into a generated environment.
- A typographic word becomes matter: paper, stencil, shadow, signage, or an object the subject handles.

The evidence stays exact. The presentation gains consequence.

## Generation direction

For generated shots, prompts describe one subject, one action, and one camera instruction. Keep identity and geometry constraints separate from motion. Prefer image-to-video when subject continuity matters. A motion prompt should say what moves, what remains fixed, how the camera moves, and what the final state is.

Avoid asking one short clip to perform several unrelated transformations. Use the edit for discontinuity and the shot for one legible event.

## HyperFrames direction

HyperFrames remains responsible for exact typography, data, diagrams, compositing, and deterministic finishing. Generated video supplies physical worlds and hard-to-simulate events. Three.js or shaders may supply fully deterministic spatial shots when appropriate.

Do not fake cinematography by applying the same 3% scale push to every flat frame. Camera motion needs parallax, occlusion, focus change, or a meaningful change of viewpoint.

## Audio direction

Every hero event gets an audio consequence. Design three layers:

- environment: the space exists before the action;
- material: paper, metal, breath, glass, motor, cloth;
- punctuation: the single hit, cut, silence, or tonal change that marks transformation.

Sound should sometimes lead the picture. A cue arriving 2–6 frames early creates anticipation; silence immediately after impact gives the event weight.

## Gate

Run:

```bash
npm run lint:cinematic -- path/to/STORYBOARD.md
```

The gate rejects missing shot fields, cinematic frames made only from layout reveals, and films without a cinematic/hybrid majority. Warnings identify weak camera verbs and incomplete depth plans.

The lint is intentionally semantic and conservative. Passing it does not make a shot good. Failing it means the plan has not yet described a shot.

## Compile

Once the gate passes, compile the storyboard into an executable production plan:

```bash
npm run video:compile-shots -- path/to/STORYBOARD.md --output=shot-plan.json
```

The compiler adds the layer that a preset picker cannot:

- film-wide subject, location, palette, material, and lens locks;
- per-shot routing between generated video and deterministic HyperFrames work;
- separate keyframe and motion prompts;
- four deliberately different candidates instead of four accidental retries;
- hard-reject criteria followed by a 100-point selection rubric;
- estimated batch cost with both keyframe and paid-generation approval gates intact;
- a finishing handoff for the selected shot.

The output is a local JSON plan. Compilation never submits a paid request. A generation runner may consume the plan later, but it must preserve the existing explicit cost-confirm contract.

## Creative graph

The shot plan can become a reusable GALLEY canvas workflow:

```bash
npm run video:compile-graph -- path/to/STORYBOARD.md --output=creative-graph.json
```

This incorporates the strongest idea from node-based creative environments—models as inspectable steps—while adding production guarantees that a general canvas does not provide automatically:

- every node carries typed lineage back to its brief, shot, continuity source, batch, cost, and approval state;
- generated shots expand into approved keyframe → candidate batch → blind critic → selected take;
- the critic sees the work and rubric, not the model brand, limiting reputation bias;
- rejected candidates remain attached to the decision instead of disappearing from history;
- deterministic and generated shots coexist in the same directed acyclic graph;
- sound direction joins the master as a first-class dependency;
- the final master requires a receipt containing sources, prompts, routes, costs, rejections, scores, and approvals.

The graph uses the existing Creative Canvas node contract and can be loaded through its external state bridge. Its audit rejects cycles, dangling links, missing lineage, missing batch members, and masters without a receipt policy.
