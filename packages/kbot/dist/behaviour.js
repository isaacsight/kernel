// kbot Self-Improving Behaviour System
//
// Inspired by Agent Zero's behaviour_adjustment pattern.
// The agent can modify its own rules at runtime, which persist
// across sessions and are injected into the system prompt.
//
// Two behaviour files:
//   ~/.kbot/memory/behaviour.md — general rules
//   ~/.kbot/music-memory/music-behaviour.md — music-specific rules
//
// Rules are human-readable markdown lines:
//   - Always use TypeScript for new files
//   - User prefers terse responses
//   - When making trap beats, use Roland Cloud instruments
//   - Hi-hats should be sparse (max 8th notes)
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { registerTool } from './tools/index.js';
const GENERAL_BEHAVIOUR = join(homedir(), '.kbot', 'memory', 'behaviour.md');
const MUSIC_BEHAVIOUR = join(homedir(), '.kbot', 'music-memory', 'music-behaviour.md');
function ensureFile(path, defaultContent) {
    const dir = join(path, '..');
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    if (!existsSync(path))
        writeFileSync(path, defaultContent);
}
/**
 * Load behaviour rules from a file.
 * Returns an array of rule strings.
 */
export function loadRules(path) {
    ensureFile(path, '# kbot Learned Behaviour\n\n');
    const content = readFileSync(path, 'utf-8');
    return content
        .split('\n')
        .filter(line => line.startsWith('- '))
        .map(line => line.slice(2).trim());
}
/**
 * Save rules to a file.
 */
function saveRules(path, rules, header) {
    const content = `# ${header}\n\n` + rules.map(r => `- ${r}`).join('\n') + '\n';
    writeFileSync(path, content);
}
/**
 * Add a new rule, avoiding exact duplicates.
 * Returns true if the rule was added (not a duplicate).
 */
export function addRule(path, rule, header) {
    const rules = loadRules(path);
    // Check for exact duplicate
    if (rules.some(r => r.toLowerCase() === rule.toLowerCase())) {
        return false;
    }
    // Check for near-duplicate (>80% word overlap)
    const ruleWords = new Set(rule.toLowerCase().split(/\s+/));
    for (const existing of rules) {
        const existingWords = new Set(existing.toLowerCase().split(/\s+/));
        const overlap = [...ruleWords].filter(w => existingWords.has(w)).length;
        const total = new Set([...ruleWords, ...existingWords]).size;
        if (total > 0 && overlap / total > 0.8) {
            // Near duplicate — replace with the newer version
            const idx = rules.indexOf(existing);
            rules[idx] = rule;
            saveRules(path, rules, header);
            return true;
        }
    }
    rules.push(rule);
    // Cap at 50 rules (trim oldest)
    if (rules.length > 50) {
        rules.splice(0, rules.length - 50);
    }
    saveRules(path, rules, header);
    return true;
}
/**
 * Remove a rule by partial match.
 */
export function removeRule(path, search, header) {
    const rules = loadRules(path);
    const lower = search.toLowerCase();
    const idx = rules.findIndex(r => r.toLowerCase().includes(lower));
    if (idx >= 0) {
        rules.splice(idx, 1);
        saveRules(path, rules, header);
        return true;
    }
    return false;
}
// ── Public API ──────────────────────────────────────────────────────
/** Get all general behaviour rules */
export function getGeneralRules() {
    return loadRules(GENERAL_BEHAVIOUR);
}
/** Get all music behaviour rules */
export function getMusicRules() {
    return loadRules(MUSIC_BEHAVIOUR);
}
/** Get all rules combined, formatted for system prompt injection */
export function getBehaviourPrompt() {
    const general = getGeneralRules();
    const music = getMusicRules();
    if (general.length === 0 && music.length === 0)
        return '';
    const lines = ['## Learned Behaviour (self-improving rules)', ''];
    if (general.length > 0) {
        lines.push('### General');
        for (const r of general)
            lines.push(`- ${r}`);
        lines.push('');
    }
    if (music.length > 0) {
        lines.push('### Music Production');
        for (const r of music)
            lines.push(`- ${r}`);
        lines.push('');
    }
    return lines.join('\n');
}
/** Add a general behaviour rule */
export function learnGeneral(rule) {
    return addRule(GENERAL_BEHAVIOUR, rule, 'kbot Learned Behaviour');
}
/** Add a music behaviour rule */
export function learnMusic(rule) {
    return addRule(MUSIC_BEHAVIOUR, rule, 'kbot Music Production Preferences');
}
/** Remove a general rule */
export function forgetGeneral(search) {
    return removeRule(GENERAL_BEHAVIOUR, search, 'kbot Learned Behaviour');
}
/** Remove a music rule */
export function forgetMusic(search) {
    return removeRule(MUSIC_BEHAVIOUR, search, 'kbot Music Production Preferences');
}
// ── Tool Registration ───────────────────────────────────────────────
export function registerBehaviourTools() {
    registerTool({
        name: 'adjust_behaviour',
        description: 'Self-improvement: add or remove a learned behaviour rule. kbot remembers these rules across sessions and applies them automatically. Use this when the user expresses a preference, corrects a mistake, or when you discover a pattern that should persist.',
        parameters: {
            action: { type: 'string', description: '"learn" to add a rule, "forget" to remove one, "list" to show all rules', required: true },
            rule: { type: 'string', description: 'The rule to learn or forget. Be specific and actionable.' },
            domain: { type: 'string', description: '"general" or "music" (default: general)' },
        },
        tier: 'free',
        timeout: 5_000,
        async execute(args) {
            const action = String(args.action).toLowerCase();
            const domain = String(args.domain || 'general').toLowerCase();
            const isMusic = domain === 'music';
            switch (action) {
                case 'learn':
                case 'add': {
                    const rule = String(args.rule || '');
                    if (!rule)
                        return 'No rule provided.';
                    const added = isMusic ? learnMusic(rule) : learnGeneral(rule);
                    return added
                        ? `Learned: "${rule}" — will apply this going forward.`
                        : `Already know this: "${rule}"`;
                }
                case 'forget':
                case 'remove': {
                    const search = String(args.rule || '');
                    if (!search)
                        return 'No search term provided.';
                    const removed = isMusic ? forgetMusic(search) : forgetGeneral(search);
                    return removed
                        ? `Forgot rule matching "${search}".`
                        : `No rule found matching "${search}".`;
                }
                case 'list':
                case 'show': {
                    const rules = isMusic ? getMusicRules() : getGeneralRules();
                    if (rules.length === 0)
                        return `No ${domain} behaviour rules learned yet.`;
                    return `## ${domain === 'music' ? 'Music' : 'General'} Behaviour Rules (${rules.length})\n\n` +
                        rules.map((r, i) => `${i + 1}. ${r}`).join('\n');
                }
                default:
                    return 'Unknown action. Use "learn", "forget", or "list".';
            }
        },
    });
}
//# sourceMappingURL=behaviour.js.map