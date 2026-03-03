// ─── System Engine — OS Meta-Layer ───────────────────────────
//
// Monitors all registered engines, collects metrics, runs
// health checks, and reports resource usage. This is the
// observability layer for the entire Kernel engine system.

import { listEngines, getRegistry, getEngine } from './master/registry'
import type {
  EngineProcess,
  SystemResource,
  HealthCheck,
  SystemMetrics,
} from './system/types'

// ─── Internal State ─────────────────────────────────────────
// Tracks per-engine activity. Populated lazily as engines are
// accessed and updated via recordActivity / recordError.

interface EngineState {
  requestCount: number
  errorCount: number
  lastActivityAt: number
  lastLatencyMs: number
  startedAt: number
}

const engineStates = new Map<string, EngineState>()
const startTime = Date.now()

/** Ensure state exists for an engine ID */
function ensureState(engineId: string): EngineState {
  let state = engineStates.get(engineId)
  if (!state) {
    state = {
      requestCount: 0,
      errorCount: 0,
      lastActivityAt: Date.now(),
      lastLatencyMs: 0,
      startedAt: Date.now(),
    }
    engineStates.set(engineId, state)
  }
  return state
}

// ─── Public API: Activity Recording ─────────────────────────
// Called externally (e.g. by MasterAgent) to track engine usage.

/** Record a successful engine request */
export function recordActivity(engineId: string, latencyMs: number): void {
  const state = ensureState(engineId)
  state.requestCount++
  state.lastActivityAt = Date.now()
  state.lastLatencyMs = latencyMs
}

/** Record an engine error */
export function recordError(engineId: string): void {
  const state = ensureState(engineId)
  state.errorCount++
  state.lastActivityAt = Date.now()
}

// ─── Public API: Queries ────────────────────────────────────

/** Get the process representation for a single engine */
export function getEngineStatus(engineId: string): EngineProcess | null {
  const engine = getEngine(engineId)
  if (!engine) return null

  const state = ensureState(engineId)
  const now = Date.now()
  const idleThresholdMs = 5 * 60 * 1000 // 5 minutes

  const isRecent = (now - state.lastActivityAt) < idleThresholdMs
  const hasErrors = state.errorCount > state.requestCount * 0.5

  let status: EngineProcess['status'] = 'idle'
  if (hasErrors) status = 'error'
  else if (isRecent && state.requestCount > 0) status = 'running'

  return {
    id: `proc_${engineId}`,
    engineId,
    engineName: engine.capability.name,
    status,
    uptime_ms: now - state.startedAt,
    last_activity_at: state.lastActivityAt,
    request_count: state.requestCount,
  }
}

/** List all running engine processes */
export function listProcesses(): EngineProcess[] {
  const engines = listEngines()
  const processes: EngineProcess[] = []

  for (const cap of engines) {
    // Skip the system engine itself to avoid self-referencing
    if (cap.id === 'system') continue
    const proc = getEngineStatus(cap.id)
    if (proc) processes.push(proc)
  }

  return processes
}

/** Get current resource usage estimates */
export function getResourceUsage(): SystemResource[] {
  const registry = getRegistry()
  let totalRequests = 0
  let totalErrors = 0

  for (const [id] of registry) {
    if (id === 'system') continue
    const state = engineStates.get(id)
    if (state) {
      totalRequests += state.requestCount
      totalErrors += state.errorCount
    }
  }

  return [
    {
      name: 'Claude API calls',
      type: 'api_calls',
      used: totalRequests,
      limit: 1000,
      unit: 'calls/day',
    },
    {
      name: 'Error budget',
      type: 'compute',
      used: totalErrors,
      limit: Math.max(50, Math.round(totalRequests * 0.1)),
      unit: 'errors',
    },
    {
      name: 'Session uptime',
      type: 'compute',
      used: Math.round((Date.now() - startTime) / 1000),
      limit: 86400,
      unit: 'seconds',
    },
    {
      name: 'Active engines',
      type: 'compute',
      used: listProcesses().filter(p => p.status === 'running').length,
      limit: registry.size - 1, // exclude system engine
      unit: 'engines',
    },
  ]
}

/** Run health checks against all registered engines */
export async function healthCheck(): Promise<HealthCheck[]> {
  const engines = listEngines()
  const checks: HealthCheck[] = []

  for (const cap of engines) {
    if (cap.id === 'system') continue

    const state = engineStates.get(cap.id)
    const now = Date.now()

    let status: HealthCheck['status'] = 'healthy'
    let latency = 0
    let details: string | undefined

    if (state) {
      latency = state.lastLatencyMs
      const errorRate = state.requestCount > 0
        ? state.errorCount / state.requestCount
        : 0
      const staleThreshold = 30 * 60 * 1000 // 30 minutes

      if (errorRate > 0.5) {
        status = 'unhealthy'
        details = `High error rate: ${Math.round(errorRate * 100)}%`
      } else if (errorRate > 0.1) {
        status = 'degraded'
        details = `Elevated error rate: ${Math.round(errorRate * 100)}%`
      } else if (latency > 10000) {
        status = 'degraded'
        details = `High latency: ${latency}ms`
      } else if (state.requestCount === 0 && (now - state.startedAt) > staleThreshold) {
        status = 'healthy'
        details = 'No requests yet'
      }
    } else {
      details = 'Not yet initialized'
    }

    checks.push({
      engineId: cap.id,
      engineName: cap.name,
      status,
      latency_ms: latency,
      last_checked_at: now,
      details,
    })
  }

  return checks
}

/** Collect comprehensive system metrics */
export async function getMetrics(): Promise<SystemMetrics> {
  const processes = listProcesses()
  const resources = getResourceUsage()
  const health = await healthCheck()

  const activeEngines = processes.filter(p => p.status === 'running').length
  const totalRequests = processes.reduce((sum, p) => sum + p.request_count, 0)

  // Compute average latency across engines that have been used
  let totalLatency = 0
  let latencyCount = 0
  for (const [id] of getRegistry()) {
    if (id === 'system') continue
    const state = engineStates.get(id)
    if (state && state.requestCount > 0) {
      totalLatency += state.lastLatencyMs
      latencyCount++
    }
  }
  const avgLatency = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0

  // Error rate
  let totalErrors = 0
  for (const [id] of getRegistry()) {
    if (id === 'system') continue
    const state = engineStates.get(id)
    if (state) totalErrors += state.errorCount
  }
  const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0

  // Uptime percentage (based on healthy engines)
  const healthyCount = health.filter(h => h.status === 'healthy').length
  const uptimePct = health.length > 0 ? (healthyCount / health.length) * 100 : 100

  return {
    total_engines: processes.length,
    active_engines: activeEngines,
    total_requests_today: totalRequests,
    avg_latency_ms: avgLatency,
    error_rate: Math.round(errorRate * 1000) / 1000,
    uptime_pct: Math.round(uptimePct * 10) / 10,
    engines: processes,
    resources,
    health,
  }
}
