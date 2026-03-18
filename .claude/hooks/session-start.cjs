#!/usr/bin/env node
// Hook: SessionStart — inject session context + bootstrap pulse
// Outputs text that gets added to Claude's context at session start

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
try {
    const status = execSync('git status --short 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (status) {
        const lines = status.split('\n');
        output += `\n🔀 ${lines.length} uncommitted change(s)\n`;
    }
} catch { }

// ── Bootstrap Pulse — quick vitals ──
try {
    // Tool count
    const toolCount = execSync('grep -r "registerTool" packages/kbot/src/tools/ 2>/dev/null | wc -l', { encoding: 'utf-8' }).trim();

    // Version
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'packages/kbot/package.json'), 'utf-8'));
    const version = pkg.version;

    // npm downloads (cached, non-blocking)
    let downloads = '?';
    try {
        const dl = execSync('curl -s --max-time 3 "https://api.npmjs.org/downloads/point/last-week/@kernel.chat/kbot" 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
        const parsed = JSON.parse(dl);
        downloads = parsed.downloads?.toLocaleString() || '?';
    } catch { }

    // GitHub stars
    let stars = '?';
    try {
        const gh = execSync('gh api repos/isaacsight/kernel --jq .stargazers_count 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
        stars = gh.trim();
    } catch { }

    // Last bootstrap run
    const logPath = path.join(process.cwd(), 'tools/daemon-reports/bootstrap-log.md');
    let lastBootstrap = 'never';
    if (fs.existsSync(logPath)) {
        const log = fs.readFileSync(logPath, 'utf-8');
        const runs = log.match(/## Bootstrap Run (\d{4}-\d{2}-\d{2})/g);
        if (runs) lastBootstrap = runs[runs.length - 1].replace('## Bootstrap Run ', '');
    }

    output += `\n📊 Bootstrap Pulse:\n`;
    output += `  kbot v${version} | ${toolCount.trim()} tools | ${downloads} downloads/week | ${stars} stars\n`;
    output += `  Last bootstrap: ${lastBootstrap}\n`;

    // Check for stale surfaces (quick)
    const readmeMatch = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf-8').includes(toolCount.trim());
    if (!readmeMatch) {
        output += `  ⚠ README.md may be stale (tool count mismatch)\n`;
    }

    output += `  Run bootstrap: "run the bootstrap agent" | Ship: "run the ship agent"\n`;
} catch { }

process.stdout.write(output);
