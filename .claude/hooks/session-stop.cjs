#!/usr/bin/env node
// Hook: Stop — log session summary after Claude finishes
// Appends a timestamped entry to .claude/session-log.txt

const fs = require('fs');
const path = require('path');

const logFile = path.join(process.cwd(), '.claude', 'session-log.txt');
const timestamp = new Date().toISOString();

// Read stdin for stop event data
let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
    const entry = `[${timestamp}] Session ended\n`;

    // Append to session log
    fs.appendFileSync(logFile, entry);

    // Output nothing — Stop hooks don't inject context
    process.exit(0);
});
