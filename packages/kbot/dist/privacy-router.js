// kbot Privacy Router — local-first, cloud only when explicitly allowed
//
// Inspired by NemoClaw's privacy router architecture.
// All queries go through this router BEFORE hitting any provider.
//
// Rules:
//   1. Default: everything runs local (Ollama)
//   2. Sensitive content (secrets, personal data, proprietary code) → ALWAYS local
//   3. Cloud only when: user explicitly allows via policy, AND content passes privacy check
//   4. Policy defined in ~/.kbot/policies/privacy.yaml
//
// This is the layer between the user's prompt and the provider.
// It never sends sensitive data to cloud APIs unless the user says so.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
// ── Paths ──
const POLICY_DIR = join(homedir(), '.kbot', 'policies');
const PRIVACY_POLICY_FILE = join(POLICY_DIR, 'privacy.yaml');
const AUDIT_LOG_FILE = join(POLICY_DIR, 'privacy-audit.log');
// ── Default Policy ──
const DEFAULT_POLICY = {
    defaultLevel: 'local-preferred',
    sensitivePatterns: [
        // Secrets & credentials
        'api[_-]?key', 'secret[_-]?key', 'password', 'token',
        'bearer\\s+[a-zA-Z0-9]', 'sk-[a-zA-Z0-9]', 'ghp_[a-zA-Z0-9]',
        'aws[_-]?access', 'aws[_-]?secret',
        // Personal data
        'social\\s*security', 'ssn', 'credit\\s*card', '\\b\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}\\b',
        'date\\s*of\\s*birth', 'passport',
        // Proprietary markers
        'confidential', 'proprietary', 'internal\\s*only', 'do\\s*not\\s*share',
        // .env file contents
        'SUPABASE_SERVICE', 'DATABASE_URL', 'PRIVATE_KEY',
    ],
    allowedCloudHosts: [
        'api.anthropic.com',
        'api.openai.com',
        'generativelanguage.googleapis.com',
        'api.groq.com',
        'api.deepseek.com',
    ],
    privateFilePaths: [
        '.env', '.env.local', '.env.production',
        '*.pem', '*.key', '*.p12',
        '**/credentials*', '**/secrets*',
        '~/.ssh/*', '~/.aws/*',
    ],
    auditLog: true,
};
// ── Policy Loading ──
function ensureDir() {
    if (!existsSync(POLICY_DIR))
        mkdirSync(POLICY_DIR, { recursive: true });
}
/** Load privacy policy from YAML-like config, or return defaults */
export function loadPrivacyPolicy() {
    if (!existsSync(PRIVACY_POLICY_FILE))
        return DEFAULT_POLICY;
    try {
        const content = readFileSync(PRIVACY_POLICY_FILE, 'utf8');
        // Simple YAML-like parser (no dependency needed)
        const policy = { ...DEFAULT_POLICY };
        const levelMatch = content.match(/defaultLevel:\s*(.+)/);
        if (levelMatch)
            policy.defaultLevel = levelMatch[1].trim();
        const auditMatch = content.match(/auditLog:\s*(true|false)/);
        if (auditMatch)
            policy.auditLog = auditMatch[1] === 'true';
        // Parse sensitive patterns list
        const sensSection = content.match(/sensitivePatterns:\n((?:\s+-\s+.+\n?)+)/);
        if (sensSection) {
            policy.sensitivePatterns = sensSection[1]
                .split('\n')
                .map(l => l.replace(/^\s+-\s+/, '').trim())
                .filter(Boolean);
        }
        // Parse allowed cloud hosts
        const hostSection = content.match(/allowedCloudHosts:\n((?:\s+-\s+.+\n?)+)/);
        if (hostSection) {
            policy.allowedCloudHosts = hostSection[1]
                .split('\n')
                .map(l => l.replace(/^\s+-\s+/, '').trim())
                .filter(Boolean);
        }
        // Parse private file paths
        const fileSection = content.match(/privateFilePaths:\n((?:\s+-\s+.+\n?)+)/);
        if (fileSection) {
            policy.privateFilePaths = fileSection[1]
                .split('\n')
                .map(l => l.replace(/^\s+-\s+/, '').trim())
                .filter(Boolean);
        }
        return policy;
    }
    catch {
        return DEFAULT_POLICY;
    }
}
/** Write the default policy file so users can customize it */
export function writeDefaultPolicy() {
    ensureDir();
    const yaml = `# kbot Privacy Policy
# Controls when data can be sent to cloud AI providers vs kept local.
# Edit this file to customize your privacy preferences.

# Options: local-only, local-preferred, cloud-allowed
defaultLevel: local-preferred

# Log all routing decisions to privacy-audit.log
auditLog: true

# Patterns that ALWAYS force local inference (regex)
# If any of these match the prompt or tool args, cloud is blocked.
sensitivePatterns:
  - api[_-]?key
  - secret[_-]?key
  - password
  - token
  - bearer\\s+[a-zA-Z0-9]
  - sk-[a-zA-Z0-9]
  - ghp_[a-zA-Z0-9]
  - aws[_-]?access
  - social\\s*security
  - credit\\s*card
  - confidential
  - proprietary
  - SUPABASE_SERVICE
  - DATABASE_URL
  - PRIVATE_KEY

# Cloud API hosts allowed (only used when defaultLevel is cloud-allowed)
allowedCloudHosts:
  - api.anthropic.com
  - api.openai.com
  - generativelanguage.googleapis.com
  - api.groq.com
  - api.deepseek.com

# File paths that are always treated as private (glob patterns)
privateFilePaths:
  - .env
  - .env.local
  - .env.production
  - "*.pem"
  - "*.key"
  - "**/credentials*"
  - "**/secrets*"
`;
    writeFileSync(PRIVACY_POLICY_FILE, yaml);
}
// ── Sensitive Content Detection ──
/** Check if content contains sensitive patterns */
export function detectSensitiveContent(content, policy) {
    const matches = [];
    for (const pattern of policy.sensitivePatterns) {
        try {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(content)) {
                matches.push(pattern);
            }
        }
        catch { /* invalid regex — skip */ }
    }
    return { sensitive: matches.length > 0, matches };
}
/** Check if a file path is private */
export function isPrivateFilePath(filePath, policy) {
    const normalized = filePath.toLowerCase();
    for (const pattern of policy.privateFilePaths) {
        const p = pattern.toLowerCase();
        if (p.startsWith('**/')) {
            if (normalized.includes(p.slice(3)))
                return true;
        }
        else if (p.startsWith('*.')) {
            if (normalized.endsWith(p.slice(1)))
                return true;
        }
        else {
            if (normalized.endsWith(p) || normalized.includes(`/${p}`))
                return true;
        }
    }
    return false;
}
// ── Core: Route Decision ──
/**
 * Decide whether a prompt/tool call should go to local or cloud.
 * This is called BEFORE every inference request.
 */
export function routeForPrivacy(content, policy, options) {
    const p = policy || loadPrivacyPolicy();
    // Force overrides
    if (options?.forceLocal) {
        return { target: 'local', reason: 'Forced local by flag', sensitiveDetected: false, matchedPatterns: [] };
    }
    // Local-only mode — never send anything to cloud
    if (p.defaultLevel === 'local-only') {
        return { target: 'local', reason: 'Policy: local-only mode', sensitiveDetected: false, matchedPatterns: [] };
    }
    // Check for sensitive content
    const check = detectSensitiveContent(content, p);
    if (check.sensitive) {
        return {
            target: 'local',
            reason: `Sensitive content detected: ${check.matches.join(', ')}`,
            sensitiveDetected: true,
            matchedPatterns: check.matches,
        };
    }
    // Check file paths
    if (options?.filePaths) {
        for (const fp of options.filePaths) {
            if (isPrivateFilePath(fp, p)) {
                return {
                    target: 'local',
                    reason: `Private file path: ${fp}`,
                    sensitiveDetected: true,
                    matchedPatterns: [fp],
                };
            }
        }
    }
    // Cloud-allowed mode — cloud is ok if content passes
    if (p.defaultLevel === 'cloud-allowed' || options?.forceCloud) {
        return { target: 'cloud', reason: 'Content passed privacy check', sensitiveDetected: false, matchedPatterns: [] };
    }
    // Local-preferred — use local unless local is unavailable
    return { target: 'local', reason: 'Policy: local-preferred', sensitiveDetected: false, matchedPatterns: [] };
}
// ── Audit Logging ──
export function logRoutingDecision(decision, prompt) {
    const policy = loadPrivacyPolicy();
    if (!policy.auditLog)
        return;
    ensureDir();
    const entry = `[${new Date().toISOString()}] ${decision.target.toUpperCase()} | ${decision.reason} | prompt: ${prompt.slice(0, 80).replace(/\n/g, ' ')}${decision.matchedPatterns.length > 0 ? ` | matches: ${decision.matchedPatterns.join(',')}` : ''}\n`;
    try {
        const { appendFileSync } = require('node:fs');
        appendFileSync(AUDIT_LOG_FILE, entry);
    }
    catch { /* non-critical */ }
}
export { DEFAULT_POLICY, PRIVACY_POLICY_FILE };
//# sourceMappingURL=privacy-router.js.map