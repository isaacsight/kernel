// @kernel.chat/kbot-orchestrator
// Reference implementation of orchestration engineering.
//
// See ROLE.md for the discipline definition. The library exposes the
// outreach pipeline as a callable function; the CLI in cli.ts is the
// command-line entry point.
export { parseBriefing, pending, emailable, } from './briefing.js';
export { GmailSender, } from './send.js';
export { runOutreach, } from './outreach.js';
export { appendSendResults } from './log.js';
export { loadCorpus, validateCorpus, preferredEmail, bestChannel, } from './corpus.js';
export { explore, } from './explore.js';
// ── v0.3 agent-fidelity primitives ──────────────────────────────
export { evaluateRefusals, refuseFabricatedReferences, refuseUnauthorizedAttestation, refuseImpersonation, refuseCredentialPhishing, refuseFalseWitness, DEFAULT_REFUSAL_PREDICATES, } from './refusal.js';
export { FidelityClassifier, createDefaultClassifier, } from './classifier.js';
export { createAttestation, canonicalize, recordHash, verifyAttestation, sha256Hex, } from './attestation.js';
//# sourceMappingURL=index.js.map