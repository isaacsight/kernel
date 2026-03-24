// kbot Terminal UI — Modern 2026 CLI design
// Follows: clig.dev guidelines, Claude Code patterns, gh CLI conventions.
// Supports NO_COLOR, TTY detection. An 8th grader can read every message.
//
// stderr vs stdout (clig.dev best practice):
//   stdout = content (AI responses, tool output) — safe to pipe
//   stderr = status (spinners, banners, errors, tool calls) — humans only
import chalk from 'chalk';
import ora from 'ora';
import { detectTerminalCapabilities, gradient } from './terminal-caps.js';
// ── Terminal capability detection (cached) ──
let _caps = null;
export function getTerminalCaps() {
    if (!_caps)
        _caps = detectTerminalCapabilities();
    return _caps;
}
export { detectTerminalCapabilities, withSyncOutput } from './terminal-caps.js';
// ── NO_COLOR support (clig.dev / no-color.org standard) ──
const useColor = !process.env.NO_COLOR && process.stdout.isTTY !== false;
// ── Output channels ──
// Status/progress → stderr (doesn't pollute pipes)
// Content → stdout (pipeable)
let _quiet = false;
export function setQuiet(q) { _quiet = q; }
export const status = (...args) => { if (!_quiet)
    console.error(...args); };
export const content = (...args) => console.log(...args);
// ── Color palette ──
// Subtle, dark-mode-friendly. One accent color, everything else is gray.
const ACCENT = useColor ? chalk.hex('#A78BFA') : chalk; // soft violet (primary)
const ACCENT_DIM = useColor ? chalk.hex('#7C6CB0') : chalk; // muted violet
const GREEN = useColor ? chalk.hex('#4ADE80') : chalk; // success
const RED = useColor ? chalk.hex('#F87171') : chalk; // error
const YELLOW = useColor ? chalk.hex('#FBBF24') : chalk; // warning
const CYAN = useColor ? chalk.hex('#67E8F9') : chalk; // code/paths
const DIM = useColor ? chalk.dim : ((s) => s); // secondary text
/** Agent color map */
const AGENT_COLORS = {
    kernel: ACCENT,
    researcher: chalk.hex('#60A5FA'),
    coder: chalk.hex('#4ADE80'),
    writer: chalk.hex('#FB923C'),
    analyst: chalk.hex('#F472B6'),
    aesthete: chalk.hex('#C4956A'),
    guardian: chalk.hex('#8B4513'),
    curator: chalk.hex('#708090'),
    strategist: chalk.hex('#DAA520'),
    creative: chalk.hex('#E879F9'),
    developer: chalk.hex('#38BDF8'),
    local: DIM,
};
/** Register a custom agent's color (for matrix agents) */
export function registerAgentVisuals(id, _icon, color) {
    AGENT_COLORS[id] = chalk.hex(color);
}
export function agentColor(agentId) {
    return AGENT_COLORS[agentId] || ACCENT;
}
export function agentIcon(agentId) {
    // Simple, consistent — no exotic unicode
    const icons = {
        kernel: '●', researcher: '◆', coder: '▸', writer: '✎',
        analyst: '◇', creative: '✧', developer: '⚙', local: '⚡',
    };
    return icons[agentId] || '●';
}
// ── Prompt ──
export function prompt() {
    // Show current directory basename like Claude Code: kbot ~/project ❯
    const cwd = process.cwd();
    const home = process.env.HOME || '';
    const short = home && cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd;
    // Only show the last 2 path segments to keep it compact
    const parts = short.split('/');
    const display = parts.length > 3 ? parts.slice(-2).join('/') : short;
    return `${DIM(display)} ${ACCENT('❯')} `;
}
// ── Banners ──
/** Particle grid banner — CLI translation of kernel.chat's ParticleGrid */
function particleGridArt() {
    // Each frame is a freeze-frame of the fluid sim, rendered as Unicode on a quantized grid
    // Uses the same Rubin palette: amethyst particles, mauve links, warm brown field
    const P = ACCENT; // particle core (amethyst ●)
    const L = ACCENT_DIM; // link lines (muted violet)
    const F = useColor ? chalk.hex('#B8875C') : chalk; // field haze (warm brown)
    const G = DIM; // grid lines
    const R = useColor ? chalk.hex('#E8E6DC') : chalk; // registration marks
    const dot = P('●');
    const sm = F('◦');
    const ln = L('─');
    const vl = L('│');
    const dd = L('╲');
    const du = L('╱');
    const gl = G('┼');
    const gd = G('·');
    const reg = R('+');
    // 60-col particle grid with registration marks, scattered particles, links
    const lines = [
        `  ${reg}${G('╌'.repeat(27))}${gl}${G('╌'.repeat(28))}${reg}`,
        `  ${G('┊')} ${sm}  ${gd}  ${dot}${ln}${ln}${dot}  ${gd}  ${sm}  ${gd}  ${sm}  ${gd}    ${dot}  ${gd}  ${sm}   ${G('┊')}`,
        `  ${G('┊')}   ${sm} ${gd}   ${vl}   ${gd}    ${gd}${sm}   ${gd}    ${du}  ${gd}     ${gd}  ${G('┊')}`,
        `  ${gl}${G('╌╌')}${gd}${G('╌╌')}${gd}${G('╌')}${dot}${G('╌╌')}${gd}${G('╌╌')}${gd}${G('╌╌')}${dot}${ln}${ln}${ln}${dot}${G('╌╌')}${gd}${G('╌')}${dot}${G('╌╌')}${gd}${G('╌╌')}${gd}${G('╌╌')}${gl}`,
        `  ${G('┊')}  ${gd}  ${sm}${du}  ${gd}  ${sm} ${gd}   ${dd}  ${gd} ${du}${sm} ${gd}   ${dot}  ${gd}  ${G('┊')}`,
        `  ${G('┊')} ${gd}   ${dot}  ${gd}   ${gd} ${sm}  ${gd} ${dot}  ${gd}   ${gd}  ${vl}  ${gd}  ${G('┊')}`,
        `  ${G('┊')}  ${gd}  ${dd}${sm} ${gd}    ${gd}   ${gd}  ${dd} ${gd}    ${gd}  ${dot}  ${gd} ${G('┊')}`,
        `  ${gl}${G('╌╌')}${gd}${G('╌╌')}${gd}${G('╌')}${dot}${ln}${ln}${dot}${G('╌╌')}${gd}${G('╌╌')}${gd}${G('╌╌╌')}${dot}${G('╌╌')}${gd}${G('╌╌')}${gd}${G('╌')}${dot}${ln}${dot}${G('╌╌')}${gl}`,
        `  ${G('┊')} ${sm}  ${gd}    ${gd} ${sm} ${gd}    ${gd}  ${du}  ${gd} ${sm}  ${gd}  ${vl} ${gd}  ${G('┊')}`,
        `  ${G('┊')}   ${gd}  ${dot}  ${gd}   ${gd}  ${dot}${ln}${dot}  ${gd}    ${gd}  ${dot}  ${gd} ${G('┊')}`,
        `  ${reg}${G('╌'.repeat(27))}${gl}${G('╌'.repeat(28))}${reg}`,
    ];
    return lines.join('\n');
}
export function banner(version) {
    const v = version ? chalk.dim(` v${version}`) : '';
    const grid = particleGridArt();
    // If truecolor supported, use gradient for the kbot banner text
    // Gradient from accent violet (#A78BFA) to cyan (#67E8F9)
    const caps = getTerminalCaps();
    const bannerText = caps.truecolor
        ? gradient('kbot', [167, 139, 250], [103, 232, 249])
        : ACCENT('kbot');
    const title = `  ${bannerText}${v}`;
    const features = DIM('  Web search: free • 22 agents • 60+ tools • bring your own key');
    return `\n${grid}\n${title}\n${features}\n`;
}
export function bannerCompact() {
    return ''; // No banner in one-shot — just run
}
export function bannerAuth() {
    const grid = particleGridArt();
    const caps = getTerminalCaps();
    const bannerText = caps.truecolor
        ? gradient('kbot', [167, 139, 250], [103, 232, 249])
        : ACCENT('kbot');
    return `\n${grid}\n  ${bannerText} ${DIM('setup')}\n`;
}
export function matrixConnect(tier, agentCount) {
    return `  ${GREEN('●')} ${DIM(`${tier} · ${agentCount} agents · ready`)}\n`;
}
// ── Spinner ──
export function createSpinner(text = 'Thinking...') {
    return ora({
        text: DIM(text),
        color: 'magenta',
        spinner: 'dots',
        stream: process.stderr, // Spinners go to stderr — don't pollute piped output
    });
}
// ── Output ──
/** Print an agent response (content → stdout, agent label → stderr) */
export function printResponse(agentId, text) {
    const color = agentColor(agentId);
    content();
    // Show which agent responded (subtle, like Claude Code's model indicator)
    if (agentId !== 'kernel' && agentId !== 'auto' && agentId !== 'local') {
        status(`  ${color('●')} ${DIM(agentId)}`);
    }
    // Render markdown to stdout — this is the pipeable content
    const formatted = formatMarkdown(text);
    for (const line of formatted.split('\n')) {
        content(`  ${line}`);
    }
    content();
}
/** Print a tool execution — compact, one line (stderr — status) */
export function printToolCall(toolName, args) {
    const summary = Object.entries(args)
        .slice(0, 3) // Max 3 args shown
        .map(([k, v]) => {
        const val = typeof v === 'string' ? (v.length > 30 ? v.slice(0, 30) + '…' : v) : String(v);
        return `${DIM(k + '=')}${val}`;
    })
        .join(' ');
    status(`  ${ACCENT_DIM('▸')} ${chalk.white(toolName)} ${summary}`);
}
/** Print tool result (truncated, stderr — status) */
export function printToolResult(result, error) {
    const lines = result.split('\n');
    const preview = lines.slice(0, 3).join('\n');
    const more = lines.length > 3 ? `\n  ${DIM(`  +${lines.length - 3} lines`)}` : '';
    const color = error ? RED : DIM;
    status(color(`    ${preview.split('\n').join('\n    ')}${more}`));
}
/** Print usage stats (stderr — status) */
export function printUsage(stats) {
    const { tier, monthly_messages } = stats;
    const pct = Math.round((monthly_messages.count / monthly_messages.limit) * 100);
    const barLen = 20;
    const filled = Math.round((pct / 100) * barLen);
    const barColor = pct > 90 ? RED : pct > 70 ? YELLOW : GREEN;
    const bar = barColor('━'.repeat(filled)) + DIM('━'.repeat(barLen - filled));
    status();
    status(`  ${chalk.bold('Usage')}  ${DIM(tier)}`);
    status(`  ${bar}  ${monthly_messages.count}/${monthly_messages.limit} ${DIM(`(${pct}%)`)}`);
    status();
}
// ── Status messages (all stderr — never pollute piped output) ──
export function printError(message) {
    status(`  ${RED('✗')} ${message}`);
}
export function printSuccess(message) {
    status(`  ${GREEN('✓')} ${message}`);
}
export function printInfo(message) {
    status(`  ${DIM(message)}`);
}
export function printWarn(message) {
    status(`  ${YELLOW('!')} ${message}`);
}
// ── Markdown rendering ──
function formatMarkdown(text) {
    return text
        // Code blocks — render with left border
        .replace(/```[\w]*\n([\s\S]*?)```/g, (_match, code) => {
        const lines = code.split('\n');
        return lines.map((l) => `${DIM('│')} ${CYAN(l)}`).join('\n');
    })
        // Headers
        .replace(/^### (.+)$/gm, (_m, h) => chalk.bold(h))
        .replace(/^## (.+)$/gm, (_m, h) => chalk.bold(h))
        .replace(/^# (.+)$/gm, (_m, h) => chalk.bold.underline(h))
        // Bold
        .replace(/\*\*(.+?)\*\*/g, (_m, t) => chalk.bold(t))
        // Italic
        .replace(/\*(.+?)\*/g, (_m, t) => chalk.italic(t))
        // Inline code
        .replace(/`([^`]+)`/g, (_m, c) => CYAN(c))
        // Bullet points
        .replace(/^[-*] (.+)$/gm, (_m, t) => `${DIM('•')} ${t}`)
        // Numbered lists
        .replace(/^(\d+)\. (.+)$/gm, (_m, n, t) => `${DIM(`${n}.`)} ${t}`);
}
// ── Divider ──
export function divider() {
    status(DIM('  ' + '─'.repeat(50)));
}
// ── Help ──
export function printHelp() {
    const lines = [
        '',
        `  ${chalk.bold('Just type what you need.')} kbot figures out the rest.`,
        '',
        `  ${chalk.bold('Examples')}`,
        `  ${DIM('─'.repeat(50))}`,
        `  "fix the bug in login.ts"        ${DIM('→ coder agent')}`,
        `  "research how JWT tokens work"    ${DIM('→ researcher agent')}`,
        `  "write a blog post about AI"      ${DIM('→ writer agent')}`,
        `  "review this code for security"   ${DIM('→ guardian agent')}`,
        `  "explain quantum entanglement"    ${DIM('→ physicist agent')}`,
        '',
        `  ${chalk.bold('Basics')}`,
        `  ${DIM('─'.repeat(50))}`,
        `  ${chalk.white('/save')} ${DIM('[name]')}     Save this conversation`,
        `  ${chalk.white('/resume')} ${DIM('<id>')}     Pick up where you left off`,
        `  ${chalk.white('/share')} ${DIM('[id]')}      Share as GitHub Gist — get a public link`,
        `  ${chalk.white('/clear')}             Start fresh`,
        `  ${chalk.white('/remember')} ${DIM('<…>')}   Teach kbot something it will remember`,
        `  ${chalk.white('/tutorial')}           Guided walkthrough — build something step by step`,
        `  ${chalk.white('/quit')}              Exit`,
        '',
        `  ${chalk.bold('Customize')}`,
        `  ${DIM('─'.repeat(50))}`,
        `  ${chalk.white('/agent')} ${DIM('<name>')}    Pick a specialist ${DIM('(coder, writer, researcher, physicist, debugger...)')}`,
        `  ${chalk.white('/model')} ${DIM('<name>')}    Switch AI model`,
        `  ${chalk.white('/ollama')} ${DIM('[model]')}   Use local AI (free, private)`,
        `  ${chalk.white('/thinking')}          Show how kbot reasons`,
        `  ${chalk.white('/mimic')} ${DIM('<style>')}   Code like Claude Code, Cursor, or Copilot`,
        '',
        `  ${chalk.bold('Power Tools')}`,
        `  ${DIM('─'.repeat(50))}`,
        `  ${chalk.white('/plan')} ${DIM('<task>')}     Let kbot plan and execute a complex task`,
        `  ${chalk.white('/matrix')}            Create your own custom agents`,
        `  ${chalk.white('/worktree')}          Work in an isolated git branch`,
        `  ${chalk.white('/compact')}           Compress conversation (saves tokens)`,
        `  ${chalk.white('/dashboard')}         See usage stats and learning data`,
        '',
        `  ${chalk.bold('Community')}`,
        `  ${DIM('─'.repeat(50))}`,
        `  ${CYAN('https://discord.gg/kdMauM9abG')}  ${DIM('Discord')}`,
        `  ${CYAN('https://kernel.chat')}             ${DIM('Web companion')}`,
        `  ${CYAN('https://github.com/isaacsight/kernel')} ${DIM('GitHub')}`,
        '',
        `  ${DIM('25 specialist agents. 290+ tools. Type anything to get started.')}`,
        '',
    ];
    status(lines.join('\n'));
}
// ── Goodbye ──
export function printGoodbye() {
    status();
    status(`  ${DIM('Bye.')}`);
    status();
}
//# sourceMappingURL=ui.js.map