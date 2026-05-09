/**
 * Skill graph — explicit graph formalism over skills + scenarios.
 *
 * Maps onto Tencent Hunyuan's "Toward Scalable Terminal Task Synthesis via
 * Skill Graphs" (arXiv:2604.25727). Wraps the Bayesian flat-skill ratings in
 * `packages/skill-router/` with structure: skill nodes, scenario nodes
 * (intermediate workflow contexts), and weighted edges between them.
 *
 * A path through the graph is a candidate workflow. Sampling paths produces
 * synthetic Tasks (compatible with `harness/types.ts`) for evaluation and
 * training.
 *
 * This module is types-only. Runtime lives in graph.ts and synthesis.ts.
 */
/** A skill node — typically maps 1:1 to a registered kbot tool. */
export interface Skill {
    id: string;
    description: string;
    /** Optional name of the underlying tool (from packages/kbot/src/tools/). */
    toolName?: string;
}
/**
 * A scenario node — an intermediate workflow context that connects skills.
 * Example: "after-cloning-a-repo", "in-an-ableton-set", "researching-a-paper".
 */
export interface Scenario {
    id: string;
    description: string;
    tags?: string[];
}
/** A directed edge between two nodes (skill or scenario). */
export interface Edge {
    from: string;
    to: string;
    /** Sampling weight; defaults to 1. Higher = more likely on a random walk. */
    weight?: number;
    kind: 'invokes' | 'follows' | 'requires';
}
/** Result of a graph traversal: ordered nodes + edges + length. */
export interface GraphPath {
    nodes: Array<Skill | Scenario>;
    edges: Edge[];
    pathLength: number;
}
/** Immutable-ish graph container. Mutators return new instances. */
export interface SkillGraph {
    skills: Map<string, Skill>;
    scenarios: Map<string, Scenario>;
    edges: Edge[];
}
/** Type guard: skill vs scenario. */
export declare function isSkill(node: Skill | Scenario): node is Skill;
//# sourceMappingURL=types.d.ts.map