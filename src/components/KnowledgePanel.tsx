// ─── Knowledge Panel ──────────────────────────────────────
//
// Bottom-sheet panel for browsing the user's personal knowledge base.
// Shows stats, topic tree, search, contradictions, recent items.

import { useState, useEffect, useCallback } from 'react'
import { IconClose, IconBrain, IconSearch, IconTrash, IconCheck, IconZap } from './KernelIcons'
import { useKnowledgeEngine } from '../hooks/useKnowledgeEngine'
import type { RetrievalResult, KnowledgeDomain } from '../engine/knowledge/types'

interface KnowledgePanelProps {
  userId: string
  onClose: () => void
  onToast: (msg: string) => void
}

const DOMAIN_LABELS: Record<KnowledgeDomain, string> = {
  tech: 'Technology',
  personal: 'Personal',
  work: 'Work',
  creative: 'Creative',
  finance: 'Finance',
  health: 'Health',
  general: 'General',
}

const DOMAIN_COLORS: Record<KnowledgeDomain, string> = {
  tech: '#6B8E6B',
  personal: '#B8875C',
  work: '#5B8BA0',
  creative: '#A0768C',
  finance: '#8B7355',
  health: '#6B9E6B',
  general: '#6B5B95',
}

export function KnowledgePanel({ userId, onClose, onToast }: KnowledgePanelProps) {
  const knowledge = useKnowledgeEngine(userId)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<RetrievalResult[]>([])
  const [searching, setSearching] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'topics' | 'search'>('overview')

  useEffect(() => {
    Promise.all([
      knowledge.refreshTopics(),
      knowledge.refreshStats(),
    ]).finally(() => setLoading(false))
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const results = await knowledge.searchKnowledge(searchQuery, 10)
      setSearchResults(results)
    } finally {
      setSearching(false)
    }
  }, [searchQuery, knowledge])

  const handleDelete = useCallback(async (itemId: string) => {
    const ok = await knowledge.deleteItem(itemId)
    if (ok) {
      setSearchResults(prev => prev.filter(r => r.id !== itemId))
      onToast('Knowledge item deleted')
    }
  }, [knowledge, onToast])

  if (loading) {
    return (
      <div className="ka-knowledge-panel">
        <div className="ka-knowledge-header">
          <div className="ka-knowledge-title"><IconBrain size={18} /> <span>Knowledge Base</span></div>
          <button className="ka-knowledge-close" onClick={onClose}><IconClose size={18} /></button>
        </div>
        <div className="ka-knowledge-loading">Loading knowledge base...</div>
      </div>
    )
  }

  const stats = knowledge.stats

  return (
    <div className="ka-knowledge-panel">
      <div className="ka-knowledge-header">
        <div className="ka-knowledge-title"><IconBrain size={18} /> <span>Knowledge Base</span></div>
        <button className="ka-knowledge-close" onClick={onClose}><IconClose size={18} /></button>
      </div>

      {/* Tab bar */}
      <div className="ka-knowledge-tabs">
        {(['overview', 'topics', 'search'] as const).map(tab => (
          <button
            key={tab}
            className={`ka-knowledge-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' ? 'Overview' : tab === 'topics' ? 'Topics' : 'Search'}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && stats && (
        <div className="ka-knowledge-overview">
          <div className="ka-knowledge-metrics">
            <div className="ka-knowledge-metric">
              <div className="ka-knowledge-metric-val">{stats.totalItems}</div>
              <div className="ka-knowledge-metric-label">Items</div>
            </div>
            <div className="ka-knowledge-metric">
              <div className="ka-knowledge-metric-val">{stats.topicCount}</div>
              <div className="ka-knowledge-metric-label">Topics</div>
            </div>
            <div className="ka-knowledge-metric">
              <div className="ka-knowledge-metric-val">{stats.pendingContradictions}</div>
              <div className="ka-knowledge-metric-label">Conflicts</div>
            </div>
          </div>

          {/* Domain breakdown */}
          <div className="ka-knowledge-section">
            <h4 className="ka-knowledge-section-title">Domains</h4>
            <div className="ka-knowledge-domains">
              {(Object.entries(stats.domainBreakdown) as [KnowledgeDomain, number][])
                .filter(([, count]) => count > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([domain, count]) => (
                  <div key={domain} className="ka-knowledge-domain-row">
                    <span className="ka-knowledge-domain-dot" style={{ backgroundColor: DOMAIN_COLORS[domain] }} />
                    <span className="ka-knowledge-domain-name">{DOMAIN_LABELS[domain]}</span>
                    <span className="ka-knowledge-domain-count">{count}</span>
                    <div className="ka-knowledge-domain-bar">
                      <div
                        className="ka-knowledge-domain-fill"
                        style={{
                          width: `${Math.round((count / Math.max(stats.totalItems, 1)) * 100)}%`,
                          backgroundColor: DOMAIN_COLORS[domain],
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {stats.lastSync && (
            <div className="ka-knowledge-sync">
              Last synced: {new Date(stats.lastSync).toLocaleDateString()}
            </div>
          )}
        </div>
      )}

      {/* Topics tab */}
      {activeTab === 'topics' && (
        <div className="ka-knowledge-topics-list">
          {knowledge.topics.length === 0 ? (
            <div className="ka-knowledge-empty">No topics yet. Knowledge is extracted as you chat.</div>
          ) : (
            knowledge.topics.map(topic => (
              <div key={topic.id} className="ka-knowledge-topic-row">
                <span className="ka-knowledge-domain-dot" style={{ backgroundColor: DOMAIN_COLORS[topic.domain] }} />
                <span className="ka-knowledge-topic-name">{topic.name}</span>
                <span className="ka-knowledge-topic-count">{topic.item_count} items</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Search tab */}
      {activeTab === 'search' && (
        <div className="ka-knowledge-search">
          <div className="ka-knowledge-search-bar">
            <input
              type="text"
              className="ka-knowledge-search-input"
              placeholder="Search your knowledge base..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              className="ka-knowledge-search-btn"
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
            >
              <IconSearch size={16} />
            </button>
          </div>

          {searching && <div className="ka-knowledge-loading">Searching...</div>}

          {!searching && searchResults.length > 0 && (
            <div className="ka-knowledge-results">
              {searchResults.map(item => (
                <div key={item.id} className="ka-knowledge-result">
                  <div className="ka-knowledge-result-header">
                    <span className="ka-knowledge-result-topic">{item.topic || 'General'}</span>
                    <span className="ka-knowledge-result-confidence">
                      {item.confidence >= 0.8 ? 'High' : item.confidence >= 0.5 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                  <div className="ka-knowledge-result-content">
                    {item.summary || item.content.slice(0, 200)}
                  </div>
                  <div className="ka-knowledge-result-footer">
                    <span className="ka-knowledge-result-source">{item.source_type}{item.source_title ? `: ${item.source_title}` : ''}</span>
                    <button className="ka-knowledge-result-delete" onClick={() => handleDelete(item.id)} title="Delete">
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searching && searchResults.length === 0 && searchQuery && (
            <div className="ka-knowledge-empty">No results found. Try different keywords.</div>
          )}
        </div>
      )}
    </div>
  )
}
