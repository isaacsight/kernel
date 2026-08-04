import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileStoryboard } from './shot-compiler.mjs'

function stableId(...parts) {
  return parts.join('-').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function node({ id, kind, x, y, title, content, model, lineage }) {
  return { id, kind, x, y, title, content, ...(model ? { model } : {}), status: 'idle', lineage }
}

function edge(from, to, role) {
  return { id: stableId('edge', from, to, role), from, to, role }
}

export function compileCreativeGraph(plan) {
  const nodes = []
  const edges = []
  const batches = []
  const decisions = []

  const briefId = 'film-brief'
  const continuityId = 'continuity-constitution'
  const soundId = 'sound-direction'
  nodes.push(node({
    id: briefId,
    kind: 'prompt',
    x: 80,
    y: 100,
    title: 'Film brief',
    content: plan.source,
    model: 'Claude 4.5',
    lineage: { role: 'brief', origin: 'shot-compiler', immutable: true },
  }))
  nodes.push(node({
    id: continuityId,
    kind: 'note',
    x: 80,
    y: 390,
    title: 'Continuity constitution',
    content: JSON.stringify(plan.globals.continuity, null, 2),
    model: 'Manual note',
    lineage: { role: 'continuity', origin: briefId, immutable: true },
  }))
  nodes.push(node({
    id: soundId,
    kind: 'agent',
    x: 1540,
    y: 80,
    title: 'Sound director',
    content: `Design environment, material, and punctuation layers for the film rhythm: ${plan.globals.rhythm || 'derive from the approved edit'}. Sound may lead hero events by 2–6 frames.`,
    model: 'Director',
    lineage: { role: 'sound-direction', origin: briefId, approval: 'required' },
  }))
  edges.push(edge(briefId, soundId, 'brief'))

  const selectedShotIds = []
  for (const [shotIndex, shot] of plan.shots.entries()) {
    const y = 80 + shotIndex * 360
    const baseLineage = {
      shotId: shot.shotId,
      mode: shot.mode,
      origin: briefId,
      continuitySource: continuityId,
      estimatedUsd: shot.estimatedUsd.batch,
    }

    if (shot.route.renderer === 'hyperframes') {
      const compId = stableId(shot.shotId, 'hyperframes')
      nodes.push(node({
        id: compId,
        kind: 'agent',
        x: 480,
        y,
        title: `${shot.shotId} · deterministic composition`,
        content: `${shot.handoff}\n\nShot direction:\n${shot.title}`,
        model: 'Coder Agent',
        lineage: { ...baseLineage, role: 'composition', approval: 'review' },
      }))
      edges.push(edge(briefId, compId, 'brief'), edge(continuityId, compId, 'continuity'))
      selectedShotIds.push(compId)
      decisions.push({ shotId: shot.shotId, kind: 'deterministic', nodeId: compId, rule: shot.route.reason })
      continue
    }

    const keyframeId = stableId(shot.shotId, 'keyframe')
    nodes.push(node({
      id: keyframeId,
      kind: 'image',
      x: 440,
      y,
      title: `${shot.shotId} · approved keyframe`,
      content: `${shot.inputs.keyframePrompt}\n\nAvoid: ${shot.inputs.negativePrompt}`,
      model: 'GPT Image',
      lineage: { ...baseLineage, role: 'keyframe', approval: 'required-before-motion' },
    }))
    edges.push(edge(briefId, keyframeId, 'brief'), edge(continuityId, keyframeId, 'continuity'))

    const batchId = stableId(shot.shotId, 'motion-batch')
    const candidateIds = []
    for (const candidate of shot.candidates) {
      const candidateId = stableId(shot.shotId, 'candidate', String(candidate.index + 1))
      candidateIds.push(candidateId)
      nodes.push(node({
        id: candidateId,
        kind: 'video',
        x: 800,
        y: y + candidate.index * 72,
        title: `${shot.shotId} · ${candidate.id}`,
        content: candidate.prompt,
        model: shot.route.modelLabel,
        lineage: {
          ...baseLineage,
          role: 'candidate',
          batchId,
          candidateId: candidate.id,
          candidateIndex: candidate.index,
          approval: 'paid-generation',
          estimatedUsd: shot.estimatedUsd.perCandidate,
        },
      }))
      edges.push(edge(keyframeId, candidateId, 'start-frame'), edge(continuityId, candidateId, 'continuity'))
    }
    batches.push({
      id: batchId,
      shotId: shot.shotId,
      strategy: 'parallel creative directions',
      nodeIds: candidateIds,
      estimatedUsd: shot.estimatedUsd.batch,
      approval: 'human-required',
    })

    const criticId = stableId(shot.shotId, 'critic')
    const winnerId = stableId(shot.shotId, 'winner')
    nodes.push(node({
      id: criticId,
      kind: 'agent',
      x: 1160,
      y,
      title: `${shot.shotId} · blind critic`,
      content: `Reject any hard failure first. Then score surviving candidates with this rubric:\n${JSON.stringify(shot.review, null, 2)}\nDo not reward spectacle that violates the brief or continuity constitution. Return scores, evidence, and one winner.`,
      model: 'VFX Supervisor',
      lineage: { ...baseLineage, role: 'critic', blindToModel: true, approval: 'automatic-review' },
    }))
    for (const candidateId of candidateIds) edges.push(edge(candidateId, criticId, 'candidate-for-review'))
    edges.push(edge(continuityId, criticId, 'continuity-standard'))

    nodes.push(node({
      id: winnerId,
      kind: 'output',
      x: 1500,
      y: y + 180,
      title: `${shot.shotId} · selected take`,
      content: `Promote only a candidate scoring at least ${shot.review.passingScore}/100 with no hard reject. Preserve the critic's evidence and rejected alternatives in the receipt.`,
      model: 'Compiled result',
      lineage: { ...baseLineage, role: 'selection', approval: 'human-final', threshold: shot.review.passingScore },
    }))
    edges.push(edge(criticId, winnerId, 'decision'))
    for (const candidateId of candidateIds) edges.push(edge(candidateId, winnerId, 'candidate-lineage'))
    selectedShotIds.push(winnerId)
    decisions.push({ shotId: shot.shotId, kind: 'competitive-selection', criticNodeId: criticId, winnerNodeId: winnerId, candidates: candidateIds })
  }

  const masterId = 'film-master'
  nodes.push(node({
    id: masterId,
    kind: 'output',
    x: 1880,
    y: 320,
    title: 'Film master and receipt',
    content: 'Assemble approved shots and sound in story order. Emit the master plus a receipt containing every source, prompt, model route, cost, rejection, score, approval, and finishing decision.',
    model: 'Compiled result',
    lineage: { role: 'master', origin: briefId, approval: 'human-final', receiptRequired: true },
  }))
  for (const selectedId of selectedShotIds) edges.push(edge(selectedId, masterId, 'approved-shot'))
  edges.push(edge(soundId, masterId, 'sound-direction'))

  return {
    version: 1,
    projectName: plan.source,
    nodes,
    edges,
    view: { x: 0, y: 0, zoom: 0.7 },
    batches,
    decisions,
    policy: {
      modelsAreStepsNotDestinations: true,
      preserveRejectedAlternatives: true,
      paidGenerationRequiresApproval: true,
      keyframesBeforeMotion: true,
      blindCriticToModelIdentity: true,
      receiptRequired: true,
    },
  }
}

export function auditCreativeGraph(graph) {
  const findings = []
  const nodeIds = new Set(graph.nodes.map((item) => item.id))
  const indegree = new Map(graph.nodes.map((item) => [item.id, 0]))
  const children = new Map(graph.nodes.map((item) => [item.id, []]))
  for (const item of graph.edges) {
    if (!nodeIds.has(item.from) || !nodeIds.has(item.to)) findings.push({ level: 'error', code: 'dangling-edge', edgeId: item.id })
    else {
      indegree.set(item.to, (indegree.get(item.to) || 0) + 1)
      children.get(item.from).push(item.to)
    }
  }
  const queue = graph.nodes.filter((item) => (indegree.get(item.id) || 0) === 0).map((item) => item.id)
  let visited = 0
  while (queue.length) {
    const id = queue.shift()
    visited += 1
    for (const child of children.get(id) || []) {
      indegree.set(child, indegree.get(child) - 1)
      if (indegree.get(child) === 0) queue.push(child)
    }
  }
  if (visited !== graph.nodes.length) findings.push({ level: 'error', code: 'cycle' })
  if (!graph.nodes.every((item) => item.lineage?.role)) findings.push({ level: 'error', code: 'missing-lineage' })
  if (!graph.policy?.receiptRequired) findings.push({ level: 'error', code: 'missing-receipt-policy' })
  for (const batch of graph.batches || []) {
    if (batch.nodeIds.length < 2) findings.push({ level: 'warning', code: 'single-candidate-batch', batchId: batch.id })
    if (batch.nodeIds.some((id) => !nodeIds.has(id))) findings.push({ level: 'error', code: 'missing-batch-node', batchId: batch.id })
  }
  return { ok: !findings.some((item) => item.level === 'error'), findings }
}

function runCli() {
  const args = process.argv.slice(2)
  const input = args.find((arg) => !arg.startsWith('--'))
  const outputArg = args.find((arg) => arg.startsWith('--output='))
  if (!input) {
    console.error('Usage: node tools/creative-graph-compiler.mjs <STORYBOARD.md> [--output=creative-graph.json]')
    process.exitCode = 2
    return
  }
  try {
    const markdown = fs.readFileSync(input, 'utf8')
    const graph = compileCreativeGraph(compileStoryboard(markdown))
    const audit = auditCreativeGraph(graph)
    if (!audit.ok) throw new Error(`Creative graph audit failed: ${JSON.stringify(audit.findings)}`)
    const output = outputArg ? path.resolve(outputArg.slice('--output='.length)) : null
    const json = `${JSON.stringify(graph, null, 2)}\n`
    if (output) {
      fs.writeFileSync(output, json)
      console.log(`Compiled ${graph.nodes.length} nodes, ${graph.edges.length} links, and ${graph.batches.length} candidate batches to ${output}`)
    } else process.stdout.write(json)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

const cliPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (cliPath === fileURLToPath(import.meta.url)) runCli()
