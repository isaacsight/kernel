#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════════════
// npm Download Tracker — Real-time download monitoring for @kernel.chat/kbot
// Shows: live count, daily/weekly/monthly totals, sparkline trends,
//        milestone alerts, growth rate, and optional Discord notifications
//
// Run: npx tsx tools/npm-downloads.ts
// Run: npx tsx tools/npm-downloads.ts --once        (single snapshot)
// Run: npx tsx tools/npm-downloads.ts --interval 30  (poll every 30s)
// Run: npx tsx tools/npm-downloads.ts --discord       (notify milestones)
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Config ──────────────────────────────────────────
const PACKAGE = '@kernel.chat/kbot'
const NPM_API = 'https://api.npmjs.org/downloads'
const DATA_DIR = join(__dirname, 'daemon-reports')
const HISTORY_FILE = join(DATA_DIR, 'npm-downloads.json')
const POLL_INTERVAL = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--interval') || '60', 10)
const ONCE = process.argv.includes('--once')
const DISCORD_NOTIFY = process.argv.includes('--discord')

// Milestones to celebrate
const MILESTONES = [100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000]

// Sparkline chars
const SPARK = '▁▂▃▄▅▆▇█'

// ─── Types ───────────────────────────────────────────
interface DayCount {
  day: string
  downloads: number
}

interface NpmRangeResponse {
  start: string
  end: string
  package: string
  downloads: DayCount[]
}

interface NpmPointResponse {
  downloads: number
  start: string
  end: string
  package: string
}

interface DownloadHistory {
  snapshots: Array<{ timestamp: string; today: number; week: number; month: number; total: number }>
  milestonesHit: number[]
  firstTracked: string
}

// ─── ANSI helpers ────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  bg: '\x1b[48;5;235m',
  gold: '\x1b[38;5;220m',
}

function sparkline(data: number[]): string {
  if (data.length === 0) return ''
  const max = Math.max(...data, 1)
  return data.map(v => SPARK[Math.min(Math.floor((v / max) * (SPARK.length - 1)), SPARK.length - 1)]).join('')
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function growthArrow(current: number, previous: number): string {
  if (previous === 0) return `${c.green}★ new${c.reset}`
  const pct = ((current - previous) / previous) * 100
  if (pct > 0) return `${c.green}▲ +${pct.toFixed(0)}%${c.reset}`
  if (pct < 0) return `${c.red}▼ ${pct.toFixed(0)}%${c.reset}`
  return `${c.dim}— 0%${c.reset}`
}

function bar(value: number, max: number, width: number = 30): string {
  const filled = Math.round((value / Math.max(max, 1)) * width)
  return `${c.magenta}${'█'.repeat(filled)}${c.dim}${'░'.repeat(width - filled)}${c.reset}`
}

// ─── npm API ─────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`npm API ${res.status}: ${url}`)
  return res.json() as Promise<T>
}

async function getToday(): Promise<number> {
  const data = await fetchJSON<NpmPointResponse>(`${NPM_API}/point/last-day/${PACKAGE}`)
  return data.downloads
}

async function getWeek(): Promise<DayCount[]> {
  const data = await fetchJSON<NpmRangeResponse>(`${NPM_API}/range/last-week/${PACKAGE}`)
  return data.downloads
}

async function getMonth(): Promise<DayCount[]> {
  const data = await fetchJSON<NpmRangeResponse>(`${NPM_API}/range/last-month/${PACKAGE}`)
  return data.downloads
}

async function getTotal(): Promise<number> {
  // npm API doesn't have an all-time endpoint, so we use a large range
  const start = '2025-01-01'
  const end = new Date().toISOString().split('T')[0]
  const data = await fetchJSON<NpmRangeResponse>(`${NPM_API}/range/${start}:${end}/${PACKAGE}`)
  return data.downloads.reduce((sum, d) => sum + d.downloads, 0)
}

// ─── History ─────────────────────────────────────────
function loadHistory(): DownloadHistory {
  if (existsSync(HISTORY_FILE)) {
    return JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'))
  }
  return { snapshots: [], milestonesHit: [], firstTracked: new Date().toISOString() }
}

function saveHistory(h: DownloadHistory): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(HISTORY_FILE, JSON.stringify(h, null, 2))
}

// ─── Discord ─────────────────────────────────────────
async function notifyDiscord(message: string): Promise<void> {
  if (!DISCORD_NOTIFY) return
  try {
    // Load webhook from .env
    const envPath = join(__dirname, '..', '.env')
    const envContent = readFileSync(envPath, 'utf-8')
    const match = envContent.match(/DISCORD_RELEASES_WEBHOOK=(.+)/)
    const webhook = match?.[1]?.trim()
    if (!webhook) return

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '📦 npm Download Milestone',
          description: message,
          color: 0x6B5B95,
          footer: { text: `@kernel.chat/kbot` },
          timestamp: new Date().toISOString(),
        }],
      }),
    })
  } catch { /* silent */ }
}

// ─── Render ──────────────────────────────────────────
function render(today: number, weekData: DayCount[], monthData: DayCount[], total: number, history: DownloadHistory): void {
  const week = weekData.reduce((s, d) => s + d.downloads, 0)
  const month = monthData.reduce((s, d) => s + d.downloads, 0)
  const weekDays = weekData.map(d => d.downloads)
  const monthDays = monthData.map(d => d.downloads)
  const peakDay = monthData.reduce((best, d) => d.downloads > best.downloads ? d : best, { day: '-', downloads: 0 })

  // Growth vs previous snapshot
  const prev = history.snapshots[history.snapshots.length - 1]
  const todayGrowth = prev ? growthArrow(today, prev.today) : ''
  const weekGrowth = prev ? growthArrow(week, prev.week) : ''
  const monthGrowth = prev ? growthArrow(month, prev.month) : ''

  // Weekly average
  const weekAvg = weekDays.length > 0 ? Math.round(week / weekDays.filter(d => d > 0).length || 1) : 0

  // Projection (daily average × 30)
  const activeDays = monthDays.filter(d => d > 0).length
  const dailyAvg = activeDays > 0 ? month / activeDays : 0
  const projected30d = Math.round(dailyAvg * 30)

  // Next milestone
  const nextMilestone = MILESTONES.find(m => total < m) || total * 2

  // Clear & draw
  console.clear()
  console.log()
  console.log(`  ${c.bold}${c.magenta}◉ K:BOT npm Download Tracker${c.reset}  ${c.dim}@kernel.chat/kbot${c.reset}`)
  console.log(`  ${c.dim}${'─'.repeat(52)}${c.reset}`)
  console.log()

  // Big number
  console.log(`  ${c.bold}${c.gold}  ${formatNum(total)}${c.reset}  ${c.dim}total downloads${c.reset}`)
  console.log()

  // Stats grid
  console.log(`  ${c.cyan}Today${c.reset}      ${c.bold}${formatNum(today).padStart(8)}${c.reset}  ${todayGrowth}`)
  console.log(`  ${c.cyan}This week${c.reset}  ${c.bold}${formatNum(week).padStart(8)}${c.reset}  ${weekGrowth}`)
  console.log(`  ${c.cyan}This month${c.reset} ${c.bold}${formatNum(month).padStart(8)}${c.reset}  ${monthGrowth}`)
  console.log()

  // Sparklines
  console.log(`  ${c.dim}Week${c.reset}   ${sparkline(weekDays)}  ${c.dim}(${weekDays.join(' ')})${c.reset}`)
  console.log(`  ${c.dim}Month${c.reset}  ${sparkline(monthDays)}`)
  console.log()

  // Daily breakdown (last 7 days)
  console.log(`  ${c.bold}Daily Breakdown${c.reset}`)
  const maxDay = Math.max(...weekDays, 1)
  for (const d of weekData) {
    const dayName = new Date(d.day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    console.log(`  ${c.dim}${dayName.padEnd(12)}${c.reset} ${bar(d.downloads, maxDay, 25)} ${c.bold}${String(d.downloads).padStart(6)}${c.reset}`)
  }
  console.log()

  // Insights
  console.log(`  ${c.bold}Insights${c.reset}`)
  console.log(`  ${c.dim}Peak day${c.reset}       ${peakDay.day} (${c.green}${formatNum(peakDay.downloads)}${c.reset})`)
  console.log(`  ${c.dim}Daily avg${c.reset}      ${formatNum(Math.round(dailyAvg))} / day`)
  console.log(`  ${c.dim}Week avg${c.reset}       ${formatNum(weekAvg)} / active day`)
  console.log(`  ${c.dim}30d projection${c.reset} ${c.bold}${formatNum(projected30d)}${c.reset}`)
  console.log()

  // Milestone progress
  const progress = total / nextMilestone
  console.log(`  ${c.bold}Next Milestone${c.reset}  ${formatNum(nextMilestone)}`)
  console.log(`  ${bar(total, nextMilestone, 35)} ${c.bold}${(progress * 100).toFixed(0)}%${c.reset}`)
  console.log()

  // Pace
  if (history.snapshots.length >= 2) {
    const first = history.snapshots[0]!
    const firstDate = new Date(first.timestamp)
    const daysSince = Math.max(1, (Date.now() - firstDate.getTime()) / 86_400_000)
    const dlPerDay = (total - first.total) / daysSince
    if (dlPerDay > 0) {
      const daysToMilestone = Math.ceil((nextMilestone - total) / dlPerDay)
      const eta = new Date(Date.now() + daysToMilestone * 86_400_000)
      console.log(`  ${c.dim}At current pace:${c.reset} ~${daysToMilestone} days → ${c.green}${eta.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${c.reset}`)
      console.log()
    }
  }

  // Footer
  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  if (!ONCE) {
    console.log(`  ${c.dim}Refreshing every ${POLL_INTERVAL}s · ${now} · Ctrl+C to exit${c.reset}`)
  } else {
    console.log(`  ${c.dim}Snapshot at ${now}${c.reset}`)
  }
  console.log()
}

// ─── Main Loop ───────────────────────────────────────
async function tick(): Promise<void> {
  try {
    const [today, weekData, monthData, total] = await Promise.all([
      getToday(),
      getWeek(),
      getMonth(),
      getTotal(),
    ])

    const history = loadHistory()

    // Check milestones
    for (const m of MILESTONES) {
      if (total >= m && !history.milestonesHit.includes(m)) {
        history.milestonesHit.push(m)
        const msg = `🎉 **${formatNum(m)} downloads reached!**\n\`@kernel.chat/kbot\` just hit ${m.toLocaleString()} total npm downloads.`
        console.log(`\n  🎉 MILESTONE: ${formatNum(m)} downloads!\n`)
        await notifyDiscord(msg)
      }
    }

    // Save snapshot (max 1 per minute to avoid bloat)
    const lastSnap = history.snapshots[history.snapshots.length - 1]
    const now = new Date().toISOString()
    if (!lastSnap || Date.now() - new Date(lastSnap.timestamp).getTime() > 55_000) {
      history.snapshots.push({
        timestamp: now,
        today,
        week: weekData.reduce((s, d) => s + d.downloads, 0),
        month: monthData.reduce((s, d) => s + d.downloads, 0),
        total,
      })
      // Keep last 10,000 snapshots (~7 days at 60s intervals)
      if (history.snapshots.length > 10_000) {
        history.snapshots = history.snapshots.slice(-10_000)
      }
      saveHistory(history)
    }

    render(today, weekData, monthData, total, history)
  } catch (err) {
    console.error(`  ${c.red}Error:${c.reset} ${(err as Error).message}`)
  }
}

// ─── Entry ───────────────────────────────────────────
console.log(`  ${c.dim}Fetching npm data for ${PACKAGE}...${c.reset}`)
await tick()

if (!ONCE) {
  setInterval(tick, POLL_INTERVAL * 1000)
}
