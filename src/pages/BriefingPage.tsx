// ─── BriefingPage ────────────────────────────────────────
//
// Full-page immersive reading view for a briefing.
// Rubin typography, literary feel. TOC with section anchors.

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Share2, Check, List, Clock } from 'lucide-react'
import { supabase } from '../engine/SupabaseClient'
import { MessageContent } from '../components/MessageContent'

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
  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)

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
            <ArrowLeft size={16} /> Back to Kernel
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="ka-briefing-page">
      <div className="ka-briefing-nav">
        <Link to="/" className="ka-briefing-back">
          <ArrowLeft size={16} /> Back
        </Link>
        <div className="ka-briefing-nav-actions">
          {toc.length > 0 && (
            <button
              className="ka-briefing-toc-toggle"
              onClick={() => setTocOpen(v => !v)}
              aria-label="Table of contents"
            >
              <List size={16} />
            </button>
          )}
          <button
            className="ka-briefing-share-btn"
            onClick={handleShare}
            aria-label="Copy briefing text"
          >
            {copied ? <Check size={16} /> : <Share2 size={16} />}
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
              <Clock size={12} />
              {readingTime} min read
            </span>
          </div>
          {briefing.topics.length > 0 && (
            <div className="ka-briefing-topics-section">
              <div className="ka-briefing-topics-label">Topics covered</div>
              <div className="ka-briefing-topics">
                {briefing.topics.map(t => (
                  <span key={t} className="ka-brief-topic">{t}</span>
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
          <MessageContent text={briefing.content} />
        </div>

        {briefing.sources.length > 0 && (
          <footer className="ka-briefing-sources">
            <h2>Sources</h2>
            <ul>
              {briefing.sources.map((s, i) => (
                <li key={i}>
                  {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> : s.title}
                </li>
              ))}
            </ul>
          </footer>
        )}
      </article>
    </div>
  )
}
