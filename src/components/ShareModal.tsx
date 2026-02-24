// ─── ShareModal ──────────────────────────────────────────
//
// Modal for sharing a conversation via public link.
// Shows existing link if one exists, with copy & revoke options.
// Otherwise shows create form with expiry picker.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { IconLink, IconCopy, IconCheck, IconClose, IconClock, IconTrash, IconShare } from './KernelIcons'
import { VARIANT, TRANSITION } from '../constants/motion'
import { createSharedConversation, getSharedConversation, deleteSharedConversation, getShareCountToday } from '../engine/SupabaseClient'

const FREE_SHARE_LIMIT = 3

interface ShareModalProps {
  conversationId: string
  conversationTitle: string
  messages: { role: string; content: string; agentName?: string; timestamp: number }[]
  userId: string
  isPro: boolean
  onClose: () => void
  onToast: (msg: string) => void
  onNativeShare?: (url: string, title: string) => void
}

const EXPIRY_OPTIONS = [
  { labelKey: 'share.never', value: null },
  { labelKey: 'share.hours24', value: 1 },
  { labelKey: 'share.days7', value: 7 },
  { labelKey: 'share.days30', value: 30 },
]

export function ShareModal({ conversationId, conversationTitle, messages, userId, isPro, onClose, onToast, onNativeShare }: ShareModalProps) {
  const { t } = useTranslation('panels')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expiryDays, setExpiryDays] = useState<number | null>(null)
  const [isExisting, setIsExisting] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [existingId, setExistingId] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [sharesToday, setSharestoday] = useState(0)
  const [limitReached, setLimitReached] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  // Focus trap: keep focus within modal
  useEffect(() => {
    const modal = modalRef.current
    if (!modal) return
    const focusable = modal.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')
    if (focusable.length > 0) focusable[0].focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, shareUrl, checking])

  // Check for existing shared link and daily share count on mount
  useEffect(() => {
    let cancelled = false
    Promise.all([
      getSharedConversation(conversationId),
      isPro ? Promise.resolve(0) : getShareCountToday(userId),
    ]).then(([existing, count]) => {
      if (cancelled) return
      if (existing) {
        const url = `${window.location.origin}${window.location.pathname}#/shared/${existing.id}`
        setShareUrl(url)
        setExistingId(existing.id)
        setIsExisting(true)
      }
      if (!isPro) {
        setSharestoday(count)
        setLimitReached(count >= FREE_SHARE_LIMIT && !existing)
      }
      setChecking(false)
    })
    return () => { cancelled = true }
  }, [conversationId, userId, isPro])

  const handleCreate = useCallback(async () => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const expiresAt = expiryDays
        ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
        : null

      const shareId = await createSharedConversation({
        conversationId,
        userId,
        title: conversationTitle,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          agentName: m.agentName,
          timestamp: m.timestamp,
        })),
        expiresAt,
      })

      if (shareId) {
        const url = `${window.location.origin}${window.location.pathname}#/shared/${shareId}`
        setShareUrl(url)
        setExistingId(shareId)
        setIsExisting(true)
      } else {
        onToast(t('share.errors.createFailed'))
      }
    } catch {
      onToast(t('share.errors.createFailed'))
    } finally {
      setIsCreating(false)
    }
  }, [conversationId, userId, conversationTitle, messages, expiryDays, isCreating, onToast])

  const handleRevoke = useCallback(async () => {
    if (!existingId || isRevoking) return
    setIsRevoking(true)
    try {
      await deleteSharedConversation(existingId)
      setShareUrl(null)
      setExistingId(null)
      setIsExisting(false)
      onToast(t('share.toast.revoked'))
    } catch {
      onToast(t('share.errors.revokeFailed'))
    } finally {
      setIsRevoking(false)
    }
  }, [existingId, isRevoking, onToast])

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      // Fallback for non-HTTPS or restricted contexts
      const textArea = document.createElement('textarea')
      textArea.value = shareUrl
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [shareUrl])

  const handleNativeShare = useCallback(() => {
    if (shareUrl && onNativeShare) {
      onNativeShare(shareUrl, conversationTitle)
    }
  }, [shareUrl, onNativeShare, conversationTitle])

  return (
    <motion.div
      className="ka-upgrade-overlay"
      variants={VARIANT.FADE}
      initial="hidden"
      animate="visible"
      exit="hidden"
      transition={TRANSITION.OVERLAY}
      onClick={onClose}
    >
      <motion.div
        ref={modalRef}
        className="ka-share-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        variants={VARIANT.FADE_SCALE}
        initial="hidden"
        animate="visible"
        exit="hidden"
        transition={TRANSITION.CARD}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="ka-share-header">
          <h2 id="share-modal-title" className="ka-share-title">
            <IconLink size={18} />
            {t('share.title')}
          </h2>
          <button className="ka-share-close" onClick={onClose} aria-label={t('close', { ns: 'common' })}>
            <IconClose size={18} />
          </button>
        </div>

        {checking ? (
          <p className="ka-share-desc">{t('share.checking')}</p>
        ) : shareUrl ? (
          <>
            {isExisting && (
              <p className="ka-share-desc ka-share-desc--existing">
                {t('share.existingLink')}
              </p>
            )}
            <div className="ka-share-url-wrap">
              <input
                aria-label={t('share.shareableLink')}
                value={shareUrl}
                readOnly
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <button className="ka-share-copy-btn" onClick={handleCopy} aria-label={copied ? t('share.copied') : t('share.copyLink')}>
                {copied ? <IconCheck size={20} /> : <IconCopy size={20} />}
              </button>
              {canNativeShare && onNativeShare && (
                <button className="ka-share-copy-btn" onClick={handleNativeShare} aria-label={t('share.shareVia')}>
                  <IconShare size={20} />
                </button>
              )}
            </div>
            <span className="ka-sr-only" aria-live="polite">{copied ? t('share.copiedAnnounce') : ''}</span>
            <div className="ka-share-actions">
              <p className="ka-share-desc">
                {t('share.anyoneCanView')}
              </p>
              <button
                className="ka-share-revoke-btn"
                onClick={handleRevoke}
                disabled={isRevoking}
                aria-label={t('share.revokeLink')}
              >
                <IconTrash size={14} />
                {isRevoking ? t('share.revoking') : t('share.revokeLink')}
              </button>
            </div>
          </>
        ) : limitReached ? (
          <>
            <p className="ka-share-desc">
              {t('share.limitReached', { limit: FREE_SHARE_LIMIT })}
            </p>
            <p className="ka-share-desc" style={{ opacity: 0.5, fontSize: '0.8rem' }}>
              {t('share.limitHint', { used: sharesToday, limit: FREE_SHARE_LIMIT })}
            </p>
          </>
        ) : (
          <>
            <p className="ka-share-desc">
              {t('share.createDesc')}
            </p>
            {!isPro && (
              <p className="ka-share-desc" style={{ opacity: 0.5, fontSize: '0.8rem' }}>
                {t('share.dailyCount', { used: sharesToday, limit: FREE_SHARE_LIMIT })}
              </p>
            )}
            <div className="ka-share-expiry">
              <IconClock size={14} />
              <span>{t('share.linkExpires')}</span>
              <div className="ka-share-expiry-options">
                {EXPIRY_OPTIONS.map(opt => (
                  <button
                    key={opt.labelKey}
                    className={`ka-share-expiry-btn${expiryDays === opt.value ? ' ka-share-expiry-btn--active' : ''}`}
                    onClick={() => setExpiryDays(opt.value)}
                  >
                    {t(opt.labelKey)}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="ka-share-create-btn"
              onClick={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? t('share.creating') : t('share.createLink')}
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
