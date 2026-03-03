// ─── RoutingInsightsPanel — Agent Performance & Routing ──────────
//
// Bottom-sheet showing agent performance data, routing patterns,
// and weight visualization. Allows manual routing optimization.

import { useMemo } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { SPRING } from '../constants/motion'
import {
  IconClose,
  IconChart,
  IconRefresh,
  IconTrendingUp,
  IconActivity,
} from './KernelIcons'
import type { BackgroundAgent, BackgroundAgentRun, RoutingWeights } from '../engine/autonomous/types'

interface RoutingInsightsPanelProps {
  agents: BackgroundAgent[]
  runs: BackgroundAgentRun[]
  routingWeights: RoutingWeights[]
  lastOptimizedAt: string | null
  onOptimize: () => void
  onClose: () => void
}

export function RoutingInsightsPanel({
  agents,
  runs,
  routingWeights,
  lastOptimizedAt,
  onOptimize,
  onClose,
}: RoutingInsightsPanelProps) {
  const dragControls = useDragControls()

  // Aggregate performance per agent
  const agentPerformance = useMemo(() => {
    const perfMap = new Map<string, {
      name: string
      totalRuns: number
      completedRuns: number
      failedRuns: number
      avgDuration: number
      successRate: number
    }>()

    for (const agent of agents) {
      const agentRuns = runs.filter(r => r.agent_id === agent.id)
      const completed = agentRuns.filter(r => r.status === 'completed')
      const failed = agentRuns.filter(r => r.status === 'failed')
      const avgDuration = completed.length > 0
        ? completed.reduce((sum, r) => sum + r.duration_ms, 0) / completed.length
        : 0
      const successRate = agentRuns.length > 0
        ? completed.length / agentRuns.length
        : 0

      perfMap.set(agent.id, {
        name: agent.name,
        totalRuns: agentRuns.length,
        completedRuns: completed.length,
        failedRuns: failed.length,
        avgDuration,
        successRate,
      })
    }

    return perfMap
  }, [agents, runs])

  // Group routing weights by intent type
  const weightsByIntent = useMemo(() => {
    const grouped = new Map<string, { agent_id: string; weight: number; sample_count: number }[]>()
    for (const w of routingWeights) {
      const list = grouped.get(w.intent_type) || []
      list.push({ agent_id: w.agent_id, weight: w.weight, sample_count: w.sample_count })
      grouped.set(w.intent_type, list)
    }
    // Sort each group by weight descending
    for (const [, list] of grouped) {
      list.sort((a, b) => b.weight - a.weight)
    }
    return grouped
  }, [routingWeights])

  const maxWeight = useMemo(() =>
    Math.max(...routingWeights.map(w => w.weight), 1),
    [routingWeights]
  )

  return (
    <motion.div
      className="ka-routing-panel"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={SPRING.DEFAULT}
      drag="y"
      dragControls={dragControls}
      dragConstraints={{ top: 0 }}
      dragElastic={0.1}
      onDragEnd={(_, info) => {
        if (info.offset.y > 100) onClose()
      }}
    >
      {/* Handle */}
      <div className="ka-routing-handle" onPointerDown={(e) => dragControls.start(e)}>
        <div className="ka-routing-handle-bar" />
      </div>

      {/* Header */}
      <div className="ka-routing-header">
        <h3 className="ka-routing-title">
          <IconChart size={16} />
          Routing Insights
        </h3>
        <div className="ka-routing-header-actions">
          <button className="ka-routing-btn ka-routing-btn--optimize" onClick={onOptimize}>
            <IconRefresh size={12} />
            Optimize
          </button>
          <button className="ka-routing-close" onClick={onClose} aria-label="Close">
            <IconClose size={14} />
          </button>
        </div>
      </div>

      {lastOptimizedAt && (
        <p className="ka-routing-last-optimized">
          Last optimized: {new Date(lastOptimizedAt).toLocaleString()}
        </p>
      )}

      {/* Agent Performance */}
      <div className="ka-routing-section">
        <h4 className="ka-routing-section-title">
          <IconActivity size={14} />
          Agent Performance
        </h4>
        {agentPerformance.size === 0 ? (
          <p className="ka-routing-empty">No agent data yet. Run agents to see performance.</p>
        ) : (
          <div className="ka-routing-perf-list">
            {Array.from(agentPerformance.entries()).map(([id, perf]) => (
              <div key={id} className="ka-routing-perf-item">
                <div className="ka-routing-perf-header">
                  <span className="ka-routing-perf-name">{perf.name}</span>
                  <span className="ka-routing-perf-runs">{perf.totalRuns} runs</span>
                </div>
                <div className="ka-routing-perf-bars">
                  <div className="ka-routing-perf-bar">
                    <span className="ka-routing-perf-bar-label">Success</span>
                    <div className="ka-routing-perf-bar-track">
                      <div
                        className="ka-routing-perf-bar-fill ka-routing-perf-bar-fill--success"
                        style={{ width: `${Math.round(perf.successRate * 100)}%` }}
                      />
                    </div>
                    <span className="ka-routing-perf-bar-value">{Math.round(perf.successRate * 100)}%</span>
                  </div>
                  <div className="ka-routing-perf-bar">
                    <span className="ka-routing-perf-bar-label">Avg time</span>
                    <span className="ka-routing-perf-bar-value">{(perf.avgDuration / 1000).toFixed(1)}s</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Routing Weights */}
      <div className="ka-routing-section">
        <h4 className="ka-routing-section-title">
          <IconTrendingUp size={14} />
          Routing Weights
        </h4>
        {weightsByIntent.size === 0 ? (
          <p className="ka-routing-empty">No routing weights computed yet. Record outcomes and optimize.</p>
        ) : (
          <div className="ka-routing-weights-list">
            {Array.from(weightsByIntent.entries()).map(([intent, weights]) => (
              <div key={intent} className="ka-routing-weights-group">
                <span className="ka-routing-weights-intent">{intent}</span>
                {weights.map(w => {
                  const agentName = agents.find(a => a.id === w.agent_id)?.name || w.agent_id
                  return (
                    <div key={w.agent_id} className="ka-routing-weight-row">
                      <span className="ka-routing-weight-agent">{agentName}</span>
                      <div className="ka-routing-weight-bar-track">
                        <div
                          className="ka-routing-weight-bar-fill"
                          style={{ width: `${Math.round((w.weight / maxWeight) * 100)}%` }}
                        />
                      </div>
                      <span className="ka-routing-weight-value">
                        {w.weight.toFixed(2)} <span className="ka-routing-weight-samples">({w.sample_count})</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
