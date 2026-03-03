// ─── useContentEngine Hook ──────────────────────────────────────
//
// React hook bridge for ContentEngine and AlgorithmEngine.
// Manages pipeline lifecycle, store persistence, and UI state.

import { useRef, useCallback } from 'react'
import { ContentEngine } from '../engine/ContentEngine'
import { AlgorithmEngine } from '../engine/AlgorithmEngine'
import { useContentStore } from '../stores/contentStore'
import type {
  ContentFormat,
  ContentStage,
  ContentStageState,
  ContentPipelineCallbacks,
  ContentPipelineEvent,
  ContentItem,
  AlgorithmScore,
} from '../engine/content/types'

interface UseContentEngineParams {
  userId: string
  onChunk?: (text: string) => void
  onStageUpdate?: (stages: ContentStageState[]) => void
  onApprovalNeeded?: (stage: ContentStage, output: string) => void
  onComplete?: (item: ContentItem) => void
  onError?: (error: string) => void
}

export interface UseContentEngineReturn {
  /** Start a new content pipeline */
  startPipeline: (brief: string, format: ContentFormat) => Promise<ContentItem | null>
  /** Resume pipeline after user approves a stage */
  approveStage: (stage: ContentStage) => Promise<ContentItem | null>
  /** Resume with user feedback (edit) */
  editStage: (stage: ContentStage, feedback: string) => Promise<ContentItem | null>
  /** Skip a stage */
  skipStage: (stage: ContentStage) => Promise<ContentItem | null>
  /** Cancel the active pipeline */
  cancelPipeline: () => void
  /** Score content with the algorithm engine */
  scoreContent: (item: ContentItem, userContext: string) => Promise<AlgorithmScore | null>
  /** Publish content to a public page */
  publishContent: (contentId: string, authorName?: string) => Promise<string | null>
  /** Whether a pipeline is currently active */
  isActive: boolean
  /** Current pipeline stages */
  stages: ContentStageState[]
}

export function useContentEngine({
  userId,
  onChunk,
  onStageUpdate,
  onApprovalNeeded,
  onComplete,
  onError,
}: UseContentEngineParams): UseContentEngineReturn {
  const engineRef = useRef<ContentEngine | null>(null)
  const store = useContentStore()

  const createCallbacks = useCallback((): ContentPipelineCallbacks => ({
    onProgress: (event: ContentPipelineEvent) => {
      console.log(`[content-engine] ${event.stage}: ${event.status}`, event.details)
    },
    onChunk,
    onStageUpdate: (stages: ContentStageState[]) => {
      // Persist to store
      if (engineRef.current) {
        store.updateStages(engineRef.current.id, stages)
      }
      onStageUpdate?.(stages)
    },
    onApprovalNeeded,
  }), [onChunk, onStageUpdate, onApprovalNeeded, store])

  const startPipeline = useCallback(async (
    brief: string,
    format: ContentFormat,
  ): Promise<ContentItem | null> => {
    try {
      const engine = new ContentEngine(brief, format, createCallbacks())
      engineRef.current = engine

      // Create initial item in store
      const initialItem: ContentItem = {
        id: engine.id,
        userId,
        brief,
        format,
        tags: [],
        currentStage: 'ideation',
        stages: engine.getStages(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      store.upsertItem(initialItem)
      store.setActivePipeline(engine.id)

      const result = await engine.start()
      result.userId = userId
      store.upsertItem(result)

      if (engine.getState() === 'completed') {
        store.setActivePipeline(null)
        onComplete?.(result)
      }

      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pipeline failed'
      onError?.(msg)
      store.setActivePipeline(null)
      return null
    }
  }, [userId, createCallbacks, store, onComplete, onError])

  const approveStage = useCallback(async (stage: ContentStage): Promise<ContentItem | null> => {
    if (!engineRef.current) return null
    try {
      const result = await engineRef.current.resumeFrom(stage)
      result.userId = userId
      store.upsertItem(result)

      if (engineRef.current.getState() === 'completed') {
        store.setActivePipeline(null)
        onComplete?.(result)
      }

      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Resume failed'
      onError?.(msg)
      return null
    }
  }, [userId, store, onComplete, onError])

  const editStage = useCallback(async (
    stage: ContentStage,
    feedback: string,
  ): Promise<ContentItem | null> => {
    if (!engineRef.current) return null
    try {
      const result = await engineRef.current.resumeFrom(stage, feedback)
      result.userId = userId
      store.upsertItem(result)

      if (engineRef.current.getState() === 'completed') {
        store.setActivePipeline(null)
        onComplete?.(result)
      }

      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Edit failed'
      onError?.(msg)
      return null
    }
  }, [userId, store, onComplete, onError])

  const skipStage = useCallback(async (stage: ContentStage): Promise<ContentItem | null> => {
    if (!engineRef.current) return null
    // Approve without feedback — moves to next stage
    return approveStage(stage)
  }, [approveStage])

  const cancelPipeline = useCallback(() => {
    engineRef.current?.cancel()
    engineRef.current = null
    store.setActivePipeline(null)
  }, [store])

  const scoreContent = useCallback(async (
    item: ContentItem,
    userContext: string,
  ): Promise<AlgorithmScore | null> => {
    try {
      const weights = store.algorithmWeights
      const algorithm = new AlgorithmEngine({ userId, weights, updatedAt: Date.now(), learningRate: 0.1 })
      const signals = await algorithm.collectSignals(item, userContext)
      const score = await algorithm.score(item, signals, userContext)
      store.setScore(item.id, score)
      return score
    } catch (err) {
      console.error('[algorithm-engine] Score failed:', err)
      return null
    }
  }, [userId, store])

  const publishContent = useCallback(async (
    contentId: string,
    authorName?: string,
  ): Promise<string | null> => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
      const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || ''

      // Get access token from Supabase auth
      const { getAccessToken } = await import('../engine/SupabaseClient')
      const token = await getAccessToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(`${supabaseUrl}/functions/v1/content-engine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          action: 'publish_item',
          data: { id: contentId, author_name: authorName },
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Publish failed' }))
        throw new Error(body.error || 'Publish failed')
      }

      const { slug } = await res.json()

      // Update local store
      const item = store.getItem(contentId)
      if (item) {
        store.upsertItem({
          ...item,
          isPublished: true,
          publishedAt: Date.now(),
          slug,
        })
      }

      return slug
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Publish failed'
      onError?.(msg)
      return null
    }
  }, [store, onError])

  const activeItem = store.activePipelineId ? store.getItem(store.activePipelineId) : undefined

  return {
    startPipeline,
    approveStage,
    editStage,
    skipStage,
    cancelPipeline,
    scoreContent,
    publishContent,
    isActive: !!store.activePipelineId && engineRef.current?.getState() !== 'completed',
    stages: activeItem?.stages || [],
  }
}
