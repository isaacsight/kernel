// kbot Dashboard — Live Learning Dashboard TUI
//
// Usage: kbot dashboard
//
// Renders a live terminal dashboard showing learning stats, tool usage,
// agent routing, session history, and growth metrics.
// Refreshes every 5 seconds. Press 'q' to quit.
//
// Uses only Node built-ins + ANSI escape codes — no external deps.
import { readFileSync, existsSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createRequire } from 'module';
const __require = createRequire(import.meta.url);
const PKG_VERSION = __require('../package.json').version;
const KBOT_DIR = join(homedir(), '.kbot');
const MEMORY_DIR = join(KBOT_DIR, 'memory');
const SESSIONS_DIR = join(KBOT_DIR, 'sessions');
// ── ANSI escape codes ──
const ESC = '\x1b';
const BOLD = `${ESC}[1m`;
const DIM_START = `${ESC}[2m`;
const RESET = `${ESC}[0m`;
const GREEN = `${ESC}[32m`;
const RED = `${ESC}[31m`;
const PURPLE = `${ESC}[35m`;
const CYAN = `${ESC}[36m`;
const YELLOW = `${ESC}[33m`;
const WHITE = `${ESC}[37m`;
function dim(s) { return `${DIM_START}${s}${RESET}`; }
function bold(s) { return `${BOLD}${s}${RESET}`; }
function purple(s) { return `${PURPLE}${s}${RESET}`; }
function green(s) { return `${GREEN}${s}${RESET}`; }
function cyan(s) { return `${CYAN}${s}${RESET}`; }
function yellow(s) { return `${YELLOW}${s}${RESET}`; }
function white(s) { return `${WHITE}${s}${RESET}`; }
// ── Box drawing ──
const BOX = { tl: '\u256d', tr: '\u256e', bl: '\u2570', br: '\u256f', h: '\u2500', v: '\u2502' };
function stripAnsi(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
}
function bar(value, max, width = 20) {
    const filled = Math.round((value / Math.max(max, 1)) * width);
    return GREEN + '\u2588'.repeat(filled) + DIM_START + '\u2591'.repeat(width - filled) + RESET;
}
function loadJSON(path, fallback) {
    if (!existsSync(path))
        return fallback;
    try {
        return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch {
        return fallback;
    }
}
const DEFAULT_PROFILE = {
    responseStyle: 'auto',
    techStack: [],
    taskPatterns: {},
    preferredAgents: {},
    totalMessages: 0,
    totalTokens: 0,
    tokensSaved: 0,
    avgTokensPerMessage: 0,
    sessions: 0,
};
function loadDashboardData() {
    const patterns = loadJSON(join(MEMORY_DIR, 'patterns.json'), []);
    const solutions = loadJSON(join(MEMORY_DIR, 'solutions.json'), []);
    const knowledge = loadJSON(join(MEMORY_DIR, 'knowledge.json'), []);
    const profile = loadJSON(join(MEMORY_DIR, 'profile.json'), DEFAULT_PROFILE);
    const routingHistory = loadJSON(join(MEMORY_DIR, 'routing-history.json'), []);
    // Load sessions from directory listing
    const sessions = [];
    if (existsSync(SESSIONS_DIR)) {
        const files = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
        for (const file of files) {
            try {
                const raw = JSON.parse(readFileSync(join(SESSIONS_DIR, file), 'utf-8'));
                sessions.push({
                    id: raw.id,
                    name: raw.name,
                    updated: raw.updated,
                    turnCount: raw.turnCount,
                    agent: raw.agent,
                });
            }
            catch {
                continue;
            }
        }
        sessions.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
    }
    return { patterns, solutions, knowledge, profile, routingHistory, sessions };
}
// ── Render ──
function render(data) {
    const cols = process.stdout.columns || 80;
    const panelWidth = Math.min(cols - 2, 78);
    const halfWidth = Math.floor((panelWidth - 1) / 2);
    const barWidth = Math.max(8, halfWidth - 22);
    const lines = [];
    // Clear screen and move cursor to top
    process.stdout.write(`${ESC}[2J${ESC}[H`);
    // ── Header ──
    const now = new Date().toLocaleTimeString();
    lines.push('');
    lines.push(`  ${purple('\u25cf')} ${bold(`kbot Dashboard \u2014 v${PKG_VERSION}`)}  ${dim(now)}  ${dim('(q to quit)')}`);
    lines.push(`  ${dim(BOX.h.repeat(panelWidth))}`);
    // ── Learning Stats ──
    const totalPatterns = data.patterns.length;
    const totalSolutions = data.solutions.length;
    const totalKnowledge = data.knowledge.length;
    const totalMessages = data.profile.totalMessages;
    const tokensSaved = data.profile.tokensSaved;
    const tokensSavedStr = tokensSaved > 1000 ? `${(tokensSaved / 1000).toFixed(1)}k` : String(tokensSaved);
    // Classify patterns by tool bucket
    const patternsByCategory = {};
    for (const p of data.patterns) {
        const cat = p.toolSequence[0] || 'general';
        const bucket = cat.includes('file') || cat.includes('read') || cat.includes('write') ? 'file-ops'
            : cat.includes('git') ? 'git'
                : cat.includes('bash') || cat.includes('shell') ? 'shell'
                    : cat.includes('search') || cat.includes('grep') ? 'search'
                        : cat.includes('web') || cat.includes('fetch') ? 'web'
                            : 'other';
        patternsByCategory[bucket] = (patternsByCategory[bucket] || 0) + 1;
    }
    lines.push('');
    lines.push(`  ${cyan(bold('Learning Engine'))}`);
    lines.push(`    Patterns:      ${bold(String(totalPatterns))}`);
    lines.push(`    Solutions:     ${bold(String(totalSolutions))}`);
    lines.push(`    Knowledge:     ${bold(String(totalKnowledge))}`);
    lines.push(`    Messages:      ${dim(String(totalMessages))}`);
    lines.push(`    Tokens saved:  ${green(tokensSavedStr)}`);
    const catEntries = Object.entries(patternsByCategory).sort((a, b) => b[1] - a[1]);
    if (catEntries.length > 0) {
        lines.push('');
        lines.push(`    ${dim('Patterns by category:')}`);
        const maxCat = catEntries[0][1];
        for (const [cat, count] of catEntries.slice(0, 5)) {
            lines.push(`    ${cat.padEnd(14)} ${bar(count, maxCat, barWidth)} ${dim(String(count))}`);
        }
    }
    // ── Top Tools ──
    const toolCounts = {};
    for (const p of data.patterns) {
        for (const t of p.toolSequence) {
            toolCounts[t] = (toolCounts[t] || 0) + p.hits;
        }
    }
    const topTools = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    lines.push('');
    lines.push(`  ${dim(BOX.h.repeat(panelWidth))}`);
    lines.push(`  ${yellow(bold('Top Tools'))}`);
    if (topTools.length > 0) {
        const maxTool = topTools[0][1];
        for (const [tool, count] of topTools) {
            lines.push(`    ${tool.padEnd(14)} ${bar(count, maxTool, barWidth)} ${dim(String(count))}`);
        }
    }
    else {
        lines.push(`    ${dim('No tool usage data yet. Start using kbot to populate.')}`);
    }
    // ── Agent Routing ──
    const agentCounts = { ...data.profile.preferredAgents };
    for (const r of data.routingHistory) {
        agentCounts[r.agent] = (agentCounts[r.agent] || 0) + 1;
    }
    const topAgents = Object.entries(agentCounts).sort((a, b) => b[1] - a[1]).slice(0, 7);
    // Routing method breakdown
    const methodCounts = {};
    for (const r of data.routingHistory) {
        methodCounts[r.method] = (methodCounts[r.method] || 0) + 1;
    }
    const totalRoutes = data.routingHistory.length;
    const cached = totalRoutes - (methodCounts['llm'] || 0);
    const cacheRate = totalRoutes > 0 ? Math.round((cached / totalRoutes) * 100) : 0;
    lines.push('');
    lines.push(`  ${dim(BOX.h.repeat(panelWidth))}`);
    lines.push(`  ${green(bold('Agent Routing'))}`);
    if (topAgents.length > 0) {
        const maxAgent = topAgents[0][1];
        for (const [agent, count] of topAgents) {
            lines.push(`    ${agent.padEnd(14)} ${bar(count, maxAgent, barWidth)} ${dim(String(count))}`);
        }
        lines.push(`    ${dim(`Routes: ${totalRoutes}  Cache hit: ${cacheRate}%`)}`);
    }
    else {
        lines.push(`    ${dim('No routing data yet. kbot learns which agents perform best over time.')}`);
    }
    // ── Sessions ──
    const totalSessions = data.sessions.length;
    const profileSessions = data.profile.sessions || totalSessions;
    const lastSession = data.sessions[0];
    lines.push('');
    lines.push(`  ${dim(BOX.h.repeat(panelWidth))}`);
    lines.push(`  ${purple(bold('Sessions'))}`);
    lines.push(`    Total: ${bold(String(totalSessions))} saved sessions  (${dim(`${profileSessions} lifetime`)})`);
    if (lastSession) {
        const d = new Date(lastSession.updated);
        lines.push(`    Last:  ${dim(d.toLocaleDateString())} ${dim(d.toLocaleTimeString())} ${dim(`\u2014 ${lastSession.name}`)}`);
    }
    const recentSessions = data.sessions.slice(0, 5);
    if (recentSessions.length > 0) {
        lines.push(`    ${dim('Recent:')}`);
        for (const s of recentSessions) {
            const d = new Date(s.updated);
            const date = `${d.getMonth() + 1}/${d.getDate()}`;
            const name = s.name.length > panelWidth - 20 ? s.name.slice(0, panelWidth - 23) + '...' : s.name;
            lines.push(`      ${dim(date)}  ${name}  ${dim(`(${s.turnCount} turns)`)}`);
        }
    }
    // ── Footer: Growth summary ──
    lines.push('');
    lines.push(`  ${dim(BOX.h.repeat(panelWidth))}`);
    const growthMsg = totalPatterns > 0
        ? `kbot has learned ${bold(String(totalPatterns))} patterns across ${bold(String(profileSessions))} sessions`
        : 'kbot is ready to learn \u2014 start a conversation to build patterns';
    lines.push(`  ${purple('\u25cf')} ${growthMsg}`);
    const techStack = data.profile.techStack.slice(0, 5).join(', ');
    if (techStack) {
        lines.push(`    ${dim(`Tech stack: ${techStack}`)}`);
    }
    lines.push(`  ${dim('Refreshes every 5s \u00b7 Press q to quit')}`);
    lines.push('');
    process.stdout.write(lines.join('\n'));
}
// ── Main loop ──
export async function runDashboard() {
    // Validate TTY
    if (!process.stdout.isTTY) {
        console.error('kbot dashboard requires an interactive terminal.');
        process.exit(1);
    }
    // Hide cursor
    process.stdout.write(`${ESC}[?25l`);
    // Clean exit
    const cleanup = () => {
        process.stdout.write(`${ESC}[?25h`); // show cursor
        process.stdout.write(`${ESC}[2J${ESC}[H`); // clear screen
        process.stdout.write(`${purple('\u25cf')} Dashboard closed.\n`);
        process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    // Enable raw mode for keypress detection
    if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (key) => {
        // q, Q, or Ctrl+C
        if (key === 'q' || key === 'Q' || key === '\x03') {
            cleanup();
        }
    });
    // Initial render
    const data = loadDashboardData();
    render(data);
    // Refresh loop
    const interval = setInterval(() => {
        try {
            const freshData = loadDashboardData();
            render(freshData);
        }
        catch {
            // Non-fatal — skip this render cycle
        }
    }, 5000);
    // Keep process alive until cleanup() is called
    await new Promise(() => {
        process.on('exit', () => clearInterval(interval));
    });
}
//# sourceMappingURL=dashboard.js.map