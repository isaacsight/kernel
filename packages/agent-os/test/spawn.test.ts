import { describe, expect, it } from 'vitest'
import { spawn, AgentRegistry } from '../src/spawn.js'
import type { AgentBudget, NamespaceSpec, AgentId } from '../src/types.js'

const STANDARD_BUDGET: AgentBudget = {
  max_input_tokens: 100_000,
  max_output_tokens: 50_000,
  max_wall_clock_seconds: 600,
  max_cost_usd: 5.0,
  max_children: 3,
}

const STANDARD_NS: NamespaceSpec = {
  name: 'test',
  memory: [],
  tools: ['http_get'],
  audit_namespace: 'test:audit',
  mounts: [],
}

describe('spawn', () => {
  it('creates a root agent (parent=null)', () => {
    const registry = new AgentRegistry()
    const r = spawn(
      {
        parent: null,
        purpose: 'root',
        requested_capabilities: [],
        budget: STANDARD_BUDGET,
        namespace: STANDARD_NS,
      },
      { registry },
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.manifest.parent).toBeNull()
  })

  it('creates a child agent and registers it under the parent', () => {
    const registry = new AgentRegistry()
    const parent = spawn(
      {
        parent: null,
        purpose: 'root',
        requested_capabilities: [],
        budget: STANDARD_BUDGET,
        namespace: STANDARD_NS,
      },
      { registry },
    )
    if (!parent.ok) throw new Error('parent spawn failed')

    const child = spawn(
      {
        parent: parent.value.manifest.id,
        purpose: 'do a small thing',
        requested_capabilities: [],
        budget: { ...STANDARD_BUDGET, max_children: 0 },
        namespace: { ...STANDARD_NS, name: 'child' },
      },
      { registry },
    )
    expect(child.ok).toBe(true)
    if (child.ok) {
      expect(child.value.manifest.parent).toBe(parent.value.manifest.id)
      expect(registry.children(parent.value.manifest.id)).toContain(child.value.manifest.id)
    }
  })

  it('refuses spawn when parent is unknown', () => {
    const registry = new AgentRegistry()
    const r = spawn(
      {
        parent: 'agent_nonexistent' as AgentId,
        purpose: 'orphan',
        requested_capabilities: [],
        budget: STANDARD_BUDGET,
        namespace: STANDARD_NS,
      },
      { registry },
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('parent_not_found')
  })

  it('refuses spawn when parent has reached its child limit', () => {
    const registry = new AgentRegistry()
    const parent = spawn(
      {
        parent: null,
        purpose: 'root',
        requested_capabilities: [],
        budget: { ...STANDARD_BUDGET, max_children: 2 },
        namespace: STANDARD_NS,
      },
      { registry },
    )
    if (!parent.ok) throw new Error('parent spawn failed')

    // Two children allowed
    for (let i = 0; i < 2; i++) {
      const c = spawn(
        {
          parent: parent.value.manifest.id,
          purpose: `child-${i}`,
          requested_capabilities: [],
          budget: STANDARD_BUDGET,
          namespace: { ...STANDARD_NS, name: `child-${i}` },
        },
        { registry },
      )
      expect(c.ok).toBe(true)
    }

    // Third should be denied
    const denied = spawn(
      {
        parent: parent.value.manifest.id,
        purpose: 'overflow',
        requested_capabilities: [],
        budget: STANDARD_BUDGET,
        namespace: { ...STANDARD_NS, name: 'overflow' },
      },
      { registry },
    )
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.error.code).toBe('budget_exceeded')
  })

  it('lets registry trace the ancestry chain', () => {
    const registry = new AgentRegistry()
    const root = spawn(
      {
        parent: null,
        purpose: 'root',
        requested_capabilities: [],
        budget: STANDARD_BUDGET,
        namespace: STANDARD_NS,
      },
      { registry },
    )
    if (!root.ok) throw new Error('root spawn failed')

    const mid = spawn(
      {
        parent: root.value.manifest.id,
        purpose: 'mid',
        requested_capabilities: [],
        budget: STANDARD_BUDGET,
        namespace: { ...STANDARD_NS, name: 'mid' },
      },
      { registry },
    )
    if (!mid.ok) throw new Error('mid spawn failed')

    const leaf = spawn(
      {
        parent: mid.value.manifest.id,
        purpose: 'leaf',
        requested_capabilities: [],
        budget: STANDARD_BUDGET,
        namespace: { ...STANDARD_NS, name: 'leaf' },
      },
      { registry },
    )
    if (!leaf.ok) throw new Error('leaf spawn failed')

    const ancestry = registry.ancestors(leaf.value.manifest.id)
    expect(ancestry).toEqual([leaf.value.manifest.id, mid.value.manifest.id, root.value.manifest.id])
  })
})
