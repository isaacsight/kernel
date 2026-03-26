// kbot Meta-Agent — Self-Referential Self-Improvement
//
// Inspired by Meta's HyperAgents (arXiv 2603.19461, 2026).
// Two-agent loop: Task agents solve problems. The Meta-Agent watches,
// analyzes performance, and rewrites the task agents to be better.
//
// Unlike HyperAgents (CC BY-NC-SA, non-commercial), kbot is MIT — the only
// self-improving agent framework companies can actually use.
//
// Architecture:
//   Meta-Agent (this file)
//       ↓ observes task agent performance
//       ↓ identifies improvement opportunities
//       ↓ generates improved prompts/routing/tools
//       ↓ applies improvements
//       ↓ measures impact
//       ↓ loop forever
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const KBOT_DIR = join(homedir(), '.kbot');
const META_DIR = join(KBOT_DIR, 'meta-agent');
const HISTORY_PATH = join(META_DIR, 'improvement-history.json');
const OBSERVATIONS_PATH = join(META_DIR, 'observations.json');
// ── Helpers ─────────────────────────────────────────────────────────────────
function ensureMetaDir() {
    if (!existsSync(META_DIR))
        mkdirSync(META_DIR, { recursive: true });
}
function loadJson(path, fallback) {
    try {
        if (existsSync(path))
            return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch { /* ignore */ }
    return fallback;
}
function saveJson(path, data) {
    ensureMetaDir();
    writeFileSync(path, JSON.stringify(data, null, 2));
}
function generateId() {
    return `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
// ── Core: Observe ───────────────────────────────────────────────────────────
export function recordObservation(obs) {
    ensureMetaDir();
    const observations = loadJson(OBSERVATIONS_PATH, []);
    observations.push(obs);
    // Keep last 1000 observations
    if (observations.length > 1000)
        observations.splice(0, observations.length - 1000);
    saveJson(OBSERVATIONS_PATH, observations);
}
// ── Core: Analyze ───────────────────────────────────────────────────────────
export function analyzePerformance() {
    const observations = loadJson(OBSERVATIONS_PATH, []);
    if (observations.length === 0)
        return [];
    // Group by agent
    const byAgent = new Map();
    for (const obs of observations) {
        const list = byAgent.get(obs.agent) || [];
        list.push(obs);
        byAgent.set(obs.agent, list);
    }
    const profiles = [];
    for (const [agent, tasks] of byAgent) {
        const successes = tasks.filter(t => t.success);
        const failures = tasks.filter(t => !t.success);
        // Tool frequency
        const toolCounts = new Map();
        for (const t of tasks) {
            for (const tool of t.tools_used) {
                toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
            }
        }
        const commonTools = Array.from(toolCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, frequency: count / tasks.length }));
        // Failure patterns
        const errorCounts = new Map();
        for (const f of failures) {
            const pattern = f.error?.slice(0, 100) || 'unknown';
            errorCounts.set(pattern, (errorCounts.get(pattern) || 0) + 1);
        }
        const failurePatterns = Array.from(errorCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([pattern]) => pattern);
        const successRate = tasks.length > 0 ? successes.length / tasks.length : 0;
        const avgDuration = tasks.length > 0 ? tasks.reduce((s, t) => s + t.duration_ms, 0) / tasks.length : 0;
        const avgCost = tasks.length > 0 ? tasks.reduce((s, t) => s + t.cost, 0) / tasks.length : 0;
        profiles.push({
            agent,
            total_tasks: tasks.length,
            success_rate: Math.round(successRate * 100) / 100,
            avg_duration_ms: Math.round(avgDuration),
            avg_cost: Math.round(avgCost * 10000) / 10000,
            common_tools: commonTools,
            failure_patterns: failurePatterns,
            improvement_potential: successRate < 0.7 ? 'high' : successRate < 0.9 ? 'medium' : 'low',
        });
    }
    return profiles.sort((a, b) => a.success_rate - b.success_rate);
}
// ── Core: Improve ───────────────────────────────────────────────────────────
export function proposeImprovements(profiles) {
    const improvements = [];
    for (const profile of profiles) {
        // High failure rate → improve prompt
        if (profile.success_rate < 0.7 && profile.total_tasks >= 5) {
            improvements.push({
                id: generateId(),
                timestamp: new Date().toISOString(),
                target: 'prompt',
                agent: profile.agent,
                description: `Agent "${profile.agent}" has ${Math.round(profile.success_rate * 100)}% success rate across ${profile.total_tasks} tasks. Top failure patterns: ${profile.failure_patterns.join(', ') || 'unknown'}. Propose refined system prompt with explicit instructions for handling these failure cases.`,
                before: `Current ${profile.agent} agent prompt`,
                after: `Enhanced prompt with: failure pattern guards, tool selection hints for common tasks, fallback instructions`,
                expected_impact: `Success rate from ${Math.round(profile.success_rate * 100)}% → ${Math.min(95, Math.round(profile.success_rate * 100) + 20)}%`,
                status: 'proposed',
            });
        }
        // Slow agent → optimize tool selection
        if (profile.avg_duration_ms > 10000 && profile.total_tasks >= 3) {
            improvements.push({
                id: generateId(),
                timestamp: new Date().toISOString(),
                target: 'tool_selection',
                agent: profile.agent,
                description: `Agent "${profile.agent}" averages ${Math.round(profile.avg_duration_ms / 1000)}s per task. Most used tools: ${profile.common_tools.map(t => t.name).join(', ')}. Propose tool pre-selection to skip discovery phase.`,
                before: `Dynamic tool discovery on every invocation`,
                after: `Pre-loaded tool set for ${profile.agent}: [${profile.common_tools.map(t => t.name).join(', ')}]`,
                expected_impact: `Duration from ${Math.round(profile.avg_duration_ms / 1000)}s → ${Math.round(profile.avg_duration_ms / 1000 * 0.6)}s`,
                status: 'proposed',
            });
        }
        // Expensive agent → route to cheaper model for simple tasks
        if (profile.avg_cost > 0.01 && profile.total_tasks >= 5) {
            improvements.push({
                id: generateId(),
                timestamp: new Date().toISOString(),
                target: 'routing',
                agent: profile.agent,
                description: `Agent "${profile.agent}" costs $${profile.avg_cost.toFixed(4)}/task avg. For simple tasks (< 500 tokens), route to local model to reduce cost by ~100%.`,
                before: `All tasks use cloud model`,
                after: `Simple tasks (< 500 tokens) → local model. Complex tasks → cloud.`,
                expected_impact: `Cost from $${profile.avg_cost.toFixed(4)} → $${(profile.avg_cost * 0.4).toFixed(4)} per task`,
                status: 'proposed',
            });
        }
    }
    return improvements;
}
// ── Core: Apply ─────────────────────────────────────────────────────────────
export function applyImprovement(improvement) {
    ensureMetaDir();
    // Save the improvement to routing hints file
    const hintsPath = join(KBOT_DIR, 'meta-agent', 'active-improvements.json');
    const active = loadJson(hintsPath, []);
    improvement.status = 'applied';
    active.push(improvement);
    saveJson(hintsPath, active);
    // Log to history
    const history = loadJson(HISTORY_PATH, []);
    history.push(improvement);
    if (history.length > 500)
        history.splice(0, history.length - 500);
    saveJson(HISTORY_PATH, history);
    return true;
}
// ── Core: Measure ───────────────────────────────────────────────────────────
export function measureImpact(improvementId) {
    const history = loadJson(HISTORY_PATH, []);
    const imp = history.find(i => i.id === improvementId);
    if (!imp)
        return `Improvement ${improvementId} not found.`;
    const observations = loadJson(OBSERVATIONS_PATH, []);
    const appliedAt = new Date(imp.timestamp).getTime();
    const before = observations.filter(o => new Date(o.timestamp).getTime() < appliedAt && o.agent === imp.agent);
    const after = observations.filter(o => new Date(o.timestamp).getTime() >= appliedAt && o.agent === imp.agent);
    if (after.length < 3)
        return `Not enough data yet. ${after.length}/3 observations since improvement applied.`;
    const beforeRate = before.length > 0 ? before.filter(o => o.success).length / before.length : 0;
    const afterRate = after.length > 0 ? after.filter(o => o.success).length / after.length : 0;
    const beforeDuration = before.length > 0 ? before.reduce((s, o) => s + o.duration_ms, 0) / before.length : 0;
    const afterDuration = after.length > 0 ? after.reduce((s, o) => s + o.duration_ms, 0) / after.length : 0;
    imp.measured_impact = `Success: ${Math.round(beforeRate * 100)}% → ${Math.round(afterRate * 100)}%. Duration: ${Math.round(beforeDuration)}ms → ${Math.round(afterDuration)}ms.`;
    imp.status = 'measured';
    saveJson(HISTORY_PATH, history);
    return imp.measured_impact;
}
// ── Main Loop ───────────────────────────────────────────────────────────────
export async function runMetaAgent() {
    ensureMetaDir();
    const cycleCountPath = join(META_DIR, 'cycle-count.json');
    const cycleCount = (loadJson(cycleCountPath, { count: 0 })).count + 1;
    saveJson(cycleCountPath, { count: cycleCount });
    console.log(`\n🧠 Meta-Agent — Cycle #${cycleCount}`);
    console.log('─'.repeat(50));
    // 1. Analyze
    console.log('\n📊 Analyzing task agent performance...');
    const profiles = analyzePerformance();
    if (profiles.length === 0) {
        console.log('   No observations yet. Use kbot to generate data.');
        return {
            timestamp: new Date().toISOString(),
            observations_analyzed: 0,
            profiles: [],
            improvements_proposed: [],
            improvements_applied: [],
            cycle_number: cycleCount,
        };
    }
    for (const p of profiles) {
        const bar = p.success_rate >= 0.9 ? '🟢' : p.success_rate >= 0.7 ? '🟡' : '🔴';
        console.log(`   ${bar} ${p.agent}: ${Math.round(p.success_rate * 100)}% success, ${p.total_tasks} tasks, ${Math.round(p.avg_duration_ms)}ms avg`);
    }
    // 2. Propose improvements
    console.log('\n💡 Proposing improvements...');
    const proposed = proposeImprovements(profiles);
    if (proposed.length === 0) {
        console.log('   All agents performing well. No improvements needed.');
    }
    for (const imp of proposed) {
        console.log(`   → [${imp.target}] ${imp.agent}: ${imp.description.slice(0, 100)}...`);
        console.log(`     Expected: ${imp.expected_impact}`);
    }
    // 3. Apply improvements (auto-apply low-risk ones)
    const applied = [];
    for (const imp of proposed) {
        if (imp.target === 'routing' || imp.target === 'tool_selection') {
            // Low risk — auto-apply
            applyImprovement(imp);
            applied.push(imp);
            console.log(`   ✓ Applied: ${imp.description.slice(0, 80)}`);
        }
        else {
            // Higher risk — propose only
            console.log(`   ⏸ Proposed (needs review): ${imp.description.slice(0, 80)}`);
        }
    }
    // 4. Measure previous improvements
    console.log('\n📏 Measuring previous improvements...');
    const history = loadJson(HISTORY_PATH, []);
    const unmeasured = history.filter(i => i.status === 'applied');
    for (const imp of unmeasured.slice(0, 5)) {
        const result = measureImpact(imp.id);
        console.log(`   ${imp.agent} [${imp.target}]: ${result}`);
    }
    const observations = loadJson(OBSERVATIONS_PATH, []);
    const report = {
        timestamp: new Date().toISOString(),
        observations_analyzed: observations.length,
        profiles,
        improvements_proposed: proposed,
        improvements_applied: applied,
        cycle_number: cycleCount,
    };
    // Save report
    const reportPath = join(META_DIR, `report-${cycleCount}.json`);
    saveJson(reportPath, report);
    console.log(`\n✅ Meta-Agent cycle #${cycleCount} complete.`);
    console.log(`   ${observations.length} observations analyzed`);
    console.log(`   ${proposed.length} improvements proposed`);
    console.log(`   ${applied.length} improvements auto-applied`);
    console.log(`   Report: ${reportPath}\n`);
    return report;
}
// ── Get improvement history ─────────────────────────────────────────────────
export function getImprovementHistory() {
    return loadJson(HISTORY_PATH, []);
}
export function getActiveImprovements() {
    const hintsPath = join(META_DIR, 'active-improvements.json');
    return loadJson(hintsPath, []);
}
export function getMetaStats() {
    const cycleCountPath = join(META_DIR, 'cycle-count.json');
    const cycles = (loadJson(cycleCountPath, { count: 0 })).count;
    const observations = loadJson(OBSERVATIONS_PATH, []).length;
    const improvements = loadJson(HISTORY_PATH, []).length;
    const active = getActiveImprovements().length;
    return { cycles, observations, improvements, active };
}
//# sourceMappingURL=meta-agent.js.map