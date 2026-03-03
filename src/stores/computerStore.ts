// ─── Computer Engine Store — Sandbox State ───────────────────

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Sandbox, SandboxResult } from '../engine/computer/types'

interface ComputerState {
  sandboxes: Record<string, Sandbox>
  activeSandboxId: string | null
  recentOutputs: Record<string, string[]> // sandboxId → last 50 output lines
}

interface ComputerActions {
  upsertSandbox: (sandbox: Sandbox) => void
  updateSandboxStatus: (id: string, status: Sandbox['status']) => void
  setActiveSandbox: (id: string | null) => void
  removeSandbox: (id: string) => void
  appendOutput: (sandboxId: string, output: string) => void
  clearOutputs: (sandboxId: string) => void
  getSandboxes: () => Sandbox[]
  clearAll: () => void
}

type ComputerStore = ComputerState & ComputerActions

export const useComputerStore = create<ComputerStore>()(
  persist(
    (set, get) => ({
      sandboxes: {},
      activeSandboxId: null,
      recentOutputs: {},

      upsertSandbox: (sandbox) => {
        set(state => ({
          sandboxes: { ...state.sandboxes, [sandbox.id]: sandbox },
        }))
      },

      updateSandboxStatus: (id, status) => {
        set(state => {
          const sb = state.sandboxes[id]
          if (!sb) return state
          return {
            sandboxes: {
              ...state.sandboxes,
              [id]: { ...sb, status, lastActivityAt: Date.now() },
            },
          }
        })
      },

      setActiveSandbox: (id) => set({ activeSandboxId: id }),

      removeSandbox: (id) => {
        set(state => {
          const sandboxes = { ...state.sandboxes }
          delete sandboxes[id]
          const outputs = { ...state.recentOutputs }
          delete outputs[id]
          return {
            sandboxes,
            recentOutputs: outputs,
            activeSandboxId: state.activeSandboxId === id ? null : state.activeSandboxId,
          }
        })
      },

      appendOutput: (sandboxId, output) => {
        set(state => {
          const lines = [...(state.recentOutputs[sandboxId] || []), output].slice(-50)
          return {
            recentOutputs: { ...state.recentOutputs, [sandboxId]: lines },
          }
        })
      },

      clearOutputs: (sandboxId) => {
        set(state => ({
          recentOutputs: { ...state.recentOutputs, [sandboxId]: [] },
        }))
      },

      getSandboxes: () => Object.values(get().sandboxes),

      clearAll: () => set({ sandboxes: {}, activeSandboxId: null, recentOutputs: {} }),
    }),
    {
      name: 'kernel-computer',
      partialize: (state) => ({
        // Only persist sandbox metadata, not outputs
        sandboxes: Object.fromEntries(
          Object.entries(state.sandboxes)
            .filter(([, sb]) => sb.status !== 'destroyed')
            .slice(0, 10)
            .map(([id, sb]) => [id, { ...sb, filesystem: [], processes: [] }])
        ),
        activeSandboxId: state.activeSandboxId,
      }),
    },
  ),
)
