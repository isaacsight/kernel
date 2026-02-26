import { useState, useCallback } from 'react'
import { detectCrisis, type CrisisSignal, type CrisisSeverity } from '../engine/CrisisDetector'

interface CrisisState {
  isActive: boolean
  highestSeverity: CrisisSeverity | null
  lastSignal: CrisisSignal | null
}

const SEVERITY_RANK: Record<CrisisSeverity, number> = {
  contextual: 1,
  moderate: 2,
  high: 3,
}

const INITIAL_STATE: CrisisState = {
  isActive: false,
  highestSeverity: null,
  lastSignal: null,
}

export function useCrisisDetection() {
  const [crisisState, setCrisisState] = useState<CrisisState>(INITIAL_STATE)

  // Check a message for crisis content. Severity only escalates, never de-escalates.
  const checkMessage = useCallback((message: string) => {
    const signal = detectCrisis(message)
    if (!signal) return

    setCrisisState(prev => {
      const prevRank = prev.highestSeverity ? SEVERITY_RANK[prev.highestSeverity] : 0
      const newRank = SEVERITY_RANK[signal.severity]
      return {
        isActive: true,
        highestSeverity: newRank > prevRank ? signal.severity : prev.highestSeverity,
        lastSignal: signal,
      }
    })
  }, [])

  // Reset on new conversation
  const resetCrisisState = useCallback(() => {
    setCrisisState(INITIAL_STATE)
  }, [])

  return { crisisState, checkMessage, resetCrisisState }
}
