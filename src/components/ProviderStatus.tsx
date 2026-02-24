import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useProviderHealth, type SystemStatus } from '../hooks/useProviderHealth'

const STATUS_CONFIG: Record<SystemStatus, { label: string; className: string }> = {
  healthy:  { label: 'All systems operational', className: 'ka-ps-healthy' },
  degraded: { label: 'Some providers degraded', className: 'ka-ps-degraded' },
  down:     { label: 'Service disruption detected', className: 'ka-ps-down' },
}

export function ProviderStatusDot() {
  const { status, loading } = useProviderHealth()
  const [expanded, setExpanded] = useState(false)

  if (loading || status === 'healthy') return null

  const config = STATUS_CONFIG[status]

  return (
    <div className="ka-ps-wrapper">
      <button
        className={`ka-ps-dot ${config.className}`}
        onClick={() => setExpanded(!expanded)}
        aria-label={config.label}
        title={config.label}
      />
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="ka-ps-tooltip"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {config.label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ProviderStatusBanner() {
  const { status, degradedProviders, loading } = useProviderHealth()
  const [dismissed, setDismissed] = useState(false)

  if (loading || status === 'healthy' || dismissed) return null

  const config = STATUS_CONFIG[status]
  const detail = degradedProviders.length > 0
    ? `Routing adjusted for: ${degradedProviders.join(', ')}`
    : 'We are investigating the issue.'

  return (
    <AnimatePresence>
      <motion.div
        className={`ka-ps-banner ${config.className}`}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="ka-ps-banner-content">
          <span className="ka-ps-banner-label">{config.label}</span>
          <span className="ka-ps-banner-detail">{detail}</span>
        </div>
        <button className="ka-ps-banner-dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss">
          &times;
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
