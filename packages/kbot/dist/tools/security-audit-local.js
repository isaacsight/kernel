// security-audit-local — substrate for the local-vulnerability-hunt skill family.
//
// Walks a local source tree and builds a "surface map" of sites that are
// disproportionately likely to harbor security issues: subprocess sinks,
// eval-shaped sites, route handlers, crypto usage, FS write paths. The map
// is the input the agent (with a BYOK frontier model) reasons over.
//
// Persists every walk to ~/.kbot/security-audits/<session>/surface.jsonl
// so the audit trail outlives the chat. Shape mirrors forecast-summary.ts
// — pure substrate, no LLM call from this file.
//
// MIT, BYOK, local-first. The Mythos posture, democratized.
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, existsSync, } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
const ALL = new Set(['ts', 'tsx', 'js', 'mjs', 'cjs', 'jsx', 'py', 'go', 'rs', 'rb', 'java', 'php', 'sh']);
const JS = new Set(['ts', 'tsx', 'js', 'mjs', 'cjs', 'jsx']);
const PY = new Set(['py']);
const SHELL = new Set(['sh', 'bash', 'zsh']);
const PATTERNS = [
    // Eval-shaped sinks — top-tier red flag in any language.
    { category: 'eval-sink', severity: 'HIGH', regex: /\beval\s*\(/g, langs: ALL },
    { category: 'function-constructor', severity: 'HIGH', regex: /\bnew\s+Function\s*\(/g, langs: JS },
    { category: 'vm-sandbox', severity: 'MEDIUM', regex: /\bvm\.(runInContext|runInNewContext|runInThisContext|createContext)\s*\(/g, langs: JS },
    { category: 'dynamic-require', severity: 'MEDIUM', regex: /\brequire\s*\(\s*[^'"]/g, langs: JS },
    { category: 'dynamic-import', severity: 'MEDIUM', regex: /\bimport\s*\(\s*[^'"]/g, langs: JS },
    // Subprocess / shell-out sinks.
    { category: 'shell-exec', severity: 'HIGH', regex: /\b(child_process\.)?(exec|execSync)\s*\(/g, langs: JS },
    { category: 'spawn', severity: 'MEDIUM', regex: /\b(child_process\.)?(spawn|spawnSync)\s*\(/g, langs: JS },
    { category: 'os-system', severity: 'HIGH', regex: /\bos\.system\s*\(/g, langs: PY },
    { category: 'subprocess-shell-true', severity: 'HIGH', regex: /\bsubprocess\.[a-zA-Z_]+\([^)]*shell\s*=\s*True/g, langs: PY },
    { category: 'shell-eval', severity: 'HIGH', regex: /\beval\s+["'$]/g, langs: SHELL },
    // HTTP route registration — surfaces user input boundaries.
    { category: 'express-route', severity: 'INFO', regex: /\b(app|router)\.(get|post|put|delete|patch|all)\s*\(/g, langs: JS },
    { category: 'fastify-route', severity: 'INFO', regex: /\bfastify\.(get|post|put|delete|patch|route)\s*\(/g, langs: JS },
    { category: 'flask-route', severity: 'INFO', regex: /@(app|blueprint)\.route\s*\(/g, langs: PY },
    { category: 'django-url', severity: 'INFO', regex: /\bpath\s*\(\s*['"][^'"]+['"]\s*,/g, langs: PY },
    // Crypto smells.
    { category: 'weak-hash-md5', severity: 'MEDIUM', regex: /\b(createHash|hashlib\.md5|md5)\s*\(\s*['"]?md5/gi, langs: ALL },
    { category: 'weak-hash-sha1', severity: 'LOW', regex: /\b(createHash|hashlib\.sha1)\s*\(\s*['"]?sha1/gi, langs: ALL },
    { category: 'predictable-random', severity: 'MEDIUM', regex: /\bMath\.random\s*\(/g, langs: JS },
    { category: 'jwt-sign-none', severity: 'HIGH', regex: /\balgorithm\s*[:=]\s*['"]none['"]/gi, langs: ALL },
    { category: 'jwt-verify-skip', severity: 'HIGH', regex: /\bverify\s*[:=]\s*false/g, langs: JS },
    // SQL — string concat near query.
    { category: 'sql-concat', severity: 'HIGH', regex: /(query|execute)\s*\(\s*[`'"][^`'"]*\$\{/g, langs: ALL },
    // FS write near user-controlled path heuristic.
    { category: 'fs-write', severity: 'INFO', regex: /\b(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream)\s*\(/g, langs: JS },
    { category: 'path-join-userinput', severity: 'MEDIUM', regex: /\bpath\.join\s*\([^)]*req\.(body|query|params)/g, langs: JS },
    // Disabled TLS verification — almost never correct.
    { category: 'tls-reject-unauthorized', severity: 'HIGH', regex: /rejectUnauthorized\s*:\s*false/g, langs: JS },
    { category: 'requests-verify-false', severity: 'HIGH', regex: /\bverify\s*=\s*False\b/g, langs: PY },
    // Hardcoded comparisons of secrets — not constant-time.
    { category: 'non-constant-time-compare', severity: 'MEDIUM', regex: /\b(token|secret|password|apiKey)\b\s*===?\s*['"`]/gi, langs: JS },
];
const DEFAULT_EXCLUDES = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    '.svelte-kit',
    'coverage',
    'vendor',
    '__pycache__',
    '.venv',
    'venv',
    'target',
    '.turbo',
    '.cache',
]);
const MAX_FILE_BYTES = 1_000_000; // 1MB — anything bigger is generated or binary
const MAX_FILES = 5_000; // hard cap to keep walks bounded
const MAX_SIGNALS = 2_000; // truncate output beyond this
function ext(path) {
    const dot = path.lastIndexOf('.');
    if (dot < 0)
        return '';
    return path.slice(dot + 1).toLowerCase();
}
function isTextSource(path) {
    return ALL.has(ext(path));
}
function* walk(root, excludes) {
    const stack = [root];
    let count = 0;
    while (stack.length > 0 && count < MAX_FILES) {
        const dir = stack.pop();
        let entries;
        try {
            entries = readdirSync(dir);
        }
        catch {
            continue;
        }
        for (const name of entries) {
            if (excludes.has(name))
                continue;
            const full = join(dir, name);
            let st;
            try {
                st = statSync(full);
            }
            catch {
                continue;
            }
            if (st.isDirectory()) {
                stack.push(full);
            }
            else if (st.isFile() && isTextSource(full) && st.size <= MAX_FILE_BYTES) {
                count++;
                yield full;
                if (count >= MAX_FILES)
                    return;
            }
        }
    }
}
function lineNumberAt(text, idx) {
    let n = 1;
    for (let i = 0; i < idx && i < text.length; i++) {
        if (text.charCodeAt(i) === 10)
            n++;
    }
    return n;
}
function excerpt(text, idx, max = 160) {
    const start = Math.max(0, idx - 20);
    const end = Math.min(text.length, idx + max);
    return text.slice(start, end).replace(/\s+/g, ' ').trim();
}
function scanFile(path, rel, body) {
    const lang = ext(path);
    const out = [];
    for (const p of PATTERNS) {
        if (!p.langs.has(lang))
            continue;
        p.regex.lastIndex = 0;
        let m;
        while ((m = p.regex.exec(body)) !== null) {
            out.push({
                id: `S-${out.length + 1}`,
                category: p.category,
                severity: p.severity,
                file: rel,
                line: lineNumberAt(body, m.index),
                excerpt: excerpt(body, m.index),
                pattern: p.regex.source,
                ts: Date.now(),
            });
            if (m.index === p.regex.lastIndex)
                p.regex.lastIndex++;
        }
    }
    return out;
}
const SEV_RANK = {
    INFO: 0,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
};
function gteFloor(sig, floor) {
    return SEV_RANK[sig] >= SEV_RANK[floor];
}
export function buildSurfaceMap(opts) {
    const target = resolve(opts.target);
    if (!existsSync(target)) {
        throw new Error(`security_audit_local: target does not exist: ${target}`);
    }
    const stat = statSync(target);
    if (!stat.isDirectory()) {
        throw new Error(`security_audit_local: target is not a directory: ${target}`);
    }
    const excludes = new Set([...DEFAULT_EXCLUDES, ...(opts.excludes ?? [])]);
    const floor = opts.severityFloor ?? 'INFO';
    const sessionId = opts.sessionId ?? `audit-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const map = {
        sessionId,
        target,
        startedAt: Date.now(),
        filesWalked: 0,
        bytesRead: 0,
        signals: [],
        skipped: [],
    };
    for (const file of walk(target, excludes)) {
        let body;
        try {
            body = readFileSync(file, 'utf8');
        }
        catch (err) {
            map.skipped.push({ path: relative(target, file), reason: err.message });
            continue;
        }
        map.filesWalked++;
        map.bytesRead += body.length;
        const rel = relative(target, file) || file;
        const sigs = scanFile(file, rel, body);
        for (const s of sigs) {
            if (!gteFloor(s.severity, floor))
                continue;
            map.signals.push(s);
            if (map.signals.length >= MAX_SIGNALS)
                break;
        }
        if (map.signals.length >= MAX_SIGNALS) {
            map.skipped.push({ path: '<remaining>', reason: `signal cap ${MAX_SIGNALS} reached` });
            break;
        }
    }
    // Renumber signal IDs across the whole walk for stable references.
    map.signals.forEach((s, i) => {
        s.id = `${sessionId}#${(i + 1).toString().padStart(4, '0')}`;
    });
    return map;
}
function auditDir() {
    return process.env.KBOT_SECURITY_AUDIT_DIR ?? join(homedir(), '.kbot', 'security-audits');
}
export function persistSurfaceMap(map, baseDir = auditDir()) {
    const dir = join(baseDir, map.sessionId);
    mkdirSync(dir, { recursive: true });
    const surfacePath = join(dir, 'surface.jsonl');
    const body = map.signals.map((s) => JSON.stringify(s)).join('\n') + (map.signals.length > 0 ? '\n' : '');
    writeFileSync(surfacePath, body, 'utf8');
    const metaPath = join(dir, 'meta.json');
    writeFileSync(metaPath, JSON.stringify({
        sessionId: map.sessionId,
        target: map.target,
        startedAt: map.startedAt,
        filesWalked: map.filesWalked,
        bytesRead: map.bytesRead,
        signalCount: map.signals.length,
        skipped: map.skipped,
    }, null, 2), 'utf8');
    return dir;
}
function counts(map) {
    const c = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    for (const s of map.signals)
        c[s.severity]++;
    return c;
}
function topByCategory(map, n) {
    const byCat = new Map();
    for (const s of map.signals) {
        const arr = byCat.get(s.category) ?? [];
        arr.push(s);
        byCat.set(s.category, arr);
    }
    return [...byCat.entries()]
        .map(([category, sigs]) => ({
        category,
        count: sigs.length,
        top: sigs.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity])[0] ?? null,
    }))
        .sort((a, b) => b.count - a.count)
        .slice(0, n);
}
export function renderSurfaceMap(map, persistedTo) {
    const c = counts(map);
    const top = topByCategory(map, 10);
    const lines = [];
    lines.push(`# security_audit_local — surface map`);
    lines.push('');
    lines.push(`- target: \`${map.target}\``);
    lines.push(`- session: \`${map.sessionId}\``);
    lines.push(`- files walked: ${map.filesWalked}`);
    lines.push(`- bytes read: ${map.bytesRead.toLocaleString()}`);
    lines.push(`- signals: ${map.signals.length}`);
    lines.push('');
    lines.push(`| severity | count |`);
    lines.push(`|---|---|`);
    lines.push(`| CRITICAL | ${c.CRITICAL} |`);
    lines.push(`| HIGH | ${c.HIGH} |`);
    lines.push(`| MEDIUM | ${c.MEDIUM} |`);
    lines.push(`| LOW | ${c.LOW} |`);
    lines.push(`| INFO | ${c.INFO} |`);
    lines.push('');
    if (top.length > 0) {
        lines.push(`## Top categories`);
        lines.push('');
        lines.push(`| category | count | example |`);
        lines.push(`|---|---|---|`);
        for (const t of top) {
            const ex = t.top ? `${t.top.file}:${t.top.line} (${t.top.severity})` : '—';
            lines.push(`| ${t.category} | ${t.count} | ${ex} |`);
        }
        lines.push('');
    }
    lines.push(`Audit trail: \`${persistedTo}\``);
    lines.push('');
    lines.push(`Next: feed signals to your BYOK frontier model phase by phase. See the \`local-vulnerability-hunt\` skill for the full workflow.`);
    return lines.join('\n');
}
export function runSecurityAuditLocal(opts) {
    const map = buildSurfaceMap({
        target: opts.target,
        severityFloor: opts.severityFloor,
        excludes: opts.excludes,
    });
    const persistedTo = persistSurfaceMap(map, opts.baseDir);
    const markdown = renderSurfaceMap(map, persistedTo);
    return { map, persistedTo, markdown };
}
function parseSeverity(v) {
    if (typeof v !== 'string')
        return undefined;
    const up = v.toUpperCase();
    if (up === 'CRITICAL' || up === 'HIGH' || up === 'MEDIUM' || up === 'LOW' || up === 'INFO')
        return up;
    return undefined;
}
function parseExcludes(v) {
    if (Array.isArray(v))
        return v.filter((x) => typeof x === 'string');
    if (typeof v === 'string' && v.length > 0)
        return v.split(',').map((s) => s.trim()).filter(Boolean);
    return undefined;
}
export const securityAuditLocalTool = {
    name: 'security_audit_local',
    description: 'Walk a local source tree and build a surface map of likely-risky sites (subprocess sinks, eval-shaped calls, route handlers, crypto smells, FS writes, TLS-skip flags). Persists JSONL audit trail under ~/.kbot/security-audits/<session>/. Substrate for the local-vulnerability-hunt skill family. Local-only; never phones home.',
    parameters: {
        target: {
            type: 'string',
            description: 'Absolute or relative directory to scan.',
            required: true,
        },
        severity_floor: {
            type: 'string',
            description: 'Minimum severity to include: INFO | LOW | MEDIUM | HIGH | CRITICAL. Default INFO.',
            required: false,
        },
        excludes: {
            type: 'string',
            description: 'Comma-separated extra directory names to skip (in addition to node_modules, dist, .git, etc.).',
            required: false,
        },
    },
    tier: 'free',
    async execute(args) {
        const target = typeof args.target === 'string' ? args.target : '';
        if (!target)
            return 'Error: target is required.';
        try {
            const { markdown } = runSecurityAuditLocal({
                target,
                severityFloor: parseSeverity(args.severity_floor),
                excludes: parseExcludes(args.excludes),
            });
            return markdown;
        }
        catch (e) {
            return `Error: ${e.message}`;
        }
    },
};
//# sourceMappingURL=security-audit-local.js.map