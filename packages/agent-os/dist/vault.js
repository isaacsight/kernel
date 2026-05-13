import { err, ok } from './types.js';
export class Vault {
    entries = new Map();
    resolver;
    logs = [];
    constructor(resolver) {
        this.resolver = resolver ?? makeInMemoryResolver();
    }
    /** Register a credential reference. Only metadata; the secret value
     *  stays with the resolver. */
    register(entry) {
        if (this.entries.has(entry.ref)) {
            return err('capability_denied', `vault entry ${entry.ref} already exists`);
        }
        this.entries.set(entry.ref, entry);
        return ok(true);
    }
    /** Replace the resolver (for plugging in AWS Secrets Manager / Vault /
     *  1Password etc. without changing the agent contract). */
    withResolver(resolver) {
        this.resolver = resolver;
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
    async inject(ref, caller_acap) {
        const entry = this.entries.get(ref);
        if (!entry) {
            this.log(ref, caller_acap, undefined, 'missing');
            return err('namespace_violation', `vault has no entry for ${ref}`);
        }
        if (!subjectsMatch(caller_acap.subject, entry.bound_to)) {
            this.log(ref, caller_acap, entry.bound_to, 'denied');
            return err('capability_denied', `acap subject does not match vault entry binding`, {
                cred_ref: ref,
                acap_subject: caller_acap.subject,
                bound_to: entry.bound_to,
            });
        }
        const value = await this.resolver(ref);
        if (value === null) {
            this.log(ref, caller_acap, entry.bound_to, 'missing');
            return err('namespace_violation', `resolver returned null for ${ref}`);
        }
        this.log(ref, caller_acap, entry.bound_to, 'injected');
        return ok(materialize(entry.injection, value));
    }
    /** Read-only snapshot of recent injection log entries. Audit substrate
     *  consumes this; the agent does not. */
    recentLogs(limit = 100) {
        return this.logs.slice(-limit);
    }
    /** Number of registered entries. */
    size() {
        return this.entries.size;
    }
    /** Archive a credential reference. The entry is removed; resolvers
     *  may continue to hold the underlying secret independently. */
    archive(ref) {
        if (!this.entries.has(ref)) {
            return err('namespace_violation', `vault has no entry for ${ref}`);
        }
        this.entries.delete(ref);
        return ok(true);
    }
    log(cred_ref, caller, bound_subject, outcome) {
        this.logs.push({
            cred_ref,
            caller_acap: caller.id,
            bound_subject: bound_subject ?? caller.subject,
            injection_kind: 'header',
            outcome,
            at: new Date().toISOString(),
        });
    }
}
function materialize(shape, value) {
    switch (shape.kind) {
        case 'header':
            return {
                kind: 'header',
                name: shape.name,
                header_value: shape.prefix !== undefined ? `${shape.prefix}${value}` : value,
            };
        case 'query_param':
            return { kind: 'query_param', name: shape.name, param_value: value };
        case 'bearer_token':
            return { kind: 'bearer_token', header_value: `Bearer ${value}` };
    }
}
function subjectsMatch(a, b) {
    if (a.kind !== b.kind)
        return false;
    switch (a.kind) {
        case 'tool':
            return a.name === b.name;
        case 'mcp_server':
            return a.server === b.server;
        case 'resource':
            return a.uri === b.uri;
        case 'memory_block':
            return a.block_id === b.block_id;
        case 'audit_log':
            return a.namespace === b.namespace;
        case 'agent_handoff':
            return a.target_pattern === b.target_pattern;
    }
}
/** Default resolver — in-memory map for tests and local dev. Production
 *  deployments register a real resolver via `vault.withResolver()`. */
function makeInMemoryResolver() {
    const store = new Map();
    const fn = async (ref) => store.get(ref) ?? null;
    fn.set = (ref, value) => store.set(ref, value);
    return fn;
}
/** Helper for tests: build an in-memory resolver pre-populated with a map. */
export function inMemoryResolver(entries) {
    const store = new Map(Object.entries(entries));
    return async (ref) => {
        const v = store.get(ref);
        return v !== undefined ? v : null;
    };
}
//# sourceMappingURL=vault.js.map