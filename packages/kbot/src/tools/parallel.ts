// K:BOT Parallel Tool Execution
//
// Runs multiple tools concurrently via Promise.all.
// Claude Code's biggest speed advantage — multiple independent
// operations execute simultaneously instead of sequentially.
//
// Example: read 3 files + run git status = 1 round-trip instead of 4.

import { registerTool, executeTool, getTool, type ToolCall, type ToolResult } from './index.js'

export function registerParallelTools(): void {
  registerTool({
    name: 'parallel_execute',
    description: 'Run multiple tools in parallel. Each item is { name, arguments }. All tools execute concurrently via Promise.all — much faster than sequential calls for independent operations.',
    parameters: {
      calls: {
        type: 'array',
        description: 'Array of tool calls: [{ name: "read_file", arguments: { path: "..." } }, ...]',
        required: true,
        items: { type: 'object', properties: { name: { type: 'string' }, arguments: { type: 'object' } } },
      },
    },
    tier: 'free',
    async execute(args) {
      const calls = args.calls as Array<{ name: string; arguments?: Record<string, unknown> }>
      if (!Array.isArray(calls) || calls.length === 0) {
        return 'Error: calls must be a non-empty array of { name, arguments }'
      }

      if (calls.length > 20) {
        return 'Error: maximum 20 parallel calls allowed'
      }

      // Validate all tools exist before executing any
      for (const call of calls) {
        if (!getTool(call.name)) {
          return `Error: unknown tool "${call.name}". Fix the tool name and retry.`
        }
      }

      // Build ToolCall objects
      const toolCalls: ToolCall[] = calls.map((call, i) => ({
        id: `parallel_${Date.now()}_${i}`,
        name: call.name,
        arguments: call.arguments || {},
      }))

      // Execute all in parallel
      const startTime = Date.now()
      const results: ToolResult[] = await Promise.all(
        toolCalls.map(tc => executeTool(tc))
      )
      const elapsed = Date.now() - startTime

      // Format results
      const output: string[] = []
      for (let i = 0; i < results.length; i++) {
        const call = calls[i]
        const result = results[i]
        const status = result.error ? 'ERROR' : 'OK'
        output.push(`── ${call.name} [${status}] ──`)
        output.push(result.result)
        output.push('')
      }

      output.push(`⏱ ${calls.length} tools completed in ${elapsed}ms (parallel)`)
      return output.join('\n')
    },
  })
}
