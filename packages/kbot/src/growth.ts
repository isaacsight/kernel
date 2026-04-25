// kbot growth — Make kbot's learning visible. Reads local learning artifacts
// (~/.kbot/skill-profile.json, confidence.json, evolution-state.json,
// observer/session.jsonl) and shows a week-over-week improvement report.

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import chalk from 'chalk'
import { getCriticStats, type CriticStats } from './critic-gate.js'

interface DataPaths {
  skill: string
  confidence: string
  evolution: string
  observer: string
}

function pathsFor(dataDir: string): DataPaths {
  return {
    skill: join(dataDir, 'skill-profile.json'),
    confidence: join(dataDir, 'confidence.json'),
    evolution: join(dataDir, 'evolution-state.json'),
    observer: join(dataDir, 'observer', 'session.jsonl'),
  }
}

interface ObserverEvent {
  ts: string
  tool: string
  args?: Record<string, unknown>
  session?: string
  error?: boolean
}

interface ConfidenceEntry {
  task: string
  predicted: number
  actual: number
  domain: string
  timestamp: string
}

interface SkillEntry {
  successCount: number
  failureCount: number
  totalConfidence: number
  sampleSize: number
  lastAttempt?: string
}

interface WindowStats {
  sessions: number
  toolCalls: number
  errors: number
  successRate: number
  routingAccuracy: number
  toolCounts: Record<string, number>
  agentCounts: Record<string, number>
}

interface GrowthSummary {
  betterPct: number
  days: number
  sessions: number
  toolCalls: number
  successRate: number
  routingAccuracy: number
  newPatterns: number
}

interface GrowthResult {
  summary: GrowthSummary
  metrics: Array<{ label: string; current: number; prior: number; delta: number }>
  deltas: Array<{ tool: string; current: number; prior: number; delta: number }>
  agents: Array<{ agent: string; accuracy: number; samples: number }>
  critic: CriticStats
}

function readJsonSafe<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return null
  }
}

function readObserver(observerPath: string): ObserverEvent[] {
  if (!existsSync(observerPath)) return []
  try {
    const raw = readFileSync(observerPath, 'utf8')
    const out: ObserverEvent[] = []
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        out.push(JSON.parse(line) as ObserverEvent)
      } catch {
        // skip malformed line
      }
    }
    return out
  } catch {
    return []
  }
}

function inWindow(ts: string, start: number, end: number): boolean {
  const t = Date.parse(ts)
  if (Number.isNaN(t)) return false
  return t >= start && t < end
}

function computeWindow(
  events: ObserverEvent[],
  confidence: ConfidenceEntry[],
  start: number,
  end: number,
): WindowStats {
  const sessions = new Set<string>()
  const toolCounts: Record<string, number> = {}
  const agentCounts: Record<string, number> = {}
  let toolCalls = 0
  let errors = 0
  for (const e of events) {
    if (!inWindow(e.ts, start, end)) continue
    toolCalls++
    if (e.error === true) errors++
    if (e.session) sessions.add(e.session)
    toolCounts[e.tool] = (toolCounts[e.tool] ?? 0) + 1
    const agent = typeof e.args?.['agent'] === 'string' ? (e.args['agent'] as string) : null
    if (agent) agentCounts[agent] = (agentCounts[agent] ?? 0) + 1
  }
  const successRate = toolCalls > 0 ? (toolCalls - errors) / toolCalls : 0

  // Routing accuracy: |predicted - actual| <= 0.2 counts as accurate
  let routingSamples = 0
  let routingHits = 0
  for (const c of confidence) {
    if (!inWindow(c.timestamp, start, end)) continue
    routingSamples++
    if (Math.abs(c.predicted - c.actual) <= 0.2) routingHits++
  }
  const routingAccuracy = routingSamples > 0 ? routingHits / routingSamples : 0

  return {
    sessions: sessions.size,
    toolCalls,
    errors,
    successRate,
    routingAccuracy,
    toolCounts,
    agentCounts,
  }
}

function topToolDeltas(
  current: Record<string, number>,
  prior: Record<string, number>,
  limit = 5,
): Array<{ tool: string; current: number; prior: number; delta: number }> {
  const tools = new Set([...Object.keys(current), ...Object.keys(prior)])
  const rows: Array<{ tool: string; current: number; prior: number; delta: number }> = []
  for (const t of tools) {
    const c = current[t] ?? 0
    const p = prior[t] ?? 0
    if (c + p === 0) continue
    rows.push({ tool: t, current: c, prior: p, delta: c - p })
  }
  rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  return rows.slice(0, limit)
}

function perAgentRouting(
  confidence: ConfidenceEntry[],
  start: number,
  end: number,
): Array<{ agent: string; accuracy: number; samples: number }> {
  const agg: Record<string, { hits: number; total: number }> = {}
  for (const c of confidence) {
    if (!inWindow(c.timestamp, start, end)) continue
    const domain = c.domain || 'general'
    const bucket = (agg[domain] ??= { hits: 0, total: 0 })
    bucket.total++
    if (Math.abs(c.predicted - c.actual) <= 0.2) bucket.hits++
  }
  return Object.entries(agg)
    .map(([agent, v]) => ({ agent, accuracy: v.total > 0 ? v.hits / v.total : 0, samples: v.total }))
    .sort((a, b) => b.samples - a.samples)
    .slice(0, 8)
}

function blendScore(successRate: number, routingAccuracy: number): number {
  // 60% tool success, 40% routing. Fall back to either if one is missing.
  if (successRate === 0 && routingAccuracy === 0) return 0
  if (routingAccuracy === 0) return successRate
  if (successRate === 0) return routingAccuracy
  return successRate * 0.6 + routingAccuracy * 0.4
}

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`

function bar(n: number, width = 20): string {
  const filled = Math.max(0, Math.min(width, Math.round(n * width)))
  return chalk.cyan('█'.repeat(filled)) + chalk.dim('░'.repeat(width - filled))
}

function renderNotEnoughData(): string {
  return [
    '',
    `  ${chalk.bold('kbot growth')}`,
    `  ${chalk.dim('─'.repeat(40))}`,
    '',
    `  ${chalk.yellow('Not enough data yet.')}`,
    '',
    `  kbot learns from your sessions. To seed it:`,
    `    • Run ${chalk.bold('kbot')} on real work for a few days`,
    `    • Let the observer log tool calls to ${chalk.dim('~/.kbot/observer/session.jsonl')}`,
    `    • Re-run ${chalk.bold('kbot growth')} after ~3 sessions`,
    '',
  ].join('\n')
}

function renderPretty(result: GrowthResult): string {
  const s = result.summary
  const lines: string[] = []
  lines.push('')
  lines.push(`  ${chalk.bold('kbot growth')}  ${chalk.dim(`— last ${s.days} days vs prior ${s.days}`)}`)
  lines.push(`  ${chalk.dim('─'.repeat(60))}`)
  lines.push('')

  const headlineColor = s.betterPct >= 0 ? chalk.green : chalk.red
  const sign = s.betterPct >= 0 ? '+' : ''
  lines.push(
    `  ${chalk.bold('kbot is')} ${headlineColor.bold(`${sign}${s.betterPct.toFixed(1)}%`)} ${chalk.bold('better at your tasks this week')}`,
  )
  lines.push('')

  // Core metrics table
  lines.push(`  ${chalk.bold('Metrics')}`)
  lines.push(`  ${chalk.dim('─'.repeat(60))}`)
  for (const m of result.metrics) {
    const arrow = m.delta > 0 ? chalk.green('▲') : m.delta < 0 ? chalk.red('▼') : chalk.dim('·')
    const isRate = m.label.includes('rate') || m.label.includes('accuracy')
    const cur = isRate ? pct(m.current) : String(Math.round(m.current))
    const prev = isRate ? pct(m.prior) : String(Math.round(m.prior))
    const deltaStr = isRate
      ? `${m.delta >= 0 ? '+' : ''}${(m.delta * 100).toFixed(1)}pp`
      : `${m.delta >= 0 ? '+' : ''}${Math.round(m.delta)}`
    lines.push(`  ${arrow} ${m.label.padEnd(24)} ${cur.padStart(8)}  ${chalk.dim(`prev ${prev}`)}  ${chalk.bold(deltaStr)}`)
  }
  lines.push('')

  // Tool deltas
  if (result.deltas.length > 0) {
    lines.push(`  ${chalk.bold('Top tools by usage delta')}`)
    lines.push(`  ${chalk.dim('─'.repeat(60))}`)
    for (const d of result.deltas) {
      const arrow = d.delta > 0 ? chalk.green('▲') : d.delta < 0 ? chalk.red('▼') : chalk.dim('·')
      const deltaStr = `${d.delta >= 0 ? '+' : ''}${d.delta}`
      lines.push(
        `  ${arrow} ${d.tool.padEnd(30)} ${String(d.current).padStart(5)}  ${chalk.dim(`prev ${d.prior}`)}  ${chalk.bold(deltaStr)}`,
      )
    }
    lines.push('')
  }

  // Per-agent routing
  if (result.agents.length > 0) {
    lines.push(`  ${chalk.bold('Per-domain routing accuracy')}`)
    lines.push(`  ${chalk.dim('─'.repeat(60))}`)
    for (const a of result.agents) {
      lines.push(
        `  ${a.agent.padEnd(16)} ${bar(a.accuracy)}  ${pct(a.accuracy).padStart(6)}  ${chalk.dim(`n=${a.samples}`)}`,
      )
    }
    lines.push('')
  }

  // Critic gate — aggregate (no window split yet; verdicts are append-only)
  if (result.critic.total > 0) {
    lines.push(`  ${chalk.bold('Critic gate')}  ${chalk.dim(`— ${result.critic.total} non-trivial verdicts`)}`)
    lines.push(`  ${chalk.dim('─'.repeat(60))}`)
    lines.push(
      `  accept rate           ${pct(result.critic.acceptRate).padStart(8)}  ${chalk.dim(`(${result.critic.accepted} accept / ${result.critic.rejected} reject)`)}`,
    )
    const topReject = result.critic.topRejectReasons[0]
    if (topReject) {
      lines.push(`  top reject            ${chalk.dim(`[${topReject.count}]`)} ${topReject.reason.slice(0, 50)}`)
    }
    const failureClasses = Object.entries(result.critic.byFailureClass)
      .sort((a, b) => b[1] - a[1]).slice(0, 3)
    if (failureClasses.length > 0) {
      const summary = failureClasses.map(([cls, n]) => `${cls}=${n}`).join('  ')
      lines.push(`  ${chalk.dim(`failure classes: ${summary}`)}`)
    }
    lines.push('')
  }

  lines.push(`  ${chalk.dim(`New patterns learned: ${s.newPatterns}`)}`)
  lines.push('')
  return lines.join('\n')
}

export function runGrowth(opts: { json?: boolean; days?: number; dataDir?: string; now?: number } = {}): GrowthResult | null {
  const days = Math.max(1, Math.floor(opts.days ?? 7))
  const now = opts.now ?? Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const currentStart = now - days * dayMs
  const priorStart = now - 2 * days * dayMs
  const paths = pathsFor(opts.dataDir ?? join(homedir(), '.kbot'))

  const events = readObserver(paths.observer)
  const confidenceRaw = readJsonSafe<{ entries?: ConfidenceEntry[] }>(paths.confidence)
  const confidence = confidenceRaw?.entries ?? []
  const skillRaw = readJsonSafe<{ skills?: Record<string, SkillEntry> }>(paths.skill)
  const skills = skillRaw?.skills ?? {}
  // evolution state is read to surface future signals; currently used only as a
  // signal that the file exists and kbot has evolved behaviours.
  const evolution = readJsonSafe<{ techniques?: unknown[] }>(paths.evolution)

  if (events.length === 0 && confidence.length === 0 && Object.keys(skills).length === 0) {
    if (opts.json) {
      process.stdout.write(JSON.stringify({ summary: null, metrics: [], deltas: [] }, null, 2) + '\n')
    } else {
      process.stdout.write(renderNotEnoughData() + '\n')
    }
    return null
  }

  const cur = computeWindow(events, confidence, currentStart, now)
  const prior = computeWindow(events, confidence, priorStart, currentStart)

  // "Better by N%": compare blended score now vs prior, as a relative lift.
  const curBlend = blendScore(cur.successRate, cur.routingAccuracy)
  const priBlend = blendScore(prior.successRate, prior.routingAccuracy)
  const betterPct = priBlend > 0 ? ((curBlend - priBlend) / priBlend) * 100 : curBlend > 0 ? 100 : 0

  // New patterns learned: skills whose lastAttempt is in the current window.
  let newPatterns = 0
  for (const entry of Object.values(skills)) {
    if (entry.lastAttempt && inWindow(entry.lastAttempt, currentStart, now)) newPatterns++
  }
  // Plus unique new domains appearing in confidence in current window but not prior.
  const priorDomains = new Set(
    confidence.filter((c) => inWindow(c.timestamp, priorStart, currentStart)).map((c) => c.domain),
  )
  const newDomains = new Set(
    confidence
      .filter((c) => inWindow(c.timestamp, currentStart, now))
      .map((c) => c.domain)
      .filter((d) => !priorDomains.has(d)),
  )
  newPatterns += newDomains.size
  void evolution // evolution data reserved for future deltas

  const summary: GrowthSummary = {
    betterPct,
    days,
    sessions: cur.sessions,
    toolCalls: cur.toolCalls,
    successRate: cur.successRate,
    routingAccuracy: cur.routingAccuracy,
    newPatterns,
  }

  const metrics = [
    { label: 'sessions', current: cur.sessions, prior: prior.sessions, delta: cur.sessions - prior.sessions },
    { label: 'tool calls', current: cur.toolCalls, prior: prior.toolCalls, delta: cur.toolCalls - prior.toolCalls },
    { label: 'tool success rate', current: cur.successRate, prior: prior.successRate, delta: cur.successRate - prior.successRate },
    { label: 'routing accuracy', current: cur.routingAccuracy, prior: prior.routingAccuracy, delta: cur.routingAccuracy - prior.routingAccuracy },
  ]

  const deltas = topToolDeltas(cur.toolCounts, prior.toolCounts, 5)
  const agents = perAgentRouting(confidence, currentStart, now)
  const critic = getCriticStats()

  const result: GrowthResult = { summary, metrics, deltas, agents, critic }

  if (opts.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    return result
  }
  process.stdout.write(renderPretty(result) + '\n')
  return result
}
