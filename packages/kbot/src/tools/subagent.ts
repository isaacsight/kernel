// K:BOT Subagent System — Spawn specialist agents as parallel workers
//
// Like Claude Code's Agent tool. Each subagent:
//   - Gets its own conversation context
//   - Has access to all tools
//   - Can be a specific specialist (researcher, coder, etc.)
//   - Returns results to the parent agent
//   - Runs in parallel with other subagents
//
// This enables: "research X while coding Y while testing Z"

import { runAgent, type AgentOptions, type AgentResponse } from '../agent.js'
import { registerTool } from './index.js'
import { loadConfig } from '../auth.js'

interface SubagentTask {
  id: string
  agent: string
  prompt: string
  status: 'running' | 'completed' | 'failed'
  response?: AgentResponse
  error?: string
  startedAt: string
  completedAt?: string
}

const activeSubagents = new Map<string, SubagentTask>()
let nextSubagentId = 1

// Store the parent agent options for subagent inheritance
let parentOpts: AgentOptions = {}

export function setParentAgentOptions(opts: AgentOptions): void {
  parentOpts = opts
}

export function registerSubagentTools(): void {
  registerTool({
    name: 'spawn_agent',
    description: 'Spawn a specialist subagent to handle a task. The subagent runs independently with its own context and tools. Returns the subagent ID — use agent_result to get the output.',
    parameters: {
      prompt: { type: 'string', description: 'Task for the subagent to perform', required: true },
      agent: { type: 'string', description: 'Specialist agent to use: kernel, researcher, coder, writer, analyst, aesthete, guardian, curator, strategist, creative, thinking-partner (default: auto)' },
      background: { type: 'boolean', description: 'Run in background (true) or wait for result (false, default)' },
    },
    tier: 'free',
    async execute(args) {
      const prompt = String(args.prompt)
      const agent = args.agent ? String(args.agent) : 'auto'
      const background = args.background === true
      const id = String(nextSubagentId++)

      const task: SubagentTask = {
        id,
        agent,
        prompt,
        status: 'running',
        startedAt: new Date().toISOString(),
      }
      activeSubagents.set(id, task)

      const opts: AgentOptions = {
        ...parentOpts,
        agent,
      }

      if (background) {
        // Fire and forget — run in background
        runAgent(prompt, opts).then(response => {
          task.response = response
          task.status = 'completed'
          task.completedAt = new Date().toISOString()
        }).catch(err => {
          task.error = err instanceof Error ? err.message : String(err)
          task.status = 'failed'
          task.completedAt = new Date().toISOString()
        })

        return `Subagent #${id} spawned (${agent}, background). Use \`agent_result\` with id="${id}" to check output.`
      }

      // Synchronous — wait for result
      try {
        const response = await runAgent(prompt, opts)
        task.response = response
        task.status = 'completed'
        task.completedAt = new Date().toISOString()

        return `[Subagent #${id} (${response.agent}) — ${response.toolCalls} tool calls]\n\n${response.content}`
      } catch (err) {
        task.error = err instanceof Error ? err.message : String(err)
        task.status = 'failed'
        task.completedAt = new Date().toISOString()
        return `Subagent #${id} failed: ${task.error}`
      }
    },
  })

  registerTool({
    name: 'spawn_parallel',
    description: 'Spawn multiple subagents in parallel and wait for all results. Each agent works independently on its task.',
    parameters: {
      tasks: {
        type: 'array',
        description: 'Array of { prompt, agent } objects. Each becomes a parallel subagent.',
        required: true,
        items: { type: 'object', properties: { prompt: { type: 'string' }, agent: { type: 'string' } } },
      },
    },
    tier: 'free',
    async execute(args) {
      const tasks = args.tasks as Array<{ prompt: string; agent?: string }>
      if (!Array.isArray(tasks) || tasks.length === 0) {
        return 'Error: tasks must be a non-empty array of { prompt, agent }'
      }

      if (tasks.length > 10) {
        return 'Error: maximum 10 parallel subagents'
      }

      const startTime = Date.now()
      const results = await Promise.all(
        tasks.map(async (t, i) => {
          const id = String(nextSubagentId++)
          const agent = t.agent || 'auto'

          const task: SubagentTask = {
            id,
            agent,
            prompt: t.prompt,
            status: 'running',
            startedAt: new Date().toISOString(),
          }
          activeSubagents.set(id, task)

          try {
            const response = await runAgent(t.prompt, { ...parentOpts, agent })
            task.response = response
            task.status = 'completed'
            task.completedAt = new Date().toISOString()
            return { id, agent: response.agent, success: true, content: response.content, toolCalls: response.toolCalls }
          } catch (err) {
            const error = err instanceof Error ? err.message : String(err)
            task.error = error
            task.status = 'failed'
            task.completedAt = new Date().toISOString()
            return { id, agent, success: false, content: error, toolCalls: 0 }
          }
        })
      )

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const lines: string[] = []

      for (const r of results) {
        const icon = r.success ? '✓' : '✗'
        lines.push(`── Subagent #${r.id} (${r.agent}) [${icon}] ──`)
        lines.push(r.content.length > 2000 ? r.content.slice(0, 2000) + '\n...(truncated)' : r.content)
        lines.push('')
      }

      const passed = results.filter(r => r.success).length
      const totalTools = results.reduce((sum, r) => sum + r.toolCalls, 0)
      lines.push(`${passed}/${results.length} subagents succeeded · ${totalTools} total tool calls · ${elapsed}s (parallel)`)

      return lines.join('\n')
    },
  })

  registerTool({
    name: 'agent_result',
    description: 'Get the result of a background subagent by ID.',
    parameters: {
      id: { type: 'string', description: 'Subagent ID', required: true },
    },
    tier: 'free',
    async execute(args) {
      const id = String(args.id)
      const task = activeSubagents.get(id)
      if (!task) return `Error: Subagent #${id} not found`

      if (task.status === 'running') {
        const elapsed = ((Date.now() - new Date(task.startedAt).getTime()) / 1000).toFixed(0)
        return `Subagent #${id} still running (${elapsed}s). Check again later.`
      }

      if (task.status === 'failed') {
        return `Subagent #${id} failed: ${task.error}`
      }

      return `[Subagent #${id} (${task.response!.agent}) — ${task.response!.toolCalls} tool calls]\n\n${task.response!.content}`
    },
  })

  registerTool({
    name: 'agent_list',
    description: 'List all active and completed subagents.',
    parameters: {},
    tier: 'free',
    async execute() {
      if (activeSubagents.size === 0) return 'No subagents.'

      const lines: string[] = []
      for (const [id, task] of activeSubagents) {
        const icon = { running: '●', completed: '✓', failed: '✗' }[task.status]
        const elapsed = task.completedAt
          ? `${((new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 1000).toFixed(1)}s`
          : `${((Date.now() - new Date(task.startedAt).getTime()) / 1000).toFixed(0)}s`
        lines.push(`${icon} #${id} [${task.status}] ${task.agent} — ${task.prompt.slice(0, 60)}... (${elapsed})`)
      }
      return lines.join('\n')
    },
  })

  // ── K:BOT Local Delegation ──
  // Delegate tasks to the local K:BOT Local gateway as a parallel AI worker.
  // K:BOT Local runs in its own sandboxed user space with local models.

  registerTool({
    name: 'kbot_local_delegate',
    description: 'Delegate a task to K:BOT Local, a local AI assistant running in an isolated user space with its own models. Use this for parallel work — K:BOT Local can research, code, or analyze while you handle other parts. Returns K:BOT Local\'s response. Costs $0 (uses local models).',
    parameters: {
      prompt: { type: 'string', description: 'Task for K:BOT Local to perform', required: true },
      model: { type: 'string', description: 'Model to use (default: kbot-local:main). Options: qwen2.5-coder:7b, llama3.1:8b, mistral:7b, deepseek-coder-v2:16b, phi4:14b, gemma3:12b, nemotron-mini, nemotron-3-nano, codellama:13b, starcoder2:7b, codegemma:7b' },
    },
    tier: 'free',
    async execute(args) {
      const prompt = String(args.prompt)
      const model = args.model ? String(args.model) : 'kbot-local:main'
      const config = loadConfig()
      const token = config?.byok_provider === 'kbot-local' ? config?.byok_key : null
      const gatewayToken = token || process.env.KBOT_LOCAL_API_KEY || 'local'

      try {
        const res = await fetch('http://127.0.0.1:18789/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${gatewayToken}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4096,
          }),
          signal: AbortSignal.timeout(120_000),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
          return `K:BOT Local error: ${err.error?.message || res.status}. Is the gateway running? Start with: kbot gateway start`
        }

        const data = await res.json()
        const content = data.choices?.[0]?.message?.content || 'No response from K:BOT Local'
        const usage = data.usage || {}
        return `[K:BOT Local · ${data.model || model} · ${(usage.prompt_tokens || 0) + (usage.completion_tokens || 0)} tokens · $0]\n\n${content}`
      } catch (err) {
        if (err instanceof Error && err.name === 'TimeoutError') {
          return 'K:BOT Local timed out after 120s. The task may be too complex for the current model.'
        }
        return `K:BOT Local connection failed: ${err instanceof Error ? err.message : String(err)}. Start gateway with: kbot gateway start`
      }
    },
  })

  registerTool({
    name: 'kbot_local_status',
    description: 'Check if K:BOT Local gateway is running and what models are available.',
    parameters: {},
    tier: 'free',
    async execute() {
      try {
        const res = await fetch('http://127.0.0.1:18789/health', { signal: AbortSignal.timeout(3000) })
        if (!res.ok) return 'K:BOT Local gateway: not responding'
        const health = await res.json().catch(() => ({}))
        const lines = ['K:BOT Local gateway: running']
        if (health.version) lines.push(`  Version: ${health.version}`)
        if (health.uptime) lines.push(`  Uptime: ${health.uptime}`)

        // Also check Ollama models
        try {
          const ollamaRes = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) })
          if (ollamaRes.ok) {
            const data = await ollamaRes.json()
            const models = (data.models || []).map((m: any) => m.name)
            lines.push(`  Models: ${models.join(', ')}`)
          }
        } catch { /* Ollama not running */ }

        return lines.join('\n')
      } catch {
        return 'K:BOT Local gateway: offline. Start with: kbot gateway start'
      }
    },
  })
}
