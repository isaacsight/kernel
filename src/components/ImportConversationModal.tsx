// ─── ImportConversationModal ──────────────────────────────
//
// Modal for importing shared ChatGPT conversations via link.

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { IconClose, IconGlobe, IconCheck } from './KernelIcons'
import {
  detectPlatformUrl, importConversation, convertToKernelMessages,
  type Platform, type ImportResult,
} from '../engine/conversationImport'
import { forkSharedConversation } from '../engine/SupabaseClient'

interface ImportConversationModalProps {
  userId: string
  onClose: () => void
  onToast: (msg: string) => void
  onImported: (conversationId: string) => void
}

const PLATFORM_LABELS: Record<Platform | 'unknown', string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  unknown: 'Unknown',
}

export function ImportConversationModal({
  userId, onClose, onToast, onImported,
}: ImportConversationModalProps) {
  const { t } = useTranslation('common')
  const [url, setUrl] = useState('')
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Focus input on mount
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  // Escape to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Auto-detect platform as user types
  useEffect(() => {
    setPlatform(detectPlatformUrl(url))
  }, [url])

  const handleFetch = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setPreview(null)

    try {
      const result = await importConversation(url.trim())
      if (result.messages.length === 0) {
        setError('No messages found at that URL. The page may require authentication or the format may not be supported.')
      } else {
        setPreview(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch conversation')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!preview) return
    setImporting(true)

    try {
      const messages = convertToKernelMessages(preview)
      const convId = await forkSharedConversation(
        userId,
        preview.title,
        messages,
        { source: preview.platform, original_title: preview.title }
      )

      onToast(`Imported ${preview.message_count} messages from ${PLATFORM_LABELS[preview.platform]}`)
      onImported(convId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <motion.div
        className="ka-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        ref={modalRef}
        className="ka-modal ka-import-modal"
        initial={{ opacity: 0, x: '-50%', y: 'calc(-50% + 20px)' }}
        animate={{ opacity: 1, x: '-50%', y: '-50%' }}
        exit={{ opacity: 0, x: '-50%', y: 'calc(-50% + 20px)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Import conversation"
      >
        <div className="ka-modal-header">
          <h2 className="ka-modal-title">Import Conversation</h2>
          <button className="ka-modal-close" onClick={onClose} aria-label={t('close')}>
            <IconClose size={16} />
          </button>
        </div>

        <div className="ka-import-body">
          <p className="ka-import-hint">
            Paste a ChatGPT share link to import a conversation.
          </p>

          <div className="ka-import-input-row">
            <div className="ka-import-input-wrapper">
              {platform && (
                <span className="ka-import-platform-badge">{PLATFORM_LABELS[platform]}</span>
              )}
              <input
                ref={inputRef}
                className="ka-import-input"
                type="url"
                placeholder="https://chatgpt.com/share/..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !loading) handleFetch() }}
                style={platform ? { paddingLeft: '90px' } : undefined}
              />
            </div>
            <button
              className="ka-import-fetch-btn"
              onClick={handleFetch}
              disabled={loading || !url.trim()}
            >
              {loading ? 'Fetching...' : 'Preview'}
            </button>
          </div>

          {error && (
            <div className="ka-import-error">{error}</div>
          )}

          {preview && (
            <div className="ka-import-preview">
              <div className="ka-import-preview-header">
                <span className="ka-import-preview-platform">
                  <IconGlobe size={14} />
                  {PLATFORM_LABELS[preview.platform]}
                </span>
                <span className="ka-import-preview-title">{preview.title}</span>
                <span className="ka-import-preview-count">{preview.message_count} messages</span>
              </div>

              <div className="ka-import-preview-messages">
                {preview.messages.slice(0, 3).map((m, i) => (
                  <div key={i} className={`ka-import-preview-msg ka-import-preview-msg--${m.role}`}>
                    <span className="ka-import-preview-role">
                      {m.role === 'user' ? 'User' : 'Assistant'}
                    </span>
                    <span className="ka-import-preview-content">
                      {m.content.slice(0, 150)}{m.content.length > 150 ? '...' : ''}
                    </span>
                  </div>
                ))}
                {preview.messages.length > 3 && (
                  <div className="ka-import-preview-more">
                    +{preview.messages.length - 3} more messages
                  </div>
                )}
              </div>

              <button
                className="ka-import-confirm-btn"
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? (
                  'Importing...'
                ) : (
                  <>
                    <IconCheck size={14} />
                    Import as Conversation
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}
