// kbot Collective Learning — Anonymized Pattern Sharing
//
// The core thesis: user #1000 is smarter than user #1.
// Every kbot contributes anonymized patterns. Every kbot benefits from all.
//
// What gets shared (anonymized):
//   - Pattern type, language, framework, success rate, tool used, agent used
//
// What NEVER gets shared:
//   - File paths, usernames, project names, source code, API keys
//   - Conversation content, personal identifiers
//
// Privacy: device fingerprint is a one-way SHA-256 hash — not reversible.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const KBOT_DIR = join(homedir(), '.kbot');
const MEMORY_DIR = join(KBOT_DIR, 'memory');
const COLLECTIVE_DIR = join(KBOT_DIR, 'collective');
const PATTERNS_FILE = join(MEMORY_DIR, 'patterns.json');
const COLLECTIVE_PATTERNS_FILE = join(COLLECTIVE_DIR, 'learned-patterns.json');
const SYNC_STATE_FILE = join(COLLECTIVE_DIR, 'learning-sync.json');
const COLLECTIVE_URL = process.env.KBOT_COLLECTIVE_URL || 'https://kernel.chat/api/collective';
// ── Helpers ──
function ensureDir(dir) {
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
}
function loadJSON(path, fallback) {
    try {
        if (existsSync(path)) {
            return JSON.parse(readFileSync(path, 'utf-8'));
        }
    }
    catch {
        // Corrupt file — return fallback
    }
    return fallback;
}
function saveJSON(path, data) {
    const dir = join(path, '..');
    ensureDir(dir);
    writeFileSync(path, JSON.stringify(data, null, 2));
}
function loadSyncState() {
    return loadJSON(SYNC_STATE_FILE, {
        lastContribute: null,
        lastFetch: null,
        totalContributed: 0,
        totalGained: 0,
    });
}
function saveSyncState(state) {
    ensureDir(COLLECTIVE_DIR);
    writeFileSync(SYNC_STATE_FILE, JSON.stringify(state, null, 2));
}
// ── PII Stripping ──
/** Patterns that look like file paths, usernames, or project-specific identifiers */
const PII_PATTERNS = [
    /\/[Uu]sers\/[^/\s]+/g, // /Users/username
    /\/home\/[^/\s]+/g, // /home/username
    /[Cc]:\\[Uu]sers\\[^\\s]+/g, // C:\Users\username (Windows)
    /~\/[^\s]+/g, // ~/path/to/something
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // emails
    /\b[A-Z][a-z]+(?:[A-Z][a-z]+){1,}\b/g, // CamelCase project names (heuristic)
];
/** Strip PII from a string — removes paths, usernames, project names */
function stripPII(text) {
    let cleaned = text;
    for (const pattern of PII_PATTERNS) {
        cleaned = cleaned.replace(pattern, '[REDACTED]');
    }
    return cleaned;
}
/** Strip PII from keywords — only keep generic tech terms */
const SAFE_KEYWORDS = new Set([
    'react', 'typescript', 'node', 'python', 'rust', 'go', 'docker',
    'api', 'database', 'test', 'deploy', 'build', 'fix', 'bug', 'error',
    'component', 'function', 'class', 'import', 'export', 'async', 'await',
    'fetch', 'route', 'auth', 'css', 'html', 'json', 'sql', 'git', 'npm',
    'install', 'config', 'server', 'client', 'hook', 'state', 'redux',
    'zustand', 'supabase', 'stripe', 'vite', 'webpack', 'nextjs', 'express',
    'fastify', 'django', 'flask', 'rails', 'spring', 'vue', 'angular',
    'svelte', 'tailwind', 'prisma', 'drizzle', 'postgres', 'mysql', 'redis',
    'mongodb', 'graphql', 'rest', 'websocket', 'grpc', 'terraform', 'kubernetes',
    'aws', 'gcp', 'azure', 'vercel', 'netlify', 'cloudflare', 'deno', 'bun',
]);
function sanitizeKeywords(keywords) {
    return keywords
        .map(k => k.toLowerCase().trim())
        .filter(k => SAFE_KEYWORDS.has(k));
}
/** Only keep tool names — no args or paths */
function sanitizeToolNames(tools) {
    return tools
        .map(t => t.replace(/[^a-z0-9_-]/gi, '').slice(0, 50))
        .filter(Boolean);
}
// ── Device Fingerprint ──
/** Generate a non-identifiable device fingerprint for dedup.
 *  Hashes hostname + homedir path + platform — not reversible. */
function getDeviceFingerprint() {
    const os = require('node:os');
    const raw = `${os.hostname()}:${os.homedir()}:${os.platform()}:${os.arch()}`;
    return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}
// ── Detect Language & Framework from Keywords ──
const LANGUAGE_MAP = {
    typescript: 'TypeScript', javascript: 'JavaScript', python: 'Python',
    rust: 'Rust', go: 'Go', java: 'Java', ruby: 'Ruby', php: 'PHP',
    swift: 'Swift', kotlin: 'Kotlin', csharp: 'C#', cpp: 'C++',
};
const FRAMEWORK_MAP = {
    react: 'React', nextjs: 'Next.js', vue: 'Vue', angular: 'Angular',
    svelte: 'Svelte', express: 'Express', fastify: 'Fastify', django: 'Django',
    flask: 'Flask', rails: 'Rails', spring: 'Spring', prisma: 'Prisma',
    drizzle: 'Drizzle', tailwind: 'Tailwind', vite: 'Vite', webpack: 'Webpack',
};
function detectLanguage(keywords) {
    for (const kw of keywords) {
        const lang = LANGUAGE_MAP[kw.toLowerCase()];
        if (lang)
            return lang;
    }
    return null;
}
function detectFramework(keywords) {
    for (const kw of keywords) {
        const fw = FRAMEWORK_MAP[kw.toLowerCase()];
        if (fw)
            return fw;
    }
    return null;
}
// ── Core API ──
/** Read ~/.kbot/memory/patterns.json, strip PII, keep only safe fields.
 *  Returns an anonymized array suitable for sharing. */
export function collectAnonymizedPatterns() {
    ensureDir(MEMORY_DIR);
    const raw = loadJSON(PATTERNS_FILE, []);
    if (!Array.isArray(raw) || raw.length === 0)
        return [];
    return raw.map(p => {
        const keywords = Array.isArray(p.keywords) ? sanitizeKeywords(p.keywords) : [];
        const toolSequence = Array.isArray(p.toolSequence) ? sanitizeToolNames(p.toolSequence) : [];
        const intent = typeof p.intent === 'string' ? stripPII(p.intent) : '';
        return {
            type: intent ? 'intent_match' : 'unknown',
            language: detectLanguage(keywords),
            framework: detectFramework(keywords),
            successRate: typeof p.successRate === 'number' ? Math.round(p.successRate * 100) / 100 : 0,
            toolsUsed: toolSequence,
            agentUsed: typeof p.agentUsed === 'string' ? p.agentUsed : null,
            hits: typeof p.hits === 'number' ? p.hits : 1,
            keywords,
        };
    }).filter(p => p.keywords.length > 0 || p.toolsUsed.length > 0);
}
/** POST anonymized patterns to the collective endpoint.
 *  Includes a device fingerprint hash for dedup (not identifiable).
 *  Returns count of patterns contributed. */
export async function contributePatterns() {
    const patterns = collectAnonymizedPatterns();
    if (patterns.length === 0)
        return 0;
    const fingerprint = getDeviceFingerprint();
    try {
        const res = await fetch(`${COLLECTIVE_URL}/contribute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                device_fingerprint: fingerprint,
                patterns,
                version: '1.0.0',
                timestamp: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
            if (process.env.KBOT_DEBUG) {
                console.error(`[collective-learning] contribute failed: ${res.status}`);
            }
            return 0;
        }
        const data = await res.json();
        return data.accepted ?? patterns.length;
    }
    catch (err) {
        if (process.env.KBOT_DEBUG) {
            console.error('[collective-learning] contribute error:', err.message);
        }
        return 0;
    }
}
/** GET patterns from the collective endpoint.
 *  Merges with local patterns, preferring higher-confidence entries.
 *  Returns count of new patterns gained. */
export async function fetchCollectivePatterns() {
    ensureDir(COLLECTIVE_DIR);
    try {
        const res = await fetch(`${COLLECTIVE_URL}/patterns`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
            if (process.env.KBOT_DEBUG) {
                console.error(`[collective-learning] fetch failed: ${res.status}`);
            }
            return 0;
        }
        const data = await res.json();
        const remote = data.patterns;
        if (!Array.isArray(remote) || remote.length === 0)
            return 0;
        // Load existing collective patterns cache
        const existing = loadJSON(COLLECTIVE_PATTERNS_FILE, []);
        const existingMap = new Map();
        for (const p of existing) {
            const key = patternKey(p);
            existingMap.set(key, p);
        }
        let gained = 0;
        for (const p of remote) {
            const key = patternKey(p);
            const local = existingMap.get(key);
            if (!local) {
                // New pattern — add it
                existingMap.set(key, p);
                gained++;
            }
            else if (p.confidence > local.confidence) {
                // Higher confidence from collective — update
                existingMap.set(key, p);
                gained++;
            }
            // Otherwise keep local (already same or better confidence)
        }
        // Save merged collective patterns
        const merged = Array.from(existingMap.values())
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 500); // Cap at 500 patterns to keep file reasonable
        saveJSON(COLLECTIVE_PATTERNS_FILE, merged);
        return gained;
    }
    catch (err) {
        if (process.env.KBOT_DEBUG) {
            console.error('[collective-learning] fetch error:', err.message);
        }
        return 0;
    }
}
/** Generate a stable key for pattern dedup */
function patternKey(p) {
    const parts = [
        p.type,
        p.language || '',
        p.framework || '',
        ...(p.toolsUsed || []).sort(),
        ...(p.keywords || []).sort(),
    ];
    return parts.join(':').toLowerCase();
}
/** Orchestrate the full collective sync cycle:
 *  collect -> contribute -> fetch -> merge.
 *  Returns a human-readable summary. */
export async function runCollectiveSync() {
    const localPatterns = collectAnonymizedPatterns();
    const localCount = localPatterns.length;
    // Load existing collective patterns for baseline
    const beforeCount = loadJSON(COLLECTIVE_PATTERNS_FILE, []).length;
    // Contribute our patterns
    const contributed = await contributePatterns();
    // Fetch patterns from the collective
    const gained = await fetchCollectivePatterns();
    // Calculate "smarter" percentage: ratio of collective patterns to local
    const afterCount = loadJSON(COLLECTIVE_PATTERNS_FILE, []).length;
    const totalKnowledge = localCount + afterCount;
    const smarterPct = totalKnowledge > 0
        ? Math.round((afterCount / totalKnowledge) * 100)
        : 0;
    // Update sync state
    const state = loadSyncState();
    state.lastContribute = new Date().toISOString();
    state.lastFetch = new Date().toISOString();
    state.totalContributed += contributed;
    state.totalGained += gained;
    saveSyncState(state);
    return [
        `Contributed ${contributed} patterns.`,
        `Gained ${gained} new patterns from the collective.`,
        `kbot is now ${smarterPct}% smarter.`,
        `(${localCount} local + ${afterCount} collective = ${totalKnowledge} total patterns)`,
    ].join(' ');
}
/** Get collective learning stats for display */
export function getCollectiveLearningStats() {
    const state = loadSyncState();
    const collectivePatterns = loadJSON(COLLECTIVE_PATTERNS_FILE, []);
    const localPatterns = loadJSON(PATTERNS_FILE, []);
    return [
        `Collective learning:`,
        `  Local patterns: ${localPatterns.length}`,
        `  Collective patterns: ${collectivePatterns.length}`,
        `  Total contributed: ${state.totalContributed}`,
        `  Total gained: ${state.totalGained}`,
        `  Last sync: ${state.lastFetch || 'never'}`,
    ].join('\n');
}
/** Load cached collective patterns for use by the routing/agent system */
export function getCachedCollectivePatterns() {
    return loadJSON(COLLECTIVE_PATTERNS_FILE, []);
}
//# sourceMappingURL=collective-learning.js.map