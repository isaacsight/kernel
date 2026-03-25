// kbot Compete — Head-to-Head Performance Benchmark
//
// Usage: kbot compete "explain this codebase"
//
// Runs a task through kbot's agent loop and measures:
//   - Response time
//   - Tokens used (input/output)
//   - Tools called (names + count)
//   - Cost estimate
//   - Agent selected + confidence
//
// Saves results to ~/.kbot/benchmarks/ and compares against previous runs.
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { performance } from 'perf_hooks';
import { createRequire } from 'module';
const __require = createRequire(import.meta.url);
const PKG_VERSION = __require('../package.json').version;
// ── ANSI escape codes ──
const BOLD = '\x1b[1m';
const DIM_START = '\x1b[2m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const PURPLE = '\x1b[35m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
function dim(s) { return `${DIM_START}${s}${RESET}`; }
function bold(s) { return `${BOLD}${s}${RESET}`; }
function purple(s) { return `${PURPLE}${s}${RESET}`; }
function green(s) { return `${GREEN}${s}${RESET}`; }
function cyan(s) { return `${CYAN}${s}${RESET}`; }
function yellow(s) { return `${YELLOW}${s}${RESET}`; }
// ── Benchmark persistence ──
const BENCH_DIR = join(homedir(), '.kbot', 'benchmarks');
const BENCH_FILE = join(BENCH_DIR, 'history.json');
const MAX_HISTORY = 100;
function ensureDir() {
    if (!existsSync(BENCH_DIR))
        mkdirSync(BENCH_DIR, { recursive: true });
}
function loadHistory() {
    ensureDir();
    if (!existsSync(BENCH_FILE))
        return [];
    try {
        return JSON.parse(readFileSync(BENCH_FILE, 'utf-8'));
    }
    catch {
        return [];
    }
}
function saveResult(result) {
    ensureDir();
    const history = loadHistory();
    history.unshift(result);
    writeFileSync(BENCH_FILE, JSON.stringify(history.slice(0, MAX_HISTORY), null, 2));
}
function findBaseline(task, currentTimestamp) {
    const history = loadHistory();
    const normalized = task.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    for (const h of history) {
        if (h.timestamp === currentTimestamp)
            continue;
        const hNorm = h.task.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        if (hNorm === normalized)
            return h;
    }
    return null;
}
// ── Formatting helpers ──
function formatTime(ms) {
    if (ms < 1000)
        return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}
function formatCost(usd, isLocal) {
    if (isLocal)
        return '$0.00 (local)';
    if (usd === 0)
        return '$0.00';
    if (usd < 0.001)
        return `$${usd.toFixed(6)}`;
    if (usd < 0.01)
        return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(3)}`;
}
function formatTokens(input, output) {
    const fmt = (n) => n > 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
    return `${fmt(input)} in / ${fmt(output)} out`;
}
function deltaStr(current, baseline, lowerIsBetter = true) {
    if (baseline === 0)
        return '';
    const diff = current - baseline;
    const pct = Math.round((diff / baseline) * 100);
    const sign = diff > 0 ? '+' : '';
    const color = (lowerIsBetter ? diff <= 0 : diff >= 0) ? GREEN : RED;
    return ` ${color}${sign}${pct}% vs last${RESET}`;
}
// ── Report ──
function printReport(result, baseline) {
    const w = Math.min(process.stdout.columns || 80, 60);
    const line = dim('\u2500'.repeat(w));
    console.log();
    console.log(`  ${purple('\u25cf')} ${bold('kbot Performance Report')}`);
    console.log(`  ${line}`);
    console.log();
    // Task
    const taskDisplay = result.task.length > w - 12
        ? result.task.slice(0, w - 15) + '...'
        : result.task;
    console.log(`  Task:      ${dim('"')}${taskDisplay}${dim('"')}`);
    // Time
    const timeStr = formatTime(result.timeMs);
    const timeDelta = baseline ? deltaStr(result.timeMs, baseline.timeMs) : '';
    console.log(`  Time:      ${purple(timeStr)}${timeDelta}`);
    // Tools
    const uniqueTools = [...new Set(result.toolsCalled)];
    const toolNames = uniqueTools.length > 0 ? uniqueTools.join(', ') : 'none';
    const toolCount = result.toolCallCount;
    const toolSuffix = toolCount > 0 ? ` (${toolCount} call${toolCount !== 1 ? 's' : ''})` : '';
    console.log(`  Tools:     ${cyan(`${toolNames}${toolSuffix}`)}`);
    // Tokens
    const tokensStr = formatTokens(result.inputTokens, result.outputTokens);
    const tokenTotal = result.inputTokens + result.outputTokens;
    const baselineTotal = baseline ? baseline.inputTokens + baseline.outputTokens : 0;
    const tokenDelta = baseline ? deltaStr(tokenTotal, baselineTotal) : '';
    console.log(`  Tokens:    ${dim(tokensStr)}${tokenDelta}`);
    // Cost
    const costStr = formatCost(result.costUsd, result.isLocal);
    const costDelta = baseline && !result.isLocal ? deltaStr(result.costUsd, baseline.costUsd) : '';
    console.log(`  Cost:      ${green(costStr)}${costDelta}`);
    // Agent
    const confStr = result.confidence > 0 ? ` (confidence: ${result.confidence.toFixed(2)})` : '';
    console.log(`  Agent:     ${yellow(result.agent)}${dim(confStr)}`);
    // Model
    console.log(`  Model:     ${dim(result.model)}`);
    // Response
    const respLen = result.responseLength;
    const respStr = respLen > 1000 ? `${(respLen / 1000).toFixed(1)}k chars` : `${respLen} chars`;
    console.log(`  Response:  ${dim(respStr)}`);
    console.log();
    console.log(`  ${line}`);
    if (baseline) {
        const d = new Date(baseline.timestamp);
        console.log(`  ${dim(`Baseline: ${d.toLocaleDateString()} ${d.toLocaleTimeString()} (v${baseline.version})`)}`);
    }
    else {
        console.log(`  ${dim('No baseline \u2014 this run becomes the baseline for future comparisons.')}`);
    }
    console.log();
}
// ── Main entry ──
export async function runCompete(task) {
    if (!task || task.trim().length === 0) {
        console.error(`${RED}Error:${RESET} Provide a task to benchmark.`);
        console.error('  Usage: kbot compete "explain this codebase"');
        process.exit(1);
    }
    console.log();
    console.log(`  ${purple('\u25cf')} ${bold('kbot compete')} \u2014 benchmarking...`);
    console.log(`  ${dim(`"${task}"`)}`);
    console.log();
    // Dynamic imports to avoid side effects at module level
    const { runAgent } = await import('./agent.js');
    const { learnedRoute } = await import('./learned-router.js');
    const { isLocalProvider, getByokProvider } = await import('./auth.js');
    // Check routing confidence before running
    const routeResult = learnedRoute(task);
    const routedAgent = routeResult?.agent || 'kernel';
    const routeConfidence = routeResult?.confidence || 0;
    // Determine provider locality
    const provider = getByokProvider();
    const isLocal = provider ? isLocalProvider(provider) : false;
    // Run the task through the real agent loop
    const startTime = performance.now();
    let response;
    try {
        response = await runAgent(task, {
            agent: routeResult?.agent,
            stream: false,
        });
    }
    catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`  ${RED}Benchmark failed:${RESET} ${errMsg}`);
        process.exit(1);
    }
    const endTime = performance.now();
    const timeMs = Math.round(endTime - startTime);
    // Extract metrics
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const costUsd = response.usage?.cost_usd || 0;
    const toolCallCount = response.toolCalls || 0;
    // Build result
    const now = new Date().toISOString();
    const result = {
        task: task.slice(0, 200),
        timestamp: now,
        version: PKG_VERSION,
        timeMs,
        toolsCalled: [],
        toolCallCount,
        inputTokens,
        outputTokens,
        costUsd,
        agent: response.agent || routedAgent,
        confidence: routeConfidence,
        model: response.model || 'unknown',
        isLocal,
        responseLength: response.content.length,
    };
    // Best-effort tool name extraction from response content
    const knownTools = [
        'read_file', 'write_file', 'edit_file', 'glob', 'grep', 'bash',
        'git_status', 'git_diff', 'git_log', 'git_commit', 'list_directory',
        'web_search', 'url_fetch', 'github_api', 'create_file', 'delete_file',
        'notebook_run', 'browser_navigate', 'browser_snapshot',
    ];
    if (toolCallCount > 0) {
        const contentLower = response.content.toLowerCase();
        const mentioned = knownTools.filter(t => contentLower.includes(t) || contentLower.includes(t.replace(/_/g, ' ')));
        result.toolsCalled = mentioned.length > 0 ? mentioned : ['(tool names not captured)'];
    }
    // Save and compare
    saveResult(result);
    const baseline = findBaseline(task, now);
    printReport(result, baseline);
}
//# sourceMappingURL=compete.js.map