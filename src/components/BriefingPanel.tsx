// ─── BriefingPanel ───────────────────────────────────────
//
// Bottom-sheet panel showing today's briefing, history, and generate button.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Newspaper, RefreshCw, Sparkles, Check, Clock, ArrowRight } from 'lucide-react'
import { supabase } from '../engine/SupabaseClient'
import { generateBriefing, type Briefing } from '../engine/BriefingGenerator'
import { MessageContent } from './MessageContent'
import type { UserMemoryProfile } from '../engine/MemoryAgent'
import type { KGEntity } from '../engine/KnowledgeGraph'

interface BriefingPanelProps {
  userId: string
  userMemory: UserMemoryProfile | null
  kgEntities: KGEntity[]
  onClose: () => void
  onToast: (msg: string) => void
}

const GEN_PHASES = [
  { key: 'planning', label: 'Planning' },
  { key: 'searching', label: 'Researching' },
  { key: 'synthesizing', label: 'Writing' },
]

function estimateReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 220))
}

function formatTabLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const month = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const hour = d.getHours()
  const period = hour < 12 ? 'AM' : 'PM'
  const h = hour % 12 || 12
  return `${month} · ${h}${period}`
}

export function BriefingPanel({ userId, userMemory, kgEntities, onClose, onToast }: BriefingPanelProps) {
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genPhase, setGenPhase] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)

  const loadBriefings = useCallback(async () => {
    const { data, error } = await supabase
      .from('briefings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(7)
    if (error) console.error('Error loading briefings:', error)
    setBriefings((data || []) as Briefing[])
    setLoading(false)
  }, [userId])

  useEffect(() => { loadBriefings() }, [loadBriefings])

  const handleGenerate = async () => {
    if (generating) return
    setGenerating(true)
    setGenPhase('planning')
    try {
      const briefing = await generateBriefing(
        userId,
        userMemory,
        kgEntities,
        (phase) => setGenPhase(phase),
      )
      const { error } = await supabase
        .from('briefings')
        .insert(briefing)
      if (error) throw error
      await loadBriefings()
      setSelectedIdx(0)
      onToast('Briefing generated')
    } catch (err) {
      console.error('Briefing generation failed:', err)
      onToast('Failed to generate briefing')
    } finally {
      setGenerating(false)
      setGenPhase('')
    }
  }

  // Mark as read when viewing
  useEffect(() => {
    const b = briefings[selectedIdx]
    if (b && !b.read_at && b.id) {
      supabase
        .from('briefings')
        .update({ read_at: new Date().toISOString() })
        .eq('id', b.id)
        .then(() => {})
    }
  }, [selectedIdx, briefings])

  const current = briefings[selectedIdx]
  const readingTime = useMemo(() => current ? estimateReadingTime(current.content) : 0, [current])

  // Determine completed phases for progress indicator
  const currentPhaseIdx = GEN_PHASES.findIndex(p => p.key === genPhase)

  return (
    <div className="ka-brief-panel">
      <div className="ka-brief-header">
        <h2 className="ka-brief-title">
          <Newspaper size={18} />
          Briefings
        </h2>
        <div className="ka-brief-header-actions">
          <button
            className="ka-brief-gen-btn"
            onClick={handleGenerate}
            disabled={generating}
            title="Generate a new briefing based on your interests and recent activity"
          >
            <RefreshCw size={14} className={generating ? 'ka-spin' : ''} />
            {generating ? 'Generating...' : 'New briefing'}
          </button>
          <button className="ka-brief-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Generation progress indicator */}
      {generating && (
        <div className="ka-brief-progress">
          {GEN_PHASES.map((phase, i) => {
            const isComplete = i < currentPhaseIdx
            const isActive = i === currentPhaseIdx
            return (
              <div
                key={phase.key}
                className={`ka-brief-progress-step${isActive ? ' ka-brief-progress-step--active' : ''}${isComplete ? ' ka-brief-progress-step--done' : ''}`}
              >
                <span className="ka-brief-progress-icon">
                  {isComplete ? <Check size={12} /> : (i + 1)}
                </span>
                <span className="ka-brief-progress-label">{phase.label}</span>
              </div>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="ka-brief-loading">Loading briefings...</div>
      ) : briefings.length === 0 && !generating ? (
        <div className="ka-brief-empty">
          <Sparkles size={28} className="ka-brief-empty-icon" />
          <h3 className="ka-brief-empty-title">Your daily briefing</h3>
          <p>Get a personalized news and insights summary tailored to your interests and goals.</p>
          <button className="ka-brief-empty-cta" onClick={handleGenerate}>
            Generate your first briefing
          </button>
        </div>
      ) : (
        <>
          {briefings.length > 1 && (
            <div className="ka-brief-tabs">
              {briefings.map((b, i) => (
                <button
                  key={b.id}
                  className={`ka-brief-tab${i === selectedIdx ? ' ka-brief-tab--active' : ''}`}
                  onClick={() => setSelectedIdx(i)}
                >
                  {formatTabLabel(b.created_at!)}
                </button>
              ))}
            </div>
          )}

          {current && (
            <div className="ka-brief-content">
              <h3 className="ka-brief-content-title">{current.title}</h3>
              <div className="ka-brief-meta">
                <Clock size={12} />
                <span>{readingTime} min read</span>
                <span className="ka-brief-meta-sep">&middot;</span>
                <span>{current.content.trim().split(/\s+/).length} words</span>
              </div>
              {current.topics.length > 0 && (
                <div className="ka-brief-topics-section">
                  <div className="ka-brief-topics-label">Topics covered</div>
                  <div className="ka-brief-topics">
                    {current.topics.map(t => (
                      <span key={t} className="ka-brief-topic">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="ka-brief-body">
                <MessageContent text={current.content} />
              </div>
              <a
                href={`${import.meta.env.BASE_URL}#/briefing/${current.id}`}
                className="ka-brief-fullpage-btn"
              >
                Read full briefing <ArrowRight size={14} />
              </a>
            </div>
          )}
        </>
      )}
    </div>
  )
}
