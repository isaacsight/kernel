// Knowledge Engine — Zustand store with persistence
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { KnowledgeTopic, KnowledgeStats, KnowledgeDomain } from '../engine/knowledge/types'

interface KnowledgeStore {
  // State
  topics: KnowledgeTopic[]
  stats: KnowledgeStats | null
  lastSync: number | null

  // Actions
  setTopics: (topics: KnowledgeTopic[]) => void
  setStats: (stats: KnowledgeStats) => void
  markSynced: () => void
  reset: () => void
}

const INITIAL_STATS: KnowledgeStats = {
  totalItems: 0,
  topicCount: 0,
  domainBreakdown: { tech: 0, personal: 0, work: 0, creative: 0, finance: 0, health: 0, general: 0 },
  pendingContradictions: 0,
  lastSync: null,
}

export const useKnowledgeStore = create<KnowledgeStore>()(
  persist(
    (set) => ({
      topics: [],
      stats: null,
      lastSync: null,

      setTopics: (topics) => set({ topics }),
      setStats: (stats) => set({ stats }),
      markSynced: () => set({ lastSync: Date.now() }),
      reset: () => set({ topics: [], stats: null, lastSync: null }),
    }),
    {
      name: 'kernel-knowledge',
      partialize: (state) => ({
        topics: state.topics.slice(0, 50), // cap persisted topics
        stats: state.stats,
        lastSync: state.lastSync,
      }),
    },
  ),
)
