import { randomBytes } from 'node:crypto';
import { err, ok } from './types.js';
import { BudgetTracker } from './budget.js';
/**
 * The kernel's view of all running agents. In v0.1 this is in-process;
 * in v0.2 it lives behind a daemon process so multiple agent
 * processes can share the kernel.
 */
export class AgentRegistry {
    agents = new Map();
    register(agent) {
        if (this.agents.has(agent.manifest.id)) {
            return err('manifest_invalid', `agent ${agent.manifest.id} already registered`);
        }
        this.agents.set(agent.manifest.id, agent);
        return ok(true);
    }
    get(id) {
        return this.agents.get(id);
    }
    has(id) {
        return this.agents.has(id);
    }
    /** Returns the registered agent IDs whose parent is `id`. */
    children(id) {
        const out = [];
        for (const [child_id, agent] of this.agents) {
            if (agent.manifest.parent === id)
                out.push(child_id);
        }
        return out;
    }
    /** Returns the chain of parent IDs from `id` up to root. */
    ancestors(id) {
        const chain = [];
        let cursor = id;
        while (cursor !== null) {
            const agent = this.agents.get(cursor);
            if (!agent)
                break;
            chain.push(cursor);
            cursor = agent.manifest.parent;
        }
        return chain;
    }
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
export function spawn(request, ctx) {
    if (request.parent !== null) {
        const parent = ctx.registry.get(request.parent);
        if (!parent) {
            return err('parent_not_found', `parent agent ${request.parent} is not registered`);
        }
        const spawnCheck = parent.tracker.canSpawn();
        if (!spawnCheck.ok)
            return spawnCheck;
        parent.tracker.recordSpawn();
    }
    const id = makeAgentId();
    const manifest = {
        id,
        parent: request.parent,
        purpose: request.purpose,
        requested_capabilities: request.requested_capabilities,
        budget: request.budget,
        namespace: request.namespace,
        created_at: new Date().toISOString(),
    };
    const tracker = new BudgetTracker(request.budget);
    const agent = { manifest, tracker };
    const reg = ctx.registry.register(agent);
    if (!reg.ok)
        return reg;
    return ok(agent);
}
function makeAgentId() {
    return ('agent_' + randomBytes(10).toString('hex'));
}
//# sourceMappingURL=spawn.js.map