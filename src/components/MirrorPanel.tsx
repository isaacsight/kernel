// ─── MirrorPanel ────────────────────────────────────────
//
// "The Mirror" — Shows users what convergence sees about them.
// Displays emergent insights from multi-agent perception synthesis
// and individual facet observations from each agent lens.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconClose, IconEye, IconSparkles, IconChevronDown, IconChevronRight } from './KernelIcons'
import type { UserMirror, AgentFacet, ConvergenceInsight } from '../engine/Convergence'
import { FACET_AGENT_IDS } from '../engine/Convergence'

const FACET_META: Record<string, { dimension: string; icon: string }> = {
  kernel:     { dimension: 'relationship', icon: '◈' },
  researcher: { dimension: 'curiosity',    icon: '◇' },
  coder:      { dimension: 'craft',        icon: '▣' },
  writer:     { dimension: 'voice',        icon: '¶' },
  analyst:    { dimension: 'judgment',      icon: '△' },
  curator:    { dimension: 'arc',          icon: '◎' },
}

interface MirrorPanelProps {
  mirror: UserMirror
  onClose: () => void
}

export function MirrorPanel({ mirror, onClose }: MirrorPanelProps) {
  const { t } = useTranslation('panels')
  const activeFacets = FACET_AGENT_IDS
    .map(id => mirror.facets[id])
    .filter((f): f is AgentFacet => !!f && f.observations.length > 0)

  const hasInsights = mirror.insights.length > 0
  const hasFacets = activeFacets.length > 0
  const isEmpty = !hasInsights && !hasFacets

  return (
    <div className="ka-mirror-panel">
      <div className="ka-panel-header">
        <h2 className="ka-panel-title">
          <IconEye size={18} aria-hidden="true" />
          {t('mirror.title')}
        </h2>
        <button className="ka-panel-close" onClick={onClose} aria-label="Close">
          <IconClose size={18} />
        </button>
      </div>

      <div className="ka-mirror-content">
        {isEmpty ? (
          <div className="ka-mirror-empty">
            <p className="ka-mirror-empty-title">{t('mirror.emptyTitle')}</p>
            <p className="ka-mirror-empty-desc">{t('mirror.emptyDesc')}</p>
          </div>
        ) : (
          <>
            {/* ── Convergence Insights ── */}
            {hasInsights && (
              <section className="ka-mirror-section">
                <h3 className="ka-mirror-section-title">
                  <IconSparkles size={14} aria-hidden="true" />
                  {t('mirror.convergenceTitle')}
                </h3>
                <p className="ka-mirror-section-desc">{t('mirror.convergenceDesc')}</p>
                <div className="ka-mirror-insights">
                  {mirror.insights.map((insight, i) => (
                    <InsightCard key={i} insight={insight} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Agent Facets ── */}
            {hasFacets && (
              <section className="ka-mirror-section">
                <h3 className="ka-mirror-section-title">
                  {t('mirror.facetsTitle')}
                </h3>
                <p className="ka-mirror-section-desc">{t('mirror.facetsDesc')}</p>
                <div className="ka-mirror-facets">
                  {activeFacets.map(facet => (
                    <FacetCard key={facet.agentId} facet={facet} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Meta ── */}
            {mirror.convergenceCount > 0 && (
              <div className="ka-mirror-meta">
                {t('mirror.convergenceCount', { count: mirror.convergenceCount })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function InsightCard({ insight }: { insight: ConvergenceInsight }) {
  const sources = insight.sources
    .map(s => FACET_META[s]?.dimension || s)
    .join(' + ')

  const confidenceLabel =
    insight.confidence >= 0.8 ? 'high' :
    insight.confidence >= 0.5 ? 'medium' : 'low'

  return (
    <div className="ka-mirror-insight">
      <p className="ka-mirror-insight-text">{insight.insight}</p>
      <div className="ka-mirror-insight-meta">
        <span className="ka-mirror-insight-sources">{sources}</span>
        <span className={`ka-mirror-insight-confidence ka-mirror-confidence--${confidenceLabel}`}>
          {Math.round(insight.confidence * 100)}%
        </span>
      </div>
    </div>
  )
}

function FacetCard({ facet }: { facet: AgentFacet }) {
  const { t } = useTranslation('panels')
  const [expanded, setExpanded] = useState(false)
  const meta = FACET_META[facet.agentId]
  if (!meta) return null

  return (
    <div className="ka-mirror-facet">
      <button
        className="ka-mirror-facet-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="ka-mirror-facet-icon">{meta.icon}</span>
        <span className="ka-mirror-facet-dim">{t(`mirror.dimensions.${meta.dimension}`)}</span>
        <span className="ka-mirror-facet-count">
          {facet.observations.length} {t('mirror.observations')}
        </span>
        {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
      </button>
      {expanded && (
        <div className="ka-mirror-facet-body">
          <ul className="ka-mirror-facet-observations">
            {facet.observations.map((obs, i) => (
              <li key={i}>{obs}</li>
            ))}
          </ul>
          {facet.patterns.length > 0 && (
            <div className="ka-mirror-facet-patterns">
              <span className="ka-mirror-facet-patterns-label">{t('mirror.patterns')}</span>
              {facet.patterns.map((pat, i) => (
                <span key={i} className="ka-mirror-facet-pattern">{pat}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
