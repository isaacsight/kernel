// ─── ShareModal ──────────────────────────────────────────
//
// Modal for sharing a conversation via public link.
// Shows existing link if one exists, with copy & revoke options.
// Otherwise shows create form with expiry picker.

import { useState, useEffect, useCallback } from 'react'
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
  { label: 'Never', value: null },
  { label: '24 hours', value: 1 },
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
]

export function ShareModal({ conversationId, conversationTitle, messages, userId, onClose, onToast }: ShareModalProps) {
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
        onToast('Failed to create share link')
      }
    } catch {
      onToast('Failed to create share link')
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
      onToast('Share link revoked')
    } catch {
      onToast('Failed to revoke link')
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
            Share conversation
          </h2>
          <button className="ka-share-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {checking ? (
          <p className="ka-share-desc">Checking for existing link...</p>
        ) : shareUrl ? (
          <>
            {isExisting && (
              <p className="ka-share-desc ka-share-desc--existing">
                This conversation already has a public link.
              </p>
            )}
            <div className="ka-share-url-wrap">
              <input
                aria-label="Shareable conversation link"
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
                Anyone with this link can view this conversation.
              </p>
              <button
                className="ka-share-revoke-btn"
                onClick={handleRevoke}
                disabled={isRevoking}
              >
                <Trash2 size={14} />
                {isRevoking ? 'Revoking...' : 'Revoke link'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="ka-share-desc">
              Create a public link anyone can view. No login required.
            </p>
            <div className="ka-share-expiry">
              <Clock size={14} />
              <span>Link expires:</span>
              <div className="ka-share-expiry-options">
                {EXPIRY_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    className={`ka-share-expiry-btn${expiryDays === opt.value ? ' ka-share-expiry-btn--active' : ''}`}
                    onClick={() => setExpiryDays(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="ka-share-create-btn"
              onClick={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Create share link'}
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
