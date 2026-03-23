// kbot MCP Apps — Interactive HTML/JS UI components in tool results
//
// MCP Apps (shipped Jan 2026 by Anthropic) extend MCP tools to return HTML
// content that renders as interactive UI. The tool result includes an `html`
// field alongside the regular `text` field.
//
// In terminal mode: opens HTML in default browser via temp file.
// In serve mode:    returns HTML inline for the web client to render in iframe.
//
// Usage:
//   import { isMcpAppResult, renderMcpApp, createMcpApp } from './mcp-apps.js'
//
//   const result = await executeSomeTool(args)
//   if (isMcpAppResult(result)) {
//     await renderMcpApp(result, getAppConfig())
//   }
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir, platform } from 'node:os';
import { execSync } from 'node:child_process';
import { registerTool } from './tools/index.js';
// ── State ──
const appCapableTools = new Map();
// ── Type Guard ──
/**
 * Determine whether a tool result contains MCP App HTML content.
 * Checks for the presence of a non-empty `html` field.
 */
export function isMcpAppResult(result) {
    if (typeof result !== 'object' || result === null)
        return false;
    const r = result;
    return typeof r.text === 'string' && typeof r.html === 'string' && r.html.length > 0;
}
/**
 * Check if a plain text tool result contains embedded MCP App markers.
 * Tools that return a JSON-encoded McpAppResult as their text output
 * use the marker `<!--mcp-app-->` at the start of the html field.
 */
export function extractMcpAppFromText(text) {
    // Try JSON parse if it looks like JSON
    if (text.startsWith('{') && text.includes('"html"')) {
        try {
            const parsed = JSON.parse(text);
            if (isMcpAppResult(parsed))
                return parsed;
        }
        catch { /* not JSON */ }
    }
    return null;
}
// ── Config ──
const DEFAULT_CONFIG = {
    renderMode: 'browser',
    maxHtmlSize: 1_048_576, // 1MB
    sandbox: true,
};
/**
 * Load MCP Apps config from ~/.kbot/config.json, falling back to defaults.
 */
export function getAppConfig() {
    try {
        const configPath = join(homedir(), '.kbot', 'config.json');
        if (!existsSync(configPath))
            return { ...DEFAULT_CONFIG };
        const raw = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(raw);
        const apps = config.mcpApps ?? config.mcp_apps ?? {};
        return {
            renderMode: apps.renderMode ?? apps.render_mode ?? DEFAULT_CONFIG.renderMode,
            maxHtmlSize: apps.maxHtmlSize ?? apps.max_html_size ?? DEFAULT_CONFIG.maxHtmlSize,
            sandbox: apps.sandbox ?? DEFAULT_CONFIG.sandbox,
        };
    }
    catch {
        return { ...DEFAULT_CONFIG };
    }
}
// ── Rendering ──
/**
 * Render an MCP App result based on the config mode.
 *
 * - **browser**: Writes HTML to a temp file and opens it with the system browser.
 * - **inline**: Returns the HTML string wrapped with sandbox attributes for iframe embedding.
 * - **disabled**: Returns just the text, ignoring the HTML.
 *
 * Returns the text portion of the result (always), plus the rendered HTML path/content.
 */
export async function renderMcpApp(result, config) {
    const cfg = config ?? getAppConfig();
    // Enforce size limit
    if (result.html && result.html.length > cfg.maxHtmlSize) {
        return {
            text: result.text,
            rendered: `[MCP App HTML too large: ${(result.html.length / 1024).toFixed(0)}KB exceeds ${(cfg.maxHtmlSize / 1024).toFixed(0)}KB limit]`,
        };
    }
    if (cfg.renderMode === 'disabled' || !result.html) {
        return { text: result.text };
    }
    if (cfg.renderMode === 'browser') {
        return renderInBrowser(result);
    }
    // inline mode
    return renderInline(result, cfg);
}
/**
 * Write HTML to a temp file and open in the default browser.
 */
function renderInBrowser(result) {
    const dir = join(tmpdir(), 'kbot-apps');
    mkdirSync(dir, { recursive: true });
    const slug = (result.title ?? 'app').replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    const filename = `${slug}-${Date.now()}.html`;
    const filepath = join(dir, filename);
    // Wrap in a full HTML document if the content doesn't already have <html>
    const html = result.html;
    const fullHtml = html.trimStart().startsWith('<!') || html.trimStart().startsWith('<html')
        ? html
        : wrapHtmlDocument(html, result.title ?? 'kbot App', result.width, result.height);
    writeFileSync(filepath, fullHtml, 'utf-8');
    // Open in default browser
    try {
        const os = platform();
        if (os === 'darwin') {
            execSync(`open "${filepath}"`, { stdio: 'ignore' });
        }
        else if (os === 'win32') {
            execSync(`start "" "${filepath}"`, { stdio: 'ignore' });
        }
        else {
            // Linux / others
            execSync(`xdg-open "${filepath}"`, { stdio: 'ignore' });
        }
    }
    catch {
        // If open fails, still return the path so the user can open manually
    }
    return { text: result.text, path: filepath };
}
/**
 * Return HTML with sandbox attributes for inline iframe embedding (serve mode).
 */
function renderInline(result, config) {
    const html = result.html;
    const sandboxAttrs = config.sandbox
        ? 'sandbox="allow-scripts allow-same-origin"'
        : '';
    const width = result.width ?? 800;
    const height = result.height ?? 600;
    const iframe = `<div class="mcp-app" data-title="${escapeAttr(result.title ?? 'App')}">` +
        `<iframe srcdoc="${escapeAttr(html)}" ${sandboxAttrs} ` +
        `style="width:${width}px;max-width:100%;height:${height}px;border:1px solid #333;border-radius:8px;" ` +
        `loading="lazy"></iframe>` +
        `</div>`;
    return { text: result.text, rendered: iframe };
}
// ── Helpers ──
function escapeAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function wrapHtmlDocument(body, title, width, height) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #e0e0e0;
      ${width ? `max-width: ${width}px;` : ''}
      ${height ? `min-height: ${height}px;` : ''}
    }
    a { color: #a78bfa; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #333; padding: 8px 12px; text-align: left; }
    th { background: #2a2a3e; color: #c4b5fd; }
    tr:nth-child(even) { background: #1e1e32; }
    pre, code { background: #2a2a3e; border-radius: 4px; padding: 2px 6px; font-family: 'Courier Prime', monospace; }
    pre { padding: 16px; overflow-x: auto; }
    .chart-container { position: relative; width: 100%; max-width: 800px; margin: 0 auto; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}
// ── Tool Creation Helper ──
/**
 * Create an MCP App result object. Use this in tool implementations
 * to return interactive HTML alongside a text summary.
 *
 * @param title   - Title for the app window/tab
 * @param html    - Interactive HTML/JS content
 * @param options - Optional text summary, width, height
 */
export function createMcpApp(title, html, options) {
    return {
        text: options?.text ?? `[MCP App: ${title}]`,
        html,
        title,
        width: options?.width,
        height: options?.height,
    };
}
// ── App-capable Tool Registry ──
/**
 * Mark a tool as MCP App-capable in the registry.
 */
export function registerAppCapableTool(name, description) {
    appCapableTools.set(name, { name, description, supportsApp: true });
}
/**
 * Check if a tool is registered as MCP App-capable.
 */
export function isAppCapableTool(name) {
    return appCapableTools.has(name);
}
/**
 * List all MCP App-capable tools.
 */
export function listAppCapableTools() {
    return Array.from(appCapableTools.values());
}
// ── Built-in MCP App Tools ──
/**
 * Register the built-in tools that return MCP Apps:
 * - render_chart: Chart.js-based charts
 * - render_table: Interactive sortable tables
 * - render_diff:  Side-by-side diff viewer
 * - render_diagram: Mermaid diagram renderer
 */
export function registerMcpAppTools() {
    // ── render_chart ──
    registerTool({
        name: 'render_chart',
        description: 'Render an interactive chart using Chart.js. Returns an MCP App with HTML that can be viewed in a browser. Supports bar, line, pie, doughnut, radar, scatter chart types.',
        parameters: {
            type: { type: 'string', description: 'Chart type: bar, line, pie, doughnut, radar, scatter', required: true },
            title: { type: 'string', description: 'Chart title', required: false },
            labels: { type: 'array', description: 'X-axis labels or category names', required: true, items: { type: 'string' } },
            datasets: { type: 'array', description: 'Array of dataset objects: { label, data: number[], backgroundColor?, borderColor? }', required: true, items: { type: 'object' } },
        },
        tier: 'free',
        async execute(args) {
            const type = String(args.type || 'bar');
            const title = String(args.title || 'Chart');
            const labels = args.labels ?? [];
            const datasets = args.datasets ?? [];
            const chartConfig = JSON.stringify({
                type,
                data: {
                    labels,
                    datasets: datasets.map((ds, i) => ({
                        label: ds.label ?? `Dataset ${i + 1}`,
                        data: ds.data,
                        backgroundColor: ds.backgroundColor ?? CHART_COLORS[i % CHART_COLORS.length] + '80',
                        borderColor: ds.borderColor ?? CHART_COLORS[i % CHART_COLORS.length],
                        borderWidth: 2,
                    })),
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: { display: true, text: title, color: '#e0e0e0', font: { size: 16 } },
                        legend: { labels: { color: '#c0c0c0' } },
                    },
                    scales: ['pie', 'doughnut', 'radar'].includes(type) ? {} : {
                        x: { ticks: { color: '#a0a0a0' }, grid: { color: '#333' } },
                        y: { ticks: { color: '#a0a0a0' }, grid: { color: '#333' } },
                    },
                },
            });
            const html = `
<div class="chart-container">
  <canvas id="chart"></canvas>
</div>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<script>
  new Chart(document.getElementById('chart'), ${chartConfig});
</script>`;
            const app = createMcpApp(title, html, {
                text: `Chart: ${title} (${type}) — ${labels.length} labels, ${datasets.length} datasets`,
                width: 800,
                height: 500,
            });
            return JSON.stringify(app);
        },
    });
    registerAppCapableTool('render_chart', 'Render Chart.js charts as interactive HTML');
    // ── render_table ──
    registerTool({
        name: 'render_table',
        description: 'Render an interactive sortable HTML table. Click column headers to sort. Returns an MCP App with HTML viewable in a browser.',
        parameters: {
            title: { type: 'string', description: 'Table title', required: false },
            columns: { type: 'array', description: 'Column header names', required: true, items: { type: 'string' } },
            rows: { type: 'array', description: 'Array of row arrays, each containing cell values', required: true, items: { type: 'array' } },
        },
        tier: 'free',
        async execute(args) {
            const title = String(args.title || 'Data Table');
            const columns = args.columns ?? [];
            const rows = args.rows ?? [];
            const headerCells = columns.map((col, i) => `<th onclick="sortTable(${i})" style="cursor:pointer">${escapeHtml(String(col))} <span class="sort-arrow">▸</span></th>`).join('');
            const bodyRows = rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(String(cell ?? ''))}</td>`).join('')}</tr>`).join('\n');
            const html = `
<h2 style="color:#c4b5fd;margin-bottom:16px">${escapeHtml(title)}</h2>
<input type="text" id="filter" placeholder="Filter rows..." style="
  width:100%;padding:8px 12px;margin-bottom:12px;background:#2a2a3e;color:#e0e0e0;
  border:1px solid #444;border-radius:6px;font-size:14px;outline:none;
" oninput="filterTable()">
<table id="data-table">
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
<p style="color:#888;font-size:12px;margin-top:8px">${rows.length} rows · Click headers to sort · Type to filter</p>
<script>
let sortDir = {};
function sortTable(col) {
  const tbody = document.querySelector('#data-table tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  sortDir[col] = !sortDir[col];
  rows.sort((a, b) => {
    const aVal = a.cells[col]?.textContent ?? '';
    const bVal = b.cells[col]?.textContent ?? '';
    const aNum = parseFloat(aVal), bNum = parseFloat(bVal);
    const cmp = (!isNaN(aNum) && !isNaN(bNum)) ? aNum - bNum : aVal.localeCompare(bVal);
    return sortDir[col] ? cmp : -cmp;
  });
  rows.forEach(r => tbody.appendChild(r));
}
function filterTable() {
  const q = document.getElementById('filter').value.toLowerCase();
  document.querySelectorAll('#data-table tbody tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}
</script>`;
            const app = createMcpApp(title, html, {
                text: `Table: ${title} — ${columns.length} columns, ${rows.length} rows`,
                width: 900,
                height: Math.min(800, 200 + rows.length * 35),
            });
            return JSON.stringify(app);
        },
    });
    registerAppCapableTool('render_table', 'Render interactive sortable HTML tables');
    // ── render_diff ──
    registerTool({
        name: 'render_diff',
        description: 'Render a side-by-side diff of two text strings. Highlights additions, deletions, and changes. Returns an MCP App with HTML viewable in a browser.',
        parameters: {
            left: { type: 'string', description: 'Left/original text content', required: true },
            right: { type: 'string', description: 'Right/modified text content', required: true },
            left_title: { type: 'string', description: 'Title for left panel (e.g., "Original")', required: false },
            right_title: { type: 'string', description: 'Title for right panel (e.g., "Modified")', required: false },
        },
        tier: 'free',
        async execute(args) {
            const left = String(args.left ?? '');
            const right = String(args.right ?? '');
            const leftTitle = String(args.left_title ?? 'Original');
            const rightTitle = String(args.right_title ?? 'Modified');
            const leftLines = left.split('\n');
            const rightLines = right.split('\n');
            const maxLines = Math.max(leftLines.length, rightLines.length);
            let leftHtml = '';
            let rightHtml = '';
            for (let i = 0; i < maxLines; i++) {
                const l = leftLines[i] ?? '';
                const r = rightLines[i] ?? '';
                const lineNum = i + 1;
                if (l === r) {
                    leftHtml += `<div class="line"><span class="ln">${lineNum}</span>${escapeHtml(l)}</div>`;
                    rightHtml += `<div class="line"><span class="ln">${lineNum}</span>${escapeHtml(r)}</div>`;
                }
                else if (i >= leftLines.length) {
                    leftHtml += `<div class="line empty"><span class="ln"></span></div>`;
                    rightHtml += `<div class="line added"><span class="ln">${lineNum}</span>${escapeHtml(r)}</div>`;
                }
                else if (i >= rightLines.length) {
                    leftHtml += `<div class="line removed"><span class="ln">${lineNum}</span>${escapeHtml(l)}</div>`;
                    rightHtml += `<div class="line empty"><span class="ln"></span></div>`;
                }
                else {
                    leftHtml += `<div class="line removed"><span class="ln">${lineNum}</span>${escapeHtml(l)}</div>`;
                    rightHtml += `<div class="line added"><span class="ln">${lineNum}</span>${escapeHtml(r)}</div>`;
                }
            }
            const html = `
<style>
  .diff-container { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; font-family: 'Courier Prime', monospace; font-size: 13px; }
  .diff-panel { overflow-x: auto; }
  .diff-header { padding: 8px 12px; background: #2a2a3e; color: #c4b5fd; font-weight: bold; border-radius: 6px 6px 0 0; }
  .line { padding: 1px 12px; white-space: pre; min-height: 20px; line-height: 20px; }
  .ln { display: inline-block; width: 40px; color: #555; text-align: right; margin-right: 12px; user-select: none; }
  .added { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
  .removed { background: rgba(248, 113, 113, 0.15); color: #f87171; }
  .empty { background: rgba(100, 100, 100, 0.1); }
</style>
<div class="diff-container">
  <div class="diff-panel">
    <div class="diff-header">${escapeHtml(leftTitle)}</div>
    ${leftHtml}
  </div>
  <div class="diff-panel">
    <div class="diff-header">${escapeHtml(rightTitle)}</div>
    ${rightHtml}
  </div>
</div>
<p style="color:#888;font-size:12px;margin-top:8px">
  ${leftLines.length} lines vs ${rightLines.length} lines
</p>`;
            const app = createMcpApp(`Diff: ${leftTitle} vs ${rightTitle}`, html, {
                text: `Diff: ${leftTitle} (${leftLines.length} lines) vs ${rightTitle} (${rightLines.length} lines)`,
                width: 1000,
                height: Math.min(800, 100 + maxLines * 22),
            });
            return JSON.stringify(app);
        },
    });
    registerAppCapableTool('render_diff', 'Render side-by-side diff viewer as HTML');
    // ── render_diagram ──
    registerTool({
        name: 'render_diagram',
        description: 'Render a Mermaid diagram as interactive HTML. Supports flowcharts, sequence diagrams, class diagrams, state diagrams, ER diagrams, Gantt charts, pie charts, and more. Returns an MCP App with HTML viewable in a browser.',
        parameters: {
            markup: { type: 'string', description: 'Mermaid diagram markup (e.g., "graph TD; A-->B; B-->C;")', required: true },
            title: { type: 'string', description: 'Diagram title', required: false },
        },
        tier: 'free',
        async execute(args) {
            const markup = String(args.markup ?? '');
            const title = String(args.title || 'Diagram');
            const html = `
<h2 style="color:#c4b5fd;margin-bottom:16px">${escapeHtml(title)}</h2>
<div class="mermaid" id="diagram">
${escapeHtml(markup)}
</div>
<details style="margin-top:16px">
  <summary style="color:#888;cursor:pointer">View source markup</summary>
  <pre style="margin-top:8px">${escapeHtml(markup)}</pre>
</details>
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize({
    startOnLoad: true,
    theme: 'dark',
    themeVariables: {
      primaryColor: '#6B5B95',
      primaryTextColor: '#e0e0e0',
      primaryBorderColor: '#7C6CB0',
      lineColor: '#888',
      secondaryColor: '#2a2a3e',
      tertiaryColor: '#1a1a2e',
    }
  });
</script>`;
            const app = createMcpApp(title, html, {
                text: `Diagram: ${title} — Mermaid markup (${markup.length} chars)`,
                width: 900,
                height: 600,
            });
            return JSON.stringify(app);
        },
    });
    registerAppCapableTool('render_diagram', 'Render Mermaid diagrams as interactive HTML');
}
// ── Internal Utilities ──
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
const CHART_COLORS = [
    '#a78bfa', // violet
    '#4ade80', // green
    '#f87171', // red
    '#fbbf24', // amber
    '#67e8f9', // cyan
    '#fb923c', // orange
    '#f472b6', // pink
    '#60a5fa', // blue
    '#a3e635', // lime
    '#e879f9', // fuchsia
];
//# sourceMappingURL=mcp-apps.js.map