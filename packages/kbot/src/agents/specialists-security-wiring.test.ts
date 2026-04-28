// Wiring tests: confirm guardian (and hacker, if present) include the new
// unified security_agent_* tools in their allowedTools list.
//
// The unified security agent ships as runSecurityAgent in
// `agents/security-agent.ts`, exposed to the agent runtime via the
// `security_agent_scan` and `security_agent_report` tools (registered in
// `tools/swarm-2026-04.ts` -> `tools/security-agent-tools.ts`).
import { describe, it, expect } from 'vitest'

import { SPECIALISTS } from './specialists.js'

describe('Specialist security-agent wiring', () => {
  it('exposes a guardian specialist', () => {
    expect(SPECIALISTS.guardian).toBeDefined()
  })

  it('guardian.allowedTools includes security_agent_scan', () => {
    const tools = SPECIALISTS.guardian.allowedTools ?? []
    expect(tools).toContain('security_agent_scan')
  })

  it('guardian.allowedTools includes security_agent_report', () => {
    const tools = SPECIALISTS.guardian.allowedTools ?? []
    expect(tools).toContain('security_agent_report')
  })

  it('guardian still has its core defensive tools (regression guard)', () => {
    const tools = SPECIALISTS.guardian.allowedTools ?? []
    // Spot-check that we did not accidentally drop existing capabilities.
    for (const t of ['read_file', 'grep', 'cve_lookup', 'dep_audit']) {
      expect(tools).toContain(t)
    }
  })

  it('guardian prompt instructs Step 0: security_agent_scan in report-only mode', () => {
    const prompt = SPECIALISTS.guardian.prompt
    expect(prompt).toMatch(/security_agent_scan/)
    expect(prompt).toMatch(/report-only/)
  })

  // Hacker is currently defined as a Claude Code agent
  // (.claude/agents/hacker.md), not a SPECIALISTS entry. If a future change
  // adds it here, this guard ensures it picks up the same wiring.
  it('hacker, if defined as a SPECIALISTS entry, includes security_agent_scan', () => {
    const hacker = (SPECIALISTS as Record<string, { allowedTools?: string[] }>).hacker
    if (!hacker) return // hacker lives in .claude/agents/ — nothing to assert here
    const tools = hacker.allowedTools ?? []
    expect(tools).toContain('security_agent_scan')
  })
})
