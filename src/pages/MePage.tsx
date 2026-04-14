// ─── Personal Platform Page — Museum of Thoughts ───────────────
//
// /me/:id renders as a small museum. Every influence, event, studio
// session, post, or feed item is an *exhibit* — spotlit one at a
// time, with a placard. The Docent (an AI agent grounded in the
// record) accompanies visitors and answers questions. The platform
// is the agent, and the agent is the room.

import { useCallback, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  usePersonalPlatform,
  type Influence,
  type TimelineEvent,
  type MusicSession,
  type SocialPostLite,
  type FeedItem,
} from '../hooks/usePersonalPlatform'
import { MeConversation, type MeConversationHandle } from '../components/me/MeConversation'
import { Exhibit, EmptyRoom, type PlacardField } from '../components/me/Exhibit'

type Tab = 'docent' | 'foyer' | 'influences' | 'chronicle' | 'studio' | 'dispatches' | 'archive'

const TABS: { id: Tab; label: string; hall: string }[] = [
  { id: 'docent',     label: 'Docent',     hall: 'The Docent' },
  { id: 'foyer',      label: 'Foyer',      hall: 'Foyer' },
  { id: 'influences', label: 'Influences', hall: 'Influences' },
  { id: 'chronicle',  label: 'Chronicle',  hall: 'Chronicle' },
  { id: 'studio',     label: 'Studio',     hall: 'Studio' },
  { id: 'dispatches', label: 'Dispatches', hall: 'Dispatches' },
  { id: 'archive',    label: 'Archive',    hall: 'Archive' },
]

export function MePage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('docent')
  const platform = usePersonalPlatform(id)
  const conversationRef = useRef<MeConversationHandle>(null)

  // Exhibit cursors per hall
  const [influenceIdx, setInfluenceIdx] = useState(0)
  const [chronicleIdx, setChronicleIdx] = useState(0)
  const [studioIdx, setStudioIdx] = useState(0)
  const [dispatchIdx, setDispatchIdx] = useState(0)
  const [archiveIdx, setArchiveIdx] = useState(0)

  const askDocent = useCallback((seed: string) => {
    setTab('docent')
    // Defer to next frame so the tab mounts and ref attaches
    setTimeout(() => conversationRef.current?.ask(seed), 50)
  }, [])

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
        <div className="ka-me-loading">Opening the gallery…</div>
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
  const name = profile?.display_name ?? 'Unclaimed profile'

  return (
    <div className="ka-me-page">
      <ProfileHeader profile={profile} userId={id} />

      <nav className="ka-me-tabs" aria-label="Museum halls">
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
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="ka-me-section"
      >
        {tab === 'docent' && (
          <MeConversation
            ref={conversationRef}
            ctx={{ profile, influences, timeline, music, posts }}
            name={name}
          />
        )}
        {tab === 'foyer' && (
          <Foyer
            name={name}
            influences={influences}
            timeline={timeline}
            music={music}
            onEnter={setTab}
          />
        )}
        {tab === 'influences' && (
          <InfluenceGallery
            items={influences}
            index={influenceIdx}
            onIndex={setInfluenceIdx}
            onAskDocent={askDocent}
          />
        )}
        {tab === 'chronicle' && (
          <ChronicleGallery
            items={timeline}
            index={chronicleIdx}
            onIndex={setChronicleIdx}
            onAskDocent={askDocent}
          />
        )}
        {tab === 'studio' && (
          <StudioGallery
            items={music}
            index={studioIdx}
            onIndex={setStudioIdx}
            onAskDocent={askDocent}
          />
        )}
        {tab === 'dispatches' && (
          <DispatchGallery
            items={posts}
            index={dispatchIdx}
            onIndex={setDispatchIdx}
            onAskDocent={askDocent}
          />
        )}
        {tab === 'archive' && (
          <ArchiveGallery
            items={feed}
            index={archiveIdx}
            onIndex={setArchiveIdx}
            onAskDocent={askDocent}
          />
        )}
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
        <div className="ka-me-institution">A museum of thoughts</div>
        <h1 className="ka-me-name">{name}</h1>
        {profile?.bio && <p className="ka-me-bio">{profile.bio}</p>}
        <div className="ka-me-meta">
          <span className="ka-me-meta-item">{profile?.follower_count ?? 0} patrons</span>
          <span className="ka-me-meta-dot">·</span>
          <span className="ka-me-meta-item">{profile?.following_count ?? 0} inspirations</span>
          <span className="ka-me-meta-dot">·</span>
          <span className="ka-me-meta-item ka-me-meta-id">accn {userId.slice(0, 8)}</span>
        </div>
      </div>
    </header>
  )
}

// ─── Foyer ──────────────────────────────────────────────────────

interface FoyerProps {
  name: string
  influences: Influence[]
  timeline: TimelineEvent[]
  music: MusicSession[]
  onEnter: (tab: Tab) => void
}

function Foyer({ name, influences, timeline, music, onEnter }: FoyerProps) {
  const halls: { tab: Tab; hall: string; count: number; featured?: string }[] = [
    { tab: 'influences', hall: 'Influences', count: influences.length, featured: influences[0]?.title },
    { tab: 'chronicle',  hall: 'Chronicle',  count: timeline.length,   featured: timeline[0]?.title },
    { tab: 'studio',     hall: 'Studio',     count: music.length,      featured: music[0]?.title },
    { tab: 'dispatches', hall: 'Dispatches', count: 0,                 featured: undefined },
    { tab: 'archive',    hall: 'Archive',    count: 0,                 featured: undefined },
  ]

  return (
    <div className="ka-me-foyer">
      <div className="ka-me-foyer-epigraph">
        <p>
          Welcome. This museum displays the thoughts, influences, and works of{' '}
          <em>{name}</em>. The Docent accompanies you — ask about any piece and
          it will answer from the record. Otherwise, wander the halls at your
          own pace.
        </p>
      </div>

      <div className="ka-me-foyer-map">
        {halls.map(h => (
          <button
            key={h.tab}
            type="button"
            className="ka-me-foyer-door"
            onClick={() => onEnter(h.tab)}
            disabled={h.count === 0}
          >
            <span className="ka-me-foyer-door-label">{h.hall}</span>
            <span className="ka-me-foyer-door-count">
              {h.count === 0 ? 'in preparation' : `${h.count} pieces`}
            </span>
            {h.featured && (
              <span className="ka-me-foyer-door-featured">“{h.featured}”</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Gallery wrappers ───────────────────────────────────────────

interface GalleryProps<T> {
  items: T[]
  index: number
  onIndex: (n: number) => void
  onAskDocent: (seed: string) => void
}

function formatMonthYear(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
  } catch { return iso }
}
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch { return iso }
}
function accession(prefix: string, index: number, iso: string): string {
  const year = new Date(iso).getFullYear() || new Date().getFullYear()
  return `${prefix}.${year}.${String(index + 1).padStart(3, '0')}`
}

function InfluenceGallery({ items, index, onIndex, onAskDocent }: GalleryProps<Influence>) {
  if (items.length === 0) return <EmptyRoom hall="Influences" />
  const inf = items[index]
  const placard: PlacardField[] = [
    { label: 'Medium', value: inf.kind },
    { label: 'Weight', value: `${inf.weight} / 10` },
    { label: 'Acquired', value: formatMonthYear(inf.added_at) },
  ]
  if (inf.tags.length > 0) placard.push({ label: 'Tags', value: inf.tags.join(' · ') })

  return (
    <Exhibit
      hall="Influences"
      index={index}
      total={items.length}
      accession={accession('INF', index, inf.added_at)}
      eyebrow={inf.kind}
      title={inf.title}
      attribution={inf.creator ? `— ${inf.creator}` : undefined}
      body={inf.note}
      placard={placard}
      sourceUrl={inf.url}
      sourceLabel="view source"
      onPrev={() => onIndex(Math.max(0, index - 1))}
      onNext={() => onIndex(Math.min(items.length - 1, index + 1))}
      onAskDocent={() =>
        onAskDocent(
          `Tell me about "${inf.title}"${inf.creator ? ` by ${inf.creator}` : ''}. Why does this shape them?`
        )
      }
    />
  )
}

function ChronicleGallery({ items, index, onIndex, onAskDocent }: GalleryProps<TimelineEvent>) {
  if (items.length === 0) return <EmptyRoom hall="Chronicle" />
  const ev = items[index]
  const placard: PlacardField[] = [
    { label: 'Category', value: ev.kind },
    { label: 'Date', value: formatDate(ev.occurred_at) },
  ]
  if (ev.tags.length > 0) placard.push({ label: 'Tags', value: ev.tags.join(' · ') })

  return (
    <Exhibit
      hall="Chronicle"
      index={index}
      total={items.length}
      accession={accession('CHR', index, ev.occurred_at)}
      eyebrow={ev.kind}
      title={ev.title}
      body={ev.body}
      placard={placard}
      sourceUrl={ev.url}
      sourceLabel="reference"
      onPrev={() => onIndex(Math.max(0, index - 1))}
      onNext={() => onIndex(Math.min(items.length - 1, index + 1))}
      onAskDocent={() =>
        onAskDocent(`What is the significance of "${ev.title}" on ${formatDate(ev.occurred_at)}?`)
      }
    />
  )
}

function StudioGallery({ items, index, onIndex, onAskDocent }: GalleryProps<MusicSession>) {
  if (items.length === 0) return <EmptyRoom hall="Studio" />
  const m = items[index]
  const placard: PlacardField[] = []
  if (m.kind) placard.push({ label: 'Form', value: m.kind })
  if (m.bpm) placard.push({ label: 'Tempo', value: `${m.bpm} bpm` })
  if (m.musical_key) placard.push({ label: 'Key', value: m.musical_key })
  if (m.genre) placard.push({ label: 'Idiom', value: m.genre })
  if (m.duration_min) placard.push({ label: 'Duration', value: `${m.duration_min} min` })
  placard.push({ label: 'Dated', value: formatDate(m.occurred_at) })

  return (
    <Exhibit
      hall="Studio"
      index={index}
      total={items.length}
      accession={accession('STU', index, m.occurred_at)}
      eyebrow={m.kind ?? 'Work'}
      title={m.title}
      body={m.note}
      placard={placard}
      sourceUrl={m.artifact_url}
      sourceLabel="listen"
      onPrev={() => onIndex(Math.max(0, index - 1))}
      onNext={() => onIndex(Math.min(items.length - 1, index + 1))}
      onAskDocent={() => onAskDocent(`Tell me about the studio work "${m.title}".`)}
    />
  )
}

function DispatchGallery({ items, index, onIndex, onAskDocent }: GalleryProps<SocialPostLite>) {
  if (items.length === 0) return <EmptyRoom hall="Dispatches" />
  const p = items[index]
  const placard: PlacardField[] = [
    { label: 'Platform', value: p.platform },
  ]
  if (p.published_at) placard.push({ label: 'Dispatched', value: formatDate(p.published_at) })

  return (
    <Exhibit
      hall="Dispatches"
      index={index}
      total={items.length}
      accession={accession('DSP', index, p.published_at ?? new Date().toISOString())}
      eyebrow={p.platform}
      title={p.body}
      placard={placard}
      sourceUrl={p.platform_url}
      sourceLabel={`view on ${p.platform}`}
      onPrev={() => onIndex(Math.max(0, index - 1))}
      onNext={() => onIndex(Math.min(items.length - 1, index + 1))}
      onAskDocent={() => onAskDocent(`What were they thinking when they posted this on ${p.platform}?`)}
    />
  )
}

function ArchiveGallery({ items, index, onIndex, onAskDocent }: GalleryProps<FeedItem>) {
  if (items.length === 0) return <EmptyRoom hall="Archive" />
  const it = items[index]
  const placard: PlacardField[] = [
    { label: 'Collection', value: it.item_type },
    { label: 'Form', value: it.kind },
    { label: 'Dated', value: formatDate(it.at) },
  ]
  if (it.tags.length > 0) placard.push({ label: 'Tags', value: it.tags.join(' · ') })

  return (
    <Exhibit
      hall="Archive"
      index={index}
      total={items.length}
      accession={accession('ARC', index, it.at)}
      eyebrow={it.item_type}
      title={it.title}
      body={it.body}
      placard={placard}
      sourceUrl={it.url}
      onPrev={() => onIndex(Math.max(0, index - 1))}
      onNext={() => onIndex(Math.min(items.length - 1, index + 1))}
      onAskDocent={() => onAskDocent(`Tell me about "${it.title}".`)}
    />
  )
}
