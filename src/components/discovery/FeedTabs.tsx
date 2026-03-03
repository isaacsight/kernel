// ─── Feed Tabs ─────────────────────────────────────────────────
//
// Tab strip for switching between feed modes.

import type { FeedMode } from '../../stores/discoveryStore'

interface FeedTabsProps {
  activeMode: FeedMode
  onSwitch: (mode: FeedMode) => void
  isAuthenticated: boolean
}

const TABS: { mode: FeedMode; label: string; requiresAuth?: boolean }[] = [
  { mode: 'trending', label: 'Trending' },
  { mode: 'recent', label: 'Recent' },
  { mode: 'personalized', label: 'Following', requiresAuth: true },
]

export function FeedTabs({ activeMode, onSwitch, isAuthenticated }: FeedTabsProps) {
  return (
    <nav className="ka-feed-tabs" role="tablist" aria-label="Feed filter">
      {TABS.map(tab => {
        const disabled = tab.requiresAuth && !isAuthenticated
        return (
          <button
            key={tab.mode}
            className={`ka-feed-tab ${activeMode === tab.mode ? 'ka-feed-tab--active' : ''} ${disabled ? 'ka-feed-tab--disabled' : ''}`}
            onClick={() => !disabled && onSwitch(tab.mode)}
            role="tab"
            aria-selected={activeMode === tab.mode}
            aria-disabled={disabled}
            title={disabled ? 'Sign in to see posts from authors you follow' : undefined}
          >
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
