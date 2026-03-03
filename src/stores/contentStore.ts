// ─── Content Store — Pipeline State Persistence ────────────────
//
// Tracks content items and algorithm weights. Persists metadata
// to localStorage (same pattern as projectStore). Full content
// lives in memory — loaded from Supabase on demand.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ContentItem,
  ContentStageState,
  AlgorithmWeights,
  AlgorithmScore,
  ContentFormat,
  ScoreDimension,
  DEFAULT_WEIGHTS,
} from '../engine/content/types'
import { DEFAULT_WEIGHTS as DEFAULTS } from '../engine/content/types'

interface ContentState {
  /** Content items keyed by id */
  items: Record<string, ContentItem>

  /** Per-user learned algorithm weights */
  algorithmWeights: Record<ScoreDimension, number>

  /** Latest scores keyed by content id */
  scores: Record<string, AlgorithmScore>

  /** Active pipeline content id (null if no pipeline running) */
  activePipelineId: string | null
}

interface ContentActions {
  /** Create or update a content item */
  upsertItem: (item: ContentItem) => void

  /** Update stages for a content item */
  updateStages: (contentId: string, stages: ContentStageState[]) => void

  /** Set the active pipeline */
  setActivePipeline: (contentId: string | null) => void

  /** Store an algorithm score */
  setScore: (contentId: string, score: AlgorithmScore) => void

  /** Update learned algorithm weights */
  setAlgorithmWeights: (weights: Record<ScoreDimension, number>) => void

  /** Get all items sorted by most recent first */
  getItemsSorted: () => ContentItem[]

  /** Get a specific item */
  getItem: (contentId: string) => ContentItem | undefined

  /** Remove a content item */
  removeItem: (contentId: string) => void

  /** Clear all content data */
  clearAll: () => void
}

type ContentStore = ContentState & ContentActions

export const useContentStore = create<ContentStore>()(
  persist(
    (set, get) => ({
      items: {},
      algorithmWeights: { ...DEFAULTS },
      scores: {},
      activePipelineId: null,

      upsertItem: (item) => {
        set(state => ({
          items: { ...state.items, [item.id]: item },
        }))
      },

      updateStages: (contentId, stages) => {
        const state = get()
        const item = state.items[contentId]
        if (!item) return
        set({
          items: {
            ...state.items,
            [contentId]: {
              ...item,
              stages,
              currentStage: stages.find(s => s.status === 'active' || s.status === 'awaiting_approval')?.stage || item.currentStage,
              updatedAt: Date.now(),
            },
          },
        })
      },

      setActivePipeline: (contentId) => {
        set({ activePipelineId: contentId })
      },

      setScore: (contentId, score) => {
        set(state => ({
          scores: { ...state.scores, [contentId]: score },
        }))
      },

      setAlgorithmWeights: (weights) => {
        set({ algorithmWeights: weights })
      },

      getItemsSorted: () => {
        return Object.values(get().items).sort((a, b) => b.updatedAt - a.updatedAt)
      },

      getItem: (contentId) => {
        return get().items[contentId]
      },

      removeItem: (contentId) => {
        const state = get()
        const items = { ...state.items }
        const scores = { ...state.scores }
        delete items[contentId]
        delete scores[contentId]
        set({
          items,
          scores,
          activePipelineId: state.activePipelineId === contentId ? null : state.activePipelineId,
        })
      },

      clearAll: () => {
        set({
          items: {},
          scores: {},
          activePipelineId: null,
          algorithmWeights: { ...DEFAULTS },
        })
      },
    }),
    {
      name: 'kernel-content',
      partialize: (state) => {
        // Persist metadata only — strip finalContent to avoid localStorage bloat
        const stripped: Record<string, ContentItem> = {}
        const ids = Object.keys(state.items).slice(-20) // keep last 20 items
        for (const id of ids) {
          const item = state.items[id]
          stripped[id] = { ...item, finalContent: '' }
        }
        return {
          items: stripped,
          algorithmWeights: state.algorithmWeights,
          scores: state.scores,
          activePipelineId: state.activePipelineId,
        }
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<ContentState> | undefined
        if (!p) return current as ContentStore
        // Merge: prefer in-memory items that have content
        const merged = { ...(p.items || {}) }
        for (const [id, item] of Object.entries((current as ContentStore).items || {})) {
          if (item.finalContent) merged[id] = item
        }
        return {
          ...(current as ContentStore),
          items: merged,
          algorithmWeights: p.algorithmWeights || (current as ContentStore).algorithmWeights,
          scores: p.scores || (current as ContentStore).scores,
          activePipelineId: p.activePipelineId ?? null,
        }
      },
    },
  ),
)
