// ─── User Stats Panel ──────────────────────────────────────
//
// Accessible from the header menu. Shows user's own usage data:
// conversations, messages, agent breakdown, knowledge graph stats.

import { useState, useEffect } from 'react'
import { X, BarChart3, MessageSquare, Brain, Users, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getUserStats, type UserStats } from '../../engine/SupabaseClient'
import { getSpecialist } from '../../agents/specialists'

interface StatsPanelProps {
  userId: string
  onClose: () => void
}

export default function StatsPanel({ userId, onClose }: StatsPanelProps) {
  const { t, i18n } = useTranslation('panels')
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUserStats(userId).then(s => {
      setStats(s)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [userId])

  if (loading) {
    return (
      <div className="stats-panel">
        <div className="stats-header">
          <div className="stats-title"><BarChart3 size={18} /> <span>{t('stats.title')}</span></div>
          <button className="stats-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="stats-loading">{t('stats.loading')}</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="stats-panel">
        <div className="stats-header">
          <div className="stats-title"><BarChart3 size={18} /> <span>{t('stats.title')}</span></div>
          <button className="stats-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="stats-loading">{t('stats.loadError')}</div>
      </div>
    )
  }

  const totalFeedback = stats.feedbackStats.helpful + stats.feedbackStats.poor + stats.feedbackStats.neutral
  const helpfulPct = totalFeedback > 0 ? Math.round((stats.feedbackStats.helpful / totalFeedback) * 100) : 0

  // Bar chart: find max for scaling
  const maxDaily = Math.max(...stats.conversationsPerDay.map(d => d.count), 1)

  const locale = i18n.language || 'en'

  return (
    <div className="stats-panel">
      <div className="stats-header">
        <div className="stats-title"><BarChart3 size={18} /> <span>{t('stats.title')}</span></div>
        <button className="stats-close" onClick={onClose}><X size={18} /></button>
      </div>

      {/* Key Metrics */}
      <div className="stats-metrics">
        <div className="stats-metric">
          <MessageSquare size={16} />
          <div className="stats-metric-val">{stats.totalMessages}</div>
          <div className="stats-metric-label">{t('stats.messages')}</div>
        </div>
        <div className="stats-metric">
          <TrendingUp size={16} />
          <div className="stats-metric-val">{stats.totalConversations}</div>
          <div className="stats-metric-label">{t('stats.conversations')}</div>
        </div>
        <div className="stats-metric">
          <Brain size={16} />
          <div className="stats-metric-val">{stats.kgEntityCount}</div>
          <div className="stats-metric-label">{t('stats.entities')}</div>
        </div>
        <div className="stats-metric">
          <Users size={16} />
          <div className="stats-metric-val">{helpfulPct}%</div>
          <div className="stats-metric-label">{t('stats.helpful')}</div>
        </div>
      </div>

      {/* Agent Breakdown */}
      {stats.agentBreakdown.length > 0 && (
        <div className="stats-section">
          <h3 className="stats-section-title">{t('stats.agentUsage')}</h3>
          <div className="stats-agents">
            {stats.agentBreakdown.slice(0, 5).map(({ agent_id, count }) => {
              const spec = getSpecialist(agent_id)
              const totalAgentMsgs = stats.agentBreakdown.reduce((s, a) => s + a.count, 0)
              const pct = Math.round((count / totalAgentMsgs) * 100)
              return (
                <div key={agent_id} className="stats-agent-row">
                  <span className="stats-agent-icon" style={{ color: spec.color }}>{spec.icon}</span>
                  <span className="stats-agent-name">{spec.name}</span>
                  <div className="stats-bar-track">
                    <div className="stats-bar-fill" style={{ width: `${pct}%`, background: spec.color }} />
                  </div>
                  <span className="stats-agent-pct">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top Entities */}
      {stats.topEntities.length > 0 && (
        <div className="stats-section">
          <h3 className="stats-section-title">{t('stats.topTopics')}</h3>
          <div className="stats-entities">
            {stats.topEntities.map((e, i) => (
              <span key={i} className="stats-entity-chip">
                {e.name}
                <span className="stats-entity-count">{e.mention_count}x</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Activity Chart */}
      {stats.conversationsPerDay.length > 1 && (
        <div className="stats-section">
          <h3 className="stats-section-title">{t('stats.activity')}</h3>
          <div className="stats-chart">
            {stats.conversationsPerDay.slice(-14).map((d, i) => (
              <div key={i} className="stats-chart-bar-wrap">
                <div
                  className="stats-chart-bar"
                  style={{ height: `${(d.count / maxDaily) * 100}%` }}
                  title={`${d.date}: ${d.count}`}
                />
                <span className="stats-chart-label">
                  {new Date(d.date + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member since */}
      {stats.joinedAt && (
        <div className="stats-footer">
          {t('stats.memberSince', { date: new Date(stats.joinedAt).toLocaleDateString(locale, { month: 'long', year: 'numeric' }) })}
        </div>
      )}
    </div>
  )
}
