import { useState, useEffect, useCallback } from 'react'

export type TourStep = 'entity' | 'more-menu' | 'input-bar'

const TOUR_STEPS: TourStep[] = ['entity', 'more-menu', 'input-bar']

export function useFeatureTour(userId: string | null) {
  const [activeStep, setActiveStep] = useState<TourStep | null>(null)

  useEffect(() => {
    if (!userId) return
    const key = `kernel-tour-completed-${userId}`
    if (localStorage.getItem(key)) return

    const timer = setTimeout(() => {
      setActiveStep('entity')
    }, 2000)

    return () => clearTimeout(timer)
  }, [userId])

  const dismiss = useCallback(() => {
    setActiveStep(prev => {
      if (!prev) return null
      const idx = TOUR_STEPS.indexOf(prev)
      const next = TOUR_STEPS[idx + 1] || null
      if (!next && userId) {
        localStorage.setItem(`kernel-tour-completed-${userId}`, '1')
      }
      return next
    })
  }, [userId])

  const skipAll = useCallback(() => {
    setActiveStep(null)
    if (userId) {
      localStorage.setItem(`kernel-tour-completed-${userId}`, '1')
    }
  }, [userId])

  const stepIndex = activeStep ? TOUR_STEPS.indexOf(activeStep) : -1

  return { activeStep, stepIndex, totalSteps: TOUR_STEPS.length, dismiss, skipAll }
}
