import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Coordinator, type LockRecord } from './computer-use-coordinator.js'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kbot-coord-test-'))
})

afterEach(() => {
  try { rmSync(root, { recursive: true, force: true }) } catch { /* ignore */ }
})

describe('Coordinator', () => {
  it('grants two agents on different apps in parallel', () => {
    const c = new Coordinator(root)
    c.register('agent-a', { apps: ['Ableton'] })
    c.register('agent-b', { apps: ['Chrome'] })

    const a = c.claim('agent-a', 'Ableton')
    const b = c.claim('agent-b', 'Chrome')

    expect(a.granted).toBe(true)
    expect(a.heldBy).toBe('agent-a')
    expect(b.granted).toBe(true)
    expect(b.heldBy).toBe('agent-b')
  })

  it('denies the second agent on the same app', () => {
    const c = new Coordinator(root)
    c.register('agent-a', { apps: ['Ableton'] })
    c.register('agent-b', { apps: ['Ableton'] })

    const first = c.claim('agent-a', 'Ableton')
    const second = c.claim('agent-b', 'Ableton')

    expect(first.granted).toBe(true)
    expect(second.granted).toBe(false)
    expect(second.heldBy).toBe('agent-a')
    expect(typeof second.since).toBe('number')
  })

  it('idempotent claim by the same agent', () => {
    const c = new Coordinator(root)
    c.register('agent-a', { apps: ['Logic'] })
    const first = c.claim('agent-a', 'Logic')
    const again = c.claim('agent-a', 'Logic')
    expect(first.granted).toBe(true)
    expect(again.granted).toBe(true)
    expect(again.heldBy).toBe('agent-a')
  })

  it('release transfers ownership to another agent', () => {
    const c = new Coordinator(root)
    c.register('agent-a', { apps: ['Ableton'] })
    c.register('agent-b', { apps: ['Ableton'] })

    expect(c.claim('agent-a', 'Ableton').granted).toBe(true)
    expect(c.claim('agent-b', 'Ableton').granted).toBe(false)

    expect(c.release('agent-a', 'Ableton')).toBe(true)

    const taken = c.claim('agent-b', 'Ableton')
    expect(taken.granted).toBe(true)
    expect(taken.heldBy).toBe('agent-b')
  })

  it('takes over a stale lock (dead pid + old timestamp)', () => {
    const c = new Coordinator(root)
    c.register('agent-a', { apps: ['Finder'] })

    // Plant a stale lock from a non-existent process, 5 minutes ago
    const stale: LockRecord = {
      agentId: 'ghost-agent',
      pid: 999_999,
      ts: Date.now() - 5 * 60_000,
    }
    writeFileSync(join(root, 'Finder.lock'), JSON.stringify(stale))

    const result = c.claim('agent-a', 'Finder')
    expect(result.granted).toBe(true)
    expect(result.heldBy).toBe('agent-a')

    const onDisk = JSON.parse(readFileSync(join(root, 'Finder.lock'), 'utf-8')) as LockRecord
    expect(onDisk.agentId).toBe('agent-a')
    expect(onDisk.pid).toBe(process.pid)
  })

  it('does NOT take over a fresh lock even with foreign pid', () => {
    const c = new Coordinator(root)
    c.register('agent-a', { apps: ['Finder'] })

    // Foreign-pid lock but timestamp is recent — should not be considered stale
    const fresh: LockRecord = {
      agentId: 'other',
      pid: 999_999,
      ts: Date.now(),
    }
    writeFileSync(join(root, 'Finder.lock'), JSON.stringify(fresh))

    const result = c.claim('agent-a', 'Finder')
    expect(result.granted).toBe(false)
    expect(result.heldBy).toBe('other')
  })

  it('status reflects holders and registered agents', () => {
    const c = new Coordinator(root)
    c.register('agent-a', { apps: ['Ableton'] })
    c.register('agent-b', { apps: ['Chrome', 'Finder'] })
    c.claim('agent-a', 'Ableton')
    c.claim('agent-b', 'Chrome')

    const s = c.status()
    expect(s.apps['Ableton']?.heldBy).toBe('agent-a')
    expect(s.apps['Chrome']?.heldBy).toBe('agent-b')
    expect(s.apps['Finder']).toBeNull()

    const ids = s.agents.map((a) => a.id).sort()
    expect(ids).toEqual(['agent-a', 'agent-b'])

    const b = s.agents.find((a) => a.id === 'agent-b')!
    expect(b.apps.sort()).toEqual(['Chrome', 'Finder'])
    expect(b.claimed).toEqual(['Chrome'])
  })

  it('unregister releases every claim that agent owned', () => {
    const c = new Coordinator(root)
    c.register('agent-a', { apps: ['Ableton', 'Logic'] })
    c.claim('agent-a', 'Ableton')
    c.claim('agent-a', 'Logic')

    const released = c.unregister('agent-a')
    expect(released.sort()).toEqual(['Ableton', 'Logic'])

    expect(existsSync(join(root, 'Ableton.lock'))).toBe(false)
    expect(existsSync(join(root, 'Logic.lock'))).toBe(false)

    const s = c.status()
    expect(s.agents.find((a) => a.id === 'agent-a')).toBeUndefined()
  })

  it('rejects claim for an app the agent did not register for', () => {
    const c = new Coordinator(root)
    c.register('agent-a', { apps: ['Ableton'] })
    expect(() => c.claim('agent-a', 'Chrome')).toThrow(/did not register/)
  })

  it('rejects claim from an unregistered agent', () => {
    const c = new Coordinator(root)
    expect(() => c.claim('ghost', 'Anything')).toThrow(/not registered/)
  })
})
