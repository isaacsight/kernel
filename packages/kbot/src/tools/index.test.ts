// K:BOT Tool Registry Tests
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  registerTool, getTool, getAllTools, getToolsForTier,
  executeTool, getToolMetrics, getToolDefinitionsForApi,
  type ToolDefinition,
} from './index.js'

// Helper to create a test tool
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
    assert.equal(getTool('reg_test')?.name, 'reg_test')
  })

  it('returns undefined for unknown tools', () => {
    assert.equal(getTool('nonexistent_tool_xyz'), undefined)
  })

  it('getAllTools returns registered tools', () => {
    registerTool(makeTool({ name: 'all_test_1' }))
    registerTool(makeTool({ name: 'all_test_2' }))
    const tools = getAllTools()
    const names = tools.map(t => t.name)
    assert.ok(names.includes('all_test_1'))
    assert.ok(names.includes('all_test_2'))
  })
})

describe('Tier Gating', () => {
  it('free tier only gets free tools', () => {
    registerTool(makeTool({ name: 'tier_free', tier: 'free' }))
    registerTool(makeTool({ name: 'tier_pro', tier: 'pro' }))
    registerTool(makeTool({ name: 'tier_enterprise', tier: 'enterprise' }))

    const freeTools = getToolsForTier('free')
    const freeNames = freeTools.map(t => t.name)
    assert.ok(freeNames.includes('tier_free'))
    assert.ok(!freeNames.includes('tier_pro'))
    assert.ok(!freeNames.includes('tier_enterprise'))
  })

  it('pro tier gets free + pro tools', () => {
    const proTools = getToolsForTier('pro')
    const proNames = proTools.map(t => t.name)
    assert.ok(proNames.includes('tier_free'))
    assert.ok(proNames.includes('tier_pro'))
    assert.ok(!proNames.includes('tier_enterprise'))
  })

  it('enterprise tier gets all tools', () => {
    const entTools = getToolsForTier('enterprise')
    const entNames = entTools.map(t => t.name)
    assert.ok(entNames.includes('tier_free'))
    assert.ok(entNames.includes('tier_pro'))
    assert.ok(entNames.includes('tier_enterprise'))
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
    assert.equal(result.result, 'result: hello')
    assert.equal(result.error, undefined)
    assert.ok(typeof result.duration_ms === 'number')
    assert.ok(result.duration_ms! >= 0)
  })

  it('returns error for unknown tools', async () => {
    const result = await executeTool({
      id: 'test-2',
      name: 'totally_unknown_tool',
      arguments: {},
    })
    assert.ok(result.error)
    assert.ok(result.result.includes('Unknown tool'))
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
    assert.ok(result.error)
    assert.ok(result.result.includes('kaboom'))
  })

  it('times out long-running tools', async () => {
    registerTool(makeTool({
      name: 'slow_tool',
      timeout: 100, // 100ms timeout
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
    assert.ok(result.error)
    assert.ok(result.result.includes('timed out'))
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
    assert.ok(result.result.length < bigResult.length)
    assert.ok(result.result.includes('truncated'))
  })
})

describe('Tool Metrics', () => {
  it('tracks execution metrics', async () => {
    registerTool(makeTool({ name: 'metrics_test' }))
    await executeTool({ id: 'm1', name: 'metrics_test', arguments: { input: 'a' } })
    await executeTool({ id: 'm2', name: 'metrics_test', arguments: { input: 'b' } })

    const m = getToolMetrics('metrics_test')
    assert.equal(m.length, 1)
    assert.equal(m[0].calls, 2)
    assert.equal(m[0].errors, 0)
    assert.ok(m[0].avgDurationMs >= 0)
  })

  it('tracks error metrics', async () => {
    registerTool(makeTool({
      name: 'err_metrics',
      execute: async () => { throw new Error('fail') },
    }))
    await executeTool({ id: 'e1', name: 'err_metrics', arguments: {} })

    const m = getToolMetrics('err_metrics')
    assert.equal(m[0].errors, 1)
  })
})

describe('API Definitions', () => {
  it('generates correct API schema', () => {
    registerTool(makeTool({ name: 'schema_test', tier: 'free' }))
    const defs = getToolDefinitionsForApi('free')
    const def = defs.find(d => d.name === 'schema_test')
    assert.ok(def)
    assert.equal(def!.input_schema.type, 'object')
    assert.ok(def!.input_schema.properties.input)
    assert.ok(def!.input_schema.required?.includes('input'))
  })
})
