// futures/persona/check — runtime resolver for (persona, tool, args) → Verdict.
//
// Pure resolution + a module-level Map for rate-limit counters. The Map is
// process-scoped, which is correct for a single CLI run; longer-lived state
// (e.g. across daemon restarts) is out of scope for v5 phase 1.
import { BLAST_RADIUS_ORDER, PermissionDeniedError, } from './types.js';
/** keyed by `${persona.id}::${toolName}` */
const RATE_LIMIT_STATE = new Map();
/**
 * Reset all rate-limit state. Test-only seam; not exported from index.ts.
 */
export function _resetRateLimits() {
    RATE_LIMIT_STATE.clear();
}
function rateKey(personaId, toolName) {
    return `${personaId}::${toolName}`;
}
function blastRadiusRank(r) {
    return BLAST_RADIUS_ORDER.indexOf(r);
}
function maxBlastRadius(a, b) {
    return blastRadiusRank(a) >= blastRadiusRank(b) ? a : b;
}
function patternMatches(pattern, toolName) {
    if (typeof pattern === 'string')
        return pattern === toolName;
    return pattern.test(toolName);
}
function checkArgRule(argName, value, rule) {
    // type
    if (rule.type === 'enum') {
        if (!rule.allowedValues || !rule.allowedValues.includes(value)) {
            return { ok: false, reason: `arg "${argName}" not in allowedValues` };
        }
        return { ok: true };
    }
    if (rule.type === 'string') {
        if (typeof value !== 'string')
            return { ok: false, reason: `arg "${argName}" must be string` };
        if (rule.pattern) {
            const matched = rule.pattern.test(value);
            if (rule.denyPattern && matched) {
                return { ok: false, reason: `arg "${argName}" matches deny pattern` };
            }
            if (!rule.denyPattern && !matched) {
                return { ok: false, reason: `arg "${argName}" does not match required pattern` };
            }
        }
        if (rule.min !== undefined && value.length < rule.min) {
            return { ok: false, reason: `arg "${argName}" shorter than min=${rule.min}` };
        }
        if (rule.max !== undefined && value.length > rule.max) {
            return { ok: false, reason: `arg "${argName}" longer than max=${rule.max}` };
        }
        return { ok: true };
    }
    if (rule.type === 'number') {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            return { ok: false, reason: `arg "${argName}" must be number` };
        }
        if (rule.min !== undefined && value < rule.min) {
            return { ok: false, reason: `arg "${argName}" below min=${rule.min}` };
        }
        if (rule.max !== undefined && value > rule.max) {
            return { ok: false, reason: `arg "${argName}" above max=${rule.max}` };
        }
        if (rule.allowedValues && !rule.allowedValues.includes(value)) {
            return { ok: false, reason: `arg "${argName}" not in allowedValues` };
        }
        return { ok: true };
    }
    if (rule.type === 'boolean') {
        if (typeof value !== 'boolean')
            return { ok: false, reason: `arg "${argName}" must be boolean` };
        if (rule.allowedValues && !rule.allowedValues.includes(value)) {
            return { ok: false, reason: `arg "${argName}" not in allowedValues` };
        }
        return { ok: true };
    }
    return { ok: false, reason: `arg "${argName}" unknown rule type` };
}
function checkArgs(scope, args) {
    if (!scope.argConstraints)
        return { ok: true };
    for (const [argName, rule] of Object.entries(scope.argConstraints)) {
        const result = checkArgRule(argName, args[argName], rule);
        if (!result.ok)
            return result;
    }
    return { ok: true };
}
function checkRateLimit(personaId, toolName, scope, now) {
    if (!scope.rateLimit)
        return { ok: true };
    const { max, windowMs } = scope.rateLimit;
    const key = rateKey(personaId, toolName);
    const bucket = RATE_LIMIT_STATE.get(key) ?? { hits: [] };
    // drop hits outside the window
    bucket.hits = bucket.hits.filter((ts) => now - ts < windowMs);
    if (bucket.hits.length >= max) {
        RATE_LIMIT_STATE.set(key, bucket);
        return { ok: false, reason: `rate limit exceeded (${max}/${windowMs}ms)` };
    }
    bucket.hits.push(now);
    RATE_LIMIT_STATE.set(key, bucket);
    return { ok: true };
}
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
export function canInvoke(persona, toolName, args, opts) {
    const now = opts?.now ?? Date.now();
    let lastFailure = null;
    let anyToolMatch = false;
    const personaCap = persona.maxBlastRadius;
    for (const scope of persona.scopes) {
        if (!patternMatches(scope.toolPattern, toolName))
            continue;
        anyToolMatch = true;
        // enforce blast-radius cap
        const scopeRadius = scope.blastRadius ?? personaCap ?? 'none';
        if (personaCap && blastRadiusRank(scopeRadius) > blastRadiusRank(personaCap)) {
            lastFailure = {
                reason: `scope blastRadius=${scopeRadius} exceeds persona max=${personaCap}`,
                scope,
            };
            continue;
        }
        const argResult = checkArgs(scope, args);
        if (!argResult.ok) {
            lastFailure = { reason: argResult.reason, scope };
            continue;
        }
        const rateResult = checkRateLimit(persona.id, toolName, scope, now);
        if (!rateResult.ok) {
            lastFailure = { reason: rateResult.reason, scope };
            continue;
        }
        return { allowed: true, matchedScope: scope };
    }
    if (lastFailure) {
        return { allowed: false, reason: lastFailure.reason, matchedScope: lastFailure.scope };
    }
    if (!anyToolMatch) {
        return { allowed: false, reason: `no scope matched tool "${toolName}"` };
    }
    return { allowed: false, reason: 'permission denied' };
}
/**
 * Throws PermissionDeniedError if canInvoke yields a denied verdict.
 * Returns the verdict on success for callers that want to inspect matchedScope.
 */
export function enforce(grant, opts) {
    const verdict = canInvoke(grant.persona, grant.toolName, grant.args, opts);
    if (!verdict.allowed)
        throw new PermissionDeniedError(grant, verdict);
    return verdict;
}
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
export function mergePersonas(...personas) {
    if (personas.length === 0) {
        return { id: 'empty', description: 'empty merged persona', scopes: [], maxBlastRadius: 'none' };
    }
    if (personas.length === 1)
        return personas[0];
    const id = personas.map((p) => p.id).join('+');
    const description = personas.map((p) => p.description).join('; ');
    const scopes = personas.flatMap((p) => p.scopes);
    let cap = 'none';
    for (const p of personas) {
        if (p.maxBlastRadius)
            cap = maxBlastRadius(cap, p.maxBlastRadius);
    }
    return { id, description, scopes, maxBlastRadius: cap };
}
/**
 * Lookup helper. Throws on miss so callers fail loudly rather than silently
 * proceeding without a scope.
 */
export function loadPersona(id, registry) {
    const found = registry[id];
    if (!found)
        throw new Error(`unknown persona id "${id}"`);
    return found;
}
//# sourceMappingURL=check.js.map