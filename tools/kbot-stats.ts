#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════════════
// K:BOT Stats — Token usage dashboard for the daemon
// Shows: lifetime tokens, per-task breakdown, cost savings, recent activity
// Run: npm run daemon:stats
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const REPORTS_DIR = join(import.meta.dirname, 'daemon-reports')
const STATE_FILE = join(REPORTS_DIR, 'state.json')
const LOG_FILE = join(REPORTS_DIR, 'daemon.log')

// Claude API pricing for comparison (per 1M tokens)
const CLAUDE_SONNET_INPUT = 3.00
const CLAUDE_SONNET_OUTPUT = 15.00
const AVG_RATE = (CLAUDE_SONNET_INPUT + CLAUDE_SONNET_OUTPUT) / 2

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`
}

function countFiles(dir: string): number {
  try {
    return readdirSync(dir).filter(f => f.endsWith('.md') || f.endsWith('.scaffold')).length
  } catch { return 0 }
}

function getLogLines(n: number): string[] {
  try {
    const content = readFileSync(LOG_FILE, 'utf8')
    return content.trim().split('\n').slice(-n)
  } catch { return [] }
}

function main(): void {
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║           K:BOT Daemon — Token Usage Dashboard           ║')
  console.log('║                    100% Free (Local Ollama)             ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  if (!existsSync(STATE_FILE)) {
    console.log('  No daemon state found. The daemon has not run yet.')
    console.log('  Start it with: npm run daemon\n')
    return
  }

  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  const stats = state.stats || {}

  // ── Overview ──
  console.log('┌─────────────────────────────────────────────────────────┐')
  console.log('│  OVERVIEW                                              │')
  console.log('├─────────────────────────────────────────────────────────┤')
  console.log(`│  Total runs:           ${String(stats.totalRuns || 0).padEnd(33)}│`)
  console.log(`│  Lifetime tokens:      ${formatTokens(stats.totalTokens || 0).padEnd(33)}│`)
  console.log(`│  Ollama status:        ${(stats.lastOllamaStatus || 'unknown').padEnd(33)}│`)
  console.log(`│  Errors today:         ${String(stats.errorsToday || 0).padEnd(33)}│`)
  console.log('└─────────────────────────────────────────────────────────┘\n')

  // ── Cost Savings ──
  const totalTokens = stats.totalTokens || 0
  const wouldCost = (totalTokens / 1_000_000) * AVG_RATE
  console.log('┌─────────────────────────────────────────────────────────┐')
  console.log('│  COST SAVINGS (vs Claude Sonnet API)                   │')
  console.log('├─────────────────────────────────────────────────────────┤')
  console.log(`│  Tokens processed:     ${formatTokens(totalTokens).padEnd(33)}│`)
  console.log(`│  Would have cost:      ${formatMoney(wouldCost).padEnd(33)}│`)
  console.log(`│  You paid:             $0.00${' '.repeat(28)}│`)
  console.log(`│  Saved:                ${formatMoney(wouldCost).padEnd(33)}│`)
  console.log('└─────────────────────────────────────────────────────────┘\n')

  // ── Task Status ──
  const timestamps = state.lastRunTimestamps || {}
  console.log('┌─────────────────────────────────────────────────────────┐')
  console.log('│  TASK SCHEDULE                                         │')
  console.log('├──────────────────┬──────────┬──────────────────────────┤')
  console.log('│  Task            │ Interval │ Last Run                 │')
  console.log('├──────────────────┼──────────┼──────────────────────────┤')

  const tasks = [
    { name: 'Git Review', key: 'gitReview', interval: 'every run' },
    { name: 'Code Quality', key: 'codeQuality', interval: '4 hours' },
    { name: 'Daily Digest', key: 'dailyDigest', interval: '24 hours' },
    { name: 'Documentation', key: 'documentation', interval: '12 hours' },
    { name: 'Test Coverage', key: 'testCoverage', interval: '12 hours' },
    { name: 'Embeddings', key: 'embeddings', interval: '8 hours' },
    { name: 'i18n Sync', key: 'i18nSync', interval: '6 hours' },
  ]

  for (const t of tasks) {
    const lastRun = timestamps[t.key]
    const lastStr = lastRun ? lastRun.replace('T', ' ').slice(0, 16) : 'never'
    console.log(`│  ${t.name.padEnd(16)}│ ${t.interval.padEnd(9)}│ ${lastStr.padEnd(25)}│`)
  }
  console.log('└──────────────────┴──────────┴──────────────────────────┘\n')

  // ── Report Counts ──
  console.log('┌─────────────────────────────────────────────────────────┐')
  console.log('│  GENERATED REPORTS                                     │')
  console.log('├─────────────────────────────────────────────────────────┤')

  const dirs = [
    { name: 'Git Reviews', dir: 'git-reviews' },
    { name: 'Code Quality Scans', dir: 'code-quality' },
    { name: 'Daily Digests', dir: 'daily-digest' },
    { name: 'Documentation', dir: 'documentation' },
    { name: 'Test Scaffolds', dir: 'test-coverage' },
    { name: 'i18n Sync Reports', dir: 'i18n-sync' },
  ]

  for (const d of dirs) {
    const count = countFiles(join(REPORTS_DIR, d.dir))
    console.log(`│  ${d.name.padEnd(22)} ${String(count).padStart(4)} files${' '.repeat(24)}│`)
  }

  // Embedding count
  const embCount = Object.keys(state.embeddingIndex || {}).length
  console.log(`│  Embeddings indexed    ${String(embCount).padStart(4)} files${' '.repeat(24)}│`)
  console.log('└─────────────────────────────────────────────────────────┘\n')

  // ── Token Projection ──
  if (stats.totalRuns > 1 && totalTokens > 0) {
    const tokensPerRun = totalTokens / stats.totalRuns
    const runsPerDay = (24 * 60) / 15 // 96 runs per day
    const dailyTokens = tokensPerRun * runsPerDay
    const monthlyTokens = dailyTokens * 30
    const monthlySavings = (monthlyTokens / 1_000_000) * AVG_RATE

    console.log('┌─────────────────────────────────────────────────────────┐')
    console.log('│  PROJECTIONS                                           │')
    console.log('├─────────────────────────────────────────────────────────┤')
    console.log(`│  Avg tokens/run:       ${formatTokens(Math.round(tokensPerRun)).padEnd(33)}│`)
    console.log(`│  Est. daily tokens:    ${formatTokens(Math.round(dailyTokens)).padEnd(33)}│`)
    console.log(`│  Est. monthly tokens:  ${formatTokens(Math.round(monthlyTokens)).padEnd(33)}│`)
    console.log(`│  Monthly savings:      ${formatMoney(monthlySavings).padEnd(33)}│`)
    console.log('└─────────────────────────────────────────────────────────┘\n')
  }

  // ── Recent Log ──
  const recentLog = getLogLines(15)
  if (recentLog.length > 0) {
    console.log('┌─────────────────────────────────────────────────────────┐')
    console.log('│  RECENT ACTIVITY (last 15 lines)                       │')
    console.log('├─────────────────────────────────────────────────────────┤')
    for (const line of recentLog) {
      const trimmed = line.length > 57 ? line.slice(0, 54) + '...' : line
      console.log(`│  ${trimmed.padEnd(55)}│`)
    }
    console.log('└─────────────────────────────────────────────────────────┘\n')
  }

  console.log('  Commands:')
  console.log('    npm run daemon          Run daemon manually (one cycle)')
  console.log('    npm run daemon:stats    This dashboard')
  console.log('    npm run daemon:log      Tail the daemon log')
  console.log('    npm run daemon:stop     Stop the background daemon')
  console.log('    npm run daemon:start    Start the background daemon')
  console.log('')
}

main()
