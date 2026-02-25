// ─── BriefingPage ────────────────────────────────────────
//
// Full-page immersive reading view for a briefing.
// Rubin typography, literary feel. TOC with section anchors.

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconShare, IconCheck, IconList, IconClock, IconAlertCircle, IconMessageCircle, IconTarget } from '../components/KernelIcons'
import { supabase } from '../engine/SupabaseClient'
import { upsertUserGoal } from '../engine/SupabaseClient'
import type { UserGoal } from '../engine/GoalTracker'
import { MessageContent } from '../components/MessageContent'
import { splitSections, briefingToGoalDescription } from '../utils/briefingHelpers'

interface BriefingData {
  id: string
  title: string
  content: string
  topics: string[]
  sources: { title: string; url?: string }[]
  created_at: string
}

interface TocEntry {
  text: string
  slug: string
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/_(.+?)_/g, '$1')
}

function toTitleCase(str: string): string {
  return str.replace(/\b\w+/g, w =>
    w.length <= 2 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()
  )
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function estimateReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 220))
}

function extractToc(content: string): TocEntry[] {
  const headingRegex = /^##\s+(.+)$/gm
  const entries: TocEntry[] = []
  let match
  while ((match = headingRegex.exec(content)) !== null) {
    const raw = match[1].trim()
    const text = stripMarkdown(raw)
    const slug = slugify(text)
    entries.push({ text, slug })
  }
  return entries
}

export function BriefingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const [goalSaved, setGoalSaved] = useState(false)

  // Override body fixed positioning so the page can scroll naturally
  useEffect(() => {
    document.body.classList.add('ka-scrollable-page')
    return () => { document.body.classList.remove('ka-scrollable-page') }
  }, [])

  useEffect(() => {
    if (!id) return
    supabase
      .from('briefings')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) console.error('Error loading briefing:', error)
        setBriefing(data as BriefingData | null)
        // Mark as read
        if (data && !data.read_at) {
          supabase.from('briefings').update({ read_at: new Date().toISOString() }).eq('id', id).then(() => {})
        }
        setLoading(false)
      })
  }, [id])

  const toc = useMemo(() => briefing ? extractToc(briefing.content) : [], [briefing])
  const readingTime = useMemo(() => briefing ? estimateReadingTime(briefing.content) : 0, [briefing])
  const sections = useMemo(() => briefing ? splitSections(briefing.content) : [], [briefing])

  const handleGoDeeper = useCallback((sectionHeading: string, sectionBody: string) => {
    if (!briefing) return
    sessionStorage.setItem('kernel-briefing-context', JSON.stringify({
      title: briefing.title,
      section: sectionHeading,
      content: sectionBody,
    }))
    navigate('/')
  }, [briefing, navigate])

  const handleSaveAsGoal = useCallback(async () => {
    if (!briefing || goalSaved) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const goal: UserGoal = {
      user_id: user.id,
      title: `Follow up: ${briefing.title}`,
      description: briefingToGoalDescription(briefing.title, briefing.content),
      category: 'briefing',
      status: 'active',
      priority: 'medium',
      target_date: null,
      milestones: [],
      progress_notes: [],
      check_in_frequency: 'weekly',
      last_check_in_at: null,
    }
    await upsertUserGoal(goal)
    setGoalSaved(true)
    setTimeout(() => setGoalSaved(false), 3000)
  }, [briefing, goalSaved])

  // Inject IDs into rendered h2 elements after MessageContent renders
  useEffect(() => {
    if (!briefing || toc.length === 0) return
    const bodyEl = document.querySelector('.ka-briefing-body')
    if (!bodyEl) return
    const h2s = bodyEl.querySelectorAll('h2')
    h2s.forEach(h2 => {
      const text = stripMarkdown(h2.textContent || '')
      const slug = slugify(text)
      if (toc.some(t => t.slug === slug)) {
        h2.id = slug
      }
    })
  }, [briefing, toc])

  const handleScrollTo = useCallback((slug: string) => {
    const el = document.getElementById(slug)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setTocOpen(false)
    }
  }, [])

  const handleShare = useCallback(async () => {
    if (!briefing) return
    const shareText = `${briefing.title}\n\n${briefing.content}`
    try {
      await navigator.clipboard.writeText(shareText)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = shareText
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [briefing])

  if (loading) {
    return (
      <div className="ka-briefing-page">
        <div className="ka-briefing-loading">Loading briefing...</div>
      </div>
    )
  }

  if (!briefing) {
    return (
      <div className="ka-briefing-page">
        <div className="ka-briefing-error">
          <h1>Briefing not found</h1>
          <Link to="/" className="ka-briefing-back">
            <IconArrowLeft size={16} /> Back to Kernel
          </Link>
        </div>
      </div>
    )
  }

  const isFailed = briefing.content.startsWith('Unable to generate briefing')

  if (isFailed) {
    return (
      <div className="ka-briefing-page">
        <div className="ka-briefing-nav">
          <Link to="/" className="ka-briefing-back">
            <IconArrowLeft size={16} /> Back
          </Link>
        </div>
        <div className="ka-briefing-error">
          <IconAlertCircle size={32} />
          <h1>This briefing couldn't be generated</h1>
          <p>The research step didn't return enough data to create a useful summary. You can generate a new briefing from the panel.</p>
          <Link to="/" className="ka-briefing-back">
            <IconArrowLeft size={16} /> Back to Kernel
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="ka-briefing-page">
      <div className="ka-briefing-nav">
        <Link to="/" className="ka-briefing-back">
          <IconArrowLeft size={16} /> Back
        </Link>
        <div className="ka-briefing-nav-actions">
          {toc.length > 0 && (
            <button
              className="ka-briefing-toc-toggle"
              onClick={() => setTocOpen(v => !v)}
              aria-label="Table of contents"
            >
              <IconList size={16} />
            </button>
          )}
          <button
            className="ka-briefing-share-btn"
            onClick={handleShare}
            aria-label={copied ? 'Copied to clipboard' : 'Share briefing'}
          >
            {copied ? <IconCheck size={16} /> : <IconShare size={16} />}
            {copied ? 'Copied' : 'Share'}
          </button>
        </div>
      </div>

      <article className="ka-briefing-article">
        <header className="ka-briefing-header">
          <h1 className="ka-briefing-title">{briefing.title}</h1>
          <div className="ka-briefing-meta-row">
            <time className="ka-briefing-date">
              {new Date(briefing.created_at).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </time>
            <span className="ka-briefing-reading-time">
              <IconClock size={12} />
              {readingTime} min read &middot; {briefing.content.trim().split(/\s+/).length} words
            </span>
          </div>
          {briefing.topics.length > 0 && (
            <div className="ka-briefing-topics-section">
              <div className="ka-briefing-topics-label">Topics covered</div>
              <div className="ka-briefing-topics">
                {briefing.topics.map(t => (
                  <span key={t} className="ka-brief-topic">{toTitleCase(t)}</span>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* TOC — mobile: collapsible dropdown; desktop: inline block */}
        {toc.length > 0 && (
          <nav className={`ka-briefing-toc${tocOpen ? ' ka-briefing-toc--open' : ''}`}>
            <div className="ka-briefing-toc-label">Contents</div>
            <ol className="ka-briefing-toc-list">
              {toc.map(entry => (
                <li key={entry.slug}>
                  <button
                    className="ka-briefing-toc-item"
                    onClick={() => handleScrollTo(entry.slug)}
                  >
                    {entry.text}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="ka-briefing-body">
          {sections.length > 0 ? (
            sections.map((section, i) => (
              <div key={i} className="ka-briefing-section">
                <MessageContent text={`## ${section.heading}\n\n${section.body}`} />
                <button
                  className="ka-briefing-go-deeper"
                  onClick={() => handleGoDeeper(section.heading, section.body)}
                >
                  <IconMessageCircle size={12} />
                  Go deeper
                </button>
              </div>
            ))
          ) : (
            <MessageContent text={briefing.content} />
          )}
        </div>

        {briefing.sources.filter(s => s.url).length > 0 && (
          <footer className="ka-briefing-sources">
            <h2>Sources</h2>
            <ul>
              {briefing.sources.filter(s => s.url).map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
                </li>
              ))}
            </ul>
          </footer>
        )}

        <div className="ka-briefing-footer-actions">
          <button
            className="ka-briefing-save-goal-btn"
            onClick={handleSaveAsGoal}
            disabled={goalSaved}
          >
            <IconTarget size={14} />
            {goalSaved ? 'Goal saved!' : 'Save takeaways as goal'}
          </button>
        </div>
      </article>
    </div>
  )
}
