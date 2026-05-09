/**
 * Public surface for the skill-graph module.
 *
 * Tencent Hunyuan SkillSynth-style graph formalism over kbot's skill set.
 * Path sampling produces synthetic Tasks for the harness/ evolution loop.
 */
export type { Edge, GraphPath, Scenario, Skill, SkillGraph, } from './types.js';
export { isSkill } from './types.js';
export { buildGraph, addSkill, addScenario, addEdge, samplePath, findPaths, pathLengthDistribution, } from './graph.js';
export type { SampleOptions, PathLengthStats } from './graph.js';
export { pathToTask } from './synthesis.js';
export type { PathToTaskOptions } from './synthesis.js';
//# sourceMappingURL=index.d.ts.map