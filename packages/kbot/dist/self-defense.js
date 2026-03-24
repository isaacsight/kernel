// kbot Self-Defense — Hardening against AI agent attack vectors
//
// 2026 threat landscape for AI agents:
//   1. MEMORY INJECTION — poisoned data corrupts long-term memory
//   2. PROMPT INJECTION — crafted inputs hijack agent behavior
//   3. SUPPLY CHAIN — compromised tools/plugins execute malicious code
//   4. KNOWLEDGE POISONING — false facts stored, influence future decisions
//   5. TOOL ABUSE — agent tricked into executing harmful commands
//
// This module provides:
//   - Memory integrity verification (HMAC-SHA256 on all stored data)
//   - Prompt injection detection (pattern matching + heuristics)
//   - Knowledge sanitization (filter before storage)
//   - Forge tool verification (signature + sandbox checks)
//   - Anomaly detection on learning patterns
//   - Self-defense audit report
import { createHmac, createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
const KBOT_DIR = join(homedir(), '.kbot');
const MEMORY_DIR = join(KBOT_DIR, 'memory');
const DEFENSE_DIR = join(KBOT_DIR, 'defense');
const INTEGRITY_FILE = join(DEFENSE_DIR, 'integrity.json');
const INCIDENT_LOG = join(DEFENSE_DIR, 'incidents.json');
function ensureDir(dir) {
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
}
// ── 1. Memory Integrity (HMAC-SHA256) ──
// Every memory file gets an HMAC signature. If the file changes
// without going through kbot's API, the tampering is detected.
function deriveHmacKey() {
    // Machine-bound key — same derivation as wallet encryption
    const seed = `${homedir()}:${process.env.USER || 'kbot'}:${process.arch}:integrity`;
    return createHash('sha256').update(seed).digest();
}
function hmacSign(content) {
    return createHmac('sha256', deriveHmacKey()).update(content).digest('hex');
}
function loadIntegrity() {
    if (!existsSync(INTEGRITY_FILE))
        return [];
    try {
        return JSON.parse(readFileSync(INTEGRITY_FILE, 'utf-8'));
    }
    catch {
        return [];
    }
}
function saveIntegrity(records) {
    ensureDir(DEFENSE_DIR);
    writeFileSync(INTEGRITY_FILE, JSON.stringify(records, null, 2));
}
/** Sign all memory files — call after every legitimate write */
export function signMemoryFiles() {
    ensureDir(MEMORY_DIR);
    const files = readdirSync(MEMORY_DIR).filter(f => f.endsWith('.json'));
    const records = [];
    for (const file of files) {
        const path = join(MEMORY_DIR, file);
        try {
            const content = readFileSync(path, 'utf-8');
            records.push({
                file,
                hash: hmacSign(content),
                lastVerified: new Date().toISOString(),
            });
        }
        catch { /* skip unreadable */ }
    }
    saveIntegrity(records);
}
/** Verify all memory files — returns list of tampered files */
export function verifyMemoryIntegrity() {
    const records = loadIntegrity();
    const recordMap = new Map(records.map(r => [r.file, r.hash]));
    const results = [];
    if (!existsSync(MEMORY_DIR))
        return [];
    // Check existing files
    const currentFiles = readdirSync(MEMORY_DIR).filter(f => f.endsWith('.json'));
    for (const file of currentFiles) {
        const path = join(MEMORY_DIR, file);
        const expectedHash = recordMap.get(file);
        if (!expectedHash) {
            results.push({ file, status: 'new' });
            continue;
        }
        try {
            const content = readFileSync(path, 'utf-8');
            const actualHash = hmacSign(content);
            results.push({ file, status: actualHash === expectedHash ? 'ok' : 'tampered' });
        }
        catch {
            results.push({ file, status: 'missing' });
        }
        recordMap.delete(file);
    }
    // Check for deleted files
    for (const [file] of recordMap) {
        results.push({ file, status: 'missing' });
    }
    return results;
}
// ── 2. Prompt Injection Detection ──
// Detect attempts to hijack kbot's behavior through crafted inputs.
const INJECTION_PATTERNS = [
    // Direct instruction override
    { name: 'system-prompt-override', pattern: /(?:ignore|forget|disregard)\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions?|prompts?|rules?|context)/i, severity: 'critical' },
    { name: 'role-hijack', pattern: /(?:you are now|act as|pretend to be|your new (?:role|identity|instructions?))\s/i, severity: 'critical' },
    { name: 'instruction-injection', pattern: /\[(?:SYSTEM|INST|INSTRUCTIONS?)\]/i, severity: 'critical' },
    { name: 'delimiter-attack', pattern: /```(?:system|instructions?|prompt)\b/i, severity: 'high' },
    // Memory manipulation
    { name: 'memory-poison', pattern: /(?:remember|memorize|store|learn|save)\s+(?:that|this)?\s*(?:the\s+(?:password|key|secret|token)\s+is|always\s+(?:trust|allow|execute|run))/i, severity: 'critical' },
    { name: 'knowledge-override', pattern: /(?:from now on|henceforth|going forward)\s+(?:always|never)\s+(?:ignore|skip|bypass|disable)\s+(?:security|auth|permission|verification|validation)/i, severity: 'critical' },
    // Tool abuse
    { name: 'tool-escalation', pattern: /(?:run|execute|call|invoke)\s+(?:rm\s+-rf|sudo|chmod\s+777|curl\s+.*\|\s*(?:sh|bash)|wget\s+.*\|\s*(?:sh|bash))/i, severity: 'critical' },
    { name: 'exfiltration', pattern: /(?:send|post|upload|exfil|transmit)\s+(?:all\s+)?(?:files?|data|secrets?|keys?|passwords?|tokens?|env|\.env|config)\s+(?:to|at|via)\s/i, severity: 'critical' },
    // Wallet/financial manipulation
    { name: 'wallet-drain', pattern: /(?:transfer|send|move)\s+(?:all|everything|max|100%)\s+(?:sol|eth|tokens?|funds?|balance)/i, severity: 'critical' },
    { name: 'key-extraction', pattern: /(?:show|display|print|reveal|export|decrypt)\s+(?:private\s+key|seed\s+phrase|secret\s+key|wallet\s+key)/i, severity: 'critical' },
    // Social engineering
    { name: 'urgency-pressure', pattern: /(?:emergency|urgent|immediately|right now|before it's too late)\s+(?:transfer|send|delete|execute|run)/i, severity: 'high' },
    { name: 'authority-spoof', pattern: /(?:i am|this is)\s+(?:the (?:admin|owner|developer|ceo)|from (?:anthropic|openai|google|supabase|stripe))/i, severity: 'high' },
    // Encoding/obfuscation attacks
    { name: 'base64-hidden', pattern: /(?:decode|eval|execute)\s+(?:this\s+)?base64/i, severity: 'high' },
    { name: 'unicode-smuggle', pattern: /[\u200B-\u200F\u2028-\u202F\uFEFF]/, severity: 'medium' },
];
/** Scan a message for prompt injection attempts */
export function detectInjection(message) {
    const threats = [];
    for (const { name, pattern, severity } of INJECTION_PATTERNS) {
        const match = message.match(pattern);
        if (match) {
            threats.push({ name, severity, match: match[0].slice(0, 50) });
        }
    }
    // Heuristic scoring
    let score = 0;
    for (const t of threats) {
        if (t.severity === 'critical')
            score += 0.4;
        else if (t.severity === 'high')
            score += 0.25;
        else
            score += 0.1;
    }
    score = Math.min(score, 1);
    // Additional heuristics
    // Long messages with many instructions are suspicious
    const instructionWords = (message.match(/\b(always|never|must|shall|ignore|forget|override|bypass|skip|disable)\b/gi) || []).length;
    if (instructionWords > 5)
        score += 0.15;
    // Hidden unicode characters
    const hiddenChars = (message.match(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g) || []).length;
    if (hiddenChars > 0)
        score += 0.1 * Math.min(hiddenChars, 5);
    score = Math.min(score, 1);
    const recommendation = score >= 0.5 ? 'block' : score >= 0.2 ? 'warn' : 'allow';
    return {
        detected: threats.length > 0,
        threats,
        score,
        recommendation,
    };
}
// ── 3. Knowledge Sanitization ──
// Filter inputs before they enter the knowledge base.
const KNOWLEDGE_BLOCKLIST = [
    // Secrets that should never be "learned"
    /(?:password|passwd|secret|token|api.?key)\s*(?:is|=|:)\s*\S{8,}/i,
    /(?:sk-|ghp_|gho_|AKIA|xoxb-|npm_)\S{16,}/,
    // Instructions that override security
    /always\s+(?:trust|allow|execute|approve|skip)\s+(?:all|any|every)/i,
    /never\s+(?:check|verify|validate|audit|scan|block)/i,
    /disable\s+(?:security|auth|permission|verification|2fa|mfa)/i,
    // Wallet manipulation rules
    /always\s+(?:send|transfer|approve)\s+(?:funds|tokens?|sol|eth)/i,
    /(?:auto|automatic)\s*(?:approve|confirm|sign)\s+(?:transactions?|swaps?|transfers?)/i,
];
/** Check if a knowledge entry is safe to store */
export function sanitizeKnowledge(fact) {
    for (const pattern of KNOWLEDGE_BLOCKLIST) {
        if (pattern.test(fact)) {
            return { safe: false, reason: `Blocked by security filter: ${pattern.source.slice(0, 40)}` };
        }
    }
    // Length check — extremely long "facts" are suspicious
    if (fact.length > 2000) {
        return { safe: false, reason: 'Knowledge entry too long (>2000 chars) — may contain hidden instructions' };
    }
    // Instruction density check
    const instructionWords = (fact.match(/\b(always|never|must|shall|ignore|override|bypass|skip|disable|execute|run|delete)\b/gi) || []).length;
    const wordCount = fact.split(/\s+/).length;
    if (wordCount > 10 && instructionWords / wordCount > 0.3) {
        return { safe: false, reason: 'High instruction density — looks like an injection, not a fact' };
    }
    return { safe: true };
}
// ── 4. Forge Tool Verification ──
// Verify tools from the forge registry before execution.
const DANGEROUS_PATTERNS_IN_TOOLS = [
    /eval\s*\(/,
    /new\s+Function\s*\(/,
    /child_process/,
    /exec(?:Sync)?\s*\(/,
    /require\s*\(\s*['"](?:child_process|fs|net|http|https|crypto|os|cluster|dgram|dns|tls)/,
    /import\s+.*(?:child_process|exec|spawn)/,
    /process\.env/,
    /Deno\.env/,
    /fetch\s*\(\s*(?!['"]https:\/\/api\.|['"]https:\/\/www\.)/, // fetch to non-standard URLs
    /\.writeFile/,
    /\.unlink/,
    /\.rmdir/,
    /process\.exit/,
];
/** Verify a forged tool's code before registration */
export function verifyForgedTool(code, name) {
    const warnings = [];
    const dangerousPatterns = [];
    for (const pattern of DANGEROUS_PATTERNS_IN_TOOLS) {
        if (pattern.test(code)) {
            dangerousPatterns.push(pattern.source);
        }
    }
    if (dangerousPatterns.length > 0) {
        warnings.push(`Tool "${name}" uses dangerous patterns: ${dangerousPatterns.join(', ')}`);
    }
    // Size check
    if (code.length > 50_000) {
        warnings.push(`Tool "${name}" is unusually large (${code.length} chars) — review carefully`);
    }
    // Obfuscation check
    const obfuscationScore = (code.match(/\\x[0-9a-f]{2}|\\u[0-9a-f]{4}|atob\(|btoa\(/gi) || []).length;
    if (obfuscationScore > 5) {
        warnings.push(`Tool "${name}" contains ${obfuscationScore} encoded/obfuscated segments`);
    }
    return {
        safe: dangerousPatterns.length === 0 && warnings.length === 0,
        warnings,
        dangerousPatterns,
    };
}
export function detectAnomalies() {
    const anomalies = [];
    let score = 0;
    // Check knowledge for suspicious entries
    const knowledgePath = join(MEMORY_DIR, 'knowledge.json');
    if (existsSync(knowledgePath)) {
        try {
            const knowledge = JSON.parse(readFileSync(knowledgePath, 'utf-8'));
            if (Array.isArray(knowledge)) {
                // Check for recent bulk additions (possible injection)
                const recentEntries = knowledge.filter((k) => {
                    const created = new Date(k.created || 0);
                    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
                    return created > hourAgo;
                });
                if (recentEntries.length > 20) {
                    anomalies.push({
                        type: 'bulk-knowledge-addition',
                        description: `${recentEntries.length} knowledge entries added in the last hour — possible injection`,
                        severity: 'high',
                    });
                    score += 0.3;
                }
                // Check for entries with security-override language
                for (const k of knowledge) {
                    const check = sanitizeKnowledge(k.fact || '');
                    if (!check.safe) {
                        anomalies.push({
                            type: 'poisoned-knowledge',
                            description: `Knowledge entry blocked by filter: "${(k.fact || '').slice(0, 50)}..."`,
                            severity: 'critical',
                        });
                        score += 0.3;
                    }
                }
            }
        }
        catch { /* corrupt file */ }
    }
    // Check corrections for manipulation
    const correctionsPath = join(MEMORY_DIR, 'corrections.json');
    if (existsSync(correctionsPath)) {
        try {
            const corrections = JSON.parse(readFileSync(correctionsPath, 'utf-8'));
            if (Array.isArray(corrections)) {
                for (const c of corrections) {
                    const injectionCheck = detectInjection(c.userMessage || '');
                    if (injectionCheck.detected) {
                        anomalies.push({
                            type: 'injected-correction',
                            description: `Correction contains injection pattern: "${(c.userMessage || '').slice(0, 50)}..."`,
                            severity: 'critical',
                        });
                        score += 0.3;
                    }
                }
            }
        }
        catch { /* corrupt */ }
    }
    // Check patterns for impossible success rates
    const patternsPath = join(MEMORY_DIR, 'patterns.json');
    if (existsSync(patternsPath)) {
        try {
            const patterns = JSON.parse(readFileSync(patternsPath, 'utf-8'));
            if (Array.isArray(patterns)) {
                for (const p of patterns) {
                    if (p.successRate === 1.0 && p.hits > 50) {
                        anomalies.push({
                            type: 'suspicious-pattern',
                            description: `Pattern has 100% success rate over ${p.hits} uses — statistically unlikely, may be fabricated`,
                            severity: 'medium',
                        });
                        score += 0.1;
                    }
                }
            }
        }
        catch { /* corrupt */ }
    }
    // Memory integrity check
    const memoryIntegrity = verifyMemoryIntegrity();
    const tampered = memoryIntegrity.filter(m => m.status === 'tampered');
    if (tampered.length > 0) {
        anomalies.push({
            type: 'memory-tampering',
            description: `${tampered.length} memory file(s) modified outside of kbot: ${tampered.map(t => t.file).join(', ')}`,
            severity: 'critical',
        });
        score += 0.4;
    }
    score = Math.min(score, 1);
    return { anomalies, memoryIntegrity, score };
}
function loadIncidents() {
    if (!existsSync(INCIDENT_LOG))
        return [];
    try {
        return JSON.parse(readFileSync(INCIDENT_LOG, 'utf-8'));
    }
    catch {
        return [];
    }
}
function saveIncidents(incidents) {
    ensureDir(DEFENSE_DIR);
    writeFileSync(INCIDENT_LOG, JSON.stringify(incidents.slice(-500), null, 2)); // keep last 500
}
/** Log a security incident */
export function logIncident(type, severity, description, action) {
    const incidents = loadIncidents();
    incidents.push({
        timestamp: new Date().toISOString(),
        type,
        severity,
        description: description.slice(0, 500),
        action,
    });
    saveIncidents(incidents);
}
/** Get recent incidents */
export function getIncidents(limit = 20) {
    return loadIncidents().slice(-limit);
}
export function runDefenseAudit() {
    const integrity = verifyMemoryIntegrity();
    const anomalies = detectAnomalies();
    const incidents = getIncidents(10);
    const integrityStats = {
        total: integrity.length,
        ok: integrity.filter(m => m.status === 'ok').length,
        tampered: integrity.filter(m => m.status === 'tampered').length,
        new: integrity.filter(m => m.status === 'new').length,
        missing: integrity.filter(m => m.status === 'missing').length,
    };
    const recommendations = [];
    if (integrityStats.tampered > 0) {
        recommendations.push(`${integrityStats.tampered} memory file(s) tampered — run \`kbot defense restore\` to rebuild from known-good state`);
    }
    if (integrityStats.new > 0) {
        recommendations.push(`${integrityStats.new} unsigned memory file(s) — run \`kbot defense sign\` to establish baseline`);
    }
    if (anomalies.anomalies.some(a => a.type === 'poisoned-knowledge')) {
        recommendations.push('Poisoned knowledge entries detected — run `kbot defense purge` to remove them');
    }
    if (incidents.some(i => i.severity === 'critical' && i.action === 'blocked')) {
        recommendations.push('Recent critical incidents blocked — review with `kbot defense incidents`');
    }
    const criticalCount = anomalies.anomalies.filter(a => a.severity === 'critical').length + integrityStats.tampered;
    const overallStatus = criticalCount > 0 ? 'compromised' : anomalies.score > 0.2 ? 'warning' : 'secure';
    return {
        memoryIntegrity: integrityStats,
        anomalies,
        recentIncidents: incidents,
        overallStatus,
        recommendations,
    };
}
//# sourceMappingURL=self-defense.js.map