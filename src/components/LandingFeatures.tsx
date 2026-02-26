import { useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ParticleGrid } from './ParticleGrid'
import { VARIANT, TRANSITION } from '../constants/motion'

interface FeatureCard {
  titleKey: string
  descKey: string
  palette: { particle: string; link: string; field: string }
}

const FEATURES: FeatureCard[] = [
  {
    titleKey: 'login.feature1Title',
    descKey: 'login.feature1Desc',
    palette: { particle: '#6B5B95', link: '#A0768C', field: '#B8875C' }, // kernel
  },
  {
    titleKey: 'login.feature2Title',
    descKey: 'login.feature2Desc',
    palette: { particle: '#5B8BA0', link: '#6B5B95', field: '#7BA89B' }, // researcher
  },
  {
    titleKey: 'login.feature3Title',
    descKey: 'login.feature3Desc',
    palette: { particle: '#B8875C', link: '#A0768C', field: '#D4A774' }, // writer
  },
]

function FeatureCardItem({ feature, index }: { feature: FeatureCard; index: number }) {
  const { t } = useTranslation('auth')
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      ref={ref}
      className="landing-feature"
      variants={VARIANT.FADE_UP}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      transition={TRANSITION.CASCADE(index)}
    >
      <div className="landing-feature-grid-wrap">
        {visible && (
          <ParticleGrid
            palette={feature.palette}
            size={120}
            interactive={false}
            energetic
          />
        )}
      </div>
      <h3>{t(feature.titleKey)}</h3>
      <p>{t(feature.descKey)}</p>
    </motion.div>
  )
}

export function LandingFeatures() {
  return (
    <section className="landing-features">
      {FEATURES.map((feature, i) => (
        <FeatureCardItem key={i} feature={feature} index={i} />
      ))}
    </section>
  )
}
