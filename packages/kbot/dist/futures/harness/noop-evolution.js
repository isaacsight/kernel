/**
 * No-op EvolutionAgent — records but never rewrites the harness.
 *
 * The Sylph paper's outer-loop value comes from the EvolutionAgent
 * mutating the harness based on history. Real, safe code rewriting is a
 * multi-month problem; this stub satisfies the interface so the inner
 * loop runs end-to-end. Every other piece of the substrate (trace
 * persistence, regression detection, A/B evaluation, harness diffing)
 * works without any actual mutation.
 *
 * The contract is met; the substrate is shipped.
 */
export class NoopEvolutionAgent {
    /**
     * Returns the input harness unchanged. Reads `history` only to allow
     * subclasses to subscribe to inspection without forcing a re-read.
     */
    async evolve(history, best) {
        // Touch parameters explicitly so the type-checker stays happy in strict
        // mode and the intent — "we saw history, we chose not to act" — is clear.
        void history;
        return best;
    }
}
/** Convenience factory mirroring the rest of the futures module style. */
export function createNoopEvolutionAgent() {
    return new NoopEvolutionAgent();
}
//# sourceMappingURL=noop-evolution.js.map