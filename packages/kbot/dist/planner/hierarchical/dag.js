/**
 * Task-Decoupled Planning (TDP) — DAG node types.
 *
 * Adopted from "Beyond Entangled Planning: Task-Decoupled Planning for
 * Long-Horizon Agents" (arXiv:2601.07577, 2026). The paper reports up to 82%
 * token reduction by decomposing a task into a DAG of sub-goals, each executed
 * under a context scoped to only that node's ancestors — not the full history.
 *
 * This module is types-only. Phase 2 of the hierarchical planner will wrap
 * existing Phase nodes as DAG nodes; no runtime here.
 *
 * Scoping rule (paper §3.2): a DAG node's context window contains
 *   - the node's own sub-goal + acceptance criteria
 *   - outputs (summaries) of ancestor nodes only
 *   - the typed tool schemas available for that node
 * Non-ancestor siblings are excluded. Replanning fires only when the node's
 * verifier rejects — never regenerates the whole trajectory.
 */
/**
 * Build the context a node sees during execution. Paper §3.2 calls this the
 * "scoped context". Returns ancestor summaries plus the node's own sub-goal.
 *
 * Ordering: breadth-first from roots, so earlier context appears first in the
 * prompt. The ancestor set is closed under the transitive parent relation.
 */
export function buildScopedContext(dag, nodeId) {
    const node = dag.nodes[nodeId];
    if (!node) {
        throw new Error(`buildScopedContext: node ${nodeId} not in DAG`);
    }
    const ancestors = collectAncestors(dag, nodeId);
    const ancestorSummaries = [];
    for (const aid of ancestors) {
        const a = dag.nodes[aid];
        if (a?.outputSummary) {
            ancestorSummaries.push({ id: aid, summary: a.outputSummary });
        }
    }
    return { subGoal: node.phase.objective, ancestorSummaries };
}
/** Transitive parents of `nodeId`, breadth-first, excluding the node itself. */
function collectAncestors(dag, nodeId) {
    const seen = new Set();
    const order = [];
    const queue = [...(dag.nodes[nodeId]?.parents ?? [])];
    while (queue.length > 0) {
        const next = queue.shift();
        if (seen.has(next))
            continue;
        seen.add(next);
        order.push(next);
        const parent = dag.nodes[next];
        if (parent)
            queue.push(...parent.parents);
    }
    return order;
}
/**
 * Topological order of `dag`. Throws on cycles — DAG invariant is caller's
 * responsibility to maintain; this is the detector of last resort.
 */
export function topologicalOrder(dag) {
    const inDegree = {};
    for (const id of Object.keys(dag.nodes))
        inDegree[id] = 0;
    for (const node of Object.values(dag.nodes)) {
        for (const _p of node.parents) {
            inDegree[node.id] = (inDegree[node.id] ?? 0) + 1;
        }
    }
    const ready = Object.keys(inDegree).filter(id => inDegree[id] === 0);
    const out = [];
    while (ready.length > 0) {
        const id = ready.shift();
        out.push(id);
        for (const other of Object.values(dag.nodes)) {
            if (other.parents.includes(id)) {
                inDegree[other.id] -= 1;
                if (inDegree[other.id] === 0)
                    ready.push(other.id);
            }
        }
    }
    if (out.length !== Object.keys(dag.nodes).length) {
        throw new Error('topologicalOrder: cycle detected in task DAG');
    }
    return out;
}
/** Nodes whose parents are all done — eligible to run next. */
export function readyNodes(dag) {
    return Object.values(dag.nodes).filter(n => {
        if (n.status !== 'pending')
            return false;
        return n.parents.every(pid => dag.nodes[pid]?.status === 'done');
    });
}
//# sourceMappingURL=dag.js.map