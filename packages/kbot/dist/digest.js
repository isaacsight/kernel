// kbot Weekly Digest — "Your kbot is X% smarter than when you installed it"
//
// Sends a weekly summary of learning progress via email (kernel.chat@gmail.com)
// Shows patterns learned, tools used, agent routing stats.
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
function loadJsonSafe(path) {
    try {
        if (existsSync(path))
            return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch { /* ignore */ }
    return null;
}
export function gatherDigestData() {
    const kbotDir = join(homedir(), '.kbot');
    const patterns = loadJsonSafe(join(kbotDir, 'patterns.json'));
    const solutions = loadJsonSafe(join(kbotDir, 'solutions.json'));
    const sessions = loadJsonSafe(join(kbotDir, 'sessions.json'));
    const metrics = loadJsonSafe(join(kbotDir, 'metrics.json'));
    const patternCount = Array.isArray(patterns) ? patterns.length : 0;
    const solutionCount = Array.isArray(solutions) ? solutions.length : 0;
    const sessionCount = Array.isArray(sessions) ? sessions.length : 0;
    const topTools = [];
    if (metrics && typeof metrics === 'object') {
        const entries = Object.entries(metrics)
            .filter(([, v]) => v && typeof v === 'object' && typeof v.calls === 'number')
            .map(([name, v]) => ({ name, count: v.calls || 0 }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        topTools.push(...entries);
    }
    const growthPercent = sessionCount > 1 ? Math.round((patternCount / sessionCount) * 100) : 0;
    return {
        patterns: patternCount,
        solutions: solutionCount,
        sessions: sessionCount,
        topTools,
        topAgents: [],
        growthPercent,
    };
}
export function formatDigest(data, version) {
    const toolList = data.topTools.length > 0
        ? data.topTools.map((t, i) => `  ${i + 1}. ${t.name} (${t.count} calls)`).join('\n')
        : '  No tool usage data yet.';
    return `
╔══════════════════════════════════════════════╗
║         kbot Weekly Digest — ${version.padEnd(14)}║
╚══════════════════════════════════════════════╝

📊 Learning Progress
   Patterns learned:  ${data.patterns}
   Solutions stored:  ${data.solutions}
   Sessions total:    ${data.sessions}
   Growth rate:       ${data.growthPercent}% patterns/session

🔧 Top Tools This Week
${toolList}

💡 Your kbot has processed ${data.sessions} sessions and
   extracted ${data.patterns} reusable patterns.
   ${data.patterns > 10 ? 'The learning engine is compounding.' : 'Keep using kbot to build the pattern library.'}

─────────────────────────────────────────────
npm install -g @kernel.chat/kbot
kernel.chat · github.com/isaacsight/kernel
`.trim();
}
export async function runDigest() {
    const pkg = loadJsonSafe(join(__dirname, '..', 'package.json'));
    const version = pkg?.version || '3.33.1';
    const data = gatherDigestData();
    console.log(formatDigest(data, version));
}
//# sourceMappingURL=digest.js.map