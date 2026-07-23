import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileStoryboard } from './shot-compiler.mjs'
import { auditCreativeGraph, compileCreativeGraph } from './creative-graph-compiler.mjs'

const storyboard = fs.readFileSync(path.resolve('docs/video/STORYBOARD.cinematic.example.md'), 'utf8')

describe('creative graph compiler', () => {
  const graph = compileCreativeGraph(compileStoryboard(storyboard, { candidates: 3 }))

  it('turns each generated shot into keyframe, candidate, critic, and selection stages', () => {
    const shotOne = graph.nodes.filter((item) => item.lineage?.shotId === 'shot-01')
    expect(shotOne.filter((item) => item.lineage.role === 'keyframe')).toHaveLength(1)
    expect(shotOne.filter((item) => item.lineage.role === 'candidate')).toHaveLength(3)
    expect(shotOne.filter((item) => item.lineage.role === 'critic')).toHaveLength(1)
    expect(shotOne.filter((item) => item.lineage.role === 'selection')).toHaveLength(1)
  })

  it('preserves rejected alternatives and requires a receipt', () => {
    expect(graph.policy.preserveRejectedAlternatives).toBe(true)
    expect(graph.policy.receiptRequired).toBe(true)
    expect(graph.nodes.find((item) => item.id === 'film-master').lineage.receiptRequired).toBe(true)
  })

  it('creates auditable candidate batches with human spend approval', () => {
    expect(graph.batches).toHaveLength(3)
    expect(graph.batches.every((batch) => batch.nodeIds.length === 3)).toBe(true)
    expect(graph.batches.every((batch) => batch.approval === 'human-required')).toBe(true)
  })

  it('produces an acyclic graph with complete lineage', () => {
    expect(auditCreativeGraph(graph)).toEqual({ ok: true, findings: [] })
  })

  it('detects a broken provenance graph', () => {
    const broken = structuredClone(graph)
    delete broken.nodes[0].lineage
    broken.edges.push({ id: 'bad', from: 'missing', to: 'film-master', role: 'bad' })
    const audit = auditCreativeGraph(broken)
    expect(audit.ok).toBe(false)
    expect(audit.findings.map((item) => item.code)).toEqual(expect.arrayContaining(['missing-lineage', 'dangling-edge']))
  })
})
