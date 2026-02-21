// ─── Knowledge Graph Panel ──────────────────────────────────
//
// User-facing panel showing what Kernel knows about them:
// entities, relationships, and confidence levels.
// Accessible from the settings menu.

import { useState } from 'react'
import { X, Brain, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { KGEntity, KGRelation } from '../../engine/KnowledgeGraph'

interface KGPanelProps {
  entities: KGEntity[]
  relations: KGRelation[]
  onClose: () => void
}

const TYPE_ORDER = ['person', 'company', 'project', 'concept', 'preference', 'location']

export default function KGPanel({ entities, relations, onClose }: KGPanelProps) {
  const { t } = useTranslation('panels')
  const [expandedType, setExpandedType] = useState<string | null>(null)

  // Group entities by type
  const byType = new Map<string, KGEntity[]>()
  for (const e of entities) {
    const group = byType.get(e.entity_type) || []
    group.push(e)
    byType.set(e.entity_type, group)
  }

  // Build entity ID → name map for relation display
  const entityMap = new Map(entities.map(e => [e.id, e]))

  // Sort entities by confidence within each group
  for (const [, group] of byType) {
    group.sort((a, b) => b.confidence - a.confidence)
  }

  const totalEntities = entities.length
  const totalRelations = relations.length

  return (
    <div className="ka-kg-panel">
      <div className="ka-kg-header">
        <div className="ka-kg-title">
          <Brain size={18} />
          <span>{t('kg.title')}</span>
        </div>
        <button className="ka-kg-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {totalEntities === 0 ? (
        <div className="ka-kg-empty">
          <img className="ka-empty-state-illustration" src={`${import.meta.env.BASE_URL}concepts/empty-knowledge.svg`} alt="" aria-hidden="true" />
          <p>{t('kg.emptyTitle')}</p>
          <p className="ka-kg-empty-hint">{t('kg.emptyHint')}</p>
        </div>
      ) : (
        <>
          <div className="ka-kg-stats">
            <span>{t('kg.entitiesCount', { count: totalEntities })}</span>
            <span className="ka-kg-dot">&middot;</span>
            <span>{t('kg.connectionsCount', { count: totalRelations })}</span>
          </div>

          <div className="ka-kg-groups">
            {TYPE_ORDER.filter(tp => byType.has(tp)).map(type => {
              const group = byType.get(type)!
              const isExpanded = expandedType === type
              return (
                <div key={type} className="ka-kg-group">
                  <button
                    className="ka-kg-group-header"
                    onClick={() => setExpandedType(isExpanded ? null : type)}
                  >
                    <ChevronRight
                      size={14}
                      className={`ka-kg-chevron ${isExpanded ? 'ka-kg-chevron--open' : ''}`}
                    />
                    <span className="ka-kg-group-label">{t(`kg.types.${type}`, { defaultValue: type })}</span>
                    <span className="ka-kg-group-count">{group.length}</span>
                  </button>
                  {isExpanded && (
                    <div className="ka-kg-entities">
                      {group.map(entity => {
                        const entityRelations = relations.filter(
                          r => r.source_id === entity.id || r.target_id === entity.id
                        )
                        return (
                          <div key={entity.id} className="ka-kg-entity">
                            <div className="ka-kg-entity-name">{entity.name}</div>
                            <div className="ka-kg-entity-meta">
                              <span className="ka-kg-confidence" style={{
                                opacity: 0.4 + entity.confidence * 0.6,
                              }}>
                                {t('kg.confident', { value: (entity.confidence * 100).toFixed(0) })}
                              </span>
                              <span className="ka-kg-mentions">
                                {t('kg.mentioned', { count: entity.mention_count })}
                              </span>
                            </div>
                            {entityRelations.length > 0 && (
                              <div className="ka-kg-entity-relations">
                                {entityRelations.map(r => {
                                  const other = r.source_id === entity.id
                                    ? entityMap.get(r.target_id)
                                    : entityMap.get(r.source_id)
                                  const direction = r.source_id === entity.id
                                    ? r.relation_type
                                    : `${r.relation_type} (from)`
                                  return other ? (
                                    <span key={r.id} className="ka-kg-relation-tag">
                                      {direction} {other.name}
                                    </span>
                                  ) : null
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
