// kbot A2A Tools — Agent-to-Agent protocol status and management
//
// Provides the a2a_status tool for inspecting the A2A server state,
// registered capabilities, active tasks, and discovered remote agents.
//
// Tools: a2a_status, a2a_discover, a2a_send, a2a_card

import { registerTool } from './index.js'
import {
  getA2AStatus,
  buildAgentCard,
  discoverAgent,
  delegateTask,
  listRemoteAgents,
  removeRemoteAgent,
  type AgentCard,
} from '../a2a.js'

export function registerA2ATools(): void {
  // ── a2a_status ──

  registerTool({
    name: 'a2a_status',
    description:
      'Show A2A (Agent-to-Agent) protocol server status: whether the server is running, ' +
      'registered agent capabilities (all 35 kbot specialists), task statistics, ' +
      'active connections, and discovered remote agents.',
    parameters: {
      verbose: {
        type: 'boolean',
        description: 'Show full skill descriptions and all tags. Defaults to false (summary only).',
        required: false,
        default: false,
      },
    },
    tier: 'free',
    async execute(args) {
      const verbose = args.verbose === true || args.verbose === 'true'
      const status = getA2AStatus()

      const lines: string[] = []

      // Server section
      lines.push('=== A2A Server Status ===')
      lines.push(`Running:   ${status.server.running ? 'YES' : 'NO'}`)
      if (status.server.running) {
        lines.push(`Endpoint:  ${status.server.endpointUrl}`)
        lines.push(`Started:   ${status.server.startedAt}`)
        lines.push(`Uptime:    ${status.server.uptime}`)
      } else {
        lines.push('(Server not started. Run `kbot serve` to start the A2A endpoint.)')
      }

      // Tasks section
      lines.push('')
      lines.push('=== Task Statistics ===')
      lines.push(`Received:  ${status.tasks.received}`)
      lines.push(`Completed: ${status.tasks.completed}`)
      lines.push(`Failed:    ${status.tasks.failed}`)
      lines.push(`Active:    ${status.tasks.active}`)
      lines.push(`In Store:  ${status.tasks.stored}`)

      // Capabilities section
      lines.push('')
      lines.push(`=== Registered Capabilities (${status.capabilities.totalSkills} agents) ===`)
      if (verbose) {
        for (const skill of status.capabilities.skills) {
          lines.push(`  ${skill.id}: ${skill.name}`)
          lines.push(`    Tags: ${skill.tags.join(', ')}`)
        }
      } else {
        // Compact: group by category
        const ids = status.capabilities.skills.map(s => s.id)
        lines.push(`Agents: ${ids.join(', ')}`)
      }

      // Connections section
      lines.push('')
      lines.push(`=== Active Connections (${status.connections.uniqueClients} unique clients) ===`)
      if (status.connections.clients.length === 0) {
        lines.push('  (no connections yet)')
      } else {
        for (const client of status.connections.clients) {
          lines.push(`  - ${client}`)
        }
      }

      // Remote agents section
      lines.push('')
      lines.push(`=== Discovered Remote Agents (${status.registry.remoteAgents}) ===`)
      if (status.registry.agents.length === 0) {
        lines.push('  (none discovered — use a2a_discover to find remote agents)')
      } else {
        for (const agent of status.registry.agents) {
          lines.push(`  - ${agent.name} @ ${agent.url} (${agent.skills} skills)`)
          if (agent.lastContact) {
            lines.push(`    Last contact: ${agent.lastContact}`)
          }
        }
      }

      return lines.join('\n')
    },
  })

  // ── a2a_discover ──

  registerTool({
    name: 'a2a_discover',
    description:
      'Discover a remote A2A agent by URL. Fetches its Agent Card from ' +
      '<url>/.well-known/agent.json and registers it in the local registry ' +
      'for future task delegation.',
    parameters: {
      url: {
        type: 'string',
        description: 'Base URL of the remote agent (e.g. "http://other-agent:8080")',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      const url = String(args.url).trim()
      if (!url) return 'Error: url is required'

      const card = await discoverAgent(url)
      if (!card) {
        return `Failed to discover agent at ${url}. Ensure the agent is running and exposes /.well-known/agent.json.`
      }

      const lines: string[] = [
        `Discovered: ${card.name} v${card.version}`,
        `URL: ${card.url}`,
        `Provider: ${card.provider.organization}`,
        `Skills (${card.skills.length}):`,
        ...card.skills.map(s => `  - ${s.id}: ${s.name} [${s.tags.join(', ')}]`),
        '',
        'Agent registered in local registry. Use a2a_send to delegate tasks.',
      ]
      return lines.join('\n')
    },
  })

  // ── a2a_send ──

  registerTool({
    name: 'a2a_send',
    description:
      'Send a task to a remote A2A agent. Delegates work to another agent\'s ' +
      'specialist via the A2A protocol. Optionally specify which agent skill to use.',
    parameters: {
      url: {
        type: 'string',
        description: 'Base URL of the remote agent',
        required: true,
      },
      task: {
        type: 'string',
        description: 'The task prompt to send to the remote agent',
        required: true,
      },
      agent: {
        type: 'string',
        description: 'Hint which specialist agent should handle the task (optional)',
        required: false,
      },
    },
    tier: 'free',
    timeout: 180_000, // 3 minutes for remote task execution
    async execute(args) {
      const url = String(args.url).trim()
      const task = String(args.task).trim()
      const agent = args.agent ? String(args.agent).trim() : undefined
      if (!url || !task) return 'Error: url and task are required'

      const result = await delegateTask(url, task, { agent })
      if (!result) {
        return `Task delegation to ${url} failed. The remote agent may be down or the task execution failed.`
      }

      return [
        `=== Task Result from ${url} ===`,
        result.text,
        '',
        result.metadata.agentUsed ? `Agent used: ${result.metadata.agentUsed}` : '',
        result.metadata.model ? `Model: ${result.metadata.model}` : '',
      ].filter(Boolean).join('\n')
    },
  })

  // ── a2a_card ──

  registerTool({
    name: 'a2a_card',
    description:
      'Generate and display kbot\'s A2A Agent Card — the JSON descriptor that ' +
      'other agents use to discover kbot\'s capabilities. Shows all 35 specialist ' +
      'agents as skills with tags and descriptions.',
    parameters: {
      url: {
        type: 'string',
        description: 'Override the endpoint URL in the card (defaults to the current server URL)',
        required: false,
      },
    },
    tier: 'free',
    async execute(args) {
      const url = args.url ? String(args.url).trim() : undefined
      const card: AgentCard = buildAgentCard(url)
      return JSON.stringify(card, null, 2)
    },
  })

  // ── a2a_remove ──

  registerTool({
    name: 'a2a_remove',
    description: 'Remove a remote A2A agent from the local discovery registry.',
    parameters: {
      url: {
        type: 'string',
        description: 'Base URL of the remote agent to remove',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      const url = String(args.url).trim()
      if (!url) return 'Error: url is required'

      const removed = removeRemoteAgent(url)
      return removed
        ? `Removed ${url} from the A2A registry.`
        : `Agent ${url} not found in the registry.`
    },
  })

  // ── a2a_list ──

  registerTool({
    name: 'a2a_list',
    description: 'List all discovered remote A2A agents from the local registry.',
    parameters: {},
    tier: 'free',
    async execute() {
      const agents = listRemoteAgents()
      if (agents.length === 0) {
        return 'No remote agents discovered. Use a2a_discover to find agents.'
      }

      const lines = agents.map(a => {
        const skills = a.card.skills.map(s => s.id).join(', ')
        return [
          `${a.card.name} (${a.url})`,
          `  Skills: ${skills}`,
          `  Discovered: ${a.discoveredAt}`,
          a.lastContactedAt ? `  Last contact: ${a.lastContactedAt}` : '',
        ].filter(Boolean).join('\n')
      })

      return `=== Discovered Remote Agents (${agents.length}) ===\n\n${lines.join('\n\n')}`
    },
  })
}
