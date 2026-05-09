/**
 * Blast-radius hierarchy. Ordered from least to most dangerous.
 * A Persona's maxBlastRadius caps the radius any of its scopes may target;
 * mergePersonas() takes the maximum across inputs.
 */
export type BlastRadius = 'none' | 'read-only' | 'sandboxed' | 'destructive';
export declare const BLAST_RADIUS_ORDER: readonly BlastRadius[];
/**
 * Constraint applied to a single tool argument by name.
 * - `type` — required runtime type
 * - `allowedValues` — enum of permitted literal values (when type === 'enum')
 * - `pattern` — regex test for string args (rejected if it matches a
 *   forbidden form; we use it as a *deny* pattern by convention — see check.ts)
 * - `min` / `max` — numeric bounds (inclusive). For strings, applied to length.
 */
export interface ArgRule {
    type: 'string' | 'number' | 'boolean' | 'enum';
    allowedValues?: unknown[];
    pattern?: RegExp;
    /** When true, the regex acts as a *deny* pattern (match → reject). Defaults to false (must match). */
    denyPattern?: boolean;
    min?: number;
    max?: number;
}
/**
 * A single permission scope. Match against a tool name and a payload of args.
 * - `toolPattern` — exact string match or RegExp test
 * - `argConstraints` — keyed by argument name
 * - `rateLimit` — sliding-window counter shared per (persona.id, toolName)
 */
export interface Scope {
    toolPattern: string | RegExp;
    argConstraints?: Record<string, ArgRule>;
    rateLimit?: {
        max: number;
        windowMs: number;
    };
    /** Optional radius for this scope; cannot exceed Persona's maxBlastRadius. */
    blastRadius?: BlastRadius;
}
/**
 * Named, composable persona. `id` is the lookup key in the registry.
 */
export interface Persona {
    id: string;
    description: string;
    scopes: Scope[];
    maxBlastRadius?: BlastRadius;
}
export interface PermissionGrant {
    persona: Persona;
    toolName: string;
    args: Record<string, unknown>;
}
export interface Verdict {
    allowed: boolean;
    reason?: string;
    matchedScope?: Scope;
}
/**
 * Thrown by enforce(). Carries the full verdict for upstream logging.
 */
export declare class PermissionDeniedError extends Error {
    readonly verdict: Verdict;
    readonly grant: PermissionGrant;
    constructor(grant: PermissionGrant, verdict: Verdict);
}
//# sourceMappingURL=types.d.ts.map