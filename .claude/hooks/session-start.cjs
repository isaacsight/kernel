#!/usr/bin/env node
// Hook: SessionStart — inject session context from SCRATCHPAD.md
// Outputs text that gets added to Claude's context at session start

const fs = require('fs');
const path = require('path');

const scratchpad = path.join(process.cwd(), 'SCRATCHPAD.md');
const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

let output = `📅 ${today}\n`;

// Load scratchpad if it exists
if (fs.existsSync(scratchpad)) {
    const content = fs.readFileSync(scratchpad, 'utf-8');
    if (content.trim()) {
        output += `\n📋 Previous session context:\n${content}\n`;
    }
}

// Show git status summary
const { execSync } = require('child_process');
try {
    const status = execSync('git status --short 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (status) {
        const lines = status.split('\n');
        output += `\n🔀 ${lines.length} uncommitted change(s)\n`;
    }
} catch { }

process.stdout.write(output);
