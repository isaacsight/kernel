/**
 * Skill graph — runtime ops.
 *
 * Pure functions over the SkillGraph data structure. Mutators return new
 * instances rather than mutating in place; the underlying Maps and arrays
 * are copied. Random walks use a seeded LCG for deterministic tests.
 */
import type { Edge, GraphPath, Scenario, Skill, SkillGraph } from './types.js';
export declare function buildGraph(): SkillGraph;
export declare function addSkill(g: SkillGraph, skill: Skill): SkillGraph;
export declare function addScenario(g: SkillGraph, scenario: Scenario): SkillGraph;
export declare function addEdge(g: SkillGraph, edge: Edge): SkillGraph;
export interface SampleOptions {
    start?: string;
    maxLength?: number;
    seed?: number;
}
export declare function samplePath(g: SkillGraph, opts?: SampleOptions): GraphPath;
export declare function findPaths(g: SkillGraph, fromId: string, toId: string, maxDepth?: number): GraphPath[];
export interface PathLengthStats {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    samples: number;
}
export declare function pathLengthDistribution(g: SkillGraph, samples?: number, opts?: {
    seed?: number;
}): PathLengthStats;
//# sourceMappingURL=graph.d.ts.map