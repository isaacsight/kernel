// ─── Author Profile Page ───────────────────────────────────────
//
// Public author profile at /#/author/:id. Shows profile info,
// published articles, and follow button.

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useDiscovery } from '../hooks/useDiscovery'
import { AuthorCard } from '../components/discovery/AuthorCard'
import { FeedCard } from '../components/discovery/FeedCard'
import type { AuthorProfile } from '../stores/discoveryStore'
import type { FeedItem } from '../stores/discoveryStore'

export function AuthorProfilePage() {
  const { id } = useParams<{ id: string }>()
  const {
    getAuthorProfile, getEngagementStatus,
    engagement, toggleLike, toggleBookmark, toggleFollow,
  } = useDiscovery()

  const [profile, setProfile] = useState<AuthorProfile | null>(null)
  const [articles, setArticles] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Check current user
  useEffect(() => {
    import('../engine/SupabaseClient').then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) setCurrentUserId(data.user.id)
      })
    }).catch(() => {})
  }, [])

  // Load profile
  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)

    getAuthorProfile(id)
      .then(data => {
        setProfile(data.profile)
        setArticles(data.articles)
      })
      .catch(err => setError(err.message || 'Failed to load profile'))
      .finally(() => setLoading(false))

    // Load engagement status
    getEngagementStatus(undefined, id)
  }, [id, getAuthorProfile, getEngagementStatus])

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      window.location.hash = '#/explore'
    }
  }, [])

  if (loading) {
    return (
      <div className="ka-author-page">
        <div className="ka-author-page-loading">Loading...</div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="ka-author-page">
        <div className="ka-author-page-error">
          <p>{error || 'Author not found'}</p>
          <a href="/#/explore" className="ka-author-page-back-link">Back to Explore</a>
        </div>
      </div>
    )
  }

  return (
    <div className="ka-author-page">
      {/* Back nav */}
      <header className="ka-author-page-header">
        <button className="ka-author-page-back" onClick={handleBack}>
          {'\u2190'} Back
        </button>
      </header>

      {/* Profile card */}
      <AuthorCard
        authorId={id!}
        profile={profile}
        isFollowing={engagement.following[id!] || false}
        onToggleFollow={toggleFollow}
        isOwnProfile={currentUserId === id}
      />

      {/* Articles */}
      <section className="ka-author-page-articles">
        <h2 className="ka-author-page-articles-title">
          Published Articles ({articles.length})
        </h2>
        {articles.length === 0 ? (
          <p className="ka-author-page-empty">No published articles yet.</p>
        ) : (
          <div className="ka-author-page-feed">
            {articles.map(item => (
              <FeedCard
                key={item.id}
                item={item}
                isLiked={engagement.liked[item.id] || false}
                isBookmarked={engagement.bookmarked[item.id] || false}
                onToggleLike={toggleLike}
                onToggleBookmark={toggleBookmark}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
