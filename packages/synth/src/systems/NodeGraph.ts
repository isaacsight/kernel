// SYNTH — Node-Based Behavior System
//
// A lightweight node graph that lets any game system be composed from
// connected nodes. This is the Houdini philosophy applied to game logic:
// behaviors are networks of small, reusable transforms.
//
// Nodes evaluate inputs and produce outputs. Graphs connect node outputs
// to node inputs via edges. Terminal nodes (those with no outgoing edges)
// produce the graph's final outputs.
//
// All client-side, zero API calls, zero cost.

import { noise } from './NoiseField'
import type { Mood } from './Atmosphere'

// ── Game Context (passed to all nodes) ────────────────────────────────

export interface GameContext {
  time: number          // elapsed seconds
  deltaMs: number       // frame delta in ms
  playerPos: { x: number; y: number }
  partnerPos: { x: number; y: number }
  playerHp: number
  playerMaxHp: number
  partnerHp: number
  partnerMaxHp: number
  enemyCount: number
  directorTension: number
  currentMood: Mood
  killStreak: number
  /** Per-entity context — set before evaluating per-entity graphs */
  entityHp?: number
  entityMaxHp?: number
  entityX?: number
  entityY?: number
  packSize?: number
  combatHeat?: number
}

// ── Graph Node Interface ──────────────────────────────────────────────

export interface GraphNode {
  id: string
  type: string
  params: Record<string, number>
  evaluate(inputs: Record<string, number>, context: GameContext): Record<string, number>
}

// ── Edge (connection between nodes) ───────────────────────────────────

interface Edge {
  fromNode: string
  fromOutput: string
  toNode: string
  toInput: string
}

// ── Built-in Node Types ──────────────────────────────────────────────

function createNoiseNode(id: string, speed: number = 1, seed: number = 0): GraphNode {
  return {
    id,
    type: 'noise',
    params: { speed, seed },
    evaluate(_inputs, context) {
      const val = noise.sample2D(context.time * speed, seed * 73.7)
      return { out: val }
    },
  }
}

function createThresholdNode(id: string, threshold: number = 0.5): GraphNode {
  return {
    id,
    type: 'threshold',
    params: { threshold },
    evaluate(inputs) {
      const val = inputs['in'] ?? 0
      return { out: val > threshold ? 1 : 0 }
    },
  }
}

function createLerpNode(id: string, factor: number = 0.5): GraphNode {
  return {
    id,
    type: 'lerp',
    params: { factor },
    evaluate(inputs) {
      const a = inputs['a'] ?? 0
      const b = inputs['b'] ?? 0
      const f = inputs['factor'] ?? factor
      return { out: a + (b - a) * f }
    },
  }
}

function createClampNode(id: string, min: number = 0, max: number = 1): GraphNode {
  return {
    id,
    type: 'clamp',
    params: { min, max },
    evaluate(inputs) {
      const val = inputs['in'] ?? 0
      return { out: Math.max(min, Math.min(max, val)) }
    },
  }
}

function createMultiplyNode(id: string, scale: number = 1): GraphNode {
  return {
    id,
    type: 'multiply',
    params: { scale },
    evaluate(inputs) {
      const a = inputs['a'] ?? 0
      const b = inputs['b'] ?? scale
      return { out: a * b }
    },
  }
}

function createSineNode(id: string, frequency: number = 1, phase: number = 0): GraphNode {
  return {
    id,
    type: 'sine',
    params: { frequency, phase },
    evaluate(inputs, context) {
      const input = inputs['in'] ?? context.time
      return { out: Math.sin(input * frequency + phase) }
    },
  }
}

function createTimerNode(id: string, period: number = 10): GraphNode {
  return {
    id,
    type: 'timer',
    params: { period },
    evaluate(_inputs, context) {
      // Sawtooth wave: 0-1 over period
      return { out: (context.time % period) / period }
    },
  }
}

function createHealthRatioNode(id: string, target: 'player' | 'partner' | 'entity' = 'player'): GraphNode {
  return {
    id,
    type: 'health_ratio',
    params: {},
    evaluate(_inputs, context) {
      switch (target) {
        case 'player':
          return { out: context.playerMaxHp > 0 ? context.playerHp / context.playerMaxHp : 0 }
        case 'partner':
          return { out: context.partnerMaxHp > 0 ? context.partnerHp / context.partnerMaxHp : 0 }
        case 'entity':
          return { out: (context.entityMaxHp ?? 1) > 0 ? (context.entityHp ?? 0) / (context.entityMaxHp ?? 1) : 0 }
      }
    },
  }
}

function createDistanceNode(id: string, targetA: 'player' | 'partner' | 'entity' = 'player', targetB: 'player' | 'partner' | 'entity' = 'entity'): GraphNode {
  return {
    id,
    type: 'distance',
    params: {},
    evaluate(_inputs, context) {
      const getPos = (t: string) => {
        switch (t) {
          case 'player': return context.playerPos
          case 'partner': return context.partnerPos
          case 'entity': return { x: context.entityX ?? 0, y: context.entityY ?? 0 }
          default: return { x: 0, y: 0 }
        }
      }
      const a = getPos(targetA)
      const b = getPos(targetB)
      const dx = a.x - b.x
      const dy = a.y - b.y
      return { out: Math.sqrt(dx * dx + dy * dy) }
    },
  }
}

function createMoodNode(id: string): GraphNode {
  return {
    id,
    type: 'mood',
    params: {},
    evaluate(_inputs, context) {
      // Map moods to numeric values
      const moodValues: Record<string, number> = {
        calm: 0.2,
        aggressive: 0.6,
        afraid: 0.8,
        confident: 0.3,
        desperate: 1.0,
      }
      return { out: moodValues[context.currentMood] ?? 0.5 }
    },
  }
}

function createTensionNode(id: string): GraphNode {
  return {
    id,
    type: 'tension',
    params: {},
    evaluate(_inputs, context) {
      return { out: context.directorTension }
    },
  }
}

function createRandomWalkNode(id: string, speed: number = 0.3, scale: number = 1): GraphNode {
  return {
    id,
    type: 'random_walk',
    params: { speed, scale },
    evaluate(_inputs, context) {
      const walk = noise.randomWalk(id.length * 17.3, context.time * speed, scale)
      return { x: walk.x, y: walk.y, out: (walk.x + walk.y) * 0.5 }
    },
  }
}

function createConstantNode(id: string, value: number): GraphNode {
  return {
    id,
    type: 'constant',
    params: { value },
    evaluate() {
      return { out: value }
    },
  }
}

function createAddNode(id: string): GraphNode {
  return {
    id,
    type: 'add',
    params: {},
    evaluate(inputs) {
      const a = inputs['a'] ?? 0
      const b = inputs['b'] ?? 0
      return { out: a + b }
    },
  }
}

function createInvertNode(id: string): GraphNode {
  return {
    id,
    type: 'invert',
    params: {},
    evaluate(inputs) {
      return { out: 1 - (inputs['in'] ?? 0) }
    },
  }
}

function createPackSizeNode(id: string): GraphNode {
  return {
    id,
    type: 'pack_size',
    params: {},
    evaluate(_inputs, context) {
      return { out: context.packSize ?? context.enemyCount }
    },
  }
}

function createCombatHeatNode(id: string): GraphNode {
  return {
    id,
    type: 'combat_heat',
    params: {},
    evaluate(_inputs, context) {
      return { out: context.combatHeat ?? 0 }
    },
  }
}

function createKillStreakNode(id: string): GraphNode {
  return {
    id,
    type: 'kill_streak',
    params: {},
    evaluate(_inputs, context) {
      return { out: Math.min(1, context.killStreak / 10) }
    },
  }
}

function createEnemyCountNode(id: string): GraphNode {
  return {
    id,
    type: 'enemy_count',
    params: {},
    evaluate(_inputs, context) {
      return { out: Math.min(1, context.enemyCount / 8) }
    },
  }
}

// ── Node Graph ──────────────────────────────────────────────────────

export class NodeGraph {
  private nodes: Map<string, GraphNode> = new Map()
  private edges: Edge[] = []
  private evaluationOrder: string[] = []
  private dirty = true

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node)
    this.dirty = true
  }

  connect(fromNode: string, fromOutput: string, toNode: string, toInput: string): void {
    this.edges.push({ fromNode, fromOutput, toNode, toInput })
    this.dirty = true
  }

  /**
   * Evaluate the entire graph and return all node outputs.
   * Uses topological sort for correct evaluation order.
   */
  evaluate(context: GameContext): Record<string, number> {
    if (this.dirty) {
      this.evaluationOrder = this.topologicalSort()
      this.dirty = false
    }

    // Store outputs per node
    const nodeOutputs: Map<string, Record<string, number>> = new Map()

    for (const nodeId of this.evaluationOrder) {
      const node = this.nodes.get(nodeId)
      if (!node) continue

      // Gather inputs from connected edges
      const inputs: Record<string, number> = {}
      for (const edge of this.edges) {
        if (edge.toNode === nodeId) {
          const sourceOutputs = nodeOutputs.get(edge.fromNode)
          if (sourceOutputs) {
            inputs[edge.toInput] = sourceOutputs[edge.fromOutput] ?? 0
          }
        }
      }

      // Evaluate node
      const outputs = node.evaluate(inputs, context)
      nodeOutputs.set(nodeId, outputs)
    }

    // Collect all terminal outputs (nodes that are not sources for any edge)
    const sourceNodes = new Set(this.edges.map(e => e.fromNode))
    const result: Record<string, number> = {}

    for (const [nodeId, outputs] of nodeOutputs) {
      // Include nodes that have no outgoing edges (terminal)
      // OR include all nodes (for flexibility — prefix with node id)
      if (!sourceNodes.has(nodeId)) {
        for (const [key, value] of Object.entries(outputs)) {
          result[`${nodeId}.${key}`] = value
        }
      }
    }

    // Also collect by a simpler key for the last node in evaluation order
    const lastNodeId = this.evaluationOrder[this.evaluationOrder.length - 1]
    if (lastNodeId) {
      const lastOutputs = nodeOutputs.get(lastNodeId)
      if (lastOutputs) {
        for (const [key, value] of Object.entries(lastOutputs)) {
          result[key] = value
        }
      }
    }

    return result
  }

  private topologicalSort(): string[] {
    const inDegree: Map<string, number> = new Map()
    for (const node of this.nodes.keys()) {
      inDegree.set(node, 0)
    }
    for (const edge of this.edges) {
      inDegree.set(edge.toNode, (inDegree.get(edge.toNode) ?? 0) + 1)
    }

    const queue: string[] = []
    for (const [node, degree] of inDegree) {
      if (degree === 0) queue.push(node)
    }

    const sorted: string[] = []
    while (queue.length > 0) {
      const node = queue.shift()!
      sorted.push(node)
      for (const edge of this.edges) {
        if (edge.fromNode === node) {
          const deg = (inDegree.get(edge.toNode) ?? 1) - 1
          inDegree.set(edge.toNode, deg)
          if (deg === 0) queue.push(edge.toNode)
        }
      }
    }

    // Add any unconnected nodes at the end
    for (const node of this.nodes.keys()) {
      if (!sorted.includes(node)) sorted.push(node)
    }

    return sorted
  }
}

// ══════════════════════════════════════════════════════════════════════
// PRE-BUILT GRAPHS — Real game behaviors composed from nodes
// ══════════════════════════════════════════════════════════════════════

// ── Graph 1: Enemy Aggression ────────────────────────────────────────
// Controls how aggressive each enemy is.
// Inputs: player distance, player HP ratio, enemy HP ratio, pack size,
//         director tension, noise jitter
// Output: aggression score (0-1)
//
// High aggression = faster chase, more frequent attacks, later retreat.
// Low aggression = cautious, keeps distance, retreats earlier.

export function createEnemyAggressionGraph(): NodeGraph {
  const graph = new NodeGraph()

  // Input nodes: read from game context
  graph.addNode(createDistanceNode('distance', 'player', 'entity'))
  graph.addNode(createHealthRatioNode('player_hp', 'player'))
  graph.addNode(createHealthRatioNode('enemy_hp', 'entity'))
  graph.addNode(createPackSizeNode('pack_size'))
  graph.addNode(createTensionNode('tension'))
  graph.addNode(createNoiseNode('jitter', 0.5, 42))
  graph.addNode(createCombatHeatNode('heat'))

  // Threshold: engage range (distance < 200 normalized = 1)
  graph.addNode(createInvertNode('close_enough'))
  // Normalize distance to 0-1 (200px = threshold)
  graph.addNode(createMultiplyNode('dist_norm', 1 / 200))
  graph.addNode(createClampNode('dist_clamped', 0, 1))

  // Pack bonus: more enemies = braver
  graph.addNode(createMultiplyNode('pack_bonus', 0.15))

  // Low player HP makes enemies bolder
  graph.addNode(createInvertNode('player_weakness'))
  graph.addNode(createMultiplyNode('weakness_factor', 0.2))

  // Enemy self-preservation: low HP reduces aggression
  graph.addNode(createMultiplyNode('self_preserve', 0.3))

  // Tension boosts aggression
  graph.addNode(createMultiplyNode('tension_factor', 0.2))

  // Noise jitter for timing variation (+/- 10%)
  graph.addNode(createMultiplyNode('jitter_scale', 0.1))

  // Final blend: sum weighted factors and clamp
  graph.addNode(createAddNode('sum1'))
  graph.addNode(createAddNode('sum2'))
  graph.addNode(createAddNode('sum3'))
  graph.addNode(createAddNode('sum4'))
  graph.addNode(createClampNode('aggression', 0, 1))

  // Wiring
  // Distance normalization
  graph.connect('distance', 'out', 'dist_norm', 'a')
  graph.connect('dist_norm', 'out', 'dist_clamped', 'in')
  graph.connect('dist_clamped', 'out', 'close_enough', 'in')

  // Pack bonus
  graph.connect('pack_size', 'out', 'pack_bonus', 'a')

  // Player weakness
  graph.connect('player_hp', 'out', 'player_weakness', 'in')
  graph.connect('player_weakness', 'out', 'weakness_factor', 'a')

  // Self preservation
  graph.connect('enemy_hp', 'out', 'self_preserve', 'a')

  // Tension
  graph.connect('tension', 'out', 'tension_factor', 'a')

  // Jitter
  graph.connect('jitter', 'out', 'jitter_scale', 'a')

  // Sum: closeness + pack_bonus
  graph.connect('close_enough', 'out', 'sum1', 'a')
  graph.connect('pack_bonus', 'out', 'sum1', 'b')

  // + weakness + self_preservation
  graph.connect('sum1', 'out', 'sum2', 'a')
  graph.connect('weakness_factor', 'out', 'sum2', 'b')

  // + tension
  graph.connect('sum2', 'out', 'sum3', 'a')
  graph.connect('tension_factor', 'out', 'sum3', 'b')

  // + jitter
  graph.connect('sum3', 'out', 'sum4', 'a')
  graph.connect('jitter_scale', 'out', 'sum4', 'b')

  // Final clamp
  graph.connect('sum4', 'out', 'aggression', 'in')

  return graph
}

// ── Graph 2: Atmosphere ──────────────────────────────────────────────
// Drives the mood/atmosphere procedurally.
// Outputs a mood vector: 5 floats (calm, aggressive, afraid, confident, desperate)
// that sum to approximately 1.

export function createAtmosphereGraph(): NodeGraph {
  const graph = new NodeGraph()

  // Input nodes
  graph.addNode(createCombatHeatNode('heat'))
  graph.addNode(createHealthRatioNode('player_hp', 'player'))
  graph.addNode(createHealthRatioNode('partner_hp', 'partner'))
  graph.addNode(createTensionNode('tension'))
  graph.addNode(createEnemyCountNode('enemy_count'))
  graph.addNode(createNoiseNode('flow_noise', 0.2, 7))
  graph.addNode(createSineNode('breath', 0.15, 0))     // slow breathing cycle
  graph.addNode(createTimerNode('tension_wave', 30))    // 30s tension wave

  // Invert HP for danger signals
  graph.addNode(createInvertNode('player_danger'))
  graph.addNode(createInvertNode('partner_danger'))

  // Calm: low enemies, low tension, high HP
  graph.addNode(createInvertNode('inv_tension'))
  graph.addNode(createInvertNode('inv_enemies'))
  graph.addNode(createMultiplyNode('calm_base', 1))
  graph.addNode(createMultiplyNode('calm_hp', 1))
  graph.addNode(createClampNode('calm', 0, 1))

  // Aggressive: moderate enemies, player doing well
  graph.addNode(createMultiplyNode('aggr_enemies', 1))
  graph.addNode(createMultiplyNode('aggr_blend', 1))
  graph.addNode(createClampNode('aggressive', 0, 1))

  // Afraid: low HP, high enemy count
  graph.addNode(createMultiplyNode('afraid_danger', 1))
  graph.addNode(createMultiplyNode('afraid_tension', 1))
  graph.addNode(createClampNode('afraid', 0, 1))

  // Confident: high HP, few enemies
  graph.addNode(createMultiplyNode('conf_hp', 1))
  graph.addNode(createMultiplyNode('conf_blend', 1))
  graph.addNode(createClampNode('confident', 0, 1))

  // Desperate: critically low HP + high tension
  graph.addNode(createMultiplyNode('desp_danger', 1))
  graph.addNode(createClampNode('desperate', 0, 1))

  // Wiring
  graph.connect('player_hp', 'out', 'player_danger', 'in')
  graph.connect('partner_hp', 'out', 'partner_danger', 'in')
  graph.connect('tension', 'out', 'inv_tension', 'in')
  graph.connect('enemy_count', 'out', 'inv_enemies', 'in')

  // Calm = (1-tension) * (1-enemies) * playerHp
  graph.connect('inv_tension', 'out', 'calm_base', 'a')
  graph.connect('inv_enemies', 'out', 'calm_base', 'b')
  graph.connect('calm_base', 'out', 'calm_hp', 'a')
  graph.connect('player_hp', 'out', 'calm_hp', 'b')
  graph.connect('calm_hp', 'out', 'calm', 'in')

  // Aggressive = enemies * playerHp
  graph.connect('enemy_count', 'out', 'aggr_enemies', 'a')
  graph.connect('player_hp', 'out', 'aggr_enemies', 'b')
  graph.connect('aggr_enemies', 'out', 'aggr_blend', 'a')
  graph.connect('tension', 'out', 'aggr_blend', 'b')
  graph.connect('aggr_blend', 'out', 'aggressive', 'in')

  // Afraid = player_danger * tension
  graph.connect('player_danger', 'out', 'afraid_danger', 'a')
  graph.connect('partner_danger', 'out', 'afraid_danger', 'b')
  graph.connect('afraid_danger', 'out', 'afraid_tension', 'a')
  graph.connect('tension', 'out', 'afraid_tension', 'b')
  graph.connect('afraid_tension', 'out', 'afraid', 'in')

  // Confident = playerHp * (1-enemies)
  graph.connect('player_hp', 'out', 'conf_hp', 'a')
  graph.connect('partner_hp', 'out', 'conf_hp', 'b')
  graph.connect('conf_hp', 'out', 'conf_blend', 'a')
  graph.connect('inv_enemies', 'out', 'conf_blend', 'b')
  graph.connect('conf_blend', 'out', 'confident', 'in')

  // Desperate = player_danger * partner_danger * tension
  graph.connect('player_danger', 'out', 'desp_danger', 'a')
  graph.connect('tension', 'out', 'desp_danger', 'b')
  graph.connect('desp_danger', 'out', 'desperate', 'in')

  return graph
}

// ── Graph 3: Partner Confidence ──────────────────────────────────────
// How confident the partner feels. Affects speech frequency,
// aggression, and positioning.
//
// High confidence = bold speech, aggressive positioning, closer to enemies.
// Low confidence = quiet, defensive, sticks close to player.

export function createPartnerConfidenceGraph(): NodeGraph {
  const graph = new NodeGraph()

  // Input nodes
  graph.addNode(createHealthRatioNode('own_hp', 'partner'))
  graph.addNode(createHealthRatioNode('player_hp', 'player'))
  graph.addNode(createKillStreakNode('kills'))
  graph.addNode(createEnemyCountNode('enemies'))
  graph.addNode(createTensionNode('tension'))
  graph.addNode(createNoiseNode('personality', 0.3, 99))

  // HP factor: both partner and player HP contribute
  graph.addNode(createMultiplyNode('hp_factor', 1))

  // Kill streak boosts confidence
  graph.addNode(createMultiplyNode('kill_boost', 0.3))

  // More enemies = less confident
  graph.addNode(createInvertNode('inv_enemies'))
  graph.addNode(createMultiplyNode('enemy_factor', 0.2))

  // High tension reduces confidence
  graph.addNode(createInvertNode('inv_tension'))
  graph.addNode(createMultiplyNode('tension_factor', 0.2))

  // Panic threshold: if own HP < 20%, confidence crashes
  graph.addNode(createThresholdNode('panic_check', 0.2))
  graph.addNode(createMultiplyNode('panic_gate', 1))

  // Personality jitter
  graph.addNode(createMultiplyNode('personality_jitter', 0.08))

  // Sum and clamp
  graph.addNode(createAddNode('sum1'))
  graph.addNode(createAddNode('sum2'))
  graph.addNode(createAddNode('sum3'))
  graph.addNode(createAddNode('sum4'))
  graph.addNode(createClampNode('confidence', 0, 1))

  // Wiring
  // HP factor
  graph.connect('own_hp', 'out', 'hp_factor', 'a')
  graph.connect('player_hp', 'out', 'hp_factor', 'b')

  // Kill boost
  graph.connect('kills', 'out', 'kill_boost', 'a')

  // Enemy factor
  graph.connect('enemies', 'out', 'inv_enemies', 'in')
  graph.connect('inv_enemies', 'out', 'enemy_factor', 'a')

  // Tension factor
  graph.connect('tension', 'out', 'inv_tension', 'in')
  graph.connect('inv_tension', 'out', 'tension_factor', 'a')

  // Panic gate
  graph.connect('own_hp', 'out', 'panic_check', 'in')
  graph.connect('panic_check', 'out', 'panic_gate', 'a')
  // When panic triggers (HP > threshold = 1), keep value; when 0, confidence halved
  graph.connect('hp_factor', 'out', 'panic_gate', 'b')

  // Personality jitter
  graph.connect('personality', 'out', 'personality_jitter', 'a')

  // Sum: panic_gate + kill_boost
  graph.connect('panic_gate', 'out', 'sum1', 'a')
  graph.connect('kill_boost', 'out', 'sum1', 'b')

  // + enemy factor
  graph.connect('sum1', 'out', 'sum2', 'a')
  graph.connect('enemy_factor', 'out', 'sum2', 'b')

  // + tension
  graph.connect('sum2', 'out', 'sum3', 'a')
  graph.connect('tension_factor', 'out', 'sum3', 'b')

  // + personality jitter
  graph.connect('sum3', 'out', 'sum4', 'a')
  graph.connect('personality_jitter', 'out', 'sum4', 'b')

  // Final clamp
  graph.connect('sum4', 'out', 'confidence', 'in')

  return graph
}
