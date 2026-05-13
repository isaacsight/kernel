import { describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { grant, verify, downscope, RevocationList } from '../src/acap.js'
import type { ACapRequest, AgentId } from '../src/types.js'

const PARENT = 'agent_parent' as AgentId
const CHILD = 'agent_child' as AgentId
const GRANDCHILD = 'agent_grandchild' as AgentId
const KEY = randomBytes(32)
const TRUST = new Map([[PARENT, KEY]])

const baseRequest: ACapRequest = {
  subject: { kind: 'tool', name: 'http_get' },
  scope: ['invoke'],
  max_invocations: 10,
  justification: 'fetch external doc for analysis',
}

describe('acap.grant + verify', () => {
  it('produces a verifiable capability', () => {
    const cap = grant(baseRequest, {
      granted_by: PARENT,
      granted_to: CHILD,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      signing_key: KEY,
    })
    const v = verify(cap, { trust: TRUST })
    expect(v.ok).toBe(true)
  })

  it('rejects an expired capability', () => {
    const cap = grant(baseRequest, {
      granted_by: PARENT,
      granted_to: CHILD,
      expires_at: new Date(Date.now() - 1000).toISOString(),
      signing_key: KEY,
    })
    const v = verify(cap, { trust: TRUST })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.error.code).toBe('capability_expired')
  })

  it('rejects a tampered capability', () => {
    const cap = grant(baseRequest, {
      granted_by: PARENT,
      granted_to: CHILD,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      signing_key: KEY,
    })
    const tampered = { ...cap, scope: ['invoke', 'admin'] }
    const v = verify(tampered, { trust: TRUST })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.error.code).toBe('capability_denied')
  })

  it('rejects a capability from an untrusted signer', () => {
    const cap = grant(baseRequest, {
      granted_by: PARENT,
      granted_to: CHILD,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      signing_key: KEY,
    })
    const v = verify(cap, { trust: new Map() })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.error.code).toBe('capability_denied')
  })

  it('rejects a revoked capability', () => {
    const cap = grant(baseRequest, {
      granted_by: PARENT,
      granted_to: CHILD,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      signing_key: KEY,
    })
    const revs = new RevocationList()
    revs.revoke(cap.id)
    const v = verify(cap, { trust: TRUST, revocations: revs })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.error.code).toBe('capability_denied')
  })

  it('rejects an exhausted capability', () => {
    const cap = grant(baseRequest, {
      granted_by: PARENT,
      granted_to: CHILD,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      signing_key: KEY,
    })
    const exhausted = { ...cap, invocations: 10 }
    const v = verify(exhausted, { trust: TRUST })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.error.code).toBe('capability_exhausted')
  })
})

describe('acap.downscope', () => {
  const source = grant(baseRequest, {
    granted_by: PARENT,
    granted_to: CHILD,
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    signing_key: KEY,
  })

  it('produces a strictly-narrower capability', () => {
    const sub = downscope(source, {
      granted_to: GRANDCHILD,
      max_invocations: 5,
      signing_key: KEY,
    })
    expect(sub.ok).toBe(true)
    if (sub.ok) {
      expect(sub.value.max_invocations).toBe(5)
      expect(sub.value.granted_by).toBe(CHILD)
      expect(sub.value.granted_to).toBe(GRANDCHILD)
    }
  })

  it('refuses to add scope', () => {
    const sub = downscope(source, {
      granted_to: GRANDCHILD,
      scope: ['invoke', 'admin'],
      signing_key: KEY,
    })
    expect(sub.ok).toBe(false)
    if (!sub.ok) expect(sub.error.code).toBe('handoff_escalation_denied')
  })

  it('refuses to grant more invocations than source has', () => {
    const sub = downscope(source, {
      granted_to: GRANDCHILD,
      max_invocations: 100,
      signing_key: KEY,
    })
    expect(sub.ok).toBe(false)
    if (!sub.ok) expect(sub.error.code).toBe('handoff_escalation_denied')
  })

  it('refuses to morph subject kind', () => {
    const sub = downscope(source, {
      granted_to: GRANDCHILD,
      subject: { kind: 'mcp_server', server: 'evil' },
      signing_key: KEY,
    })
    expect(sub.ok).toBe(false)
    if (!sub.ok) expect(sub.error.code).toBe('handoff_escalation_denied')
  })

  it('refuses to grant more invocations than source has remaining', () => {
    // Source granted 10, used 8 — remaining is 2.
    const partially_used = { ...source, invocations: 8 }
    const sub = downscope(partially_used, {
      granted_to: GRANDCHILD,
      max_invocations: 5,
      signing_key: KEY,
    })
    expect(sub.ok).toBe(false)
    if (!sub.ok) expect(sub.error.code).toBe('handoff_escalation_denied')
  })
})
