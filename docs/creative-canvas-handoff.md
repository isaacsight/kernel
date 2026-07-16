# Unified Creative Canvas — Claude Code Handoff

Last verified: 2026-07-14 (America/Los_Angeles)

## Read this first

The canonical agent-controlled product surface is the unified canvas at `/#/canvas-creative`.

It combines two local implementations:

1. The original Antigravity editorial workflow canvas: input, specialist, model, and output nodes; graph execution; `canvas-state.json` polling; and the `kernel_canvas_state` MCP tool.
2. The newer Creative Studio: infinite dark canvas, prompt/agent/model/image/video/output/note nodes, GALLEY planning, reusable techniques, direct agent tools, real text and image execution, and topological full-graph runs.

> Naming: the in-canvas agent is **GALLEY** (renamed 2026-07-14; it launched as FAUNA, but FLORA — flora.ai, formerly florafauna.ai — ships a commercial agent named FAUNA, so the name was ceded). A galley proof is the pressroom draft pulled for the editor to mark up, which is exactly this agent's contract: it drafts, the human adjudicates.

Do not build a third canvas. Continue the unified `CreativeCanvasPage` and preserve legacy compatibility.

## Routes

| Route | Purpose |
|---|---|
| `/#/canvas-creative` | Unified agent-controlled canvas |
| `/#/studio` | Redirects to `/#/canvas-creative` |
| `/#/canvas` | Removed from the publication; unknown routes return to the cover |

The unified canvas route requires an authenticated session (added 2026-07-14). Unauthenticated visitors see the `LoginGate`, matching `EnginePage`. This is a personal work surface: the engine proxy 401s without a session anyway, so the gate moved to the door. Note the side effects: the `creative_canvas_*` tools register and the `canvas-state.json` polling loop starts only after auth.

## Authoritative files

| File | Responsibility |
|---|---|
| `src/pages/CreativeCanvasPage.tsx` | Unified canvas state, rendering, execution, GALLEY, agent tools, legacy-state adapter |
| `src/pages/CreativeCanvasPage.css` | Unified canvas presentation and responsive behavior |
| `src/router.tsx` | Canonical Creative Studio route and `/studio` redirect |
| `public/canvas-state.json` | Filesystem bridge read by the browser every 2.5 seconds |
| `tools/kernel-tools-mcp.ts` | External `kernel_canvas_state` MCP tool |

## Unified node contract

```ts
type NodeKind =
  | 'prompt'
  | 'agent'
  | 'model'
  | 'image'
  | 'video'
  | 'output'
  | 'note'

interface StudioNode {
  id: string
  kind: NodeKind
  x: number
  y: number
  title: string
  content: string
  model?: string
  imageUrl?: string
  result?: string
  status?: 'idle' | 'running' | 'done' | 'error'
}

interface StudioEdge {
  id: string
  from: string
  to: string
}
```

### Legacy compatibility

The browser automatically converts Antigravity state:

| Legacy type | Unified kind |
|---|---|
| `input` | `prompt` |
| `specialist` | `agent` |
| `model` | `model` |
| `output` | `output` |

Legacy edges `{ fromNode, toNode }` are converted to `{ from, to }`. Do not remove this adapter while `kernel_canvas_state` callers may still emit the legacy format.

## In-app agent tools

These tools are registered in the global Kernel tool registry while the canvas route is mounted:

### `creative_canvas_inspect`

Returns the live project name, nodes, edges, selection, viewport, and valid models.

### `creative_canvas_control`

Accepts an ordered `actions` array. Supported actions:

```json
[
  {
    "type": "add",
    "temp_id": "research-step",
    "kind": "agent",
    "title": "Research agent",
    "content": "Find the strongest evidence for the campaign claim.",
    "model": "Researcher Agent",
    "after": "brief-node-id"
  },
  {
    "type": "connect",
    "from": "research-step",
    "to": "output-node-id"
  },
  {
    "type": "run",
    "id": "research-step"
  }
]
```

Other actions are `update`, `move`, and `delete`. New nodes can be referenced by `temp_id` later in the same request. Commands are capped, IDs are resolved deterministically, and model choices are validated against the selected node kind.

### `creative_canvas_run`

Executes the entire graph in topological order. Connected upstream results are passed into downstream nodes.

### `creative_canvas_agent_loop`

The single-entry autonomous workflow tool. It accepts a concrete `goal` and an optional `maxIterations` from 1–4. Each bounded pass inspects the graph and runtime results, plans minimal changes, executes the graph, evaluates whether the goal is complete, and either revises or stops. The same loop is available from the GALLEY composer using the **Loop** button.

## External Claude Code / MCP control

`kernel_canvas_state` is defined in `tools/kernel-tools-mcp.ts`.

Supported actions:

- `get`: inspect `public/canvas-state.json`.
- `set`: replace nodes and edges. Both legacy and unified formats are accepted by the browser.
- `reset`: clear the graph.
- `run`: stamp `runRequestedAt`; the open browser notices it and executes the graph.
- `loop`: stamp a concrete `goal` and `maxIterations`; the open browser runs GALLEY's bounded inspect → plan → execute → evaluate loop.

External handoff sequence:

1. Call `kernel_canvas_state` with `action: "get"`.
2. Preserve node IDs that are not being changed.
3. Call `set` with the complete desired node and edge arrays.
4. Wait for the browser poll (up to 2.5 seconds).
5. Call `run` for a deterministic graph execution, or call `loop` with a goal to let GALLEY build, execute, evaluate, and revise the workflow.
6. Call `get` again to confirm filesystem state. Runtime node results live in the browser unless explicitly persisted later.

Minimal Claude Code invocation:

```json
{
  "action": "loop",
  "goal": "Research Flora AI, compare it with ComfyUI, Krea, Runway, and Weavy, then produce a cited decision brief in an output node.",
  "maxIterations": 3
}
```

Keep `http://localhost:5173/#/canvas-creative` open and authenticated while the loop runs. The 1–4 iteration cap is a safety boundary, not a promise that unavailable credentials, credits, or provider endpoints can be bypassed.

## Execution behavior

- `prompt` and `note` pass their content downstream.
- `agent` and `model` call the active Kernel provider through `getProvider()`.
- `image` calls the existing Supabase-backed `generateImage()` service.
- `video` prepares the workflow but does not yet have a rendering endpoint.
- `output` compiles connected upstream results.
- Full graph execution detects cycles by comparing visited nodes with total nodes.

## Persistence and synchronization

- Browser edits autosave to local storage under `kernel-creative-studio-v1`.
- `public/canvas-state.json` is an external local-agent bridge.
- The unified canvas polls the file every 2.5 seconds and applies newer `updatedAt` states.
- An external file update can supersede browser-local graph state. This is intentional for agent control.
- The browser does not currently write its edits back to `canvas-state.json`.

## Known limitations

1. Video nodes do not render real video yet.
2. Image execution requires a signed-in session and available image credits.
3. Agent/model execution requires the active provider proxy to be configured.
4. Runtime results are not written back through the filesystem bridge.
5. There is no undo/redo command log yet.
6. `kernel_canvas_state set` replaces the complete external graph rather than patching it.
7. The classic implementation remains for regression safety and should not receive new features unless the unified route breaks.

## Verification

```bash
npm run build
npm run dev -- --host 127.0.0.1
```

Open `http://localhost:5173/#/canvas-creative`.

Expected signals:

- Page title is `Creative Studio · kernel.chat`.
- Existing legacy `canvas-state.json` appears as prompt, agent, and output nodes.
- The header contains `Run graph`.
- The node dock contains Prompt, Agent, Model, Image, Video, Output, and Note.
- GALLEY reports that it has canvas control.
- Browser console contains no errors.

The production build passed after the merge. The unified route was also inspected in the local browser with legacy state loaded and no console errors.

## Working-tree warning

The repository contains unrelated and pre-existing uncommitted work. Do not reset, clean, stage, or rewrite files outside the canvas scope without explicit instruction. In particular, preserve existing changes in editorial components, `SCRATCHPAD.md`, local skills, sales documents, videos, and output artifacts.

## Ready-to-paste Claude Code prompt

```text
Continue the unified Creative Canvas in this repository.

First read CLAUDE.md, KERNEL.md, and docs/creative-canvas-handoff.md completely. The unified agent-controlled route is /#/canvas-creative; the former /#/canvas publication route has been removed. Do not create another canvas or replace the current architecture. Preserve compatibility with Antigravity's legacy canvas-state.json node/edge schema and the kernel_canvas_state MCP tool.

Before editing, inspect the current working tree and preserve unrelated changes. Run npm run build after implementation. Do not restore /#/canvas as a publication fallback.

Current priorities, in order:
1. Add browser-to-filesystem result persistence without creating update loops.
2. Add undo/redo through a bounded command history shared by human and agent actions.
3. Add a real video-provider adapter behind video nodes.
4. Add focused tests for unified legacy conversion, agent commands, topological execution, and cycle handling.

Report exactly which files changed, what was verified, and any provider or credential requirement that remains.
```
