// K:BOT Tool Registry Tests
import { describe, it, expect } from 'vitest'
import {
  registerTool, getTool, getAllTools, getToolsForTier,
  executeTool, getToolMetrics, getToolDefinitionsForApi,
  type ToolDefinition,
} from './index.js'

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: 'test_tool',
    description: 'A test tool',
    parameters: {
      input: { type: 'string', description: 'Test input', required: true },
    },
    execute: async (args) => `result: ${args.input}`,
    tier: 'free',
    ...overrides,
  }
}

describe('Tool Registry', () => {
  it('registers and retrieves tools', () => {
    const tool = makeTool({ name: 'reg_test' })
    registerTool(tool)
    expect(getTool('reg_test')?.name).toBe('reg_test')
  })

  it('returns undefined for unknown tools', () => {
    expect(getTool('nonexistent_tool_xyz')).toBeUndefined()
  })

  it('getAllTools returns registered tools', () => {
    registerTool(makeTool({ name: 'all_test_1' }))
    registerTool(makeTool({ name: 'all_test_2' }))
    const names = getAllTools().map(t => t.name)
    expect(names).toContain('all_test_1')
    expect(names).toContain('all_test_2')
  })
})

describe('Tier Gating', () => {
  it('free tier only gets free tools', () => {
    registerTool(makeTool({ name: 'tier_free', tier: 'free' }))
    registerTool(makeTool({ name: 'tier_pro', tier: 'pro' }))
    registerTool(makeTool({ name: 'tier_enterprise', tier: 'enterprise' }))

    const freeNames = getToolsForTier('free').map(t => t.name)
    expect(freeNames).toContain('tier_free')
    expect(freeNames).not.toContain('tier_pro')
    expect(freeNames).not.toContain('tier_enterprise')
  })

  it('pro tier gets free + pro tools', () => {
    const proNames = getToolsForTier('pro').map(t => t.name)
    expect(proNames).toContain('tier_free')
    expect(proNames).toContain('tier_pro')
    expect(proNames).not.toContain('tier_enterprise')
  })

  it('enterprise tier gets all tools', () => {
    const entNames = getToolsForTier('enterprise').map(t => t.name)
    expect(entNames).toContain('tier_free')
    expect(entNames).toContain('tier_pro')
    expect(entNames).toContain('tier_enterprise')
  })
})

describe('Tool Execution', () => {
  it('executes tools successfully', async () => {
    registerTool(makeTool({ name: 'exec_test' }))
    const result = await executeTool({
      id: 'test-1',
      name: 'exec_test',
      arguments: { input: 'hello' },
    })
    expect(result.result).toBe('result: hello')
    expect(result.error).toBeUndefined()
    expect(result.duration_ms).toBeGreaterThanOrEqual(0)
  })

  it('returns error for unknown tools', async () => {
    const result = await executeTool({
      id: 'test-2',
      name: 'totally_unknown_tool',
      arguments: {},
    })
    expect(result.error).toBe(true)
    expect(result.result).toContain('Unknown tool')
  })

  it('handles tool execution errors', async () => {
    registerTool(makeTool({
      name: 'error_tool',
      execute: async () => { throw new Error('kaboom') },
    }))
    const result = await executeTool({
      id: 'test-3',
      name: 'error_tool',
      arguments: {},
    })
    expect(result.error).toBe(true)
    expect(result.result).toContain('kaboom')
  })

  it('times out long-running tools', async () => {
    registerTool(makeTool({
      name: 'slow_tool',
      timeout: 100,
      execute: async () => {
        await new Promise(resolve => setTimeout(resolve, 5000))
        return 'should not reach'
      },
    }))
    const result = await executeTool({
      id: 'test-4',
      name: 'slow_tool',
      arguments: {},
    })
    expect(result.error).toBe(true)
    expect(result.result).toContain('timed out')
  })

  it('truncates large results', async () => {
    const bigResult = 'x'.repeat(100_000)
    registerTool(makeTool({
      name: 'big_tool',
      maxResultSize: 1000,
      execute: async () => bigResult,
    }))
    const result = await executeTool({
      id: 'test-5',
      name: 'big_tool',
      arguments: {},
    })
    expect(result.result.length).toBeLessThan(bigResult.length)
    expect(result.result).toContain('truncated')
  })
})

describe('Tool Metrics', () => {
  it('tracks execution metrics', async () => {
    registerTool(makeTool({ name: 'metrics_test' }))
    await executeTool({ id: 'm1', name: 'metrics_test', arguments: { input: 'a' } })
    await executeTool({ id: 'm2', name: 'metrics_test', arguments: { input: 'b' } })

    const m = getToolMetrics('metrics_test')
    expect(m.length).toBe(1)
    expect(m[0].calls).toBe(2)
    expect(m[0].errors).toBe(0)
    expect(m[0].avgDurationMs).toBeGreaterThanOrEqual(0)
  })

  it('tracks error metrics', async () => {
    registerTool(makeTool({
      name: 'err_metrics',
      execute: async () => { throw new Error('fail') },
    }))
    await executeTool({ id: 'e1', name: 'err_metrics', arguments: {} })

    const m = getToolMetrics('err_metrics')
    expect(m[0].errors).toBe(1)
  })
})

describe('API Definitions', () => {
  it('generates correct API schema', () => {
    registerTool(makeTool({ name: 'schema_test', tier: 'free' }))
    const defs = getToolDefinitionsForApi('free')
    const def = defs.find(d => d.name === 'schema_test')
    expect(def).toBeTruthy()
    expect(def!.input_schema.type).toBe('object')
    expect(def!.input_schema.properties.input).toBeTruthy()
    expect(def!.input_schema.required).toContain('input')
  })
})
