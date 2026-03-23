#!/usr/bin/env node
// Claude Code → kbot Observer Hook (PostToolUse)
// Logs every tool call to ~/.kbot/observer/session.jsonl
// Claude Code passes tool info via stdin JSON

const fs = require('fs');
const path = require('path');
const os = require('os');

const OBSERVER_DIR = path.join(os.homedir(), '.kbot', 'observer');
const LOG_FILE = path.join(OBSERVER_DIR, 'session.jsonl');

if (!fs.existsSync(OBSERVER_DIR)) {
  fs.mkdirSync(OBSERVER_DIR, { recursive: true });
}

// Claude Code hooks receive data via stdin
let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let toolName = 'unknown';
  let args = {};
  let sessionId = `session-${new Date().toISOString().slice(0, 10)}`;

  // Parse stdin JSON from Claude Code
  try {
    const data = JSON.parse(input);
    // Claude Code PostToolUse format: { tool_name, tool_input, tool_output, session_id }
    toolName = data.tool_name || data.toolName || data.name || 'unknown';
    sessionId = data.session_id || data.sessionId || sessionId;

    const toolInput = data.tool_input || data.input || {};
    if (typeof toolInput === 'string') {
      try { args = JSON.parse(toolInput); } catch { args = { raw: toolInput.slice(0, 200) }; }
    } else {
      args = toolInput;
    }
  } catch {
    // Also try env vars as fallback
    toolName = process.env.CLAUDE_TOOL_NAME || process.env.TOOL_NAME || 'unknown';
    try { args = JSON.parse(process.env.CLAUDE_TOOL_INPUT || '{}'); } catch {}
  }

  const entry = {
    ts: new Date().toISOString(),
    tool: toolName,
    args: {
      file_path: args.file_path || args.path || process.env.CLAUDE_FILE_PATH || undefined,
      command: typeof args.command === 'string' ? args.command.slice(0, 200) : undefined,
      pattern: args.pattern || undefined,
      query: args.query || undefined,
      description: args.description || undefined,
    },
    session: sessionId,
  };

  // Remove undefined values
  Object.keys(entry.args).forEach(k => {
    if (entry.args[k] === undefined) delete entry.args[k];
  });

  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');

    // Auto-ingest every 50 tool calls
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
      try { execSync('kbot observe 2>/dev/null', { timeout: 10000, stdio: 'pipe' }); } catch {}
    }
  } catch {}

  process.exit(0);
});
