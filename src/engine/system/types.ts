// ─── System Engine Types ─────────────────────────────────────
//
// Type definitions for the System Engine — the OS meta-layer
// that monitors, health-checks, and reports on all other engines.

export interface EngineProcess {
  id: string
  engineId: string
  engineName: string
  status: 'running' | 'idle' | 'error' | 'stopped'
  uptime_ms: number
  last_activity_at: number
  memory_usage?: number
  request_count: number
}

export interface SystemResource {
  name: string
  type: 'api_calls' | 'storage' | 'compute' | 'bandwidth'
  used: number
  limit: number
  unit: string
}

export interface HealthCheck {
  engineId: string
  engineName: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency_ms: number
  last_checked_at: number
  details?: string
}

export interface SystemMetrics {
  total_engines: number
  active_engines: number
  total_requests_today: number
  avg_latency_ms: number
  error_rate: number
  uptime_pct: number
  engines: EngineProcess[]
  resources: SystemResource[]
  health: HealthCheck[]
}
