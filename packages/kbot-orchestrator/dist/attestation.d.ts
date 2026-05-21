export type AuthorshipState = 'principal-authored' | 'principal-refined-from-agent' | 'agent-drafted' | 'agent-fully-autonomous' | 'unknown';
export interface AttestationRecord {
    /** Schema version — bump when fields change incompatibly. */
    v: 1;
    /** ISO 8601 timestamp when the attestation was created. */
    ts: string;
    /** Free-form identifier for the principal (e.g. email). */
    principalId: string;
    /** Free-form identifier for the agent that produced the content (e.g. 'kbot-orchestrator@0.3.0-alpha.0'). */
    agentId: string;
    /** State of authorship for the content being attested. */
    authorship: AuthorshipState;
    /** SHA-256 hash of the attested content (typically the final body that ships). */
    contentHash: string;
    /** Optional: SHA-256 hash of the agent's pre-refinement draft, if applicable. */
    agentDraftHash?: string;
    /** What the principal is attesting (e.g., "the content above is accurate to my knowledge"). */
    attestation: string;
    /** Free-form context the substrate would need to replay the decision. */
    context?: Record<string, unknown>;
}
export interface AttestationBuilder {
    principalId: string;
    agentId: string;
    authorship: AuthorshipState;
    content: string;
    agentDraft?: string;
    attestation: string;
    context?: Record<string, unknown>;
}
/** Compute a stable SHA-256 hash of a string. */
export declare function sha256Hex(input: string): string;
/** Create an attestation record with stable, content-addressed hashing. */
export declare function createAttestation(b: AttestationBuilder): AttestationRecord;
/** Canonical JSON serialization (stable key ordering) — content-addressable. */
export declare function canonicalize(record: AttestationRecord): string;
/** Content-address the attestation itself (SHA-256 of its canonical form). */
export declare function recordHash(record: AttestationRecord): string;
/** A simple verifier: given a record + the content, confirm the content hash matches what was attested. */
export declare function verifyAttestation(record: AttestationRecord, content: string): {
    ok: boolean;
    reason?: string;
};
//# sourceMappingURL=attestation.d.ts.map