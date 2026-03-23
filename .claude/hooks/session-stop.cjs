#!/usr/bin/env node
// Hook: Stop — log session summary + auto-ingest kbot observations
// Appends a timestamped entry to .claude/session-log.txt
// Then triggers kbot observe to ingest everything Claude did this session

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const logFile = path.join(process.cwd(), '.claude', 'session-log.txt');
const timestamp = new Date().toISOString();

// Read stdin for stop event data
let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
    const entry = `[${timestamp}] Session ended\n`;

    // Append to session log
    fs.appendFileSync(logFile, entry);

    // Auto-ingest: kbot learns from everything Claude Code did this session
    try {
        execSync('kbot observe 2>/dev/null', { timeout: 10000, stdio: 'pipe' });
    } catch {
        // Silent fail — kbot may not be installed globally, that's fine
    }

    // Output nothing — Stop hooks don't inject context
    process.exit(0);
});
