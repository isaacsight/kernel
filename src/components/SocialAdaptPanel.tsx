// ─── SocialAdaptPanel ──────────────────────────────────────────
// Content adaptation + preview + publish for social platforms.
// Opens when user clicks "Distribute" on finished content.

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SPRING } from '../constants/motion'
import { useSocialMedia } from '../hooks/useSocialMedia'
import { PLATFORM_META } from '../engine/social/types'
import type { SocialPlatform, SocialAccount, AdaptedContent } from '../engine/social/types'

interface SocialAdaptPanelProps {
  isOpen: boolean
  onClose: () => void
  content: string
  contentId?: string
  title?: string
}

export function SocialAdaptPanel({ isOpen, onClose, content, contentId, title }: SocialAdaptPanelProps) {
  const social = useSocialMedia()
  const [selectedAccount, setSelectedAccount] = useState<SocialAccount | null>(null)
  const [adapted, setAdapted] = useState<AdaptedContent | null>(null)
  const [editedBody, setEditedBody] = useState('')
  const [isAdapting, setIsAdapting] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<{ platformUrl: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Schedule state
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')

  const handleAdapt = useCallback(async (account: SocialAccount) => {
    setSelectedAccount(account)
    setAdapted(null)
    setEditedBody('')
    setError(null)
    setPublishResult(null)
    setIsAdapting(true)

    try {
      const result = await social.adaptContent(content, account.platform, account.id)
      setAdapted(result)
      setEditedBody(result.body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adaptation failed')
    } finally {
      setIsAdapting(false)
    }
  }, [content, social])

  const handlePublish = useCallback(async () => {
    if (!selectedAccount || !editedBody.trim()) return
    setIsPublishing(true)
    setError(null)

    try {
      const result = await social.publishPost(selectedAccount.id, editedBody, {
        contentId,
        threadParts: adapted?.threadParts,
        hashtags: adapted?.hashtags,
      })
      setPublishResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setIsPublishing(false)
    }
  }, [selectedAccount, editedBody, adapted, contentId, social])

  const handleSchedule = useCallback(async () => {
    if (!selectedAccount || !editedBody.trim() || !scheduleDate || !scheduleTime) return
    setIsPublishing(true)
    setError(null)

    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
      await social.schedulePost(
        selectedAccount.id,
        selectedAccount.platform,
        editedBody,
        scheduledAt,
        { contentId, threadParts: adapted?.threadParts, hashtags: adapted?.hashtags },
      )
      setPublishResult({ platformUrl: '' })
      setShowSchedule(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Schedule failed')
    } finally {
      setIsPublishing(false)
    }
  }, [selectedAccount, editedBody, scheduleDate, scheduleTime, adapted, contentId, social])

  if (!isOpen) return null

  const charLimit = selectedAccount ? (PLATFORM_META[selectedAccount.platform]?.charLimit || 280) : 280
  const charCount = editedBody.length
  const overLimit = charCount > charLimit

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
        className="ka-social-adapt-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SPRING.DEFAULT}
      >
        <div className="ka-social-adapt-header">
          <h2>Distribute Content</h2>
          {title && <p className="ka-social-adapt-subtitle">{title}</p>}
          <button className="ka-social-adapt-close" onClick={onClose}>{'\u2715'}</button>
        </div>

        {/* Account selection */}
        {!adapted && !isAdapting && (
          <div className="ka-social-adapt-accounts">
            <p className="ka-social-adapt-prompt">Select a platform to adapt your content for:</p>
            {social.accounts.length === 0 ? (
              <p className="ka-social-adapt-empty">No connected accounts. Connect one in the Social Media panel.</p>
            ) : (
              social.accounts.map(account => (
                <button
                  key={account.id}
                  className="ka-social-adapt-account-btn"
                  onClick={() => handleAdapt(account)}
                >
                  <span className="ka-social-connect-dot" style={{ background: PLATFORM_META[account.platform]?.color }} />
                  {account.platformDisplayName} ({PLATFORM_META[account.platform]?.label})
                </button>
              ))
            )}
          </div>
        )}

        {/* Adapting */}
        {isAdapting && (
          <div className="ka-social-adapt-loading">
            Adapting for {PLATFORM_META[selectedAccount!.platform]?.label}...
          </div>
        )}

        {/* Preview + Edit */}
        {adapted && !publishResult && (
          <div className="ka-social-adapt-preview">
            <div className="ka-social-adapt-preview-header">
              <span>{PLATFORM_META[selectedAccount!.platform]?.label}</span>
              <span className={`ka-social-adapt-chars${overLimit ? ' ka-social-adapt-chars--over' : ''}`}>
                {charCount}/{charLimit}
              </span>
            </div>

            <textarea
              className="ka-social-adapt-textarea"
              value={editedBody}
              onChange={e => setEditedBody(e.target.value)}
              rows={8}
            />

            {adapted.hashtags.length > 0 && (
              <div className="ka-social-adapt-hashtags">
                {adapted.hashtags.map(tag => (
                  <span key={tag} className="ka-social-adapt-hashtag">#{tag}</span>
                ))}
              </div>
            )}

            {adapted.threadParts && adapted.threadParts.length > 1 && (
              <div className="ka-social-adapt-thread-info">
                Thread: {adapted.threadParts.length} parts
              </div>
            )}

            {error && <p className="ka-social-adapt-error">{error}</p>}

            <div className="ka-social-adapt-actions">
              <button
                className="ka-social-adapt-publish-btn"
                onClick={handlePublish}
                disabled={isPublishing || overLimit || !editedBody.trim()}
              >
                {isPublishing ? 'Publishing...' : 'Publish Now'}
              </button>
              <button
                className="ka-social-adapt-schedule-btn"
                onClick={() => setShowSchedule(!showSchedule)}
                disabled={isPublishing}
              >
                Schedule
              </button>
              <button
                className="ka-social-adapt-back-btn"
                onClick={() => { setAdapted(null); setSelectedAccount(null) }}
              >
                Back
              </button>
            </div>

            <AnimatePresence>
              {showSchedule && (
                <motion.div
                  className="ka-social-schedule-inline"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <div className="ka-social-schedule-row">
                    <input
                      type="date"
                      className="ka-social-schedule-input"
                      value={scheduleDate}
                      onChange={e => setScheduleDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <input
                      type="time"
                      className="ka-social-schedule-input"
                      value={scheduleTime}
                      onChange={e => setScheduleTime(e.target.value)}
                    />
                    <button
                      className="ka-social-adapt-publish-btn"
                      onClick={handleSchedule}
                      disabled={isPublishing || !scheduleDate || !scheduleTime}
                    >
                      {isPublishing ? 'Scheduling...' : 'Schedule'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Published confirmation */}
        {publishResult && (
          <div className="ka-social-adapt-success">
            <span className="ka-social-callback-check">{'\u2713'}</span>
            <h3>{publishResult.platformUrl ? 'Published' : 'Scheduled'}</h3>
            {publishResult.platformUrl && (
              <a
                href={publishResult.platformUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ka-social-adapt-view-link"
              >
                View post
              </a>
            )}
            <button className="ka-social-adapt-done-btn" onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </motion.div>
    </>
  )
}
