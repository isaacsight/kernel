/**
 * Latent-state envelope — runtime helpers.
 * Pure functions over `LatentEnvelope`. Node `crypto` (sha256) for hashing.
 */
import type { LatentEnvelope, ProvenanceEntry } from './types.js';
/** JSON.stringify with deterministic key order (Object.keys().sort()). */
export declare function stableStringify(value: unknown): string;
export interface CreateEnvelopeOpts {
    from: string;
    to: string;
    text?: string;
    structured?: Record<string, unknown>;
    createdAt?: string;
    note?: string;
}
/**
 * Build a fresh envelope. Auto-derives `kind`, stamps `createdAt`, seeds
 * provenance with a single step from `opts.from`, and computes `contentHash`.
 */
export declare function createEnvelope(opts: CreateEnvelopeOpts): LatentEnvelope;
/** JSON-serialize an envelope with stable key order. */
export declare function serialize(env: LatentEnvelope): string;
/** Parse, validate shape, recompute hash, throw if mismatch. */
export declare function deserialize(s: string): LatentEnvelope;
/** True iff stored `contentHash` matches a fresh hash of the body. */
export declare function verifyHash(env: LatentEnvelope): boolean;
/** Append a provenance step and rehash. Returns a new envelope. */
export declare function withProvenance(env: LatentEnvelope, entry: Omit<ProvenanceEntry, 'step'> & {
    step?: number;
}): LatentEnvelope;
/**
 * Combine two envelopes from the same from/to pair.
 * - text: a + '\n' + b
 * - structured: shallow merge with one-level deep-merge for plain objects
 * - provenance: a then b, renumbered sequentially
 * - createdAt: fresh ISO timestamp; contentHash: recomputed
 */
export declare function merge(a: LatentEnvelope, b: LatentEnvelope): LatentEnvelope;
//# sourceMappingURL=envelope.d.ts.map