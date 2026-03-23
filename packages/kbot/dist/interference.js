// kbot Cognitive Module Interference Tracker
//
// When multiple cognitive modules fire simultaneously, their signals can
// interfere — constructively (amplifying each other) or destructively
// (contradicting each other). This module tracks those interference events,
// maps known tensions and synergies, and provides aggregate statistics
// for the daemon to surface in diagnostic reports.
//
// Why this matters:
//   - free-energy wants to converge on a low-surprise model, but
//     quality-diversity wants to explore novel solutions. Which wins?
//   - prompt-evolution rewrites prompts for better scores, but
//     memory-synthesis preserves historical context. Evolving into forgetting.
//   - reflection critiques past failures (backward-looking), but
//     tree-planner searches forward for the best next action.
//
// By tracking which module "wins" and whether the outcome was good,
// we can learn which interferences to lean into and which to dampen.
//
// Storage: ~/.kbot/memory/interference.json (max 1000 events)
// All heuristic — no LLM calls.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
// ══════════════════════════════════════════════════════════════════════
// Constants & Paths
// ══════════════════════════════════════════════════════════════════════
const MEMORY_DIR = join(homedir(), '.kbot', 'memory');
const INTERFERENCE_FILE = join(MEMORY_DIR, 'interference.json');
const MAX_EVENTS = 1000;
/** All cognitive module identifiers for validation */
export const ALL_MODULES = [
    'free-energy',
    'predictive-processing',
    'strange-loops',
    'integrated-information',
    'autopoiesis',
    'quality-diversity',
    'skill-rating',
    'tree-planner',
    'prompt-evolution',
    'memory-synthesis',
    'reflection',
];
/** Threshold below which a signal is considered "near zero" */
const NEAR_ZERO_THRESHOLD = 0.05;
// ══════════════════════════════════════════════════════════════════════
// Known Tensions — module pairs that structurally conflict
// ══════════════════════════════════════════════════════════════════════
export const KNOWN_TENSIONS = [
    {
        moduleA: 'free-energy',
        moduleB: 'quality-diversity',
        description: 'convergence vs exploration',
    },
    {
        moduleA: 'prompt-evolution',
        moduleB: 'memory-synthesis',
        description: 'evolving into forgetting',
    },
    {
        moduleA: 'reflection',
        moduleB: 'tree-planner',
        description: 'backward critique vs forward search',
    },
    {
        moduleA: 'skill-rating',
        moduleB: 'free-energy',
        description: 'infrastructure becoming intelligence',
    },
    {
        moduleA: 'skill-rating',
        moduleB: 'predictive-processing',
        description: 'infrastructure becoming intelligence',
    },
    {
        moduleA: 'skill-rating',
        moduleB: 'strange-loops',
        description: 'infrastructure becoming intelligence',
    },
    {
        moduleA: 'skill-rating',
        moduleB: 'integrated-information',
        description: 'infrastructure becoming intelligence',
    },
    {
        moduleA: 'skill-rating',
        moduleB: 'autopoiesis',
        description: 'infrastructure becoming intelligence',
    },
    {
        moduleA: 'skill-rating',
        moduleB: 'quality-diversity',
        description: 'infrastructure becoming intelligence',
    },
    {
        moduleA: 'skill-rating',
        moduleB: 'tree-planner',
        description: 'infrastructure becoming intelligence',
    },
    {
        moduleA: 'skill-rating',
        moduleB: 'prompt-evolution',
        description: 'infrastructure becoming intelligence',
    },
    {
        moduleA: 'skill-rating',
        moduleB: 'memory-synthesis',
        description: 'infrastructure becoming intelligence',
    },
    {
        moduleA: 'skill-rating',
        moduleB: 'reflection',
        description: 'infrastructure becoming intelligence',
    },
];
// ══════════════════════════════════════════════════════════════════════
// Known Synergies — module pairs that amplify each other
// ══════════════════════════════════════════════════════════════════════
export const KNOWN_SYNERGIES = [
    {
        moduleA: 'memory-synthesis',
        moduleB: 'reflection',
        description: 'reflections feed synthesis',
    },
    {
        moduleA: 'predictive-processing',
        moduleB: 'skill-rating',
        description: 'anticipation improves routing',
    },
    {
        moduleA: 'strange-loops',
        moduleB: 'autopoiesis',
        description: 'self-reference enables self-maintenance',
    },
];
// ══════════════════════════════════════════════════════════════════════
// Storage — load / save / ensure
// ══════════════════════════════════════════════════════════════════════
function ensureDir() {
    if (!existsSync(MEMORY_DIR))
        mkdirSync(MEMORY_DIR, { recursive: true });
}
function loadState() {
    ensureDir();
    if (!existsSync(INTERFERENCE_FILE)) {
        return { events: [], lastUpdated: new Date().toISOString() };
    }
    try {
        const raw = readFileSync(INTERFERENCE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Validate shape
        if (!Array.isArray(parsed.events)) {
            return { events: [], lastUpdated: new Date().toISOString() };
        }
        return parsed;
    }
    catch {
        return { events: [], lastUpdated: new Date().toISOString() };
    }
}
function saveState(state) {
    ensureDir();
    // Trim to max events — keep the most recent
    if (state.events.length > MAX_EVENTS) {
        state.events = state.events.slice(-MAX_EVENTS);
    }
    state.lastUpdated = new Date().toISOString();
    writeFileSync(INTERFERENCE_FILE, JSON.stringify(state, null, 2));
}
// ══════════════════════════════════════════════════════════════════════
// Classification Helper
// ══════════════════════════════════════════════════════════════════════
/**
 * Classify how two module signals interfere based on their output values.
 *
 * - Same sign (both positive or both negative) = CONSTRUCTIVE
 *   (both modules agree on direction)
 * - Opposite signs = DESTRUCTIVE
 *   (modules disagree — one says go, the other says stop)
 * - Either signal near zero = NEUTRAL
 *   (one module is inactive or indifferent)
 *
 * @param signalA - Numeric output from module A (positive = activate, negative = inhibit)
 * @param signalB - Numeric output from module B
 * @returns The interference type
 */
export function classifyInterference(signalA, signalB) {
    const absA = Math.abs(signalA);
    const absB = Math.abs(signalB);
    // If either signal is near zero, the module is essentially silent
    if (absA < NEAR_ZERO_THRESHOLD || absB < NEAR_ZERO_THRESHOLD) {
        return 'NEUTRAL';
    }
    // Same sign = both modules agree on direction
    if ((signalA > 0 && signalB > 0) || (signalA < 0 && signalB < 0)) {
        return 'CONSTRUCTIVE';
    }
    // Opposite signs = disagreement
    return 'DESTRUCTIVE';
}
// ══════════════════════════════════════════════════════════════════════
// Event Recording
// ══════════════════════════════════════════════════════════════════════
/**
 * Generate a unique event ID.
 */
function generateEventId() {
    return `intf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
/**
 * Validate that a string is a valid CognitiveModule.
 */
export function isValidModule(id) {
    return ALL_MODULES.includes(id);
}
/**
 * Record an interference event between two cognitive modules.
 *
 * @param moduleA - First module in the interference
 * @param moduleB - Second module (order doesn't matter for stats)
 * @param type - CONSTRUCTIVE, DESTRUCTIVE, or NEUTRAL
 * @param context - Free-form description of what triggered this
 * @param resolution - Which module was ultimately followed
 * @param outcome - Whether following that module led to success
 * @returns The recorded event
 */
export function recordInterference(moduleA, moduleB, type, context, resolution, outcome = 'pending') {
    const event = {
        id: generateEventId(),
        timestamp: new Date().toISOString(),
        moduleA,
        moduleB,
        type,
        context: context.slice(0, 500), // Cap context length
        resolution,
        outcome,
    };
    const state = loadState();
    state.events.push(event);
    saveState(state);
    return event;
}
/**
 * Record an interference by classifying signals automatically.
 * Convenience wrapper around classifyInterference + recordInterference.
 */
export function recordSignalInterference(moduleA, signalA, moduleB, signalB, context, resolution, outcome = 'pending') {
    const type = classifyInterference(signalA, signalB);
    return recordInterference(moduleA, moduleB, type, context, resolution, outcome);
}
/**
 * Update the outcome of a pending interference event.
 * Called after the resolution's result is known.
 *
 * @param eventId - The event to update
 * @param outcome - The actual outcome
 * @returns true if the event was found and updated, false otherwise
 */
export function resolveInterference(eventId, outcome) {
    const state = loadState();
    const event = state.events.find(e => e.id === eventId);
    if (!event)
        return false;
    event.outcome = outcome;
    saveState(state);
    return true;
}
// ══════════════════════════════════════════════════════════════════════
// Known Interaction Lookups
// ══════════════════════════════════════════════════════════════════════
/**
 * Normalize a module pair to a canonical order for consistent lookups.
 * Alphabetical by module name.
 */
function normalizePair(a, b) {
    return a <= b ? [a, b] : [b, a];
}
/**
 * Check if two modules have a known tension.
 * Returns the tension description or null.
 */
export function getKnownTension(moduleA, moduleB) {
    for (const tension of KNOWN_TENSIONS) {
        if ((tension.moduleA === moduleA && tension.moduleB === moduleB) ||
            (tension.moduleA === moduleB && tension.moduleB === moduleA)) {
            return tension.description;
        }
    }
    return null;
}
/**
 * Check if two modules have a known synergy.
 * Returns the synergy description or null.
 */
export function getKnownSynergy(moduleA, moduleB) {
    for (const synergy of KNOWN_SYNERGIES) {
        if ((synergy.moduleA === moduleA && synergy.moduleB === moduleB) ||
            (synergy.moduleA === moduleB && synergy.moduleB === moduleA)) {
            return synergy.description;
        }
    }
    return null;
}
/**
 * Get all known tensions for a specific module.
 */
export function getTensionsFor(module) {
    return KNOWN_TENSIONS.filter(t => t.moduleA === module || t.moduleB === module);
}
/**
 * Get all known synergies for a specific module.
 */
export function getSynergiesFor(module) {
    return KNOWN_SYNERGIES.filter(s => s.moduleA === module || s.moduleB === module);
}
// ══════════════════════════════════════════════════════════════════════
// Aggregate Statistics
// ══════════════════════════════════════════════════════════════════════
/**
 * Get the conflict rate (destructive / total) for a specific module pair.
 * Returns 0 if no events exist for the pair.
 */
export function getConflictRate(moduleA, moduleB) {
    const state = loadState();
    const pairEvents = state.events.filter(e => (e.moduleA === moduleA && e.moduleB === moduleB) ||
        (e.moduleA === moduleB && e.moduleB === moduleA));
    if (pairEvents.length === 0)
        return 0;
    const destructive = pairEvents.filter(e => e.type === 'DESTRUCTIVE').length;
    return destructive / pairEvents.length;
}
/**
 * Compute detailed statistics for a specific module pair.
 */
function computePairStats(moduleA, moduleB, events) {
    const pairEvents = events.filter(e => (e.moduleA === moduleA && e.moduleB === moduleB) ||
        (e.moduleA === moduleB && e.moduleB === moduleA));
    const total = pairEvents.length;
    const constructive = pairEvents.filter(e => e.type === 'CONSTRUCTIVE').length;
    const destructive = pairEvents.filter(e => e.type === 'DESTRUCTIVE').length;
    const neutral = pairEvents.filter(e => e.type === 'NEUTRAL').length;
    // Resolution stats
    const aWinEvents = pairEvents.filter(e => e.resolution === moduleA);
    const bWinEvents = pairEvents.filter(e => e.resolution === moduleB);
    const aWins = aWinEvents.length;
    const bWins = bWinEvents.length;
    // Success rates (only count resolved events, not pending)
    const aResolved = aWinEvents.filter(e => e.outcome !== 'pending');
    const bResolved = bWinEvents.filter(e => e.outcome !== 'pending');
    const aSuccesses = aResolved.filter(e => e.outcome === 'success').length;
    const bSuccesses = bResolved.filter(e => e.outcome === 'success').length;
    const aWinSuccessRate = aResolved.length > 0 ? aSuccesses / aResolved.length : 0;
    const bWinSuccessRate = bResolved.length > 0 ? bSuccesses / bResolved.length : 0;
    const conflictRate = total > 0 ? destructive / total : 0;
    return {
        moduleA,
        moduleB,
        total,
        constructive,
        destructive,
        neutral,
        aWins,
        bWins,
        aWinSuccessRate,
        bWinSuccessRate,
        conflictRate,
    };
}
/**
 * Get interference statistics for all module pairs that have events.
 * Returns an array of PairStats, sorted by total events descending.
 */
export function getInterferenceStats() {
    const state = loadState();
    if (state.events.length === 0)
        return [];
    // Discover all unique pairs that appear in events
    const pairSet = new Set();
    for (const event of state.events) {
        const [a, b] = normalizePair(event.moduleA, event.moduleB);
        pairSet.add(`${a}|${b}`);
    }
    const stats = [];
    for (const pairKey of pairSet) {
        const [a, b] = pairKey.split('|');
        stats.push(computePairStats(a, b, state.events));
    }
    // Sort by total events descending
    stats.sort((x, y) => y.total - x.total);
    return stats;
}
/**
 * Get statistics for a single module — how often it is involved
 * in interference, and its win/success rates.
 */
export function getModuleStats(module) {
    const state = loadState();
    const involved = state.events.filter(e => e.moduleA === module || e.moduleB === module);
    if (involved.length === 0) {
        return {
            totalEvents: 0,
            asModuleA: 0,
            asModuleB: 0,
            timesWon: 0,
            winSuccessRate: 0,
            topPartner: null,
            dominantType: 'NEUTRAL',
        };
    }
    const asModuleA = involved.filter(e => e.moduleA === module).length;
    const asModuleB = involved.filter(e => e.moduleB === module).length;
    const wonEvents = involved.filter(e => e.resolution === module);
    const timesWon = wonEvents.length;
    const resolvedWins = wonEvents.filter(e => e.outcome !== 'pending');
    const winSuccesses = resolvedWins.filter(e => e.outcome === 'success').length;
    const winSuccessRate = resolvedWins.length > 0 ? winSuccesses / resolvedWins.length : 0;
    // Find top partner (the module it interferes with most)
    const partnerCounts = new Map();
    for (const e of involved) {
        const partner = e.moduleA === module ? e.moduleB : e.moduleA;
        partnerCounts.set(partner, (partnerCounts.get(partner) || 0) + 1);
    }
    let topPartner = null;
    let maxCount = 0;
    for (const [partner, count] of partnerCounts) {
        if (count > maxCount) {
            topPartner = partner;
            maxCount = count;
        }
    }
    // Dominant type
    const constructive = involved.filter(e => e.type === 'CONSTRUCTIVE').length;
    const destructive = involved.filter(e => e.type === 'DESTRUCTIVE').length;
    const neutral = involved.filter(e => e.type === 'NEUTRAL').length;
    let dominantType = 'NEUTRAL';
    if (constructive >= destructive && constructive >= neutral)
        dominantType = 'CONSTRUCTIVE';
    else if (destructive >= constructive && destructive >= neutral)
        dominantType = 'DESTRUCTIVE';
    return {
        totalEvents: involved.length,
        asModuleA,
        asModuleB,
        timesWon,
        winSuccessRate,
        topPartner,
        dominantType,
    };
}
// ══════════════════════════════════════════════════════════════════════
// Reporting
// ══════════════════════════════════════════════════════════════════════
/**
 * Generate a formatted interference report string for the daemon.
 * Includes:
 *   - Total event count and time range
 *   - Top conflicting pairs
 *   - Top synergistic pairs
 *   - Known tensions with observed conflict rates
 *   - Recommendations based on resolution success rates
 */
export function getInterferenceReport() {
    const state = loadState();
    const events = state.events;
    const lines = [];
    lines.push('═══ Cognitive Module Interference Report ═══');
    lines.push('');
    if (events.length === 0) {
        lines.push('No interference events recorded yet.');
        lines.push('Events are recorded when multiple cognitive modules fire simultaneously');
        lines.push('with conflicting or reinforcing signals.');
        return lines.join('\n');
    }
    // ── Summary ──
    const oldest = events[0].timestamp.split('T')[0];
    const newest = events[events.length - 1].timestamp.split('T')[0];
    const constructiveCount = events.filter(e => e.type === 'CONSTRUCTIVE').length;
    const destructiveCount = events.filter(e => e.type === 'DESTRUCTIVE').length;
    const neutralCount = events.filter(e => e.type === 'NEUTRAL').length;
    const resolvedCount = events.filter(e => e.outcome !== 'pending').length;
    const successCount = events.filter(e => e.outcome === 'success').length;
    const failureCount = events.filter(e => e.outcome === 'failure').length;
    lines.push(`Total events: ${events.length} (${oldest} to ${newest})`);
    lines.push(`  Constructive: ${constructiveCount} (${pct(constructiveCount, events.length)})`);
    lines.push(`  Destructive:  ${destructiveCount} (${pct(destructiveCount, events.length)})`);
    lines.push(`  Neutral:      ${neutralCount} (${pct(neutralCount, events.length)})`);
    lines.push(`  Resolved:     ${resolvedCount} — ${successCount} success, ${failureCount} failure`);
    lines.push('');
    // ── Top Conflicting Pairs ──
    const stats = getInterferenceStats();
    const conflicting = stats
        .filter(s => s.destructive > 0)
        .sort((a, b) => b.conflictRate - a.conflictRate)
        .slice(0, 5);
    if (conflicting.length > 0) {
        lines.push('── Top Conflicting Pairs ──');
        for (const pair of conflicting) {
            const tension = getKnownTension(pair.moduleA, pair.moduleB);
            const tensionLabel = tension ? ` [${tension}]` : '';
            lines.push(`  ${pair.moduleA} vs ${pair.moduleB}: ` +
                `${pct(pair.destructive, pair.total)} conflict rate ` +
                `(${pair.destructive}/${pair.total})${tensionLabel}`);
        }
        lines.push('');
    }
    // ── Top Synergistic Pairs ──
    const synergistic = stats
        .filter(s => s.constructive > 0)
        .sort((a, b) => (b.constructive / b.total) - (a.constructive / a.total))
        .slice(0, 5);
    if (synergistic.length > 0) {
        lines.push('── Top Synergistic Pairs ──');
        for (const pair of synergistic) {
            const synergy = getKnownSynergy(pair.moduleA, pair.moduleB);
            const synergyLabel = synergy ? ` [${synergy}]` : '';
            const synergyRate = pair.constructive / pair.total;
            lines.push(`  ${pair.moduleA} + ${pair.moduleB}: ` +
                `${pct(pair.constructive, pair.total)} synergy rate ` +
                `(${pair.constructive}/${pair.total})${synergyLabel}`);
        }
        lines.push('');
    }
    // ── Known Tensions vs Observed ──
    lines.push('── Known Tensions (Observed) ──');
    for (const tension of KNOWN_TENSIONS) {
        const rate = getConflictRate(tension.moduleA, tension.moduleB);
        const pairEvts = events.filter(e => (e.moduleA === tension.moduleA && e.moduleB === tension.moduleB) ||
            (e.moduleA === tension.moduleB && e.moduleB === tension.moduleA));
        if (pairEvts.length > 0) {
            lines.push(`  ${tension.moduleA} vs ${tension.moduleB}: ` +
                `"${tension.description}" — ${(rate * 100).toFixed(0)}% conflict (${pairEvts.length} events)`);
        }
        else {
            lines.push(`  ${tension.moduleA} vs ${tension.moduleB}: ` +
                `"${tension.description}" — no events yet`);
        }
    }
    lines.push('');
    // ── Known Synergies vs Observed ──
    lines.push('── Known Synergies (Observed) ──');
    for (const synergy of KNOWN_SYNERGIES) {
        const pairEvts = events.filter(e => (e.moduleA === synergy.moduleA && e.moduleB === synergy.moduleB) ||
            (e.moduleA === synergy.moduleB && e.moduleB === synergy.moduleA));
        if (pairEvts.length > 0) {
            const constructive = pairEvts.filter(e => e.type === 'CONSTRUCTIVE').length;
            lines.push(`  ${synergy.moduleA} + ${synergy.moduleB}: ` +
                `"${synergy.description}" — ${pct(constructive, pairEvts.length)} constructive (${pairEvts.length} events)`);
        }
        else {
            lines.push(`  ${synergy.moduleA} + ${synergy.moduleB}: ` +
                `"${synergy.description}" — no events yet`);
        }
    }
    lines.push('');
    // ── Recommendations ──
    const recommendations = generateRecommendations(stats, events);
    if (recommendations.length > 0) {
        lines.push('── Recommendations ──');
        for (const rec of recommendations) {
            lines.push(`  • ${rec}`);
        }
        lines.push('');
    }
    lines.push(`Last updated: ${state.lastUpdated}`);
    return lines.join('\n');
}
// ══════════════════════════════════════════════════════════════════════
// Recommendation Engine
// ══════════════════════════════════════════════════════════════════════
/**
 * Generate actionable recommendations based on observed interference patterns.
 */
function generateRecommendations(stats, events) {
    const recs = [];
    // Recommendation 1: High conflict pairs where one module consistently wins
    // and that winning leads to failures — suggest flipping the resolution
    for (const pair of stats) {
        if (pair.total < 5 || pair.conflictRate < 0.5)
            continue;
        // Check if module A dominates but fails
        if (pair.aWins > pair.bWins * 2 && pair.aWinSuccessRate < 0.4 && pair.aWins >= 3) {
            recs.push(`${pair.moduleA} dominates ${pair.moduleB} but has ${(pair.aWinSuccessRate * 100).toFixed(0)}% success rate. ` +
                `Consider deferring to ${pair.moduleB} more often.`);
        }
        // Check the reverse
        if (pair.bWins > pair.aWins * 2 && pair.bWinSuccessRate < 0.4 && pair.bWins >= 3) {
            recs.push(`${pair.moduleB} dominates ${pair.moduleA} but has ${(pair.bWinSuccessRate * 100).toFixed(0)}% success rate. ` +
                `Consider deferring to ${pair.moduleA} more often.`);
        }
    }
    // Recommendation 2: Known synergies that are actually conflicting
    for (const synergy of KNOWN_SYNERGIES) {
        const rate = getConflictRate(synergy.moduleA, synergy.moduleB);
        const pairEvts = events.filter(e => (e.moduleA === synergy.moduleA && e.moduleB === synergy.moduleB) ||
            (e.moduleA === synergy.moduleB && e.moduleB === synergy.moduleA));
        if (pairEvts.length >= 3 && rate > 0.5) {
            recs.push(`Expected synergy "${synergy.description}" between ${synergy.moduleA} and ${synergy.moduleB} ` +
                `is actually conflicting (${(rate * 100).toFixed(0)}% conflict rate). Investigate module integration.`);
        }
    }
    // Recommendation 3: Known tensions with unexpectedly low conflict
    for (const tension of KNOWN_TENSIONS) {
        const rate = getConflictRate(tension.moduleA, tension.moduleB);
        const pairEvts = events.filter(e => (e.moduleA === tension.moduleA && e.moduleB === tension.moduleB) ||
            (e.moduleA === tension.moduleB && e.moduleB === tension.moduleA));
        if (pairEvts.length >= 5 && rate < 0.2) {
            recs.push(`Expected tension "${tension.description}" between ${tension.moduleA} and ${tension.moduleB} ` +
                `has only ${(rate * 100).toFixed(0)}% conflict rate. The modules may have naturally aligned.`);
        }
    }
    // Recommendation 4: Modules with many pending outcomes — need feedback loop
    const pendingCount = events.filter(e => e.outcome === 'pending').length;
    if (pendingCount > events.length * 0.5 && events.length >= 10) {
        recs.push(`${pendingCount}/${events.length} events (${pct(pendingCount, events.length)}) are still pending. ` +
            `Wire up outcome resolution for better interference learning.`);
    }
    // Recommendation 5: Module that participates in many destructive events
    const moduleCounts = new Map();
    for (const event of events) {
        for (const mod of [event.moduleA, event.moduleB]) {
            const current = moduleCounts.get(mod) || { destructive: 0, total: 0 };
            current.total++;
            if (event.type === 'DESTRUCTIVE')
                current.destructive++;
            moduleCounts.set(mod, current);
        }
    }
    for (const [mod, counts] of moduleCounts) {
        if (counts.total >= 10 && counts.destructive / counts.total > 0.6) {
            recs.push(`${mod} is involved in destructive interference ${(counts.destructive / counts.total * 100).toFixed(0)}% of the time ` +
                `(${counts.destructive}/${counts.total}). Consider dampening its signal or improving its integration.`);
        }
    }
    return recs;
}
// ══════════════════════════════════════════════════════════════════════
// Query Helpers
// ══════════════════════════════════════════════════════════════════════
/**
 * Get all interference events, optionally filtered.
 */
export function getEvents(filter) {
    const state = loadState();
    let events = state.events;
    if (filter) {
        if (filter.module) {
            const mod = filter.module;
            events = events.filter(e => e.moduleA === mod || e.moduleB === mod);
        }
        if (filter.type) {
            const t = filter.type;
            events = events.filter(e => e.type === t);
        }
        if (filter.outcome) {
            const o = filter.outcome;
            events = events.filter(e => e.outcome === o);
        }
        if (filter.since) {
            const sinceTime = new Date(filter.since).getTime();
            events = events.filter(e => new Date(e.timestamp).getTime() >= sinceTime);
        }
        if (filter.limit && filter.limit > 0) {
            events = events.slice(-filter.limit);
        }
    }
    return events;
}
/**
 * Get the most recent interference events (for dashboard display).
 */
export function getRecentEvents(count = 10) {
    const state = loadState();
    return state.events.slice(-count);
}
/**
 * Count total recorded interference events.
 */
export function getEventCount() {
    const state = loadState();
    return state.events.length;
}
/**
 * Clear all interference events. Use with caution — this is destructive.
 * Returns the number of events that were cleared.
 */
export function clearEvents() {
    const state = loadState();
    const count = state.events.length;
    state.events = [];
    saveState(state);
    return count;
}
// ══════════════════════════════════════════════════════════════════════
// Predictive Helpers
// ══════════════════════════════════════════════════════════════════════
/**
 * Predict the likely interference type for a module pair based on
 * historical data and known interactions.
 *
 * Returns a prediction with confidence, or null if insufficient data.
 */
export function predictInterference(moduleA, moduleB) {
    const state = loadState();
    const pairEvents = state.events.filter(e => (e.moduleA === moduleA && e.moduleB === moduleB) ||
        (e.moduleA === moduleB && e.moduleB === moduleA));
    // Check known interactions first
    const tension = getKnownTension(moduleA, moduleB);
    const synergy = getKnownSynergy(moduleA, moduleB);
    // If we have historical data, use it
    if (pairEvents.length >= 3) {
        const constructive = pairEvents.filter(e => e.type === 'CONSTRUCTIVE').length;
        const destructive = pairEvents.filter(e => e.type === 'DESTRUCTIVE').length;
        const neutral = pairEvents.filter(e => e.type === 'NEUTRAL').length;
        const total = pairEvents.length;
        let predicted;
        let maxCount;
        if (constructive >= destructive && constructive >= neutral) {
            predicted = 'CONSTRUCTIVE';
            maxCount = constructive;
        }
        else if (destructive >= constructive && destructive >= neutral) {
            predicted = 'DESTRUCTIVE';
            maxCount = destructive;
        }
        else {
            predicted = 'NEUTRAL';
            maxCount = neutral;
        }
        // Confidence is the proportion of the dominant type, scaled by sample size
        const rawConfidence = maxCount / total;
        // Small sample penalty: sqrt(n/20) capped at 1
        const sampleFactor = Math.min(1, Math.sqrt(total / 20));
        const confidence = rawConfidence * sampleFactor;
        return {
            predicted,
            confidence: Math.round(confidence * 100) / 100,
            basis: `historical (${total} events: ${constructive}C/${destructive}D/${neutral}N)`,
        };
    }
    // Fall back to known interactions
    if (tension) {
        return {
            predicted: 'DESTRUCTIVE',
            confidence: 0.6,
            basis: `known tension: "${tension}"`,
        };
    }
    if (synergy) {
        return {
            predicted: 'CONSTRUCTIVE',
            confidence: 0.6,
            basis: `known synergy: "${synergy}"`,
        };
    }
    // Not enough data
    return null;
}
/**
 * Suggest which module to follow when two modules conflict,
 * based on historical win/success rates.
 *
 * Returns the recommended module and the basis for the recommendation,
 * or null if insufficient data.
 */
export function suggestResolution(moduleA, moduleB) {
    const state = loadState();
    const pairEvents = state.events.filter(e => (e.moduleA === moduleA && e.moduleB === moduleB) ||
        (e.moduleA === moduleB && e.moduleB === moduleA));
    // Need enough resolved events to make a recommendation
    const resolved = pairEvents.filter(e => e.outcome !== 'pending');
    if (resolved.length < 3)
        return null;
    const aWins = resolved.filter(e => e.resolution === moduleA);
    const bWins = resolved.filter(e => e.resolution === moduleB);
    const aSuccesses = aWins.filter(e => e.outcome === 'success').length;
    const bSuccesses = bWins.filter(e => e.outcome === 'success').length;
    const aRate = aWins.length > 0 ? aSuccesses / aWins.length : 0;
    const bRate = bWins.length > 0 ? bSuccesses / bWins.length : 0;
    // If one module has a clearly better success rate
    if (Math.abs(aRate - bRate) > 0.15 && (aWins.length >= 2 || bWins.length >= 2)) {
        if (aRate > bRate) {
            return {
                recommended: moduleA,
                confidence: Math.round(aRate * 100) / 100,
                reason: `${moduleA} has ${(aRate * 100).toFixed(0)}% success rate vs ${(bRate * 100).toFixed(0)}% for ${moduleB} (${resolved.length} resolved events)`,
            };
        }
        else {
            return {
                recommended: moduleB,
                confidence: Math.round(bRate * 100) / 100,
                reason: `${moduleB} has ${(bRate * 100).toFixed(0)}% success rate vs ${(aRate * 100).toFixed(0)}% for ${moduleA} (${resolved.length} resolved events)`,
            };
        }
    }
    // Too close to call
    return null;
}
// ══════════════════════════════════════════════════════════════════════
// Compact Summary (for system prompt injection)
// ══════════════════════════════════════════════════════════════════════
/**
 * Generate a compact interference summary suitable for system prompt injection.
 * Returns empty string if no meaningful patterns exist.
 */
export function getInterferenceSummary() {
    const state = loadState();
    if (state.events.length < 5)
        return '';
    const stats = getInterferenceStats();
    if (stats.length === 0)
        return '';
    const lines = [];
    lines.push('[Cognitive Module Interference]');
    // Only include pairs with significant data
    const significant = stats.filter(s => s.total >= 3);
    if (significant.length === 0)
        return '';
    for (const pair of significant.slice(0, 5)) {
        const tension = getKnownTension(pair.moduleA, pair.moduleB);
        const synergy = getKnownSynergy(pair.moduleA, pair.moduleB);
        const label = tension ? `tension: ${tension}` : synergy ? `synergy: ${synergy}` : 'observed';
        // Determine which module to favor
        let favor = '';
        if (pair.aWinSuccessRate > pair.bWinSuccessRate + 0.2) {
            favor = ` → favor ${pair.moduleA}`;
        }
        else if (pair.bWinSuccessRate > pair.aWinSuccessRate + 0.2) {
            favor = ` → favor ${pair.moduleB}`;
        }
        lines.push(`- ${pair.moduleA}/${pair.moduleB}: ${pair.conflictRate > 0.5 ? 'high conflict' : pair.conflictRate > 0.2 ? 'moderate' : 'low conflict'} (${label})${favor}`);
    }
    return lines.join('\n');
}
// ══════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════
/** Format a fraction as a percentage string */
function pct(numerator, denominator) {
    if (denominator === 0)
        return '0%';
    return `${((numerator / denominator) * 100).toFixed(0)}%`;
}
//# sourceMappingURL=interference.js.map