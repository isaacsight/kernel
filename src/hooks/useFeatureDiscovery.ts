import { useState, useCallback, useMemo } from 'react'

/**
 * Features that can be "discovered" by the user.
 * Once a user opens a feature, the hint dot disappears permanently.
 */
const DISCOVERABLE_FEATURES = [
  'workflows',
  'scheduled',
  'knowledge',
  'stats',
  'insights',
] as const

export type DiscoverableFeature = (typeof DISCOVERABLE_FEATURES)[number]

function getStorageKey(userId: string) {
  return `kernel-discovered-${userId}`
}

function getNudgeDismissedKey(userId: string) {
  return `kernel-nudges-dismissed-${userId}`
}

function loadDiscovered(userId: string): Set<DiscoverableFeature> {
  try {
    const raw = localStorage.getItem(getStorageKey(userId))
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as DiscoverableFeature[])
  } catch {
    return new Set()
  }
}

function saveDiscovered(userId: string, discovered: Set<DiscoverableFeature>) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify([...discovered]))
}

function loadDismissedNudges(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(getNudgeDismissedKey(userId))
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function saveDismissedNudges(userId: string, dismissed: Set<string>) {
  localStorage.setItem(getNudgeDismissedKey(userId), JSON.stringify([...dismissed]))
}

// ─── Nudge Rules ──────────────────────────────────────────

export interface NudgeContext {
  conversationCount: number
  kgEntityCount: number
  completedGoals: number
}

interface NudgeRule {
  featureId: DiscoverableFeature
  test: (ctx: NudgeContext) => boolean
}

const NUDGE_RULES: NudgeRule[] = [
  { featureId: 'insights', test: (ctx) => ctx.conversationCount >= 5 },
  { featureId: 'knowledge', test: (ctx) => ctx.kgEntityCount >= 10 },
  { featureId: 'stats', test: (ctx) => ctx.completedGoals >= 1 },
  { featureId: 'workflows', test: (ctx) => ctx.conversationCount >= 10 },
]

export interface ActiveNudge {
  featureId: string
}

export function useFeatureDiscovery(userId: string | undefined, nudgeContext?: NudgeContext) {
  const [discovered, setDiscovered] = useState<Set<DiscoverableFeature>>(() =>
    userId ? loadDiscovered(userId) : new Set()
  )

  const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(() =>
    userId ? loadDismissedNudges(userId) : new Set()
  )

  const isNew = useCallback(
    (featureId: string): boolean => {
      if (!userId) return false
      return DISCOVERABLE_FEATURES.includes(featureId as DiscoverableFeature) &&
        !discovered.has(featureId as DiscoverableFeature)
    },
    [userId, discovered]
  )

  const markDiscovered = useCallback(
    (featureId: string) => {
      if (!userId) return
      if (!DISCOVERABLE_FEATURES.includes(featureId as DiscoverableFeature)) return
      setDiscovered(prev => {
        if (prev.has(featureId as DiscoverableFeature)) return prev
        const next = new Set(prev)
        next.add(featureId as DiscoverableFeature)
        saveDiscovered(userId, next)
        return next
      })
    },
    [userId]
  )

  const dismissNudge = useCallback(
    (featureId: string) => {
      if (!userId) return
      setDismissedNudges(prev => {
        const next = new Set(prev)
        next.add(featureId)
        saveDismissedNudges(userId, next)
        return next
      })
    },
    [userId]
  )

  const undiscoveredCount = userId
    ? DISCOVERABLE_FEATURES.filter(f => !discovered.has(f)).length
    : 0

  // Compute active nudge: first matching rule whose feature isn't discovered or dismissed
  const activeNudge = useMemo<ActiveNudge | null>(() => {
    if (!userId || !nudgeContext) return null
    for (const rule of NUDGE_RULES) {
      if (discovered.has(rule.featureId)) continue
      if (dismissedNudges.has(rule.featureId)) continue
      if (rule.test(nudgeContext)) {
        return { featureId: rule.featureId }
      }
    }
    return null
  }, [userId, nudgeContext, discovered, dismissedNudges])

  return { isNew, markDiscovered, undiscoveredCount, activeNudge, dismissNudge }
}
