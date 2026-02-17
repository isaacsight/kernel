// ─── Knowledge Graph Panel ──────────────────────────────────
//
// User-facing panel showing what Kernel knows about them:
// entities, relationships, and confidence levels.
// Accessible from the settings menu.

import { useState } from 'react'
import { X, Brain, ChevronRight } from 'lucide-react'
import type { KGEntity, KGRelation } from '../../engine/KnowledgeGraph'

interface KGPanelProps {
  entities: KGEntity[]
  relations: KGRelation[]
  onClose: () => void
}

const TYPE_LABELS: Record<string, string> = {
  person: 'People',
  company: 'Companies',
  project: 'Projects',
  concept: 'Concepts',
  preference: 'Preferences',
  location: 'Locations',
}

const TYPE_ORDER = ['person', 'company', 'project', 'concept', 'preference', 'location']

export default function KGPanel({ entities, relations, onClose }: KGPanelProps) {
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
          <span>What Kernel Knows</span>
        </div>
        <button className="ka-kg-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {totalEntities === 0 ? (
        <div className="ka-kg-empty">
          <p>Kernel hasn't learned anything yet.</p>
          <p className="ka-kg-empty-hint">Keep chatting — it picks up on people, projects, and concepts you mention.</p>
        </div>
      ) : (
        <>
          <div className="ka-kg-stats">
            <span>{totalEntities} entities</span>
            <span className="ka-kg-dot">&middot;</span>
            <span>{totalRelations} connections</span>
          </div>

          <div className="ka-kg-groups">
            {TYPE_ORDER.filter(t => byType.has(t)).map(type => {
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
                    <span className="ka-kg-group-label">{TYPE_LABELS[type] || type}</span>
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
                                {(entity.confidence * 100).toFixed(0)}% confident
                              </span>
                              <span className="ka-kg-mentions">
                                {entity.mention_count}x mentioned
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
