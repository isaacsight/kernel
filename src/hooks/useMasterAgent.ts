// ─── useMasterAgent — React bridge for Master Agent ──────────
//
// Provides the Master Agent's orchestration capabilities to React
// components. Wires callbacks to streaming + store + UI state.

import { useCallback, useRef } from 'react'
import { processMasterAgent, needsOrchestration, type MasterAgentResult } from '../engine/MasterAgent'
import type { EnginePlan, MasterAgentCallbacks } from '../engine/master/types'
import type { ContentBlock } from '../engine/ClaudeClient'
import type { UserMemoryProfile } from '../engine/MemoryAgent'
import { useMasterStore } from '../stores/masterStore'

interface UseMasterAgentParams {
  userId: string
  isPro: boolean
  memory?: UserMemoryProfile
  systemBlocks?: string
  onChunk: (text: string, thinking?: string) => void
}

export function useMasterAgent(params: UseMasterAgentParams) {
  const { userId, isPro, memory, systemBlocks, onChunk } = params

  const store = useMasterStore()
  const abortRef = useRef<AbortController | null>(null)

  const processMessage = useCallback(async (
    message: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string | ContentBlock[] }[],
  ): Promise<MasterAgentResult> => {
    const callbacks: MasterAgentCallbacks = {
      onPlan: (plan: EnginePlan) => {
        store.setPlan(plan)
      },
      onStepStart: (stepId, engineId, action) => {
        store.setActiveStep(stepId)
        store.setActiveEngine(engineId)
        console.log(`[MasterAgent] Step started: ${engineId}.${action}`)
      },
      onStepComplete: (stepId) => {
        store.setActiveStep(null)
        console.log(`[MasterAgent] Step completed: ${stepId}`)
      },
      onChunk: (text) => {
        onChunk(text)
      },
      onEngineSwitch: (_from, to) => {
        store.setActiveEngine(to === 'direct' ? null : to)
      },
      onApprovalNeeded: (stepId, reason) => {
        store.setAgentState('awaiting_user')
        console.log(`[MasterAgent] Approval needed for ${stepId}: ${reason}`)
      },
      onStepFailed: (stepId, error) => {
        console.warn(`[MasterAgent] Step failed: ${stepId}: ${error}`)
      },
    }

    try {
      store.setAgentState('planning')
      const result = await processMasterAgent(message, conversationHistory, {
        userId,
        isPro,
        callbacks,
        memory,
        systemBlocks,
      })

      if (result.plan) {
        store.completePlan()
      } else {
        store.clearCurrent()
      }

      return result
    } catch (err) {
      store.setAgentState('failed')
      throw err
    }
  }, [userId, isPro, memory, systemBlocks, onChunk, store])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    store.clearCurrent()
  }, [store])

  return {
    processMessage,
    cancel,
    currentPlan: store.currentPlan,
    planHistory: store.planHistory,
    isPlanning: store.agentState === 'planning',
    isExecuting: store.agentState === 'executing',
    activeEngine: store.activeEngineId,
    agentState: store.agentState,
    needsOrchestration,
  }
}
