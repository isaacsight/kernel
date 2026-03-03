// ─── SystemPanel — Engine OS Dashboard ──────────────────────
//
// Bottom-sheet panel showing the system engine's view of all
// registered engines: status grid, resource bars, health
// indicators, and process list.

import { useState, useEffect, useCallback } from 'react'
import { motion, useDragControls, AnimatePresence } from 'framer-motion'
import { SPRING, TRANSITION, VARIANT } from '../constants/motion'
import type {
  SystemMetrics,
  EngineProcess,
  SystemResource,
  HealthCheck,
} from '../engine/system/types'
import { getMetrics } from '../engine/SystemEngine'

// ─── Props ──────────────────────────────────────────────────

interface SystemPanelProps {
  isOpen: boolean
  onClose: () => void
}

// ─── Helpers ────────────────────────────────────────────────

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3600_000)}h ago`
}

function statusColor(status: HealthCheck['status']): string {
  switch (status) {
    case 'healthy': return '#10B981'
    case 'degraded': return '#F59E0B'
    case 'unhealthy': return '#EF4444'
  }
}

function processStatusColor(status: EngineProcess['status']): string {
  switch (status) {
    case 'running': return '#10B981'
    case 'idle': return '#6B7280'
    case 'error': return '#EF4444'
    case 'stopped': return '#9CA3AF'
  }
}

// ─── Sub-components ─────────────────────────────────────────

function HealthDot({ status }: { status: HealthCheck['status'] }) {
  return (
    <span
      className="ka-system-health-dot"
      style={{ background: statusColor(status) }}
      title={status}
    />
  )
}

function EngineCard({ engine, health }: { engine: EngineProcess; health?: HealthCheck }) {
  return (
    <motion.div
      className={`ka-system-engine-card ka-system-engine-card--${engine.status}`}
      variants={VARIANT.STAGGER_ITEM}
    >
      <div className="ka-system-engine-card-header">
        <HealthDot status={health?.status || 'healthy'} />
        <span className="ka-system-engine-card-name">{engine.engineName}</span>
        <span
          className="ka-system-engine-card-status"
          style={{ color: processStatusColor(engine.status) }}
        >
          {engine.status}
        </span>
      </div>
      <div className="ka-system-engine-card-stats">
        <span className="ka-system-engine-card-stat">
          <span className="ka-system-engine-card-stat-label">Requests</span>
          <span className="ka-system-engine-card-stat-value">{engine.request_count}</span>
        </span>
        <span className="ka-system-engine-card-stat">
          <span className="ka-system-engine-card-stat-label">Uptime</span>
          <span className="ka-system-engine-card-stat-value">{formatUptime(engine.uptime_ms)}</span>
        </span>
        <span className="ka-system-engine-card-stat">
          <span className="ka-system-engine-card-stat-label">Last active</span>
          <span className="ka-system-engine-card-stat-value">{formatTimestamp(engine.last_activity_at)}</span>
        </span>
      </div>
      {health?.details && (
        <div className="ka-system-engine-card-details">{health.details}</div>
      )}
    </motion.div>
  )
}

function ResourceBar({ resource }: { resource: SystemResource }) {
  const pct = resource.limit > 0 ? Math.min((resource.used / resource.limit) * 100, 100) : 0
  const isWarning = pct > 75
  const isCritical = pct > 90

  return (
    <div className="ka-system-resource-row">
      <div className="ka-system-resource-header">
        <span className="ka-system-resource-name">{resource.name}</span>
        <span className="ka-system-resource-value">
          {resource.used} / {resource.limit} {resource.unit}
        </span>
      </div>
      <div className="ka-system-resource-track">
        <motion.div
          className={`ka-system-resource-fill${isWarning ? ' ka-system-resource-fill--warning' : ''}${isCritical ? ' ka-system-resource-fill--critical' : ''}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={TRANSITION.BAR_FILL}
        />
      </div>
    </div>
  )
}

function ProcessRow({ process }: { process: EngineProcess }) {
  return (
    <div className="ka-system-process-row">
      <span
        className="ka-system-process-dot"
        style={{ background: processStatusColor(process.status) }}
      />
      <span className="ka-system-process-name">{process.engineName}</span>
      <span className="ka-system-process-id">{process.id}</span>
      <span className="ka-system-process-requests">{process.request_count} req</span>
      <span
        className="ka-system-process-status"
        style={{ color: processStatusColor(process.status) }}
      >
        {process.status}
      </span>
    </div>
  )
}

// ─── Main Panel ─────────────────────────────────────────────

export function SystemPanel({ isOpen, onClose }: SystemPanelProps) {
  const dragControls = useDragControls()
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [activeTab, setActiveTab] = useState<'engines' | 'resources' | 'processes'>('engines')

  const refresh = useCallback(async () => {
    const m = await getMetrics()
    setMetrics(m)
  }, [])

  // Refresh on open and periodically
  useEffect(() => {
    if (!isOpen) return
    refresh()
    const interval = setInterval(refresh, 10_000)
    return () => clearInterval(interval)
  }, [isOpen, refresh])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="ka-system-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="ka-system-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING.DEFAULT}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.2 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 300) onClose()
            }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div
              className="ka-system-drag-handle"
              onPointerDown={(e) => dragControls.start(e)}
            />

            {/* Header */}
            <div className="ka-system-header">
              <h3 className="ka-system-title">System</h3>
              {metrics && (
                <div className="ka-system-summary">
                  <span className="ka-system-summary-item">
                    {metrics.active_engines}/{metrics.total_engines} active
                  </span>
                  <span className="ka-system-summary-sep">&middot;</span>
                  <span className="ka-system-summary-item">
                    {metrics.uptime_pct}% healthy
                  </span>
                  <span className="ka-system-summary-sep">&middot;</span>
                  <span className="ka-system-summary-item">
                    {metrics.total_requests_today} req
                  </span>
                </div>
              )}
            </div>

            {/* Metric cards */}
            {metrics && (
              <div className="ka-system-metric-cards">
                <div className="ka-system-metric-card">
                  <span className="ka-system-metric-card-value">{metrics.total_engines}</span>
                  <span className="ka-system-metric-card-label">Engines</span>
                </div>
                <div className="ka-system-metric-card">
                  <span className="ka-system-metric-card-value">{metrics.avg_latency_ms}ms</span>
                  <span className="ka-system-metric-card-label">Avg latency</span>
                </div>
                <div className="ka-system-metric-card">
                  <span className="ka-system-metric-card-value">
                    {Math.round(metrics.error_rate * 100)}%
                  </span>
                  <span className="ka-system-metric-card-label">Error rate</span>
                </div>
                <div className="ka-system-metric-card">
                  <span className="ka-system-metric-card-value">{metrics.uptime_pct}%</span>
                  <span className="ka-system-metric-card-label">Uptime</span>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="ka-system-tabs">
              {(['engines', 'resources', 'processes'] as const).map(tab => (
                <button
                  key={tab}
                  className={`ka-system-tab${activeTab === tab ? ' ka-system-tab--active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="ka-system-content">
              {activeTab === 'engines' && metrics && (
                <motion.div
                  className="ka-system-engine-grid"
                  variants={VARIANT.STAGGER_CONTAINER}
                  initial="hidden"
                  animate="visible"
                >
                  {metrics.engines.map(engine => {
                    const health = metrics.health.find(h => h.engineId === engine.engineId)
                    return (
                      <EngineCard
                        key={engine.engineId}
                        engine={engine}
                        health={health}
                      />
                    )
                  })}
                  {metrics.engines.length === 0 && (
                    <div className="ka-system-empty">No engines registered</div>
                  )}
                </motion.div>
              )}

              {activeTab === 'resources' && metrics && (
                <div className="ka-system-resource-list">
                  {metrics.resources.map(resource => (
                    <ResourceBar key={resource.name} resource={resource} />
                  ))}
                </div>
              )}

              {activeTab === 'processes' && metrics && (
                <div className="ka-system-process-list">
                  <div className="ka-system-process-header-row">
                    <span />
                    <span>Engine</span>
                    <span>PID</span>
                    <span>Requests</span>
                    <span>Status</span>
                  </div>
                  {metrics.engines.map(proc => (
                    <ProcessRow key={proc.id} process={proc} />
                  ))}
                  {metrics.engines.length === 0 && (
                    <div className="ka-system-empty">No processes running</div>
                  )}
                </div>
              )}

              {!metrics && (
                <div className="ka-system-loading">Loading system metrics...</div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
