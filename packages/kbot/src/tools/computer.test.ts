// Tests for computer.ts coordinator integration.
//
// We don't exercise AppleScript / xdotool here — we just verify the
// Coordinator wiring: app_approve registers, computer_release unregisters,
// same-app collisions are denied, and computer_check exposes coordinator status.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// These env vars MUST be set before importing computer.ts so the module-scoped
// coordinator + agent id pick them up.
const TEST_ROOT = mkdtempSync(join(tmpdir(), 'kbot-computer-test-'))
process.env.KBOT_COMPUTER_USE_ROOT = TEST_ROOT
process.env.KBOT_COMPUTER_USE_AGENT_ID = 'test-agent'

// Dynamic imports so the env vars apply at module load time.
const { registerComputerTools } = await import('./computer.js')
const { getTool } = await import('./index.js')
const { Coordinator } = await import('../computer-use-coordinator.js')

beforeAll(() => {
  registerComputerTools()
})

afterAll(() => {
  try { rmSync(TEST_ROOT, { recursive: true, force: true }) } catch { /* ignore */ }
})

async function call(name: string, args: Record<string, unknown> = {}): Promise<string> {
  const tool = getTool(name)
  if (!tool) throw new Error(`tool ${name} not registered`)
  const out = await tool.execute(args)
  return typeof out === 'string' ? out : JSON.stringify(out)
}

describe('computer.ts coordinator integration', () => {
  it('app_approve registers the agent with the coordinator', async () => {
    const result = await call('app_approve', { app: 'TestApp1' })
    expect(result).toContain('Approved TestApp1')

    // Verify on disk: the coordinator surface should know about TestApp1.
    const probe = new Coordinator(TEST_ROOT)
    // Plant a foreign agent claim and confirm a fresh probe sees no holder yet.
    const status = probe.status()
    // No claim has been made yet, just registration — apps map should not list TestApp1
    // as held (registration alone doesn't create a lock file).
    expect(status.apps['TestApp1'] ?? null).toBeNull()
  })

  it('computer_check includes coordinator status JSON', async () => {
    await call('app_approve', { app: 'StatusApp' })
    const result = await call('computer_check')
    expect(result).toContain('Coordinator:')
    expect(result).toContain('Agent ID: test-agent')
  })

  it('denies a tool call when another agent already holds the app', async () => {
    await call('app_approve', { app: 'CollideApp' })

    // Plant a fresh foreign-agent lock on disk. computer.ts normalises app
    // names to lowercase before lookup.
    const lockPath = join(TEST_ROOT, 'collideapp.lock')
    writeFileSync(lockPath, JSON.stringify({
      agentId: 'other-agent',
      pid: process.pid, // alive pid so it's not stale
      ts: Date.now(),
    }))

    // window_resize targets CollideApp — should be denied.
    const result = await call('window_resize', {
      app: 'CollideApp', width: 800, height: 600,
    })
    expect(result).toMatch(/held by other-agent/)
    expect(result).toMatch(/wait or unregister/)

    // Lock file should still be intact (we didn't steal it).
    expect(existsSync(lockPath)).toBe(true)
  })

  it('rejects interaction tools on a non-approved app', async () => {
    const result = await call('window_move', {
      app: 'NotApproved', x: 10, y: 20,
    })
    expect(result).toMatch(/not approved/)
  })

  it('legacy fallback: tools without app arg do not interact with coordinator', async () => {
    // mouse_click without `app` should not error out on coordinator (it goes
    // through the legacy single-lock path). We can't actually click on a
    // headless test box, but we can confirm the call returns *some* string
    // and never raises a coordinator error.
    const result = await call('mouse_click', { x: 0, y: 0 })
    expect(typeof result).toBe('string')
    expect(result).not.toMatch(/held by/)
  })

  it('computer_release unregisters and clears approvals', async () => {
    await call('app_approve', { app: 'ReleaseApp' })

    const result = await call('computer_release')
    expect(result).toContain('Computer use session ended')

    // After release, the app should no longer be approved.
    const moveResult = await call('window_move', {
      app: 'ReleaseApp', x: 0, y: 0,
    })
    expect(moveResult).toMatch(/not approved/)
  })
})
