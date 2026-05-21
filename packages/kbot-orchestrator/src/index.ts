// @kernel.chat/kbot-orchestrator
// Reference implementation of orchestration engineering.
//
// See ROLE.md for the discipline definition. The library exposes the
// outreach pipeline as a callable function; the CLI in cli.ts is the
// command-line entry point.

export {
  parseBriefing,
  pending,
  emailable,
  type Briefing,
  type Recipient,
} from './briefing.js'

export {
  GmailSender,
  type SenderConfig,
  type SendResult,
} from './send.js'

export {
  runOutreach,
  type OutreachRunOptions,
  type OutreachRunResult,
} from './outreach.js'

export { appendSendResults } from './log.js'

export {
  loadCorpus,
  validateCorpus,
  preferredEmail,
  bestChannel,
  type Candidate,
  type CandidateCorpus,
  type ContactChannel,
  type ChannelKind,
  type ChannelConfidence,
  type PitchTemplate,
} from './corpus.js'

export {
  explore,
  type ArtifactContext,
  type ExploreOptions,
  type ExploreResult,
} from './explore.js'

// ── v0.3 agent-fidelity primitives ──────────────────────────────

export {
  evaluateRefusals,
  refuseFabricatedReferences,
  refuseUnauthorizedAttestation,
  refuseImpersonation,
  refuseCredentialPhishing,
  refuseFalseWitness,
  DEFAULT_REFUSAL_PREDICATES,
  type RefusalCategory,
  type RefusalReason,
  type ProposedAction,
  type RefusalPredicate,
} from './refusal.js'

export {
  FidelityClassifier,
  createDefaultClassifier,
  type RefusalKind,
  type Classification,
  type ClassifierConfig,
} from './classifier.js'

export {
  createAttestation,
  canonicalize,
  recordHash,
  verifyAttestation,
  sha256Hex,
  type AuthorshipState,
  type AttestationRecord,
  type AttestationBuilder,
} from './attestation.js'
