// ─── SocialMediaPanel ──────────────────────────────────────────
//
// Bottom-sheet panel for social media management.
// Three tabs: Accounts, Posts, Analytics.

import { useState, useEffect, useCallback, Suspense } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { SPRING } from '../constants/motion'
import { useSocialMedia } from '../hooks/useSocialMedia'
import { PLATFORM_META } from '../engine/social/types'
import type { SocialPlatform, SocialAccount, SocialPost } from '../engine/social/types'
import { lazyRetry } from '../utils/lazyRetry'

const SocialAnalyticsCard = lazyRetry(() => import('./SocialAnalyticsCard').then(m => ({ default: m.SocialAnalyticsCard })))

type Tab = 'accounts' | 'posts' | 'analytics'

interface SocialMediaPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function SocialMediaPanel({ isOpen, onClose }: SocialMediaPanelProps) {
  const [tab, setTab] = useState<Tab>('accounts')
  const dragControls = useDragControls()
  const social = useSocialMedia()

  // Load accounts on mount
  useEffect(() => {
    if (isOpen) {
      social.refreshAccounts()
    }
  }, [isOpen])

  // Listen for OAuth callback messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'social-auth-success') {
        social.refreshAccounts()
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [social.refreshAccounts])

  if (!isOpen) return null

  return (
    <>
      <motion.div
        className="ka-more-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="ka-social-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SPRING.DEFAULT}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 300) onClose()
        }}
      >
        <div className="ka-more-drag-handle" onPointerDown={(e) => dragControls.start(e)} />

        <div className="ka-social-panel-header">
          <h2 className="ka-social-panel-title">Social Media</h2>
          <div className="ka-social-panel-tabs">
            {(['accounts', 'posts', 'analytics'] as Tab[]).map(t => (
              <button
                key={t}
                className={`ka-social-panel-tab${tab === t ? ' ka-social-panel-tab--active' : ''}`}
                onClick={() => {
                  setTab(t)
                  if (t === 'posts') social.refreshPosts()
                  if (t === 'analytics') social.refreshDashboard()
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="ka-social-panel-content">
          {tab === 'accounts' && (
            <AccountsTab
              accounts={social.accounts}
              isLoading={social.isLoading}
              onConnect={social.connectAccount}
              onDisconnect={social.disconnectAccount}
            />
          )}
          {tab === 'posts' && (
            <PostsTab
              posts={social.posts}
              accounts={social.accounts}
              onCancel={social.cancelScheduled}
            />
          )}
          {tab === 'analytics' && (
            <Suspense fallback={<div className="ka-social-loading">Loading analytics...</div>}>
              <AnalyticsTab
                dashboard={social.dashboard}
                onCollect={social.collectAnalytics}
              />
            </Suspense>
          )}
        </div>
      </motion.div>
    </>
  )
}

// ─── Accounts Tab ─────────────────────────────────────────────

function AccountsTab({
  accounts,
  isLoading,
  onConnect,
  onDisconnect,
}: {
  accounts: SocialAccount[]
  isLoading: boolean
  onConnect: (platform: SocialPlatform) => void
  onDisconnect: (id: string) => void
}) {
  const availablePlatforms: SocialPlatform[] = ['twitter', 'linkedin']

  return (
    <div className="ka-social-accounts">
      {accounts.length > 0 && (
        <div className="ka-social-account-list">
          {accounts.map(account => (
            <div key={account.id} className="ka-social-account-item">
              {account.platformAvatarUrl && (
                <img
                  src={account.platformAvatarUrl}
                  alt=""
                  className="ka-social-account-avatar"
                />
              )}
              <div className="ka-social-account-info">
                <span className="ka-social-account-name">{account.platformDisplayName}</span>
                <span className="ka-social-account-platform">
                  @{account.platformUsername} · {PLATFORM_META[account.platform]?.label}
                </span>
              </div>
              <button
                className="ka-social-account-disconnect"
                onClick={() => onDisconnect(account.id)}
              >
                Disconnect
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="ka-social-connect-section">
        <span className="ka-social-section-label">Connect a platform</span>
        <div className="ka-social-connect-buttons">
          {availablePlatforms.map(platform => {
            const meta = PLATFORM_META[platform]
            const connected = accounts.some(a => a.platform === platform)
            return (
              <button
                key={platform}
                className="ka-social-connect-btn"
                onClick={() => onConnect(platform)}
                disabled={isLoading}
              >
                <span className="ka-social-connect-dot" style={{ background: meta.color }} />
                {connected ? `Add another ${meta.label}` : `Connect ${meta.label}`}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Posts Tab ─────────────────────────────────────────────────

function PostsTab({
  posts,
  accounts,
  onCancel,
}: {
  posts: SocialPost[]
  accounts: SocialAccount[]
  onCancel: (postId: string) => void
}) {
  const getAccountName = useCallback((accountId: string) => {
    const account = accounts.find(a => a.id === accountId)
    return account?.platformUsername || 'Unknown'
  }, [accounts])

  if (posts.length === 0) {
    return (
      <div className="ka-social-empty">
        <p>No posts yet. Create content with the pipeline, then distribute it here.</p>
      </div>
    )
  }

  const statusLabel: Record<string, string> = {
    draft: 'Draft', scheduled: 'Scheduled', publishing: 'Publishing...',
    published: 'Published', failed: 'Failed', cancelled: 'Cancelled',
  }

  return (
    <div className="ka-social-posts-list">
      {posts.map(post => (
        <div key={post.id} className={`ka-social-post-item ka-social-post-item--${post.status}`}>
          <div className="ka-social-post-header">
            <span className="ka-social-post-platform">{PLATFORM_META[post.platform]?.label}</span>
            <span className="ka-social-post-account">@{getAccountName(post.accountId)}</span>
            <span className={`ka-social-post-status ka-social-post-status--${post.status}`}>
              {statusLabel[post.status] || post.status}
            </span>
          </div>
          <p className="ka-social-post-body">
            {post.body.length > 140 ? post.body.slice(0, 140) + '...' : post.body}
          </p>
          {post.platformUrl && (
            <a
              href={post.platformUrl}
              className="ka-social-post-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on {PLATFORM_META[post.platform]?.label}
            </a>
          )}
          {post.status === 'scheduled' && (
            <div className="ka-social-post-actions">
              <span className="ka-social-post-scheduled">
                Scheduled: {new Date(post.scheduledAt!).toLocaleString()}
              </span>
              <button className="ka-social-post-cancel" onClick={() => onCancel(post.id)}>
                Cancel
              </button>
            </div>
          )}
          {post.status === 'failed' && post.publishError && (
            <span className="ka-social-post-error">{post.publishError}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Analytics Tab ────────────────────────────────────────────

function AnalyticsTab({
  dashboard,
  onCollect,
}: {
  dashboard: any
  onCollect: (postId: string) => void
}) {
  if (!dashboard) {
    return (
      <div className="ka-social-empty">
        <p>Publish some posts to see analytics here.</p>
      </div>
    )
  }

  return (
    <div className="ka-social-analytics">
      <div className="ka-social-analytics-totals">
        <div className="ka-social-analytics-stat">
          <span className="ka-social-analytics-value">{dashboard.totals.impressions.toLocaleString()}</span>
          <span className="ka-social-analytics-label">Impressions</span>
        </div>
        <div className="ka-social-analytics-stat">
          <span className="ka-social-analytics-value">{dashboard.totals.likes.toLocaleString()}</span>
          <span className="ka-social-analytics-label">Likes</span>
        </div>
        <div className="ka-social-analytics-stat">
          <span className="ka-social-analytics-value">{dashboard.totals.reposts.toLocaleString()}</span>
          <span className="ka-social-analytics-label">Reposts</span>
        </div>
        <div className="ka-social-analytics-stat">
          <span className="ka-social-analytics-value">{dashboard.totals.replies.toLocaleString()}</span>
          <span className="ka-social-analytics-label">Replies</span>
        </div>
      </div>

      <div className="ka-social-analytics-posts">
        {dashboard.posts.map((post: any) => (
          <Suspense key={post.id} fallback={null}>
            <SocialAnalyticsCard post={post} onRefresh={() => onCollect(post.id)} />
          </Suspense>
        ))}
      </div>
    </div>
  )
}
