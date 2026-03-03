// ─── Autonomous Engine Store — Background Agent State ─────────

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  BackgroundAgent,
  BackgroundAgentRun,
  RoutingWeights,
} from '../engine/autonomous/types'

interface AutonomousState {
  backgroundAgents: BackgroundAgent[]
  runs: BackgroundAgentRun[]
  routingWeights: RoutingWeights[]
  lastOptimizedAt: string | null
}

interface AutonomousActions {
  setAgents: (agents: BackgroundAgent[]) => void
  addAgent: (agent: BackgroundAgent) => void
  updateAgent: (id: string, updates: Partial<BackgroundAgent>) => void
  removeAgent: (id: string) => void
  addRun: (run: BackgroundAgentRun) => void
  updateRun: (id: string, updates: Partial<BackgroundAgentRun>) => void
  setRoutingWeights: (weights: RoutingWeights[]) => void
  setLastOptimizedAt: (ts: string) => void
  getAgentRuns: (agentId: string) => BackgroundAgentRun[]
  clearAll: () => void
}

type AutonomousStore = AutonomousState & AutonomousActions

export const useAutonomousStore = create<AutonomousStore>()(
  persist(
    (set, get) => ({
      backgroundAgents: [],
      runs: [],
      routingWeights: [],
      lastOptimizedAt: null,

      setAgents: (agents) => set({ backgroundAgents: agents }),

      addAgent: (agent) => {
        set(state => ({
          backgroundAgents: [agent, ...state.backgroundAgents],
        }))
      },

      updateAgent: (id, updates) => {
        set(state => ({
          backgroundAgents: state.backgroundAgents.map(a =>
            a.id === id ? { ...a, ...updates } : a
          ),
        }))
      },

      removeAgent: (id) => {
        set(state => ({
          backgroundAgents: state.backgroundAgents.filter(a => a.id !== id),
          runs: state.runs.filter(r => r.agent_id !== id),
        }))
      },

      addRun: (run) => {
        set(state => ({
          runs: [run, ...state.runs].slice(0, 100), // Keep last 100 runs
        }))
      },

      updateRun: (id, updates) => {
        set(state => ({
          runs: state.runs.map(r =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }))
      },

      setRoutingWeights: (weights) => set({ routingWeights: weights }),

      setLastOptimizedAt: (ts) => set({ lastOptimizedAt: ts }),

      getAgentRuns: (agentId) => get().runs.filter(r => r.agent_id === agentId),

      clearAll: () => set({
        backgroundAgents: [],
        runs: [],
        routingWeights: [],
        lastOptimizedAt: null,
      }),
    }),
    {
      name: 'kernel-autonomous',
      partialize: (state) => ({
        backgroundAgents: state.backgroundAgents.slice(0, 50),
        runs: state.runs.slice(0, 20),
        routingWeights: state.routingWeights,
        lastOptimizedAt: state.lastOptimizedAt,
      }),
    },
  ),
)
