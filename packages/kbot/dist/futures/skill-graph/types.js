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
/** Type guard: skill vs scenario. */
export function isSkill(node) {
    return 'description' in node && !('tags' in node) && !('id' in node && node.tags !== undefined);
}
//# sourceMappingURL=types.js.map