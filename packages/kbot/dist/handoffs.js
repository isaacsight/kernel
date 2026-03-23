// kbot Handoff System — Inter-agent routing and context transfer
//
// When a specialist agent detects that a query falls outside its domain,
// it can hand off to a more appropriate specialist. The handoff system:
//
//   1. Detects when a handoff is needed (keyword + confidence signals)
//   2. Builds context for the receiving agent
//   3. Executes the handoff (calls runAgent with the target agent)
//   4. Tracks the handoff chain to prevent infinite loops
//
// Maximum chain depth: 3 (source → handoff-1 → handoff-2 → handoff-3)
// Beyond that, the last agent must produce a final response.
import { SPECIALISTS } from './agents/specialists.js';
import { printInfo, printWarn } from './ui.js';
/** Built-in handoff rules — each defines when agent `from` should hand off to agent `to` */
const HANDOFF_RULES = [
    // coder → guardian: security concerns in code
    {
        from: 'coder',
        to: 'guardian',
        triggers: [
            /\b(vulnerab|exploit|injection|xss|csrf|auth bypass|privilege escalat|security\s+(?:issue|flaw|hole|risk|concern|review|audit))\b/i,
            /\b(CVE-\d{4}|OWASP|sql\s*inject|command\s*inject|insecure|unsafe\s+deserializ)\b/i,
            /\b(hardcoded\s+(?:password|secret|key|token|credential))\b/i,
        ],
        description: 'Security concern detected in code context',
    },
    // coder → aesthete: design / UI questions
    {
        from: 'coder',
        to: 'aesthete',
        triggers: [
            /\b(design|layout|UX|UI|user\s*experience|user\s*interface|accessib|a11y)\b/i,
            /\b(visual|aesthetic|typography|color\s*(?:scheme|palette)|spacing|responsive)\b/i,
            /\b(animation|transition|hover\s*state|interaction\s*design|wireframe|mockup)\b/i,
        ],
        description: 'Design or UI/UX question detected',
    },
    // researcher → analyst: data needs strategic interpretation
    {
        from: 'researcher',
        to: 'analyst',
        triggers: [
            /\b(strategic|strategy|evaluate|assessment|trade-?off|comparison|pros?\s+(?:and|&|vs)\s+cons?)\b/i,
            /\b(recommend|decision|choose\s+between|which\s+(?:is|should|would)|cost-?benefit)\b/i,
            /\b(business\s+impact|ROI|market\s+(?:analysis|position|opportunity))\b/i,
        ],
        description: 'Research findings need strategic interpretation',
    },
    // any → coder: when response requires code implementation
    {
        from: '*',
        to: 'coder',
        triggers: [
            /\b(implement|code\s+(?:this|that|it|up)|write\s+(?:a |the )?(?:function|class|module|component|script))\b/i,
            /\b(build\s+(?:a |the )?(?:feature|system|api|endpoint|service))\b/i,
            /\b(fix\s+(?:the |this )?(?:bug|error|issue|crash)|debug|refactor|patch)\b/i,
            /\b(create\s+(?:a |the )?(?:file|test|migration|hook|util))\b/i,
        ],
        description: 'Task requires code implementation',
    },
    // any → researcher: when response needs fact-checking or citations
    {
        from: '*',
        to: 'researcher',
        triggers: [
            /\b(research|find\s+(?:out|information)|look\s+(?:up|into)|investigate|fact.?check)\b/i,
            /\b(what\s+(?:is|are|does|do)\s+.{3,}\??|source|citation|reference|evidence)\b/i,
            /\b(latest|current|recent|up.?to.?date|state\s+of\s+the\s+art)\b/i,
        ],
        description: 'Task requires research or fact-checking',
    },
    // any → guardian: explicit security requests
    {
        from: '*',
        to: 'guardian',
        triggers: [
            /\b(security\s+(?:audit|review|scan|check)|pen\s*test|threat\s+model)\b/i,
            /\b(harden|secure\s+(?:this|the)|check\s+for\s+vulnerab)\b/i,
        ],
        description: 'Explicit security review requested',
    },
    // any → writer: content creation requests
    {
        from: '*',
        to: 'writer',
        triggers: [
            /\b(write\s+(?:a |the )?(?:blog|article|post|email|newsletter|docs|readme|changelog))\b/i,
            /\b(draft|compose|summarize|paraphrase|rewrite\s+(?:this|the))\b/i,
        ],
        description: 'Content writing task detected',
    },
    // any → infrastructure: deployment / DevOps requests
    {
        from: '*',
        to: 'infrastructure',
        triggers: [
            /\b(deploy|CI\s*\/?\s*CD|pipeline|docker|kubernetes|k8s|terraform|helm)\b/i,
            /\b(infrastructure|infra|devops|monitoring|alerting|scaling|load\s*balanc)\b/i,
        ],
        description: 'Infrastructure or deployment task detected',
    },
];
/** Maximum depth of handoff chain to prevent infinite loops */
const MAX_HANDOFF_DEPTH = 3;
// ── Detection ──
/**
 * Analyze if the current agent should hand off to another specialist.
 * Checks the response and original query against handoff rules.
 *
 * Returns a Handoff object if a handoff is recommended, null otherwise.
 */
export function detectHandoff(agentId, response, query) {
    // Combine response and query for analysis
    const combined = `${query}\n${response}`;
    // Find matching rules (agent-specific first, then wildcard)
    let bestMatch = null;
    for (const rule of HANDOFF_RULES) {
        // Skip rules that don't apply to this agent
        if (rule.from !== '*' && rule.from !== agentId)
            continue;
        // Don't hand off to yourself
        if (rule.to === agentId)
            continue;
        // Don't hand off to an agent that doesn't exist
        if (!SPECIALISTS[rule.to])
            continue;
        // Count trigger matches
        const matchCount = rule.triggers.filter(t => t.test(combined)).length;
        if (matchCount === 0)
            continue;
        // Prefer agent-specific rules over wildcards
        const priority = rule.from === '*' ? matchCount : matchCount + 2;
        if (!bestMatch || priority > bestMatch.matchCount) {
            bestMatch = { rule, matchCount: priority };
        }
    }
    // Require at least 1 trigger match for agent-specific rules,
    // or 2 trigger matches for wildcard rules
    if (!bestMatch)
        return null;
    const isWildcard = bestMatch.rule.from === '*';
    if (isWildcard && bestMatch.matchCount < 2)
        return null;
    return {
        from: agentId,
        to: bestMatch.rule.to,
        reason: bestMatch.rule.description,
        context: buildHandoffContext('', {
            from: agentId,
            to: bestMatch.rule.to,
            reason: bestMatch.rule.description,
            context: query,
            preserveHistory: true,
        }),
        preserveHistory: true,
    };
}
// ── Context building ──
/**
 * Build the context string for the receiving agent.
 * Includes a handoff header, the accumulated context, and the reason.
 */
export function buildHandoffContext(currentContext, handoff) {
    const fromAgent = SPECIALISTS[handoff.from];
    const fromName = fromAgent ? fromAgent.name : handoff.from;
    const parts = [];
    parts.push(`[Handoff from ${fromName}]`);
    parts.push(`Reason: ${handoff.reason}`);
    if (currentContext) {
        parts.push('');
        parts.push('Previous context:');
        parts.push(currentContext);
    }
    if (handoff.context) {
        parts.push('');
        parts.push('Handoff context:');
        parts.push(handoff.context);
    }
    return parts.join('\n');
}
// ── Execution ──
/**
 * Execute a handoff: call runAgent with the target agent and built context.
 * Tracks the handoff chain and enforces maximum depth.
 *
 * The runAgent function is passed as a parameter to avoid circular imports
 * (agent.ts imports from many modules, and those modules should not import agent.ts).
 */
export async function executeHandoff(handoff, query, runAgentFn, chain = []) {
    // Enforce max depth
    // chain contains [from, to, from, to, ...] — each handoff adds 2 entries
    const handoffCount = Math.floor(chain.length / 2);
    if (handoffCount >= MAX_HANDOFF_DEPTH) {
        printWarn(`[handoff] Maximum chain depth (${MAX_HANDOFF_DEPTH}) reached: ${chain.join(' -> ')}. ` +
            `Stopping at ${chain[chain.length - 1]}.`);
        return {
            agent: chain[chain.length - 1] || handoff.from,
            response: `Handoff chain limit reached. The last agent in the chain should provide the final response.`,
            handoffChain: chain,
        };
    }
    const newChain = [...chain, handoff.from, handoff.to];
    const toAgent = SPECIALISTS[handoff.to];
    const toName = toAgent ? toAgent.name : handoff.to;
    printInfo(`[handoff] ${SPECIALISTS[handoff.from]?.name || handoff.from} -> ${toName}: ${handoff.reason}`);
    try {
        // Build prefixed query with handoff context
        const contextualQuery = handoff.preserveHistory
            ? `${handoff.context}\n\nUser query: ${query}`
            : query;
        const result = await runAgentFn(contextualQuery, {
            agent: handoff.to,
        });
        // Check if the receiving agent also wants to hand off
        const nextHandoff = detectHandoff(handoff.to, result.content, query);
        const newHandoffCount = Math.floor(newChain.length / 2);
        if (nextHandoff && newHandoffCount < MAX_HANDOFF_DEPTH) {
            // Prevent cycles: don't hand off back to an agent already in the chain
            if (newChain.includes(nextHandoff.to)) {
                printInfo(`[handoff] Cycle detected (${nextHandoff.to} already in chain). Stopping.`);
                return {
                    agent: handoff.to,
                    response: result.content,
                    handoffChain: newChain,
                };
            }
            return executeHandoff(nextHandoff, query, runAgentFn, newChain);
        }
        return {
            agent: handoff.to,
            response: result.content,
            handoffChain: newChain,
        };
    }
    catch (err) {
        printWarn(`[handoff] Failed to hand off to ${toName}: ${err instanceof Error ? err.message : String(err)}`);
        return {
            agent: handoff.from,
            response: `Handoff to ${toName} failed. Continuing with ${SPECIALISTS[handoff.from]?.name || handoff.from}.`,
            handoffChain: [...chain, handoff.from],
        };
    }
}
/**
 * Get all available handoff rules (for diagnostics / UI).
 */
export function getHandoffRules() {
    return HANDOFF_RULES;
}
/**
 * Check if an agent ID is a valid specialist that can participate in handoffs.
 */
export function isHandoffTarget(agentId) {
    return agentId in SPECIALISTS;
}
//# sourceMappingURL=handoffs.js.map