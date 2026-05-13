import type { AgentId, AgentManifest, ACapRequest, AgentBudget, NamespaceSpec, OSResult } from './types.js';
import { BudgetTracker } from './budget.js';
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
    readonly parent: AgentId | null;
    readonly purpose: string;
    /** Capabilities the parent wants to request for this child. The child
     *  cannot ever have more than what the parent had; the spawn
     *  function enforces this. */
    readonly requested_capabilities: ACapRequest[];
    /** Budget for the child. MUST be a subset of the parent's remaining
     *  budget. */
    readonly budget: AgentBudget;
    readonly namespace: NamespaceSpec;
}
export interface SpawnContext {
    /** Lookup: which agents are alive, and their tracker state. */
    readonly registry: AgentRegistry;
}
/**
 * The kernel's view of all running agents. In v0.1 this is in-process;
 * in v0.2 it lives behind a daemon process so multiple agent
 * processes can share the kernel.
 */
export declare class AgentRegistry {
    private readonly agents;
    register(agent: RegisteredAgent): OSResult<true>;
    get(id: AgentId): RegisteredAgent | undefined;
    has(id: AgentId): boolean;
    /** Returns the registered agent IDs whose parent is `id`. */
    children(id: AgentId | null): AgentId[];
    /** Returns the chain of parent IDs from `id` up to root. */
    ancestors(id: AgentId): AgentId[];
}
export interface RegisteredAgent {
    readonly manifest: AgentManifest;
    readonly tracker: BudgetTracker;
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
export declare function spawn(request: SpawnRequest, ctx: SpawnContext): OSResult<RegisteredAgent>;
//# sourceMappingURL=spawn.d.ts.map