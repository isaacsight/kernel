// ─── Master Agent Store — Plan State Persistence ─────────────
//
// Tracks Master Agent plans and execution state. Persists metadata
// to localStorage (same pattern as platformStore).

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EnginePlan, MasterAgentState } from '../engine/master/types'

interface MasterState {
  /** Current active plan */
  currentPlan: EnginePlan | null
  /** Recent plan history (last 10) */
  planHistory: EnginePlan[]
  /** Currently executing step ID */
  activeStepId: string | null
  /** Current Master Agent state */
  agentState: MasterAgentState
  /** Active engine being executed */
  activeEngineId: string | null
}

interface MasterActions {
  setPlan: (plan: EnginePlan) => void
  updatePlan: (plan: EnginePlan) => void
  setActiveStep: (stepId: string | null) => void
  setAgentState: (state: MasterAgentState) => void
  setActiveEngine: (engineId: string | null) => void
  completePlan: () => void
  clearCurrent: () => void
}

type MasterStore = MasterState & MasterActions

export const useMasterStore = create<MasterStore>()(
  persist(
    (set, get) => ({
      currentPlan: null,
      planHistory: [],
      activeStepId: null,
      agentState: 'idle',
      activeEngineId: null,

      setPlan: (plan) => {
        set({ currentPlan: plan, agentState: plan.state })
      },

      updatePlan: (plan) => {
        set({ currentPlan: plan, agentState: plan.state })
      },

      setActiveStep: (stepId) => {
        set({ activeStepId: stepId })
      },

      setAgentState: (state) => {
        set({ agentState: state })
      },

      setActiveEngine: (engineId) => {
        set({ activeEngineId: engineId })
      },

      completePlan: () => {
        const { currentPlan, planHistory } = get()
        if (!currentPlan) return
        const history = [currentPlan, ...planHistory].slice(0, 10)
        set({
          currentPlan: null,
          planHistory: history,
          activeStepId: null,
          agentState: 'idle',
          activeEngineId: null,
        })
      },

      clearCurrent: () => {
        set({
          currentPlan: null,
          activeStepId: null,
          agentState: 'idle',
          activeEngineId: null,
        })
      },
    }),
    {
      name: 'kernel-master',
      partialize: (state) => ({
        // Only persist plan history, not active state
        planHistory: state.planHistory.map(p => ({
          ...p,
          // Strip step outputs to save space
          steps: p.steps.map(s => ({ ...s, output: undefined })),
        })).slice(0, 10),
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<MasterState> | undefined
        if (!p) return current as MasterStore
        return {
          ...(current as MasterStore),
          planHistory: p.planHistory || [],
        }
      },
    },
  ),
)
