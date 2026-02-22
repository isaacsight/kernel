// ─── BriefingPanel ───────────────────────────────────────
//
// Bottom-sheet panel showing today's briefing, history, and generate button.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { IconClose, IconNewspaper, IconRefresh, IconCheck, IconClock, IconArrowRight, IconAlertCircle, IconTrash, IconMessageCircle, IconTarget } from './KernelIcons'
import { supabase } from '../engine/SupabaseClient'
import { generateBriefing, type Briefing } from '../engine/BriefingGenerator'
import { MessageContent } from './MessageContent'
import type { UserMemoryProfile } from '../engine/MemoryAgent'
import { briefingToGoalDescription } from '../utils/briefingHelpers'
import type { KGEntity } from '../engine/KnowledgeGraph'

interface BriefingPanelProps {
  userId: string
  userMemory: UserMemoryProfile | null
  kgEntities: KGEntity[]
  onClose: () => void
  onToast: (msg: string) => void
  onGoDeeper?: (title: string, content: string) => void
  onAddGoal?: (title: string, description: string) => void
}

const GEN_PHASES = [
  { key: 'planning', labelKey: 'briefings.phases.planning' },
  { key: 'searching', labelKey: 'briefings.phases.researching' },
  { key: 'synthesizing', labelKey: 'briefings.phases.writing' },
]

function estimateReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 220))
}

/** Ensure markdown headings have proper newline separation */
function normalizeMarkdown(text: string): string {
  // Ensure ## headings are preceded by a blank line (required for markdown parsers)
  return text.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2')
}

/** Truncate markdown content to approximately N words, breaking at paragraph boundaries */
function truncateContent(text: string, maxWords: number): { truncated: string; isTruncated: boolean } {
  const normalized = normalizeMarkdown(text)
  const words = normalized.trim().split(/\s+/)
  if (words.length <= maxWords) return { truncated: normalized, isTruncated: false }
  // Find paragraph break near maxWords
  const partial = words.slice(0, maxWords).join(' ')
  const lastParagraph = partial.lastIndexOf('\n\n')
  const cutoff = lastParagraph > partial.length * 0.5 ? partial.slice(0, lastParagraph) : partial
  return { truncated: cutoff + '...', isTruncated: true }
}

function formatTabLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const month = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const hour = d.getHours()
  const min = d.getMinutes()
  const period = hour < 12 ? 'AM' : 'PM'
  const h = hour % 12 || 12
  const minStr = min > 0 ? `:${min.toString().padStart(2, '0')}` : ''
  return `${month} · ${h}${minStr}${period}`
}

function toTitleCase(str: string): string {
  return str.replace(/\b\w+/g, w =>
    w.length <= 2 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()
  )
}

function isBriefingFailed(b: Briefing): boolean {
  return b.content.startsWith('Unable to generate briefing')
}

export function BriefingPanel({ userId, userMemory, kgEntities, onClose, onToast, onGoDeeper, onAddGoal }: BriefingPanelProps) {
  const { t } = useTranslation('panels')
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
      onToast(t('briefings.toast.generated'))
    } catch (err) {
      console.error('Briefing generation failed:', err)
      onToast(t('briefings.errors.generateFailed'))
    } finally {
      setGenerating(false)
      setGenPhase('')
    }
  }

  const handleDelete = async (briefingId: string) => {
    await supabase.from('briefings').delete().eq('id', briefingId)
    await loadBriefings()
    setSelectedIdx(0)
    onToast(t('briefings.toast.removed'))
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
  const preview = useMemo(() => current ? truncateContent(current.content, 120) : null, [current])

  // Determine completed phases for progress indicator
  const currentPhaseIdx = GEN_PHASES.findIndex(p => p.key === genPhase)

  return (
    <div className="ka-brief-panel">
      <div className="ka-panel-header">
        <h2 className="ka-panel-title">
          <IconNewspaper size={18} aria-hidden="true" />
          {t('briefings.title')}
        </h2>
        <div className="ka-brief-header-actions">
          <button
            className="ka-brief-gen-btn"
            onClick={handleGenerate}
            disabled={generating}
            title={t('briefings.generateTooltip')}
          >
            <IconRefresh size={14} className={generating ? 'ka-spin' : ''} />
            {generating ? t('briefings.generating') : t('briefings.newBriefing')}
          </button>
          <button className="ka-panel-close" onClick={onClose} aria-label="Close">
            <IconClose size={18} />
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
                  {isComplete ? <IconCheck size={12} /> : (i + 1)}
                </span>
                <span className="ka-brief-progress-label">{t(phase.labelKey)}</span>
              </div>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="ka-brief-loading">{t('briefings.loading')}</div>
      ) : briefings.length === 0 && !generating ? (
        <div className="ka-brief-empty">
          <img className="ka-empty-state-illustration" src={`${import.meta.env.BASE_URL}concepts/empty-briefings.svg`} alt="" aria-hidden="true" />
          <h3 className="ka-brief-empty-title">{t('briefings.emptyTitle')}</h3>
          <p>{t('briefings.emptyDesc')}</p>
          <button className="ka-brief-empty-cta" onClick={handleGenerate}>
            {t('briefings.generateFirst')}
          </button>
        </div>
      ) : (
        <>
          {briefings.length > 1 && (
            <div className="ka-brief-tabs">
              {briefings.map((b, i) => (
                <button
                  key={b.id}
                  className={`ka-brief-tab${i === selectedIdx ? ' ka-brief-tab--active' : ''}${isBriefingFailed(b) ? ' ka-brief-tab--failed' : ''}`}
                  onClick={() => setSelectedIdx(i)}
                >
                  {formatTabLabel(b.created_at!)}
                  {isBriefingFailed(b) && <IconAlertCircle size={12} />}
                </button>
              ))}
            </div>
          )}

          {current && isBriefingFailed(current) ? (
            <div className="ka-brief-content ka-brief-content--failed">
              <div className="ka-brief-failed">
                <IconAlertCircle size={24} />
                <h3>{t('briefings.errorTitle')}</h3>
                <p>{t('briefings.errorDesc')}</p>
                <div className="ka-brief-failed-actions">
                  <button className="ka-brief-retry-btn" onClick={handleGenerate} disabled={generating}>
                    <IconRefresh size={14} className={generating ? 'ka-spin' : ''} />
                    {generating ? t('briefings.generating') : t('retry', { ns: 'common' })}
                  </button>
                  <button className="ka-brief-delete-btn" onClick={() => current.id && handleDelete(current.id)}>
                    <IconTrash size={14} />
                    {t('remove', { ns: 'common' })}
                  </button>
                </div>
              </div>
            </div>
          ) : current && (
            <div className="ka-brief-content">
              <h3 className="ka-brief-content-title">{current.title}</h3>
              <div className="ka-brief-meta">
                <IconClock size={12} />
                <span>{t('briefings.readTime', { count: readingTime })}</span>
                <span className="ka-brief-meta-sep">&middot;</span>
                <span>{t('briefings.wordCount', { count: current.content.trim().split(/\s+/).length })}</span>
              </div>
              {current.topics.length > 0 && (
                <div className="ka-brief-topics-section">
                  <div className="ka-brief-topics-label">{t('briefings.topicsCovered')}</div>
                  <div className="ka-brief-topics">
                    {current.topics.map(topic => (
                      <span key={topic} className="ka-brief-topic">{toTitleCase(topic)}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className={`ka-brief-body${preview?.isTruncated ? ' ka-brief-body--faded' : ''}`}>
                <MessageContent text={preview?.truncated || current.content} />
              </div>
              <a
                href={`${import.meta.env.BASE_URL}#/briefing/${current.id}`}
                className="ka-brief-fullpage-btn"
              >
                {preview?.isTruncated ? t('briefings.continueReading') : t('briefings.readFull')} <IconArrowRight size={14} />
              </a>
              <div className="ka-brief-actions">
                {onGoDeeper && (
                  <button
                    className="ka-brief-action-btn"
                    onClick={() => onGoDeeper(current.title, current.content)}
                  >
                    <IconMessageCircle size={14} />
                    {t('briefings.goDeeper')}
                  </button>
                )}
                {onAddGoal && (
                  <button
                    className="ka-brief-action-btn"
                    onClick={() => onAddGoal(
                      `Follow up: ${current.title}`,
                      briefingToGoalDescription(current.title, current.content),
                    )}
                  >
                    <IconTarget size={14} />
                    {t('briefings.saveAsGoal')}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
