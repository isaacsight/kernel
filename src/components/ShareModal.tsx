// ─── ShareModal ──────────────────────────────────────────
//
// Modal for sharing a conversation via public link.
// Shows existing link if one exists, with copy & revoke options.
// Otherwise shows create form with expiry picker.

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Link, Copy, Check, X, Clock, Trash2 } from 'lucide-react'
import { createSharedConversation, getSharedConversation, deleteSharedConversation } from '../engine/SupabaseClient'

interface ShareModalProps {
  conversationId: string
  conversationTitle: string
  messages: { role: string; content: string; agentName?: string; timestamp: number }[]
  userId: string
  onClose: () => void
  onToast: (msg: string) => void
}

const EXPIRY_OPTIONS = [
  { labelKey: 'share.never', value: null },
  { labelKey: 'share.hours24', value: 1 },
  { labelKey: 'share.days7', value: 7 },
  { labelKey: 'share.days30', value: 30 },
]

export function ShareModal({ conversationId, conversationTitle, messages, userId, onClose, onToast }: ShareModalProps) {
  const { t } = useTranslation('panels')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expiryDays, setExpiryDays] = useState<number | null>(null)
  const [isExisting, setIsExisting] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [existingId, setExistingId] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  // Check for existing shared link on mount
  useEffect(() => {
    let cancelled = false
    getSharedConversation(conversationId).then(existing => {
      if (cancelled) return
      if (existing) {
        const url = `${window.location.origin}${window.location.pathname}#/shared/${existing.id}`
        setShareUrl(url)
        setExistingId(existing.id)
        setIsExisting(true)
      }
      setChecking(false)
    })
    return () => { cancelled = true }
  }, [conversationId])

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

  return (
    <motion.div
      className="ka-upgrade-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="ka-share-modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="ka-share-header">
          <h2 className="ka-share-title">
            <Link size={18} />
            {t('share.title')}
          </h2>
          <button className="ka-share-close" onClick={onClose} aria-label={t('close', { ns: 'common' })}>
            <X size={18} />
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
              <button className="ka-share-copy-btn" onClick={handleCopy}>
                {copied ? <Check size={20} /> : <Copy size={20} />}
              </button>
            </div>
            <div className="ka-share-actions">
              <p className="ka-share-desc">
                {t('share.anyoneCanView')}
              </p>
              <button
                className="ka-share-revoke-btn"
                onClick={handleRevoke}
                disabled={isRevoking}
              >
                <Trash2 size={14} />
                {isRevoking ? t('share.revoking') : t('share.revokeLink')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="ka-share-desc">
              {t('share.createDesc')}
            </p>
            <div className="ka-share-expiry">
              <Clock size={14} />
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
