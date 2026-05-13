import { describe, expect, it } from 'vitest'
import { checkTaint, propagate, untaint, DEFAULT_TAINT_POLICY } from '../src/taint.js'
import type { Taint, ToolCall, AgentId } from '../src/types.js'

const EMAIL_TAINT: Taint = {
  source: 'email',
  origin: 'inbox/attacker@example.com',
  introduced_at: '2026-05-13T00:00:00Z',
}

const URL_TAINT: Taint = {
  source: 'fetched_url',
  origin: 'https://attacker.example.com/payload',
  introduced_at: '2026-05-13T00:00:00Z',
}

const AGENT: AgentId = 'agent_test' as AgentId

describe('chexec / checkTaint', () => {
  it('blocks email_send when input is tainted by email', () => {
    const call: ToolCall = {
      tool: 'email_send',
      args: { to: 'someone', body: 'leaked' },
      caller: AGENT,
      acap: 'cap_x',
      taints: [EMAIL_TAINT],
    }
    const r = checkTaint(call)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('taint_violation')
      expect(r.error.details).toMatchObject({ tool: 'email_send', taint_source: 'email' })
    }
  })

  it('blocks shell_exec when input is tainted by a fetched URL', () => {
    const call: ToolCall = {
      tool: 'shell_exec',
      args: { cmd: 'rm -rf' },
      caller: AGENT,
      acap: 'cap_x',
      taints: [URL_TAINT],
    }
    const r = checkTaint(call)
    expect(r.ok).toBe(false)
  })

  it('allows email_send when no taints are present', () => {
    const call: ToolCall = {
      tool: 'email_send',
      args: { to: 'self', body: 'ok' },
      caller: AGENT,
      acap: 'cap_x',
      taints: [],
    }
    const r = checkTaint(call)
    expect(r.ok).toBe(true)
  })

  it('does not block tools that have no policy entry', () => {
    const call: ToolCall = {
      tool: 'arbitrary_unknown_tool',
      args: {},
      caller: AGENT,
      acap: 'cap_x',
      taints: [EMAIL_TAINT],
    }
    const r = checkTaint(call)
    expect(r.ok).toBe(true)
  })
})

describe('chexec / propagate', () => {
  it('inherits input taints onto the result', () => {
    const call: ToolCall = {
      tool: 'transform',
      args: {},
      caller: AGENT,
      acap: 'cap_x',
      taints: [EMAIL_TAINT],
    }
    const r = propagate(call, { transformed: true })
    expect(r.taints).toHaveLength(1)
    expect(r.taints[0]?.source).toBe('email')
  })

  it('introduces a new taint when the tool says so', () => {
    const call: ToolCall = {
      tool: 'http_get',
      args: { url: 'https://example.com' },
      caller: AGENT,
      acap: 'cap_x',
      taints: [],
    }
    const r = propagate(call, '<html>...</html>', 'fetched_url')
    expect(r.taints).toHaveLength(1)
    expect(r.taints[0]?.source).toBe('fetched_url')
    expect(r.taints[0]?.origin).toBe('https://example.com')
  })

  it('unions input and tool-introduced taints', () => {
    const call: ToolCall = {
      tool: 'http_get',
      args: { url: 'https://example.com' },
      caller: AGENT,
      acap: 'cap_x',
      taints: [EMAIL_TAINT],
    }
    const r = propagate(call, '<html>...</html>', 'fetched_url')
    expect(r.taints).toHaveLength(2)
  })
})

describe('chexec / untaint', () => {
  it('refuses untaint by an unauthorized tool', () => {
    const result = {
      tool: 'whatever',
      value: 'data',
      produced_at: '2026-05-13T00:00:00Z',
      taints: [EMAIL_TAINT],
    }
    const r = untaint(result, 'random_tool')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('taint_violation')
  })

  it('strips taints when called by an authorized tool', () => {
    const result = {
      tool: 'whatever',
      value: 'data',
      produced_at: '2026-05-13T00:00:00Z',
      taints: [EMAIL_TAINT, URL_TAINT],
    }
    const r = untaint(result, 'compliance.untaint')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.taints).toEqual([])
  })
})

describe('default policy coverage', () => {
  it('blocks the expected exfil tools', () => {
    for (const tool of ['email_send', 'http_post', 'file_write', 'shell_exec', 'mcp_send']) {
      expect(DEFAULT_TAINT_POLICY.blocks.has(tool)).toBe(true)
    }
  })
})
