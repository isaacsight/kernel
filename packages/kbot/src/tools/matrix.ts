// K:BOT Matrix Tools — Agent creation and invocation from within conversations
// The AI can spawn specialist agents on-the-fly to delegate sub-tasks.

import { registerTool } from './index.js'
import {
  createAgent, getAgent, listAgents, removeAgent, PRESETS,
} from '../matrix.js'

export function registerMatrixTools(): void {
  registerTool({
    name: 'create_agent',
    description: 'Create a new specialist agent in the matrix. The agent gets a custom system prompt and can be invoked later by switching to it with /agent <id>. Use this when a task needs a specific expert perspective (e.g., security auditor, UX critic, devil\'s advocate). Preset templates available: ' + Object.keys(PRESETS).join(', '),
    parameters: {
      name: { type: 'string', description: 'Human-readable name (e.g., "Security Auditor")', required: true },
      system_prompt: { type: 'string', description: 'System prompt defining the agent\'s expertise, personality, and evaluation criteria', required: true },
    },
    tier: 'free',
    execute: async (args) => {
      const name = String(args.name || '')
      const systemPrompt = String(args.system_prompt || '')
      if (!name || !systemPrompt) {
        return 'Error: Both name and system_prompt are required.'
      }
      try {
        const agent = createAgent(name, systemPrompt)
        return `Agent "${agent.name}" created successfully.\nID: ${agent.id}\nIcon: ${agent.icon}\nThe user can switch to this agent with: /agent ${agent.id}`
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  registerTool({
    name: 'spawn_preset_agent',
    description: 'Spawn a pre-built specialist agent from the template library. Available presets: ' + Object.entries(PRESETS).map(([id, p]) => `${id} (${p.name})`).join(', '),
    parameters: {
      preset: { type: 'string', description: 'Preset ID: ' + Object.keys(PRESETS).join(', '), required: true },
    },
    tier: 'free',
    execute: async (args) => {
      const presetId = String(args.preset || '')
      const preset = PRESETS[presetId]
      if (!preset) {
        return `Unknown preset "${presetId}". Available: ${Object.keys(PRESETS).join(', ')}`
      }
      try {
        const agent = createAgent(preset.name, preset.prompt)
        return `Preset agent "${agent.name}" spawned.\nID: ${agent.id}\nThe user can switch to this agent with: /agent ${agent.id}`
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  registerTool({
    name: 'list_matrix_agents',
    description: 'List all custom agents currently in the matrix, showing their IDs, names, and invocation counts.',
    parameters: {},
    tier: 'free',
    execute: async () => {
      const agents = listAgents()
      if (agents.length === 0) return 'No agents in the matrix yet.'
      return agents.map(a =>
        `${a.icon} ${a.name} (${a.id}) — ${a.invocations} calls\n  Prompt: ${a.systemPrompt.slice(0, 100)}...`
      ).join('\n\n')
    },
  })

  registerTool({
    name: 'remove_matrix_agent',
    description: 'Remove a custom agent from the matrix by ID.',
    parameters: {
      agent_id: { type: 'string', description: 'The agent ID to remove', required: true },
    },
    tier: 'free',
    execute: async (args) => {
      const id = String(args.agent_id || '')
      if (removeAgent(id)) {
        return `Agent "${id}" removed from the matrix.`
      }
      return `Agent "${id}" not found in the matrix.`
    },
  })
}
