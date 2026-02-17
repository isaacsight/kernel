import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerTool,
  removeTool,
  getTool,
  getAllTools,
  getToolSchemas,
  getToolsForAgent,
  clearTools,
  getToolCount,
} from './registry'
import type { Tool } from './types'

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    name: 'test_tool',
    description: 'A test tool',
    parameters: { query: { type: 'string' } },
    execute: async () => ({ success: true, data: 'ok' }),
    ...overrides,
  }
}

describe('ToolRegistry', () => {
  beforeEach(() => {
    clearTools()
  })

  it('registers and retrieves a tool', () => {
    const tool = makeTool()
    registerTool(tool)
    expect(getTool('test_tool')).toBe(tool)
    expect(getToolCount()).toBe(1)
  })

  it('returns undefined for unknown tools', () => {
    expect(getTool('nonexistent')).toBeUndefined()
  })

  it('overwrites existing tool with same name', () => {
    registerTool(makeTool({ description: 'v1' }))
    registerTool(makeTool({ description: 'v2' }))
    expect(getTool('test_tool')?.description).toBe('v2')
    expect(getToolCount()).toBe(1)
  })

  it('removes a tool', () => {
    registerTool(makeTool())
    expect(removeTool('test_tool')).toBe(true)
    expect(getTool('test_tool')).toBeUndefined()
    expect(removeTool('test_tool')).toBe(false)
  })

  it('lists all tools', () => {
    registerTool(makeTool({ name: 'a' }))
    registerTool(makeTool({ name: 'b' }))
    registerTool(makeTool({ name: 'c' }))
    expect(getAllTools()).toHaveLength(3)
  })

  it('generates tool schemas without execute function', () => {
    registerTool(makeTool())
    const schemas = getToolSchemas()
    expect(schemas).toHaveLength(1)
    expect(schemas[0]).toEqual({
      name: 'test_tool',
      description: 'A test tool',
      parameters: { query: { type: 'string' } },
    })
    expect(schemas[0]).not.toHaveProperty('execute')
  })

  it('filters tools by agent — unrestricted tool available to all', () => {
    registerTool(makeTool({ name: 'global' }))
    expect(getToolsForAgent('researcher')).toHaveLength(1)
    expect(getToolsForAgent('coder')).toHaveLength(1)
  })

  it('filters tools by agent — restricted tool', () => {
    registerTool(makeTool({ name: 'code_exec', agents: ['coder'] }))
    registerTool(makeTool({ name: 'global' }))
    expect(getToolsForAgent('coder')).toHaveLength(2)
    expect(getToolsForAgent('researcher')).toHaveLength(1)
  })

  it('clears all tools', () => {
    registerTool(makeTool({ name: 'a' }))
    registerTool(makeTool({ name: 'b' }))
    clearTools()
    expect(getToolCount()).toBe(0)
    expect(getAllTools()).toHaveLength(0)
  })
})
