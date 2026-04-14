// ─── Personal Platform Page ─────────────────────────────────────
//
// Public profile surface that presents a user's social life and what
// influences them. Route: /#/me/:id
//
// Composed of seven sections that read from the personal_platform
// data model (influences, timeline_events, music_sessions) plus the
// existing author_profiles and social_posts tables.

import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  usePersonalPlatform,
  type FeedItem,
  type Influence,
  type TimelineEvent,
  type MusicSession,
  type SocialPostLite,
} from '../hooks/usePersonalPlatform'
import { MeConversation } from '../components/me/MeConversation'

type Tab = 'converse' | 'now' | 'influences' | 'timeline' | 'music' | 'social' | 'feed'

const TABS: { id: Tab; label: string }[] = [
  { id: 'converse', label: 'Converse' },
  { id: 'now', label: 'Now' },
  { id: 'influences', label: 'Influences' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'music', label: 'Studio' },
  { id: 'social', label: 'Social' },
  { id: 'feed', label: 'Feed' },
]

export function MePage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('converse')
  const platform = usePersonalPlatform(id)

  if (!id) {
    return (
      <div className="ka-me-page">
        <div className="ka-me-error">No user specified. Use /me/&lt;user-id&gt;.</div>
      </div>
    )
  }

  if (platform.loading) {
    return (
      <div className="ka-me-page">
        <div className="ka-me-loading">Loading…</div>
      </div>
    )
  }

  if (platform.error) {
    return (
      <div className="ka-me-page">
        <div className="ka-me-error">{platform.error}</div>
      </div>
    )
  }

  const { profile, influences, timeline, music, posts, feed } = platform

  return (
    <div className="ka-me-page">
      <ProfileHeader profile={profile} userId={id} />

      <nav className="ka-me-tabs" aria-label="Sections">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`ka-me-tab ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </nav>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="ka-me-section"
      >
        {tab === 'converse' && (
          <MeConversation
            ctx={{ profile, influences, timeline, music, posts }}
            name={profile?.display_name ?? 'this person'}
          />
        )}
        {tab === 'now' && (
          <NowSection
            latestTimeline={timeline[0]}
            topInfluences={influences.slice(0, 5)}
            latestMusic={music[0]}
            latestPost={posts[0]}
          />
        )}
        {tab === 'influences' && <InfluencesSection items={influences} />}
        {tab === 'timeline' && <TimelineSection items={timeline} />}
        {tab === 'music' && <MusicSection items={music} />}
        {tab === 'social' && <SocialSection items={posts} />}
        {tab === 'feed' && <FeedSection items={feed} />}
      </motion.div>
    </div>
  )
}

// ─── Header ─────────────────────────────────────────────────────

interface ProfileHeaderProps {
  profile: {
    display_name: string | null
    bio: string | null
    avatar_url: string | null
    follower_count: number
    following_count: number
  } | null
  userId: string
}

function ProfileHeader({ profile, userId }: ProfileHeaderProps) {
  const name = profile?.display_name ?? 'Unclaimed profile'
  const initial = name.charAt(0).toUpperCase()
  return (
    <header className="ka-me-header">
      <div className="ka-me-avatar">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={name} />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      <div className="ka-me-identity">
        <h1 className="ka-me-name">{name}</h1>
        {profile?.bio && <p className="ka-me-bio">{profile.bio}</p>}
        <div className="ka-me-meta">
          <span className="ka-me-meta-item">{profile?.follower_count ?? 0} followers</span>
          <span className="ka-me-meta-dot">·</span>
          <span className="ka-me-meta-item">{profile?.following_count ?? 0} following</span>
          <span className="ka-me-meta-dot">·</span>
          <span className="ka-me-meta-item ka-me-meta-id">{userId.slice(0, 8)}</span>
        </div>
      </div>
    </header>
  )
}

// ─── Now ────────────────────────────────────────────────────────

interface NowSectionProps {
  latestTimeline?: TimelineEvent
  topInfluences: Influence[]
  latestMusic?: MusicSession
  latestPost?: SocialPostLite
}

function NowSection({ latestTimeline, topInfluences, latestMusic, latestPost }: NowSectionProps) {
  const hasAny = latestTimeline || topInfluences.length > 0 || latestMusic || latestPost
  if (!hasAny) {
    return <EmptyState message="Nothing published yet." />
  }
  return (
    <div className="ka-me-now">
      {latestTimeline && (
        <div className="ka-me-now-card">
          <div className="ka-me-now-label">Latest</div>
          <div className="ka-me-now-title">{latestTimeline.title}</div>
          {latestTimeline.body && <p className="ka-me-now-body">{latestTimeline.body}</p>}
          <div className="ka-me-now-date">{formatDate(latestTimeline.occurred_at)}</div>
        </div>
      )}
      {topInfluences.length > 0 && (
        <div className="ka-me-now-card">
          <div className="ka-me-now-label">Currently shaped by</div>
          <ul className="ka-me-now-list">
            {topInfluences.map(inf => (
              <li key={inf.id} className="ka-me-now-list-item">
                <span className="ka-me-chip">{inf.kind}</span>
                <span className="ka-me-now-list-title">{inf.title}</span>
                {inf.creator && <span className="ka-me-now-list-by">— {inf.creator}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {latestMusic && (
        <div className="ka-me-now-card">
          <div className="ka-me-now-label">In the studio</div>
          <div className="ka-me-now-title">{latestMusic.title}</div>
          <div className="ka-me-now-meta">
            {latestMusic.kind && <span>{latestMusic.kind}</span>}
            {latestMusic.bpm && <span>{latestMusic.bpm} bpm</span>}
            {latestMusic.musical_key && <span>{latestMusic.musical_key}</span>}
            {latestMusic.genre && <span>{latestMusic.genre}</span>}
          </div>
          <div className="ka-me-now-date">{formatDate(latestMusic.occurred_at)}</div>
        </div>
      )}
      {latestPost && (
        <div className="ka-me-now-card">
          <div className="ka-me-now-label">Last post · {latestPost.platform}</div>
          <p className="ka-me-now-body">{latestPost.body}</p>
          {latestPost.published_at && (
            <div className="ka-me-now-date">{formatDate(latestPost.published_at)}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Influences ─────────────────────────────────────────────────

function InfluencesSection({ items }: { items: Influence[] }) {
  const grouped = useMemo(() => {
    const m = new Map<string, Influence[]>()
    items.forEach(i => {
      const list = m.get(i.kind) ?? []
      list.push(i)
      m.set(i.kind, list)
    })
    return Array.from(m.entries())
  }, [items])

  if (items.length === 0) return <EmptyState message="No influences logged yet." />

  return (
    <div className="ka-me-influences">
      {grouped.map(([kind, list]) => (
        <section key={kind} className="ka-me-influence-group">
          <h2 className="ka-me-group-title">{kind}</h2>
          <ul className="ka-me-influence-list">
            {list.map(inf => (
              <li key={inf.id} className="ka-me-influence-item">
                <div className="ka-me-influence-head">
                  <span className="ka-me-influence-title">{inf.title}</span>
                  {inf.creator && <span className="ka-me-influence-by">— {inf.creator}</span>}
                </div>
                {inf.note && <p className="ka-me-influence-note">{inf.note}</p>}
                <div className="ka-me-influence-meta">
                  <span className="ka-me-weight" aria-label={`weight ${inf.weight}`}>
                    {'▮'.repeat(inf.weight)}{'▯'.repeat(10 - inf.weight)}
                  </span>
                  {inf.url && (
                    <a className="ka-me-link" href={inf.url} target="_blank" rel="noopener noreferrer">
                      source ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

// ─── Timeline ───────────────────────────────────────────────────

function TimelineSection({ items }: { items: TimelineEvent[] }) {
  if (items.length === 0) return <EmptyState message="Timeline is empty." />
  return (
    <ol className="ka-me-timeline">
      {items.map(ev => (
        <li key={ev.id} className="ka-me-timeline-item">
          <div className="ka-me-timeline-date">{formatDate(ev.occurred_at)}</div>
          <div className="ka-me-timeline-content">
            <div className="ka-me-timeline-head">
              <span className="ka-me-chip">{ev.kind}</span>
              <span className="ka-me-timeline-title">{ev.title}</span>
            </div>
            {ev.body && <p className="ka-me-timeline-body">{ev.body}</p>}
            {ev.url && (
              <a className="ka-me-link" href={ev.url} target="_blank" rel="noopener noreferrer">
                {ev.url} ↗
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

// ─── Music ──────────────────────────────────────────────────────

function MusicSection({ items }: { items: MusicSession[] }) {
  if (items.length === 0) return <EmptyState message="No studio sessions logged." />
  return (
    <div className="ka-me-music">
      {items.map(m => (
        <article key={m.id} className="ka-me-music-card">
          <div className="ka-me-music-head">
            {m.kind && <span className="ka-me-chip">{m.kind}</span>}
            <h3 className="ka-me-music-title">{m.title}</h3>
          </div>
          <div className="ka-me-music-meta">
            {m.bpm && <span>{m.bpm} bpm</span>}
            {m.musical_key && <span>key {m.musical_key}</span>}
            {m.genre && <span>{m.genre}</span>}
            {m.duration_min && <span>{m.duration_min} min</span>}
          </div>
          {m.note && <p className="ka-me-music-note">{m.note}</p>}
          <div className="ka-me-music-foot">
            <span className="ka-me-music-date">{formatDate(m.occurred_at)}</span>
            {m.artifact_url && (
              <a className="ka-me-link" href={m.artifact_url} target="_blank" rel="noopener noreferrer">
                listen ↗
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}

// ─── Social ─────────────────────────────────────────────────────

function SocialSection({ items }: { items: SocialPostLite[] }) {
  if (items.length === 0) return <EmptyState message="No published posts." />
  return (
    <ul className="ka-me-social">
      {items.map(p => (
        <li key={p.id} className="ka-me-social-item">
          <div className="ka-me-social-head">
            <span className="ka-me-chip">{p.platform}</span>
            {p.published_at && <span className="ka-me-social-date">{formatDate(p.published_at)}</span>}
          </div>
          <p className="ka-me-social-body">{p.body}</p>
          {p.platform_url && (
            <a className="ka-me-link" href={p.platform_url} target="_blank" rel="noopener noreferrer">
              view on {p.platform} ↗
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}

// ─── Feed ───────────────────────────────────────────────────────

function FeedSection({ items }: { items: FeedItem[] }) {
  if (items.length === 0) return <EmptyState message="No feed items yet." />
  return (
    <ul className="ka-me-feed">
      {items.map(it => (
        <li key={`${it.item_type}-${it.id}`} className="ka-me-feed-item">
          <div className="ka-me-feed-head">
            <span className="ka-me-chip">{it.item_type}</span>
            <span className="ka-me-feed-kind">{it.kind}</span>
            <span className="ka-me-feed-date">{formatDate(it.at)}</span>
          </div>
          <div className="ka-me-feed-title">{it.title}</div>
          {it.body && <p className="ka-me-feed-body">{it.body}</p>}
          {it.url && (
            <a className="ka-me-link" href={it.url} target="_blank" rel="noopener noreferrer">
              {it.url} ↗
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}

// ─── Shared ─────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return <div className="ka-me-empty">{message}</div>
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}
