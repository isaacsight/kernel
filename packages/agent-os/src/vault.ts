import type { ACap, ACapSubject, OSResult } from './types.js'
import { err, ok } from './types.js'

/**
 * Vault — server-side credential injection outside the agent sandbox.
 *
 * The pattern adopted from Claude Managed Agents' vault design: credentials
 * never enter the agent's context. The agent references a credential by
 * name; the OS resolves and injects it at the chexec boundary; the secret
 * material is added to the outbound tool request server-side. A
 * prompt-injection attack that compromises the agent's reasoning cannot
 * read secrets that never crossed into its context.
 *
 * agent-os generalizes CMA's pattern in two ways:
 *  - bindings are to any ACapSubject, not just MCP server URLs
 *  - the resolver is pluggable so secrets can live in any backing store
 *    (file, env, AWS Secrets Manager, Vault, 1Password, on-device keychain)
 *
 * v0.1 ships with an in-memory resolver. Production deployments register
 * a custom resolver via `Vault.withResolver()`.
 */

/** A reference name an agent uses to ask for a credential without seeing
 *  its value. e.g. "factset_api", "sec_edgar_user_agent". */
export type CredentialRef = string & { readonly __cred_ref: unique symbol }

/** The actual secret material — must never leave the Vault unrewritten. */
export type CredentialValue = string & { readonly __cred_value: unique symbol }

export interface VaultEntry {
  readonly ref: CredentialRef
  /** Which capability subject is allowed to invoke this credential.
   *  The chexec layer cross-checks the caller's acap against this binding. */
  readonly bound_to: ACapSubject
  /** How the secret material is injected into the tool's outbound request.
   *  Currently three shapes; extensible. */
  readonly injection: InjectionShape
  /** Optional metadata for audit log entries. Never includes the secret. */
  readonly description?: string
}

export type InjectionShape =
  | { readonly kind: 'header'; readonly name: string; readonly prefix?: string }
  | { readonly kind: 'query_param'; readonly name: string }
  | { readonly kind: 'bearer_token' }

/** A credential resolver fetches the actual secret value at injection
 *  time. The Vault holds references to resolvers, not secrets themselves —
 *  so memory snapshots and core dumps don't leak credentials. */
export type CredentialResolver = (ref: CredentialRef) => Promise<CredentialValue | null>

/** Materialized injection — what the chexec layer should add to the
 *  outbound tool request. The secret is in `header_value` / `param_value`;
 *  the agent never sees this struct. */
export type Injection =
  | { readonly kind: 'header'; readonly name: string; readonly header_value: string }
  | { readonly kind: 'query_param'; readonly name: string; readonly param_value: string }
  | { readonly kind: 'bearer_token'; readonly header_value: string }

/** Audit-loggable record of an injection. Crucially: does NOT include
 *  the secret value. Records the ref name + binding + outcome. */
export interface InjectionLog {
  readonly cred_ref: CredentialRef
  readonly caller_acap: string
  readonly bound_subject: ACapSubject
  readonly injection_kind: InjectionShape['kind']
  readonly outcome: 'injected' | 'denied' | 'missing'
  readonly at: string
}

export class Vault {
  private readonly entries = new Map<CredentialRef, VaultEntry>()
  private resolver: CredentialResolver
  private readonly logs: InjectionLog[] = []

  constructor(resolver?: CredentialResolver) {
    this.resolver = resolver ?? makeInMemoryResolver()
  }

  /** Register a credential reference. Only metadata; the secret value
   *  stays with the resolver. */
  register(entry: VaultEntry): OSResult<true> {
    if (this.entries.has(entry.ref)) {
      return err('capability_denied', `vault entry ${entry.ref} already exists`)
    }
    this.entries.set(entry.ref, entry)
    return ok(true)
  }

  /** Replace the resolver (for plugging in AWS Secrets Manager / Vault /
   *  1Password etc. without changing the agent contract). */
  withResolver(resolver: CredentialResolver): void {
    this.resolver = resolver
  }

  /**
   * Inject a credential into a tool call. Returns the materialized
   * injection or an error. Validates:
   *   1. The credential exists in the vault.
   *   2. The caller's acap binds to a subject that matches the
   *      vault entry's `bound_to`.
   *   3. The resolver returns a value.
   *
   * Logs the outcome regardless of success.
   */
  async inject(ref: CredentialRef, caller_acap: ACap): Promise<OSResult<Injection>> {
    const entry = this.entries.get(ref)
    if (!entry) {
      this.log(ref, caller_acap, undefined, 'missing')
      return err('namespace_violation', `vault has no entry for ${ref}`)
    }
    if (!subjectsMatch(caller_acap.subject, entry.bound_to)) {
      this.log(ref, caller_acap, entry.bound_to, 'denied')
      return err(
        'capability_denied',
        `acap subject does not match vault entry binding`,
        {
          cred_ref: ref,
          acap_subject: caller_acap.subject,
          bound_to: entry.bound_to,
        },
      )
    }
    const value = await this.resolver(ref)
    if (value === null) {
      this.log(ref, caller_acap, entry.bound_to, 'missing')
      return err('namespace_violation', `resolver returned null for ${ref}`)
    }
    this.log(ref, caller_acap, entry.bound_to, 'injected')
    return ok(materialize(entry.injection, value))
  }

  /** Read-only snapshot of recent injection log entries. Audit substrate
   *  consumes this; the agent does not. */
  recentLogs(limit = 100): ReadonlyArray<InjectionLog> {
    return this.logs.slice(-limit)
  }

  /** Number of registered entries. */
  size(): number {
    return this.entries.size
  }

  /** Archive a credential reference. The entry is removed; resolvers
   *  may continue to hold the underlying secret independently. */
  archive(ref: CredentialRef): OSResult<true> {
    if (!this.entries.has(ref)) {
      return err('namespace_violation', `vault has no entry for ${ref}`)
    }
    this.entries.delete(ref)
    return ok(true)
  }

  private log(
    cred_ref: CredentialRef,
    caller: ACap,
    bound_subject: ACapSubject | undefined,
    outcome: InjectionLog['outcome'],
  ): void {
    this.logs.push({
      cred_ref,
      caller_acap: caller.id,
      bound_subject: bound_subject ?? caller.subject,
      injection_kind: 'header',
      outcome,
      at: new Date().toISOString(),
    })
  }
}

function materialize(shape: InjectionShape, value: CredentialValue): Injection {
  switch (shape.kind) {
    case 'header':
      return {
        kind: 'header',
        name: shape.name,
        header_value: shape.prefix !== undefined ? `${shape.prefix}${value}` : (value as string),
      }
    case 'query_param':
      return { kind: 'query_param', name: shape.name, param_value: value as string }
    case 'bearer_token':
      return { kind: 'bearer_token', header_value: `Bearer ${value}` }
  }
}

function subjectsMatch(a: ACapSubject, b: ACapSubject): boolean {
  if (a.kind !== b.kind) return false
  switch (a.kind) {
    case 'tool':
      return a.name === (b as { name: string }).name
    case 'mcp_server':
      return a.server === (b as { server: string }).server
    case 'resource':
      return a.uri === (b as { uri: string }).uri
    case 'memory_block':
      return a.block_id === (b as { block_id: string }).block_id
    case 'audit_log':
      return a.namespace === (b as { namespace: string }).namespace
    case 'agent_handoff':
      return a.target_pattern === (b as { target_pattern: string }).target_pattern
  }
}

/** Default resolver — in-memory map for tests and local dev. Production
 *  deployments register a real resolver via `vault.withResolver()`. */
function makeInMemoryResolver(): CredentialResolver {
  const store = new Map<CredentialRef, CredentialValue>()
  const fn: CredentialResolver = async (ref) => store.get(ref) ?? null
  ;(fn as CredentialResolver & { set: (r: CredentialRef, v: CredentialValue) => void }).set = (
    ref,
    value,
  ) => store.set(ref, value)
  return fn
}

/** Helper for tests: build an in-memory resolver pre-populated with a map. */
export function inMemoryResolver(
  entries: Record<string, string>,
): CredentialResolver {
  const store = new Map<string, string>(Object.entries(entries))
  return async (ref) => {
    const v = store.get(ref as string)
    return v !== undefined ? (v as CredentialValue) : null
  }
}
