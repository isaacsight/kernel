// Teacher Logger — captures provider calls as (prompt, response, tools, outcome) pairs
// for later distillation / fine-tuning. Writes to ~/.kbot/teacher/traces.jsonl.
//
// One logger per process. Append-only, JSONL, crash-safe (flush per record).
// PII scrubber runs before persist.
import { appendFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
// ── PII / secret scrubber ────────────────────────────────────────────
// Patterns for API keys, tokens, common secrets
const SCRUB_PATTERNS = [
    [/sk-ant-[A-Za-z0-9\-_]{20,}/g, 'sk-ant-<REDACTED>'],
    [/sk-[A-Za-z0-9]{20,}/g, 'sk-<REDACTED>'],
    [/ghp_[A-Za-z0-9]{30,}/g, 'ghp_<REDACTED>'],
    [/github_pat_[A-Za-z0-9_]{30,}/g, 'github_pat_<REDACTED>'],
    [/AIza[A-Za-z0-9\-_]{30,}/g, 'AIza<REDACTED>'],
    [/xoxb-[A-Za-z0-9\-]{20,}/g, 'xoxb-<REDACTED>'],
    [/eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, '<JWT_REDACTED>'],
    [/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, '<EMAIL>'],
    [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<IP>'],
    [/\b[A-Fa-f0-9]{64}\b/g, '<HEX64>'],
];
function scrubString(s) {
    let out = s;
    for (const [pat, repl] of SCRUB_PATTERNS)
        out = out.replace(pat, repl);
    // Home path scrub — keep structure but redact username
    const home = homedir();
    if (home && out.includes(home)) {
        out = out.split(home).join('~');
    }
    return out;
}
function scrubTrace(t) {
    return {
        ...t,
        system: scrubString(t.system),
        messages: t.messages.map(m => ({ role: m.role, content: scrubString(m.content) })),
        response: {
            ...t.response,
            content: scrubString(t.response.content),
            thinking: t.response.thinking ? scrubString(t.response.thinking) : undefined,
            tool_calls: t.response.tool_calls?.map(tc => ({
                id: tc.id,
                name: tc.name,
                arguments: JSON.parse(scrubString(JSON.stringify(tc.arguments))),
            })),
        },
    };
}
// ── Logger ───────────────────────────────────────────────────────────
class TeacherLogger {
    enabled;
    dir;
    traceFile;
    maxBytes;
    scrub;
    pending = new Map();
    constructor(opts = {}) {
        this.enabled = opts.enabled ?? envEnabled();
        this.dir = opts.dir ?? join(homedir(), '.kbot', 'teacher');
        this.traceFile = join(this.dir, 'traces.jsonl');
        this.maxBytes = opts.maxBytes ?? 500 * 1024 * 1024; // 500MB cap; rotate beyond
        this.scrub = opts.scrub ?? true;
        if (this.enabled && !existsSync(this.dir)) {
            try {
                mkdirSync(this.dir, { recursive: true });
            }
            catch { /* ignore */ }
        }
    }
    isEnabled() { return this.enabled; }
    setEnabled(v) { this.enabled = v; }
    /** Begin a trace — returns an ID to finalize later */
    begin(input) {
        if (!this.enabled)
            return '';
        const id = randomUUID();
        this.pending.set(id, {
            id,
            session_id: input.sessionId,
            provider: input.provider,
            model: input.model,
            system: input.system,
            messages: input.messages,
            started_at: Date.now(),
        });
        return id;
    }
    /** Finalize a trace with the model response. No-op if id is empty/unknown. */
    end(id, response, usage, outcome) {
        if (!this.enabled || !id)
            return;
        const p = this.pending.get(id);
        if (!p)
            return;
        this.pending.delete(id);
        const trace = {
            id: p.id,
            ts: Date.now(),
            session_id: p.session_id,
            provider: p.provider,
            model: p.model,
            system: p.system,
            messages: p.messages,
            response,
            usage,
            latency_ms: Date.now() - p.started_at,
            outcome,
        };
        this.persist(trace);
    }
    /** Tag an already-persisted trace with outcome later (e.g. after verifier runs). */
    tagOutcome(traceId, outcome) {
        if (!this.enabled || !traceId)
            return;
        const outcomeFile = join(this.dir, 'outcomes.jsonl');
        try {
            appendFileSync(outcomeFile, JSON.stringify({ id: traceId, outcome, ts: Date.now() }) + '\n');
        }
        catch { /* swallow */ }
    }
    persist(trace) {
        try {
            // Size-based rotation
            if (existsSync(this.traceFile)) {
                const sz = statSync(this.traceFile).size;
                if (sz > this.maxBytes) {
                    const rotated = join(this.dir, `traces.${Date.now()}.jsonl`);
                    try {
                        require('node:fs').renameSync(this.traceFile, rotated);
                    }
                    catch { /* ignore */ }
                }
            }
            const t = this.scrub ? scrubTrace(trace) : trace;
            appendFileSync(this.traceFile, JSON.stringify(t) + '\n');
        }
        catch {
            // Never throw from logger — swallow and continue
        }
    }
    path() { return this.traceFile; }
}
function envEnabled() {
    const v = process.env.KBOT_TEACHER_LOG;
    if (v == null)
        return true; // default on — cost-free data collection
    return v !== '0' && v.toLowerCase() !== 'false' && v !== '';
}
// ── Singleton ────────────────────────────────────────────────────────
let singleton = null;
export function getTeacherLogger() {
    if (!singleton)
        singleton = new TeacherLogger();
    return singleton;
}
export function setTeacherLogger(logger) {
    singleton = logger;
}
//# sourceMappingURL=teacher-logger.js.map