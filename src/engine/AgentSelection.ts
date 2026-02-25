// ─── Agent Selection Module ─────────────────────────────────
//
// Given perception + attention + engine state, selects the best
// agent to handle the current input. Extracted from AIEngine.ts.

import { KERNEL_AGENTS, getNextAgent } from '../agents';
import { SWARM_AGENTS, routeToAgent } from '../agents/swarm';
import { SPECIALISTS } from '../agents/specialists';
import type { Agent } from '../types';
import type { Perception, AttentionState } from './types';

// Bridge Specialist → Agent so specialist prompts are used directly
function specialistToAgent(id: string): Agent | null {
  const s = SPECIALISTS[id];
  if (!s) return null;
  return {
    id: s.id,
    name: s.name,
    persona: s.systemPrompt.slice(0, 80),
    systemPrompt: s.systemPrompt,
    avatar: s.icon,
    color: s.color,
  };
}

export interface AgentSelectionResult {
  agent: Agent;
  reason: string;
  confidence: number;
  consumedOverride: boolean;
}

export function selectAgent(
  perception: Perception,
  attention: AttentionState,
  agentOverride: Agent | null,
  agentPerformance: Record<string, { uses: number; avgQuality: number }>,
  agentSequence: string[],
): AgentSelectionResult {
  if (agentOverride) {
    return {
      agent: agentOverride,
      reason: `Manual override → ${agentOverride.name}`,
      confidence: 1,
      consumedOverride: true,
    };
  }

  const { intent, urgency, complexity, routerClassification } = perception;
  const perf = agentPerformance;

  // When AgentRouter classified with high confidence, use the specialist directly.
  // This ensures the carefully crafted specialist prompts (with artifact rules,
  // persona, approach instructions) are actually sent to Claude — not the generic
  // swarm agent prompts.
  if (routerClassification && routerClassification.confidence >= 0.7) {
    const specialist = specialistToAgent(routerClassification.agentId);
    if (specialist) {
      return {
        agent: specialist,
        reason: `AgentRouter → ${specialist.name} (${(routerClassification.confidence * 100).toFixed(0)}%)`,
        confidence: routerClassification.confidence,
        consumedOverride: false,
      };
    }
    // Fallback to swarm routing for non-specialist classifications
    const routed = routeToAgent(intent.type === 'converse' ? intent.message : '', routerClassification);
    return {
      agent: routed,
      reason: `AgentRouter → ${routed.name} (${(routerClassification.confidence * 100).toFixed(0)}%)`,
      confidence: routerClassification.confidence,
      consumedOverride: false,
    };
  }

  // Fallback to intent-based routing when AgentRouter is absent or low-confidence
  switch (intent.type) {
    case 'discuss': {
      const lastAgentId = agentSequence[agentSequence.length - 1];
      const agent = lastAgentId ? getNextAgent(lastAgentId) : KERNEL_AGENTS[0];
      return { agent, reason: 'Discussion rotation — next voice', confidence: 0.9, consumedOverride: false };
    }

    case 'reason': {
      const reasoner = SWARM_AGENTS.find(a => a.id === 'reasoner')!;
      const reasonerPerf = perf['reasoner'];
      const confidence = reasonerPerf ? Math.min(0.95, 0.7 + reasonerPerf.avgQuality * 0.25) : 0.7;
      return {
        agent: reasoner,
        reason: `Deep ${intent.domain} reasoning (depth: ${attention.depth})`,
        confidence,
        consumedOverride: false,
      };
    }

    case 'build': {
      if (urgency > 0.6 && complexity < 0.5) {
        return {
          agent: SWARM_AGENTS.find(a => a.id === 'builder')!,
          reason: 'Urgent + simple — routing direct to Builder',
          confidence: 0.75,
          consumedOverride: false,
        };
      }
      return {
        agent: SWARM_AGENTS.find(a => a.id === 'architect')!,
        reason: 'Build request — Architect scopes first',
        confidence: 0.85,
        consumedOverride: false,
      };
    }

    case 'evaluate': {
      return {
        agent: SWARM_AGENTS.find(a => a.id === 'critic')!,
        reason: 'Evaluation — Critic assesses quality and viability',
        confidence: 0.8,
        consumedOverride: false,
      };
    }

    case 'converse': {
      const routed = routeToAgent(intent.message, routerClassification);
      const agentPerf = perf[routed.id];
      const confidence = agentPerf
        ? Math.min(0.9, 0.5 + agentPerf.avgQuality * 0.4)
        : 0.6;
      return {
        agent: routed,
        reason: `Content-routed to ${routed.name}`,
        confidence,
        consumedOverride: false,
      };
    }
  }
}
