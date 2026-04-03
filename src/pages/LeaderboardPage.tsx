import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '../engine/SupabaseClient'
import './LeaderboardPage.css'

// ── Types ──

interface LeaderboardEntry {
  rank: number
  species: string
  level: number
  xp: number
  achievement_count: number
  sessions: number
}

type SpeciesKey = 'fox' | 'owl' | 'cat' | 'robot' | 'ghost' | 'mushroom' | 'octopus' | 'dragon'

// ── Species Data ──

const SPECIES_EMOJI: Record<SpeciesKey, string> = {
  fox: '\uD83E\uDD8A',
  owl: '\uD83E\uDD89',
  cat: '\uD83D\uDC31',
  robot: '\uD83E\uDD16',
  ghost: '\uD83D\uDC7B',
  mushroom: '\uD83C\uDF44',
  octopus: '\uD83D\uDC19',
  dragon: '\uD83D\uDC09',
}

const SPECIES_LEVELS: Record<SpeciesKey, [string, string, string, string]> = {
  fox: ['Kit', 'Scout', 'Tracker', 'Phantom'],
  owl: ['Owlet', 'Watcher', 'Sage', 'Oracle'],
  cat: ['Kitten', 'Hunter', 'Shadow', 'Phantom'],
  robot: ['Spark', 'Circuit', 'Core', 'Singularity'],
  ghost: ['Wisp', 'Shade', 'Specter', 'Phantom'],
  mushroom: ['Spore', 'Sprout', 'Mycelium', 'Ancient'],
  octopus: ['Hatchling', 'Swimmer', 'Depths', 'Kraken'],
  dragon: ['Ember', 'Drake', 'Wyrm', 'Elder'],
}

const ALL_SPECIES: SpeciesKey[] = ['fox', 'owl', 'cat', 'robot', 'ghost', 'mushroom', 'octopus', 'dragon']

const FILTER_TABS: Array<{ key: string; label: string; emoji?: string }> = [
  { key: 'all', label: 'All' },
  ...ALL_SPECIES.map(s => ({ key: s, label: s.charAt(0).toUpperCase() + s.slice(1), emoji: SPECIES_EMOJI[s] })),
]

// ── Helpers ──

function getLevelTitle(species: string, level: number): string {
  const key = species as SpeciesKey
  const titles = SPECIES_LEVELS[key]
  if (!titles) return `L${level}`
  const idx = Math.min(Math.max(level, 0), 3)
  return titles[idx]
}

/** XP required for next level. Rough estimate — 250 XP per level. */
function xpProgress(xp: number): number {
  const levelSize = 250
  const progress = (xp % levelSize) / levelSize
  return Math.min(Math.max(progress * 100, 2), 100)
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

// ── Component ──

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [copied, setCopied] = useState(false)

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('get_buddy_leaderboard', {
        p_limit: 100,
      })
      if (rpcError) throw rpcError
      // The RPC returns ranked entries. Add rank field if not present.
      const ranked: LeaderboardEntry[] = (data || []).map((row: any, i: number) => ({
        rank: row.rank ?? i + 1,
        species: row.species,
        level: row.level ?? 0,
        xp: row.xp ?? 0,
        achievement_count: row.achievement_count ?? 0,
        sessions: row.sessions ?? 0,
      }))
      setEntries(ranked)
    } catch (err: any) {
      console.error('[Leaderboard] fetch error:', err)
      setError(err?.message || 'Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    document.body.classList.add('ka-scrollable-page')
    fetchLeaderboard()
    return () => {
      document.body.classList.remove('ka-scrollable-page')
    }
  }, [fetchLeaderboard])

  // Filtered entries
  const filtered = useMemo(() => {
    if (filter === 'all') return entries
    return entries
      .filter(e => e.species === filter)
      .map((e, i) => ({ ...e, rank: i + 1 }))
  }, [entries, filter])

  // Summary stats
  const stats = useMemo(() => {
    if (!entries.length) return { total: 0, topSpecies: '-', maxLevel: 0 }
    const speciesCount: Record<string, number> = {}
    let maxLevel = 0
    for (const e of entries) {
      speciesCount[e.species] = (speciesCount[e.species] || 0) + 1
      if (e.level > maxLevel) maxLevel = e.level
    }
    const topSpecies = Object.entries(speciesCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'
    return {
      total: entries.length,
      topSpecies: topSpecies.charAt(0).toUpperCase() + topSpecies.slice(1),
      maxLevel,
    }
  }, [entries])

  const copyInstall = () => {
    navigator.clipboard.writeText('npm i -g @kernel.chat/kbot')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const rankClass = (rank: number): string => {
    if (rank === 1) return 'ka-lb-rank ka-lb-rank--gold'
    if (rank === 2) return 'ka-lb-rank ka-lb-rank--silver'
    if (rank === 3) return 'ka-lb-rank ka-lb-rank--bronze'
    return 'ka-lb-rank'
  }

  return (
    <div className="ka-leaderboard">
      <Link to="/" className="ka-lb-back">&larr; kernel.chat</Link>

      {/* Hero */}
      <section className="ka-lb-hero">
        <div className="ka-lb-badge">Buddy Leaderboard</div>
        <h1 className="ka-lb-title">kbot buddies</h1>
        <p className="ka-lb-subtitle">
          Every kbot session grows your companion. See who's climbed the ranks.
        </p>

        {/* Summary */}
        {!loading && !error && entries.length > 0 && (
          <motion.div
            className="ka-lb-summary"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="ka-lb-summary-card">
              <span className="ka-lb-summary-value">{formatNumber(stats.total)}</span>
              <span className="ka-lb-summary-label">Total buddies</span>
            </div>
            <div className="ka-lb-summary-card">
              <span className="ka-lb-summary-value">
                {SPECIES_EMOJI[stats.topSpecies.toLowerCase() as SpeciesKey] || ''} {stats.topSpecies}
              </span>
              <span className="ka-lb-summary-label">Most popular</span>
            </div>
            <div className="ka-lb-summary-card">
              <span className="ka-lb-summary-value">L{stats.maxLevel}</span>
              <span className="ka-lb-summary-label">Highest level</span>
            </div>
          </motion.div>
        )}

        <button
          className="ka-lb-refresh"
          onClick={fetchLeaderboard}
          disabled={loading}
        >
          <span className="ka-lb-refresh-icon">{'\u21BB'}</span>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </section>

      <div className="ka-lb-divider" />

      {/* Species filter tabs */}
      <section style={{ padding: '32px 24px 0' }}>
        <div className="ka-lb-filters">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              className={`ka-lb-filter${filter === tab.key ? ' ka-lb-filter--active' : ''}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.emoji && <span className="ka-lb-filter-emoji">{tab.emoji}</span>}
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Main content */}
      <section className="ka-lb-section">
        {/* Loading */}
        {loading && (
          <div className="ka-lb-table-wrap">
            <div style={{ padding: '8px 0' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="ka-lb-skeleton-row">
                  <div className="ka-lb-skeleton-cell ka-lb-skeleton-cell--short" />
                  <div className="ka-lb-skeleton-cell ka-lb-skeleton-cell--medium" />
                  <div className="ka-lb-skeleton-cell ka-lb-skeleton-cell--wide" />
                  <div className="ka-lb-skeleton-cell ka-lb-skeleton-cell--short" />
                  <div className="ka-lb-skeleton-cell ka-lb-skeleton-cell--short" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="ka-lb-error">
            <h3 className="ka-lb-error-title">Connection lost</h3>
            <p className="ka-lb-error-desc">{error}</p>
            <button className="ka-lb-retry" onClick={fetchLeaderboard}>
              <span>{'\u21BB'}</span> Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="ka-lb-empty">
            <span className="ka-lb-empty-icon">
              {filter !== 'all' ? SPECIES_EMOJI[filter as SpeciesKey] || '\uD83D\uDC3E' : '\uD83D\uDC3E'}
            </span>
            <h3 className="ka-lb-empty-title">No buddies yet</h3>
            <p className="ka-lb-empty-desc">
              {filter !== 'all'
                ? `No ${filter} buddies on the leaderboard yet. Be the first!`
                : 'The leaderboard is empty. Install kbot to get your buddy.'}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="ka-lb-table-wrap">
              <table className="ka-lb-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Buddy</th>
                    <th>XP</th>
                    <th>Achievements</th>
                    <th>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {filtered.map((entry) => (
                      <motion.tr
                        key={`${entry.species}-${entry.rank}-${entry.xp}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <td className={rankClass(entry.rank)}>
                          {entry.rank <= 3 ? ['', '\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'][entry.rank] : entry.rank}
                        </td>
                        <td>
                          <div className="ka-lb-species">
                            <span className="ka-lb-species-emoji">
                              {SPECIES_EMOJI[entry.species as SpeciesKey] || '\uD83D\uDC3E'}
                            </span>
                            <div className="ka-lb-species-info">
                              <span className="ka-lb-species-name">{entry.species}</span>
                              <span className="ka-lb-species-level">
                                L{entry.level} {getLevelTitle(entry.species, entry.level)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="ka-lb-xp">
                            <span className="ka-lb-xp-label">{formatNumber(entry.xp)} XP</span>
                            <div className="ka-lb-xp-track">
                              <motion.div
                                className="ka-lb-xp-bar"
                                initial={{ width: 0 }}
                                animate={{ width: `${xpProgress(entry.xp)}%` }}
                                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="ka-lb-achievements">
                            <span className="ka-lb-trophy">{'\uD83C\uDFC6'}</span>
                            {entry.achievement_count}
                          </span>
                        </td>
                        <td>
                          <span className="ka-lb-sessions">{formatNumber(entry.sessions)}</span>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </section>

      {/* CTA */}
      <div className="ka-lb-divider" />
      <section className="ka-lb-cta">
        <p className="ka-lb-cta-text">
          Get your own buddy companion. It grows with every session.
        </p>
        <div className="ka-lb-install" onClick={copyInstall} role="button" tabIndex={0}>
          <code>npm i -g @kernel.chat/kbot</code>
          <span className="ka-lb-copy">{copied ? 'Copied!' : 'Copy'}</span>
        </div>
      </section>
    </div>
  )
}
