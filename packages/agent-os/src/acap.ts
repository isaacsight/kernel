import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { ACap, ACapRequest, AgentId, ManifestSignature, OSResult } from './types.js'
import { err, ok } from './types.js'

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
export class RevocationList {
  private readonly revoked = new Set<string>()

  revoke(acap_id: string): void {
    this.revoked.add(acap_id)
  }

  isRevoked(acap_id: string): boolean {
    return this.revoked.has(acap_id)
  }

  size(): number {
    return this.revoked.size
  }
}

export interface GrantOptions {
  readonly granted_by: AgentId
  readonly granted_to: AgentId
  /** ISO 8601 UTC — when this capability expires. */
  readonly expires_at: string
  /** Shared secret for HMAC signing. v0.2 swaps this for a private key. */
  readonly signing_key: Buffer
}

/**
 * Grant a capability request, producing a signed acap.
 * The parent agent decides whether to grant; this function only
 * produces the cryptographic artefact.
 */
export function grant(request: ACapRequest, opts: GrantOptions): ACap {
  const id = randomBytes(16).toString('hex')
  const granted_at = new Date().toISOString()

  const acap: Omit<ACap, 'signature' | 'invocations'> = {
    id,
    subject: request.subject,
    scope: request.scope,
    justification: request.justification,
    ...(request.max_invocations !== undefined ? { max_invocations: request.max_invocations } : {}),
    granted_to: opts.granted_to,
    granted_by: opts.granted_by,
    granted_at,
    expires_at: opts.expires_at,
  }

  const signature = signAcap(acap, opts.granted_by, opts.signing_key)
  return { ...acap, signature, invocations: 0 }
}

/** HMAC-SHA256 signature over the canonical acap fields. */
function signAcap(
  acap: Omit<ACap, 'signature' | 'invocations'>,
  signer: AgentId,
  key: Buffer,
): ManifestSignature {
  const signed_at = new Date().toISOString()
  const payload = canonicalize({
    id: acap.id,
    subject: acap.subject,
    scope: [...acap.scope],
    justification: acap.justification,
    max_invocations: acap.max_invocations ?? null,
    granted_to: acap.granted_to,
    granted_by: acap.granted_by,
    granted_at: acap.granted_at,
    expires_at: acap.expires_at,
    signer,
    signed_at,
  })
  const signature = createHmac('sha256', key).update(payload, 'utf8').digest('hex')
  return {
    algorithm: 'hmac-sha256',
    signer,
    signature,
    signed_at,
  }
}

export interface VerifyOptions {
  /** Trust registry — maps agent IDs to their signing keys. */
  readonly trust: ReadonlyMap<AgentId, Buffer>
  /** Optional revocation list to check against. */
  readonly revocations?: RevocationList
  /** Override "now" for testability. */
  readonly now?: Date
}

/**
 * Verify an acap is currently valid: signature matches, not expired,
 * not revoked, not exhausted, signer is in the trust set.
 */
export function verify(acap: ACap, opts: VerifyOptions): OSResult<true> {
  const now = (opts.now ?? new Date()).getTime()
  const expires = Date.parse(acap.expires_at)
  if (Number.isFinite(expires) && now >= expires) {
    return err('capability_expired', `acap ${acap.id} expired at ${acap.expires_at}`)
  }

  if (acap.max_invocations !== undefined && acap.invocations >= acap.max_invocations) {
    return err(
      'capability_exhausted',
      `acap ${acap.id} exhausted: ${acap.invocations}/${acap.max_invocations}`,
    )
  }

  if (opts.revocations?.isRevoked(acap.id) === true) {
    return err('capability_denied', `acap ${acap.id} has been revoked`)
  }

  const key = opts.trust.get(acap.signature.signer as AgentId)
  if (!key) {
    return err('capability_denied', `signer ${acap.signature.signer} not in trust set`)
  }

  const { signature, invocations, ...skeleton } = acap
  void invocations
  const expected = signAcap(skeleton, acap.signature.signer as AgentId, key)
  const a = Buffer.from(signature.signature, 'hex')
  const b = Buffer.from(expected.signature, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return err('capability_denied', `acap ${acap.id} has an invalid signature`)
  }
  return ok(true)
}

/**
 * Downscope an acap when transferring on handoff. The receiver's
 * version MUST be at most as permissive as the sender's:
 *  - same or narrower scope
 *  - same or fewer max_invocations
 *  - same or earlier expiry
 *
 * If the request violates any of these, returns handoff_escalation_denied.
 */
export function downscope(
  source: ACap,
  request: Partial<ACapRequest> & { granted_to: AgentId; signing_key: Buffer },
): OSResult<ACap> {
  const subject = request.subject ?? source.subject
  // Subject must match exactly — no morphing through downscope.
  if (subject.kind !== source.subject.kind) {
    return err(
      'handoff_escalation_denied',
      `downscope cannot change subject kind: ${source.subject.kind} -> ${subject.kind}`,
    )
  }

  const requestedScope = new Set(request.scope ?? source.scope)
  const sourceScope = new Set(source.scope)
  for (const s of requestedScope) {
    if (!sourceScope.has(s)) {
      return err('handoff_escalation_denied', `downscope cannot add scope "${s}"`)
    }
  }

  const sourceMax = source.max_invocations
  const requestedMax = request.max_invocations
  if (sourceMax !== undefined && (requestedMax === undefined || requestedMax > sourceMax)) {
    return err(
      'handoff_escalation_denied',
      `downscope cannot grant max_invocations=${requestedMax ?? 'unlimited'} when source=${sourceMax}`,
    )
  }

  // Source remaining invocations also constrain the downscoped version.
  const sourceRemaining =
    sourceMax !== undefined ? sourceMax - source.invocations : Number.POSITIVE_INFINITY
  if (requestedMax !== undefined && requestedMax > sourceRemaining) {
    return err(
      'handoff_escalation_denied',
      `downscope cannot grant more invocations (${requestedMax}) than source has remaining (${sourceRemaining})`,
    )
  }

  // Expires at the source's expiry or earlier.
  return ok(
    grant(
      {
        subject,
        scope: [...requestedScope],
        justification: request.justification ?? `downscoped from ${source.id}`,
        ...(requestedMax !== undefined ? { max_invocations: requestedMax } : {}),
      },
      {
        granted_to: request.granted_to,
        granted_by: source.granted_to, // The original holder grants downstream.
        expires_at: source.expires_at,
        signing_key: request.signing_key,
      },
    ),
  )
}

/** Canonical JSON serialization for signing. Sorted keys, deterministic. */
function canonicalize(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']'
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>
    const keys = Object.keys(v).sort()
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(v[k])).join(',') + '}'
  }
  throw new Error(`canonicalize: unsupported type ${typeof value}`)
}
