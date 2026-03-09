// K:BOT TUI — Rich Terminal Interface
//
// Panels, progress bars, split views, sparklines, dashboard.
// Uses raw ANSI escape codes — no extra dependencies beyond chalk.

import chalk from 'chalk'

const AMETHYST = chalk.hex('#6B5B95')
const AMETHYST_DIM = chalk.hex('#9688BF')
const SAGE = chalk.hex('#6B8E6B')
const SLATE_BLUE = chalk.hex('#5B8BA0')

// ── Terminal helpers ──

export function getTermSize(): { cols: number; rows: number } {
  return {
    cols: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  }
}

export function clearScreen(): void {
  process.stdout.write('\x1b[2J\x1b[H')
}

export function hideCursor(): void { process.stdout.write('\x1b[?25l') }
export function showCursor(): void { process.stdout.write('\x1b[?25h') }

// ── Box Drawing ──

const BOX = {
  tl: '╭', tr: '╮', bl: '╰', br: '╯',
  h: '─', v: '│',
}

/** Strip ANSI escape codes */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '')
}

/** Draw a bordered panel with title */
export function panel(title: string, content: string, opts: {
  width?: number
  color?: (text: string) => string
  padding?: number
} = {}): string {
  const { cols } = getTermSize()
  const width = opts.width || Math.min(cols - 4, 80)
  const color = opts.color || AMETHYST
  const padding = opts.padding ?? 1
  const innerWidth = width - 2

  const lines: string[] = []

  // Top border with title
  const titleStr = title ? ` ${title} ` : ''
  const titleLen = stripAnsi(titleStr).length
  const topFill = Math.max(0, innerWidth - titleLen - 1)
  lines.push(color(BOX.tl + BOX.h + titleStr + BOX.h.repeat(topFill) + BOX.tr))

  // Padding top
  for (let i = 0; i < padding; i++) {
    lines.push(color(BOX.v) + ' '.repeat(innerWidth) + color(BOX.v))
  }

  // Content lines
  for (const cl of content.split('\n')) {
    const stripped = stripAnsi(cl)
    const pad = Math.max(0, innerWidth - stripped.length - 2)
    lines.push(color(BOX.v) + ' ' + cl + ' '.repeat(pad) + ' ' + color(BOX.v))
  }

  // Padding bottom
  for (let i = 0; i < padding; i++) {
    lines.push(color(BOX.v) + ' '.repeat(innerWidth) + color(BOX.v))
  }

  // Bottom border
  lines.push(color(BOX.bl + BOX.h.repeat(innerWidth) + BOX.br))

  return lines.join('\n')
}

/** Horizontal divider with optional label */
export function dividerLine(label?: string, width?: number): string {
  const w = width || getTermSize().cols - 4
  if (!label) return chalk.dim(BOX.h.repeat(w))
  const labelStr = ` ${label} `
  const labelLen = stripAnsi(labelStr).length
  const left = Math.floor((w - labelLen) / 2)
  const right = w - left - labelLen
  return chalk.dim(BOX.h.repeat(left)) + AMETHYST_DIM(labelStr) + chalk.dim(BOX.h.repeat(right))
}

// ── Progress ──

export function progressBar(
  current: number,
  total: number,
  opts: {
    width?: number
    label?: string
    color?: (text: string) => string
    showPercent?: boolean
    showCount?: boolean
  } = {},
): string {
  const width = opts.width || 30
  const color = opts.color || AMETHYST
  const pct = total > 0 ? Math.min(1, current / total) : 0
  const filled = Math.round(pct * width)
  const empty = width - filled

  const bar = color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty))

  const parts: string[] = []
  if (opts.label) parts.push(opts.label)
  parts.push(bar)
  if (opts.showPercent !== false) parts.push(chalk.dim(`${Math.round(pct * 100)}%`))
  if (opts.showCount) parts.push(chalk.dim(`(${current}/${total})`))

  return parts.join(' ')
}

export interface StepProgress {
  steps: Array<{ label: string; status: 'pending' | 'running' | 'done' | 'failed' }>
  currentStep: number
}

export function renderStepProgress(progress: StepProgress): string {
  const lines: string[] = []
  for (let i = 0; i < progress.steps.length; i++) {
    const step = progress.steps[i]
    let icon: string
    let color: (text: string) => string

    switch (step.status) {
      case 'done': icon = '✓'; color = SAGE; break
      case 'running': icon = '●'; color = AMETHYST; break
      case 'failed': icon = '✗'; color = chalk.red; break
      default: icon = '○'; color = chalk.dim; break
    }

    const connector = i < progress.steps.length - 1
      ? (step.status === 'done' ? SAGE('│') : chalk.dim('│'))
      : ''

    lines.push(`  ${color(`${icon} ${step.label}`)}`)
    if (connector) lines.push(`  ${connector}`)
  }
  return lines.join('\n')
}

// ── Split Pane ──

export function splitPane(
  left: { title: string; content: string; color?: (text: string) => string },
  right: { title: string; content: string; color?: (text: string) => string },
): string {
  const { cols } = getTermSize()
  const halfWidth = Math.floor((cols - 5) / 2)

  const leftPanel = panel(left.title, left.content, { width: halfWidth, color: left.color })
  const rightPanel = panel(right.title, right.content, { width: halfWidth, color: right.color })

  const leftLines = leftPanel.split('\n')
  const rightLines = rightPanel.split('\n')
  const maxLines = Math.max(leftLines.length, rightLines.length)

  const combined: string[] = []
  for (let i = 0; i < maxLines; i++) {
    const l = leftLines[i] || ' '.repeat(halfWidth)
    const r = rightLines[i] || ' '.repeat(halfWidth)
    combined.push(`  ${l} ${r}`)
  }

  return combined.join('\n')
}

// ── Table ──

export function table(
  headers: string[],
  rows: string[][],
  opts: { color?: (text: string) => string; padding?: number } = {},
): string {
  const color = opts.color || AMETHYST
  const pad = opts.padding ?? 2

  const colWidths = headers.map((h, i) => {
    const maxData = Math.max(0, ...rows.map(r => stripAnsi(r[i] || '').length))
    return Math.max(stripAnsi(h).length, maxData) + pad
  })

  const lines: string[] = []

  const headerLine = headers.map((h, i) => color(h.padEnd(colWidths[i]))).join('')
  lines.push(`  ${headerLine}`)
  lines.push(`  ${chalk.dim(BOX.h.repeat(colWidths.reduce((a, b) => a + b, 0)))}`)

  for (const row of rows) {
    const rowLine = row.map((cell, i) => {
      const stripped = stripAnsi(cell)
      const padLen = Math.max(0, colWidths[i] - stripped.length)
      return cell + ' '.repeat(padLen)
    }).join('')
    lines.push(`  ${rowLine}`)
  }

  return lines.join('\n')
}

// ── Dashboard ──

export interface DashboardState {
  agent: string
  model: string
  provider: string
  toolsUsed: number
  tokensUsed: number
  cost: number
  sessionTurns: number
  activeSubagents: Array<{ id: string; agent: string; status: string }>
  recentTools: Array<{ name: string; duration: number; success: boolean }>
}

export function renderDashboard(state: DashboardState): string {
  const { cols } = getTermSize()
  const halfWidth = Math.floor((cols - 5) / 2)

  const sessionInfo = [
    `${chalk.dim('Agent:')}     ${AMETHYST(state.agent)}`,
    `${chalk.dim('Model:')}     ${state.model}`,
    `${chalk.dim('Provider:')}  ${state.provider}`,
    '',
    `${chalk.dim('Turns:')}     ${state.sessionTurns}`,
    `${chalk.dim('Tools:')}     ${state.toolsUsed}`,
    `${chalk.dim('Tokens:')}    ${state.tokensUsed.toLocaleString()}`,
    `${chalk.dim('Cost:')}      $${state.cost.toFixed(4)}`,
  ].join('\n')

  const toolLines = state.recentTools.length > 0
    ? state.recentTools.slice(-8).map(t => {
        const icon = t.success ? SAGE('✓') : chalk.red('✗')
        const dur = t.duration < 1000 ? `${t.duration}ms` : `${(t.duration / 1000).toFixed(1)}s`
        return `${icon} ${t.name.padEnd(20)} ${chalk.dim(dur)}`
      }).join('\n')
    : chalk.dim('No tools used yet')

  const subagentLines = state.activeSubagents.length > 0
    ? state.activeSubagents.map(s => {
        const color = s.status === 'running' ? AMETHYST : s.status === 'done' ? SAGE : chalk.dim
        return `${color('●')} ${s.agent} ${chalk.dim(`(${s.status})`)}`
      }).join('\n')
    : chalk.dim('No active subagents')

  const leftPanel = panel('Session', sessionInfo, { width: halfWidth, color: AMETHYST })
  const toolPanel = panel('Recent Tools', toolLines, { width: halfWidth, color: SLATE_BLUE })
  const subPanel = panel('Subagents', subagentLines, { width: halfWidth, color: SAGE })

  const leftLines = leftPanel.split('\n')
  const rightLines = toolPanel.split('\n')
  const maxLines = Math.max(leftLines.length, rightLines.length)

  const combined: string[] = ['']
  for (let i = 0; i < maxLines; i++) {
    const l = leftLines[i] || ' '.repeat(halfWidth)
    const r = rightLines[i] || ' '.repeat(halfWidth)
    combined.push(`  ${l} ${r}`)
  }
  combined.push('')
  combined.push(`  ${subPanel}`)
  combined.push('')

  return combined.join('\n')
}

// ── Sparkline ──

export function sparkline(data: number[], opts: {
  color?: (text: string) => string
  label?: string
} = {}): string {
  const color = opts.color || AMETHYST
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

  if (data.length === 0) return chalk.dim('(no data)')

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const chars = data.map(v => {
    const idx = Math.round(((v - min) / range) * (blocks.length - 1))
    return color(blocks[idx])
  }).join('')

  const parts: string[] = []
  if (opts.label) parts.push(chalk.dim(opts.label))
  parts.push(chars)
  parts.push(chalk.dim(`${min}–${max}`))

  return parts.join(' ')
}

// ── Toast ──

export function toast(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  const colors = { info: chalk.dim, success: SAGE, warn: chalk.yellow, error: chalk.red }
  const icons = { info: '○', success: '✓', warn: '⚠', error: '✗' }
  console.log(colors[type](`  ${icons[type]} ${message}`))
}

/** Truncate string with ellipsis */
export function truncate(str: string, maxWidth: number): string {
  const stripped = stripAnsi(str)
  if (stripped.length <= maxWidth) return str
  return str.slice(0, maxWidth - 1) + '…'
}

/** Word-wrap text to width */
export function wordWrap(text: string, width: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if (current.length + word.length + 1 > width) {
      lines.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) lines.push(current)
  return lines
}
