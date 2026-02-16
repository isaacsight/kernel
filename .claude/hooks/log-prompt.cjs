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

        const entry = `[${timestamp}] ${truncated}\n`;
        fs.appendFileSync(logFile, entry);
    } catch { }

    process.exit(0); // Always allow
});
