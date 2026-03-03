// ─── AgentLibraryPanel — Browse & Install Agents ─────────────
//
// Bottom-sheet grid of pre-built + community agents.
// Users can browse, install, and uninstall agents.

import { useState, useEffect, useCallback } from 'react'
import { motion, useDragControls, AnimatePresence } from 'framer-motion'
import { SPRING, VARIANT, TRANSITION } from '../constants/motion'
import type { CustomAgent } from '../engine/agent/types'

interface AgentLibraryPanelProps {
  installedIds: string[]
  onInstall: (agent: CustomAgent) => void
  onUninstall: (agentId: string) => void
  onLoadLibrary: () => Promise<CustomAgent[]>
  onClose: () => void
}

export function AgentLibraryPanel({
  installedIds,
  onInstall,
  onUninstall,
  onLoadLibrary,
  onClose,
}: AgentLibraryPanelProps) {
  const dragControls = useDragControls()
  const [agents, setAgents] = useState<CustomAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let mounted = true
    setLoading(true)
    onLoadLibrary().then(data => {
      if (mounted) {
        setAgents(data)
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [onLoadLibrary])

  const filtered = search.trim()
    ? agents.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.persona.toLowerCase().includes(search.toLowerCase())
      )
    : agents

  const handleToggleInstall = useCallback((agent: CustomAgent) => {
    if (installedIds.includes(agent.id)) {
      onUninstall(agent.id)
    } else {
      onInstall(agent)
    }
  }, [installedIds, onInstall, onUninstall])

  return (
    <motion.div
      className="ka-agent-library-panel"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={SPRING.DEFAULT}
      drag="y"
      dragControls={dragControls}
      dragConstraints={{ top: 0 }}
      dragElastic={0.1}
      onDragEnd={(_, info) => {
        if (info.offset.y > 100) onClose()
      }}
    >
      {/* Handle */}
      <div
        className="ka-agent-library-handle"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="ka-agent-library-handle-bar" />
      </div>

      {/* Header */}
      <div className="ka-agent-library-header">
        <h3 className="ka-agent-library-title">Agent Library</h3>
        <button className="ka-agent-library-close" onClick={onClose}>
          Done
        </button>
      </div>

      {/* Search */}
      <div className="ka-agent-library-search-wrapper">
        <input
          className="ka-agent-library-search"
          type="text"
          placeholder="Search agents..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      <div className="ka-agent-library-body">
        {loading ? (
          <div className="ka-agent-library-loading">Loading agents...</div>
        ) : filtered.length === 0 ? (
          <div className="ka-agent-library-empty">
            {search ? 'No agents match your search' : 'No public agents yet'}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div
              className="ka-agent-library-grid"
              variants={VARIANT.STAGGER_CONTAINER}
              initial="hidden"
              animate="visible"
            >
              {filtered.map(agent => (
                <motion.div
                  key={agent.id}
                  className="ka-agent-library-card"
                  variants={VARIANT.STAGGER_ITEM}
                  transition={TRANSITION.CARD}
                  layout
                >
                  <div
                    className="ka-agent-library-card-icon"
                    style={{ background: `${agent.color}18`, borderColor: `${agent.color}40` }}
                  >
                    {agent.icon}
                  </div>
                  <div className="ka-agent-library-card-info">
                    <h4 className="ka-agent-library-card-name">{agent.name}</h4>
                    <p className="ka-agent-library-card-desc">
                      {agent.persona.slice(0, 80)}{agent.persona.length > 80 ? '...' : ''}
                    </p>
                    <span className="ka-agent-library-card-installs">
                      {agent.install_count} install{agent.install_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    className={`ka-agent-library-card-btn ${installedIds.includes(agent.id) ? 'ka-agent-library-card-btn--installed' : ''}`}
                    onClick={() => handleToggleInstall(agent)}
                  >
                    {installedIds.includes(agent.id) ? 'Remove' : 'Install'}
                  </button>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  )
}
