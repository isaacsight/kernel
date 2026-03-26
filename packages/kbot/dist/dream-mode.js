// kbot Dream Mode — What kbot does when you're not watching
//
// Inspired by Claude Code's Auto-Dream, but goes further.
// While Auto-Dream cleans memory, kbot Dream Mode actively improves itself:
//   1. Memory consolidation (short-term → long-term patterns)
//   2. Meta-agent cycle (analyze performance, propose improvements)
//   3. Forge speculation (pre-build tools for tomorrow's tasks)
//   4. Collective sync (contribute + absorb from community)
//   5. Codebase guardian sweep (complexity analysis)
//   6. Self-benchmarking (compare against yesterday)
//   7. Content generation (draft about what was learned)
//
// "kbot doesn't sleep. It dreams."
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const KBOT_DIR = join(homedir(), '.kbot');
const DREAM_DIR = join(KBOT_DIR, 'dreams');
const DREAM_LOG = join(DREAM_DIR, 'dream-log.jsonl');
// ── Helpers ─────────────────────────────────────────────────────────────────
function ensureDreamDir() {
    if (!existsSync(DREAM_DIR))
        mkdirSync(DREAM_DIR, { recursive: true });
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
    writeFileSync(path, JSON.stringify(data, null, 2));
}
function logDream(entry) {
    ensureDreamDir();
    const line = JSON.stringify({ ts: new Date().toISOString(), msg: entry }) + '\n';
    try {
        writeFileSync(DREAM_LOG, line, { flag: 'a' });
    }
    catch { /* ignore */ }
}
// ── Phase 1: Memory Consolidation ───────────────────────────────────────────
async function consolidateMemory() {
    const start = Date.now();
    const findings = [];
    const actions = [];
    const patternsPath = join(KBOT_DIR, 'memory', 'patterns.json');
    const patterns = loadJson(patternsPath, []);
    // Find duplicate/near-duplicate patterns and merge them
    const seen = new Map();
    let mergedCount = 0;
    for (const p of patterns) {
        const key = `${p.type || ''}:${p.language || ''}:${p.agent || ''}`;
        const existing = seen.get(key);
        if (existing !== undefined) {
            // Merge: keep higher confidence
            const existingPattern = patterns[existing];
            const existingConf = Number(existingPattern.confidence || existingPattern.successRate || 0);
            const newConf = Number(p.confidence || p.successRate || 0);
            if (newConf > existingConf) {
                patterns[existing] = p;
            }
            mergedCount++;
        }
        else {
            seen.set(key, patterns.indexOf(p));
        }
    }
    if (mergedCount > 0) {
        findings.push(`Found ${mergedCount} duplicate patterns`);
        // Deduplicate
        const unique = Array.from(seen.values()).map(i => patterns[i]);
        saveJson(patternsPath, unique);
        actions.push(`Consolidated ${patterns.length} → ${unique.length} patterns`);
    }
    // Promote high-confidence patterns to long-term knowledge
    const knowledgePath = join(KBOT_DIR, 'memory', 'knowledge.json');
    const knowledge = loadJson(knowledgePath, []);
    const highConf = patterns.filter(p => Number(p.confidence || p.successRate || 0) > 0.9);
    let promoted = 0;
    for (const p of highConf) {
        const alreadyKnown = knowledge.some(k => k.type === p.type && k.language === p.language && k.agent === p.agent);
        if (!alreadyKnown) {
            knowledge.push({ ...p, promoted_at: new Date().toISOString(), source: 'dream-consolidation' });
            promoted++;
        }
    }
    if (promoted > 0) {
        saveJson(knowledgePath, knowledge);
        findings.push(`${promoted} high-confidence patterns promoted to knowledge`);
        actions.push(`Knowledge base grew: ${knowledge.length - promoted} → ${knowledge.length}`);
    }
    return {
        phase: 'memory-consolidation',
        duration_ms: Date.now() - start,
        findings,
        actions_taken: actions,
        improvements: mergedCount + promoted,
    };
}
// ── Phase 2: Meta-Agent Cycle ───────────────────────────────────────────────
async function runMetaCycle() {
    const start = Date.now();
    const findings = [];
    const actions = [];
    try {
        // Dynamic import to avoid circular deps
        const { analyzePerformance, proposeImprovements, applyImprovement } = await import('./meta-agent.js');
        const profiles = analyzePerformance();
        if (profiles.length > 0) {
            findings.push(`${profiles.length} agents analyzed`);
            const weak = profiles.filter(p => p.improvement_potential !== 'low');
            if (weak.length > 0) {
                findings.push(`${weak.length} agents need improvement: ${weak.map(p => p.agent).join(', ')}`);
            }
            const improvements = proposeImprovements(profiles);
            let applied = 0;
            for (const imp of improvements) {
                if (imp.target === 'routing' || imp.target === 'tool_selection') {
                    applyImprovement(imp);
                    applied++;
                }
            }
            if (applied > 0) {
                actions.push(`Auto-applied ${applied} low-risk improvements`);
            }
            if (improvements.length > applied) {
                findings.push(`${improvements.length - applied} improvements proposed (need review)`);
            }
            return {
                phase: 'meta-agent',
                duration_ms: Date.now() - start,
                findings,
                actions_taken: actions,
                improvements: applied,
            };
        }
    }
    catch {
        findings.push('Meta-agent not available (no observations yet)');
    }
    return {
        phase: 'meta-agent',
        duration_ms: Date.now() - start,
        findings,
        actions_taken: actions,
        improvements: 0,
    };
}
// ── Phase 3: Forge Speculation ──────────────────────────────────────────────
async function speculateForge() {
    const start = Date.now();
    const findings = [];
    const actions = [];
    // Analyze recent patterns to predict what tools might be needed
    const patternsPath = join(KBOT_DIR, 'memory', 'patterns.json');
    const patterns = loadJson(patternsPath, []);
    // Find tool gaps: patterns where success rate is low but frequency is high
    const toolGaps = patterns.filter(p => {
        const rate = Number(p.successRate || p.confidence || 0);
        const hits = Number(p.hits || p.frequency || 1);
        return rate < 0.6 && hits >= 3;
    });
    if (toolGaps.length > 0) {
        findings.push(`${toolGaps.length} potential tool gaps identified`);
        for (const gap of toolGaps.slice(0, 3)) {
            findings.push(`Gap: ${gap.type || 'unknown'} in ${gap.language || 'unknown'} (${Math.round(Number(gap.successRate || 0) * 100)}% success, ${gap.hits || 0} attempts)`);
        }
    }
    // Check if forged tools are actually being used
    const forgeDir = join(KBOT_DIR, 'forge');
    if (existsSync(forgeDir)) {
        const forgedTools = readdirSync(forgeDir).filter(f => f.endsWith('.json'));
        const unused = forgedTools.filter(f => {
            const tool = loadJson(join(forgeDir, f), {});
            return Number(tool.uses || 0) === 0;
        });
        if (unused.length > 0) {
            findings.push(`${unused.length} forged tools never used: ${unused.slice(0, 3).join(', ')}`);
        }
    }
    return {
        phase: 'forge-speculation',
        duration_ms: Date.now() - start,
        findings,
        actions_taken: actions,
        improvements: 0,
    };
}
// ── Phase 4: Collective Sync ────────────────────────────────────────────────
async function collectiveSync() {
    const start = Date.now();
    const findings = [];
    const actions = [];
    try {
        const { runCollectiveSync } = await import('./collective-learning.js');
        await runCollectiveSync();
        actions.push('Collective sync completed');
    }
    catch {
        findings.push('Collective sync endpoint not available (offline mode)');
    }
    return {
        phase: 'collective-sync',
        duration_ms: Date.now() - start,
        findings,
        actions_taken: actions,
        improvements: 0,
    };
}
// ── Phase 5: Self-Benchmark ─────────────────────────────────────────────────
async function selfBenchmark() {
    const start = Date.now();
    const findings = [];
    const benchDir = join(KBOT_DIR, 'benchmarks');
    if (!existsSync(benchDir))
        mkdirSync(benchDir, { recursive: true });
    const historyPath = join(benchDir, 'history.json');
    const history = loadJson(historyPath, []);
    if (history.length >= 2) {
        const recent = history.slice(-5);
        const older = history.slice(-10, -5);
        if (older.length > 0) {
            const recentAvgTime = recent.reduce((s, h) => s + Number(h.timeMs || 0), 0) / recent.length;
            const olderAvgTime = older.reduce((s, h) => s + Number(h.timeMs || 0), 0) / older.length;
            if (recentAvgTime < olderAvgTime) {
                const improvement = Math.round((1 - recentAvgTime / olderAvgTime) * 100);
                findings.push(`Performance improved ${improvement}% over last 10 benchmarks`);
            }
            else {
                const regression = Math.round((recentAvgTime / olderAvgTime - 1) * 100);
                findings.push(`Performance regressed ${regression}% — meta-agent should investigate`);
            }
        }
    }
    else {
        findings.push('Not enough benchmark data yet. Run: kbot compete "your task"');
    }
    return {
        phase: 'self-benchmark',
        duration_ms: Date.now() - start,
        findings,
        actions_taken: [],
        improvements: 0,
    };
}
// ── Phase 6: Dream Summary ──────────────────────────────────────────────────
async function generateDreamSummary(results) {
    const start = Date.now();
    const findings = [];
    const totalFindings = results.reduce((s, r) => s + r.findings.length, 0);
    const totalActions = results.reduce((s, r) => s + r.actions_taken.length, 0);
    const totalImprovements = results.reduce((s, r) => s + r.improvements, 0);
    findings.push(`Dream complete: ${results.length} phases, ${totalFindings} findings, ${totalActions} actions, ${totalImprovements} improvements`);
    // Save dream journal entry
    const journalPath = join(DREAM_DIR, `dream-${new Date().toISOString().split('T')[0]}.json`);
    saveJson(journalPath, {
        timestamp: new Date().toISOString(),
        results,
        summary: { totalFindings, totalActions, totalImprovements },
    });
    return {
        phase: 'dream-summary',
        duration_ms: Date.now() - start,
        findings,
        actions_taken: [`Dream journal saved: ${journalPath}`],
        improvements: 0,
    };
}
// ── Main: Run Dream Mode ────────────────────────────────────────────────────
export async function runDreamMode(verbose = true) {
    ensureDreamDir();
    const start = Date.now();
    if (verbose) {
        console.log('\n🌙 kbot Dream Mode');
        console.log('═'.repeat(50));
        console.log('kbot doesn\'t sleep. It dreams.\n');
    }
    const phases = [
        { name: 'Memory Consolidation', description: 'Merge duplicates, promote high-confidence patterns', execute: consolidateMemory },
        { name: 'Meta-Agent Cycle', description: 'Analyze agent performance, propose improvements', execute: runMetaCycle },
        { name: 'Forge Speculation', description: 'Predict tomorrow\'s tool needs', execute: speculateForge },
        { name: 'Collective Sync', description: 'Contribute and absorb community patterns', execute: collectiveSync },
        { name: 'Self-Benchmark', description: 'Compare against yesterday\'s performance', execute: selfBenchmark },
    ];
    const results = [];
    for (const phase of phases) {
        if (verbose)
            console.log(`  💭 ${phase.name}...`);
        logDream(`Starting: ${phase.name}`);
        try {
            const result = await phase.execute();
            results.push(result);
            if (verbose) {
                for (const f of result.findings)
                    console.log(`     ${f}`);
                for (const a of result.actions_taken)
                    console.log(`     ✓ ${a}`);
                if (result.findings.length === 0 && result.actions_taken.length === 0) {
                    console.log('     (nothing to report)');
                }
            }
            logDream(`Completed: ${phase.name} (${result.duration_ms}ms, ${result.improvements} improvements)`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (verbose)
                console.log(`     ✗ Error: ${msg}`);
            logDream(`Error in ${phase.name}: ${msg}`);
            results.push({
                phase: phase.name.toLowerCase().replace(/\s+/g, '-'),
                duration_ms: 0,
                findings: [`Error: ${msg}`],
                actions_taken: [],
                improvements: 0,
            });
        }
    }
    // Generate summary
    const summary = await generateDreamSummary(results);
    results.push(summary);
    const totalDuration = Date.now() - start;
    const report = {
        timestamp: new Date().toISOString(),
        duration_ms: totalDuration,
        phases_completed: results.length,
        total_findings: results.reduce((s, r) => s + r.findings.length, 0),
        total_actions: results.reduce((s, r) => s + r.actions_taken.length, 0),
        total_improvements: results.reduce((s, r) => s + r.improvements, 0),
        results,
    };
    if (verbose) {
        console.log('\n' + '═'.repeat(50));
        console.log(`  🌙 Dream complete in ${(totalDuration / 1000).toFixed(1)}s`);
        console.log(`     ${report.total_findings} findings · ${report.total_actions} actions · ${report.total_improvements} improvements`);
        console.log(`     Journal: ~/.kbot/dreams/dream-${new Date().toISOString().split('T')[0]}.json`);
        console.log();
    }
    return report;
}
// ── Get dream history ───────────────────────────────────────────────────────
export function getDreamHistory() {
    ensureDreamDir();
    const files = readdirSync(DREAM_DIR).filter(f => f.startsWith('dream-') && f.endsWith('.json'));
    return files.map(f => {
        const data = loadJson(join(DREAM_DIR, f), {});
        return { date: f.replace('dream-', '').replace('.json', ''), summary: data.summary || {} };
    }).sort((a, b) => b.date.localeCompare(a.date));
}
//# sourceMappingURL=dream-mode.js.map