// ─── BriefingPage ────────────────────────────────────────
//
// Full-page immersive reading view for a briefing.
// Rubin typography, literary feel.

import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
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

export function BriefingPage() {
  const { id } = useParams<{ id: string }>()
  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)

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
      <Link to="/" className="ka-briefing-back">
        <ArrowLeft size={16} /> Back
      </Link>

      <article className="ka-briefing-article">
        <header className="ka-briefing-header">
          <h1 className="ka-briefing-title">{briefing.title}</h1>
          <time className="ka-briefing-date">
            {new Date(briefing.created_at).toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </time>
          {briefing.topics.length > 0 && (
            <div className="ka-briefing-topics">
              {briefing.topics.map(t => (
                <span key={t} className="ka-brief-topic">{t}</span>
              ))}
            </div>
          )}
        </header>

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
