import { useState, useCallback } from 'react'

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

export function useFeatureDiscovery(userId: string | undefined) {
  const [discovered, setDiscovered] = useState<Set<DiscoverableFeature>>(() =>
    userId ? loadDiscovered(userId) : new Set()
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

  const undiscoveredCount = userId
    ? DISCOVERABLE_FEATURES.filter(f => !discovered.has(f)).length
    : 0

  return { isNew, markDiscovered, undiscoveredCount }
}
