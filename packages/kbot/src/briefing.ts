// kbot Morning Briefing — Your daily intelligence report
//
// Synthesizes everything kbot knows into one actionable overview:
//   - Market: prices, alerts, portfolio status
//   - Security: memory integrity, recent incidents
//   - Code: active project status, recent patterns
//   - Growth: session stats, efficiency trends
//   - Daemon: subsystem health, notifications
//
// Run: kbot briefing
// The daemon can auto-generate this at configurable times.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import chalk from 'chalk'

const DIM = chalk.dim
const BOLD = chalk.bold
const GREEN = chalk.green
const RED = chalk.red
const YELLOW = chalk.yellow
const CYAN = chalk.cyan

// ── Briefing Generation ──

export async function generateBriefing(): Promise<string> {
  const lines: string[] = []
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  lines.push('')
  lines.push(`  ${BOLD(`${greeting}. Here's your kbot briefing.`)}`)
  lines.push(`  ${DIM(now.toISOString().split('T')[0])}`)
  lines.push('')

  // ── Market ──
  try {
    lines.push(`  ${BOLD('Market')}`)
    lines.push(`  ${DIM('─'.repeat(50))}`)

    // Fear & Greed
    const fgRes = await fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(5000) })
    const fg = await fgRes.json() as any
    if (fg.data?.[0]) {
      const val = Number(fg.data[0].value)
      const label = fg.data[0].value_classification
      const icon = val <= 25 ? '😱' : val <= 45 ? '😟' : val <= 55 ? '😐' : val <= 75 ? '😊' : '🤑'
      lines.push(`  Fear & Greed: ${val}/100 ${icon} (${label})`)
    }

    // BTC + ETH + SOL quick prices
    const priceRes = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true',
      { signal: AbortSignal.timeout(5000) }
    )
    const prices = await priceRes.json() as any

    if (prices.bitcoin) {
      const btc = prices.bitcoin
      const eth = prices.ethereum
      const sol = prices.solana
      const fmtPrice = (p: number) => p >= 1000 ? `$${Math.round(p).toLocaleString()}` : `$${p.toFixed(2)}`
      const fmtChange = (c: number) => {
        const s = c >= 0 ? `+${c.toFixed(1)}%` : `${c.toFixed(1)}%`
        return c >= 0 ? GREEN(s) : RED(s)
      }

      lines.push(`  BTC ${fmtPrice(btc.usd)} ${fmtChange(btc.usd_24h_change)}  ETH ${fmtPrice(eth.usd)} ${fmtChange(eth.usd_24h_change)}  SOL ${fmtPrice(sol.usd)} ${fmtChange(sol.usd_24h_change)}`)
    }

    // Price alerts
    const alertPath = join(homedir(), '.kbot', 'price-alerts.json')
    if (existsSync(alertPath)) {
      const alerts = JSON.parse(readFileSync(alertPath, 'utf-8'))
      if (alerts.length > 0) {
        lines.push(`  ${DIM(`${alerts.length} active price alert(s)`)}`)
      }
    }

    // Paper portfolio
    const portfolioPath = join(homedir(), '.kbot', 'paper-portfolio.json')
    if (existsSync(portfolioPath)) {
      const portfolio = JSON.parse(readFileSync(portfolioPath, 'utf-8'))
      if (portfolio.positions?.length > 0) {
        const totalPnl = (portfolio.trades || []).reduce((s: number, t: any) => s + (t.pnl || 0), 0)
        const pnlStr = totalPnl >= 0 ? GREEN(`+$${totalPnl.toFixed(2)}`) : RED(`-$${Math.abs(totalPnl).toFixed(2)}`)
        lines.push(`  Paper portfolio: ${portfolio.positions.length} position(s), ${pnlStr} realized P&L`)
      }
    }

    lines.push('')
  } catch {
    lines.push(`  ${DIM('Market data unavailable')}`)
    lines.push('')
  }

  // ── Security ──
  try {
    lines.push(`  ${BOLD('Security')}`)
    lines.push(`  ${DIM('─'.repeat(50))}`)

    const { verifyMemoryIntegrity, getIncidents } = await import('./self-defense.js')
    const integrity = verifyMemoryIntegrity()
    const tampered = integrity.filter(m => m.status === 'tampered')
    const incidents = getIncidents(5)
    const recentIncidents = incidents.filter(i => {
      const age = Date.now() - new Date(i.timestamp).getTime()
      return age < 24 * 60 * 60 * 1000 // last 24h
    })

    if (tampered.length > 0) {
      lines.push(`  ${RED(`⚠ ${tampered.length} memory file(s) tampered!`)} Run \`kbot defense audit\``)
    } else {
      lines.push(`  ${GREEN('✓')} Memory integrity intact (${integrity.length} files)`)
    }

    if (recentIncidents.length > 0) {
      lines.push(`  ${YELLOW(`${recentIncidents.length} incident(s) in last 24h`)}`)
    } else {
      lines.push(`  ${GREEN('✓')} No security incidents`)
    }

    lines.push('')
  } catch {
    lines.push(`  ${DIM('Security check unavailable')}`)
    lines.push('')
  }

  // ── Your Stats ──
  try {
    lines.push(`  ${BOLD('You')}`)
    lines.push(`  ${DIM('─'.repeat(50))}`)

    const { getProfile, getStats } = await import('./learning.js')
    const profile = getProfile()
    const stats = getStats()

    lines.push(`  Sessions: ${profile.sessions}  Messages: ${profile.totalMessages.toLocaleString()}  Patterns: ${stats.patternsCount}`)
    lines.push(`  Efficiency: ${stats.efficiency}  Tokens saved: ${stats.totalTokensSaved.toLocaleString()}`)

    // Today's episodes
    const { listEpisodes } = await import('./episodic-memory.js')
    const todayEpisodes = listEpisodes(10).filter(e => e.startedAt.startsWith(now.toISOString().split('T')[0]))
    if (todayEpisodes.length > 0) {
      const totalMin = todayEpisodes.reduce((s, e) => s + e.durationMinutes, 0)
      lines.push(`  Today: ${todayEpisodes.length} session(s), ${totalMin} minutes`)
    }

    lines.push('')
  } catch {
    lines.push(`  ${DIM('Stats unavailable')}`)
    lines.push('')
  }

  // ── Daemon ──
  try {
    const { getDaemonStatus } = await import('./daemon.js')
    const daemon = getDaemonStatus()

    lines.push(`  ${BOLD('Daemon')}`)
    lines.push(`  ${DIM('─'.repeat(50))}`)

    if (daemon.running) {
      const uptime = Date.now() - new Date(daemon.startedAt).getTime()
      const uptimeHrs = Math.floor(uptime / (1000 * 60 * 60))
      const uptimeMin = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60))
      lines.push(`  ${GREEN('●')} Running (${uptimeHrs}h ${uptimeMin}m, ${daemon.cycles} cycles)`)

      const subsystems = Object.entries(daemon.subsystems)
      const errors = subsystems.filter(([, s]) => s.status === 'error')
      if (errors.length > 0) {
        lines.push(`  ${YELLOW(`${errors.length} subsystem(s) errored:`)} ${errors.map(([n]) => n).join(', ')}`)
      } else {
        lines.push(`  ${DIM('All subsystems healthy')}`)
      }

      if (daemon.alerts.length > 0) {
        lines.push(`  ${daemon.notifications} notification(s) sent`)
      }
    } else {
      lines.push(`  ${RED('●')} Not running — start with \`kbot daemon start\``)
    }

    lines.push('')
  } catch {
    lines.push(`  ${DIM('Daemon not configured')}`)
    lines.push('')
  }

  // ── Hardware ──
  try {
    const { detectHardwareTier } = await import('./inference.js')
    const hw = detectHardwareTier()

    lines.push(`  ${BOLD('Hardware')}`)
    lines.push(`  ${DIM('─'.repeat(50))}`)
    lines.push(`  Tier: ${hw.tier.toUpperCase()} — ${hw.description}`)
    lines.push(`  Max model: ${hw.maxModelParams}`)
    lines.push('')
  } catch {
    // skip
  }

  // ── What to do ──
  lines.push(`  ${BOLD('Suggested Actions')}`)
  lines.push(`  ${DIM('─'.repeat(50))}`)

  const suggestions: string[] = []

  // Check if daemon is running
  try {
    const { getDaemonStatus } = await import('./daemon.js')
    if (!getDaemonStatus().running) suggestions.push('Start the daemon: `kbot daemon start`')
  } catch { /* skip */ }

  // Check if models are downloaded
  try {
    const { listLocalModels } = await import('./inference.js')
    if (listLocalModels().length === 0) suggestions.push('Download a local model: `kbot models pull qwen3-7b`')
  } catch { /* skip */ }

  // Check memory signatures
  try {
    const { verifyMemoryIntegrity } = await import('./self-defense.js')
    const results = verifyMemoryIntegrity()
    const unsigned = results.filter(r => r.status === 'new')
    if (unsigned.length > 0) suggestions.push('Sign memory files: `kbot defense sign`')
  } catch { /* skip */ }

  if (suggestions.length === 0) {
    lines.push(`  ${GREEN('✓')} All systems operational. You're good.`)
  } else {
    for (const s of suggestions) {
      lines.push(`  → ${s}`)
    }
  }

  lines.push('')
  return lines.join('\n')
}
