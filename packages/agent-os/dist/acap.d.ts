import type { ACap, ACapRequest, AgentId, OSResult } from './types.js';
/**
 * Agent Capabilities (acap) — signed, revocable tokens granting an
 * agent the right to do a specific thing for a specific duration.
 *
 * Compared to MCP's OAuth 2.1 + scopes: acaps are agent-scoped
 * (every agent in the tree has its own set), invocation-counted
 * (max_invocations), and downscopable on handoff (the receiving
 * agent can never get more than the sender had).
 *
 * v0.1 uses HMAC-SHA256 — parity with kbot-finance's governance.ts.
 * v0.2 upgrades to Ed25519 so granting agents can sign offline and
 * the OS only verifies.
 */
/** A revocation list — capabilities the parent has explicitly invalidated
 *  before their natural ttl. Per-namespace. */
export declare class RevocationList {
    private readonly revoked;
    revoke(acap_id: string): void;
    isRevoked(acap_id: string): boolean;
    size(): number;
}
export interface GrantOptions {
    readonly granted_by: AgentId;
    readonly granted_to: AgentId;
    /** ISO 8601 UTC — when this capability expires. */
    readonly expires_at: string;
    /** Shared secret for HMAC signing. v0.2 swaps this for a private key. */
    readonly signing_key: Buffer;
}
/**
 * Grant a capability request, producing a signed acap.
 * The parent agent decides whether to grant; this function only
 * produces the cryptographic artefact.
 */
export declare function grant(request: ACapRequest, opts: GrantOptions): ACap;
export interface VerifyOptions {
    /** Trust registry — maps agent IDs to their signing keys. */
    readonly trust: ReadonlyMap<AgentId, Buffer>;
    /** Optional revocation list to check against. */
    readonly revocations?: RevocationList;
    /** Override "now" for testability. */
    readonly now?: Date;
}
/**
 * Verify an acap is currently valid: signature matches, not expired,
 * not revoked, not exhausted, signer is in the trust set.
 */
export declare function verify(acap: ACap, opts: VerifyOptions): OSResult<true>;
/**
 * Downscope an acap when transferring on handoff. The receiver's
 * version MUST be at most as permissive as the sender's:
 *  - same or narrower scope
 *  - same or fewer max_invocations
 *  - same or earlier expiry
 *
 * If the request violates any of these, returns handoff_escalation_denied.
 */
export declare function downscope(source: ACap, request: Partial<ACapRequest> & {
    granted_to: AgentId;
    signing_key: Buffer;
}): OSResult<ACap>;
//# sourceMappingURL=acap.d.ts.map