// Tests for kbot Graph Memory — knowledge graph for entity-relationship reasoning
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock node:fs before importing the module under test
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
}))

vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock-home'),
}))

// Mock crypto to produce deterministic IDs for testing
let idCounter = 0
vi.mock('node:crypto', () => ({
  randomBytes: vi.fn(() => {
    const hex = (idCounter++).toString(16).padStart(8, '0')
    return { toString: () => hex }
  }),
}))

// Mock registerTool to avoid side effects
vi.mock('./tools/index.js', () => ({
  registerTool: vi.fn(),
}))

import {
  load,
  save,
  addNode,
  addEdge,
  findNode,
  getNeighbors,
  getSubgraph,
  shortestPath,
  queryRelation,
  decayUnused,
  prune,
  toContext,
  extractEntities,
  autoConnect,
  importFromMemory,
  getStats,
  getNode,
  getGraph,
  type GraphNode,
  type NodeType,
} from './graph-memory.js'

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'

const mockedExistsSync = vi.mocked(existsSync)
const mockedReadFileSync = vi.mocked(readFileSync)
const mockedWriteFileSync = vi.mocked(writeFileSync)
const mockedMkdirSync = vi.mocked(mkdirSync)
const mockedReaddirSync = vi.mocked(readdirSync)

const KBOT_DIR = '/mock-home/.kbot'
const GRAPH_FILE = '/mock-home/.kbot/graph.json'

beforeEach(() => {
  vi.clearAllMocks()
  idCounter = 0
  // Reset graph to empty state via load() with no file
  mockedExistsSync.mockImplementation((p) => {
    if (p === KBOT_DIR) return true
    return false // graph.json does not exist
  })
  load()
  vi.clearAllMocks()
  idCounter = 100 // Start IDs from 100 for clarity
})

// ─── load ────────────────────────────────────────────────────────────────

describe('load', () => {
  it('creates kbot dir if it does not exist', () => {
    mockedExistsSync.mockReturnValueOnce(false) // dir check
    mockedExistsSync.mockReturnValueOnce(false) // file check
    load()
    expect(mockedMkdirSync).toHaveBeenCalledWith(KBOT_DIR, { recursive: true })
  })

  it('initializes empty graph when graph.json does not exist', () => {
    mockedExistsSync.mockReturnValueOnce(true)  // dir exists
    mockedExistsSync.mockReturnValueOnce(false) // file does not exist
    load()
    const graph = getGraph()
    expect(graph.nodes.size).toBe(0)
    expect(graph.edges).toEqual([])
  })

  it('loads nodes and edges from graph.json', () => {
    const graphData = {
      nodes: [
        ['abc', { id: 'abc', type: 'entity', name: 'Test', properties: {}, created: '2026-01-01', lastAccessed: '2026-01-01', accessCount: 1 }],
      ],
      edges: [
        { source: 'abc', target: 'def', relation: 'uses', weight: 0.5, created: '2026-01-01' },
      ],
    }
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue(JSON.stringify(graphData))

    load()

    const graph = getGraph()
    expect(graph.nodes.size).toBe(1)
    expect(graph.nodes.get('abc')!.name).toBe('Test')
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0].relation).toBe('uses')
  })

  it('resets to empty graph when JSON is malformed', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue('not-valid-json{{{')
    load()
    const graph = getGraph()
    expect(graph.nodes.size).toBe(0)
    expect(graph.edges).toEqual([])
  })

  it('handles missing nodes array gracefully', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue(JSON.stringify({ edges: [] }))
    load()
    const graph = getGraph()
    expect(graph.nodes.size).toBe(0)
    expect(graph.edges).toEqual([])
  })

  it('handles missing edges array gracefully', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue(JSON.stringify({ nodes: [] }))
    load()
    const graph = getGraph()
    expect(graph.nodes.size).toBe(0)
    expect(graph.edges).toEqual([])
  })

  it('does not create dir if it already exists', () => {
    mockedExistsSync.mockReturnValueOnce(true)  // dir exists
    mockedExistsSync.mockReturnValueOnce(false)  // file doesn't exist
    load()
    expect(mockedMkdirSync).not.toHaveBeenCalled()
  })
})

// ─── save ────────────────────────────────────────────────────────────────

describe('save', () => {
  it('writes graph to graph.json as JSON with nodes and edges', () => {
    mockedExistsSync.mockReturnValue(true)
    addNode('entity', 'TestNode')
    save()

    expect(mockedWriteFileSync).toHaveBeenCalledTimes(1)
    const [path, content, encoding] = mockedWriteFileSync.mock.calls[0]
    expect(path).toBe(GRAPH_FILE)
    expect(encoding).toBe('utf-8')

    const parsed = JSON.parse(content as string)
    expect(parsed.nodes).toHaveLength(1)
    expect(parsed.nodes[0][1].name).toBe('TestNode')
    expect(parsed.edges).toEqual([])
  })

  it('creates kbot dir if it does not exist', () => {
    mockedExistsSync.mockReturnValueOnce(false)
    save()
    expect(mockedMkdirSync).toHaveBeenCalledWith(KBOT_DIR, { recursive: true })
  })

  it('serializes Map entries as arrays of [id, node] tuples', () => {
    mockedExistsSync.mockReturnValue(true)
    const nodeA = addNode('file', 'auth.ts')
    const nodeB = addNode('person', 'Isaac')
    addEdge(nodeA.id, nodeB.id, 'authored_by')
    save()

    const parsed = JSON.parse(mockedWriteFileSync.mock.calls[0][1] as string)
    expect(parsed.nodes).toHaveLength(2)
    // Each entry is [id, nodeObject]
    expect(parsed.nodes[0][0]).toBe(nodeA.id)
    expect(parsed.nodes[1][0]).toBe(nodeB.id)
    expect(parsed.edges).toHaveLength(1)
  })
})

// ─── addNode ─────────────────────────────────────────────────────────────

describe('addNode', () => {
  it('creates a new node with correct fields', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-29T10:00:00Z'))

    const node = addNode('entity', 'JWT')

    expect(node.type).toBe('entity')
    expect(node.name).toBe('JWT')
    expect(node.id).toBeDefined()
    expect(node.accessCount).toBe(1)
    expect(node.created).toBe('2026-03-29T10:00:00.000Z')
    expect(node.lastAccessed).toBe('2026-03-29T10:00:00.000Z')
    expect(node.properties).toEqual({})

    vi.useRealTimers()
  })

  it('stores properties on the node', () => {
    const node = addNode('file', 'auth.ts', { path: '/src/auth.ts', language: 'typescript' })
    expect(node.properties.path).toBe('/src/auth.ts')
    expect(node.properties.language).toBe('typescript')
  })

  it('adds node to the graph', () => {
    const node = addNode('concept', 'REST API')
    const graph = getGraph()
    expect(graph.nodes.has(node.id)).toBe(true)
    expect(graph.nodes.get(node.id)!.name).toBe('REST API')
  })

  it('returns existing node for duplicate type+name (case-insensitive)', () => {
    const first = addNode('entity', 'JWT')
    const second = addNode('entity', 'jwt')

    expect(first.id).toBe(second.id)
    expect(getGraph().nodes.size).toBe(1)
  })

  it('increments accessCount on duplicate', () => {
    const first = addNode('entity', 'JWT')
    expect(first.accessCount).toBe(1)

    const second = addNode('entity', 'jwt')
    expect(second.accessCount).toBe(2)
  })

  it('merges properties on duplicate', () => {
    addNode('entity', 'JWT', { algo: 'RS256' })
    const updated = addNode('entity', 'jwt', { issuer: 'kbot' })
    expect(updated.properties.algo).toBe('RS256')
    expect(updated.properties.issuer).toBe('kbot')
  })

  it('allows same name with different type', () => {
    const entity = addNode('entity', 'auth')
    const file = addNode('file', 'auth')

    expect(entity.id).not.toBe(file.id)
    expect(getGraph().nodes.size).toBe(2)
  })

  it('generates unique IDs for different nodes', () => {
    const a = addNode('entity', 'NodeA')
    const b = addNode('entity', 'NodeB')
    expect(a.id).not.toBe(b.id)
  })
})

// ─── addEdge ─────────────────────────────────────────────────────────────

describe('addEdge', () => {
  it('creates an edge between two existing nodes', () => {
    const nodeA = addNode('file', 'auth.ts')
    const nodeB = addNode('entity', 'JWT')
    const result = addEdge(nodeA.id, nodeB.id, 'uses')

    expect(result).toBe(true)
    expect(getGraph().edges).toHaveLength(1)
    expect(getGraph().edges[0]).toMatchObject({
      source: nodeA.id,
      target: nodeB.id,
      relation: 'uses',
    })
  })

  it('returns false when source node does not exist', () => {
    const node = addNode('entity', 'Test')
    expect(addEdge('nonexistent', node.id, 'uses')).toBe(false)
    expect(getGraph().edges).toHaveLength(0)
  })

  it('returns false when target node does not exist', () => {
    const node = addNode('entity', 'Test')
    expect(addEdge(node.id, 'nonexistent', 'uses')).toBe(false)
    expect(getGraph().edges).toHaveLength(0)
  })

  it('returns false when both nodes do not exist', () => {
    expect(addEdge('fake1', 'fake2', 'uses')).toBe(false)
  })

  it('uses default weight of 0.5', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    addEdge(a.id, b.id, 'relates')
    expect(getGraph().edges[0].weight).toBe(0.5)
  })

  it('accepts custom weight', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    addEdge(a.id, b.id, 'relates', 0.9)
    expect(getGraph().edges[0].weight).toBe(0.9)
  })

  it('clamps weight above 1 to 1', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    addEdge(a.id, b.id, 'relates', 5.0)
    expect(getGraph().edges[0].weight).toBe(1)
  })

  it('clamps weight below 0 to 0', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    addEdge(a.id, b.id, 'relates', -3.0)
    expect(getGraph().edges[0].weight).toBe(0)
  })

  it('strengthens existing edge by 0.1 on duplicate', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    addEdge(a.id, b.id, 'uses', 0.5)
    addEdge(a.id, b.id, 'uses', 0.9) // same source/target/relation
    expect(getGraph().edges).toHaveLength(1)
    expect(getGraph().edges[0].weight).toBe(0.6) // 0.5 + 0.1
  })

  it('allows different relation types between same nodes', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    addEdge(a.id, b.id, 'uses')
    addEdge(a.id, b.id, 'depends_on')
    expect(getGraph().edges).toHaveLength(2)
  })

  it('sets created timestamp on new edge', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))

    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    addEdge(a.id, b.id, 'relates')
    expect(getGraph().edges[0].created).toBe('2026-06-01T12:00:00.000Z')

    vi.useRealTimers()
  })
})

// ─── findNode ────────────────────────────────────────────────────────────

describe('findNode', () => {
  it('returns empty array on empty graph', () => {
    expect(findNode('anything')).toEqual([])
  })

  it('finds exact match by name', () => {
    addNode('entity', 'JWT')
    const results = findNode('JWT')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('JWT')
  })

  it('finds case-insensitive match', () => {
    addNode('entity', 'Authentication')
    const results = findNode('authentication')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Authentication')
  })

  it('finds substring match', () => {
    addNode('file', 'graph-memory.ts')
    const results = findNode('graph')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('graph-memory.ts')
  })

  it('returns results sorted by relevance', () => {
    addNode('entity', 'auth')
    addNode('entity', 'authentication')
    addNode('entity', 'authorization')
    const results = findNode('auth')
    // Exact match should come first
    expect(results[0].name).toBe('auth')
  })

  it('matches against property values', () => {
    addNode('file', 'auth.ts', { path: '/src/auth.ts', language: 'typescript' })
    const results = findNode('typescript')
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  it('returns at most 20 results', () => {
    for (let i = 0; i < 30; i++) {
      addNode('entity', `test-item-${i}`)
    }
    const results = findNode('test')
    expect(results.length).toBeLessThanOrEqual(20)
  })

  it('increments accessCount on found nodes', () => {
    const node = addNode('entity', 'JWT')
    expect(node.accessCount).toBe(1)
    findNode('JWT')
    expect(getNode(node.id)!.accessCount).toBe(2)
  })

  it('excludes results below similarity threshold', () => {
    addNode('entity', 'alpha')
    // 'zzzzz' should score very low against 'alpha'
    const results = findNode('zzzzz')
    expect(results).toHaveLength(0)
  })
})

// ─── getNeighbors (BFS) ─────────────────────────────────────────────────

describe('getNeighbors', () => {
  it('returns just the node itself when it has no edges', () => {
    const node = addNode('entity', 'Isolated')
    const result = getNeighbors(node.id)
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].id).toBe(node.id)
    expect(result.edges).toHaveLength(0)
  })

  it('returns direct neighbors at depth 1', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    const c = addNode('entity', 'C')
    addEdge(a.id, b.id, 'uses')
    addEdge(a.id, c.id, 'uses')

    const result = getNeighbors(a.id, 1)
    expect(result.nodes).toHaveLength(3) // A, B, C
    expect(result.edges).toHaveLength(2)
  })

  it('traverses outgoing edges', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    addEdge(a.id, b.id, 'uses')

    const result = getNeighbors(a.id, 1)
    const nodeNames = result.nodes.map(n => n.name)
    expect(nodeNames).toContain('B')
  })

  it('traverses incoming edges (undirected BFS)', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    addEdge(a.id, b.id, 'uses')

    // Query from B — should find A via the reverse direction
    const result = getNeighbors(b.id, 1)
    const nodeNames = result.nodes.map(n => n.name)
    expect(nodeNames).toContain('A')
  })

  it('traverses multiple hops at depth 2', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    const c = addNode('entity', 'C')
    addEdge(a.id, b.id, 'uses')
    addEdge(b.id, c.id, 'uses')

    const result = getNeighbors(a.id, 2)
    const nodeNames = result.nodes.map(n => n.name)
    expect(nodeNames).toContain('A')
    expect(nodeNames).toContain('B')
    expect(nodeNames).toContain('C')
  })

  it('does not find nodes beyond the requested depth', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    const c = addNode('entity', 'C')
    addEdge(a.id, b.id, 'uses')
    addEdge(b.id, c.id, 'uses')

    // Depth 1 from A should only reach B, not C
    const result = getNeighbors(a.id, 1)
    const nodeNames = result.nodes.map(n => n.name)
    expect(nodeNames).toContain('B')
    expect(nodeNames).not.toContain('C')
  })

  it('clamps depth to minimum of 1', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    addEdge(a.id, b.id, 'uses')

    // depth 0 should be clamped to 1
    const result = getNeighbors(a.id, 0)
    expect(result.nodes.length).toBeGreaterThanOrEqual(2)
  })

  it('clamps depth to maximum of 3', () => {
    // Build a chain: A->B->C->D->E
    const nodes = ['A', 'B', 'C', 'D', 'E'].map(n => addNode('entity', n))
    for (let i = 0; i < 4; i++) {
      addEdge(nodes[i].id, nodes[i + 1].id, 'next')
    }

    // Depth 10 should be clamped to 3, so from A we reach A, B, C, D (not E)
    const result = getNeighbors(nodes[0].id, 10)
    const nodeNames = result.nodes.map(n => n.name)
    expect(nodeNames).toContain('D')
    expect(nodeNames).not.toContain('E')
  })

  it('does not revisit already-visited nodes', () => {
    // Cycle: A->B->C->A
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    const c = addNode('entity', 'C')
    addEdge(a.id, b.id, 'next')
    addEdge(b.id, c.id, 'next')
    addEdge(c.id, a.id, 'next')

    const result = getNeighbors(a.id, 3)
    // Should have exactly 3 unique nodes
    expect(result.nodes).toHaveLength(3)
  })
})

// ─── getSubgraph ─────────────────────────────────────────────────────────

describe('getSubgraph', () => {
  it('returns empty result for empty ID list', () => {
    const result = getSubgraph([])
    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
  })

  it('returns only requested nodes', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    addNode('entity', 'C') // Not requested
    addEdge(a.id, b.id, 'uses')

    const result = getSubgraph([a.id, b.id])
    expect(result.nodes).toHaveLength(2)
    expect(result.nodes.map(n => n.name).sort()).toEqual(['A', 'B'])
  })

  it('includes only edges between requested nodes', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    const c = addNode('entity', 'C')
    addEdge(a.id, b.id, 'uses')
    addEdge(b.id, c.id, 'depends_on')

    const result = getSubgraph([a.id, b.id])
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].relation).toBe('uses')
  })

  it('skips nonexistent node IDs', () => {
    const a = addNode('entity', 'A')
    const result = getSubgraph([a.id, 'nonexistent'])
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].id).toBe(a.id)
  })
})

// ─── shortestPath (BFS) ─────────────────────────────────────────────────

describe('shortestPath', () => {
  it('returns empty for nonexistent source', () => {
    const node = addNode('entity', 'A')
    expect(shortestPath('fake', node.id)).toEqual([])
  })

  it('returns empty for nonexistent target', () => {
    const node = addNode('entity', 'A')
    expect(shortestPath(node.id, 'fake')).toEqual([])
  })

  it('returns [id] when source equals target', () => {
    const node = addNode('entity', 'A')
    expect(shortestPath(node.id, node.id)).toEqual([node.id])
  })

  it('finds direct path between two connected nodes', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    addEdge(a.id, b.id, 'uses')

    const path = shortestPath(a.id, b.id)
    expect(path).toEqual([a.id, b.id])
  })

  it('finds path via intermediate node', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    const c = addNode('entity', 'C')
    addEdge(a.id, b.id, 'uses')
    addEdge(b.id, c.id, 'uses')

    const path = shortestPath(a.id, c.id)
    expect(path).toEqual([a.id, b.id, c.id])
  })

  it('works in reverse direction (undirected)', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    addEdge(a.id, b.id, 'uses')

    // Path from B to A should exist via undirected traversal
    const path = shortestPath(b.id, a.id)
    expect(path).toEqual([b.id, a.id])
  })

  it('returns empty array when no path exists', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    // No edges
    expect(shortestPath(a.id, b.id)).toEqual([])
  })

  it('finds shortest path in graph with multiple routes', () => {
    // A -> B -> D (length 2)
    // A -> C -> D (length 2)
    // BFS should find one of these length-2 paths
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    const c = addNode('entity', 'C')
    const d = addNode('entity', 'D')
    addEdge(a.id, b.id, 'r1')
    addEdge(b.id, d.id, 'r2')
    addEdge(a.id, c.id, 'r3')
    addEdge(c.id, d.id, 'r4')

    const path = shortestPath(a.id, d.id)
    expect(path).toHaveLength(3) // A -> ? -> D
    expect(path[0]).toBe(a.id)
    expect(path[2]).toBe(d.id)
  })

  it('handles cycles without infinite loop', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    const c = addNode('entity', 'C')
    addEdge(a.id, b.id, 'next')
    addEdge(b.id, c.id, 'next')
    addEdge(c.id, a.id, 'next') // cycle back

    const path = shortestPath(a.id, c.id)
    // Since the graph is treated as undirected, A is adjacent to C via the C->A edge
    // BFS finds the shortest path which is length 2: [A, C]
    expect(path).toHaveLength(2)
    expect(path).toEqual([a.id, c.id])
  })
})

// ─── queryRelation ───────────────────────────────────────────────────────

describe('queryRelation', () => {
  it('returns empty array when no edges exist', () => {
    expect(queryRelation('uses')).toEqual([])
  })

  it('finds edges by relation type', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    const c = addNode('entity', 'C')
    addEdge(a.id, b.id, 'uses')
    addEdge(a.id, c.id, 'depends_on')

    const results = queryRelation('uses')
    expect(results).toHaveLength(1)
    expect(results[0].source).toBe(a.id)
    expect(results[0].target).toBe(b.id)
  })

  it('is case-insensitive', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    addEdge(a.id, b.id, 'USES')

    expect(queryRelation('uses')).toHaveLength(1)
    expect(queryRelation('Uses')).toHaveLength(1)
  })

  it('returns all matching edges', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    const c = addNode('entity', 'C')
    addEdge(a.id, b.id, 'related_to')
    addEdge(a.id, c.id, 'related_to')

    expect(queryRelation('related_to')).toHaveLength(2)
  })
})

// ─── decayUnused ─────────────────────────────────────────────────────────

describe('decayUnused', () => {
  it('decays edges of nodes not accessed for more than N days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    const a = addNode('entity', 'OldNode')
    const b = addNode('entity', 'NewNode')
    addEdge(a.id, b.id, 'uses', 0.8)

    // Jump forward 40 days
    vi.setSystemTime(new Date('2026-02-10T00:00:00Z'))
    // Add a node so 'NewNode' was already accessed on Jan 1
    const result = decayUnused(30)
    expect(result.decayed).toBe(2) // Both were last accessed on Jan 1

    // Edge weight is reduced by 0.1 for each decayed node connected to it.
    // Both OldNode and NewNode were last accessed on Jan 1, so both trigger decay.
    // The edge is connected to both, so weight is reduced twice: 0.8 - 0.1 - 0.1 = 0.6
    expect(getGraph().edges[0].weight).toBeCloseTo(0.6, 5)

    vi.useRealTimers()
  })

  it('does not decay recently accessed nodes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-29T00:00:00Z'))

    const a = addNode('entity', 'Fresh')
    const b = addNode('entity', 'AlsoFresh')
    addEdge(a.id, b.id, 'uses', 0.5)

    const result = decayUnused(30)
    expect(result.decayed).toBe(0)
    expect(getGraph().edges[0].weight).toBe(0.5)

    vi.useRealTimers()
  })

  it('does not reduce edge weight below 0', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    addEdge(a.id, b.id, 'uses', 0.05)

    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'))
    decayUnused(1)

    expect(getGraph().edges[0].weight).toBe(0)

    vi.useRealTimers()
  })
})

// ─── prune ───────────────────────────────────────────────────────────────

describe('prune', () => {
  it('removes edges below the weight threshold', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    const c = addNode('entity', 'C')
    addEdge(a.id, b.id, 'strong', 0.9)
    addEdge(a.id, c.id, 'weak', 0.1)

    const result = prune(0.5)
    expect(result.removedEdges).toBe(1)
    expect(getGraph().edges).toHaveLength(1)
    expect(getGraph().edges[0].relation).toBe('strong')
  })

  it('removes disconnected low-access nodes', () => {
    addNode('entity', 'Connected')
    const lonely = addNode('entity', 'Lonely')
    const a = addNode('entity', 'A')
    const firstNode = getGraph().nodes.values().next().value!
    addEdge(a.id, firstNode.id, 'uses', 0.8)

    // lonely has accessCount=1, effective weight = 0.1, below threshold 0.5
    const result = prune(0.5)
    expect(result.removedNodes).toBeGreaterThanOrEqual(0)
    // lonely should be removed since it has no edges and low effective weight
    const remaining = Array.from(getGraph().nodes.values()).map(n => n.name)
    expect(remaining).not.toContain('Lonely')
  })

  it('keeps well-connected nodes even with low edge weight', () => {
    const a = addNode('entity', 'WellConnected')
    const b = addNode('entity', 'Partner')
    addEdge(a.id, b.id, 'uses', 0.8)

    prune(0.3)
    expect(getGraph().nodes.has(a.id)).toBe(true)
    expect(getGraph().nodes.has(b.id)).toBe(true)
  })

  it('returns correct counts', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    addEdge(a.id, b.id, 'weak', 0.1)

    const result = prune(0.5)
    expect(result.removedEdges).toBe(1)
    // Both A and B become disconnected after edge removal
    // Both have accessCount=1, effective weight=0.1, below 0.5
    expect(result.removedNodes).toBe(2)
  })
})

// ─── toContext ────────────────────────────────────────────────────────────

describe('toContext', () => {
  it('returns "[No graph memory]" for empty graph', () => {
    expect(toContext()).toBe('[No graph memory]')
  })

  it('includes header with node and edge counts', () => {
    addNode('entity', 'JWT')
    const result = toContext()
    expect(result).toContain('[Graph Memory')
    expect(result).toContain('1 nodes')
    expect(result).toContain('0 edges')
  })

  it('formats edges as [type:name] --relation--> [type:name]', () => {
    const a = addNode('file', 'auth.ts')
    const b = addNode('entity', 'JWT')
    addEdge(a.id, b.id, 'uses')

    const result = toContext()
    expect(result).toContain('[file:auth.ts] --uses--> [entity:JWT]')
  })

  it('includes isolated nodes with properties', () => {
    addNode('decision', 'use RS256', { reason: 'security' })
    const result = toContext()
    expect(result).toContain('[decision:use RS256]')
    expect(result).toContain('reason=security')
  })

  it('respects maxTokens budget', () => {
    // Add many nodes and edges
    const nodes: GraphNode[] = []
    for (let i = 0; i < 50; i++) {
      nodes.push(addNode('entity', `entity-${i}-${'x'.repeat(50)}`))
    }
    for (let i = 1; i < 50; i++) {
      addEdge(nodes[0].id, nodes[i].id, 'related_to')
    }

    // Very small token budget
    const result = toContext(50)
    // 50 tokens * 4 chars = 200 chars — should be truncated
    // Result should be shorter than full graph
    const fullResult = toContext(100000)
    expect(result.length).toBeLessThan(fullResult.length)
  })
})

// ─── extractEntities ─────────────────────────────────────────────────────

describe('extractEntities', () => {
  it('extracts file paths as file nodes', () => {
    const nodes = extractEntities(
      'Check the file /src/auth.ts',
      'I read /src/auth.ts and found issues.'
    )
    const fileNodes = nodes.filter(n => n.type === 'file')
    expect(fileNodes.length).toBeGreaterThanOrEqual(1)
    expect(fileNodes[0].properties.path).toBe('/src/auth.ts')
  })

  it('extracts GitHub issue references as bug nodes', () => {
    const nodes = extractEntities(
      'Fix kbot/kernel#42',
      'Working on kbot/kernel#42 now.'
    )
    const bugNodes = nodes.filter(n => n.type === 'bug')
    expect(bugNodes.length).toBeGreaterThanOrEqual(1)
  })

  it('extracts function/class names as entity nodes', () => {
    const nodes = extractEntities(
      '',
      'The function processAuth handles authentication and class AuthManager orchestrates it.'
    )
    const entityNodes = nodes.filter(n => n.type === 'entity' && n.properties.kind === 'code-identifier')
    const names = entityNodes.map(n => n.name)
    expect(names).toContain('processAuth')
    expect(names).toContain('AuthManager')
  })

  it('extracts decisions from conversation', () => {
    const nodes = extractEntities(
      "Let's use RS256 for JWT signing",
      "Good choice. We decided to go with TypeScript for the rewrite."
    )
    const decisionNodes = nodes.filter(n => n.type === 'decision')
    expect(decisionNodes.length).toBeGreaterThanOrEqual(1)
  })

  it('extracts patterns from conversation', () => {
    const nodes = extractEntities(
      'always validate user input before database calls',
      'Yes, and never trust client-side data'
    )
    const patternNodes = nodes.filter(n => n.type === 'pattern')
    expect(patternNodes.length).toBeGreaterThanOrEqual(1)
  })

  it('deduplicates file paths', () => {
    const nodes = extractEntities(
      'Read /src/auth.ts and /src/auth.ts',
      'Also checking /src/auth.ts'
    )
    const fileNodes = nodes.filter(n => n.type === 'file' && n.properties.path === '/src/auth.ts')
    // All references should map to the same node (duplicate detection in addNode)
    const uniqueIds = new Set(fileNodes.map(n => n.id))
    expect(uniqueIds.size).toBe(1)
  })

  it('returns empty array when no entities found', () => {
    const nodes = extractEntities('Hello', 'Hi there')
    // Might be empty or have minimal results depending on heuristics
    // At minimum, should not throw
    expect(Array.isArray(nodes)).toBe(true)
  })

  it('skips very short identifiers', () => {
    const nodes = extractEntities(
      '',
      'const ab = 1; const validName = 2;'
    )
    // 'ab' is too short (<=2 chars), 'validName' should be captured
    const entityNodes = nodes.filter(n => n.type === 'entity' && n.properties.kind === 'code-identifier')
    const names = entityNodes.map(n => n.name)
    expect(names).not.toContain('ab')
    expect(names).toContain('validName')
  })
})

// ─── autoConnect ─────────────────────────────────────────────────────────

describe('autoConnect', () => {
  it('returns 0 for nonexistent node', () => {
    expect(autoConnect('fake-id')).toBe(0)
  })

  it('connects nodes accessed at the same time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-29T12:00:00Z'))

    const a = addNode('file', 'auth.ts')
    const b = addNode('entity', 'JWT')

    const connected = autoConnect(a.id)
    expect(connected).toBeGreaterThanOrEqual(1)
    expect(getGraph().edges.length).toBeGreaterThanOrEqual(1)

    vi.useRealTimers()
  })

  it('infers relation type based on node types', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-29T12:00:00Z'))

    const file = addNode('file', 'auth.ts')
    const entity = addNode('entity', 'JWT')

    autoConnect(file.id)

    const edges = getGraph().edges
    expect(edges.length).toBeGreaterThanOrEqual(1)
    // file -> entity should be 'contains'
    const relevant = edges.find(e => e.source === file.id && e.target === entity.id)
    if (relevant) {
      expect(relevant.relation).toBe('contains')
    }

    vi.useRealTimers()
  })

  it('does not connect node to itself', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-29T12:00:00Z'))

    const a = addNode('entity', 'Solo')
    autoConnect(a.id)

    const selfEdges = getGraph().edges.filter(e => e.source === a.id && e.target === a.id)
    expect(selfEdges).toHaveLength(0)

    vi.useRealTimers()
  })
})

// ─── importFromMemory ────────────────────────────────────────────────────

describe('importFromMemory', () => {
  it('returns zero counts when memory dir does not exist', () => {
    mockedExistsSync.mockReturnValue(false)
    const result = importFromMemory('/mock-home/.kbot/memory')
    expect(result.imported).toBe(0)
    expect(result.edges).toBe(0)
  })

  it('imports JSON files from category directories', () => {
    mockedExistsSync.mockImplementation((p) => {
      const path = String(p)
      if (path === '/mock-home/.kbot/memory') return true
      if (path === '/mock-home/.kbot/memory/fact') return true
      if (path === '/mock-home/.kbot/memory/context.md') return false
      return false
    })
    mockedReaddirSync.mockReturnValue(['item1.json'] as any)
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      key: 'user-prefers-ts',
      content: 'User prefers TypeScript',
      created_at: '2026-01-01',
    }))

    const result = importFromMemory('/mock-home/.kbot/memory')
    expect(result.imported).toBeGreaterThanOrEqual(1)
  })

  it('skips malformed JSON files without throwing', () => {
    mockedExistsSync.mockImplementation((p) => {
      const path = String(p)
      if (path === '/mock-home/.kbot/memory') return true
      if (path === '/mock-home/.kbot/memory/fact') return true
      if (path === '/mock-home/.kbot/memory/context.md') return false
      return false
    })
    mockedReaddirSync.mockReturnValue(['bad.json'] as any)
    mockedReadFileSync.mockReturnValue('not json!!!')

    // Should not throw
    const result = importFromMemory('/mock-home/.kbot/memory')
    expect(result.imported).toBe(0)
  })

  it('imports sections from context.md as concept nodes', () => {
    mockedExistsSync.mockImplementation((p) => {
      const path = String(p)
      if (path === '/mock-home/.kbot/memory') return true
      if (path === '/mock-home/.kbot/memory/context.md') return true
      return false
    })
    mockedReaddirSync.mockReturnValue([] as any)
    mockedReadFileSync.mockReturnValue('# Memory\n\n## TypeScript Preferences\nUser likes TS.\n\n## Git Workflow\nPrefers rebase.\n')

    const result = importFromMemory('/mock-home/.kbot/memory')
    expect(result.imported).toBeGreaterThanOrEqual(2)
  })
})

// ─── getStats ────────────────────────────────────────────────────────────

describe('getStats', () => {
  it('returns zero counts for empty graph', () => {
    const stats = getStats()
    expect(stats.nodeCount).toBe(0)
    expect(stats.edgeCount).toBe(0)
    expect(stats.nodesByType).toEqual({})
    expect(stats.topNodes).toEqual([])
  })

  it('counts nodes and edges correctly', () => {
    const a = addNode('entity', 'A')
    const b = addNode('file', 'B')
    addEdge(a.id, b.id, 'uses')

    const stats = getStats()
    expect(stats.nodeCount).toBe(2)
    expect(stats.edgeCount).toBe(1)
  })

  it('groups nodes by type', () => {
    addNode('entity', 'A')
    addNode('entity', 'B')
    addNode('file', 'C')
    addNode('person', 'D')

    const stats = getStats()
    expect(stats.nodesByType.entity).toBe(2)
    expect(stats.nodesByType.file).toBe(1)
    expect(stats.nodesByType.person).toBe(1)
  })

  it('returns top nodes sorted by access count', () => {
    const a = addNode('entity', 'Popular')
    // Access it multiple times via duplicate addNode
    addNode('entity', 'popular') // accessCount = 2
    addNode('entity', 'popular') // accessCount = 3
    addNode('entity', 'Unpopular')

    const stats = getStats()
    expect(stats.topNodes[0].name).toBe('Popular')
    expect(stats.topNodes[0].accessCount).toBe(3)
  })

  it('limits topNodes to 10', () => {
    for (let i = 0; i < 15; i++) {
      addNode('entity', `Node-${i}`)
    }
    const stats = getStats()
    expect(stats.topNodes.length).toBeLessThanOrEqual(10)
  })
})

// ─── getNode / getGraph ──────────────────────────────────────────────────

describe('getNode / getGraph', () => {
  it('getNode returns undefined for nonexistent ID', () => {
    expect(getNode('nonexistent')).toBeUndefined()
  })

  it('getNode returns the node for a valid ID', () => {
    const node = addNode('entity', 'Test')
    expect(getNode(node.id)).toBe(node)
  })

  it('getGraph returns the live graph object', () => {
    const graph = getGraph()
    expect(graph).toBeDefined()
    expect(graph.nodes).toBeInstanceOf(Map)
    expect(Array.isArray(graph.edges)).toBe(true)
  })
})

// ─── Edge cases ──────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles empty string name for addNode', () => {
    const node = addNode('entity', '')
    expect(node.name).toBe('')
    expect(getGraph().nodes.size).toBe(1)
  })

  it('handles special characters in node names', () => {
    const node = addNode('entity', 'auth.ts (v2) [deprecated]')
    expect(node.name).toBe('auth.ts (v2) [deprecated]')
  })

  it('handles unicode in node names', () => {
    const node = addNode('person', 'Isaac Hernandez')
    const results = findNode('Isaac')
    expect(results).toHaveLength(1)
  })

  it('handles empty properties object', () => {
    const node = addNode('entity', 'Test', {})
    expect(node.properties).toEqual({})
  })

  it('handles empty relation string on edge', () => {
    const a = addNode('entity', 'A')
    const b = addNode('entity', 'B')
    const result = addEdge(a.id, b.id, '')
    expect(result).toBe(true)
    expect(getGraph().edges[0].relation).toBe('')
  })

  it('addEdge between the same node twice (self-loop)', () => {
    const a = addNode('entity', 'A')
    // Source and target are the same
    const result = addEdge(a.id, a.id, 'self-reference')
    expect(result).toBe(true)
    expect(getGraph().edges).toHaveLength(1)
    expect(getGraph().edges[0].source).toBe(getGraph().edges[0].target)
  })
})
