// ─── PortabilityPanel ───────────────────────────────────
//
// AI Portability hub — import conversations from ChatGPT, Claude,
// Gemini via file upload or share link. Shows what Kernel has learned
// from imports. Export your Kernel data as .kernel JSON.

import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  IconClose, IconDownload, IconExport, IconLink, IconAttach,
  IconBrain, IconUser, IconMessageCircle, IconSparkles, IconArrowRight,
} from './KernelIcons'
import { CONVERSATION_EXTENSIONS } from './ChatHelpers'
import type { UserMemoryProfile } from '../engine/MemoryAgent'
import type { KGEntity } from '../engine/KnowledgeGraph'

interface PortabilityPanelProps {
  userId: string
  userMemory: UserMemoryProfile | null
  kgEntities: KGEntity[]
  conversationCount: number
  onImportFiles: (files: File[]) => void
  onPasteShareLink: (url: string) => void
  onExport: () => void
  onClose: () => void
  onToast: (msg: string) => void
}

type Section = 'import' | 'dashboard' | 'export'

export function PortabilityPanel({
  userId,
  userMemory,
  kgEntities,
  conversationCount,
  onImportFiles,
  onPasteShareLink,
  onExport,
  onClose,
  onToast,
}: PortabilityPanelProps) {
  const { t } = useTranslation('panels')
  const [activeSection, setActiveSection] = useState<Section>('import')
  const [shareLinkInput, setShareLinkInput] = useState('')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setImporting(true)
      onImportFiles(files)
      setTimeout(() => setImporting(false), 2000)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [onImportFiles])

  const handleShareLink = useCallback(() => {
    const url = shareLinkInput.trim()
    if (!url) return
    if (!/^https?:\/\/(chat\.openai\.com|chatgpt\.com|claude\.ai|gemini\.google\.com|g\.co)\/share\//i.test(url)) {
      onToast('Paste a ChatGPT, Claude, or Gemini share link')
      return
    }
    setImporting(true)
    onPasteShareLink(url)
    setShareLinkInput('')
    setTimeout(() => setImporting(false), 3000)
  }, [shareLinkInput, onPasteShareLink, onToast])

  // Compute dashboard stats
  const memoryItems = userMemory
    ? (userMemory.interests?.length || 0) +
      (userMemory.goals?.length || 0) +
      (userMemory.facts?.length || 0) +
      (userMemory.preferences?.length || 0)
    : 0

  const entityTypes = kgEntities.reduce<Record<string, number>>((acc, e) => {
    acc[e.entity_type] = (acc[e.entity_type] || 0) + 1
    return acc
  }, {})

  return (
    <div className="ka-portability-panel">
      <div className="ka-panel-header">
        <h2 className="ka-panel-title">
          <IconExport size={18} aria-hidden="true" />
          Portability
        </h2>
        <button className="ka-panel-close" onClick={onClose} aria-label="Close">
          <IconClose size={18} />
        </button>
      </div>

      {/* Section tabs */}
      <div className="ka-insights-tabs">
        {(['import', 'dashboard', 'export'] as Section[]).map(s => (
          <button
            key={s}
            className={`ka-insights-tab${activeSection === s ? ' ka-insights-tab--active' : ''}`}
            onClick={() => setActiveSection(s)}
          >
            {s === 'import' && <IconAttach size={14} aria-hidden="true" />}
            {s === 'dashboard' && <IconBrain size={14} aria-hidden="true" />}
            {s === 'export' && <IconDownload size={14} aria-hidden="true" />}
            <span>{s === 'import' ? 'Import' : s === 'dashboard' ? 'What I Learned' : 'Export'}</span>
          </button>
        ))}
      </div>

      <div className="ka-insights-content">
        {activeSection === 'import' && (
          <div className="ka-insights-section">
            <h3 className="ka-insights-section-title">Bring your AI history</h3>
            <p className="ka-port-desc">
              Import conversations from ChatGPT, Claude, or Gemini. Kernel learns your preferences, knowledge, and context from your history.
            </p>

            {/* File upload */}
            <div className="ka-port-method">
              <div className="ka-port-method-header">
                <IconAttach size={16} />
                <span>Upload export file</span>
              </div>
              <p className="ka-port-method-desc">
                Upload a .json or .zip export from your AI platform
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={CONVERSATION_EXTENSIONS.join(',')}
                multiple
                onChange={handleFileChange}
                className="ka-attach-input"
                id="ka-port-file-input"
              />
              <label htmlFor="ka-port-file-input" className="ka-port-upload-btn">
                <IconAttach size={14} />
                {importing ? 'Importing...' : 'Choose files'}
              </label>
              <div className="ka-port-platforms">
                <span className="ka-port-platform">ChatGPT</span>
                <span className="ka-port-platform">Claude</span>
                <span className="ka-port-platform">Gemini</span>
              </div>
            </div>

            {/* Share link */}
            <div className="ka-port-method">
              <div className="ka-port-method-header">
                <IconLink size={16} />
                <span>Paste a share link</span>
              </div>
              <p className="ka-port-method-desc">
                Paste a share URL from any platform and Kernel will import it
              </p>
              <div className="ka-port-link-input">
                <input
                  type="url"
                  placeholder="https://chatgpt.com/share/..."
                  value={shareLinkInput}
                  onChange={e => setShareLinkInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleShareLink() }}
                />
                <button
                  onClick={handleShareLink}
                  disabled={!shareLinkInput.trim() || importing}
                  className="ka-port-link-btn"
                >
                  <IconArrowRight size={16} />
                </button>
              </div>
            </div>

            {/* How to export guides */}
            <div className="ka-port-guides">
              <h4 className="ka-port-guides-title">How to export</h4>
              <div className="ka-port-guide">
                <strong>ChatGPT</strong>
                <span>Settings → Data controls → Export data</span>
              </div>
              <div className="ka-port-guide">
                <strong>Claude</strong>
                <span>Settings → Account → Export data</span>
              </div>
              <div className="ka-port-guide">
                <strong>Gemini</strong>
                <span>Share any conversation → copy link</span>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'dashboard' && (
          <div className="ka-insights-section">
            <h3 className="ka-insights-section-title">What Kernel learned</h3>

            {/* Stats overview */}
            <div className="ka-port-stats">
              <div className="ka-port-stat">
                <span className="ka-port-stat-number">{conversationCount}</span>
                <span className="ka-port-stat-label">Conversations</span>
              </div>
              <div className="ka-port-stat">
                <span className="ka-port-stat-number">{memoryItems}</span>
                <span className="ka-port-stat-label">Memory items</span>
              </div>
              <div className="ka-port-stat">
                <span className="ka-port-stat-number">{kgEntities.length}</span>
                <span className="ka-port-stat-label">Entities</span>
              </div>
            </div>

            {/* Memory profile */}
            {userMemory && memoryItems > 0 && (
              <div className="ka-port-memory">
                <div className="ka-port-memory-header">
                  <IconUser size={14} />
                  <span>Your profile</span>
                </div>
                {userMemory.communication_style && (
                  <div className="ka-port-memory-item">
                    <span className="ka-port-memory-label">Style</span>
                    <span className="ka-insights-badge">{userMemory.communication_style}</span>
                  </div>
                )}
                {userMemory.interests && userMemory.interests.length > 0 && (
                  <div className="ka-port-memory-item">
                    <span className="ka-port-memory-label">Interests</span>
                    <div className="ka-port-tags">
                      {userMemory.interests.slice(0, 8).map((item, i) => (
                        <span key={i} className="ka-port-tag">{item}</span>
                      ))}
                    </div>
                  </div>
                )}
                {userMemory.goals && userMemory.goals.length > 0 && (
                  <div className="ka-port-memory-item">
                    <span className="ka-port-memory-label">Goals</span>
                    <div className="ka-port-tags">
                      {userMemory.goals.slice(0, 6).map((item, i) => (
                        <span key={i} className="ka-port-tag">{item}</span>
                      ))}
                    </div>
                  </div>
                )}
                {userMemory.facts && userMemory.facts.length > 0 && (
                  <div className="ka-port-memory-item">
                    <span className="ka-port-memory-label">Facts</span>
                    <ul className="ka-port-fact-list">
                      {userMemory.facts.slice(0, 6).map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Knowledge graph breakdown */}
            {kgEntities.length > 0 && (
              <div className="ka-port-kg">
                <div className="ka-port-memory-header">
                  <IconSparkles size={14} />
                  <span>Knowledge graph</span>
                </div>
                <div className="ka-port-entity-types">
                  {Object.entries(entityTypes).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                    <div key={type} className="ka-port-entity-type">
                      <span className="ka-port-entity-type-name">{type}</span>
                      <span className="ka-port-entity-type-count">{count}</span>
                    </div>
                  ))}
                </div>
                <div className="ka-port-entities">
                  {kgEntities.slice(0, 12).map((e, i) => (
                    <span key={i} className="ka-port-entity">
                      <IconMessageCircle size={12} />
                      {e.name}
                    </span>
                  ))}
                  {kgEntities.length > 12 && (
                    <span className="ka-port-entity ka-port-entity--more">
                      +{kgEntities.length - 12} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {memoryItems === 0 && kgEntities.length === 0 && (
              <div className="ka-port-empty">
                <img className="ka-empty-state-illustration" src={`${import.meta.env.BASE_URL}concepts/empty-knowledge.svg`} alt="" aria-hidden="true" />
                <p className="ka-port-empty-text">
                  Import conversations to build your knowledge profile
                </p>
              </div>
            )}
          </div>
        )}

        {activeSection === 'export' && (
          <div className="ka-insights-section">
            <h3 className="ka-insights-section-title">Export your Kernel data</h3>
            <p className="ka-port-desc">
              Download everything Kernel knows about you — memory profile, knowledge graph, and conversations — as a portable .kernel JSON file.
            </p>

            <div className="ka-port-export-preview">
              <div className="ka-port-export-item">
                <IconUser size={14} />
                <span>Memory profile</span>
                <span className="ka-port-export-count">{memoryItems} items</span>
              </div>
              <div className="ka-port-export-item">
                <IconSparkles size={14} />
                <span>Knowledge graph</span>
                <span className="ka-port-export-count">{kgEntities.length} entities</span>
              </div>
              <div className="ka-port-export-item">
                <IconMessageCircle size={14} />
                <span>Conversations</span>
                <span className="ka-port-export-count">{conversationCount}</span>
              </div>
            </div>

            <button className="ka-port-export-btn" onClick={onExport}>
              <IconDownload size={16} />
              Download .kernel export
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
