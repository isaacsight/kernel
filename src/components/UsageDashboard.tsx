// ─── UsageDashboard — Usage analytics & forecast panel ───────────
import { motion, useDragControls } from 'framer-motion'
import { SPRING } from '../constants/motion'
import { IconClose, IconChart, IconZap, IconCrown } from './KernelIcons'
import { usePricingEngine } from '../hooks/usePricingEngine'
import { useTranslation } from 'react-i18next'
import type { FeatureTag } from '../engine/pricing/types'

interface UsageDashboardProps {
  onClose: () => void
  onUpgrade?: () => void
  isPro: boolean
  monthlyLimit: number
}

const FEATURE_LABELS: Record<FeatureTag, string> = {
  chat: 'Chat',
  routing: 'Routing',
  swarm: 'Swarm',
  swarm_synthesis: 'Synthesis',
  research: 'Research',
  workflow: 'Workflows',
  memory_extraction: 'Memory',
  convergence: 'Convergence',
  task_planning: 'Planning',
  content_pipeline: 'Content',
  algorithm_scoring: 'Algorithm',
  platform_workflow: 'Platform',
  knowledge_ingestion: 'Knowledge',
  briefing: 'Briefings',
  master_agent: 'Orchestrator',
  evaluation: 'Evaluation',
  image_generation: 'Images',
}

const FEATURE_COLORS: Record<string, string> = {
  chat: '#6B5B95',
  routing: '#8E8E93',
  swarm: '#5B8BA0',
  swarm_synthesis: '#4A7B90',
  research: '#6B8E6B',
  workflow: '#B8875C',
  memory_extraction: '#A0768C',
  convergence: '#7B68AE',
  task_planning: '#5C8CA0',
  content_pipeline: '#8B6B4A',
  algorithm_scoring: '#4A8B6B',
  platform_workflow: '#6B4A8B',
  knowledge_ingestion: '#4A6B8B',
  briefing: '#8B8B4A',
  master_agent: '#8B4A6B',
  evaluation: '#6B8B4A',
  image_generation: '#8B6B6B',
}

function UsageGauge({ current, limit }: { current: number; limit: number }) {
  const pct = Math.min((current / limit) * 100, 100)
  const circumference = 2 * Math.PI * 42
  const offset = circumference - (pct / 100) * circumference
  const color = pct > 90 ? 'var(--rubin-danger, #c0392b)' : pct > 70 ? 'var(--rubin-warning, #e67e22)' : 'var(--rubin-primary, #6B5B95)'

  return (
    <div className="ka-usage-gauge">
      <svg viewBox="0 0 100 100" className="ka-usage-gauge-svg">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--dark-border-subtle, #e0ddd8)" strokeWidth="6" />
        <circle
          cx="50" cy="50" r="42" fill="none"
          stroke={color} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
      </svg>
      <div className="ka-usage-gauge-text">
        <span className="ka-usage-gauge-count">{current}</span>
        <span className="ka-usage-gauge-label">of {limit}</span>
      </div>
    </div>
  )
}

function FeatureBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="ka-usage-feature-bar">
      <div className="ka-usage-feature-bar-label">
        <span>{label}</span>
        <span className="ka-usage-feature-bar-count">{value}</span>
      </div>
      <div className="ka-usage-feature-bar-track">
        <div
          className="ka-usage-feature-bar-fill"
          style={{ width: `${pct}%`, backgroundColor: color, transition: 'width 0.4s ease-out' }}
        />
      </div>
    </div>
  )
}

function Sparkline({ data }: { data: { date: string; requests: number }[] }) {
  if (data.length < 2) return null
  const max = Math.max(...data.map(d => d.requests), 1)
  const width = 280
  const height = 40
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - (d.requests / max) * (height - 4)
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="ka-usage-sparkline" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="var(--rubin-primary, #6B5B95)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function UsageDashboard({ onClose, onUpgrade, isPro, monthlyLimit }: UsageDashboardProps) {
  const dragControls = useDragControls()
  const { costSummary, forecast, recommendation, isLoading, error, refresh } = usePricingEngine()
  const { t } = useTranslation('home')

  const currentCount = forecast?.total_requests ?? 0
  const featureBreakdown = costSummary?.by_feature ?? []
  const maxFeatureRequests = Math.max(...featureBreakdown.map(f => f.requests), 1)
  const dailyTrend = costSummary?.daily_trend ?? []

  return (
    <>
      <motion.div
        className="ka-usage-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="ka-usage-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SPRING.DEFAULT}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.2 }}
        onDragEnd={(_, info) => { if (info.offset.y > 80 || info.velocity.y > 300) onClose() }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="ka-usage-drag-handle" onPointerDown={(e) => dragControls.start(e)} />

        <div className="ka-usage-header">
          <h3 className="ka-usage-title">
            <IconChart size={18} /> {t('usage.title', 'Usage')}
          </h3>
          <button className="ka-usage-close" onClick={onClose}>
            <IconClose size={14} />
          </button>
        </div>

        {isLoading ? (
          <div className="ka-usage-loading">{t('usage.loading', 'Loading usage data...')}</div>
        ) : error ? (
          <div className="ka-usage-error">
            <p>{error}</p>
            <button className="ka-usage-retry" onClick={refresh}>{t('usage.retry', 'Retry')}</button>
          </div>
        ) : (
          <div className="ka-usage-content">
            {/* Usage gauge */}
            <div className="ka-usage-gauge-section">
              <UsageGauge current={currentCount} limit={monthlyLimit} />
              <div className="ka-usage-gauge-meta">
                <span className="ka-usage-plan-badge">
                  {isPro ? <><IconCrown size={12} /> Pro</> : 'Free'}
                </span>
                <span className="ka-usage-period">{t('usage.last30days', 'Last 30 days')}</span>
              </div>
            </div>

            {/* Forecast banner */}
            {forecast && forecast.daily_avg_requests > 0 && (
              <div className={`ka-usage-forecast ${
                forecast.projected_monthly_requests > monthlyLimit * 0.9 ? 'ka-usage-forecast--warning' : ''
              }`}>
                <IconZap size={14} />
                <span>
                  {forecast.projected_monthly_requests > monthlyLimit
                    ? t('usage.overLimit', 'On pace to exceed your {{limit}} message limit', { limit: monthlyLimit })
                    : t('usage.onPace', 'On pace for {{projected}} of {{limit}} messages', {
                        projected: Math.round(forecast.projected_monthly_requests),
                        limit: monthlyLimit,
                      })
                  }
                </span>
              </div>
            )}

            {/* Feature breakdown */}
            {featureBreakdown.length > 0 && (
              <div className="ka-usage-features">
                <h4 className="ka-usage-section-title">{t('usage.byFeature', 'By feature')}</h4>
                {featureBreakdown
                  .sort((a, b) => b.requests - a.requests)
                  .slice(0, 8)
                  .map(f => (
                    <FeatureBar
                      key={f.feature}
                      label={FEATURE_LABELS[f.feature as FeatureTag] ?? f.feature}
                      value={f.requests}
                      max={maxFeatureRequests}
                      color={FEATURE_COLORS[f.feature] ?? '#8E8E93'}
                    />
                  ))
                }
              </div>
            )}

            {/* 30-day sparkline */}
            {dailyTrend.length > 1 && (
              <div className="ka-usage-trend">
                <h4 className="ka-usage-section-title">{t('usage.dailyTrend', '30-day trend')}</h4>
                <Sparkline data={dailyTrend} />
              </div>
            )}

            {/* Tier recommendation */}
            {recommendation && recommendation.recommended_plan !== recommendation.current_plan && (
              <div className="ka-usage-recommendation">
                <div className="ka-usage-recommendation-text">
                  <strong>{t('usage.recommendation', 'Recommendation')}</strong>
                  <p>{recommendation.reason}</p>
                </div>
                {recommendation.recommended_plan !== 'free' && onUpgrade && (
                  <button className="ka-usage-upgrade-btn" onClick={onUpgrade}>
                    {t('usage.upgrade', 'Upgrade')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </>
  )
}
