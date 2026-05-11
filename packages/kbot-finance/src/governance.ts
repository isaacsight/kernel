import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalize, type JsonValue } from "./envelope.js";

/**
 * Material-gate approval tokens.
 *
 * Any action tagged `material: true` requires a signed approval token from
 * an authorized human approver before the engine executes. The token binds:
 *
 *   - approver identity
 *   - the exact action envelope the approver saw
 *   - timestamp
 *   - a cryptographic signature (HMAC-SHA256 for v0.1; Ed25519 in v0.2)
 *
 * v0.1 uses a shared secret per approver because it's the smallest landing
 * artifact. v0.2 replaces it with public-key signatures so approvers can
 * sign offline and the system only verifies.
 */

export interface ApprovalRequest {
  /** Action being approved — typically a content-addressed request_hash. */
  readonly request_hash: string;
  /** Human-readable summary of what the approver is signing off on. */
  readonly summary: string;
  /** Session ID. */
  readonly session_id: string;
  /** Materiality classification, e.g. "trade.execute", "model.deploy". */
  readonly materiality: string;
}

export interface ApprovalToken {
  readonly request_hash: string;
  readonly summary: string;
  readonly session_id: string;
  readonly materiality: string;
  readonly approver_id: string;
  readonly approved_at: string;
  readonly signature: string;
}

/** Compute the canonical signing input for an approval. */
function signingInput(req: ApprovalRequest, approver_id: string, approved_at: string): string {
  const payload: JsonValue = {
    approved_at,
    approver_id,
    materiality: req.materiality,
    request_hash: req.request_hash,
    session_id: req.session_id,
    summary: req.summary,
  };
  return canonicalize(payload);
}

/**
 * Approver — issues signed approval tokens. In production this is a separate
 * service held by compliance; for v0.1 it's an in-process module.
 */
export class Approver {
  constructor(
    private readonly approver_id: string,
    private readonly secret: Buffer,
  ) {}

  approve(request: ApprovalRequest): ApprovalToken {
    const approved_at = new Date().toISOString();
    const sig = createHmac("sha256", this.secret)
      .update(signingInput(request, this.approver_id, approved_at), "utf8")
      .digest("hex");
    return {
      ...request,
      approver_id: this.approver_id,
      approved_at,
      signature: sig,
    };
  }
}

/**
 * Verify an approval token. Returns true iff the signature matches and the
 * approver is in the provided trust set.
 */
export function verifyApproval(
  token: ApprovalToken,
  trusted: ReadonlyMap<string, Buffer>,
  request: ApprovalRequest,
): { ok: true } | { ok: false; reason: string } {
  // Bind every field to the request being signed off. A token cannot be
  // replayed against a different request.
  if (token.request_hash !== request.request_hash) {
    return { ok: false, reason: "request_hash_mismatch" };
  }
  if (token.session_id !== request.session_id) {
    return { ok: false, reason: "session_id_mismatch" };
  }
  if (token.materiality !== request.materiality) {
    return { ok: false, reason: "materiality_mismatch" };
  }
  if (token.summary !== request.summary) {
    return { ok: false, reason: "summary_mismatch" };
  }
  const secret = trusted.get(token.approver_id);
  if (secret === undefined) {
    return { ok: false, reason: "unknown_approver" };
  }
  const expected = createHmac("sha256", secret)
    .update(signingInput(request, token.approver_id, token.approved_at), "utf8")
    .digest("hex");
  const a = Buffer.from(token.signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return { ok: false, reason: "bad_signature" };
  if (!timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" };
  return { ok: true };
}
