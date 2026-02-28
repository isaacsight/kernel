#!/usr/bin/env node
// Hook: UserPromptSubmit — log all user prompts with timestamps
// Useful for analyzing patterns and debugging sessions

const fs = require('fs');
const path = require('path');

const logFile = path.join(process.cwd(), '.claude', 'prompt-log.txt');
const timestamp = new Date().toISOString();

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
    try {
        const event = JSON.parse(input);
        const prompt = event?.prompt || '[unknown]';
        const truncated = prompt.length > 200 ? prompt.slice(0, 200) + '...' : prompt;

        // Redact anything that looks like an API key before writing to disk
        const redacted = truncated
            .replace(/AIza[A-Za-z0-9_-]{30,}/g, '[REDACTED_KEY]')
            .replace(/sk-ant-[A-Za-z0-9_-]{20,}/g, '[REDACTED_KEY]')
            .replace(/sk-proj-[A-Za-z0-9_-]{20,}/g, '[REDACTED_KEY]')
            .replace(/sk_live_[A-Za-z0-9]+/g, '[REDACTED_KEY]')
            .replace(/sk_test_[A-Za-z0-9]+/g, '[REDACTED_KEY]')
            .replace(/whsec_[A-Za-z0-9]+/g, '[REDACTED_KEY]')
            .replace(/ghp_[A-Za-z0-9]{36,}/g, '[REDACTED_KEY]')
            .replace(/re_[A-Za-z0-9]{20,}/g, '[REDACTED_KEY]')
            .replace(/eyJhbGciOi[A-Za-z0-9_-]{50,}/g, '[REDACTED_JWT]');

        const entry = `[${timestamp}] ${redacted}\n`;
        fs.appendFileSync(logFile, entry);
    } catch { }

    process.exit(0); // Always allow
});
