/**
 * Critic Retrospect — retroactive judgement of past session tool calls.
 *
 * Reads ~/.kbot/observer/session.jsonl, replays tool calls through
 * gateToolResult (critic-gate.ts), and reports:
 *   - overall accept/reject ratio
 *   - tools with highest reject rate (args-validation candidates)
 *   - rejects that were later retried successfully (critic false positives)
 *   - sessions ranked by "retries saved" score
 *   - suggested strictness setting from precision/recall tradeoff
 *
 * NB: the observer only logs {ts, tool, args, session} — no results.
 * We synthesize a *result proxy* from retry behaviour: a call whose exact
 * (tool, args-hash) recurs inside the same session within RETRY_WINDOW_MS
 * is treated as having implicitly failed the first time. The critic is
 * passed this synthesized signal so it can judge on intent + shape.
 *
 * Cache: ~/.kbot/critic-cache.json — keyed by (tool, argsHash, resultHash).
 *
 * CLI wiring: cli.ts was modified in parallel; leaving subcommand wiring
 * as a TODO. Invoke via `node -e "import('./dist/critic-retrospect.js').then(m => m.run())"`.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { gateToolResult } from './critic-gate.js';
const OBSERVER_PATH = join(homedir(), '.kbot', 'observer', 'session.jsonl');
const CACHE_PATH = join(homedir(), '.kbot', 'critic-cache.json');
const RETRY_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
function sha(s) { return createHash('sha256').update(s).digest('hex').slice(0, 16); }
function hashArgs(args) { try {
    return sha(JSON.stringify(args));
}
catch {
    return sha(String(args));
} }
function loadCache() {
    if (!existsSync(CACHE_PATH))
        return {};
    try {
        return JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
    }
    catch {
        return {};
    }
}
function saveCache(c) {
    try {
        mkdirSync(dirname(CACHE_PATH), { recursive: true });
        writeFileSync(CACHE_PATH, JSON.stringify(c, null, 2));
    }
    catch { /* best-effort */ }
}
function readEvents() {
    if (!existsSync(OBSERVER_PATH))
        return [];
    const raw = readFileSync(OBSERVER_PATH, 'utf8');
    const out = [];
    for (const line of raw.split('\n')) {
        if (!line.trim())
            continue;
        try {
            const e = JSON.parse(line);
            if (e && e.tool && e.session && e.ts)
                out.push(e);
        }
        catch { /* skip */ }
    }
    return out;
}
/** Group events by session; keep last N sessions (by latest ts). */
function pickLastNSessions(events, n) {
    const bySession = new Map();
    for (const e of events) {
        const arr = bySession.get(e.session) ?? [];
        arr.push(e);
        bySession.set(e.session, arr);
    }
    const ordered = [...bySession.entries()]
        .map(([id, evs]) => ({ id, evs, lastTs: Date.parse(evs[evs.length - 1].ts) || 0 }))
        .sort((a, b) => b.lastTs - a.lastTs);
    const pick = ordered.slice(0, n);
    const picked = new Map();
    for (const p of pick)
        picked.set(p.id, p.evs);
    return { picked, available: bySession.size };
}
/** Annotate each call with retry info inside its session. */
function enrich(sessionEvents) {
    const calls = sessionEvents.map(e => ({
        ...e, argsHash: hashArgs({ tool: e.tool, args: e.args }), retriedLater: false, retrySucceeded: false,
    }));
    // Two-pass: mark retriedLater, then mark retrySucceeded.
    for (let i = 0; i < calls.length; i++) {
        const a = calls[i];
        const at = Date.parse(a.ts) || 0;
        for (let j = i + 1; j < calls.length; j++) {
            const b = calls[j];
            const bt = Date.parse(b.ts) || 0;
            if (bt - at > RETRY_WINDOW_MS)
                break;
            if (b.tool === a.tool && b.argsHash === a.argsHash) {
                a.retriedLater = true;
                break;
            }
        }
    }
    for (let i = 0; i < calls.length; i++) {
        if (!calls[i].retriedLater)
            continue;
        // If the LAST occurrence of (tool,argsHash) in this session is NOT retriedLater, consider retry "succeeded".
        for (let j = calls.length - 1; j > i; j--) {
            if (calls[j].tool === calls[i].tool && calls[j].argsHash === calls[i].argsHash) {
                calls[i].retrySucceeded = !calls[j].retriedLater;
                break;
            }
        }
    }
    return calls;
}
/** Build a synthetic "result" proxy to feed the critic. */
function synthResult(c) {
    if (c.retriedLater)
        return `[observer-proxy] no result captured; same (tool,args) was retried within ${RETRY_WINDOW_MS / 1000}s — likely failed or unsatisfactory.`;
    return `[observer-proxy] no result captured; call was not retried in-session — presumed accepted by the agent downstream.`;
}
async function judge(c, strictness, cache, llmClient) {
    const resultProxy = synthResult(c);
    const resultHash = sha(resultProxy);
    const key = `${c.tool}:${c.argsHash}:${resultHash}:${strictness.toFixed(2)}`;
    const hit = cache[key];
    if (hit)
        return hit.verdict;
    const verdict = await gateToolResult(c.tool, c.args, resultProxy, { strictness, llmClient });
    cache[key] = { verdict, cachedAt: new Date().toISOString() };
    return verdict;
}
/** Precision/recall math.
 *  We treat "retriedLater" as ground-truth "call was bad".
 *  Critic rejects = positives.
 *    TP = reject && retriedLater    (correct catch)
 *    FP = reject && !retriedLater   (nagged a fine call)
 *    FN = accept && retriedLater    (missed a bad call)
 *    TN = accept && !retriedLater   (correct pass)
 *  Precision = TP / (TP + FP)  — of rejects, how many were real
 *  Recall    = TP / (TP + FN)  — of bad calls, how many did we catch
 *  Sweep strictness-equivalent proxy: threshold on verdict.confidence for rejects.
 */
function prCurve(rows) {
    const candidates = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    let best = { s: 0.5, f1: -1, p: 0, r: 0 };
    for (const s of candidates) {
        let tp = 0, fp = 0, fn = 0;
        for (const r of rows) {
            const gatedReject = r.reject && r.confidence >= 1 - s; // stricter => more rejects pass through
            if (gatedReject && r.bad)
                tp++;
            else if (gatedReject && !r.bad)
                fp++;
            else if (!gatedReject && r.bad)
                fn++;
        }
        const p = tp + fp > 0 ? tp / (tp + fp) : 0;
        const rec = tp + fn > 0 ? tp / (tp + fn) : 0;
        const f1 = p + rec > 0 ? (2 * p * rec) / (p + rec) : 0;
        if (f1 > best.f1)
            best = { s, f1, p, r: rec };
    }
    return { suggested: best.s, precision: best.p, recall: best.r };
}
export async function run(opts = {}) {
    const nSessions = opts.sessions ?? 10;
    const strictness = opts.strictness ?? 0.5;
    const perSessionCap = opts.maxCallsPerSession ?? 50;
    const events = readEvents();
    const { picked, available } = pickLastNSessions(events, nSessions);
    const cache = loadCache();
    const byTool = {};
    const falsePositives = [];
    const sessionStats = [];
    const prRows = [];
    let accepts = 0, rejects = 0, totalCalls = 0;
    for (const [sid, evs] of picked) {
        const enriched = enrich(evs).slice(0, perSessionCap);
        let sessionRetriesSaved = 0;
        for (const c of enriched) {
            const v = await judge(c, strictness, cache, opts.llmClient);
            totalCalls++;
            const bucket = byTool[c.tool] ?? (byTool[c.tool] = { total: 0, accepts: 0, rejects: 0 });
            bucket.total++;
            if (v.accept) {
                accepts++;
                bucket.accepts++;
            }
            else {
                rejects++;
                bucket.rejects++;
            }
            prRows.push({ reject: !v.accept, bad: c.retriedLater, confidence: v.confidence });
            if (!v.accept && c.retriedLater)
                sessionRetriesSaved++;
            // Likely false positives: critic rejected, but the call was NOT retried (so downstream accepted it).
            if (!v.accept && !c.retriedLater) {
                falsePositives.push({ tool: c.tool, session: sid, retryGap: 0, reason: v.reason });
            }
            // Also: rejected AND the retry later succeeded — still a FP if the agent had listened and skipped, it would have worked anyway.
            if (!v.accept && c.retrySucceeded) {
                falsePositives.push({ tool: c.tool, session: sid, retryGap: RETRY_WINDOW_MS, reason: `retry later succeeded: ${v.reason ?? ''}` });
            }
        }
        sessionStats.push({ session: sid, calls: enriched.length, retriesSaved: sessionRetriesSaved, score: sessionRetriesSaved / Math.max(1, enriched.length) });
    }
    saveCache(cache);
    const topRejectRate = Object.entries(byTool)
        .filter(([, v]) => v.total >= 3)
        .map(([tool, v]) => ({ tool, total: v.total, rejectRate: v.rejects / v.total }))
        .sort((a, b) => b.rejectRate - a.rejectRate)
        .slice(0, 5);
    const sessionsRanked = sessionStats.sort((a, b) => b.score - a.score).slice(0, 10);
    const fpTop = falsePositives.slice(0, 5);
    const pr = prCurve(prRows);
    const report = {
        totalCalls, sessionsScanned: picked.size, sessionsAvailable: available,
        accepts, rejects, byTool, topRejectRate, likelyFalsePositives: fpTop,
        sessionsRanked, suggestedStrictness: pr.suggested, precision: pr.precision, recall: pr.recall,
    };
    renderReport(report);
    if (opts.jsonOut) {
        try {
            writeFileSync(opts.jsonOut, JSON.stringify(report, null, 2));
            console.log(`\nJSON written → ${opts.jsonOut}`);
        }
        catch (e) {
            console.error(`JSON export failed: ${e.message}`);
        }
    }
    return report;
}
function renderReport(r) {
    const line = (s = '') => console.log(s);
    line('\n=== Critic Retrospective ===');
    line(`sessions scanned: ${r.sessionsScanned} / ${r.sessionsAvailable} available`);
    line(`tool calls judged: ${r.totalCalls}`);
    const ratio = r.totalCalls ? (r.accepts / r.totalCalls) : 0;
    line(`accept/reject: ${r.accepts} / ${r.rejects}  (accept-rate ${(ratio * 100).toFixed(1)}%)`);
    line('\n-- top 5 reject rate (candidates for args validation) --');
    if (!r.topRejectRate.length)
        line('  (no tool has >=3 calls)');
    for (const t of r.topRejectRate)
        line(`  ${t.tool.padEnd(28)}  ${(t.rejectRate * 100).toFixed(1)}% rejected  (${t.total} calls)`);
    line('\n-- likely critic false positives (rejected but agent did not retry OR retry worked) --');
    if (!r.likelyFalsePositives.length)
        line('  (none)');
    for (const fp of r.likelyFalsePositives)
        line(`  ${fp.tool.padEnd(28)}  session=${fp.session.slice(0, 8)}  ${fp.reason ?? ''}`);
    line('\n-- sessions ranked by retries-saved score --');
    for (const s of r.sessionsRanked.slice(0, 5))
        line(`  ${s.session.slice(0, 8)}  calls=${s.calls}  saved=${s.retriesSaved}  score=${s.score.toFixed(3)}`);
    line('\n-- precision / recall tradeoff --');
    line(`  precision = ${r.precision.toFixed(3)}   recall = ${r.recall.toFixed(3)}`);
    line(`  suggested critic_strictness = ${r.suggestedStrictness.toFixed(2)}`);
    line('');
}
// TODO(cli-wiring): register `kbot critic retrospect` subcommand in cli.ts once
// the parallel skills-subcommand edit lands. For now, invoke via:
//   node -e "import('./dist/critic-retrospect.js').then(m => m.run({ sessions: 20 }))"
// Direct-execution entrypoint for `node dist/critic-retrospect.js`.
const argv1 = process.argv[1] || '';
if (argv1.endsWith('critic-retrospect.js') || argv1.endsWith('critic-retrospect.ts')) {
    const sessionsArg = process.argv.find(a => a.startsWith('--sessions='));
    const jsonArg = process.argv.find(a => a.startsWith('--json='));
    const strictArg = process.argv.find(a => a.startsWith('--strictness='));
    const sessions = sessionsArg ? Number(sessionsArg.split('=')[1]) : 10;
    const strictness = strictArg ? Number(strictArg.split('=')[1]) : undefined;
    const jsonOut = jsonArg ? jsonArg.split('=')[1] : undefined;
    run({ sessions, strictness, jsonOut }).catch(e => { console.error(e); process.exit(1); });
}
//# sourceMappingURL=critic-retrospect.js.map