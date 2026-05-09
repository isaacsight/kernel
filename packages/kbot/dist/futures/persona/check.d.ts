import { PermissionGrant, Persona, Verdict } from './types.js';
/**
 * Reset all rate-limit state. Test-only seam; not exported from index.ts.
 */
export declare function _resetRateLimits(): void;
/**
 * Resolve (persona, tool, args) → Verdict.
 *
 * Iterates scopes in order; the first scope whose toolPattern matches and
 * whose argConstraints + rateLimit + blast-radius all pass produces an
 * `allowed: true` verdict. If a scope's toolPattern matches but a check
 * fails, we continue checking later scopes — a denial on one scope doesn't
 * forbid a later, more permissive scope.
 *
 * If no scope matches the tool name at all, the verdict is denied with
 * reason "no scope matched". If scopes matched but all failed sub-checks,
 * the verdict is denied with the *last* failure reason.
 */
export declare function canInvoke(persona: Persona, toolName: string, args: Record<string, unknown>, opts?: {
    now?: number;
}): Verdict;
/**
 * Throws PermissionDeniedError if canInvoke yields a denied verdict.
 * Returns the verdict on success for callers that want to inspect matchedScope.
 */
export declare function enforce(grant: PermissionGrant, opts?: {
    now?: number;
}): Verdict;
/**
 * Compose multiple personas into a single one.
 * - id: joined with "+"
 * - description: joined with "; "
 * - scopes: concatenated (canInvoke iterates in order, so earliest wins ties)
 * - maxBlastRadius: max over all inputs (undefined treated as 'none')
 *
 * Rate-limit state is keyed on the *resulting* persona's id, so merged
 * personas have their own counter independent of the inputs.
 */
export declare function mergePersonas(...personas: Persona[]): Persona;
/**
 * Lookup helper. Throws on miss so callers fail loudly rather than silently
 * proceeding without a scope.
 */
export declare function loadPersona(id: string, registry: Record<string, Persona>): Persona;
//# sourceMappingURL=check.d.ts.map