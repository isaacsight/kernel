// ─── Agent Engine — Custom Agent Runtime ─────────────────────
//
// Core engine for creating, calling, and managing custom agents.
// Agents have a persona (system prompt), enabled tools (engine IDs),
// knowledge base items, and conversation starters.

import { claudeStreamChat } from './ClaudeClient'
import { supabase } from './SupabaseClient'
import type { CustomAgent, AgentMessage, AgentConversation } from './agent/types'

// ─── Call Agent ──────────────────────────────────────────────

/**
 * Send a message to a custom agent and stream the response.
 * Uses the agent's persona as the system prompt.
 */
export async function callAgent(
  agent: CustomAgent,
  message: string,
  history: AgentMessage[],
  onChunk?: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  // Build messages array from history
  const messages = history.map(m => ({
    role: m.role === 'agent' ? 'assistant' : 'user',
    content: m.content,
  }))

  // Append the new user message
  messages.push({ role: 'user', content: message })

  const result = await claudeStreamChat(
    messages,
    onChunk ?? (() => {}),
    {
      system: agent.persona,
      model: 'sonnet',
      max_tokens: 4096,
      signal,
    },
  )

  return result.text
}

// ─── Agent CRUD ─────────────────────────────────────────────

/** Create a new custom agent */
export async function createAgent(
  userId: string,
  data: {
    name: string
    persona: string
    tools?: string[]
    knowledge_ids?: string[]
    starters?: string[]
    icon?: string
    color?: string
    is_public?: boolean
  },
): Promise<CustomAgent | null> {
  const { data: agent, error } = await supabase
    .from('custom_agents')
    .insert({
      user_id: userId,
      name: data.name,
      persona: data.persona,
      tools: data.tools ?? [],
      knowledge_ids: data.knowledge_ids ?? [],
      starters: data.starters ?? [],
      icon: data.icon ?? '🤖',
      color: data.color ?? '#6B5B95',
      is_public: data.is_public ?? false,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating agent:', error)
    return null
  }
  return agent as CustomAgent
}

/** Update an existing custom agent */
export async function updateAgent(
  agentId: string,
  data: Partial<Pick<CustomAgent, 'name' | 'persona' | 'tools' | 'knowledge_ids' | 'starters' | 'icon' | 'color' | 'is_public'>>,
): Promise<CustomAgent | null> {
  const { data: agent, error } = await supabase
    .from('custom_agents')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', agentId)
    .select()
    .single()

  if (error) {
    console.error('Error updating agent:', error)
    return null
  }
  return agent as CustomAgent
}

/** Delete a custom agent */
export async function deleteAgent(agentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('custom_agents')
    .delete()
    .eq('id', agentId)

  if (error) {
    console.error('Error deleting agent:', error)
    return false
  }
  return true
}

/** List agents owned by a user */
export async function listMyAgents(userId: string): Promise<CustomAgent[]> {
  const { data, error } = await supabase
    .from('custom_agents')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error listing agents:', error)
    return []
  }
  return (data ?? []) as CustomAgent[]
}

// ─── Public Agent Library ───────────────────────────────────

/** List public agents (community library) */
export async function listPublicAgents(): Promise<CustomAgent[]> {
  const { data, error } = await supabase
    .from('custom_agents')
    .select('*')
    .eq('is_public', true)
    .order('install_count', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error listing public agents:', error)
    return []
  }
  return (data ?? []) as CustomAgent[]
}

/** Install a public agent (add to user's collection) */
export async function installAgent(agentId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('agent_installs')
    .insert({ agent_id: agentId, user_id: userId })

  if (error) {
    console.error('Error installing agent:', error)
    return
  }

  // Increment install count
  const { data: agent } = await supabase
    .from('custom_agents')
    .select('install_count')
    .eq('id', agentId)
    .single()

  if (agent) {
    await supabase
      .from('custom_agents')
      .update({ install_count: (agent.install_count ?? 0) + 1 })
      .eq('id', agentId)
  }
}

/** Uninstall a previously installed agent */
export async function uninstallAgent(agentId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('agent_installs')
    .delete()
    .eq('agent_id', agentId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error uninstalling agent:', error)
    return
  }

  // Decrement install count
  const { data: agent } = await supabase
    .from('custom_agents')
    .select('install_count')
    .eq('id', agentId)
    .single()

  if (agent) {
    await supabase
      .from('custom_agents')
      .update({ install_count: Math.max(0, (agent.install_count ?? 1) - 1) })
      .eq('id', agentId)
  }
}

/** List agents installed by a user */
export async function listInstalledAgents(userId: string): Promise<CustomAgent[]> {
  const { data, error } = await supabase
    .from('agent_installs')
    .select('agent_id, custom_agents(*)')
    .eq('user_id', userId)
    .order('installed_at', { ascending: false })

  if (error) {
    console.error('Error listing installed agents:', error)
    return []
  }

  return (data ?? [])
    .map((row: Record<string, unknown>) => row.custom_agents as CustomAgent)
    .filter(Boolean)
}

// ─── Agent Conversations ────────────────────────────────────

/** Save or update an agent conversation */
export async function saveAgentConversation(
  conv: Omit<AgentConversation, 'created_at'>,
): Promise<void> {
  const { error } = await supabase
    .from('agent_conversations')
    .upsert({
      id: conv.id,
      agent_id: conv.agent_id,
      user_id: conv.user_id,
      messages: conv.messages,
    })

  if (error) console.error('Error saving agent conversation:', error)
}

/** Get conversations for an agent */
export async function getAgentConversations(
  agentId: string,
  userId: string,
): Promise<AgentConversation[]> {
  const { data, error } = await supabase
    .from('agent_conversations')
    .select('*')
    .eq('agent_id', agentId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error fetching agent conversations:', error)
    return []
  }
  return (data ?? []) as AgentConversation[]
}
