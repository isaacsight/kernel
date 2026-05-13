import { describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { Vault, inMemoryResolver } from '../src/vault.js'
import { grant } from '../src/acap.js'
import type { ACap, AgentId } from '../src/types.js'

const KEY = randomBytes(32)
const AGENT: AgentId = 'agent_test' as AgentId
const PARENT: AgentId = 'agent_parent' as AgentId

function makeAcap(subject: ACap['subject']): ACap {
  return grant(
    { subject, scope: ['invoke'], justification: 'test' },
    {
      granted_by: PARENT,
      granted_to: AGENT,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      signing_key: KEY,
    },
  )
}

describe('Vault.register + inject', () => {
  it('injects a header credential when the acap subject matches', async () => {
    const resolver = inMemoryResolver({ factset_api: 'secret-token-123' })
    const vault = new Vault(resolver)
    const reg = vault.register({
      ref: 'factset_api' as never,
      bound_to: { kind: 'mcp_server', server: 'factset' },
      injection: { kind: 'header', name: 'Authorization', prefix: 'Bearer ' },
    })
    expect(reg.ok).toBe(true)

    const acap = makeAcap({ kind: 'mcp_server', server: 'factset' })
    const r = await vault.inject('factset_api' as never, acap)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.kind).toBe('header')
      if (r.value.kind === 'header') {
        expect(r.value.name).toBe('Authorization')
        expect(r.value.header_value).toBe('Bearer secret-token-123')
      }
    }
  })

  it('refuses injection when the acap subject does not match the binding', async () => {
    const vault = new Vault(inMemoryResolver({ factset_api: 's' }))
    vault.register({
      ref: 'factset_api' as never,
      bound_to: { kind: 'mcp_server', server: 'factset' },
      injection: { kind: 'bearer_token' },
    })

    const wrongAcap = makeAcap({ kind: 'mcp_server', server: 'morningstar' })
    const r = await vault.inject('factset_api' as never, wrongAcap)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('capability_denied')
  })

  it('refuses injection when the credential is missing in the resolver', async () => {
    const vault = new Vault(inMemoryResolver({})) // empty
    vault.register({
      ref: 'factset_api' as never,
      bound_to: { kind: 'mcp_server', server: 'factset' },
      injection: { kind: 'bearer_token' },
    })

    const acap = makeAcap({ kind: 'mcp_server', server: 'factset' })
    const r = await vault.inject('factset_api' as never, acap)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('namespace_violation')
  })

  it('refuses injection for an unregistered ref', async () => {
    const vault = new Vault()
    const acap = makeAcap({ kind: 'mcp_server', server: 'factset' })
    const r = await vault.inject('does_not_exist' as never, acap)
    expect(r.ok).toBe(false)
  })

  it('produces a query-param injection', async () => {
    const vault = new Vault(inMemoryResolver({ key: 'abc' }))
    vault.register({
      ref: 'key' as never,
      bound_to: { kind: 'tool', name: 'http_get' },
      injection: { kind: 'query_param', name: 'api_key' },
    })
    const acap = makeAcap({ kind: 'tool', name: 'http_get' })
    const r = await vault.inject('key' as never, acap)
    expect(r.ok).toBe(true)
    if (r.ok && r.value.kind === 'query_param') {
      expect(r.value.name).toBe('api_key')
      expect(r.value.param_value).toBe('abc')
    }
  })

  it('produces a bearer token injection', async () => {
    const vault = new Vault(inMemoryResolver({ tok: 'xyz' }))
    vault.register({
      ref: 'tok' as never,
      bound_to: { kind: 'tool', name: 'http_get' },
      injection: { kind: 'bearer_token' },
    })
    const acap = makeAcap({ kind: 'tool', name: 'http_get' })
    const r = await vault.inject('tok' as never, acap)
    expect(r.ok).toBe(true)
    if (r.ok && r.value.kind === 'bearer_token') {
      expect(r.value.header_value).toBe('Bearer xyz')
    }
  })

  it('logs every injection attempt without leaking the secret', async () => {
    const vault = new Vault(inMemoryResolver({ s: 'super-secret-do-not-leak' }))
    vault.register({
      ref: 's' as never,
      bound_to: { kind: 'tool', name: 'http_get' },
      injection: { kind: 'bearer_token' },
    })
    const goodAcap = makeAcap({ kind: 'tool', name: 'http_get' })
    const badAcap = makeAcap({ kind: 'tool', name: 'shell_exec' })
    await vault.inject('s' as never, goodAcap)
    await vault.inject('s' as never, badAcap)
    await vault.inject('missing' as never, goodAcap)

    const logs = vault.recentLogs()
    expect(logs).toHaveLength(3)
    const stringified = JSON.stringify(logs)
    expect(stringified).not.toContain('super-secret-do-not-leak')
    expect(logs[0]?.outcome).toBe('injected')
    expect(logs[1]?.outcome).toBe('denied')
    expect(logs[2]?.outcome).toBe('missing')
  })

  it('archives an entry', () => {
    const vault = new Vault()
    vault.register({
      ref: 'r' as never,
      bound_to: { kind: 'tool', name: 'http_get' },
      injection: { kind: 'bearer_token' },
    })
    expect(vault.size()).toBe(1)
    const r = vault.archive('r' as never)
    expect(r.ok).toBe(true)
    expect(vault.size()).toBe(0)
  })

  it('refuses duplicate registration', () => {
    const vault = new Vault()
    vault.register({
      ref: 'r' as never,
      bound_to: { kind: 'tool', name: 'http_get' },
      injection: { kind: 'bearer_token' },
    })
    const second = vault.register({
      ref: 'r' as never,
      bound_to: { kind: 'tool', name: 'http_get' },
      injection: { kind: 'bearer_token' },
    })
    expect(second.ok).toBe(false)
  })
})
