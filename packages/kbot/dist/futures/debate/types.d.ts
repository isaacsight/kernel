/**
 * Asymmetric debate types — BARRED-style guardrail synthesis.
 *
 * Two LLMs argue opposite sides of a candidate input
 * ("safe to allow" vs "must block"); a third LLM judges.
 * Output is JSONL training data for the critic.
 *
 * Source: "BARRED: Custom Policy Guardrails via Asymmetric Debate"
 * (Plurai, arXiv 2604.25203). See V5_FUTURES_PLAN.md.
 */
/**
 * The thing under debate. `candidate` is the input being evaluated;
 * `context` is optional surrounding context (system state, prior turns);
 * `categoryHint` lets the caller tag the example for downstream filtering.
 */
export interface DebateInput {
    candidate: string;
    context?: string;
    categoryHint?: string;
}
/**
 * Three asymmetric roles: two advocates (one for allow, one for block),
 * and a single judge that synthesizes the verdict.
 */
export type AsymmetricRoles = 'allow-advocate' | 'block-advocate' | 'judge';
/**
 * One round of the debate. Multiple rounds form the transcript.
 */
export interface DebateRound {
    role: AsymmetricRoles;
    argument: string;
    ts: string;
}
/**
 * Final verdict from the judge, plus the full transcript that produced it.
 * `confidence` is in [0, 1]; `undecided` is used when the judge output
 * is unparseable or the judge explicitly declines.
 */
export interface Verdict {
    label: 'allow' | 'block' | 'undecided';
    confidence: number;
    rationale: string;
    rounds: DebateRound[];
}
/**
 * Injectable LLM client. The runner only ever calls `respond`;
 * tests pass a deterministic stub. Production wiring lives elsewhere
 * so this module never imports a provider SDK.
 */
export interface LLMClient {
    respond(prompt: string, role: AsymmetricRoles): Promise<string>;
}
/**
 * Runner options. `maxRounds` defaults to 4 (allow→block→allow→block);
 * `seed` is forwarded to the client for callers that support it.
 */
export interface DebateOpts {
    maxRounds?: number;
    client: LLMClient;
    seed?: number;
}
/**
 * Persisted training example. One per debate run.
 */
export interface TrainingExample {
    input: DebateInput;
    label: Verdict['label'];
    confidence: number;
    rationale: string;
    rounds: DebateRound[];
}
//# sourceMappingURL=types.d.ts.map