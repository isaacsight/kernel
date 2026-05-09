/**
 * Latent-state envelope — type definitions.
 *
 * Maps onto "Recursive Multi-Agent Systems" (Stanford/UIUC/NVIDIA/MIT,
 * arXiv:2604.25917). Today most inter-agent handoffs are plain text. As
 * models gain native structured-state IO, the harness should already be
 * carrying typed envelopes so the upgrade path is a payload swap, not an
 * interface change.
 *
 * Runtime lives in `envelope.ts`.
 */
/** One step in the chain of custody. */
export interface ProvenanceEntry {
    step: number;
    agent: string;
    ts: string;
    note?: string;
}
/**
 * Payload discriminator.
 *  - 'text'       — text only (today's common case)
 *  - 'structured' — structured payload only (latent-state native)
 *  - 'mixed'      — both present
 */
export type EnvelopeKind = 'text' | 'structured' | 'mixed';
/**
 * `contentHash` is sha256 over a canonical JSON serialization of the body
 * (every field except contentHash itself). Used by `verifyHash` to detect
 * tampering and by `merge` to derive fresh hashes after combining.
 */
export interface LatentEnvelope {
    version: 1;
    from: string;
    to: string;
    kind: EnvelopeKind;
    text?: string;
    structured?: Record<string, unknown>;
    provenance: ProvenanceEntry[];
    createdAt: string;
    contentHash: string;
}
/** Wraps an envelope for transport. `ackToken` reserved for future ack flows. */
export interface AgentTransfer {
    envelope: LatentEnvelope;
    ackToken?: string;
}
//# sourceMappingURL=types.d.ts.map