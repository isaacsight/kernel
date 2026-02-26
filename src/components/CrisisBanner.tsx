import { motion, AnimatePresence } from 'framer-motion'
import { CRISIS_RESOURCES, type CrisisSeverity } from '../engine/CrisisDetector'
import { SPRING } from '../constants/motion'

interface CrisisBannerProps {
  isActive: boolean
  severity: CrisisSeverity | null
}

export function CrisisBanner({ isActive, severity }: CrisisBannerProps) {
  const severityClass = severity ? ` ka-crisis-banner--${severity}` : ''

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className={`ka-crisis-banner${severityClass}`}
          role="alert"
          aria-live="assertive"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={SPRING.QUICK}
        >
          <p className="ka-crisis-banner-message">
            If you're in crisis, you're not alone. Help is available.
          </p>
          <div className="ka-crisis-banner-links">
            {CRISIS_RESOURCES.map(r => (
              <span key={r.name} className="ka-crisis-banner-resource">
                {r.phone && (
                  <a href={`tel:${r.phone}`} className="ka-crisis-banner-link">
                    Call {r.phone}
                  </a>
                )}
                {r.sms && (
                  <a href={`sms:${r.sms}&body=HOME`} className="ka-crisis-banner-link">
                    Text {r.sms}
                  </a>
                )}
                {r.url && !r.phone && !r.sms && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="ka-crisis-banner-link">
                    {r.name}
                  </a>
                )}
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
