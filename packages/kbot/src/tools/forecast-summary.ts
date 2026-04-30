// forecast-summary — wires the v5 futures/forecast substrate into a kbot tool.
//
// Reads kbot's current growth metrics (the same surface growth_summary
// produces), persists a rolling-window JSONL history at
// ~/.kbot/growth/history.jsonl, and projects each metric forward via
// synthesizeForecasts(). Returns markdown narrative + structured JSON.
//
// First substrate-to-product hop for the v4.2 forecast module. Opt-in only;
// does NOT modify growth_summary.

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { ToolDefinition } from './index.js'
import { loadGrowth, type GrowthMetrics, type GrowthEngine } from './foundation-engines.js'
import { synthesizeForecasts, narrative } from '../futures/forecast/index.js'
import {
  clampHorizon,
  signalHistory,
} from '../futures/forecast/projection.js'
import type { Forecast, Horizon, Signal } from '../futures/forecast/types.js'

const HORIZONS: ReadonlySet<Horizon> = new Set(['1d', '7d', '30d', '90d'])
const MAX_HISTORY = 90
const MIN_SAMPLES = 5

interface HistoryRecord {
  ts: number
  signals: Partial<Record<keyof GrowthMetrics, number>>
}

/** Override for tests; falls back to ~/.kbot/growth. */
function historyDir(): string {
  return process.env.KBOT_GROWTH_HISTORY_DIR ?? join(homedir(), '.kbot', 'growth')
}

function historyPath(): string {
  return join(historyDir(), 'history.jsonl')
}

/** Read history file. Skips malformed lines. Returns chronological order. */
export function readHistory(path: string = historyPath()): HistoryRecord[] {
  if (!existsSync(path)) return []
  const out: HistoryRecord[] = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const rec = JSON.parse(trimmed) as HistoryRecord
      if (typeof rec.ts === 'number' && rec.signals && typeof rec.signals === 'object') {
        out.push(rec)
      }
    } catch {
      // skip malformed
    }
  }
  out.sort((a, b) => a.ts - b.ts)
  return out
}

/** Append a record, cap to MAX_HISTORY entries. Atomic via tmp + rename. */
export function appendHistory(rec: HistoryRecord, path: string = historyPath()): void {
  const dir = path.substring(0, path.lastIndexOf('/'))
  mkdirSync(dir, { recursive: true })
  const existing = readHistory(path)
  existing.push(rec)
  // Keep only the last MAX_HISTORY records
  const kept = existing.slice(-MAX_HISTORY)
  const body = kept.map((r) => JSON.stringify(r)).join('\n') + '\n'
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmp, body, 'utf8')
  renameSync(tmp, path)
}

/**
 * Convert a list of HistoryRecord into Signal[] keyed by metric name.
 * Only emits metrics that appear in at least one record.
 */
export function buildSignals(history: HistoryRecord[]): Signal[] {
  const byMetric = new Map<string, Array<{ ts: number; value: number }>>()
  for (const rec of history) {
    for (const [name, v] of Object.entries(rec.signals)) {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue
      const arr = byMetric.get(name) ?? []
      arr.push({ ts: rec.ts, value: v })
      byMetric.set(name, arr)
    }
  }
  return [...byMetric.entries()].map(([name, values]) => ({ name, values }))
}

/** Read current growth metrics. Used to capture a fresh sample. */
function currentMetrics(): GrowthMetrics | null {
  const g: GrowthEngine | null = loadGrowth()
  if (!g) return null
  return { ...g.metrics }
}

function pickMetricsForHistory(m: GrowthMetrics): HistoryRecord['signals'] {
  // Persist every metric — the tool decides what to project at read time.
  return {
    npmDownloads: m.npmDownloads,
    githubStars: m.githubStars,
    totalUsers: m.totalUsers,
    totalMessages: m.totalMessages,
    totalStreams: m.totalStreams,
    totalStreamMinutes: m.totalStreamMinutes,
    toolsBuilt: m.toolsBuilt,
    factsLearned: m.factsLearned,
    dreamsDreamed: m.dreamsDreamed,
    techniquesDiscovered: m.techniquesDiscovered,
    worldBlocksPlaced: m.worldBlocksPlaced,
    versionsShipped: m.versionsShipped,
  }
}

function bootstrapMessage(sample: number): string {
  return [
    `# forecast_summary — bootstrapping`,
    ``,
    `forecast_summary needs at least ${MIN_SAMPLES} historical samples to project.`,
    `This is sample ${sample} of ${MIN_SAMPLES}. Re-run periodically to seed the history.`,
    ``,
    `History path: \`${historyPath()}\``,
  ].join('\n')
}

function markdownTable(forecasts: Forecast[]): string {
  if (forecasts.length === 0) return ''
  const lines: string[] = []
  lines.push('| signal | direction | point | range | confidence | method |')
  lines.push('|---|---|---|---|---|---|')
  for (const f of forecasts) {
    const dir =
      f.trend.kind === 'flat' ? 'flat' : f.trend.slope > 0 ? 'up' : 'down'
    const point = formatNum(f.pointEstimate)
    const range = `${formatNum(f.lowerBound)} – ${formatNum(f.upperBound)}`
    const conf = `${(f.confidence * 100).toFixed(0)}%`
    lines.push(`| ${f.signal} | ${dir} | ${point} | ${range} | ${conf} | ${f.method} |`)
  }
  return lines.join('\n')
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  if (abs >= 10) return n.toFixed(0)
  if (abs >= 1) return n.toFixed(1)
  return n.toFixed(2)
}

/** Run the full forecast pipeline, given a horizon and an optional clock. */
export function runForecastSummary(opts: {
  horizon?: Horizon
  now?: number
  metricsOverride?: GrowthMetrics | null
} = {}): string {
  const horizon: Horizon = opts.horizon && HORIZONS.has(opts.horizon) ? opts.horizon : '30d'
  const now = opts.now ?? Date.now()
  const metrics = opts.metricsOverride === undefined ? currentMetrics() : opts.metricsOverride
  const path = historyPath()

  // Capture a new sample if we have growth metrics to sample from.
  if (metrics) {
    appendHistory({ ts: now, signals: pickMetricsForHistory(metrics) }, path)
  }

  const history = readHistory(path)
  if (history.length < MIN_SAMPLES) {
    return bootstrapMessage(history.length)
  }

  const allSignals = buildSignals(history)
  // Identify signals too short for the requested horizon → skip + note.
  const skipped: string[] = []
  const usable: Signal[] = []
  for (const sig of allSignals) {
    if (clampHorizon(horizon, signalHistory(sig))) {
      usable.push(sig)
    } else {
      skipped.push(sig.name)
    }
  }

  const forecasts = synthesizeForecasts(usable, horizon)
  const summary = narrative(forecasts)

  const md: string[] = []
  md.push(`# forecast_summary — horizon ${horizon}`)
  md.push('')
  md.push(summary)
  md.push('')
  if (forecasts.length > 0) {
    md.push(markdownTable(forecasts))
    md.push('')
  }
  if (skipped.length > 0) {
    md.push(`> Skipped (history shorter than ${horizon}): ${skipped.join(', ')}`)
    md.push('')
  }
  md.push('```json')
  md.push(JSON.stringify({ horizon, forecasts, skipped, samples: history.length }, null, 2))
  md.push('```')
  return md.join('\n')
}

export const forecastSummaryTool: ToolDefinition = {
  name: 'forecast_summary',
  description:
    'Project kbot growth signals (npm downloads, GitHub stars, users, etc.) forward at the given horizon. Wraps the futures/forecast substrate. Returns a markdown narrative + structured JSON. Opt-in; does not run automatically.',
  parameters: {
    horizon: {
      type: 'string',
      description: 'Projection horizon: 1d, 7d, 30d, or 90d (default 30d).',
      required: false,
    },
  },
  tier: 'free',
  async execute(args) {
    const raw = typeof args.horizon === 'string' ? (args.horizon as string) : '30d'
    const horizon: Horizon = HORIZONS.has(raw as Horizon) ? (raw as Horizon) : '30d'
    return runForecastSummary({ horizon })
  },
}
