// Peekaboo tools — kbot tool-registry surface for the macOS Peekaboo CLI.
//
// Wraps src/adapters/peekaboo so the LLM tool layer can drive AX-aware
// snapshots, clicks, typing, value-set, named-action invocation, and the
// peekaboo agent subcommand. App-bound calls are gated by the same per-app
// approval contract computer.ts uses; because computer.ts does not export
// its in-process `approvedApps` set, this module falls back to checking
// the on-disk Coordinator lock file at ~/.kbot/computer-use/<app>.lock as
// a best-effort cross-process signal — see requireApproval() below.

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { registerTool, type ToolDefinition } from './index.js'
import {
  see,
  click,
  type_,
  setValue,
  performAction,
  agent,
  peekabooAvailable,
  type PeekabooOutcome,
} from '../adapters/peekaboo/index.js'

// ── Approval gate ──────────────────────────────────────────────────────
//
// computer.ts holds an in-process `approvedApps` Set keyed by lowercase app
// name, plus a Coordinator that writes a per-app lock file at
// ~/.kbot/computer-use/<app>.lock when an *active* claim is held.
//
// Limitation: the `approvedApps` set is not exported and the Coordinator
// lock file only exists during an active claim, not after a bare
// app_approve. So from a sibling module like this one we cannot directly
// observe approval state. We treat the lock-file presence as the strongest
// available cross-process approval signal — if the user has driven the app
// through computer.ts at all this session, the lock file will exist
// (computer.ts re-acquires + retains during the call). When we can't see
// it, we fail closed with a clear pointer to `app_approve`.

const LOCK_ROOT =
  process.env.KBOT_COMPUTER_USE_ROOT || join(homedir(), '.kbot', 'computer-use')

/** Mirror of computer-use-coordinator.ts#sanitizeApp — keep in sync. */
function sanitizeApp(app: string): string {
  return app.replace(/[/\\ -]/g, '_')
}

function lockPath(app: string): string {
  return join(LOCK_ROOT, `${sanitizeApp(app.toLowerCase())}.lock`)
}

/** Returns null when the gate passes, or an `Error: ...` string on denial. */
function requireApproval(app: string): string | null {
  if (!app) return null
  if (existsSync(lockPath(app))) return null
  return `Error: ${app} is not approved for computer use. Run app_approve first (or drive a computer.ts tool against ${app} so the Coordinator lock is created).`
}

// ── Outcome → string helpers ───────────────────────────────────────────

function outcomeToString<T>(out: PeekabooOutcome<T>): string {
  if (!out.ok) {
    const err = out.error
    const detail = err.stderr?.trim() || err.message
    return `Error: peekaboo ${err.code}: ${detail}`
  }
  // Strip the discriminant before pretty-printing the success payload.
  const { ok: _ok, ...payload } = out as { ok: true } & Record<string, unknown>
  void _ok
  return JSON.stringify(payload, null, 2)
}

async function ensureBinary(): Promise<string | null> {
  const ok = await peekabooAvailable()
  if (ok) return null
  return "Error: peekaboo CLI not found on PATH. Install via 'brew install steipete/tap/peekaboo' or 'npm i -g @steipete/peekaboo'."
}

// ── Tool definitions ───────────────────────────────────────────────────

const peekabooSee: ToolDefinition = {
  name: 'peekaboo_see',
  description:
    'Capture an AX snapshot of an app or the screen via the Peekaboo CLI. Returns a snapshot id plus a list of element ids (e.g. elem_19, elem_169) usable by peekaboo_click / peekaboo_type.',
  parameters: {
    app: {
      type: 'string',
      description:
        'Target app name (optional). When supplied, the app must be approved via app_approve.',
    },
    mode: {
      type: 'string',
      description: 'Capture mode: "screen" (default) or "window".',
    },
    retina: {
      type: 'boolean',
      description: 'Capture at retina resolution (optional).',
    },
  },
  tier: 'free',
  async execute(args) {
    const binErr = await ensureBinary()
    if (binErr) return binErr

    const app = typeof args.app === 'string' && args.app.length > 0 ? args.app : undefined
    if (app) {
      const gate = requireApproval(app)
      if (gate) return gate
    }

    const mode = args.mode === 'window' || args.mode === 'screen' ? args.mode : undefined
    const retina = args.retina === true

    try {
      const out = await see({
        ...(app ? { app } : {}),
        ...(mode ? { mode } : {}),
        ...(retina ? { retina: true } : {}),
      })
      return outcomeToString(out)
    } catch (e) {
      return `Error: ${(e as Error).message}`
    }
  },
}

const peekabooClick: ToolDefinition = {
  name: 'peekaboo_click',
  description:
    'Click against a Peekaboo snapshot. Provide either `on` (element id or query) or `coords` ("x,y"). Requires a prior peekaboo_see.',
  parameters: {
    app: {
      type: 'string',
      description: 'App being targeted. Required for the approval gate.',
      required: true,
    },
    snapshot: {
      type: 'string',
      description: 'Snapshot id from peekaboo_see.',
      required: true,
    },
    on: {
      type: 'string',
      description: 'Element id (e.g. "elem_169") or query string. Mutually exclusive with coords.',
    },
    coords: {
      type: 'string',
      description: 'Click coordinates as "x,y" (numbers). Mutually exclusive with on.',
    },
    wait: {
      type: 'number',
      description: 'Optional pre-click wait in milliseconds.',
    },
  },
  tier: 'free',
  async execute(args) {
    const binErr = await ensureBinary()
    if (binErr) return binErr

    const app = String(args.app ?? '')
    if (!app) return 'Error: app is required.'
    const gate = requireApproval(app)
    if (gate) return gate

    const snapshot = String(args.snapshot ?? '')
    if (!snapshot) return 'Error: snapshot is required.'

    const on = typeof args.on === 'string' && args.on.length > 0 ? args.on : undefined
    let coords: [number, number] | undefined
    if (typeof args.coords === 'string' && args.coords.length > 0) {
      const parts = args.coords.split(',').map((p) => Number(p.trim()))
      if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) {
        return 'Error: coords must be "x,y" (numbers).'
      }
      coords = [parts[0], parts[1]]
    }
    if (!on && !coords) return 'Error: provide either `on` or `coords`.'

    const wait = typeof args.wait === 'number' && Number.isFinite(args.wait) ? args.wait : undefined

    try {
      const out = await click({
        snapshot,
        ...(on ? { on } : {}),
        ...(coords ? { coords } : {}),
        ...(wait !== undefined ? { wait } : {}),
      })
      return outcomeToString(out)
    } catch (e) {
      return `Error: ${(e as Error).message}`
    }
  },
}

const peekabooType: ToolDefinition = {
  name: 'peekaboo_type',
  description:
    'Type text into the focused field via the Peekaboo CLI. Use peekaboo_click to focus first.',
  parameters: {
    app: {
      type: 'string',
      description: 'App being targeted. Required for the approval gate.',
      required: true,
    },
    text: {
      type: 'string',
      description: 'Text to type.',
      required: true,
    },
    clear: {
      type: 'boolean',
      description: 'Clear the field before typing (optional).',
    },
    delay_ms: {
      type: 'number',
      description: 'Per-character delay in milliseconds (optional).',
    },
  },
  tier: 'free',
  async execute(args) {
    const binErr = await ensureBinary()
    if (binErr) return binErr

    const app = String(args.app ?? '')
    if (!app) return 'Error: app is required.'
    const gate = requireApproval(app)
    if (gate) return gate

    const text = typeof args.text === 'string' ? args.text : ''
    if (!text) return 'Error: text is required.'
    const clear = args.clear === true
    const delayMs =
      typeof args.delay_ms === 'number' && Number.isFinite(args.delay_ms) ? args.delay_ms : undefined

    try {
      const out = await type_({
        text,
        ...(clear ? { clear: true } : {}),
        ...(delayMs !== undefined ? { delayMs } : {}),
      })
      return outcomeToString(out)
    } catch (e) {
      return `Error: ${(e as Error).message}`
    }
  },
}

const peekabooSetValue: ToolDefinition = {
  name: 'peekaboo_set_value',
  description:
    "Set a settable AX value directly on an element (skips clicking). NOTE: requires Peekaboo CLI with the 'set-value' top-level command, which is absent in 3.0.0-beta4. Use peekaboo_click + peekaboo_type as a workaround.",
  parameters: {
    app: {
      type: 'string',
      description: 'App being targeted. Required for the approval gate.',
      required: true,
    },
    snapshot: {
      type: 'string',
      description: 'Snapshot id from peekaboo_see.',
      required: true,
    },
    on: {
      type: 'string',
      description: 'Target element id or query (must be settable).',
      required: true,
    },
    value: {
      type: 'string',
      description: 'Value to assign.',
      required: true,
    },
  },
  tier: 'free',
  async execute(_args) {
    void setValue
    return (
      "Error: peekaboo_set_value requires Peekaboo CLI with the 'set-value' top-level command, " +
      'which is not present in 3.0.0-beta4. Workaround: peekaboo_click then peekaboo_type. ' +
      'Track upstream: https://github.com/openclaw/Peekaboo'
    )
  },
}

const peekabooPerformAction: ToolDefinition = {
  name: 'peekaboo_perform_action',
  description:
    "Invoke a named AX action (e.g. AXPress, AXShowMenu) on an element from a Peekaboo snapshot. NOTE: requires Peekaboo CLI with the 'perform-action' top-level command, which is absent in 3.0.0-beta4. Use peekaboo_click as a workaround.",
  parameters: {
    app: {
      type: 'string',
      description: 'App being targeted. Required for the approval gate.',
      required: true,
    },
    snapshot: {
      type: 'string',
      description: 'Snapshot id from peekaboo_see.',
      required: true,
    },
    on: {
      type: 'string',
      description: 'Target element id or query.',
      required: true,
    },
    action: {
      type: 'string',
      description: 'Named AX action (e.g. "AXPress", "AXShowMenu").',
      required: true,
    },
  },
  tier: 'free',
  async execute(_args) {
    void performAction
    return (
      "Error: peekaboo_perform_action requires Peekaboo CLI with the 'perform-action' top-level command, " +
      'which is not present in 3.0.0-beta4. Workaround: peekaboo_click on the element. ' +
      'Track upstream: https://github.com/openclaw/Peekaboo'
    )
  },
}

const peekabooAgent: ToolDefinition = {
  name: 'peekaboo_agent',
  description:
    "Hand a natural-language automation prompt to peekaboo's own agent subcommand. Returns the agent's stdout verbatim. Not gated by app approval — peekaboo's agent decides which apps to drive.",
  parameters: {
    prompt: {
      type: 'string',
      description: 'Free-form instruction for the peekaboo agent.',
      required: true,
    },
  },
  tier: 'free',
  async execute(args) {
    const binErr = await ensureBinary()
    if (binErr) return binErr

    const prompt = typeof args.prompt === 'string' ? args.prompt : ''
    if (!prompt) return 'Error: prompt is required.'

    try {
      const out = await agent({ prompt })
      return outcomeToString(out)
    } catch (e) {
      return `Error: ${(e as Error).message}`
    }
  },
}

export const peekabooTools: readonly ToolDefinition[] = [
  peekabooSee,
  peekabooClick,
  peekabooType,
  peekabooSetValue,
  peekabooPerformAction,
  peekabooAgent,
]

export function registerPeekabooTools(): void {
  for (const t of peekabooTools) registerTool(t)
}
