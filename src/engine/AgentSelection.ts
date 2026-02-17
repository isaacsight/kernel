// ─── Agent Selection Module ─────────────────────────────────
//
// Given perception + attention + engine state, selects the best
// agent to handle the current input. Extracted from AIEngine.ts.

import { KERNEL_AGENTS, getNextAgent } from '../agents';
import { SWARM_AGENTS, routeToAgent } from '../agents/swarm';
import type { Agent } from '../types';
import type { Perception, AttentionState } from './types';

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

  const { intent, urgency, complexity } = perception;
  const perf = agentPerformance;

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
        agent: SWARM_AGENTS.find(a => a.id === 'scout')!,
        reason: 'Opportunity evaluation — Scout assesses viability',
        confidence: 0.8,
        consumedOverride: false,
      };
    }

    case 'converse': {
      const routed = routeToAgent(intent.message);
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
