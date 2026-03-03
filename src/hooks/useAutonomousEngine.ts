// ─── useAutonomousEngine — React bridge for Autonomous Engine ────

import { useCallback } from 'react'
import {
  createBackgroundAgent,
  listBackgroundAgents,
  toggleAgent,
  evaluateTriggers,
  executeAgent,
  recordOutcome,
  getRoutingWeights,
  optimizeRouting,
} from '../engine/AutonomousEngine'
import type { BackgroundTrigger, AgentOutcome } from '../engine/autonomous/types'
import { useAutonomousStore } from '../stores/autonomousStore'

interface UseAutonomousEngineParams {
  userId: string
  isPro: boolean
}

export function useAutonomousEngine({ userId, isPro }: UseAutonomousEngineParams) {
  const store = useAutonomousStore()

  const create = useCallback(async (config: {
    name: string
    description: string
    trigger: BackgroundTrigger
    agent_config: { persona: string; tools: string[] }
  }) => {
    if (!isPro) throw new Error('Autonomous Engine requires Pro subscription')
    const agent = await createBackgroundAgent(userId, config)
    store.addAgent(agent)
    return agent
  }, [userId, isPro, store])

  const refresh = useCallback(async () => {
    const agents = await listBackgroundAgents(userId)
    store.setAgents(agents)
  }, [userId, store])

  const toggle = useCallback(async (agentId: string, enabled: boolean) => {
    await toggleAgent(agentId, enabled)
    store.updateAgent(agentId, { enabled })
  }, [store])

  const runTriggered = useCallback(async () => {
    const triggered = evaluateTriggers(store.backgroundAgents)
    const results = []
    for (const agent of triggered) {
      store.addRun({
        id: `pending_${agent.id}`,
        agent_id: agent.id,
        status: 'running',
        output: '',
        started_at: new Date().toISOString(),
        completed_at: null,
        duration_ms: 0,
      })
      const run = await executeAgent(agent)
      store.updateRun(`pending_${agent.id}`, { ...run })
      store.updateAgent(agent.id, {
        last_run_at: run.completed_at || run.started_at,
        run_count: agent.run_count + 1,
      })
      results.push(run)
    }
    return results
  }, [store])

  const runAgent = useCallback(async (agentId: string) => {
    const agent = store.backgroundAgents.find(a => a.id === agentId)
    if (!agent) throw new Error(`Agent not found: ${agentId}`)

    store.addRun({
      id: `pending_${agent.id}`,
      agent_id: agent.id,
      status: 'running',
      output: '',
      started_at: new Date().toISOString(),
      completed_at: null,
      duration_ms: 0,
    })

    const run = await executeAgent(agent)
    store.updateRun(`pending_${agent.id}`, { ...run })
    store.updateAgent(agent.id, {
      last_run_at: run.completed_at || run.started_at,
      run_count: agent.run_count + 1,
    })
    return run
  }, [store])

  const record = useCallback(async (outcome: Omit<AgentOutcome, 'id' | 'recorded_at'>) => {
    await recordOutcome(outcome)
  }, [])

  const loadWeights = useCallback(async () => {
    const weights = await getRoutingWeights(userId)
    store.setRoutingWeights(weights)
  }, [userId, store])

  const optimize = useCallback(async () => {
    await optimizeRouting(userId)
    const weights = await getRoutingWeights(userId)
    store.setRoutingWeights(weights)
    store.setLastOptimizedAt(new Date().toISOString())
  }, [userId, store])

  return {
    agents: store.backgroundAgents,
    runs: store.runs,
    routingWeights: store.routingWeights,
    lastOptimizedAt: store.lastOptimizedAt,
    getAgentRuns: store.getAgentRuns,
    createAgent: create,
    refreshAgents: refresh,
    toggleAgent: toggle,
    runTriggeredAgents: runTriggered,
    runAgent,
    recordOutcome: record,
    loadRoutingWeights: loadWeights,
    optimizeRouting: optimize,
  }
}
