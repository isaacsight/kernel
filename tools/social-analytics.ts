#!/usr/bin/env npx tsx
// Social Analytics Tracker — Track revenue and growth metrics
//
// Usage:
//   npx tsx tools/social-analytics.ts log          # Log today's metrics interactively
//   npx tsx tools/social-analytics.ts view          # View dashboard
//   npx tsx tools/social-analytics.ts view --week   # Weekly summary
//   npx tsx tools/social-analytics.ts view --month  # Monthly summary
//   npx tsx tools/social-analytics.ts export        # Export as CSV
//
// Stores data in ~/.kbot/social-metrics.json

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createInterface } from 'readline'
import { homedir } from 'os'

const DATA_DIR = join(homedir(), '.kbot')
const DATA_FILE = join(DATA_DIR, 'social-metrics.json')

interface DailyMetrics {
  date: string // YYYY-MM-DD
  x_followers: number
  x_impressions: number
  x_engagement_rate: number // percentage
  tiktok_followers: number
  tiktok_views: number
  newsletter_subs: number
  gumroad_revenue: number // dollars
  affiliate_revenue: number
  sponsor_revenue: number
  pro_subs: number // kernel.chat Pro subscriber count
  pro_revenue: number
  github_stars: number
  total_revenue: number
  notes: string
}

function loadData(): DailyMetrics[] {
  if (!existsSync(DATA_FILE)) return []
  return JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
}

function saveData(data: DailyMetrics[]) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

async function askQuestion(rl: ReturnType<typeof createInterface>, question: string, defaultVal: string = '0'): Promise<string> {
  return new Promise(resolve => {
    rl.question(`${question} [${defaultVal}]: `, answer => {
      resolve(answer.trim() || defaultVal)
    })
  })
}

async function logMetrics() {
  const rl = createInterface({ input: process.stdin, output: process.stderr })
  const data = loadData()
  const lastEntry = data[data.length - 1]
  const defaults = lastEntry ?? {} as Partial<DailyMetrics>

  console.error('\n  Social Metrics Logger')
  console.error('  ' + '='.repeat(40))
  console.error(`  Date: ${today()}\n`)

  const metrics: DailyMetrics = {
    date: today(),
    x_followers: parseInt(await askQuestion(rl, '  X followers', String(defaults.x_followers ?? 0))),
    x_impressions: parseInt(await askQuestion(rl, '  X impressions (today)', '0')),
    x_engagement_rate: parseFloat(await askQuestion(rl, '  X engagement rate %', String(defaults.x_engagement_rate ?? 0))),
    tiktok_followers: parseInt(await askQuestion(rl, '  TikTok followers', String(defaults.tiktok_followers ?? 0))),
    tiktok_views: parseInt(await askQuestion(rl, '  TikTok views (today)', '0')),
    newsletter_subs: parseInt(await askQuestion(rl, '  Newsletter subs', String(defaults.newsletter_subs ?? 0))),
    gumroad_revenue: parseFloat(await askQuestion(rl, '  Gumroad revenue $ (today)', '0')),
    affiliate_revenue: parseFloat(await askQuestion(rl, '  Affiliate revenue $ (today)', '0')),
    sponsor_revenue: parseFloat(await askQuestion(rl, '  Sponsor revenue $ (today)', '0')),
    pro_subs: parseInt(await askQuestion(rl, '  Pro subscribers', String(defaults.pro_subs ?? 0))),
    pro_revenue: parseFloat(await askQuestion(rl, '  Pro revenue $ (today)', '0')),
    github_stars: parseInt(await askQuestion(rl, '  GitHub stars', String(defaults.github_stars ?? 0))),
    total_revenue: 0,
    notes: await askQuestion(rl, '  Notes', ''),
  }

  metrics.total_revenue = metrics.gumroad_revenue + metrics.affiliate_revenue + metrics.sponsor_revenue + metrics.pro_revenue

  // Replace existing entry for today, or append
  const existingIdx = data.findIndex(d => d.date === today())
  if (existingIdx >= 0) {
    data[existingIdx] = metrics
  } else {
    data.push(metrics)
  }

  saveData(data)
  rl.close()

  console.error(`\n  Saved. Total revenue today: $${metrics.total_revenue.toFixed(2)}`)
  console.error(`  Data file: ${DATA_FILE}\n`)
}

function viewDashboard(period: 'day' | 'week' | 'month') {
  const data = loadData()
  if (!data.length) {
    console.error('No data yet. Run: npx tsx tools/social-analytics.ts log')
    return
  }

  const now = new Date()
  let filtered: DailyMetrics[]

  if (period === 'day') {
    filtered = data.slice(-1)
  } else if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    filtered = data.filter(d => new Date(d.date) >= weekAgo)
  } else {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    filtered = data.filter(d => new Date(d.date) >= monthAgo)
  }

  if (!filtered.length) {
    console.error(`No data for ${period} period.`)
    return
  }

  const latest = filtered[filtered.length - 1]
  const first = filtered[0]

  const totalRevenue = filtered.reduce((sum, d) => sum + d.total_revenue, 0)
  const totalImpressions = filtered.reduce((sum, d) => sum + d.x_impressions, 0)
  const totalTikTokViews = filtered.reduce((sum, d) => sum + d.tiktok_views, 0)
  const followerGrowth = latest.x_followers - first.x_followers
  const ttFollowerGrowth = latest.tiktok_followers - first.tiktok_followers

  const bar = (value: number, max: number, width: number = 20) => {
    const filled = Math.min(Math.round((value / max) * width), width)
    return '█'.repeat(filled) + '░'.repeat(width - filled)
  }

  console.log('')
  console.log('  ╔══════════════════════════════════════════╗')
  console.log('  ║        K:BOT Social Dashboard            ║')
  console.log('  ╠══════════════════════════════════════════╣')
  console.log(`  ║  Period: ${period.toUpperCase().padEnd(33)}║`)
  console.log(`  ║  ${first.date} → ${latest.date}${' '.repeat(20)}║`)
  console.log('  ╠══════════════════════════════════════════╣')
  console.log('  ║  AUDIENCE                                ║')
  console.log(`  ║  X followers:       ${String(latest.x_followers).padStart(8)} (+${followerGrowth})${' '.repeat(Math.max(0, 6 - String(followerGrowth).length))}║`)
  console.log(`  ║  TikTok followers:  ${String(latest.tiktok_followers).padStart(8)} (+${ttFollowerGrowth})${' '.repeat(Math.max(0, 6 - String(ttFollowerGrowth).length))}║`)
  console.log(`  ║  Newsletter subs:   ${String(latest.newsletter_subs).padStart(8)}${' '.repeat(14)}║`)
  console.log(`  ║  GitHub stars:      ${String(latest.github_stars).padStart(8)}${' '.repeat(14)}║`)
  console.log('  ╠══════════════════════════════════════════╣')
  console.log('  ║  REACH                                   ║')
  console.log(`  ║  X impressions:     ${String(totalImpressions).padStart(8)}${' '.repeat(14)}║`)
  console.log(`  ║  TikTok views:      ${String(totalTikTokViews).padStart(8)}${' '.repeat(14)}║`)
  console.log('  ╠══════════════════════════════════════════╣')
  console.log('  ║  REVENUE                                 ║')
  console.log(`  ║  Gumroad:    $${filtered.reduce((s, d) => s + d.gumroad_revenue, 0).toFixed(2).padStart(8)}${' '.repeat(19)}║`)
  console.log(`  ║  Affiliate:  $${filtered.reduce((s, d) => s + d.affiliate_revenue, 0).toFixed(2).padStart(8)}${' '.repeat(19)}║`)
  console.log(`  ║  Sponsors:   $${filtered.reduce((s, d) => s + d.sponsor_revenue, 0).toFixed(2).padStart(8)}${' '.repeat(19)}║`)
  console.log(`  ║  Pro subs:   $${filtered.reduce((s, d) => s + d.pro_revenue, 0).toFixed(2).padStart(8)} (${latest.pro_subs} subs)${' '.repeat(Math.max(0, 8 - String(latest.pro_subs).length))}║`)
  console.log('  ╠══════════════════════════════════════════╣')
  console.log(`  ║  TOTAL:      $${totalRevenue.toFixed(2).padStart(8)}${' '.repeat(19)}║`)
  console.log('  ╚══════════════════════════════════════════╝')

  // Revenue target progress
  const targets = [100, 1000, 5000, 10000]
  const monthlyRevenue = period === 'month' ? totalRevenue : totalRevenue * (30 / Math.max(filtered.length, 1))
  console.log('')
  console.log('  Revenue Targets (est. monthly):')
  targets.forEach(t => {
    const pct = Math.min((monthlyRevenue / t) * 100, 100)
    console.log(`    $${String(t).padEnd(6)} ${bar(pct, 100)} ${pct.toFixed(0)}%`)
  })
  console.log('')
}

function exportCsv() {
  const data = loadData()
  if (!data.length) {
    console.error('No data to export.')
    return
  }

  const headers = Object.keys(data[0]).join(',')
  const rows = data.map(d => Object.values(d).join(','))
  console.log(headers)
  rows.forEach(r => console.log(r))
  console.error(`\nExported ${data.length} rows. Pipe to file: npx tsx tools/social-analytics.ts export > metrics.csv`)
}

// --- Main ---
const command = process.argv[2]
const flag = process.argv[3]

switch (command) {
  case 'log':
    logMetrics()
    break
  case 'view':
    viewDashboard(flag === '--week' ? 'week' : flag === '--month' ? 'month' : 'day')
    break
  case 'export':
    exportCsv()
    break
  default:
    console.error('K:BOT Social Analytics')
    console.error('')
    console.error('Commands:')
    console.error('  log              Log today\'s metrics')
    console.error('  view             View latest dashboard')
    console.error('  view --week      Weekly summary')
    console.error('  view --month     Monthly summary')
    console.error('  export           Export as CSV')
    console.error('')
    console.error(`Data: ${DATA_FILE}`)
}
