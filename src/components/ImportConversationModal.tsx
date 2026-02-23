// ─── ImportConversationModal ──────────────────────────────
//
// Modal for importing conversations from ChatGPT, Claude, Gemini, or any LLM.
// Two modes: Link (paste a share URL) or Paste (paste raw conversation text).

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { IconClose, IconGlobe, IconCheck } from './KernelIcons'
import {
  detectPlatformUrl, importConversation, importConversationFromText,
  convertToKernelMessages,
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

type ImportTab = 'link' | 'paste'

export function ImportConversationModal({
  userId, onClose, onToast, onImported,
}: ImportConversationModalProps) {
  const { t } = useTranslation('common')
  const [tab, setTab] = useState<ImportTab>('paste')
  const [url, setUrl] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Focus appropriate input on mount and tab change
  useEffect(() => {
    requestAnimationFrame(() => {
      if (tab === 'link') inputRef.current?.focus()
      else textareaRef.current?.focus()
    })
  }, [tab])

  // Escape to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Auto-detect platform as user types URL
  useEffect(() => {
    setPlatform(detectPlatformUrl(url))
  }, [url])

  // Clear state when switching tabs
  const switchTab = (newTab: ImportTab) => {
    setTab(newTab)
    setPreview(null)
    setError(null)
  }

  const handleFetchUrl = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setPreview(null)

    try {
      const result = await importConversation(url.trim())
      if (result.messages.length === 0) {
        setError('No messages found. Try the Paste tab instead — copy the conversation and paste it directly.')
      } else {
        setPreview(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch conversation')
    } finally {
      setLoading(false)
    }
  }

  const handleParsePaste = async () => {
    if (!pasteText.trim() || pasteText.trim().length < 20) return
    setLoading(true)
    setError(null)
    setPreview(null)

    try {
      const result = await importConversationFromText(pasteText.trim())
      if (result.messages.length === 0) {
        setError('Couldn\'t identify conversation turns. Try including clear user/assistant labels or more context.')
      } else {
        setPreview(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse conversation')
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

      if (convId) {
        onToast(`Imported ${preview.message_count} messages from ${PLATFORM_LABELS[preview.platform]}`)
        onImported(convId)
        onClose()
      } else {
        setError('Failed to create conversation')
      }
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
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
          <div className="ka-import-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'paste'}
              className={`ka-import-tab ${tab === 'paste' ? 'ka-import-tab--active' : ''}`}
              onClick={() => switchTab('paste')}
            >
              Paste
            </button>
            <button
              role="tab"
              aria-selected={tab === 'link'}
              className={`ka-import-tab ${tab === 'link' ? 'ka-import-tab--active' : ''}`}
              onClick={() => switchTab('link')}
            >
              Link
            </button>
          </div>

          {tab === 'link' && (
            <>
              <p className="ka-import-hint">
                Paste a share link from ChatGPT, Claude, or Gemini.
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
                    onKeyDown={e => { if (e.key === 'Enter' && !loading) handleFetchUrl() }}
                    style={platform ? { paddingLeft: '90px' } : undefined}
                  />
                </div>
                <button
                  className="ka-import-fetch-btn"
                  onClick={handleFetchUrl}
                  disabled={loading || !url.trim()}
                >
                  {loading ? 'Fetching...' : 'Preview'}
                </button>
              </div>
            </>
          )}

          {tab === 'paste' && (
            <>
              <p className="ka-import-hint">
                Copy a conversation from any LLM and paste it here.
              </p>
              <textarea
                ref={textareaRef}
                className="ka-import-textarea"
                placeholder={'User: How do I center a div?\n\nAssistant: There are several ways...'}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={8}
              />
              <button
                className="ka-import-fetch-btn ka-import-parse-btn"
                onClick={handleParsePaste}
                disabled={loading || pasteText.trim().length < 20}
              >
                {loading ? 'Parsing...' : 'Preview'}
              </button>
            </>
          )}

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
