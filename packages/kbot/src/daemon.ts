// kbot Daemon — The Unified Background Intelligence
//
// One process. Always on. Orchestrates everything kbot does when you're not talking to it.
//
// Subsystems (each runs on its own interval):
//   1. MARKET WATCH    — check price alerts, scan sentiment (every 15 min)
//   2. SECURITY PATROL — memory integrity, dep audit on active projects (every 1 hour)
//   3. SYNTHESIS        — consolidate patterns, evolve, cross-pollinate (every 2 hours)
//   4. DISCOVERY        — scan HN/GitHub/Reddit for relevant conversations (every 1 hour)
//   5. HEALTH CHECK     — autopoietic viability, provider health (every 30 min)
//   6. EPISODIC DIGEST  — consolidate today's episodes into daily summary (every 6 hours)
//
// Run: kbot daemon start
// Stop: kbot daemon stop (writes PID file for management)
// Status: kbot daemon status
//
// The daemon is kbot's heartbeat. It's what makes kbot alive between sessions.

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { notify, type NotificationChannel } from './notifications.js'

const KBOT_DIR = join(homedir(), '.kbot')
const DAEMON_DIR = join(KBOT_DIR, 'daemon')
const PID_FILE = join(DAEMON_DIR, 'daemon.pid')
const STATE_FILE = join(DAEMON_DIR, 'state.json')
const LOG_FILE = join(DAEMON_DIR, 'daemon.log')

function ensureDir(): void {
  if (!existsSync(DAEMON_DIR)) mkdirSync(DAEMON_DIR, { recursive: true })
}

// ── Daemon State ──

export interface DaemonState {
  pid: number
  startedAt: string
  lastHeartbeat: string
  cycles: number
  subsystems: Record<string, {
    lastRun: string
    nextRun: string
    status: 'ok' | 'error' | 'running' | 'idle'
    lastError?: string
    runCount: number
  }>
  notifications: number
  alerts: string[]
}

function loadState(): DaemonState | null {
  if (!existsSync(STATE_FILE)) return null
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf-8')) } catch { return null }
}

function saveState(state: DaemonState): void {
  ensureDir()
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function log(msg: string): void {
  ensureDir()
  const line = `${new Date().toISOString()} ${msg}\n`
  try {
    const { appendFileSync } = require('node:fs')
    appendFileSync(LOG_FILE, line)
  } catch { /* best effort */ }
  if (process.env.KBOT_DAEMON_VERBOSE) console.log(line.trim())
}

// ── Subsystem Runners ──

async function runMarketWatch(state: DaemonState): Promise<void> {
  const sub = state.subsystems['market-watch']
  sub.status = 'running'
  sub.lastRun = new Date().toISOString()
  saveState(state)

  try {
    // Check price alerts
    const alertPath = join(KBOT_DIR, 'price-alerts.json')
    if (existsSync(alertPath)) {
      const alerts = JSON.parse(readFileSync(alertPath, 'utf-8')) as Array<{
        symbol: string; above?: number; below?: number; createdAt: string
      }>

      if (alerts.length > 0) {
        const symbolMap: Record<string, string> = {
          btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin',
          ada: 'cardano', doge: 'dogecoin', xrp: 'ripple',
        }
        const symbols = [...new Set(alerts.map(a => a.symbol))]
        const ids = symbols.map(s => symbolMap[s] || s).join(',')

        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
          { signal: AbortSignal.timeout(10_000) }
        )
        const prices = await res.json() as Record<string, { usd: number }>

        const triggered: string[] = []
        const remaining = alerts.filter(alert => {
          const cgId = symbolMap[alert.symbol] || alert.symbol
          const price = prices[cgId]?.usd
          if (!price) return true // keep if can't check

          if (alert.above && price >= alert.above) {
            const msg = `${alert.symbol.toUpperCase()} hit $${price.toFixed(2)} (above $${alert.above})`
            triggered.push(msg)
            return false // remove triggered alert
          }
          if (alert.below && price <= alert.below) {
            const msg = `${alert.symbol.toUpperCase()} hit $${price.toFixed(2)} (below $${alert.below})`
            triggered.push(msg)
            return false
          }
          return true
        })

        if (triggered.length > 0) {
          writeFileSync(alertPath, JSON.stringify(remaining, null, 2))
          for (const msg of triggered) {
            log(`ALERT: ${msg}`)
            await notify({ title: 'kbot Price Alert', body: msg, channel: 'system' })
            state.notifications++
            state.alerts.push(msg)
          }
        }
      }
    }

    sub.status = 'ok'
    sub.runCount++
    log('market-watch: completed')
  } catch (err) {
    sub.status = 'error'
    sub.lastError = err instanceof Error ? err.message : String(err)
    log(`market-watch: error — ${sub.lastError}`)
  }
}

async function runSecurityPatrol(state: DaemonState): Promise<void> {
  const sub = state.subsystems['security-patrol']
  sub.status = 'running'
  sub.lastRun = new Date().toISOString()
  saveState(state)

  try {
    // Memory integrity check
    const { verifyMemoryIntegrity } = await import('./self-defense.js')
    const integrity = verifyMemoryIntegrity()
    const tampered = integrity.filter(m => m.status === 'tampered')

    if (tampered.length > 0) {
      const msg = `SECURITY: ${tampered.length} memory file(s) tampered — ${tampered.map(t => t.file).join(', ')}`
      log(msg)
      await notify({ title: 'kbot Security Alert', body: msg, channel: 'system', urgency: 'critical' })
      state.notifications++
      state.alerts.push(msg)

      // Log incident
      const { logIncident } = await import('./self-defense.js')
      logIncident('memory-tampering', 'critical', msg, 'logged')
    }

    sub.status = 'ok'
    sub.runCount++
    log('security-patrol: completed')
  } catch (err) {
    sub.status = 'error'
    sub.lastError = err instanceof Error ? err.message : String(err)
    log(`security-patrol: error — ${sub.lastError}`)
  }
}

async function runSynthesis(state: DaemonState): Promise<void> {
  const sub = state.subsystems['synthesis']
  sub.status = 'running'
  sub.lastRun = new Date().toISOString()
  saveState(state)

  try {
    const { maybeSynthesize } = await import('./memory-synthesis.js')
    await maybeSynthesize()

    // Sign memory files after synthesis (integrity baseline)
    const { signMemoryFiles } = await import('./self-defense.js')
    signMemoryFiles()

    sub.status = 'ok'
    sub.runCount++
    log('synthesis: completed')
  } catch (err) {
    sub.status = 'error'
    sub.lastError = err instanceof Error ? err.message : String(err)
    log(`synthesis: error — ${sub.lastError}`)
  }
}

async function runHealthCheck(state: DaemonState): Promise<void> {
  const sub = state.subsystems['health-check']
  sub.status = 'running'
  sub.lastRun = new Date().toISOString()
  saveState(state)

  try {
    // Check provider health
    const { getProviderHealth } = await import('./provider-fallback.js')
    const health = getProviderHealth()
    const unhealthy = Object.entries(health).filter(([, h]) => !(h as any).healthy)

    if (unhealthy.length > 0) {
      log(`health-check: ${unhealthy.length} unhealthy provider(s): ${unhealthy.map(([p]) => p).join(', ')}`)
    }

    sub.status = 'ok'
    sub.runCount++
    log('health-check: completed')
  } catch (err) {
    sub.status = 'error'
    sub.lastError = err instanceof Error ? err.message : String(err)
    log(`health-check: error — ${sub.lastError}`)
  }
}

async function runEpisodicDigest(state: DaemonState): Promise<void> {
  const sub = state.subsystems['episodic-digest']
  sub.status = 'running'
  sub.lastRun = new Date().toISOString()
  saveState(state)

  try {
    const { getEpisodeStats } = await import('./episodic-memory.js')
    const stats = getEpisodeStats()
    log(`episodic-digest: ${stats.total} episodes, ${stats.totalMinutes}min total, ${stats.totalMessages} messages`)

    sub.status = 'ok'
    sub.runCount++
    log('episodic-digest: completed')
  } catch (err) {
    sub.status = 'error'
    sub.lastError = err instanceof Error ? err.message : String(err)
    log(`episodic-digest: error — ${sub.lastError}`)
  }
}

// ── Daemon Lifecycle ──

const INTERVALS: Record<string, number> = {
  'market-watch': 15 * 60 * 1000,      // 15 minutes
  'health-check': 30 * 60 * 1000,      // 30 minutes
  'security-patrol': 60 * 60 * 1000,   // 1 hour
  'synthesis': 2 * 60 * 60 * 1000,     // 2 hours
  'episodic-digest': 6 * 60 * 60 * 1000, // 6 hours
}

const RUNNERS: Record<string, (state: DaemonState) => Promise<void>> = {
  'market-watch': runMarketWatch,
  'security-patrol': runSecurityPatrol,
  'synthesis': runSynthesis,
  'health-check': runHealthCheck,
  'episodic-digest': runEpisodicDigest,
}

/** Start the daemon — runs all subsystems on their intervals */
export async function startDaemon(): Promise<void> {
  ensureDir()

  // Check if already running
  if (existsSync(PID_FILE)) {
    const existingPid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10)
    try {
      process.kill(existingPid, 0) // Check if process exists
      console.error(`Daemon already running (PID ${existingPid}). Use 'kbot daemon stop' first.`)
      return
    } catch {
      // Process doesn't exist, clean up stale PID
      unlinkSync(PID_FILE)
    }
  }

  // Write PID
  writeFileSync(PID_FILE, String(process.pid))

  const state: DaemonState = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    cycles: 0,
    subsystems: {},
    notifications: 0,
    alerts: [],
  }

  // Initialize subsystems
  for (const [name, interval] of Object.entries(INTERVALS)) {
    const now = new Date()
    state.subsystems[name] = {
      lastRun: '',
      nextRun: new Date(now.getTime() + 5000).toISOString(), // First run in 5 seconds
      status: 'idle',
      runCount: 0,
    }
  }

  saveState(state)
  log('daemon: started')

  await notify({ title: 'kbot Daemon', body: 'Background intelligence active.', channel: 'system' })

  // Main loop
  const tick = async () => {
    state.lastHeartbeat = new Date().toISOString()
    state.cycles++
    const now = Date.now()

    for (const [name, interval] of Object.entries(INTERVALS)) {
      const sub = state.subsystems[name]
      const nextRun = new Date(sub.nextRun).getTime()

      if (now >= nextRun && sub.status !== 'running') {
        const runner = RUNNERS[name]
        if (runner) {
          try {
            await runner(state)
          } catch (err) {
            log(`daemon: ${name} crashed — ${err}`)
          }
          sub.nextRun = new Date(now + interval).toISOString()
        }
      }
    }

    saveState(state)
  }

  // Run immediately then every 60 seconds
  await tick()
  setInterval(tick, 60_000)

  // Handle shutdown
  const cleanup = () => {
    log('daemon: shutting down')
    if (existsSync(PID_FILE)) unlinkSync(PID_FILE)
    saveState(state)
    process.exit(0)
  }

  process.on('SIGTERM', cleanup)
  process.on('SIGINT', cleanup)

  // Keep alive
  log(`daemon: running (PID ${process.pid}), ${Object.keys(INTERVALS).length} subsystems`)
}

/** Stop the daemon */
export function stopDaemon(): boolean {
  if (!existsSync(PID_FILE)) return false
  const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10)
  try {
    process.kill(pid, 'SIGTERM')
    unlinkSync(PID_FILE)
    return true
  } catch {
    // Process already dead
    unlinkSync(PID_FILE)
    return false
  }
}

/** Get daemon status */
export function getDaemonStatus(): DaemonState & { running: boolean } {
  const state = loadState()
  if (!state) {
    return {
      running: false,
      pid: 0,
      startedAt: '',
      lastHeartbeat: '',
      cycles: 0,
      subsystems: {},
      notifications: 0,
      alerts: [],
    }
  }

  // Check if PID is alive
  let running = false
  if (existsSync(PID_FILE)) {
    const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10)
    try { process.kill(pid, 0); running = true } catch { /* dead */ }
  }

  return { ...state, running }
}

/** Get recent daemon log lines */
export function getDaemonLog(lines = 30): string[] {
  if (!existsSync(LOG_FILE)) return []
  return readFileSync(LOG_FILE, 'utf-8').split('\n').filter(Boolean).slice(-lines)
}
