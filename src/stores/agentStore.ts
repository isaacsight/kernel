// ─── Agent Store — Custom Agent State ─────────────────────────

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CustomAgent } from '../engine/agent/types'

interface AgentState {
  /** Agents created by the user */
  customAgents: CustomAgent[]
  /** Agents installed from the library */
  installedAgents: CustomAgent[]
  /** Currently active agent ID (null = default Kernel) */
  activeAgentId: string | null
}

interface AgentActions {
  setCustomAgents: (agents: CustomAgent[]) => void
  addCustomAgent: (agent: CustomAgent) => void
  updateCustomAgent: (id: string, updates: Partial<CustomAgent>) => void
  removeCustomAgent: (id: string) => void
  setInstalledAgents: (agents: CustomAgent[]) => void
  addInstalledAgent: (agent: CustomAgent) => void
  removeInstalledAgent: (id: string) => void
  setActiveAgent: (id: string | null) => void
  getAgent: (id: string) => CustomAgent | undefined
  clearAll: () => void
}

type AgentStore = AgentState & AgentActions

export const useAgentStore = create<AgentStore>()(
  persist(
    (set, get) => ({
      customAgents: [],
      installedAgents: [],
      activeAgentId: null,

      setCustomAgents: (agents) => set({ customAgents: agents }),

      addCustomAgent: (agent) => {
        set(state => ({
          customAgents: [agent, ...state.customAgents],
        }))
      },

      updateCustomAgent: (id, updates) => {
        set(state => ({
          customAgents: state.customAgents.map(a =>
            a.id === id ? { ...a, ...updates } : a,
          ),
        }))
      },

      removeCustomAgent: (id) => {
        set(state => ({
          customAgents: state.customAgents.filter(a => a.id !== id),
          activeAgentId: state.activeAgentId === id ? null : state.activeAgentId,
        }))
      },

      setInstalledAgents: (agents) => set({ installedAgents: agents }),

      addInstalledAgent: (agent) => {
        set(state => ({
          installedAgents: [agent, ...state.installedAgents],
        }))
      },

      removeInstalledAgent: (id) => {
        set(state => ({
          installedAgents: state.installedAgents.filter(a => a.id !== id),
          activeAgentId: state.activeAgentId === id ? null : state.activeAgentId,
        }))
      },

      setActiveAgent: (id) => set({ activeAgentId: id }),

      getAgent: (id) => {
        const state = get()
        return (
          state.customAgents.find(a => a.id === id) ||
          state.installedAgents.find(a => a.id === id)
        )
      },

      clearAll: () => set({
        customAgents: [],
        installedAgents: [],
        activeAgentId: null,
      }),
    }),
    {
      name: 'kernel-agents',
      partialize: (state) => ({
        customAgents: state.customAgents.slice(0, 50),
        installedAgents: state.installedAgents.slice(0, 50),
        activeAgentId: state.activeAgentId,
      }),
    },
  ),
)
