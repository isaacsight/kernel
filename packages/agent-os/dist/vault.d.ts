import type { ACap, ACapSubject, OSResult } from './types.js';
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
export type CredentialRef = string & {
    readonly __cred_ref: unique symbol;
};
/** The actual secret material — must never leave the Vault unrewritten. */
export type CredentialValue = string & {
    readonly __cred_value: unique symbol;
};
export interface VaultEntry {
    readonly ref: CredentialRef;
    /** Which capability subject is allowed to invoke this credential.
     *  The chexec layer cross-checks the caller's acap against this binding. */
    readonly bound_to: ACapSubject;
    /** How the secret material is injected into the tool's outbound request.
     *  Currently three shapes; extensible. */
    readonly injection: InjectionShape;
    /** Optional metadata for audit log entries. Never includes the secret. */
    readonly description?: string;
}
export type InjectionShape = {
    readonly kind: 'header';
    readonly name: string;
    readonly prefix?: string;
} | {
    readonly kind: 'query_param';
    readonly name: string;
} | {
    readonly kind: 'bearer_token';
};
/** A credential resolver fetches the actual secret value at injection
 *  time. The Vault holds references to resolvers, not secrets themselves —
 *  so memory snapshots and core dumps don't leak credentials. */
export type CredentialResolver = (ref: CredentialRef) => Promise<CredentialValue | null>;
/** Materialized injection — what the chexec layer should add to the
 *  outbound tool request. The secret is in `header_value` / `param_value`;
 *  the agent never sees this struct. */
export type Injection = {
    readonly kind: 'header';
    readonly name: string;
    readonly header_value: string;
} | {
    readonly kind: 'query_param';
    readonly name: string;
    readonly param_value: string;
} | {
    readonly kind: 'bearer_token';
    readonly header_value: string;
};
/** Audit-loggable record of an injection. Crucially: does NOT include
 *  the secret value. Records the ref name + binding + outcome. */
export interface InjectionLog {
    readonly cred_ref: CredentialRef;
    readonly caller_acap: string;
    readonly bound_subject: ACapSubject;
    readonly injection_kind: InjectionShape['kind'];
    readonly outcome: 'injected' | 'denied' | 'missing';
    readonly at: string;
}
export declare class Vault {
    private readonly entries;
    private resolver;
    private readonly logs;
    constructor(resolver?: CredentialResolver);
    /** Register a credential reference. Only metadata; the secret value
     *  stays with the resolver. */
    register(entry: VaultEntry): OSResult<true>;
    /** Replace the resolver (for plugging in AWS Secrets Manager / Vault /
     *  1Password etc. without changing the agent contract). */
    withResolver(resolver: CredentialResolver): void;
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
    inject(ref: CredentialRef, caller_acap: ACap): Promise<OSResult<Injection>>;
    /** Read-only snapshot of recent injection log entries. Audit substrate
     *  consumes this; the agent does not. */
    recentLogs(limit?: number): ReadonlyArray<InjectionLog>;
    /** Number of registered entries. */
    size(): number;
    /** Archive a credential reference. The entry is removed; resolvers
     *  may continue to hold the underlying secret independently. */
    archive(ref: CredentialRef): OSResult<true>;
    private log;
}
/** Helper for tests: build an in-memory resolver pre-populated with a map. */
export declare function inMemoryResolver(entries: Record<string, string>): CredentialResolver;
//# sourceMappingURL=vault.d.ts.map