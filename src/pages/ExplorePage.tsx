// ─── Explore Page ──────────────────────────────────────────────
//
// Public discovery feed at /#/explore. Tabs for trending, recent,
// following. Full-text search. Topic filtering.

import { useEffect, useState, useCallback } from 'react'
import { useDiscovery } from '../hooks/useDiscovery'
import { FeedCard } from '../components/discovery/FeedCard'
import { SearchBar } from '../components/discovery/SearchBar'
import { FeedTabs } from '../components/discovery/FeedTabs'
import { TopicGrid } from '../components/discovery/TopicGrid'
import type { FeedMode } from '../stores/discoveryStore'

export function ExplorePage() {
  const {
    feed, feedMode, feedTopic, feedSearch, feedLoading, feedHasMore, topics,
    loadFeed, loadMore, switchMode, searchContent, filterByTopic,
    engagement, toggleLike, toggleBookmark,
  } = useDiscovery()

  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Check auth state
  useEffect(() => {
    import('../engine/SupabaseClient').then(({ getAccessToken }) => {
      getAccessToken().then(t => setIsAuthenticated(!!t))
    }).catch(() => {})
  }, [])

  // Load initial feed
  useEffect(() => {
    if (feed.length === 0 && !feedLoading) {
      loadFeed('trending', { reset: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleModeSwitch = useCallback((mode: FeedMode) => {
    switchMode(mode)
  }, [switchMode])

  const handleSearch = useCallback((query: string) => {
    if (query) {
      searchContent(query)
    } else {
      switchMode('trending')
    }
  }, [searchContent, switchMode])

  const handleTopicSelect = useCallback((topic: string) => {
    if (feedTopic === topic) {
      switchMode('trending')
    } else {
      filterByTopic(topic)
    }
  }, [feedTopic, filterByTopic, switchMode])

  return (
    <div className="ka-explore">
      {/* Header */}
      <header className="ka-explore-header">
        <a href="/#/" className="ka-explore-logo">Kernel</a>
        <SearchBar
          value={feedSearch || ''}
          onSearch={handleSearch}
          placeholder="Search articles..."
        />
      </header>

      {/* Tabs */}
      <FeedTabs
        activeMode={feedMode === 'search' || feedMode === 'topic' ? 'trending' : feedMode}
        onSwitch={handleModeSwitch}
        isAuthenticated={isAuthenticated}
      />

      {/* Topics (shown on trending mode) */}
      {(feedMode === 'trending' || feedMode === 'topic') && topics.length > 0 && (
        <TopicGrid
          topics={topics}
          activeTopic={feedTopic}
          onSelect={handleTopicSelect}
        />
      )}

      {/* Search result label */}
      {feedMode === 'search' && feedSearch && (
        <div className="ka-explore-search-label">
          Results for <strong>{feedSearch}</strong>
        </div>
      )}

      {/* Feed */}
      <div className="ka-explore-feed" role="feed" aria-label="Content feed">
        {feed.map(item => (
          <FeedCard
            key={item.id}
            item={item}
            isLiked={engagement.liked[item.id] || false}
            isBookmarked={engagement.bookmarked[item.id] || false}
            onToggleLike={toggleLike}
            onToggleBookmark={toggleBookmark}
          />
        ))}

        {/* Empty state */}
        {!feedLoading && feed.length === 0 && (
          <div className="ka-explore-empty">
            <p className="ka-explore-empty-title">
              {feedMode === 'search'
                ? 'No results found'
                : feedMode === 'personalized'
                  ? 'Follow authors to see their posts here'
                  : 'No published content yet'
              }
            </p>
            <p className="ka-explore-empty-desc">
              {feedMode === 'search'
                ? 'Try a different search term'
                : 'Be the first to publish something'
              }
            </p>
          </div>
        )}

        {/* Loading */}
        {feedLoading && (
          <div className="ka-explore-loading">
            <span className="ka-explore-spinner" />
          </div>
        )}

        {/* Load more */}
        {feedHasMore && !feedLoading && (
          <button
            className="ka-explore-load-more"
            onClick={loadMore}
          >
            Load more
          </button>
        )}
      </div>
    </div>
  )
}
