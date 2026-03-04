// ThinkingBlock — Collapsible display for Claude's extended thinking process.
// Shows "Thought for Xs" when collapsed, full thinking text when expanded.

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { IconChevronRight } from './KernelIcons'
import { TRANSITION } from '../constants/motion'

interface ThinkingBlockProps {
  thinking: string
  thinkingStartTime?: number
  isStreaming?: boolean
}

export function ThinkingBlock({ thinking, thinkingStartTime, isStreaming }: ThinkingBlockProps) {
  const { t } = useTranslation('home')
  const [expanded, setExpanded] = useState(false)

  const duration = useMemo(() => {
    if (!thinkingStartTime) return 0
    return Math.round((Date.now() - thinkingStartTime) / 1000)
  }, [thinkingStartTime, thinking]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!thinking) return null

  return (
    <div className="ka-thinking-block">
      <button
        className={`ka-thinking-block-toggle${expanded ? ' ka-thinking-block-toggle--expanded' : ''}`}
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded}
      >
        <motion.span
          className="ka-thinking-block-chevron"
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <IconChevronRight size={14} />
        </motion.span>
        <span className="ka-thinking-block-label">
          {isStreaming
            ? t('thinking.streaming')
            : t('thinking.duration', { seconds: duration })
          }
        </span>
        {isStreaming && <span className="ka-thinking-block-pulse" />}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="ka-thinking-block-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={TRANSITION.CARD}
          >
            <pre className="ka-thinking-block-text">{thinking}</pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
