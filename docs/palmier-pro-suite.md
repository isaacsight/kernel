# Palmier Pro workflow suite

This repository adds a 32-tool production platform on top of Palmier Pro's MCP primitives. Each planner compiles creative intent into inspectable Palmier operations before anything touches the timeline.

## Tools

| ID | Product tool | Outcome |
|---|---|---|
| `director` | Director | Brief to a protected, structured timeline |
| `campaign` | Campaign Studio | Product campaign variants across aspect ratios |
| `shots` | Shot Lab | Timeline-aware generated coverage |
| `continuity` | Continuity Engine | Reference, composition, and color drift review |
| `productTruth` | Product Truth | Product, UI, text, and claim verification |
| `recast` | Recast Studio | Consent-gated identity replacement planning |
| `style` | Style Director | Project-wide color and effect application |
| `transitions` | Transition Designer | Cut inspection and optional bridge insertion |
| `performance` | Performance Editor | Silence, transcript, audio, and caption workflow |
| `shorts` | Shorts Factory | Protected social timeline derivatives |
| `critic` | Edit Critic | Non-mutating pacing and clarity review |
| `deliver` | Finish and Deliver | Approval-gated export matrix |

### Professional foundation

| ID | Product tool | Outcome |
|---|---|---|
| `mediaPipeline` | Media Pipeline | Proxy, relink, consolidate, cache, and RAW workflow |
| `compositor` | Compositor | Node graphs, masks, tracking, keying, cleanup, and 2.5D |
| `colorPipeline` | Color Pipeline | Managed color, HDR, scopes, matching, and delivery transforms |
| `audioPost` | Audio Post | Dialogue, buses, mixing, immersive sound, and stems |
| `collaboration` | Multiplayer Timeline | Presence, permissions, merging, and review |
| `recovery` | Recovery and Interchange | Autosave, repair, packaging, and professional handoff |

### AI parity and next-generation production

| ID | Product tool | Outcome |
|---|---|---|
| `generativeExtend` | Generative Extend | Editable head, tail, ambience, and transition handles |
| `intelligence` | Media Intelligence | Multimodal search, ranking, and footage understanding |
| `localization` | Localization Studio | Translation, dubbing, lip sync, and regional versions |
| `avatar` | Avatar Studio | Consent-bound synthetic presenters |
| `motionGraphics` | Motion Graphics | Procedural typography and reusable brand animation |
| `spatial` | Spatial Studio | Depth-aware, immersive, VR, and spatial audio workflows |

### Agentic moat and governance

| ID | Product tool | Outcome |
|---|---|---|
| `productionMemory` | Production Memory | Durable facts, references, constraints, and decisions |
| `coverage` | Coverage Agent | Find missing story evidence before generating |
| `assembly` | Autonomous Assembly Room | Specialist-agent production planning |
| `compiler` | Generative Timeline Compiler | Intent to editable tracks, clips, prompts, and alternates |
| `optimizer` | Outcome Optimizer | Creative-decision attribution and experimentation |
| `provenance` | Rights and Provenance Graph | License, consent, model, prompt, and export traceability |
| `router` | Model Router | Quality, cost, latency, capability, and rights routing |
| `living` | Living Deliverables | Governed, refreshable audience and regional variants |

## CLI

```bash
npm run video:palmier:suite -- list
node tools/palmier/suite.mjs adapters
npm run video:palmier:suite -- plan director --input brief.json
npm run video:palmier:suite -- run performance --input performance.json
```

Planning is the default safe workflow. `run` connects to Palmier Pro at `http://127.0.0.1:19789/mcp`, validates every operation against the app's currently advertised MCP schemas, and then executes it. A plan with `status: adapter_required` names the missing engine capability and refuses execution; this keeps the suite honest while giving Palmier a stable implementation contract.

Paid generations remain skipped unless the caller adds `--approve-generation`. Final exports remain skipped unless the caller adds `--approve-final`.

```bash
npm run video:palmier:suite -- run shots --input shots.json --approve-generation
npm run video:palmier:suite -- run deliver --input delivery.json --approve-final
```

## Input examples

### Director

```json
{
  "brief": "Launch Palmier Pro to startup founders",
  "variant": "Founder launch",
  "beats": [
    { "label": "The old workflow", "startFrame": 0, "endFrame": 90 },
    { "label": "Palmier reveal", "startFrame": 90, "endFrame": 180 }
  ]
}
```

### Performance Editor

```json
{
  "removeWords": ["um", "uh"],
  "denoiseClipIds": ["a1b2"],
  "captions": true,
  "captionStyle": { "bold": true, "fontSize": 54 }
}
```

### Finish and Deliver

```json
{
  "deliveries": [
    { "mode": "video", "codec": "H.264", "resolution": "1080p" },
    { "mode": "fcpxml" }
  ]
}
```

## Current boundary

The original workflow tools map substantially to current Palmier MCP operations. The expanded foundation tools expose every capability that still requires native app work, including compositing, managed color, audio buses, proxies, realtime collaboration, spatial media, provenance signing, and analytics connectors. Recast and Avatar Studio enforce consent and reference inspection, but native identity replacement is not advertised by the current MCP server.

The suite is therefore both executable software and a capability boundary: supported operations run today; missing engine primitives are named, testable contracts rather than fabricated results.
