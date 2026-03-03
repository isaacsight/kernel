// ─── Platform Store — Workflow State Persistence ────────────────
//
// Tracks platform engine workflows. Persists metadata to localStorage
// (same pattern as contentStore). Heavy phase outputs live in memory.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  PlatformWorkflow,
  PlatformPhaseState,
  PlatformEngineState,
} from '../engine/platform/types'

interface PlatformState {
  workflows: Record<string, PlatformWorkflow>
  activeWorkflowId: string | null
}

interface PlatformActions {
  upsertWorkflow: (workflow: PlatformWorkflow) => void
  updatePhases: (workflowId: string, phases: PlatformPhaseState[]) => void
  updateState: (workflowId: string, state: PlatformEngineState) => void
  setActiveWorkflow: (workflowId: string | null) => void
  removeWorkflow: (workflowId: string) => void
  getWorkflow: (workflowId: string) => PlatformWorkflow | undefined
  getWorkflowsSorted: () => PlatformWorkflow[]
  clearAll: () => void
}

type PlatformStore = PlatformState & PlatformActions

export const usePlatformStore = create<PlatformStore>()(
  persist(
    (set, get) => ({
      workflows: {},
      activeWorkflowId: null,

      upsertWorkflow: (workflow) => {
        set(state => ({
          workflows: { ...state.workflows, [workflow.id]: workflow },
        }))
      },

      updatePhases: (workflowId, phases) => {
        const state = get()
        const wf = state.workflows[workflowId]
        if (!wf) return
        set({
          workflows: {
            ...state.workflows,
            [workflowId]: { ...wf, phases, updatedAt: Date.now() },
          },
        })
      },

      updateState: (workflowId, newState) => {
        const state = get()
        const wf = state.workflows[workflowId]
        if (!wf) return
        set({
          workflows: {
            ...state.workflows,
            [workflowId]: { ...wf, state: newState, updatedAt: Date.now() },
          },
        })
      },

      setActiveWorkflow: (workflowId) => {
        set({ activeWorkflowId: workflowId })
      },

      removeWorkflow: (workflowId) => {
        const state = get()
        const workflows = { ...state.workflows }
        delete workflows[workflowId]
        set({
          workflows,
          activeWorkflowId: state.activeWorkflowId === workflowId ? null : state.activeWorkflowId,
        })
      },

      getWorkflow: (workflowId) => {
        return get().workflows[workflowId]
      },

      getWorkflowsSorted: () => {
        return Object.values(get().workflows).sort((a, b) => b.updatedAt - a.updatedAt)
      },

      clearAll: () => {
        set({ workflows: {}, activeWorkflowId: null })
      },
    }),
    {
      name: 'kernel-platform',
      partialize: (state) => {
        // Strip heavy outputs, keep metadata + phase statuses. Cap at 10 workflows.
        const stripped: Record<string, PlatformWorkflow> = {}
        const ids = Object.keys(state.workflows)
          .sort((a, b) => (state.workflows[b]?.updatedAt || 0) - (state.workflows[a]?.updatedAt || 0))
          .slice(0, 10)
        for (const id of ids) {
          const wf = state.workflows[id]
          stripped[id] = {
            ...wf,
            phases: wf.phases.map(p => ({ ...p, output: undefined })),
          }
        }
        return {
          workflows: stripped,
          activeWorkflowId: state.activeWorkflowId,
        }
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<PlatformState> | undefined
        if (!p) return current as PlatformStore
        const merged = { ...(p.workflows || {}) }
        // Prefer in-memory workflows that have phase outputs
        for (const [id, wf] of Object.entries((current as PlatformStore).workflows || {})) {
          if (wf.phases.some(ph => ph.output)) merged[id] = wf
        }
        return {
          ...(current as PlatformStore),
          workflows: merged,
          activeWorkflowId: p.activeWorkflowId ?? null,
        }
      },
    },
  ),
)
