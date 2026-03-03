// ─── AdaptivePanel ──────────────────────────────────────────────
//
// "How Kernel adapts to you" — Self-improving intelligence panel.
// Shows learned preferences, quality metrics, discovered insights,
// and (admin only) running A/B experiments.
//
// Uses useAdaptiveEngine hook internally — EnginePage just passes
// userId, isAdmin, onClose, onToast.

import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  IconClose,
  IconBrain,
  IconChart,
  IconSparkles,
  IconTarget,
  IconTrendingUp,
  IconTrendingDown,
  IconActivity,
  IconRefresh,
} from './KernelIcons'
import { useAdaptiveEngine } from '../hooks/useAdaptiveEngine'
import type {
  AdaptiveProfile,
  AdaptiveInsight,
  QualityMetrics,
  Experiment,
} from '../engine/adaptive/types'

// ─── Props ──────────────────────────────────────────────────

export interface AdaptivePanelProps {
  userId: string
  isAdmin?: boolean
  onClose: () => void
  onToast?: (msg: string) => void
}

type Tab = 'profile' | 'quality' | 'insights' | 'experiments'

// ─── Main Panel ─────────────────────────────────────────────

export function AdaptivePanel({
  userId,
  isAdmin = false,
  onClose,
  onToast,
}: AdaptivePanelProps) {
  const { t } = useTranslation('panels')
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  const {
    profile,
    insights,
    metrics,
    experiments,
    signalCount,
    isLoading,
    loadInsights,
    loadMetrics,
    loadExperiments,
    refreshProfile,
  } = useAdaptiveEngine(userId)

  // Load tab data on first visit
  useEffect(() => {
    if (activeTab === 'insights' && insights.length === 0) loadInsights()
    if (activeTab === 'quality' && !metrics) loadMetrics()
    if (activeTab === 'experiments' && experiments.length === 0 && isAdmin) loadExperiments()
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const tabs: Tab[] = isAdmin
    ? ['profile', 'quality', 'insights', 'experiments']
    : ['profile', 'quality', 'insights']

  const handleRefreshProfile = async () => {
    await refreshProfile()
    onToast?.('Profile recalculated')
  }

  return (
    <div className="ka-adaptive-panel">
      <div className="ka-panel-header">
        <h2 className="ka-panel-title">
          <IconBrain size={18} aria-hidden="true" />
          Adaptive Intelligence
        </h2>
        <div className="ka-adaptive-header-right">
          <span className="ka-adaptive-signal-count">{signalCount} signals</span>
          <button className="ka-panel-close" onClick={onClose} aria-label="Close">
            <IconClose size={18} />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="ka-adaptive-tabs">
        {tabs.map(tab => (
          <button
            key={tab}
            className={`ka-adaptive-tab${activeTab === tab ? ' ka-adaptive-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'profile' && <IconTarget size={14} aria-hidden="true" />}
            {tab === 'quality' && <IconChart size={14} aria-hidden="true" />}
            {tab === 'insights' && <IconSparkles size={14} aria-hidden="true" />}
            {tab === 'experiments' && <IconActivity size={14} aria-hidden="true" />}
            <span className="ka-adaptive-tab-label">
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </span>
          </button>
        ))}
      </div>

      <div className="ka-adaptive-content">
        {isLoading && (
          <div className="ka-adaptive-loading">
            <div className="ka-adaptive-spinner" />
          </div>
        )}

        {activeTab === 'profile' && (
          <ProfileSection profile={profile} onRefresh={handleRefreshProfile} />
        )}
        {activeTab === 'quality' && (
          <QualitySection metrics={metrics} profile={profile} />
        )}
        {activeTab === 'insights' && (
          <InsightsSection insights={insights} onRefresh={loadInsights} />
        )}
        {activeTab === 'experiments' && isAdmin && (
          <ExperimentsSection experiments={experiments} onRefresh={loadExperiments} />
        )}
      </div>
    </div>
  )
}

// ─── Profile Section ────────────────────────────────────────

function ProfileSection({
  profile,
  onRefresh,
}: {
  profile: AdaptiveProfile | null
  onRefresh: () => void
}) {
  if (!profile) {
    return (
      <div className="ka-adaptive-section">
        <div className="ka-adaptive-empty">
          <IconTarget size={32} />
          <p className="ka-adaptive-empty-title">No preferences learned yet</p>
          <p className="ka-adaptive-empty-desc">
            Keep chatting and the Kernel will learn how you prefer responses.
          </p>
        </div>
      </div>
    )
  }

  const { responsePreferences, agentPreferences, topicAffinities } = profile

  const prefItems: { label: string; value: string; color: string }[] = [
    { label: 'Length', value: responsePreferences.preferredLength, color: '#6B5B95' },
    { label: 'Tone', value: responsePreferences.preferredTone, color: '#5B8BA0' },
    { label: 'Detail', value: responsePreferences.preferredDetail, color: '#6B8E6B' },
    { label: 'Format', value: responsePreferences.preferredFormat, color: '#B8875C' },
  ]

  const sortedAgents = Object.entries(agentPreferences)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)

  const sortedTopics = Object.entries(topicAffinities)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)

  return (
    <div className="ka-adaptive-section">
      <div className="ka-adaptive-section-header">
        <h3 className="ka-adaptive-section-title">Learned Preferences</h3>
        <button className="ka-adaptive-refresh" onClick={onRefresh} title="Recalculate">
          <IconRefresh size={14} />
        </button>
      </div>

      {/* Preference badges */}
      <div className="ka-adaptive-prefs">
        {prefItems.map(pref => (
          <div key={pref.label} className="ka-adaptive-pref">
            <span className="ka-adaptive-pref-label">{pref.label}</span>
            <span
              className="ka-adaptive-pref-badge"
              style={{ borderColor: pref.color, color: pref.color }}
            >
              {pref.value}
            </span>
          </div>
        ))}
      </div>

      {/* Agent preferences */}
      {sortedAgents.length > 0 && (
        <div className="ka-adaptive-agents">
          <span className="ka-adaptive-field-label">Agent Performance</span>
          {sortedAgents.map(([agentId, score]) => (
            <div key={agentId} className="ka-adaptive-agent-row">
              <span className="ka-adaptive-agent-name">{agentId}</span>
              <div className="ka-adaptive-bar">
                <div
                  className="ka-adaptive-bar-fill"
                  style={{ width: `${Math.round(score * 100)}%` }}
                />
              </div>
              <span className="ka-adaptive-bar-value">{Math.round(score * 100)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Topic affinities */}
      {sortedTopics.length > 0 && (
        <div className="ka-adaptive-topics">
          <span className="ka-adaptive-field-label">Topic Affinities</span>
          <div className="ka-adaptive-topic-badges">
            {sortedTopics.map(([topic, score]) => (
              <span
                key={topic}
                className="ka-adaptive-topic-badge"
                style={{ opacity: 0.4 + score * 0.6 }}
              >
                {topic}
                <span className="ka-adaptive-topic-score">{Math.round(score * 100)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Last updated */}
      <div className="ka-adaptive-updated">
        Last updated: {new Date(profile.lastUpdated).toLocaleDateString()}
      </div>
    </div>
  )
}

// ─── Quality Section ────────────────────────────────────────

function QualitySection({
  metrics,
  profile,
}: {
  metrics: QualityMetrics | null
  profile: AdaptiveProfile | null
}) {
  if (!metrics) {
    return (
      <div className="ka-adaptive-section">
        <div className="ka-adaptive-empty">
          <IconChart size={32} />
          <p className="ka-adaptive-empty-title">Quality metrics loading</p>
          <p className="ka-adaptive-empty-desc">
            Metrics are calculated from your interaction signals.
          </p>
        </div>
      </div>
    )
  }

  const metricItems: { label: string; value: number; icon: React.ReactNode }[] = [
    { label: 'Response Quality', value: metrics.responseQuality, icon: <IconTarget size={14} /> },
    { label: 'Satisfaction', value: metrics.userSatisfaction, icon: <IconTrendingUp size={14} /> },
    { label: 'Agent Accuracy', value: metrics.agentAccuracy, icon: <IconBrain size={14} /> },
    { label: 'Efficiency', value: metrics.engineEfficiency, icon: <IconActivity size={14} /> },
    { label: 'Adaptation Rate', value: metrics.adaptationRate, icon: <IconSparkles size={14} /> },
  ]

  // Build sparkline from satisfaction trend
  const trend = profile?.satisfactionTrend || []
  const sparkline = useMemo(() => buildSparkline(trend), [trend])

  return (
    <div className="ka-adaptive-section">
      <h3 className="ka-adaptive-section-title">Quality Metrics</h3>

      {/* Metric bars */}
      <div className="ka-adaptive-metrics">
        {metricItems.map(m => (
          <div key={m.label} className="ka-adaptive-metric">
            <div className="ka-adaptive-metric-header">
              {m.icon}
              <span className="ka-adaptive-metric-label">{m.label}</span>
              <span className="ka-adaptive-metric-value">{Math.round(m.value * 100)}%</span>
            </div>
            <div className="ka-adaptive-bar">
              <div
                className={`ka-adaptive-bar-fill ${getBarClass(m.value)}`}
                style={{ width: `${Math.round(m.value * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Satisfaction trend sparkline */}
      {trend.length > 3 && (
        <div className="ka-adaptive-trend">
          <span className="ka-adaptive-field-label">Satisfaction Trend</span>
          <div className="ka-adaptive-sparkline" aria-label="Satisfaction trend chart">
            {sparkline}
          </div>
          <div className="ka-adaptive-trend-labels">
            <span>Older</span>
            <span>Recent</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Insights Section ───────────────────────────────────────

function InsightsSection({
  insights,
  onRefresh,
}: {
  insights: AdaptiveInsight[]
  onRefresh: () => void
}) {
  if (insights.length === 0) {
    return (
      <div className="ka-adaptive-section">
        <div className="ka-adaptive-empty">
          <IconSparkles size={32} />
          <p className="ka-adaptive-empty-title">No insights yet</p>
          <p className="ka-adaptive-empty-desc">
            Insights are discovered from your interaction patterns over time.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="ka-adaptive-section">
      <div className="ka-adaptive-section-header">
        <h3 className="ka-adaptive-section-title">Discovered Insights</h3>
        <button className="ka-adaptive-refresh" onClick={onRefresh} title="Refresh insights">
          <IconRefresh size={14} />
        </button>
      </div>

      <div className="ka-adaptive-insights">
        {insights.map(insight => (
          <div key={insight.id} className={`ka-adaptive-insight ka-adaptive-insight--${insight.type}`}>
            <div className="ka-adaptive-insight-header">
              <InsightTypeIcon type={insight.type} />
              <span className="ka-adaptive-insight-title">{insight.title}</span>
              <span className="ka-adaptive-insight-confidence">
                {Math.round(insight.confidence * 100)}%
              </span>
            </div>
            <p className="ka-adaptive-insight-desc">{insight.description}</p>
            <span className="ka-adaptive-insight-time">
              {new Date(insight.createdAt).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Experiments Section (Admin) ────────────────────────────

function ExperimentsSection({
  experiments,
  onRefresh,
}: {
  experiments: Experiment[]
  onRefresh: () => void
}) {
  if (experiments.length === 0) {
    return (
      <div className="ka-adaptive-section">
        <div className="ka-adaptive-empty">
          <IconActivity size={32} />
          <p className="ka-adaptive-empty-title">No experiments running</p>
          <p className="ka-adaptive-empty-desc">
            A/B experiments allow testing different response strategies.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="ka-adaptive-section">
      <div className="ka-adaptive-section-header">
        <h3 className="ka-adaptive-section-title">Experiments</h3>
        <button className="ka-adaptive-refresh" onClick={onRefresh} title="Refresh experiments">
          <IconRefresh size={14} />
        </button>
      </div>

      <div className="ka-adaptive-experiments">
        {experiments.map(exp => (
          <div key={exp.id} className="ka-adaptive-experiment">
            <div className="ka-adaptive-experiment-header">
              <span className={`ka-adaptive-experiment-status ka-adaptive-experiment-status--${exp.status}`}>
                {exp.status}
              </span>
              <span className="ka-adaptive-experiment-name">{exp.name}</span>
            </div>
            <p className="ka-adaptive-experiment-desc">{exp.description}</p>

            {/* Variant stats */}
            <div className="ka-adaptive-variants">
              {exp.variants.map(v => (
                <div
                  key={v.id}
                  className={`ka-adaptive-variant${exp.winningVariant === v.id ? ' ka-adaptive-variant--winner' : ''}`}
                >
                  <span className="ka-adaptive-variant-name">{v.name}</span>
                  <div className="ka-adaptive-variant-stats">
                    <span className="ka-adaptive-variant-rate">
                      {Math.round(v.successRate * 100)}%
                    </span>
                    <span className="ka-adaptive-variant-samples">
                      n={v.sampleSize}
                    </span>
                  </div>
                  <div className="ka-adaptive-bar">
                    <div
                      className="ka-adaptive-bar-fill"
                      style={{ width: `${Math.round(v.successRate * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {exp.winningVariant && (
              <div className="ka-adaptive-experiment-winner">
                Winner: {exp.variants.find(v => v.id === exp.winningVariant)?.name || exp.winningVariant}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────

function InsightTypeIcon({ type }: { type: AdaptiveInsight['type'] }) {
  switch (type) {
    case 'pattern':
      return <IconBrain size={14} className="ka-adaptive-insight-icon" />
    case 'anomaly':
      return <IconTrendingDown size={14} className="ka-adaptive-insight-icon ka-adaptive-insight-icon--anomaly" />
    case 'recommendation':
      return <IconTarget size={14} className="ka-adaptive-insight-icon ka-adaptive-insight-icon--rec" />
    case 'trend':
      return <IconTrendingUp size={14} className="ka-adaptive-insight-icon ka-adaptive-insight-icon--trend" />
    default:
      return <IconSparkles size={14} className="ka-adaptive-insight-icon" />
  }
}

function getBarClass(value: number): string {
  if (value >= 0.7) return 'ka-adaptive-bar-fill--good'
  if (value >= 0.4) return 'ka-adaptive-bar-fill--ok'
  return 'ka-adaptive-bar-fill--low'
}

/**
 * Build a sparkline bar chart from trend data.
 * Uses CSS-styled divs for a clean visual.
 */
function buildSparkline(trend: number[]): React.ReactNode {
  if (trend.length === 0) return null

  // Sample down to max 30 bars
  const maxBars = 30
  const step = Math.max(1, Math.floor(trend.length / maxBars))
  const sampled: number[] = []
  for (let i = 0; i < trend.length; i += step) {
    sampled.push(trend[i])
  }

  return (
    <div className="ka-adaptive-sparkline-bars">
      {sampled.map((val, i) => (
        <div
          key={i}
          className={`ka-adaptive-sparkline-bar ${getBarClass(val)}`}
          style={{ height: `${Math.max(4, Math.round(val * 100))}%` }}
          title={`${Math.round(val * 100)}%`}
        />
      ))}
    </div>
  )
}
