#!/usr/bin/env node
// Claude Code → kbot Observer Hook
// Logs every tool call to ~/.kbot/observer/session.jsonl
// kbot ingests this to learn patterns, tool sequences, and workflows

const fs = require('fs');
const path = require('path');
const os = require('os');

const OBSERVER_DIR = path.join(os.homedir(), '.kbot', 'observer');
const LOG_FILE = path.join(OBSERVER_DIR, 'session.jsonl');

// Ensure directory exists
if (!fs.existsSync(OBSERVER_DIR)) {
  fs.mkdirSync(OBSERVER_DIR, { recursive: true });
}

// Read tool call info from environment (Claude Code hook env vars)
const toolName = process.env.CLAUDE_TOOL_NAME || process.env.TOOL_NAME || 'unknown';
const filePath = process.env.CLAUDE_FILE_PATH || '';
const toolInput = process.env.CLAUDE_TOOL_INPUT || '{}';

// Parse tool input safely
let args = {};
try {
  args = JSON.parse(toolInput);
} catch {
  args = { raw: toolInput.slice(0, 200) };
}

// Build observation entry
const entry = {
  ts: new Date().toISOString(),
  tool: toolName,
  args: {
    // Only capture non-sensitive fields
    file_path: args.file_path || args.path || filePath || undefined,
    command: args.command ? args.command.slice(0, 200) : undefined,
    pattern: args.pattern || undefined,
    query: args.query || undefined,
    description: args.description || undefined,
  },
  session: process.env.CLAUDE_SESSION_ID || `session-${new Date().toISOString().slice(0, 10)}`,
};

// Remove undefined values
Object.keys(entry.args).forEach(k => {
  if (entry.args[k] === undefined) delete entry.args[k];
});

// Append to log
try {
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');

  // Auto-ingest every 50 tool calls — kbot learns mid-session
  const lineCount = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean).length;
  const cursorFile = path.join(OBSERVER_DIR, 'cursor.json');
  let lastIngested = 0;
  try {
    if (fs.existsSync(cursorFile)) {
      lastIngested = JSON.parse(fs.readFileSync(cursorFile, 'utf8')).offset || 0;
    }
  } catch {}

  if (lineCount - lastIngested >= 50) {
    const { execSync } = require('child_process');
    try {
      execSync('kbot observe 2>/dev/null', { timeout: 10000, stdio: 'pipe' });
    } catch {}
  }
} catch (err) {
  // Silent fail — observing should never break the main workflow
}
