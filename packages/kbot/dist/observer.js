// kbot Observer — Learns from external agent sessions (Claude Code, Cursor, etc.)
//
// Watches a JSONL log of tool calls and outcomes, extracts patterns,
// solutions, and knowledge, and feeds them into kbot's learning engine.
//
// Usage:
//   kbot observe                    # ingest latest observations
//   kbot observe --watch            # continuously watch for new entries
//   kbot observe --stats            # show what's been learned
//
// The log file is written by a Claude Code hook (PostToolUse) that appends
// one JSON line per tool call to ~/.kbot/observer/session.jsonl
//
// Format per line (schema v1 — legacy):
//   {"ts":"ISO","tool":"Read","args":{"file_path":"/src/foo.ts"},"result_length":1234,"session":"abc"}
//
// Format per line (schema v2 — includes action-token training fields):
//   {"schema":2,"ts":"ISO","tool":"Read","args":{...},"result_length":1234,"session":"abc",
//    "durationMs":42,"outcome":"success","resultSize":1234,"error":false}
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
// ── Constants ──
const OBSERVER_DIR = join(homedir(), '.kbot', 'observer');
const LOG_FILE = join(OBSERVER_DIR, 'session.jsonl');
const CURSOR_FILE = join(OBSERVER_DIR, 'cursor.json');
const STATS_FILE = join(OBSERVER_DIR, 'stats.json');
function ensureDir() {
    if (!existsSync(OBSERVER_DIR))
        mkdirSync(OBSERVER_DIR, { recursive: true });
}
// ── Log Writing (called by Claude Code hook) ──
/**
 * Append a tool call observation to the log.
 * Called by the Claude Code PostToolUse hook.
 */
export function recordObservation(entry) {
    ensureDir();
    appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}
// ── Log Reading ──
function loadCursor() {
    if (!existsSync(CURSOR_FILE))
        return { offset: 0, lastSession: '' };
    try {
        return JSON.parse(readFileSync(CURSOR_FILE, 'utf8'));
    }
    catch {
        return { offset: 0, lastSession: '' };
    }
}
function saveCursor(cursor) {
    ensureDir();
    writeFileSync(CURSOR_FILE, JSON.stringify(cursor));
}
function loadStats() {
    if (!existsSync(STATS_FILE))
        return {
            totalObserved: 0, sessionsObserved: 0,
            toolFrequency: {}, sequencesLearned: 0, factsLearned: 0, lastIngested: '',
        };
    try {
        return JSON.parse(readFileSync(STATS_FILE, 'utf8'));
    }
    catch {
        return { totalObserved: 0, sessionsObserved: 0, toolFrequency: {}, sequencesLearned: 0, factsLearned: 0, lastIngested: '' };
    }
}
function saveStats(stats) {
    ensureDir();
    writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}
// ── Tool Name Mapping (Claude Code → kbot) ──
const TOOL_MAP = {
    'Read': 'read_file',
    'Write': 'write_file',
    'Edit': 'edit_file',
    'Bash': 'bash',
    'Glob': 'glob',
    'Grep': 'grep',
    'WebSearch': 'web_search',
    'WebFetch': 'url_fetch',
    'Agent': 'subagent',
    'Skill': 'skill',
};
function mapToolName(name) {
    return TOOL_MAP[name] || name.toLowerCase();
}
// ── Core: Ingest Observations ──
/**
 * Read new observations from the log file and feed them into kbot's learning engine.
 * Returns the number of new entries processed.
 */
export async function ingestObservations() {
    ensureDir();
    if (!existsSync(LOG_FILE))
        return { processed: 0, patterns: 0, facts: 0, sessions: [] };
    // Dynamic import to avoid circular deps
    const { updateProfile, learnFact, extractKeywords, flushPendingWrites } = await import('./learning.js');
    const cursor = loadCursor();
    const stats = loadStats();
    const content = readFileSync(LOG_FILE, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length <= cursor.offset) {
        return { processed: 0, patterns: 0, facts: 0, sessions: [] };
    }
    const newLines = lines.slice(cursor.offset);
    const entries = [];
    for (const line of newLines) {
        try {
            entries.push(JSON.parse(line));
        }
        catch { /* skip malformed */ }
    }
    if (entries.length === 0) {
        return { processed: 0, patterns: 0, facts: 0, sessions: [] };
    }
    // Group by session
    const sessions = new Map();
    for (const e of entries) {
        const sid = e.session || 'unknown';
        if (!sessions.has(sid))
            sessions.set(sid, []);
        sessions.get(sid).push(e);
    }
    let patternsLearned = 0;
    let factsLearned = 0;
    for (const [sessionId, calls] of sessions) {
        // Extract tool sequence
        const toolSequence = calls.map(c => mapToolName(c.tool));
        // Update profile with observed tool usage
        for (const tool of toolSequence) {
            stats.toolFrequency[tool] = (stats.toolFrequency[tool] || 0) + 1;
        }
        // Detect task type from tool patterns
        let taskType = 'general';
        if (toolSequence.includes('bash') && (toolSequence.includes('read_file') || toolSequence.includes('edit_file'))) {
            taskType = 'build';
        }
        if (toolSequence.filter(t => t === 'read_file').length > 3) {
            taskType = 'explain';
        }
        if (toolSequence.includes('grep') || toolSequence.includes('glob')) {
            taskType = 'debug';
        }
        if (toolSequence.includes('web_search') || toolSequence.includes('url_fetch')) {
            taskType = 'search';
        }
        // Extract tech terms from file paths
        const techTerms = [];
        for (const call of calls) {
            const filePath = String(call.args?.file_path || call.args?.path || call.args?.command || '');
            if (filePath.includes('.ts') || filePath.includes('typescript'))
                techTerms.push('typescript');
            if (filePath.includes('.py'))
                techTerms.push('python');
            if (filePath.includes('.rs'))
                techTerms.push('rust');
            if (filePath.includes('.go'))
                techTerms.push('go');
            if (filePath.includes('package.json') || filePath.includes('npm'))
                techTerms.push('npm');
            if (filePath.includes('docker') || filePath.includes('Dockerfile'))
                techTerms.push('docker');
            if (filePath.includes('supabase'))
                techTerms.push('supabase');
            if (filePath.includes('react') || filePath.includes('.tsx'))
                techTerms.push('react');
        }
        // Update kbot's profile
        updateProfile({
            tokens: calls.length * 500, // estimate
            agent: 'observed-claude-code',
            taskType,
            techTerms: [...new Set(techTerms)],
            message: `Observed session: ${toolSequence.slice(0, 5).join(' → ')}`,
            success: !calls.some(c => c.error),
        });
        // Extract knowledge from bash commands
        for (const call of calls) {
            if (call.tool === 'Bash' && call.args?.command) {
                const cmd = String(call.args.command);
                // Learn npm publish patterns
                if (cmd.includes('npm publish')) {
                    learnFact(`npm publish workflow: build → type-check → publish`, 'context', 'observed');
                    factsLearned++;
                }
                // Learn deployment patterns
                if (cmd.includes('supabase functions deploy')) {
                    const match = cmd.match(/deploy\s+(\S+)/);
                    if (match) {
                        learnFact(`Edge function "${match[1]}" deployed via supabase CLI`, 'context', 'observed');
                        factsLearned++;
                    }
                }
                // Learn docker patterns
                if (cmd.includes('docker build') || cmd.includes('docker push')) {
                    learnFact(`Docker workflow: build → tag → push to Docker Hub`, 'context', 'observed');
                    factsLearned++;
                }
                // Learn git workflow
                if (cmd.includes('git push')) {
                    learnFact(`Git workflow: stage specific files → commit with Co-Authored-By → push`, 'context', 'observed');
                    factsLearned++;
                }
            }
            // Learn from file edits — which files get edited together
            if (call.tool === 'Edit' || call.tool === 'Write') {
                const filePath = String(call.args?.file_path || '');
                if (filePath.includes('cli.ts')) {
                    learnFact(`cli.ts is the main entry point — new commands are registered here`, 'context', 'observed');
                    factsLearned++;
                }
                if (filePath.includes('matrix.ts')) {
                    learnFact(`matrix.ts holds BUILTIN_AGENTS — new agents must be added here`, 'context', 'observed');
                    factsLearned++;
                }
                if (filePath.includes('package.json') && filePath.includes('kbot')) {
                    learnFact(`Version bump in package.json before npm publish`, 'context', 'observed');
                    factsLearned++;
                }
            }
        }
        patternsLearned++;
    }
    // Update stats
    stats.totalObserved += entries.length;
    stats.sessionsObserved += sessions.size;
    stats.sequencesLearned += patternsLearned;
    stats.factsLearned += factsLearned;
    stats.lastIngested = new Date().toISOString();
    saveStats(stats);
    // Update cursor
    saveCursor({ offset: lines.length, lastSession: [...sessions.keys()].pop() || '' });
    // Flush learning data to disk
    flushPendingWrites();
    return {
        processed: entries.length,
        patterns: patternsLearned,
        facts: factsLearned,
        sessions: [...sessions.keys()],
    };
}
export function getObserverStats() {
    return loadStats();
}
export function getLogPath() {
    return LOG_FILE;
}
//# sourceMappingURL=observer.js.map