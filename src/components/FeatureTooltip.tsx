import { useRef, useLayoutEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

interface FeatureTooltipProps {
  targetRef: React.RefObject<HTMLElement | null>
  text: string
  step: number
  totalSteps: number
  onDismiss: () => void
  onSkip: () => void
  position?: 'above' | 'below'
}

export function FeatureTooltip({ targetRef, text, step, totalSteps, onDismiss, onSkip, position = 'below' }: FeatureTooltipProps) {
  const { t } = useTranslation('home')
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({})

  useLayoutEffect(() => {
    const target = targetRef.current
    if (!target) return
    const rect = target.getBoundingClientRect()
    const left = rect.left + rect.width / 2
    if (position === 'above') {
      setStyle({ position: 'fixed', bottom: window.innerHeight - rect.top + 12, left, transform: 'translateX(-50%)' })
    } else {
      setStyle({ position: 'fixed', top: rect.bottom + 12, left, transform: 'translateX(-50%)' })
    }
  }, [targetRef, position])

  return (
    <motion.div
      ref={tooltipRef}
      className={`ka-feature-tooltip ka-feature-tooltip--${position}`}
      style={style}
      initial={{ opacity: 0, y: position === 'above' ? 8 : -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: position === 'above' ? 8 : -8 }}
      transition={{ duration: 0.25 }}
    >
      <div className={`ka-feature-tooltip-arrow ka-feature-tooltip-arrow--${position}`} />
      <p className="ka-feature-tooltip-text">{text}</p>
      <div className="ka-feature-tooltip-footer">
        <span className="ka-feature-tooltip-step">{step + 1}/{totalSteps}</span>
        <div className="ka-feature-tooltip-actions">
          <button className="ka-feature-tooltip-skip" onClick={onSkip}>{t('tour.skip')}</button>
          <button className="ka-feature-tooltip-btn" onClick={onDismiss}>{t('tour.gotIt')}</button>
        </div>
      </div>
    </motion.div>
  )
}
