// K:BOT Terminal UI — ASCII art branding, colors, spinners, markdown rendering
// Minimal dependencies. Beautiful terminal output.

import chalk from 'chalk'
import ora, { type Ora } from 'ora'

// Brand colors — Rubin palette
const AMETHYST = chalk.hex('#6B5B95')
const AMETHYST_DIM = chalk.hex('#9688BF')
const SAGE = chalk.hex('#6B8E6B')
const WARM_BROWN = chalk.hex('#B8875C')
const SLATE_BLUE = chalk.hex('#5B8BA0')
const MAUVE = chalk.hex('#A0768C')
const IVORY = chalk.hex('#FAF9F6')
const SLATE = chalk.hex('#1F1E1D')

/** Agent color map */
const AGENT_COLORS: Record<string, (text: string) => string> = {
  kernel: AMETHYST,
  researcher: SLATE_BLUE,
  coder: SAGE,
  writer: WARM_BROWN,
  analyst: MAUVE,
  aesthete: chalk.hex('#C4956A'),
  guardian: chalk.hex('#8B4513'),
  curator: chalk.hex('#708090'),
  strategist: chalk.hex('#DAA520'),
  infrastructure: chalk.hex('#4682B4'),
  quant: chalk.hex('#228B22'),
  investigator: chalk.hex('#8B0000'),
  oracle: chalk.hex('#9370DB'),
  chronist: chalk.hex('#CD853F'),
  sage: chalk.hex('#2F4F4F'),
  communicator: chalk.hex('#DB7093'),
  adapter: chalk.hex('#20B2AA'),
  local: chalk.hex('#888888'),
}

/** Agent icons */
const AGENT_ICONS: Record<string, string> = {
  kernel: '◆',
  researcher: '◈',
  coder: '⟐',
  writer: '◇',
  analyst: '▣',
  aesthete: '✦',
  guardian: '◉',
  curator: '❖',
  strategist: '▲',
  infrastructure: '⬡',
  quant: '∑',
  investigator: '⊕',
  oracle: '☉',
  chronist: '◷',
  sage: '✧',
  communicator: '◎',
  adapter: '⟳',
  local: '⚡',
}

export function agentColor(agentId: string): (text: string) => string {
  return AGENT_COLORS[agentId] || AMETHYST
}

export function agentIcon(agentId: string): string {
  return AGENT_ICONS[agentId] || '●'
}

/** The K:BOT prompt */
export function prompt(): string {
  return `${AMETHYST('K')}${chalk.dim(':')}${AMETHYST('BOT')} ${chalk.dim('❯')} `
}

/** Main ASCII art banner — shown on REPL startup */
export function banner(version?: string): string {
  const v = version ? ` v${version}` : ''
  const art = [
    '',
    `  ${AMETHYST('██╗  ██╗')}${chalk.dim(':')}${AMETHYST('██████╗  ██████╗ ████████╗')}`,
    `  ${AMETHYST('██║ ██╔╝')} ${AMETHYST('██╔══██╗██╔═══██╗╚══██╔══╝')}`,
    `  ${AMETHYST('█████╔╝')}  ${AMETHYST('██████╔╝██║   ██║   ██║')}`,
    `  ${AMETHYST('██╔═██╗')}  ${AMETHYST('██╔══██╗██║   ██║   ██║')}`,
    `  ${AMETHYST('██║  ██╗')}${chalk.dim(':')}${AMETHYST('██████╔╝╚██████╔╝   ██║')}`,
    `  ${AMETHYST('╚═╝  ╚═╝')} ${AMETHYST('╚═════╝  ╚═════╝    ╚═╝')}`,
    '',
    `  ${chalk.dim('─────────────────────────────────────')}`,
    `  ${AMETHYST_DIM(`Kernel${v}`)}`,
    `  ${chalk.dim('Build anything · multi-model · local-first')}`,
    `  ${chalk.dim('─────────────────────────────────────')}`,
    '',
  ]
  return art.join('\n')
}

/** Compact banner — shown for one-shot mode */
export function bannerCompact(): string {
  return `\n  ${AMETHYST('K:BOT')} ${chalk.dim('·')} ${AMETHYST_DIM('Kernel Matrix')}\n`
}

/** Auth flow banner */
export function bannerAuth(): string {
  const art = [
    '',
    `  ${AMETHYST('╔═══════════════════════════════════╗')}`,
    `  ${AMETHYST('║')}  ${chalk.bold('K:BOT')} ${chalk.dim('— Terminal Agent Setup')}    ${AMETHYST('║')}`,
    `  ${AMETHYST('╚═══════════════════════════════════╝')}`,
    '',
  ]
  return art.join('\n')
}

/** Matrix-style connection animation text */
export function matrixConnect(tier: string, agentCount: number): string {
  const lines = [
    `  ${SAGE('✓')} ${chalk.dim('Connected to')} ${AMETHYST('Kernel Matrix')}`,
    `  ${SAGE('✓')} ${chalk.dim('Tier:')} ${chalk.bold(tier)} ${chalk.dim('·')} ${chalk.dim(`${agentCount} agents available`)}`,
    `  ${SAGE('✓')} ${chalk.dim('Tools: local-first execution (file, git, bash)')}`,
    '',
  ]
  return lines.join('\n')
}

/** Create a thinking spinner */
export function createSpinner(text = 'Thinking...'): Ora {
  return ora({
    text: AMETHYST_DIM(text),
    color: 'magenta',
    spinner: 'dots',
  })
}

/** Print an agent response with icon and agent name */
export function printResponse(agentId: string, content: string): void {
  const color = agentColor(agentId)
  const icon = agentIcon(agentId)
  console.log()
  console.log(color(`  ${icon} ${agentId}`))
  console.log(chalk.dim('  ' + '─'.repeat(40)))
  console.log()
  // Simple markdown-to-terminal rendering
  const formatted = formatMarkdown(content)
  for (const line of formatted.split('\n')) {
    console.log(`  ${line}`)
  }
  console.log()
}

/** Print a tool execution */
export function printToolCall(toolName: string, args: Record<string, unknown>): void {
  const summary = Object.entries(args)
    .map(([k, v]) => `${k}=${typeof v === 'string' && v.length > 40 ? v.slice(0, 40) + '...' : v}`)
    .join(', ')
  console.log(AMETHYST_DIM(`  ⚡ ${toolName}`) + chalk.dim(`(${summary})`))
}

/** Print tool result (truncated) */
export function printToolResult(result: string, error?: boolean): void {
  const lines = result.split('\n')
  const preview = lines.slice(0, 5).join('\n')
  const truncated = lines.length > 5 ? `\n  ${chalk.dim(`... (${lines.length - 5} more lines)`)}` : ''
  const color = error ? chalk.red : chalk.dim
  console.log(color(`  ${preview}${truncated}`))
}

/** Print usage stats with visual bar */
export function printUsage(stats: { tier: string; monthly_messages: { count: number; limit: number } }): void {
  const { tier, monthly_messages } = stats
  const pct = Math.round((monthly_messages.count / monthly_messages.limit) * 100)
  const bar = renderBar(pct)
  console.log()
  console.log(`  ${AMETHYST('▣')} ${chalk.bold('Usage')}`)
  console.log(chalk.dim('  ' + '─'.repeat(40)))
  console.log(`  Tier      ${chalk.bold(tier)}`)
  console.log(`  Messages  ${monthly_messages.count} ${chalk.dim('/')} ${monthly_messages.limit}`)
  console.log(`  ${bar} ${pct}%`)
  console.log()
}

function renderBar(pct: number): string {
  const total = 30
  const filled = Math.round((pct / 100) * total)
  const color = pct > 90 ? chalk.red : pct > 70 ? chalk.yellow : AMETHYST
  return `  ${color('█'.repeat(filled))}${chalk.dim('░'.repeat(total - filled))}`
}

/** Print error */
export function printError(message: string): void {
  console.log(chalk.red(`  ✗ ${message}`))
}

/** Print success */
export function printSuccess(message: string): void {
  console.log(SAGE(`  ✓ ${message}`))
}

/** Print info */
export function printInfo(message: string): void {
  console.log(chalk.dim(`  ${message}`))
}

/** Print a warning */
export function printWarn(message: string): void {
  console.log(chalk.yellow(`  ⚠ ${message}`))
}

/** Simple markdown formatting for terminal */
function formatMarkdown(text: string): string {
  return text
    // Headers
    .replace(/^### (.+)$/gm, (_m, h) => chalk.bold(AMETHYST_DIM(h)))
    .replace(/^## (.+)$/gm, (_m, h) => chalk.bold.underline(h))
    .replace(/^# (.+)$/gm, (_m, h) => chalk.bold.underline(h))
    // Bold
    .replace(/\*\*(.+?)\*\*/g, (_m, t) => chalk.bold(t))
    // Italic
    .replace(/\*(.+?)\*/g, (_m, t) => chalk.italic(t))
    // Inline code
    .replace(/`([^`]+)`/g, (_m, c) => chalk.cyan(c))
    // Code blocks (simple — just color them)
    .replace(/```[\w]*\n([\s\S]*?)```/g, (_match, code: string) => {
      const lines = code.split('\n')
      return lines.map((l: string) => `${chalk.dim('│')} ${chalk.cyan(l)}`).join('\n')
    })
    // Bullet points
    .replace(/^- (.+)$/gm, (_m, t) => `${AMETHYST_DIM('•')} ${t}`)
    .replace(/^\* (.+)$/gm, (_m, t) => `${AMETHYST_DIM('•')} ${t}`)
    // Numbered lists
    .replace(/^(\d+)\. (.+)$/gm, (_m, n, t) => `${chalk.dim(`${n}.`)} ${t}`)
}

/** Print a divider line */
export function divider(): void {
  console.log(chalk.dim('  ' + '─'.repeat(50)))
}

/** Print help screen with ASCII styling */
export function printHelp(): void {
  const lines = [
    '',
    `  ${AMETHYST('Commands')}`,
    chalk.dim('  ' + '─'.repeat(40)),
    `  ${chalk.bold('/agent')} ${chalk.dim('<name>')}    Switch agent ${chalk.dim('(kernel, researcher, coder, writer, analyst)')}`,
    `  ${chalk.bold('/model')} ${chalk.dim('<name>')}    Switch model ${chalk.dim('(auto, sonnet, haiku)')}`,
    `  ${chalk.bold('/usage')}             Show usage stats`,
    `  ${chalk.bold('/clear')}             Clear conversation`,
    `  ${chalk.bold('/context')}           Show project context`,
    `  ${chalk.bold('/memory')} ${chalk.dim('[clear]')}   View or clear persistent memory`,
    `  ${chalk.bold('/help')}              Show this help`,
    `  ${chalk.bold('/quit')}              Exit`,
    '',
    `  ${AMETHYST('Tips')}`,
    chalk.dim('  ' + '─'.repeat(40)),
    `  ${chalk.dim('•')} Simple commands ${chalk.dim('(ls, git status, cat file)')} run locally — ${SAGE('free')}`,
    `  ${chalk.dim('•')} AI reasoning goes through the Kernel Matrix — uses quota`,
    `  ${chalk.dim('•')} Use ${chalk.bold('--agent coder')} to force a specialist`,
    `  ${chalk.dim('•')} Set ${chalk.bold('KBOT_API_KEY')} env var to skip auth`,
    '',
  ]
  console.log(lines.join('\n'))
}

/** Goodbye message */
export function printGoodbye(): void {
  console.log()
  console.log(`  ${AMETHYST_DIM('Matrix disconnected.')}`)
  console.log()
}
