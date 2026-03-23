import { loadSession } from './sessions.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
/**
 * Convert a session to readable Markdown format.
 */
export function exportToMarkdown(sessionId) {
    const session = loadSession(sessionId);
    if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
    }
    const agentLabel = session.agent ?? 'kernel';
    const created = new Date(session.created).toLocaleString();
    const lines = [
        `# kbot Session: ${session.name}`,
        `> Created: ${created} | Turns: ${session.turnCount} | Agent: ${agentLabel}`,
        '',
    ];
    if (session.notes) {
        lines.push(`> Notes: ${session.notes}`, '');
    }
    lines.push('---', '');
    for (const turn of session.history) {
        if (turn.role === 'user') {
            lines.push('## User', '', turn.content, '', '---', '');
        }
        else {
            lines.push('## kbot', '', turn.content, '', '---', '');
        }
    }
    return lines.join('\n');
}
/**
 * Export a session as formatted JSON.
 */
export function exportToJSON(sessionId) {
    const session = loadSession(sessionId);
    if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
    }
    return JSON.stringify(session, null, 2);
}
/**
 * Export a session as a standalone HTML page with embedded styling.
 */
export function exportToHTML(sessionId) {
    const session = loadSession(sessionId);
    if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
    }
    const agentLabel = session.agent ?? 'kernel';
    const created = new Date(session.created).toLocaleString();
    const escapedName = escapeHTML(session.name);
    const notesBlock = session.notes
        ? `<p class="meta-notes">Notes: ${escapeHTML(session.notes)}</p>`
        : '';
    const turnsHTML = session.history
        .map((turn) => {
        const roleClass = turn.role === 'user' ? 'msg-user' : 'msg-assistant';
        const roleLabel = turn.role === 'user' ? 'User' : 'kbot';
        const contentHTML = formatContentHTML(turn.content);
        return `
      <div class="message ${roleClass}">
        <div class="message-role">${roleLabel}</div>
        <div class="message-content">${contentHTML}</div>
      </div>`;
    })
        .join('\n');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>kbot Session: ${escapedName}</title>
<style>
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: 'Courier New', Courier, monospace;
    background: #0d1117;
    color: #c9d1d9;
    line-height: 1.6;
    padding: 0;
    margin: 0;
  }

  .container {
    max-width: 820px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }

  .header {
    border-bottom: 1px solid #30363d;
    padding-bottom: 1.5rem;
    margin-bottom: 2rem;
  }

  .header h1 {
    font-size: 1.5rem;
    color: #e6edf3;
    margin-bottom: 0.5rem;
  }

  .meta {
    font-size: 0.85rem;
    color: #8b949e;
  }

  .meta span {
    margin-right: 1.5rem;
  }

  .meta-notes {
    font-size: 0.85rem;
    color: #8b949e;
    margin-top: 0.5rem;
    font-style: italic;
  }

  .message {
    margin-bottom: 1.5rem;
    padding: 1rem 1.25rem;
    border-radius: 6px;
    border: 1px solid #30363d;
  }

  .msg-user {
    background: #161b22;
  }

  .msg-assistant {
    background: #1c2333;
    border-color: #3b4a6b;
  }

  .message-role {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 0.5rem;
  }

  .msg-user .message-role {
    color: #58a6ff;
  }

  .msg-assistant .message-role {
    color: #a78bfa;
  }

  .message-content {
    white-space: pre-wrap;
    word-wrap: break-word;
    font-size: 0.9rem;
  }

  .message-content code {
    background: #282c34;
    padding: 0.15em 0.4em;
    border-radius: 3px;
    font-size: 0.85em;
  }

  .message-content pre {
    background: #1a1e24;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 1rem;
    overflow-x: auto;
    margin: 0.75rem 0;
  }

  .message-content pre code {
    background: none;
    padding: 0;
    font-size: 0.85em;
  }

  .footer {
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 1px solid #30363d;
    font-size: 0.75rem;
    color: #484f58;
    text-align: center;
  }

  @media (max-width: 600px) {
    .container {
      padding: 1rem;
    }

    .header h1 {
      font-size: 1.2rem;
    }

    .message {
      padding: 0.75rem 1rem;
    }
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>kbot Session: ${escapedName}</h1>
    <div class="meta">
      <span>Created: ${escapeHTML(created)}</span>
      <span>Turns: ${session.turnCount}</span>
      <span>Agent: ${escapeHTML(agentLabel)}</span>
    </div>
    ${notesBlock}
  </div>

  <div class="messages">
    ${turnsHTML}
  </div>

  <div class="footer">
    Exported from kbot by kernel.chat group
  </div>
</div>
</body>
</html>`;
}
/**
 * Main export function. Converts a session to the specified format
 * and optionally writes it to disk.
 *
 * @returns The exported content as a string.
 */
export function exportSession(sessionId, format, outputPath) {
    let content;
    switch (format) {
        case 'md':
            content = exportToMarkdown(sessionId);
            break;
        case 'json':
            content = exportToJSON(sessionId);
            break;
        case 'html':
            content = exportToHTML(sessionId);
            break;
        default:
            throw new Error(`Unsupported export format: ${format}`);
    }
    if (outputPath) {
        const resolvedPath = join(process.cwd(), outputPath);
        mkdirSync(dirname(resolvedPath), { recursive: true });
        writeFileSync(resolvedPath, content, 'utf-8');
    }
    return content;
}
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
/**
 * Lightweight markdown-to-HTML for message content.
 * Handles fenced code blocks and inline code while escaping the rest.
 */
function formatContentHTML(raw) {
    const segments = [];
    const codeBlockRe = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    while ((match = codeBlockRe.exec(raw)) !== null) {
        // Text before the code block
        if (match.index > lastIndex) {
            segments.push(formatInlineCode(escapeHTML(raw.slice(lastIndex, match.index))));
        }
        const lang = match[1] ? ` data-lang="${escapeHTML(match[1])}"` : '';
        segments.push(`<pre><code${lang}>${escapeHTML(match[2])}</code></pre>`);
        lastIndex = match.index + match[0].length;
    }
    // Remaining text after the last code block
    if (lastIndex < raw.length) {
        segments.push(formatInlineCode(escapeHTML(raw.slice(lastIndex))));
    }
    return segments.join('');
}
/**
 * Replace inline `code` spans (already HTML-escaped) with <code> tags.
 */
function formatInlineCode(escaped) {
    return escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
}
//# sourceMappingURL=export.js.map