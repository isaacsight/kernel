// ─── BriefingPanel ───────────────────────────────────────
//
// Bottom-sheet panel showing today's briefing, history, and generate button.

import { useState, useEffect, useCallback } from 'react'
import { X, Newspaper, RefreshCw, ExternalLink } from 'lucide-react'
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
          >
            <RefreshCw size={14} className={generating ? 'ka-spin' : ''} />
            {generating ? genPhase || 'Generating...' : 'Generate now'}
          </button>
          <button className="ka-brief-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="ka-brief-loading">Loading briefings...</div>
      ) : briefings.length === 0 ? (
        <div className="ka-brief-empty">
          <p>No briefings yet. Generate one to get a personalized news summary based on your interests.</p>
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
                  {new Date(b.created_at!).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </button>
              ))}
            </div>
          )}

          {current && (
            <div className="ka-brief-content">
              <h3 className="ka-brief-content-title">{current.title}</h3>
              {current.topics.length > 0 && (
                <div className="ka-brief-topics">
                  {current.topics.map(t => (
                    <span key={t} className="ka-brief-topic">{t}</span>
                  ))}
                </div>
              )}
              <div className="ka-brief-body">
                <MessageContent text={current.content} />
              </div>
              <a
                href={`${import.meta.env.BASE_URL}#/briefing/${current.id}`}
                className="ka-brief-fullpage-link"
              >
                <ExternalLink size={12} /> Read full page
              </a>
            </div>
          )}
        </>
      )}
    </div>
  )
}
