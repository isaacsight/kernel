// ─── useAgentEngine — React bridge for the Agent Engine ──────
//
// Provides hooks for creating, managing, and chatting with
// custom agents. Bridges AgentEngine + agentStore.

import { useState, useCallback, useRef } from 'react'
import { useAgentStore } from '../stores/agentStore'
import {
  callAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  listMyAgents,
  listPublicAgents,
  listInstalledAgents,
  installAgent,
  uninstallAgent,
} from '../engine/AgentEngine'
import type { CustomAgent, AgentMessage } from '../engine/agent/types'

export function useAgentEngine(userId: string | null) {
  const store = useAgentStore()
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ─── Load agents ────────────────────────────────────────

  const loadMyAgents = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const agents = await listMyAgents(userId)
      store.setCustomAgents(agents)
    } catch (e) {
      console.error('Failed to load agents:', e)
    } finally {
      setLoading(false)
    }
  }, [userId])

  const loadInstalledAgents = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const agents = await listInstalledAgents(userId)
      store.setInstalledAgents(agents)
    } catch (e) {
      console.error('Failed to load installed agents:', e)
    } finally {
      setLoading(false)
    }
  }, [userId])

  const loadLibrary = useCallback(async () => {
    setLoading(true)
    try {
      return await listPublicAgents()
    } catch (e) {
      console.error('Failed to load library:', e)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // ─── CRUD ───────────────────────────────────────────────

  const create = useCallback(async (
    data: Parameters<typeof createAgent>[1],
  ) => {
    if (!userId) return null
    setError(null)
    setLoading(true)
    try {
      const agent = await createAgent(userId, data)
      if (agent) store.addCustomAgent(agent)
      return agent
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create agent'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [userId])

  const update = useCallback(async (
    agentId: string,
    data: Parameters<typeof updateAgent>[1],
  ) => {
    setError(null)
    try {
      const agent = await updateAgent(agentId, data)
      if (agent) store.updateCustomAgent(agentId, agent)
      return agent
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update agent'
      setError(msg)
      return null
    }
  }, [])

  const remove = useCallback(async (agentId: string) => {
    setError(null)
    try {
      const ok = await deleteAgent(agentId)
      if (ok) store.removeCustomAgent(agentId)
      return ok
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete agent'
      setError(msg)
      return false
    }
  }, [])

  // ─── Install / Uninstall ────────────────────────────────

  const install = useCallback(async (agent: CustomAgent) => {
    if (!userId) return
    try {
      await installAgent(agent.id, userId)
      store.addInstalledAgent(agent)
    } catch (e) {
      console.error('Failed to install agent:', e)
    }
  }, [userId])

  const uninstall = useCallback(async (agentId: string) => {
    if (!userId) return
    try {
      await uninstallAgent(agentId, userId)
      store.removeInstalledAgent(agentId)
    } catch (e) {
      console.error('Failed to uninstall agent:', e)
    }
  }, [userId])

  // ─── Chat ──────────────────────────────────────────────

  const chat = useCallback(async (
    agent: CustomAgent,
    message: string,
    history: AgentMessage[],
  ): Promise<string | null> => {
    setStreaming(true)
    setStreamText('')
    setError(null)
    abortRef.current = new AbortController()

    try {
      const response = await callAgent(
        agent,
        message,
        history,
        (text) => setStreamText(text),
        abortRef.current.signal,
      )
      return response
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return null
      const msg = e instanceof Error ? e.message : 'Agent call failed'
      setError(msg)
      return null
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return {
    // State
    customAgents: store.customAgents,
    installedAgents: store.installedAgents,
    activeAgentId: store.activeAgentId,
    loading,
    streaming,
    streamText,
    error,

    // Actions
    loadMyAgents,
    loadInstalledAgents,
    loadLibrary,
    create,
    update,
    remove,
    install,
    uninstall,
    chat,
    stopStreaming,
    setActiveAgent: store.setActiveAgent,
    getAgent: store.getAgent,
  }
}
