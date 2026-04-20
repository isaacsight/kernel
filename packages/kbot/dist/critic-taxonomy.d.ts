/**
 * Reasoning-failure taxonomy for the critic gate.
 *
 * Adopted verbatim from "Stalled, Biased, and Confused: Uncovering Reasoning
 * Failures in LLMs for Cloud-Based Root Cause Analysis" (arXiv:2601.22208,
 * 2026). 16 modes, evaluated across 48k simulated scenarios on ReAct and
 * Plan-and-Execute workflows. The domain is cloud RCA but the modes generalize
 * to tool-using agents.
 *
 * Purpose here: replace ad-hoc ERROR_KEYWORDS matching in critic-gate.ts with
 * a typed classifier so that when the critic rejects a tool result we can
 * attribute the rejection to a named class. Makes FP-rate measurement tractable
 * per-class instead of in aggregate.
 *
 * This module is pure (no I/O, no LLM calls). Classification is rule-based and
 * intentionally conservative — when nothing matches, returns null and the
 * existing critic fallback handles it.
 */
export type RFClass = 'RF-01-fabricated-evidence' | 'RF-02-metric-interpretation' | 'RF-03-confused-provenance' | 'RF-04-temporal-misordering' | 'RF-05-spurious-causal-attribution' | 'RF-06-unjustified-instance-specificity' | 'RF-07-arbitrary-evidence-selection' | 'RF-08-evidential-insufficiency' | 'RF-09-failure-to-update-belief' | 'RF-10-simulation-role-confusion' | 'RF-11-excessive-speculation' | 'RF-12-repetition-failure-to-resume' | 'RF-13-anchoring-bias' | 'RF-14-invalid-inference-pattern' | 'RF-15-internal-contradiction' | 'RF-16-arithmetic-error';
export interface RFClassification {
    class: RFClass;
    evidence: string;
    confidence: number;
}
export interface TrajectoryStep {
    tool: string;
    args: Record<string, unknown>;
    result: string;
    timestampMs: number;
}
/** RF-12: trajectory-level — last N steps repeat the same tool+args. */
export declare function detectRepetition(trajectory: TrajectoryStep[], windowSize?: number): RFClassification | null;
/**
 * Classify a single tool result against the RF taxonomy.
 *
 * Returns the highest-confidence match, or null if nothing fires. Callers
 * should treat null as "no taxonomy signal" — not as "result is fine".
 */
export declare function classifyToolResult(result: string): RFClassification | null;
//# sourceMappingURL=critic-taxonomy.d.ts.map