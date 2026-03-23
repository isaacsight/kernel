// kbot Prompt Evolution — GEPA-style self-optimizing specialist prompts
//
// Each specialist agent has a system prompt (in agents/specialists.ts or matrix.ts).
// This module tracks execution traces per specialist and periodically analyzes them
// to generate heuristic-based prompt mutations — no LLM calls needed.
//
// Design: simplified GEPA (Generative Evolution of Prompts for Agents) for CLI:
//   1. Record execution traces (agent, taskType, tools, score, success, length)
//   2. Every 20 runs of an agent, analyze trace patterns
//   3. Generate prompt amendments (suffixes, not full rewrites)
//   4. Track before/after scores to auto-rollback bad mutations
//
// Storage: ~/.kbot/memory/prompt-evolution.json
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
// ── Storage ──
const MEMORY_DIR = join(homedir(), '.kbot', 'memory');
const EVOLUTION_FILE = join(MEMORY_DIR, 'prompt-evolution.json');
const MAX_TRACES = 500;
const MAX_MUTATIONS = 50;
const EVOLUTION_THRESHOLD = 20; // traces per agent before evolution triggers
function ensureDir() {
    if (!existsSync(MEMORY_DIR))
        mkdirSync(MEMORY_DIR, { recursive: true });
}
function loadState() {
    ensureDir();
    if (!existsSync(EVOLUTION_FILE)) {
        return { traces: [], mutations: [], generation: 0 };
    }
    try {
        return JSON.parse(readFileSync(EVOLUTION_FILE, 'utf-8'));
    }
    catch {
        return { traces: [], mutations: [], generation: 0 };
    }
}
function saveState(state) {
    ensureDir();
    try {
        writeFileSync(EVOLUTION_FILE, JSON.stringify(state, null, 2));
    }
    catch { /* non-critical — prompt evolution data can be regenerated */ }
}
// ── Lazy-loaded singleton state ──
let _state = null;
function getState() {
    if (!_state)
        _state = loadState();
    return _state;
}
function persist() {
    if (_state)
        saveState(_state);
}
// ── Core API ──
/**
 * Record an execution trace after each agent response.
 * Called from agent.ts in the post-response learning block.
 */
export function recordTrace(trace) {
    const state = getState();
    state.traces.push(trace);
    // Cap at MAX_TRACES — drop oldest traces
    if (state.traces.length > MAX_TRACES) {
        state.traces = state.traces.slice(-MAX_TRACES);
    }
    persist();
}
/**
 * Check if an agent has accumulated enough traces to trigger evolution.
 * Returns true if 20+ traces exist since the last evolution cycle for this agent.
 */
export function shouldEvolve(agent) {
    const state = getState();
    // Find the last mutation for this agent (if any)
    const lastMutation = [...state.mutations]
        .reverse()
        .find(m => m.agent === agent);
    const lastMutationTime = lastMutation
        ? new Date(lastMutation.appliedAt).getTime()
        : 0;
    // Count traces for this agent since last mutation
    const recentTraces = state.traces.filter(t => t.agent === agent && new Date(t.timestamp).getTime() > lastMutationTime);
    return recentTraces.length >= EVOLUTION_THRESHOLD;
}
/**
 * Analyze execution traces for an agent and generate prompt mutations.
 * This is the core GEPA heuristic engine — entirely local, no LLM calls.
 *
 * Mutation rules:
 *   1. Low success rate (<0.6) → add verification/self-checking emphasis
 *   2. Narrow tool usage → encourage broader tool exploration
 *   3. Low scores on specific task types → add task-specific instructions
 *   4. Responses too long → add conciseness instruction
 *   5. Missing the question → add "answer first" instruction
 *
 * Returns the generated mutation, or null if no improvement is needed.
 */
export function evolvePrompt(agent) {
    const state = getState();
    // Get the last mutation for this agent to know the baseline
    const lastMutation = [...state.mutations]
        .reverse()
        .find(m => m.agent === agent);
    const lastMutationTime = lastMutation
        ? new Date(lastMutation.appliedAt).getTime()
        : 0;
    // Gather traces since last evolution
    const recentTraces = state.traces.filter(t => t.agent === agent && new Date(t.timestamp).getTime() > lastMutationTime);
    if (recentTraces.length < EVOLUTION_THRESHOLD)
        return null;
    // ── Analyze trace patterns ──
    const successRate = recentTraces.filter(t => t.success).length / recentTraces.length;
    const avgScore = recentTraces.reduce((sum, t) => sum + t.evalScore, 0) / recentTraces.length;
    const avgLength = recentTraces.reduce((sum, t) => sum + t.messageLength, 0) / recentTraces.length;
    // Tool diversity: how many unique tools out of all tools used
    const allToolsUsed = recentTraces.flatMap(t => t.toolsUsed);
    const uniqueTools = new Set(allToolsUsed);
    const toolDiversity = allToolsUsed.length > 0
        ? uniqueTools.size / Math.min(allToolsUsed.length, 20) // normalize against 20 max
        : 0;
    // Per-task-type scores
    const taskTypeScores = {};
    for (const trace of recentTraces) {
        if (!taskTypeScores[trace.taskType]) {
            taskTypeScores[trace.taskType] = { total: 0, count: 0 };
        }
        taskTypeScores[trace.taskType].total += trace.evalScore;
        taskTypeScores[trace.taskType].count++;
    }
    // Identify weak task types (avg score < 0.5 with at least 3 samples)
    const weakTaskTypes = Object.entries(taskTypeScores)
        .filter(([, v]) => v.count >= 3 && (v.total / v.count) < 0.5)
        .map(([taskType, v]) => ({ taskType, avgScore: v.total / v.count }));
    // Low relevancy indicator: traces where evalScore < 0.4 (often means missing the question)
    const lowRelevancyRate = recentTraces.filter(t => t.evalScore < 0.4).length / recentTraces.length;
    // ── Generate mutation amendments ──
    // Priority order: address the most impactful issue first
    const amendments = [];
    const reasons = [];
    // Rule 1: Low success rate → add verification emphasis
    if (successRate < 0.6) {
        amendments.push('IMPORTANT: After completing any action, verify the result explicitly. ' +
            'If writing code, run the build or type-checker. If modifying files, read them back to confirm. ' +
            'If a command fails, analyze the error before retrying with a different approach.');
        reasons.push(`low success rate (${(successRate * 100).toFixed(0)}%)`);
    }
    // Rule 2: Narrow tool usage → encourage exploration
    if (toolDiversity < 0.15 && allToolsUsed.length > 5) {
        const topTools = Array.from(uniqueTools).slice(0, 3).join(', ');
        amendments.push('You have many tools available beyond ' + topTools + '. ' +
            'Consider using web_search for external info, grep for codebase exploration, ' +
            'git tools for history, and multiple file operations for thorough changes. ' +
            'Use the right tool for each sub-task rather than relying on a single tool.');
        reasons.push(`narrow tool usage (${uniqueTools.size} unique tools, diversity ${(toolDiversity * 100).toFixed(0)}%)`);
    }
    // Rule 3: Weak task types → add targeted instructions
    if (weakTaskTypes.length > 0) {
        const taskInstructions = weakTaskTypes.map(wt => {
            switch (wt.taskType) {
                case 'debug':
                    return 'For debugging: read error messages carefully, check recent git changes, ' +
                        'reproduce the issue before attempting fixes, and verify the fix works.';
                case 'build':
                    return 'For building/creating: plan the file structure first, write complete files ' +
                        '(not partial snippets), and run the build to verify.';
                case 'refactor':
                    return 'For refactoring: understand all callers of the code being changed, ' +
                        'make incremental changes, and verify each step compiles.';
                case 'test':
                    return 'For testing: cover both happy paths and edge cases, mock external dependencies, ' +
                        'and ensure tests actually assert meaningful behavior.';
                case 'deploy':
                    return 'For deployment: check all prerequisites first, verify environment configuration, ' +
                        'and always do a dry-run or build before the actual deploy.';
                case 'explain':
                    return 'For explanations: lead with a clear, direct answer. Then provide supporting ' +
                        'details. Use code examples where relevant. Keep it scannable.';
                case 'review':
                    return 'For reviews: check for security issues, performance concerns, and code style. ' +
                        'Provide specific line-level feedback, not just general comments.';
                default:
                    return `For ${wt.taskType} tasks: pay extra attention to accuracy and completeness. ` +
                        'Verify your work before presenting results.';
            }
        });
        amendments.push(taskInstructions.join('\n'));
        reasons.push(`weak on: ${weakTaskTypes.map(wt => `${wt.taskType} (${(wt.avgScore * 100).toFixed(0)}%)`).join(', ')}`);
    }
    // Rule 4: Responses too long → add conciseness
    if (avgLength > 3000) {
        amendments.push('Keep responses concise and focused. Lead with the answer or action, ' +
            'then add explanation only if needed. Avoid repeating the question or restating the problem. ' +
            'For code changes, show only the relevant diff, not the entire file.');
        reasons.push(`verbose responses (avg ${Math.round(avgLength)} chars)`);
    }
    // Rule 5: Missing the question → add "answer first" instruction
    if (lowRelevancyRate > 0.3) {
        amendments.push('CRITICAL: Answer the actual question first. Do not go on tangents or provide ' +
            'unsolicited information. If the user asks a yes/no question, start with yes or no. ' +
            'If they ask for a specific thing, provide that specific thing before anything else.');
        reasons.push(`high off-topic rate (${(lowRelevancyRate * 100).toFixed(0)}% of responses scored < 0.4)`);
    }
    // If no issues detected, no mutation needed
    if (amendments.length === 0)
        return null;
    // Build the combined amendment
    const mutatedText = `\n\n[Evolved Instructions — Generation ${state.generation + 1}]\n` +
        amendments.join('\n\n');
    const mutation = {
        agent,
        original: lastMutation?.mutated || '',
        mutated: mutatedText,
        reason: reasons.join('; '),
        appliedAt: new Date().toISOString(),
        scoreBefore: avgScore,
        scoreAfter: 0, // filled in after next evolution cycle
    };
    // Store the mutation
    state.mutations.push(mutation);
    if (state.mutations.length > MAX_MUTATIONS) {
        state.mutations = state.mutations.slice(-MAX_MUTATIONS);
    }
    state.generation++;
    persist();
    return mutation;
}
/**
 * Get the current active prompt amendment for an agent.
 * Called before prompt assembly to inject evolved instructions.
 * Returns empty string if no active mutation exists.
 */
export function getPromptAmendment(agent) {
    const state = getState();
    // Find the most recent mutation for this agent
    const latestMutation = [...state.mutations]
        .reverse()
        .find(m => m.agent === agent);
    if (!latestMutation)
        return '';
    return latestMutation.mutated;
}
/**
 * Rollback the most recent mutation for an agent if it made things worse.
 * Compares scoreAfter vs scoreBefore — if worse, removes the mutation.
 *
 * Call this after updating scoreAfter from the latest trace batch.
 * Returns true if a rollback was performed.
 */
export function rollbackMutation(agent) {
    const state = getState();
    // Find the most recent mutation for this agent
    const mutationIndex = state.mutations.length - 1 -
        [...state.mutations].reverse().findIndex(m => m.agent === agent);
    if (mutationIndex < 0 || mutationIndex >= state.mutations.length)
        return false;
    const mutation = state.mutations[mutationIndex];
    // Only rollback if we have scoreAfter data and it's worse
    if (mutation.scoreAfter > 0 && mutation.scoreAfter < mutation.scoreBefore) {
        state.mutations.splice(mutationIndex, 1);
        persist();
        return true;
    }
    return false;
}
/**
 * Update the scoreAfter for the most recent mutation of an agent.
 * Called when enough post-mutation traces are available.
 */
export function updateMutationScore(agent) {
    const state = getState();
    const latestMutation = [...state.mutations]
        .reverse()
        .find(m => m.agent === agent);
    if (!latestMutation || latestMutation.scoreAfter > 0)
        return;
    const mutationTime = new Date(latestMutation.appliedAt).getTime();
    const postTraces = state.traces.filter(t => t.agent === agent && new Date(t.timestamp).getTime() > mutationTime);
    // Need at least 10 post-mutation traces to evaluate
    if (postTraces.length < 10)
        return;
    // Use eval scores if available, otherwise fall back to success rate.
    // This fixes the issue where auto-rollback was a no-op when self-eval
    // is disabled (default), since evalScore defaults to 0.7 for everyone.
    const allScoresDefault = postTraces.every(t => Math.abs(t.evalScore - 0.7) < 0.01);
    let scoreAfter;
    if (allScoresDefault) {
        // Self-eval is likely disabled — use success rate as the signal instead
        scoreAfter = postTraces.filter(t => t.success).length / postTraces.length;
    }
    else {
        // Real eval scores available — use them
        scoreAfter = postTraces.reduce((sum, t) => sum + t.evalScore, 0) / postTraces.length;
    }
    latestMutation.scoreAfter = Math.round(scoreAfter * 1000) / 1000;
    // If scoreBefore was also default 0.7, recalculate it the same way
    if (allScoresDefault && Math.abs(latestMutation.scoreBefore - 0.7) < 0.01) {
        const preTraces = state.traces.filter(t => t.agent === agent && new Date(t.timestamp).getTime() <= mutationTime).slice(-20); // last 20 pre-mutation traces
        if (preTraces.length >= 5) {
            latestMutation.scoreBefore = preTraces.filter(t => t.success).length / preTraces.length;
        }
    }
    persist();
    // Auto-rollback if mutation made things worse (>10% drop)
    if (latestMutation.scoreBefore > 0 && latestMutation.scoreAfter < latestMutation.scoreBefore * 0.9) {
        rollbackMutation(agent);
    }
}
/**
 * Get evolution statistics — how prompts have evolved over time.
 */
export function getEvolutionStats() {
    const state = getState();
    // Build per-agent stats
    const agentStats = {};
    // Group traces by agent
    const agentTraces = {};
    for (const trace of state.traces) {
        if (!agentTraces[trace.agent])
            agentTraces[trace.agent] = [];
        agentTraces[trace.agent].push(trace);
    }
    // Group mutations by agent
    const agentMutations = {};
    for (const mutation of state.mutations) {
        if (!agentMutations[mutation.agent])
            agentMutations[mutation.agent] = [];
        agentMutations[mutation.agent].push(mutation);
    }
    // Combine into stats
    const allAgents = new Set([
        ...Object.keys(agentTraces),
        ...Object.keys(agentMutations),
    ]);
    for (const agent of allAgents) {
        const traces = agentTraces[agent] || [];
        const mutations = agentMutations[agent] || [];
        const latestMutation = mutations.length > 0 ? mutations[mutations.length - 1] : null;
        agentStats[agent] = {
            traces: traces.length,
            avgScore: traces.length > 0
                ? Math.round((traces.reduce((s, t) => s + t.evalScore, 0) / traces.length) * 1000) / 1000
                : 0,
            successRate: traces.length > 0
                ? Math.round((traces.filter(t => t.success).length / traces.length) * 1000) / 1000
                : 0,
            activeMutation: !!latestMutation,
            mutationCount: mutations.length,
            lastEvolved: latestMutation?.appliedAt || null,
        };
    }
    return {
        generation: state.generation,
        totalTraces: state.traces.length,
        totalMutations: state.mutations.length,
        agentStats,
    };
}
/**
 * Reset all evolution data for a specific agent (or all agents).
 * Useful for debugging or when a major prompt rewrite happens.
 */
export function resetEvolution(agent) {
    const state = getState();
    if (agent) {
        state.traces = state.traces.filter(t => t.agent !== agent);
        state.mutations = state.mutations.filter(m => m.agent !== agent);
    }
    else {
        state.traces = [];
        state.mutations = [];
        state.generation = 0;
    }
    persist();
}
/**
 * Flush pending state to disk. Call on process exit.
 */
export function flushEvolutionState() {
    if (_state) {
        try {
            saveState(_state);
        }
        catch { /* best-effort */ }
    }
}
//# sourceMappingURL=prompt-evolution.js.map