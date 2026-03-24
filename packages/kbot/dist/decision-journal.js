// kbot Decision Journal — Log WHY, Not Just What
//
// Most AI tools are black boxes. You see the output, not the reasoning.
// The decision journal captures the WHY behind every key decision:
//   - Why this agent was routed (confidence, keywords, pattern match)
//   - Why this model was selected (cost, capability, latency, availability)
//   - Why this tool was chosen (intent match, past success rate)
//   - Why a fallback was triggered (error, timeout, rate limit)
//
// Users see this via `kbot decisions` — transparency builds trust.
// Future kbot models learn from the reasoning chains, not just outcomes.
//
// Storage: ~/.kbot/memory/decisions/YYYY-MM-DD.jsonl (one JSON per line, append-only)
import { existsSync, appendFileSync, readFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
const DECISIONS_DIR = join(homedir(), '.kbot', 'memory', 'decisions');
function ensureDir() {
    if (!existsSync(DECISIONS_DIR))
        mkdirSync(DECISIONS_DIR, { recursive: true });
}
function todayFile() {
    return join(DECISIONS_DIR, `${new Date().toISOString().split('T')[0]}.jsonl`);
}
// ── Logging ──
/** Log a decision. Call this from agent routing, model selection, tool pipeline, etc. */
export function logDecision(decision) {
    ensureDir();
    const entry = {
        ...decision,
        timestamp: new Date().toISOString(),
    };
    appendFileSync(todayFile(), JSON.stringify(entry) + '\n');
}
/** Quick helper for agent routing decisions */
export function logAgentRouting(opts) {
    logDecision({
        type: 'agent-routing',
        decision: `Routed to ${opts.chosenAgent}`,
        reasoning: [
            `Method: ${opts.method}`,
            `Confidence: ${(opts.confidence * 100).toFixed(0)}%`,
            opts.alternatives.length > 0
                ? `Considered: ${opts.alternatives.join(', ')}`
                : 'No strong alternatives',
        ],
        alternatives: opts.alternatives,
        confidence: opts.confidence,
        evidence: { method: opts.method },
        userContext: opts.userMessage.slice(0, 100),
    });
}
/** Quick helper for model selection decisions */
export function logModelSelection(opts) {
    logDecision({
        type: 'model-selection',
        decision: `Selected ${opts.chosenModel} via ${opts.chosenProvider}`,
        reasoning: [opts.reason, `Cost tier: ${opts.cost}`],
        alternatives: opts.alternatives,
        confidence: 0.8,
        evidence: { model: opts.chosenModel, provider: opts.chosenProvider, cost: opts.cost },
        userContext: opts.userMessage.slice(0, 100),
    });
}
/** Quick helper for fallback triggers */
export function logFallback(opts) {
    logDecision({
        type: 'fallback-trigger',
        decision: `Fell back from ${opts.from} to ${opts.to}`,
        reasoning: [opts.reason, opts.error ? `Error: ${opts.error}` : ''].filter(Boolean),
        alternatives: [],
        confidence: 1.0, // Fallbacks are deterministic
        evidence: { from: opts.from, to: opts.to, error: opts.error },
        userContext: '',
    });
}
/** Quick helper for security blocks */
export function logSecurityBlock(opts) {
    logDecision({
        type: 'security-block',
        decision: `Blocked: ${opts.action}`,
        reasoning: [`Security: ${opts.reason}`, `Severity: ${opts.severity}`],
        alternatives: [],
        confidence: 1.0,
        evidence: { severity: opts.severity },
        userContext: opts.userMessage.slice(0, 100),
    });
}
// ── Retrieval ──
/** Get today's decisions */
export function getTodaysDecisions() {
    const path = todayFile();
    if (!existsSync(path))
        return [];
    return readFileSync(path, 'utf-8')
        .split('\n')
        .filter(Boolean)
        .map(line => { try {
        return JSON.parse(line);
    }
    catch {
        return null;
    } })
        .filter(Boolean);
}
/** Get decisions for a specific date */
export function getDecisions(date) {
    const path = join(DECISIONS_DIR, `${date}.jsonl`);
    if (!existsSync(path))
        return [];
    return readFileSync(path, 'utf-8')
        .split('\n')
        .filter(Boolean)
        .map(line => { try {
        return JSON.parse(line);
    }
    catch {
        return null;
    } })
        .filter(Boolean);
}
/** Get decisions by type */
export function getDecisionsByType(type, limit = 50) {
    ensureDir();
    const allDecisions = [];
    const files = readdirSync(DECISIONS_DIR).filter(f => f.endsWith('.jsonl')).sort().reverse();
    for (const file of files) {
        if (allDecisions.length >= limit)
            break;
        const decisions = readFileSync(join(DECISIONS_DIR, file), 'utf-8')
            .split('\n')
            .filter(Boolean)
            .map(line => { try {
            return JSON.parse(line);
        }
        catch {
            return null;
        } })
            .filter((d) => d !== null && d.type === type);
        allDecisions.push(...decisions);
    }
    return allDecisions.slice(0, limit);
}
/** Get decision stats */
export function getDecisionStats() {
    ensureDir();
    const todayDecisions = getTodaysDecisions();
    const allFiles = readdirSync(DECISIONS_DIR).filter(f => f.endsWith('.jsonl'));
    let total = 0;
    const byType = {};
    let confidenceSum = 0;
    let securityBlocks = 0;
    let fallbacks = 0;
    for (const file of allFiles) {
        const lines = readFileSync(join(DECISIONS_DIR, file), 'utf-8').split('\n').filter(Boolean);
        for (const line of lines) {
            try {
                const d = JSON.parse(line);
                total++;
                byType[d.type] = (byType[d.type] || 0) + 1;
                confidenceSum += d.confidence;
                if (d.type === 'security-block')
                    securityBlocks++;
                if (d.type === 'fallback-trigger')
                    fallbacks++;
            }
            catch { /* skip corrupt */ }
        }
    }
    return {
        total,
        today: todayDecisions.length,
        byType,
        avgConfidence: total > 0 ? confidenceSum / total : 0,
        securityBlocks,
        fallbacks,
    };
}
/** Format decisions for display */
export function formatDecisions(decisions) {
    if (decisions.length === 0)
        return 'No decisions recorded.';
    const lines = ['## Decision Journal', ''];
    for (const d of decisions.slice(0, 20)) {
        const time = d.timestamp.split('T')[1]?.slice(0, 5) || '?';
        const conf = `${Math.round(d.confidence * 100)}%`;
        const icon = d.type === 'security-block' ? '🛡' :
            d.type === 'fallback-trigger' ? '⚡' :
                d.type === 'agent-routing' ? '🧭' :
                    d.type === 'model-selection' ? '🧠' :
                        d.type === 'cost-routing' ? '💰' : '📝';
        lines.push(`${icon} **${time}** [${d.type}] ${d.decision} (${conf})`);
        for (const r of d.reasoning) {
            lines.push(`  ${r}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
//# sourceMappingURL=decision-journal.js.map