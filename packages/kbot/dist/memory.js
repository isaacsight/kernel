// kbot Memory — Persistent local memory across sessions
// Stored in ~/.kbot/memory/context.md
// Keeps track of accumulated knowledge about the user's projects
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
const MEMORY_DIR = join(homedir(), '.kbot', 'memory');
const CONTEXT_FILE = join(MEMORY_DIR, 'context.md');
const MAX_MEMORY_SIZE = 50_000; // 50KB max — keeps token usage reasonable
function ensureMemoryDir() {
    if (!existsSync(MEMORY_DIR)) {
        mkdirSync(MEMORY_DIR, { recursive: true });
    }
}
/** Load memory context. Returns empty string if none exists. */
export function loadMemory() {
    ensureMemoryDir();
    if (!existsSync(CONTEXT_FILE))
        return '';
    try {
        const content = readFileSync(CONTEXT_FILE, 'utf-8');
        // Truncate if too large (keep the most recent entries)
        if (content.length > MAX_MEMORY_SIZE) {
            const lines = content.split('\n');
            const truncated = lines.slice(-500).join('\n');
            writeFileSync(CONTEXT_FILE, truncated);
            return truncated;
        }
        return content;
    }
    catch {
        return '';
    }
}
/** Append a memory entry. Used by the agent to remember things. */
export function appendMemory(entry) {
    ensureMemoryDir();
    const timestamp = new Date().toISOString().split('T')[0];
    appendFileSync(CONTEXT_FILE, `\n## ${timestamp}\n${entry}\n`);
}
/** Clear all memory */
export function clearMemory() {
    ensureMemoryDir();
    writeFileSync(CONTEXT_FILE, '# kbot Memory\n\nPersistent knowledge across sessions.\n');
}
/** Get memory for inclusion in system prompt */
export function getMemoryPrompt() {
    const memory = loadMemory();
    if (!memory.trim())
        return '';
    return `\n[Persistent Memory]\n${memory}\n`;
}
let sessionHistory = [];
/** Add a turn to session history */
export function addTurn(turn) {
    sessionHistory.push(turn);
    // Keep last 20 turns to control context size
    if (sessionHistory.length > 20) {
        sessionHistory = sessionHistory.slice(-20);
    }
}
/** Get session history */
export function getHistory() {
    return sessionHistory;
}
/** Clear session history */
export function clearHistory() {
    sessionHistory = [];
}
/** Get the previous_messages array for the API */
export function getPreviousMessages() {
    // Send last 16 turns (8 exchanges) — enough context to maintain coherent conversation
    return sessionHistory.slice(-16).map(t => ({ role: t.role, content: t.content }));
}
/** Compact/compress conversation history into a summary.
 *  Keeps the last 4 turns verbatim, summarizes everything before.
 *  This extends session length without losing context.
 */
export function compactHistory() {
    const before = sessionHistory.length;
    if (before <= 4) {
        return { before, after: before, summary: 'History too short to compact.' };
    }
    // Keep last 4 turns verbatim
    const keepVerbatim = sessionHistory.slice(-4);
    const toSummarize = sessionHistory.slice(0, -4);
    // Build a summary of the older turns
    const summaryParts = ['Conversation summary (compacted):'];
    const userMessages = [];
    const assistantTopics = [];
    for (const turn of toSummarize) {
        if (turn.role === 'user') {
            userMessages.push(turn.content.slice(0, 100));
        }
        else {
            // Extract first line or first 100 chars as topic
            const firstLine = turn.content.split('\n')[0].slice(0, 100);
            assistantTopics.push(firstLine);
        }
    }
    if (userMessages.length > 0) {
        summaryParts.push(`User asked about: ${userMessages.join('; ')}`);
    }
    if (assistantTopics.length > 0) {
        summaryParts.push(`Topics covered: ${assistantTopics.join('; ')}`);
    }
    const summaryText = summaryParts.join('\n');
    // Replace history with summary + recent turns
    sessionHistory = [
        { role: 'assistant', content: summaryText },
        ...keepVerbatim,
    ];
    return {
        before,
        after: sessionHistory.length,
        summary: `Compacted ${before} turns → ${sessionHistory.length} (${before - sessionHistory.length} turns summarized)`,
    };
}
/** Restore session history from a saved session */
export function restoreHistory(turns) {
    sessionHistory = [...turns];
    // Keep manageable size
    if (sessionHistory.length > 20) {
        sessionHistory = sessionHistory.slice(-20);
    }
}
//# sourceMappingURL=memory.js.map