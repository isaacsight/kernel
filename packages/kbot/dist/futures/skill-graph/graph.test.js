import { describe, expect, it } from 'vitest';
import { addEdge, addScenario, addSkill, buildGraph, findPaths, pathLengthDistribution, samplePath, } from './graph.js';
import { pathToTask } from './synthesis.js';
function build10NodeGraph() {
    let g = buildGraph();
    // 5 skills
    g = addSkill(g, { id: 'read', description: 'Read a file', toolName: 'read_file' });
    g = addSkill(g, { id: 'edit', description: 'Edit a file', toolName: 'edit_file' });
    g = addSkill(g, { id: 'grep', description: 'Search content', toolName: 'grep' });
    g = addSkill(g, { id: 'commit', description: 'Commit changes', toolName: 'git_commit' });
    g = addSkill(g, { id: 'test', description: 'Run tests', toolName: 'run_tests' });
    // 5 scenarios
    g = addScenario(g, { id: 'investigate', description: 'Investigate a bug', tags: ['debug'] });
    g = addScenario(g, { id: 'feature', description: 'Add a feature', tags: ['build'] });
    g = addScenario(g, { id: 'review', description: 'Review pull request', tags: ['review'] });
    g = addScenario(g, { id: 'release', description: 'Cut a release', tags: ['release'] });
    g = addScenario(g, { id: 'refactor', description: 'Refactor module', tags: ['cleanup'] });
    // edges
    g = addEdge(g, { from: 'investigate', to: 'grep', kind: 'invokes', weight: 2 });
    g = addEdge(g, { from: 'grep', to: 'read', kind: 'follows' });
    g = addEdge(g, { from: 'read', to: 'edit', kind: 'follows' });
    g = addEdge(g, { from: 'edit', to: 'test', kind: 'requires' });
    g = addEdge(g, { from: 'test', to: 'commit', kind: 'follows' });
    g = addEdge(g, { from: 'feature', to: 'edit', kind: 'invokes' });
    g = addEdge(g, { from: 'review', to: 'grep', kind: 'invokes' });
    g = addEdge(g, { from: 'release', to: 'test', kind: 'requires' });
    g = addEdge(g, { from: 'refactor', to: 'edit', kind: 'invokes' });
    return g;
}
describe('skill-graph', () => {
    it('builds an empty graph', () => {
        const g = buildGraph();
        expect(g.skills.size).toBe(0);
        expect(g.scenarios.size).toBe(0);
        expect(g.edges.length).toBe(0);
    });
    it('adders return new instances (immutable)', () => {
        const g0 = buildGraph();
        const g1 = addSkill(g0, { id: 'a', description: 'A' });
        expect(g0.skills.size).toBe(0);
        expect(g1.skills.size).toBe(1);
    });
    it('samples a deterministic path with seed', () => {
        const g = build10NodeGraph();
        const a = samplePath(g, { start: 'investigate', seed: 42, maxLength: 5 });
        const b = samplePath(g, { start: 'investigate', seed: 42, maxLength: 5 });
        expect(a.nodes.map((n) => n.id)).toEqual(b.nodes.map((n) => n.id));
    });
    it('sampled path visits expected scenario sequence', () => {
        const g = build10NodeGraph();
        const path = samplePath(g, { start: 'investigate', seed: 1, maxLength: 5 });
        const ids = path.nodes.map((n) => n.id);
        expect(ids[0]).toBe('investigate');
        // From investigate the only outgoing edge is to grep, so step 2 must be grep
        expect(ids[1]).toBe('grep');
        expect(path.pathLength).toBeGreaterThan(1);
    });
    it('respects maxLength', () => {
        const g = build10NodeGraph();
        const path = samplePath(g, { start: 'investigate', seed: 9, maxLength: 3 });
        expect(path.pathLength).toBeLessThanOrEqual(3);
    });
    it('returns empty path for missing start', () => {
        const g = build10NodeGraph();
        const path = samplePath(g, { start: 'nope', seed: 1 });
        expect(path.nodes.length).toBe(0);
        expect(path.edges.length).toBe(0);
    });
    it('findPaths discovers a known path', () => {
        const g = build10NodeGraph();
        const paths = findPaths(g, 'investigate', 'commit', 6);
        expect(paths.length).toBeGreaterThan(0);
        const first = paths[0];
        expect(first.nodes[0].id).toBe('investigate');
        expect(first.nodes[first.nodes.length - 1].id).toBe('commit');
    });
    it('findPaths returns empty array when no path exists', () => {
        const g = build10NodeGraph();
        const paths = findPaths(g, 'commit', 'investigate', 5);
        expect(paths.length).toBe(0);
    });
    it('pathLengthDistribution returns sane stats with deterministic seed', () => {
        const g = build10NodeGraph();
        const stats = pathLengthDistribution(g, 50, { seed: 7 });
        expect(stats.samples).toBe(50);
        expect(stats.min).toBeGreaterThanOrEqual(0);
        expect(stats.max).toBeGreaterThanOrEqual(stats.min);
        expect(stats.p50).toBeGreaterThanOrEqual(stats.min);
        expect(stats.p50).toBeLessThanOrEqual(stats.max);
        expect(stats.avg).toBeGreaterThanOrEqual(stats.min);
        expect(stats.avg).toBeLessThanOrEqual(stats.max);
    });
    it('pathLengthDistribution with 0 samples returns zeros', () => {
        const g = build10NodeGraph();
        const stats = pathLengthDistribution(g, 0);
        expect(stats.samples).toBe(0);
    });
    it('pathToTask produces non-empty instructions and acceptance', () => {
        const g = build10NodeGraph();
        const path = samplePath(g, { start: 'investigate', seed: 3, maxLength: 5 });
        const task = pathToTask(path, { prefix: 'test-' });
        expect(task.id.startsWith('test-')).toBe(true);
        expect(task.instructions.length).toBeGreaterThan(0);
        expect(task.acceptance.length).toBeGreaterThan(0);
        expect(task.meta?.source).toBe('skill-graph');
        expect(task.meta?.pathLength).toBe(path.pathLength);
    });
    it('pathToTask is deterministic for the same path', () => {
        const g = build10NodeGraph();
        const p1 = samplePath(g, { start: 'investigate', seed: 11, maxLength: 4 });
        const p2 = samplePath(g, { start: 'investigate', seed: 11, maxLength: 4 });
        const t1 = pathToTask(p1);
        const t2 = pathToTask(p2);
        expect(t1.id).toBe(t2.id);
    });
});
//# sourceMappingURL=graph.test.js.map