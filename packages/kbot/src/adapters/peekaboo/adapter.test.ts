// Peekaboo adapter — deterministic stub-driven tests.
//
// Mocks node:child_process so the suite never spawns the real binary. Each
// test installs an execFile stub that asserts argv and returns canned
// stdout/stderr/exit-code, mirroring the contract of the real CLI.
//
// Stub payloads are calibrated to peekaboo 3.0.0-beta4: every command wraps
// its output in `{ success, data, error? }`, element ids look like `elem_NN`,
// and elements expose `role_description` / `is_actionable` rather than
// `frame` / `named_actions` arrays.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type ExecFileCb = (
  err: (Error & { code?: number | string }) | null,
  stdout: string,
  stderr: string,
) => void

interface ExecFileCall {
  file: string
  args: string[]
}

const calls: ExecFileCall[] = []
let nextResponse: { stdout: string; stderr: string; code: number } | { throw: NodeJS.ErrnoException } = {
  stdout: '',
  stderr: '',
  code: 0,
}

vi.mock('node:child_process', () => {
  return {
    execFile: (
      file: string,
      args: string[],
      _opts: unknown,
      cb: ExecFileCb,
    ): { stdin: null } => {
      calls.push({ file, args })
      // Defer to next tick to mirror real async behaviour.
      queueMicrotask(() => {
        if ('throw' in nextResponse) {
          cb(nextResponse.throw, '', '')
          return
        }
        const { stdout, stderr, code } = nextResponse
        if (code !== 0) {
          const err = Object.assign(new Error(`exit ${code}`), { code }) as Error & {
            code?: number
          }
          cb(err, stdout, stderr)
        } else {
          cb(null, stdout, stderr)
        }
      })
      return { stdin: null }
    },
  }
})

// Imported after the mock so the runner picks up the stub.
import {
  see,
  click,
  type_,
  setValue,
  performAction,
  agent,
  peekabooAvailable,
} from './index.js'

beforeEach(() => {
  calls.length = 0
  nextResponse = { stdout: '', stderr: '', code: 0 }
  delete process.env.PEEKABOO_BIN
})

afterEach(() => {
  vi.clearAllMocks()
})

function setStdout(stdout: string, code = 0, stderr = ''): void {
  nextResponse = { stdout, stderr, code }
}

describe('see', () => {
  it('parses a successful see snapshot in the {success,data} envelope', async () => {
    setStdout(
      JSON.stringify({
        success: true,
        data: {
          snapshot_id: '0CD023AB-A103-43A1-921D-EDF3FF026925',
          ui_map: '/tmp/ui-map.json',
          capture_mode: 'window',
          element_count: 180,
          interactable_count: 105,
          application_name: 'Finder',
          window_title: 'Downloads',
          ui_elements: [
            {
              id: 'elem_19',
              role: 'button',
              role_description: 'button',
              is_actionable: false,
              title: '',
            },
            {
              id: 'elem_169',
              role: 'button',
              role_description: 'button',
              label: 'Share',
              description: 'Share',
              help: 'Share the selected items',
              identifier: 'ShareButton',
              is_actionable: true,
            },
          ],
        },
      }),
    )
    const r = await see()
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.snapshot).toBe('0CD023AB-A103-43A1-921D-EDF3FF026925')
    expect(r.applicationName).toBe('Finder')
    expect(r.windowTitle).toBe('Downloads')
    expect(r.elementCount).toBe(180)
    expect(r.interactableCount).toBe(105)
    expect(r.captureMode).toBe('window')
    expect(r.uiMap).toBe('/tmp/ui-map.json')
    expect(r.elements).toHaveLength(2)
    expect(r.elements[0].id).toBe('elem_19')
    expect(r.elements[0].role).toBe('button')
    expect(r.elements[0].roleDescription).toBe('button')
    expect(r.elements[0].isActionable).toBe(false)
    expect(r.elements[1].id).toBe('elem_169')
    expect(r.elements[1].label).toBe('Share')
    expect(r.elements[1].help).toBe('Share the selected items')
    expect(r.elements[1].identifier).toBe('ShareButton')
    expect(r.elements[1].isActionable).toBe(true)
  })

  it('passes --app argument when supplied', async () => {
    setStdout(
      JSON.stringify({
        success: true,
        data: { snapshot_id: 's', ui_elements: [] },
      }),
    )
    await see({ app: 'Finder', mode: 'window', retina: true })
    expect(calls).toHaveLength(1)
    expect(calls[0].args).toEqual([
      'see',
      '--json',
      '--app',
      'Finder',
      '--mode',
      'window',
      '--retina',
    ])
  })

  it('returns a malformed-json error when success=false', async () => {
    setStdout(
      JSON.stringify({
        success: false,
        error: { code: 'PERMISSION_DENIED', message: 'screen recording disabled' },
      }),
    )
    const r = await see()
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe('malformed-json')
    expect(r.error.message).toContain('success=false')
    expect(r.error.message).toContain('screen recording disabled')
  })
})

describe('click', () => {
  it('clicks by element id with --on (envelope-wrapped success)', async () => {
    setStdout(JSON.stringify({ success: true, data: { target: 'elem_169' } }))
    const r = await click({ snapshot: 'snap-123', on: 'elem_169' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.target).toBe('elem_169')
    expect(calls[0].args).toEqual([
      'click',
      '--json',
      '--snapshot',
      'snap-123',
      '--on',
      'elem_169',
    ])
  })

  it('clicks by coordinates with --coords and uses --wait-for', async () => {
    setStdout(JSON.stringify({ success: true, data: { coords: [120, 240] } }))
    const r = await click({ snapshot: 'snap', coords: [120, 240], wait: 500 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.coords).toEqual([120, 240])
    expect(calls[0].args).toEqual([
      'click',
      '--json',
      '--snapshot',
      'snap',
      '--coords',
      '120,240',
      '--wait-for',
      '500',
    ])
  })
})

describe('type_', () => {
  it('passes text as a positional argument with --clear and --delay', async () => {
    setStdout(
      JSON.stringify({
        success: true,
        data: { typed: 'hello world', cleared: true },
      }),
    )
    const r = await type_({ text: 'hello world', clear: true, delayMs: 25 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.typed).toBe('hello world')
    expect(r.cleared).toBe(true)
    expect(calls[0].args).toEqual([
      'type',
      '--json',
      'hello world',
      '--clear',
      '--delay',
      '25',
    ])
  })
})

describe('setValue (stub)', () => {
  it("returns a structured 'unknown' error since the binary lacks set-value", async () => {
    const r = await setValue({ snapshot: 'snap', on: 'elem_85', value: 'isaac' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe('unknown')
    expect(r.error.message).toMatch(/set-value/)
    // Critically: no CLI invocation.
    expect(calls).toHaveLength(0)
  })
})

describe('performAction (stub)', () => {
  it("returns a structured 'unknown' error since the binary lacks perform-action", async () => {
    const r = await performAction({ snapshot: 'snap', on: 'elem_169', action: 'AXPress' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe('unknown')
    expect(r.error.message).toMatch(/perform-action/)
    expect(calls).toHaveLength(0)
  })
})

describe('agent', () => {
  it('passes the prompt verbatim and returns stdout', async () => {
    setStdout('Done. Reloaded the window.\n')
    const r = await agent({ prompt: 'Reload Safari' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.output).toBe('Done. Reloaded the window.\n')
    expect(calls[0].args).toEqual(['agent', 'Reload Safari'])
  })
})

describe('errors', () => {
  it('returns a non-zero-exit error when the binary fails', async () => {
    setStdout('', 2, 'permission denied')
    const r = await see()
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe('non-zero-exit')
    expect(r.error.exitCode).toBe(2)
    expect(r.error.stderr).toBe('permission denied')
  })

  it('returns a malformed-json error when stdout is not JSON', async () => {
    setStdout('this is not json')
    const r = await see()
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe('malformed-json')
    expect(r.error.stdout).toBe('this is not json')
  })
})

describe('peekabooAvailable', () => {
  it('returns true when the binary responds to --version', async () => {
    setStdout('peekaboo 1.2.3\n', 0)
    expect(await peekabooAvailable()).toBe(true)
    expect(calls[0].args).toEqual(['--version'])
  })

  it('returns false when the binary cannot be spawned', async () => {
    nextResponse = {
      throw: Object.assign(new Error('not found'), { code: 'ENOENT' }) as NodeJS.ErrnoException,
    }
    expect(await peekabooAvailable()).toBe(false)
  })
})

describe('binary resolution', () => {
  it('honors PEEKABOO_BIN when set', async () => {
    process.env.PEEKABOO_BIN = '/custom/path/peekaboo'
    setStdout(
      JSON.stringify({ success: true, data: { snapshot_id: 's', ui_elements: [] } }),
    )
    await see()
    expect(calls[0].file).toBe('/custom/path/peekaboo')
  })
})
