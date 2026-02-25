import { useState } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { SPRING } from '../constants/motion'
import {
  IconClose, IconShield, IconTrendingUp, IconTrendingDown,
  IconRefresh, IconClock, IconZap, IconCheck, IconAlertTriangle,
} from './KernelIcons'
import { useReliabilityDashboard, useUserReliability, type ProviderTrend } from '../hooks/useReliabilityDashboard'

// ─── Admin Reliability Dashboard ──────────────────────────

interface ReliabilityDashboardProps {
  userId?: string
  isAdmin?: boolean
  onClose: () => void
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
  nvidia: 'NVIDIA',
}

function scoreColor(score: number): string {
  if (score >= 90) return 'var(--agent-coder)'
  if (score >= 70) return '#D97706'
  return 'var(--rubin-error)'
}

function trendIcon(trend: string) {
  if (trend === 'declining') return <IconTrendingDown size={12} />
  if (trend === 'recovering') return <IconTrendingUp size={12} />
  return null
}

function trendClass(trend: string): string {
  if (trend === 'declining') return 'ka-rel-trend-declining'
  if (trend === 'recovering') return 'ka-rel-trend-recovering'
  return 'ka-rel-trend-stable'
}

export function ReliabilityDashboard({ userId, isAdmin, onClose }: ReliabilityDashboardProps) {
  const { data, loading, error, refresh } = useReliabilityDashboard()
  const { data: userData, loading: userLoading } = useUserReliability(userId)
  const [tab, setTab] = useState<'overview' | 'providers' | 'errors'>('overview')
  const dragControls = useDragControls()

  return (
    <>
      <motion.div
        className="ka-more-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="ka-rel-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SPRING.DEFAULT}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 300) onClose()
        }}
      >
        <div className="ka-more-drag-handle" onPointerDown={(e) => dragControls.start(e)} />
        <div className="ka-rel-header">
          <div className="ka-rel-title">
            <IconShield size={18} />
            <span>Platform Reliability</span>
          </div>
          <div className="ka-rel-actions">
            <button className="ka-rel-refresh" onClick={refresh} aria-label="Refresh">
              <IconRefresh size={14} />
            </button>
            <button className="ka-rel-close" onClick={onClose}>
              <IconClose size={16} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="ka-rel-tabs">
          <button className={`ka-rel-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
            Overview
          </button>
          <button className={`ka-rel-tab ${tab === 'providers' ? 'active' : ''}`} onClick={() => setTab('providers')}>
            Providers
          </button>
          <button className={`ka-rel-tab ${tab === 'errors' ? 'active' : ''}`} onClick={() => setTab('errors')}>
            Errors
          </button>
        </div>

        <div className="ka-rel-content">
          {loading && <div className="ka-rel-loading">Loading reliability data...</div>}
          {error && <div className="ka-rel-error">{error}</div>}

          {!loading && data && tab === 'overview' && (
            <OverviewTab data={data} userData={userData} userLoading={userLoading} isAdmin={isAdmin} />
          )}
          {!loading && data && tab === 'providers' && (
            <ProvidersTab trends={data.trends} providers={data.providers} />
          )}
          {!loading && data && tab === 'errors' && (
            <ErrorsTab errors={data.recent_errors} refundAnalytics={data.refund_analytics} isAdmin={isAdmin} />
          )}
        </div>
      </motion.div>
    </>
  )
}

// ─── Overview Tab ──────────────────────────────────────────

function OverviewTab({ data, userData, userLoading, isAdmin }: {
  data: NonNullable<ReturnType<typeof useReliabilityDashboard>['data']>
  userData: ReturnType<typeof useUserReliability>['data']
  userLoading: boolean
  isAdmin?: boolean
}) {
  const retry = data.retry_stats
  const refund = data.refund_analytics
  const retrySavedPct = retry.retried > 0
    ? Math.round((retry.retry_success / retry.retried) * 100)
    : 0

  return (
    <div className="ka-rel-overview">
      {/* Key metrics */}
      <div className="ka-rel-metrics">
        <div className="ka-rel-metric">
          <span className="ka-rel-metric-value">{retry.total_messages}</span>
          <span className="ka-rel-metric-label">Messages (24h)</span>
        </div>
        <div className="ka-rel-metric">
          <span className="ka-rel-metric-value" style={{ color: scoreColor(retry.total_messages > 0 ? (retry.successful / retry.total_messages) * 100 : 100) }}>
            {retry.total_messages > 0 ? Math.round((retry.successful / retry.total_messages) * 100) : 100}%
          </span>
          <span className="ka-rel-metric-label">Success rate</span>
        </div>
        <div className="ka-rel-metric">
          <span className="ka-rel-metric-value">{retry.retried}</span>
          <span className="ka-rel-metric-label">Retries</span>
        </div>
        <div className="ka-rel-metric">
          <span className="ka-rel-metric-value" style={{ color: 'var(--agent-coder)' }}>
            {retry.retry_saved_refunds}
          </span>
          <span className="ka-rel-metric-label">Refunds saved</span>
        </div>
      </div>

      {/* Retry effectiveness */}
      {retry.retried > 0 && (
        <div className="ka-rel-card">
          <div className="ka-rel-card-title"><IconZap size={14} /> Retry effectiveness</div>
          <div className="ka-rel-bar-row">
            <div className="ka-rel-bar" style={{ width: `${retrySavedPct}%`, background: 'var(--agent-coder)' }} />
            <span>{retrySavedPct}% of retries succeeded</span>
          </div>
          <div className="ka-rel-card-detail">
            {retry.retry_saved_refunds} retries prevented refunds ({retry.retry_success}/{retry.retried} successful)
          </div>
        </div>
      )}

      {/* Provider health summary */}
      <div className="ka-rel-card">
        <div className="ka-rel-card-title"><IconShield size={14} /> Provider health</div>
        {Object.entries(data.trends).map(([provider, trend]: [string, ProviderTrend]) => (
          <div key={provider} className="ka-rel-provider-row">
            <span className="ka-rel-provider-name">{PROVIDER_LABELS[provider] ?? provider}</span>
            <span className={`ka-rel-trend-badge ${trendClass(trend.trend)}`}>
              {trendIcon(trend.trend)} {trend.trend}
            </span>
            <span className="ka-rel-provider-score" style={{ color: scoreColor(trend.score_15m) }}>
              {Math.round(trend.score_15m)}
            </span>
          </div>
        ))}
      </div>

      {/* Refund economics (admin only) */}
      {isAdmin && refund.total_refunds > 0 && (
        <div className="ka-rel-card">
          <div className="ka-rel-card-title"><IconAlertTriangle size={14} /> Refund economics (24h)</div>
          <div className="ka-rel-econ-grid">
            <div><span className="ka-rel-econ-val">{refund.total_refunds}</span> refunds</div>
            <div><span className="ka-rel-econ-val">${refund.refund_cost_usd.toFixed(2)}</span> refund cost</div>
            <div><span className="ka-rel-econ-val">{refund.refund_rate_pct}%</span> refund rate</div>
            <div><span className="ka-rel-econ-val">${refund.avg_message_cost_usd.toFixed(4)}</span> avg msg cost</div>
          </div>
        </div>
      )}

      {/* User's own reliability */}
      {!userLoading && userData && (
        <div className="ka-rel-card">
          <div className="ka-rel-card-title"><IconCheck size={14} /> Your reliability (7d)</div>
          <div className="ka-rel-user-stats">
            <span>{userData.total_messages} messages</span>
            <span style={{ color: scoreColor(userData.success_rate_pct) }}>
              {userData.success_rate_pct}% success
            </span>
            <span>{userData.refund_count} refunds</span>
          </div>
          {userData.daily_breakdown.length > 0 && (
            <div className="ka-rel-sparkline">
              {userData.daily_breakdown.slice(0, 7).reverse().map((day, i) => {
                const h = day.total > 0 ? Math.max(4, Math.round((day.total / Math.max(...userData.daily_breakdown.map(d => d.total), 1)) * 28)) : 2
                const successPct = day.total > 0 ? day.success / day.total : 1
                return (
                  <div key={i} className="ka-rel-spark-bar" title={`${day.date}: ${day.total} msgs, ${day.errors} errors`}>
                    <div
                      className="ka-rel-spark-fill"
                      style={{
                        height: h,
                        background: successPct >= 0.95 ? 'var(--agent-coder)' : successPct >= 0.8 ? '#D97706' : 'var(--rubin-error)',
                      }}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Performance */}
      {retry.avg_duration_ms > 0 && (
        <div className="ka-rel-card">
          <div className="ka-rel-card-title"><IconClock size={14} /> Response time (24h)</div>
          <div className="ka-rel-perf-row">
            <span>Average: <strong>{(retry.avg_duration_ms / 1000).toFixed(1)}s</strong></span>
            <span>P95: <strong>{(retry.p95_duration_ms / 1000).toFixed(1)}s</strong></span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Providers Tab ──────────────────────────────────────────

function ProvidersTab({ trends, providers }: {
  trends: Record<string, ProviderTrend>
  providers: Record<string, any>
}) {
  return (
    <div className="ka-rel-providers">
      {Object.entries(trends).map(([name, trend]: [string, ProviderTrend]) => {
        // Gather window data
        const w15 = providers[`${name}_15m`]
        const w1h = providers[`${name}_1h`]
        const w24h = providers[`${name}_24h`]

        return (
          <div key={name} className="ka-rel-provider-card">
            <div className="ka-rel-provider-header">
              <span className="ka-rel-provider-name">{PROVIDER_LABELS[name] ?? name}</span>
              <span className={`ka-rel-trend-badge ${trendClass(trend.trend)}`}>
                {trendIcon(trend.trend)} {trend.trend}
              </span>
            </div>
            <div className="ka-rel-score-windows">
              <ScoreWindow label="15m" score={trend.score_15m} data={w15} />
              <ScoreWindow label="1h" score={trend.score_1h} data={w1h} />
              <ScoreWindow label="24h" score={trend.score_24h} data={w24h} />
            </div>
            {trend.trend === 'declining' && (
              <div className="ka-rel-alert">
                Score dropped {Math.abs(trend.delta_15m_1h)} pts in the last 15 min — predictive routing active
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ScoreWindow({ label, score, data }: { label: string; score: number; data?: any }) {
  return (
    <div className="ka-rel-score-window">
      <div className="ka-rel-score-ring" style={{ borderColor: scoreColor(score) }}>
        <span className="ka-rel-score-num">{Math.round(score)}</span>
      </div>
      <span className="ka-rel-score-label">{label}</span>
      {data && (
        <span className="ka-rel-score-detail">
          {data.total_requests ?? 0} req, {data.error_count ?? 0} err
        </span>
      )}
    </div>
  )
}

// ─── Errors Tab ──────────────────────────────────────────────

function ErrorsTab({ errors, refundAnalytics, isAdmin }: {
  errors: Array<{ provider: string; model: string; error_type: string; http_status: number; refunded: boolean; created_at: string }>
  refundAnalytics: any
  isAdmin?: boolean
}) {
  return (
    <div className="ka-rel-errors">
      {/* Refund breakdown by provider */}
      {isAdmin && refundAnalytics.by_provider && Object.keys(refundAnalytics.by_provider).length > 0 && (
        <div className="ka-rel-card">
          <div className="ka-rel-card-title">Refunds by provider</div>
          <div className="ka-rel-breakdown">
            {Object.entries(refundAnalytics.by_provider as Record<string, number>).map(([p, count]) => (
              <div key={p} className="ka-rel-breakdown-row">
                <span>{PROVIDER_LABELS[p] ?? p}</span>
                <span className="ka-rel-breakdown-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refund breakdown by error type */}
      {isAdmin && refundAnalytics.by_error_type && Object.keys(refundAnalytics.by_error_type).length > 0 && (
        <div className="ka-rel-card">
          <div className="ka-rel-card-title">Refunds by error type</div>
          <div className="ka-rel-breakdown">
            {Object.entries(refundAnalytics.by_error_type as Record<string, number>).map(([t, count]) => (
              <div key={t} className="ka-rel-breakdown-row">
                <span>{t.replace(/_/g, ' ')}</span>
                <span className="ka-rel-breakdown-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent errors */}
      <div className="ka-rel-card">
        <div className="ka-rel-card-title">Recent errors</div>
        {errors.length === 0 ? (
          <div className="ka-rel-empty">No recent errors</div>
        ) : (
          <div className="ka-rel-error-list">
            {errors.map((err, i) => (
              <div key={i} className="ka-rel-error-row">
                <span className="ka-rel-error-provider">{PROVIDER_LABELS[err.provider] ?? err.provider}</span>
                <span className="ka-rel-error-type">{err.error_type.replace(/_/g, ' ')}</span>
                <span className="ka-rel-error-status">{err.http_status || '—'}</span>
                {err.refunded && <span className="ka-rel-error-refunded">refunded</span>}
                <span className="ka-rel-error-time">{timeAgo(err.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
