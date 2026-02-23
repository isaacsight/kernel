// ─── Pro Usage Dashboard ─────────────────────────────────────
//
// Bottom sheet panel showing usage analytics for Pro subscribers.
// Accessible from MoreMenu → "Usage".

import { useEffect } from 'react'
import { IconClose, IconChart, IconZap, IconTrendingUp } from './KernelIcons'
import { useUsageDashboard } from '../hooks/useUsageDashboard'

interface UsageDashboardProps {
  onClose: () => void
}

function formatCost(cost: number): string {
  return cost < 0.01 ? '<$0.01' : `$${cost.toFixed(2)}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function UsageDashboard({ onClose }: UsageDashboardProps) {
  const { data, isLoading, error, fetch: fetchData } = useUsageDashboard()

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (isLoading) {
    return (
      <div className="usage-panel">
        <div className="usage-header">
          <div className="usage-title"><IconChart size={18} /> <span>Usage</span></div>
          <button className="usage-close" onClick={onClose}><IconClose size={18} /></button>
        </div>
        <div className="usage-loading">Loading usage data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="usage-panel">
        <div className="usage-header">
          <div className="usage-title"><IconChart size={18} /> <span>Usage</span></div>
          <button className="usage-close" onClick={onClose}><IconClose size={18} /></button>
        </div>
        <div className="usage-loading">{error}</div>
      </div>
    )
  }

  if (!data) return null

  const { summary } = data
  const maxDaily = Math.max(...summary.dailyUsage.map(d => d.requests), 1)

  return (
    <div className="usage-panel">
      <div className="usage-header">
        <div className="usage-title"><IconChart size={18} /> <span>Usage</span></div>
        <button className="usage-close" onClick={onClose}><IconClose size={18} /></button>
      </div>

      {/* Key Metrics */}
      <div className="usage-metrics">
        <div className="usage-metric">
          <IconZap size={16} />
          <div className="usage-metric-val">{summary.totalRequests.toLocaleString()}</div>
          <div className="usage-metric-label">Requests</div>
        </div>
        <div className="usage-metric">
          <IconTrendingUp size={16} />
          <div className="usage-metric-val">{formatTokens(summary.totalTokens.input + summary.totalTokens.output)}</div>
          <div className="usage-metric-label">Tokens</div>
        </div>
        <div className="usage-metric">
          <IconChart size={16} />
          <div className="usage-metric-val">{formatCost(summary.estimatedCost)}</div>
          <div className="usage-metric-label">Est. Cost</div>
        </div>
      </div>

      {/* Token Breakdown */}
      <div className="usage-section">
        <h3 className="usage-section-title">Token Breakdown</h3>
        <div className="usage-token-row">
          <span className="usage-token-label">Input</span>
          <span className="usage-token-val">{formatTokens(summary.totalTokens.input)}</span>
        </div>
        <div className="usage-token-row">
          <span className="usage-token-label">Output</span>
          <span className="usage-token-val">{formatTokens(summary.totalTokens.output)}</span>
        </div>
      </div>

      {/* Top Agents */}
      {summary.topAgents.length > 0 && (
        <div className="usage-section">
          <h3 className="usage-section-title">Top Agents</h3>
          <div className="usage-agents">
            {summary.topAgents.slice(0, 5).map(({ agentId, count }) => {
              const total = summary.topAgents.reduce((s, a) => s + a.count, 0)
              const pct = Math.round((count / total) * 100)
              return (
                <div key={agentId} className="usage-agent-row">
                  <span className="usage-agent-name">{agentId || 'unknown'}</span>
                  <div className="usage-bar-track">
                    <div className="usage-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="usage-agent-pct">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top Endpoints */}
      {summary.topEndpoints.length > 0 && (
        <div className="usage-section">
          <h3 className="usage-section-title">Top Endpoints</h3>
          <div className="usage-endpoints">
            {summary.topEndpoints.slice(0, 5).map(({ endpoint, count }) => (
              <div key={endpoint} className="usage-endpoint-row">
                <span className="usage-endpoint-name">{endpoint}</span>
                <span className="usage-endpoint-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Usage Chart */}
      {summary.dailyUsage.length > 1 && (
        <div className="usage-section">
          <h3 className="usage-section-title">Daily Requests</h3>
          <div className="usage-chart">
            {summary.dailyUsage.slice(-14).map((d, i) => (
              <div key={i} className="usage-chart-bar-wrap">
                <div
                  className="usage-chart-bar"
                  style={{ height: `${(d.requests / maxDaily) * 100}%` }}
                  title={`${d.date}: ${d.requests} requests`}
                />
                <span className="usage-chart-label">
                  {new Date(d.date + 'T00:00:00').toLocaleDateString('en', { day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {data.recentActivity.length > 0 && (
        <div className="usage-section">
          <h3 className="usage-section-title">Recent Activity</h3>
          <div className="usage-activity">
            {data.recentActivity.slice(0, 10).map((event, i) => (
              <div key={i} className="usage-activity-row">
                <span className="usage-activity-action">{event.action}</span>
                <span className="usage-activity-source">{event.source}</span>
                <span className="usage-activity-time">{timeAgo(event.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Period footer */}
      <div className="usage-footer">
        {new Date(data.period.start).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
        {' — '}
        {new Date(data.period.end).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
    </div>
  )
}
