// futures/persona/types — type-checked privilege scoping for tool invocation.
//
// A Persona is a named bundle of Scopes. A Scope binds a tool pattern to a
// set of argument constraints, an optional rate limit, and is bounded by
// the Persona's max blast radius. canInvoke() resolves a (persona, tool, args)
// triple to a Verdict. enforce() turns a denied Verdict into a thrown error.
//
// Module is standalone — no integration into permissions.ts yet.
export const BLAST_RADIUS_ORDER = [
    'none',
    'read-only',
    'sandboxed',
    'destructive',
];
/**
 * Thrown by enforce(). Carries the full verdict for upstream logging.
 */
export class PermissionDeniedError extends Error {
    verdict;
    grant;
    constructor(grant, verdict) {
        super(`permission denied: persona=${grant.persona.id} tool=${grant.toolName} reason=${verdict.reason ?? 'no scope matched'}`);
        this.name = 'PermissionDeniedError';
        this.verdict = verdict;
        this.grant = grant;
    }
}
//# sourceMappingURL=types.js.map