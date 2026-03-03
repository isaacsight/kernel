// ─── SandboxPanel — Live Sandbox View ────────────────────────
//
// Split pane showing code editor + output terminal.
// File tree sidebar, browser preview tab.

import { useState, useRef, useEffect } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { SPRING } from '../constants/motion'
import type { Sandbox, SandboxFile } from '../engine/computer/types'

interface SandboxPanelProps {
  sandbox: Sandbox
  outputs: string[]
  onExecute: (code: string, language: string) => void
  onWriteFile: (path: string, content: string) => void
  onTerminal: (command: string) => void
  onDestroy: () => void
  onClose: () => void
}

export function SandboxPanel({
  sandbox,
  outputs,
  onExecute,
  onWriteFile,
  onTerminal,
  onDestroy,
  onClose,
}: SandboxPanelProps) {
  const dragControls = useDragControls()
  const [activeTab, setActiveTab] = useState<'editor' | 'terminal' | 'files'>('editor')
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('javascript')
  const [terminalInput, setTerminalInput] = useState('')
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const outputEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll output
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [outputs.length])

  // Load file content when selected
  useEffect(() => {
    if (activeFile) {
      const file = sandbox.filesystem.find(f => f.path === activeFile)
      if (file) {
        setCode(file.content)
        setLanguage(file.language)
      }
    }
  }, [activeFile, sandbox.filesystem])

  const handleRun = () => {
    if (code.trim()) onExecute(code, language)
  }

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (terminalInput.trim()) {
      onTerminal(terminalInput)
      setTerminalInput('')
    }
  }

  const statusColor = {
    creating: '#F59E0B',
    ready: '#10B981',
    busy: '#6B5B95',
    destroyed: '#6B7280',
    error: '#EF4444',
  }[sandbox.status]

  return (
    <motion.div
      className="ka-sandbox-panel"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={SPRING}
      drag="y"
      dragControls={dragControls}
      dragConstraints={{ top: 0 }}
      dragElastic={0.1}
      onDragEnd={(_, info) => {
        if (info.offset.y > 100) onClose()
      }}
    >
      {/* Handle */}
      <div className="ka-sandbox-handle" onPointerDown={(e) => dragControls.start(e)}>
        <div className="ka-sandbox-handle-bar" />
      </div>

      {/* Header */}
      <div className="ka-sandbox-header">
        <div className="ka-sandbox-header-left">
          <span className="ka-sandbox-status-dot" style={{ background: statusColor }} />
          <h3 className="ka-sandbox-title">Sandbox</h3>
          <span className="ka-sandbox-agent">{sandbox.agentId}</span>
        </div>
        <div className="ka-sandbox-header-actions">
          <button className="ka-sandbox-btn ka-sandbox-btn--danger" onClick={onDestroy}>
            Destroy
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="ka-sandbox-tabs">
        {(['editor', 'terminal', 'files'] as const).map(tab => (
          <button
            key={tab}
            className={`ka-sandbox-tab ${activeTab === tab ? 'ka-sandbox-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="ka-sandbox-content">
        {activeTab === 'editor' && (
          <div className="ka-sandbox-editor-layout">
            {/* Code editor */}
            <div className="ka-sandbox-editor">
              <div className="ka-sandbox-editor-toolbar">
                <select
                  className="ka-sandbox-lang-select"
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                >
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="bash">Bash</option>
                  <option value="html">HTML</option>
                </select>
                <button
                  className="ka-sandbox-btn ka-sandbox-btn--run"
                  onClick={handleRun}
                  disabled={sandbox.status === 'busy'}
                >
                  {sandbox.status === 'busy' ? 'Running...' : 'Run'}
                </button>
              </div>
              <textarea
                className="ka-sandbox-code"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Write your code here..."
                spellCheck={false}
              />
            </div>

            {/* Output */}
            <div className="ka-sandbox-output">
              <div className="ka-sandbox-output-header">Output</div>
              <div className="ka-sandbox-output-content">
                {outputs.map((line, i) => (
                  <div
                    key={i}
                    className={`ka-sandbox-output-line ${line.startsWith('ERROR') ? 'ka-sandbox-output-line--error' : ''}`}
                  >
                    {line}
                  </div>
                ))}
                <div ref={outputEndRef} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="ka-sandbox-terminal">
            <div className="ka-sandbox-terminal-output">
              {outputs.map((line, i) => (
                <div key={i} className="ka-sandbox-terminal-line">{line}</div>
              ))}
              <div ref={outputEndRef} />
            </div>
            <form className="ka-sandbox-terminal-input" onSubmit={handleTerminalSubmit}>
              <span className="ka-sandbox-terminal-prompt">$</span>
              <input
                type="text"
                value={terminalInput}
                onChange={e => setTerminalInput(e.target.value)}
                placeholder="Enter command..."
                className="ka-sandbox-terminal-field"
              />
            </form>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="ka-sandbox-files">
            {sandbox.filesystem.length === 0 ? (
              <div className="ka-sandbox-files-empty">No files yet</div>
            ) : (
              <div className="ka-sandbox-file-list">
                {sandbox.filesystem.map(file => (
                  <button
                    key={file.path}
                    className={`ka-sandbox-file-item ${activeFile === file.path ? 'ka-sandbox-file-item--active' : ''}`}
                    onClick={() => { setActiveFile(file.path); setActiveTab('editor') }}
                  >
                    <span className="ka-sandbox-file-name">{file.path}</span>
                    <span className="ka-sandbox-file-size">{formatSize(file.size)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
