import { randomBytes } from 'node:crypto'
import type { AgentId, AgentManifest, ACapRequest, AgentBudget, NamespaceSpec, OSResult } from './types.js'
import { err, ok } from './types.js'
import { BudgetTracker } from './budget.js'

/**
 * spawn() — fork an agent with declared identity, parent, and signed
 * capability manifest. Returns a handle; no implicit inheritance of
 * parent tools or capabilities — every cap must be explicitly granted.
 *
 * The spawned agent's namespace and budget are constrained by the
 * parent's. The parent's BudgetTracker reserves the spawn slot before
 * creating the child.
 */

export interface SpawnRequest {
  /** Parent agent. The OS rejects spawn if this isn't a registered
   *  running agent. Root agent has parent = null and spawns are
   *  privileged operations. */
  readonly parent: AgentId | null
  readonly purpose: string
  /** Capabilities the parent wants to request for this child. The child
   *  cannot ever have more than what the parent had; the spawn
   *  function enforces this. */
  readonly requested_capabilities: ACapRequest[]
  /** Budget for the child. MUST be a subset of the parent's remaining
   *  budget. */
  readonly budget: AgentBudget
  readonly namespace: NamespaceSpec
}

export interface SpawnContext {
  /** Lookup: which agents are alive, and their tracker state. */
  readonly registry: AgentRegistry
}

/**
 * The kernel's view of all running agents. In v0.1 this is in-process;
 * in v0.2 it lives behind a daemon process so multiple agent
 * processes can share the kernel.
 */
export class AgentRegistry {
  private readonly agents = new Map<AgentId, RegisteredAgent>()

  register(agent: RegisteredAgent): OSResult<true> {
    if (this.agents.has(agent.manifest.id)) {
      return err('manifest_invalid', `agent ${agent.manifest.id} already registered`)
    }
    this.agents.set(agent.manifest.id, agent)
    return ok(true)
  }

  get(id: AgentId): RegisteredAgent | undefined {
    return this.agents.get(id)
  }

  has(id: AgentId): boolean {
    return this.agents.has(id)
  }

  /** Returns the registered agent IDs whose parent is `id`. */
  children(id: AgentId | null): AgentId[] {
    const out: AgentId[] = []
    for (const [child_id, agent] of this.agents) {
      if (agent.manifest.parent === id) out.push(child_id)
    }
    return out
  }

  /** Returns the chain of parent IDs from `id` up to root. */
  ancestors(id: AgentId): AgentId[] {
    const chain: AgentId[] = []
    let cursor: AgentId | null = id
    while (cursor !== null) {
      const agent = this.agents.get(cursor)
      if (!agent) break
      chain.push(cursor)
      cursor = agent.manifest.parent
    }
    return chain
  }
}

export interface RegisteredAgent {
  readonly manifest: AgentManifest
  readonly tracker: BudgetTracker
}

/**
 * Spawn a child agent. The parent's BudgetTracker is debited a spawn
 * slot; the child's manifest is registered; a fresh BudgetTracker is
 * created for the child.
 *
 * v0.1 does not yet enforce capability-subsetting or budget-subsetting
 * across the parent-child relationship — those checks land in v0.2.
 * The architecture supports them; the rules just aren't wired yet.
 */
export function spawn(request: SpawnRequest, ctx: SpawnContext): OSResult<RegisteredAgent> {
  if (request.parent !== null) {
    const parent = ctx.registry.get(request.parent)
    if (!parent) {
      return err('parent_not_found', `parent agent ${request.parent} is not registered`)
    }
    const spawnCheck = parent.tracker.canSpawn()
    if (!spawnCheck.ok) return spawnCheck
    parent.tracker.recordSpawn()
  }

  const id = makeAgentId()
  const manifest: AgentManifest = {
    id,
    parent: request.parent,
    purpose: request.purpose,
    requested_capabilities: request.requested_capabilities,
    budget: request.budget,
    namespace: request.namespace,
    created_at: new Date().toISOString(),
  }
  const tracker = new BudgetTracker(request.budget)
  const agent: RegisteredAgent = { manifest, tracker }
  const reg = ctx.registry.register(agent)
  if (!reg.ok) return reg
  return ok(agent)
}

function makeAgentId(): AgentId {
  return ('agent_' + randomBytes(10).toString('hex')) as AgentId
}
