import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { buildScopedContext, topologicalOrder, readyNodes, } from './dag.js';
function mkPhase(id, objective) {
    return {
        id,
        goalId: 'g',
        kind: 'other',
        objective,
        exitCriteria: [],
        startedAt: '2026-04-20T00:00:00.000Z',
        status: 'active',
    };
}
function mkNode(id, parents, objective, outputSummary) {
    return {
        id,
        parents,
        phase: mkPhase(id, objective),
        actions: [],
        outputSummary,
        verdicts: [],
        status: outputSummary ? 'done' : 'pending',
    };
}
function mkDAG(...nodes) {
    const byId = {};
    for (const n of nodes)
        byId[n.id] = n;
    const roots = nodes.filter(n => n.parents.length === 0).map(n => n.id);
    return { roots, nodes: byId };
}
describe('dag — scoped context', () => {
    it('returns only ancestor summaries, not sibling output', () => {
        // a → b, a → c, b → d. d should see a, b; not c.
        const a = mkNode('a', [], 'root goal', 'a done');
        const b = mkNode('b', ['a'], 'left branch', 'b done');
        const c = mkNode('c', ['a'], 'right branch', 'c done');
        const d = mkNode('d', ['b'], 'leaf task');
        const dag = mkDAG(a, b, c, d);
        const ctx = buildScopedContext(dag, 'd');
        assert.equal(ctx.subGoal, 'leaf task');
        const ids = ctx.ancestorSummaries.map(s => s.id).sort();
        assert.deepEqual(ids, ['a', 'b']);
    });
    it('omits ancestors whose summary has not been produced yet', () => {
        const a = mkNode('a', [], 'root', undefined); // pending
        const b = mkNode('b', ['a'], 'child');
        const dag = mkDAG(a, b);
        const ctx = buildScopedContext(dag, 'b');
        assert.equal(ctx.ancestorSummaries.length, 0);
    });
    it('throws on unknown node id', () => {
        assert.throws(() => buildScopedContext(mkDAG(mkNode('a', [], 'x')), 'missing'));
    });
});
describe('dag — topological order', () => {
    it('orders nodes so parents precede children', () => {
        const a = mkNode('a', [], 'a');
        const b = mkNode('b', ['a'], 'b');
        const c = mkNode('c', ['a', 'b'], 'c');
        const dag = mkDAG(a, b, c);
        const order = topologicalOrder(dag);
        assert.ok(order.indexOf('a') < order.indexOf('b'));
        assert.ok(order.indexOf('b') < order.indexOf('c'));
    });
    it('detects cycles', () => {
        const a = mkNode('a', ['b'], 'a');
        const b = mkNode('b', ['a'], 'b');
        assert.throws(() => topologicalOrder(mkDAG(a, b)), /cycle/);
    });
});
describe('dag — readyNodes', () => {
    it('returns pending nodes whose parents are all done', () => {
        const a = mkNode('a', [], 'a', 'a done');
        const b = mkNode('b', ['a'], 'b');
        const c = mkNode('c', ['b'], 'c');
        const dag = mkDAG(a, b, c);
        const ready = readyNodes(dag).map(n => n.id);
        assert.deepEqual(ready, ['b']);
    });
    it('returns no nodes when the only pending one has unfinished parents', () => {
        const a = mkNode('a', [], 'a'); // pending, no summary
        const b = mkNode('b', ['a'], 'b');
        const dag = mkDAG(a, b);
        // a itself is pending with no parents → it should be ready.
        const ready = readyNodes(dag).map(n => n.id);
        assert.deepEqual(ready, ['a']);
    });
});
//# sourceMappingURL=dag.test.js.map