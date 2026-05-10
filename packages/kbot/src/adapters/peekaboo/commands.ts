// Peekaboo high-level helpers — typed wrappers around the JSON CLI.
//
// Each helper assembles argv for `peekaboo <subcommand> --json`, runs it
// through `runPeekaboo`, and parses stdout into the appropriate result
// type. Non-zero exits and malformed JSON are returned as `PeekabooError`
// rather than thrown — callers fan out via discriminated unions.
//
// Every peekaboo 3.0.0-beta4 JSON command wraps its payload in
// `{ success, data, error? }`. Helpers unwrap that envelope and treat
// `success: false` as a structured failure rather than a parse error.

import { runPeekaboo } from './runner.js'
import type {
  PeekabooAgentResult,
  PeekabooClickResult,
  PeekabooError,
  PeekabooOutcome,
  PeekabooPerformActionResult,
  PeekabooSeeResult,
  PeekabooSetValueResult,
  PeekabooTypeResult,
} from './types.js'

function failNonZero(code: number, stdout: string, stderr: string): PeekabooError {
  return {
    ok: false,
    error: {
      code: 'non-zero-exit',
      message: `peekaboo exited ${code}`,
      stdout,
      stderr,
      exitCode: code,
    },
  }
}

function failParse(message: string, stdout: string): PeekabooError {
  return {
    ok: false,
    error: {
      code: 'malformed-json',
      message,
      stdout,
    },
  }
}

function parseJson(stdout: string): { ok: true; value: unknown } | { ok: false; err: PeekabooError } {
  try {
    return { ok: true, value: JSON.parse(stdout) as unknown }
  } catch (e) {
    return { ok: false, err: failParse((e as Error).message, stdout) }
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function asOptString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function asOptBool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined
}

function asOptNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/**
 * Unwrap the `{ success, data, error? }` envelope every peekaboo 3.0.0-beta4
 * JSON command emits. On `success: true` returns the inner `data` record; on
 * `success: false` (or missing fields) returns a structured PeekabooError so
 * callers can propagate it through their discriminated union.
 */
function unwrapEnvelope(
  command: string,
  parsed: unknown,
  stdout: string,
): { ok: true; data: Record<string, unknown> } | { ok: false; err: PeekabooError } {
  if (!isRecord(parsed)) {
    return { ok: false, err: failParse(`${command}: expected object at root`, stdout) }
  }
  if (parsed.success === false) {
    const errMsg = isRecord(parsed.error)
      ? asString(parsed.error.message, asString(parsed.error.code, 'unknown error'))
      : asString(parsed.error, 'unknown error')
    return {
      ok: false,
      err: failParse(`${command}: success=false: ${errMsg}`, stdout),
    }
  }
  if (!isRecord(parsed.data)) {
    return { ok: false, err: failParse(`${command}: missing data field`, stdout) }
  }
  return { ok: true, data: parsed.data }
}

// --- see ---------------------------------------------------------------

export interface SeeOptions {
  app?: string
  mode?: 'screen' | 'window'
  retina?: boolean
}

export async function see(opts: SeeOptions = {}): Promise<PeekabooOutcome<PeekabooSeeResult>> {
  const args = ['see', '--json']
  if (opts.app) args.push('--app', opts.app)
  if (opts.mode) args.push('--mode', opts.mode)
  if (opts.retina) args.push('--retina')

  const { stdout, stderr, code } = await runPeekaboo(args)
  if (code !== 0) return failNonZero(code, stdout, stderr)
  const parsed = parseJson(stdout)
  if (!parsed.ok) return parsed.err

  const env = unwrapEnvelope('see', parsed.value, stdout)
  if (!env.ok) return env.err
  const data = env.data

  const rawElements = Array.isArray(data.ui_elements) ? data.ui_elements : []
  const elements = rawElements.flatMap((el): PeekabooSeeResult['elements'] => {
    if (!isRecord(el)) return []
    return [
      {
        id: asString(el.id),
        role: asString(el.role),
        roleDescription: asOptString(el.role_description),
        label: asOptString(el.label),
        description: asOptString(el.description),
        help: asOptString(el.help),
        identifier: asOptString(el.identifier),
        title: asOptString(el.title),
        isActionable: asOptBool(el.is_actionable),
      },
    ]
  })

  return {
    ok: true,
    snapshot: asString(data.snapshot_id),
    elements,
    applicationName: asOptString(data.application_name),
    windowTitle: asOptString(data.window_title),
    elementCount: asOptNumber(data.element_count),
    interactableCount: asOptNumber(data.interactable_count),
    captureMode: asOptString(data.capture_mode),
    uiMap: asOptString(data.ui_map),
    screenshotPath: asOptString(data.screenshot_path),
  }
}

// --- click -------------------------------------------------------------

export interface ClickOptions {
  snapshot: string
  on?: string
  coords?: [number, number]
  wait?: number
}

export async function click(opts: ClickOptions): Promise<PeekabooOutcome<PeekabooClickResult>> {
  const args = ['click', '--json', '--snapshot', opts.snapshot]
  if (opts.on) args.push('--on', opts.on)
  if (opts.coords) args.push('--coords', `${opts.coords[0]},${opts.coords[1]}`)
  if (typeof opts.wait === 'number') args.push('--wait-for', String(opts.wait))

  const { stdout, stderr, code } = await runPeekaboo(args)
  if (code !== 0) return failNonZero(code, stdout, stderr)
  const parsed = parseJson(stdout)
  if (!parsed.ok) return parsed.err
  const env = unwrapEnvelope('click', parsed.value, stdout)
  if (!env.ok) return env.err
  const v = env.data
  return {
    ok: true,
    target: asOptString(v.target),
    coords:
      Array.isArray(v.coords) && v.coords.length === 2
        ? [asNumber(v.coords[0]), asNumber(v.coords[1])]
        : undefined,
  }
}

// --- type --------------------------------------------------------------

export interface TypeOptions {
  text: string
  clear?: boolean
  delayMs?: number
}

// `type` is reserved in TS; export the helper as `type_`.
// peekaboo 3.0.0-beta4 takes the text as a positional argument, not a --text flag.
export async function type_(opts: TypeOptions): Promise<PeekabooOutcome<PeekabooTypeResult>> {
  const args = ['type', '--json', opts.text]
  if (opts.clear) args.push('--clear')
  if (typeof opts.delayMs === 'number') args.push('--delay', String(opts.delayMs))

  const { stdout, stderr, code } = await runPeekaboo(args)
  if (code !== 0) return failNonZero(code, stdout, stderr)
  const parsed = parseJson(stdout)
  if (!parsed.ok) return parsed.err
  const env = unwrapEnvelope('type', parsed.value, stdout)
  if (!env.ok) return env.err
  const v = env.data
  return {
    ok: true,
    typed: asString(v.typed, opts.text),
    cleared: asOptBool(v.cleared),
  }
}

// --- set-value ---------------------------------------------------------
//
// peekaboo 3.0.0-beta4 has NO `set-value` top-level command. The README
// references one but the installed binary lacks it. The helper is kept so
// callers compile, but it returns a structured error so the absence is
// surfaced loudly.

export interface SetValueOptions {
  snapshot: string
  on: string
  value: string
}

export async function setValue(
  _opts: SetValueOptions,
): Promise<PeekabooOutcome<PeekabooSetValueResult>> {
  return {
    ok: false,
    error: {
      code: 'unknown',
      message:
        "peekaboo 3.0.0-beta4 does not expose a 'set-value' top-level command. " +
        'Track upstream: https://github.com/openclaw/Peekaboo',
    },
  }
}

// --- perform-action ----------------------------------------------------
//
// Same story as set-value — README references it, installed binary doesn't
// expose it. Kept so callers compile, returns a structured error on use.

export interface PerformActionOptions {
  snapshot: string
  on: string
  action: string
}

export async function performAction(
  _opts: PerformActionOptions,
): Promise<PeekabooOutcome<PeekabooPerformActionResult>> {
  return {
    ok: false,
    error: {
      code: 'unknown',
      message:
        "peekaboo 3.0.0-beta4 does not expose a 'perform-action' top-level command. " +
        'Track upstream: https://github.com/openclaw/Peekaboo',
    },
  }
}

// --- agent -------------------------------------------------------------

export interface AgentOptions {
  prompt: string
}

/**
 * Runs `peekaboo agent "$prompt"` and returns the final stdout. Unlike the
 * structured commands the agent subcommand may emit free-form text, so we
 * surface stdout verbatim under `output`.
 */
export async function agent(opts: AgentOptions): Promise<PeekabooOutcome<PeekabooAgentResult>> {
  const { stdout, stderr, code } = await runPeekaboo(['agent', opts.prompt])
  if (code !== 0) return failNonZero(code, stdout, stderr)
  return { ok: true, output: stdout }
}
