// ─── usePlatformEngine Hook ─────────────────────────────────────
//
// React hook bridge for PlatformEngine.
// Manages workflow lifecycle, store persistence, and UI state.

import { useRef, useCallback } from 'react'
import { PlatformEngine } from '../engine/PlatformEngine'
import { usePlatformStore } from '../stores/platformStore'
import type {
  PlatformPhase,
  PlatformPhaseState,
  PlatformWorkflowConfig,
  PlatformEngineCallbacks,
  PlatformWorkflow,
  PlatformEngineState,
} from '../engine/platform/types'
import type { ContentStageState } from '../engine/content/types'

interface UsePlatformEngineParams {
  userId: string
  onChunk?: (text: string) => void
  onPhaseUpdate?: (phases: PlatformPhaseState[]) => void
  onApprovalNeeded?: (phase: PlatformPhase, output: unknown) => void
  onContentStageUpdate?: (stages: ContentStageState[]) => void
  onContentApprovalNeeded?: (stage: string, output: string) => void
  onComplete?: (workflow: PlatformWorkflow) => void
  onError?: (error: string) => void
}

export interface UsePlatformEngineReturn {
  startWorkflow: (config: PlatformWorkflowConfig) => Promise<PlatformWorkflow | null>
  approvePhase: (phase: PlatformPhase) => Promise<PlatformWorkflow | null>
  editPhase: (phase: PlatformPhase, feedback: string) => Promise<PlatformWorkflow | null>
  skipPhase: (phase: PlatformPhase) => Promise<PlatformWorkflow | null>
  cancelWorkflow: () => void
  approveContentStage: () => Promise<void>
  editContentStage: (feedback: string) => Promise<void>
  updateAdaptation: (platform: string, body: string) => void
  isActive: boolean
  phases: PlatformPhaseState[]
  contentStages: ContentStageState[]
  currentPhase: PlatformPhase | null
  engineState: PlatformEngineState
}

export function usePlatformEngine({
  userId,
  onChunk,
  onPhaseUpdate,
  onApprovalNeeded,
  onContentStageUpdate,
  onContentApprovalNeeded,
  onComplete,
  onError,
}: UsePlatformEngineParams): UsePlatformEngineReturn {
  const engineRef = useRef<PlatformEngine | null>(null)
  const contentStagesRef = useRef<ContentStageState[]>([])
  const store = usePlatformStore()

  const createCallbacks = useCallback((): PlatformEngineCallbacks => ({
    onProgress: (phase, status, details) => {
      console.log(`[platform-engine] ${phase}: ${status}`, details)
    },
    onChunk,
    onPhaseUpdate: (phases: PlatformPhaseState[]) => {
      if (engineRef.current) {
        store.updatePhases(engineRef.current.id, phases)
      }
      onPhaseUpdate?.(phases)
    },
    onApprovalNeeded,
    onContentStageUpdate: (stages: ContentStageState[]) => {
      contentStagesRef.current = stages
      onContentStageUpdate?.(stages)
    },
    onContentApprovalNeeded,
  }), [onChunk, onPhaseUpdate, onApprovalNeeded, onContentStageUpdate, onContentApprovalNeeded, store])

  const startWorkflow = useCallback(async (
    config: PlatformWorkflowConfig,
  ): Promise<PlatformWorkflow | null> => {
    try {
      const engine = new PlatformEngine(config, userId, createCallbacks())
      engineRef.current = engine
      contentStagesRef.current = []

      const initialWorkflow: PlatformWorkflow = {
        id: engine.id,
        userId,
        config,
        phases: engine.getPhases(),
        state: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      store.upsertWorkflow(initialWorkflow)
      store.setActiveWorkflow(engine.id)

      const result = await engine.start()
      result.userId = userId
      store.upsertWorkflow(result)

      if (engine.getState() === 'completed') {
        store.setActiveWorkflow(null)
        onComplete?.(result)
      }

      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Workflow failed'
      onError?.(msg)
      store.setActiveWorkflow(null)
      return null
    }
  }, [userId, createCallbacks, store, onComplete, onError])

  const approvePhase = useCallback(async (phase: PlatformPhase): Promise<PlatformWorkflow | null> => {
    if (!engineRef.current) return null
    try {
      const result = await engineRef.current.resumeFrom(phase)
      result.userId = userId
      store.upsertWorkflow(result)

      if (engineRef.current.getState() === 'completed') {
        store.setActiveWorkflow(null)
        onComplete?.(result)
      }

      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Resume failed'
      onError?.(msg)
      return null
    }
  }, [userId, store, onComplete, onError])

  const editPhase = useCallback(async (
    phase: PlatformPhase,
    feedback: string,
  ): Promise<PlatformWorkflow | null> => {
    if (!engineRef.current) return null
    try {
      const result = await engineRef.current.resumeFrom(phase, feedback)
      result.userId = userId
      store.upsertWorkflow(result)

      if (engineRef.current.getState() === 'completed') {
        store.setActiveWorkflow(null)
        onComplete?.(result)
      }

      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Edit failed'
      onError?.(msg)
      return null
    }
  }, [userId, store, onComplete, onError])

  const skipPhase = useCallback(async (phase: PlatformPhase): Promise<PlatformWorkflow | null> => {
    return approvePhase(phase)
  }, [approvePhase])

  const cancelWorkflow = useCallback(() => {
    engineRef.current?.cancel()
    engineRef.current = null
    contentStagesRef.current = []
    store.setActiveWorkflow(null)
  }, [store])

  const approveContentStage = useCallback(async () => {
    await engineRef.current?.approveContentStage()
  }, [])

  const editContentStage = useCallback(async (feedback: string) => {
    await engineRef.current?.editContentStage(feedback)
  }, [])

  const updateAdaptation = useCallback((platform: string, body: string) => {
    engineRef.current?.updateAdaptation(platform, body)
  }, [])

  const activeWorkflow = store.activeWorkflowId ? store.getWorkflow(store.activeWorkflowId) : undefined
  const phases = activeWorkflow?.phases || []
  const currentPhase = phases.find(p => p.status === 'active' || p.status === 'awaiting_approval')?.phase || null

  return {
    startWorkflow,
    approvePhase,
    editPhase,
    skipPhase,
    cancelWorkflow,
    approveContentStage,
    editContentStage,
    updateAdaptation,
    isActive: !!store.activeWorkflowId && engineRef.current?.getState() !== 'completed',
    phases,
    contentStages: contentStagesRef.current,
    currentPhase,
    engineState: engineRef.current?.getState() || 'idle',
  }
}
