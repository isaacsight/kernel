// ─── InsightsPanel ───────────────────────────────────────
//
// "How Kernel sees you" — Intelligence transparency panel.
// Shows world model, beliefs, memory profile, reflections, agent performance.

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { IconClose, IconEye, IconBrain, IconSparkles, IconChart, IconUser, IconChevronDown, IconChevronRight, IconShield, IconTrash } from './KernelIcons'
import type { EngineState, Belief, Reflection } from '../engine/types'
import type { UserMemoryProfile } from '../engine/MemoryAgent'

interface InsightsPanelProps {
  engineState: EngineState
  userMemory: UserMemoryProfile | null
  onChallengeBelief: (beliefId: string) => void
  onRemoveBelief: (beliefId: string) => void
  onClose: () => void
}

type Section = 'world' | 'beliefs' | 'memory' | 'reflections' | 'agents'

export function InsightsPanel({ engineState, userMemory, onChallengeBelief, onRemoveBelief, onClose }: InsightsPanelProps) {
  const { t } = useTranslation('panels')
  const [activeSection, setActiveSection] = useState<Section>('world')

  const { worldModel, lasting } = engineState

  return (
    <div className="ka-insights-panel">
      <div className="ka-panel-header">
        <h2 className="ka-panel-title">
          <IconEye size={18} aria-hidden="true" />
          {t('insights.title')}
        </h2>
        <button className="ka-panel-close" onClick={onClose} aria-label="Close">
          <IconClose size={18} />
        </button>
      </div>

      {/* Section tabs */}
      <div className="ka-insights-tabs">
        {(['world', 'beliefs', 'memory', 'reflections', 'agents'] as Section[]).map(s => (
          <button
            key={s}
            className={`ka-insights-tab${activeSection === s ? ' ka-insights-tab--active' : ''}`}
            onClick={() => setActiveSection(s)}
          >
            {s === 'world' && <IconUser size={14} aria-hidden="true" />}
            {s === 'beliefs' && <IconBrain size={14} aria-hidden="true" />}
            {s === 'memory' && <IconSparkles size={14} aria-hidden="true" />}
            {s === 'reflections' && <IconChart size={14} aria-hidden="true" />}
            {s === 'agents' && <IconShield size={14} aria-hidden="true" />}
            <span>{t(`insights.sections.${s}`)}</span>
          </button>
        ))}
      </div>

      <div className="ka-insights-content">
        {activeSection === 'world' && (
          <WorldModelSection worldModel={worldModel} />
        )}
        {activeSection === 'beliefs' && (
          <BeliefsSection
            beliefs={worldModel.beliefs}
            onChallenge={onChallengeBelief}
            onRemove={onRemoveBelief}
          />
        )}
        {activeSection === 'memory' && (
          <MemorySection profile={userMemory} />
        )}
        {activeSection === 'reflections' && (
          <ReflectionsSection reflections={lasting.reflections} patternNotes={lasting.patternNotes} />
        )}
        {activeSection === 'agents' && (
          <AgentPerformanceSection performance={lasting.agentPerformance} />
        )}
      </div>
    </div>
  )
}

// ─── Section 1: World Model ─────────────────────────────

function WorldModelSection({ worldModel }: { worldModel: EngineState['worldModel'] }) {
  const { t } = useTranslation('panels')
  const { convictions, userModel, situationSummary } = worldModel

  const trendArrow = convictions.trend === 'rising' ? '↑' : convictions.trend === 'falling' ? '↓' : '→'
  const convictionPct = Math.round(convictions.overall * 100)

  return (
    <div className="ka-insights-section">
      <h3 className="ka-insights-section-title">{t('insights.howISeeYou')}</h3>

      {userModel.apparentGoal && (
        <div className="ka-insights-field">
          <span className="ka-insights-field-label">{t('insights.apparentGoal')}</span>
          <span className="ka-insights-field-value">{userModel.apparentGoal}</span>
        </div>
      )}

      <div className="ka-insights-badges">
        {userModel.communicationStyle !== 'unknown' && (
          <span className="ka-insights-badge">{userModel.communicationStyle}</span>
        )}
        {userModel.expertise !== 'unknown' && (
          <span className="ka-insights-badge">{userModel.expertise}</span>
        )}
      </div>

      {situationSummary && (
        <div className="ka-insights-field">
          <span className="ka-insights-field-label">{t('insights.situation')}</span>
          <span className="ka-insights-field-value ka-insights-field-value--mono">{situationSummary}</span>
        </div>
      )}

      <div className="ka-insights-conviction">
        <span className="ka-insights-field-label">{t('insights.conviction')}</span>
        <div className="ka-insights-gauge">
          <div className="ka-insights-gauge-fill" style={{ width: `${convictionPct}%` }} />
        </div>
        <span className="ka-insights-conviction-value">
          {convictionPct}% {trendArrow}
        </span>
      </div>
    </div>
  )
}

// ─── Section 2: Beliefs ────────────────────────────────

function BeliefsSection({
  beliefs,
  onChallenge,
  onRemove,
}: {
  beliefs: Belief[]
  onChallenge: (id: string) => void
  onRemove: (id: string) => void
}) {
  const { t } = useTranslation('panels')
  const sorted = useMemo(() =>
    [...beliefs].sort((a, b) => b.confidence - a.confidence),
    [beliefs]
  )

  if (sorted.length === 0) {
    return (
      <div className="ka-insights-section">
        <h3 className="ka-insights-section-title">{t('insights.whatIBelieve')}</h3>
        <img className="ka-empty-state-illustration" src={`${import.meta.env.BASE_URL}concepts/empty-knowledge.svg`} alt="" aria-hidden="true" />
        <p className="ka-insights-empty">{t('insights.noBeliefsYet')}</p>
      </div>
    )
  }

  return (
    <div className="ka-insights-section">
      <h3 className="ka-insights-section-title">{t('insights.whatIBelieve')}</h3>
      <div className="ka-insights-beliefs">
        {sorted.map(belief => (
          <div key={belief.id} className="ka-insights-belief">
            <div className="ka-insights-belief-content">{belief.content}</div>
            <div className="ka-insights-belief-meta">
              <div className="ka-insights-belief-bar">
                <div
                  className="ka-insights-belief-bar-fill"
                  style={{ width: `${Math.round(belief.confidence * 100)}%` }}
                />
              </div>
              <span className="ka-insights-belief-badge">{belief.source}</span>
              {belief.challengedCount > 0 && (
                <span className="ka-insights-belief-stat">{t('insights.challengedStat', { count: belief.challengedCount })}</span>
              )}
              {belief.reinforcedCount > 0 && (
                <span className="ka-insights-belief-stat">{t('insights.reinforcedStat', { count: belief.reinforcedCount })}</span>
              )}
            </div>
            <div className="ka-insights-belief-actions">
              <button
                className="ka-insights-belief-action"
                onClick={() => onChallenge(belief.id)}
                title={t('insights.challengeBelief')}
              >
                {t('insights.challengeAction')}
              </button>
              <button
                className="ka-insights-belief-action ka-insights-belief-action--danger"
                onClick={() => onRemove(belief.id)}
                title={t('insights.dismissBelief')}
              >
                <IconTrash size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Section 3: Memory Profile ──────────────────────────

function MemorySection({ profile }: { profile: UserMemoryProfile | null }) {
  const { t } = useTranslation('panels')

  if (!profile) {
    return (
      <div className="ka-insights-section">
        <h3 className="ka-insights-section-title">{t('insights.myMemory')}</h3>
        <img className="ka-empty-state-illustration" src={`${import.meta.env.BASE_URL}concepts/empty-knowledge.svg`} alt="" aria-hidden="true" />
        <p className="ka-insights-empty">{t('insights.noMemoryYet')}</p>
      </div>
    )
  }

  const sections: { key: string; items: string[] }[] = [
    { key: 'interests', items: profile.interests || [] },
    { key: 'goals', items: profile.goals || [] },
    { key: 'facts', items: profile.facts || [] },
    { key: 'preferences', items: profile.preferences || [] },
  ].filter(s => s.items.length > 0)

  return (
    <div className="ka-insights-section">
      <h3 className="ka-insights-section-title">{t('insights.myMemory')}</h3>
      {profile.communication_style && (
        <div className="ka-insights-field">
          <span className="ka-insights-field-label">{t('insights.commStyle')}</span>
          <span className="ka-insights-badge">{profile.communication_style}</span>
        </div>
      )}
      {sections.map(s => (
        <div key={s.key} className="ka-insights-memory-group">
          <span className="ka-insights-memory-label">{t(`insights.memory.${s.key}`)}</span>
          <ul className="ka-insights-memory-list">
            {s.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ─── Section 4: Reflections ─────────────────────────────

function ReflectionsSection({
  reflections,
  patternNotes,
}: {
  reflections: Reflection[]
  patternNotes: string[]
}) {
  const { t } = useTranslation('panels')
  const [expanded, setExpanded] = useState(false)

  const recent = useMemo(() => reflections.slice(-20), [reflections])
  const avgQuality = useMemo(() => {
    if (recent.length === 0) return 0
    return recent.reduce((sum, r) => sum + r.quality, 0) / recent.length
  }, [recent])

  // Average per-dimension scores
  const dimAvgs = useMemo(() => {
    if (recent.length === 0) return { substance: 0, coherence: 0, relevance: 0, brevity: 0, craft: 0 }
    const totals = { substance: 0, coherence: 0, relevance: 0, brevity: 0, craft: 0 }
    for (const r of recent) {
      totals.substance += r.scores.substance
      totals.coherence += r.scores.coherence
      totals.relevance += r.scores.relevance
      totals.brevity += r.scores.brevity
      totals.craft += r.scores.craft
    }
    const n = recent.length
    return {
      substance: totals.substance / n,
      coherence: totals.coherence / n,
      relevance: totals.relevance / n,
      brevity: totals.brevity / n,
      craft: totals.craft / n,
    }
  }, [recent])

  const recentLessons = useMemo(() =>
    recent.filter(r => r.lesson).slice(-5).map(r => r.lesson),
    [recent]
  )

  if (recent.length === 0) {
    return (
      <div className="ka-insights-section">
        <h3 className="ka-insights-section-title">{t('insights.performance')}</h3>
        <img className="ka-empty-state-illustration" src={`${import.meta.env.BASE_URL}concepts/empty-stats.svg`} alt="" aria-hidden="true" />
        <p className="ka-insights-empty">{t('insights.noReflectionsYet')}</p>
      </div>
    )
  }

  return (
    <div className="ka-insights-section">
      <h3 className="ka-insights-section-title">{t('insights.performance')}</h3>

      <div className="ka-insights-quality-score">
        <span className="ka-insights-quality-number">{(avgQuality * 100).toFixed(0)}</span>
        <span className="ka-insights-quality-label">{t('insights.avgQuality')}</span>
      </div>

      {/* 5-dimension bars */}
      <div className="ka-insights-dimensions">
        {(Object.entries(dimAvgs) as [string, number][]).map(([dim, val]) => (
          <div key={dim} className="ka-insights-dim">
            <span className="ka-insights-dim-label">{t(`insights.dims.${dim}`)}</span>
            <div className="ka-insights-dim-bar">
              <div className="ka-insights-dim-bar-fill" style={{ width: `${Math.round(val * 100)}%` }} />
            </div>
            <span className="ka-insights-dim-value">{(val * 100).toFixed(0)}</span>
          </div>
        ))}
      </div>

      {/* Recent lessons */}
      {recentLessons.length > 0 && (
        <div className="ka-insights-lessons">
          <button
            className="ka-insights-expand-btn"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            {t('insights.recentLessons')} ({recentLessons.length})
          </button>
          {expanded && (
            <ul className="ka-insights-lessons-list">
              {recentLessons.map((lesson, i) => (
                <li key={i}>{lesson}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Pattern notes */}
      {patternNotes.length > 0 && (
        <div className="ka-insights-patterns">
          <span className="ka-insights-field-label">{t('insights.patternNotes')}</span>
          <ul className="ka-insights-memory-list">
            {patternNotes.slice(-5).map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Section 5: Agent Performance ───────────────────────

function AgentPerformanceSection({
  performance,
}: {
  performance: Record<string, { uses: number; avgQuality: number }>
}) {
  const { t } = useTranslation('panels')

  const sorted = useMemo(() =>
    Object.entries(performance)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.avgQuality - a.avgQuality),
    [performance]
  )

  if (sorted.length === 0) {
    return (
      <div className="ka-insights-section">
        <h3 className="ka-insights-section-title">{t('insights.agentPerformance')}</h3>
        <img className="ka-empty-state-illustration" src={`${import.meta.env.BASE_URL}concepts/empty-stats.svg`} alt="" aria-hidden="true" />
        <p className="ka-insights-empty">{t('insights.noAgentDataYet')}</p>
      </div>
    )
  }

  const maxUses = Math.max(...sorted.map(a => a.uses), 1)

  return (
    <div className="ka-insights-section">
      <h3 className="ka-insights-section-title">{t('insights.agentPerformance')}</h3>
      <div className="ka-insights-agents">
        {sorted.map(agent => (
          <div key={agent.id} className="ka-insights-agent">
            <span className="ka-insights-agent-name">{agent.id}</span>
            <div className="ka-insights-agent-bars">
              <div className="ka-insights-agent-bar">
                <span className="ka-insights-agent-bar-label">{t('insights.quality')}</span>
                <div className="ka-insights-dim-bar">
                  <div
                    className="ka-insights-dim-bar-fill ka-insights-dim-bar-fill--quality"
                    style={{ width: `${Math.round(agent.avgQuality * 100)}%` }}
                  />
                </div>
                <span className="ka-insights-dim-value">{(agent.avgQuality * 100).toFixed(0)}</span>
              </div>
              <div className="ka-insights-agent-bar">
                <span className="ka-insights-agent-bar-label">{t('insights.usage')}</span>
                <div className="ka-insights-dim-bar">
                  <div
                    className="ka-insights-dim-bar-fill ka-insights-dim-bar-fill--usage"
                    style={{ width: `${Math.round((agent.uses / maxUses) * 100)}%` }}
                  />
                </div>
                <span className="ka-insights-dim-value">{agent.uses}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
