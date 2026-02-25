import { describe, it, expect } from 'vitest'
import { selectTools } from './toolRAG'
import type { Tool } from './types'

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    name: 'test_tool',
    description: 'A test tool',
    parameters: {},
    execute: async () => ({ success: true, data: 'ok' }),
    ...overrides,
  }
}

describe('Tool RAG — selectTools', () => {
  const tools: Tool[] = [
    makeTool({ name: 'web_search', description: 'Search the web for information', keywords: ['search', 'find', 'look up'], category: 'search', agents: ['researcher'] }),
    makeTool({ name: 'calculator', description: 'Perform mathematical calculations', keywords: ['calculate', 'math', 'compute'], category: 'compute' }),
    makeTool({ name: 'memory_query', description: 'Query the knowledge graph for remembered facts', keywords: ['remember', 'recall', 'who', 'what do you know'], category: 'memory' }),
    makeTool({ name: 'supabase_query', description: 'Query the Supabase database', keywords: ['database', 'query', 'data'], category: 'external', agents: ['analyst'] }),
    makeTool({ name: 'code_exec', description: 'Execute code snippets', keywords: ['run', 'execute', 'code'], category: 'compute', agents: ['coder'] }),
    makeTool({ name: 'email_send', description: 'Send an email to someone', keywords: ['email', 'send', 'message'], category: 'external' }),
  ]

  it('returns all tools if under max limit', () => {
    const result = selectTools('anything', 'kernel', tools.slice(0, 3))
    expect(result).toHaveLength(3)
  })

  it('limits to maxTools', () => {
    const result = selectTools('anything', 'kernel', tools, undefined, 3)
    expect(result).toHaveLength(3)
  })

  it('filters out tools not available to the agent', () => {
    const result = selectTools('search for AI news', 'coder', tools, undefined, 4)
    // web_search is restricted to researcher, should be excluded for coder
    expect(result.find(t => t.name === 'web_search')).toBeUndefined()
    // code_exec is restricted to coder, should be included
    expect(result.find(t => t.name === 'code_exec')).toBeDefined()
  })

  it('boosts search tools for questions', () => {
    const result = selectTools('What is the latest AI news?', 'researcher', tools, undefined, 2)
    expect(result[0].name).toBe('web_search')
  })

  it('boosts memory tools for recall queries', () => {
    const result = selectTools('Do you remember what I said about Supabase?', 'kernel', tools, undefined, 2)
    expect(result.find(t => t.name === 'memory_query')).toBeDefined()
  })

  it('boosts compute tools for inputs with numbers', () => {
    const result = selectTools('Calculate 15% of 2500', 'analyst', tools, undefined, 2)
    expect(result.find(t => t.name === 'calculator')).toBeDefined()
  })

  it('matches by tool name in input', () => {
    const result = selectTools('use the calculator to figure this out', 'kernel', tools, undefined, 2)
    expect(result.find(t => t.name === 'calculator')).toBeDefined()
  })

  it('respects agent whitelists — analyst gets supabase_query', () => {
    const result = selectTools('query the database for user counts', 'analyst', tools, undefined, 3)
    expect(result.find(t => t.name === 'supabase_query')).toBeDefined()
  })
})
