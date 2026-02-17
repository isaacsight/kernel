// ─── Discussion Mode Module ─────────────────────────────────
//
// Multi-turn agent discussion with quality guardrails.
// Extracted from AIEngine.ts for modularity.

import { KERNEL_AGENTS, getNextAgent } from '../agents';
import { getProvider } from './providers/registry';
import { reflect } from './reflection';
import { extractKeyEntities } from './textAnalysis';
import { formBelief, shiftConviction, updateWorldModel } from './WorldModel';
import type { Message } from '../types';
import type {
  CognitivePhase,
  AttentionState,
  EphemeralMemory,
  Perception,
  Reflection,
  EngineState,
  EngineEvent,
} from './types';

// ─── Guardrail Constants ────────────────────────────────────

const DISCUSSION_MAX_TURNS = 10;
const DISCUSSION_MIN_QUALITY = 0.3;
const DISCUSSION_QUALITY_WINDOW = 3;

// ─── Dependencies ───────────────────────────────────────────

export interface DiscussionDeps {
  getState: () => EngineState;
  setState: (patch: Partial<EngineState>) => void;
  setEphemeral: (ephemeral: EphemeralMemory) => void;
  emit: (event: EngineEvent) => void;
  setPhase: (phase: CognitivePhase) => void;
  persistState: () => void;
  isAborted: () => boolean;
  createEmptyEphemeral: () => EphemeralMemory;
}

// ─── Discussion Runner ──────────────────────────────────────

export async function runDiscussion(
  topic: string,
  deps: DiscussionDeps,
): Promise<void> {
  const { getState, emit, setPhase, persistState, isAborted, createEmptyEphemeral, setEphemeral } = deps;
  const state = getState();

  state.working.topic = topic;

  if (!state.lasting.topicHistory.includes(topic)) {
    state.lasting.topicHistory = [...state.lasting.topicHistory.slice(-19), topic];
    persistState();
  }

  formBelief(state.worldModel, emit, `Currently exploring: "${topic}"`, 0.8, 'observed');

  let currentAgent = KERNEL_AGENTS[0];
  let discussionTurns = 0;
  const discussionReflections: Reflection[] = [];

  while (!isAborted()) {
    if (discussionTurns >= DISCUSSION_MAX_TURNS) {
      emit({
        type: 'discussion_stopped',
        reason: `Reached maximum of ${DISCUSSION_MAX_TURNS} turns`,
        turns: discussionTurns,
        timestamp: Date.now(),
      });
      break;
    }

    const cycleStart = Date.now();

    setPhase('attending');
    const attention: AttentionState = {
      primaryFocus: topic,
      salience: { [topic]: 1 },
      distractions: [],
      depth: 'moderate',
    };
    setEphemeral({
      ...createEmptyEphemeral(),
      activeAgent: currentAgent,
      attention,
      startedAt: cycleStart,
    });
    emit({ type: 'attention_set', attention, timestamp: Date.now() });

    setPhase('deciding');
    emit({
      type: 'agent_selected',
      agent: currentAgent,
      reason: `Discussion turn — ${currentAgent.name} speaks`,
      timestamp: Date.now(),
    });

    setPhase('acting');
    let response: string;
    try {
      const discMessages: { role: string; content: string }[] = state.working.conversationHistory
        .slice(-10)
        .map(m => ({
          role: m.agentId === 'human' ? 'user' : 'assistant',
          content: `${m.agentName}: ${m.content}`,
        }));
      discMessages.push({ role: 'user', content: `CURRENT TOPIC: "${topic}"\n\nNow respond as ${currentAgent.name}. Remember: 2-3 sentences max, build on what others said, reference them by name.` });

      response = await getProvider().streamChat(
        discMessages,
        (chunk) => {
          emit({ type: 'response_chunk', text: chunk, timestamp: Date.now() });
        },
        { system: currentAgent.systemPrompt, tier: 'strong', max_tokens: 512 }
      );
    } catch {
      emit({ type: 'error', message: 'Generation failed', timestamp: Date.now() });
      shiftConviction(state.worldModel, emit, -0.03, 'Discussion generation error');
      break;
    }

    if (isAborted()) break;

    const message: Message = {
      id: `disc_${Date.now()}`,
      agentId: currentAgent.id,
      agentName: currentAgent.name,
      content: response,
      timestamp: new Date(),
    };
    state.working.conversationHistory.push(message);
    state.working.turnCount++;
    state.working.agentSequence.push(currentAgent.id);

    setPhase('reflecting');
    const perception: Perception = {
      intent: { type: 'discuss', topic },
      urgency: 0,
      complexity: 0.5,
      sentiment: 0,
      impliedNeed: 'Multiple perspectives',
      keyEntities: extractKeyEntities(response),
      isQuestion: false,
      isFollowUp: true,
    };
    const reflection = reflect(topic, response, currentAgent, perception, Date.now() - cycleStart, state.working.conversationHistory);
    updateWorldModel(state, emit, persistState, reflection, perception);
    emit({ type: 'cycle_complete', reflection, timestamp: Date.now() });

    discussionReflections.push(reflection);
    discussionTurns++;

    if (discussionReflections.length >= DISCUSSION_QUALITY_WINDOW) {
      const recentWindow = discussionReflections.slice(-DISCUSSION_QUALITY_WINDOW);
      const avgQuality = recentWindow.reduce((sum, r) => sum + r.quality, 0) / recentWindow.length;
      if (avgQuality < DISCUSSION_MIN_QUALITY) {
        emit({
          type: 'discussion_stopped',
          reason: `Quality degraded (avg ${(avgQuality * 100).toFixed(0)}% over last ${DISCUSSION_QUALITY_WINDOW} turns)`,
          turns: discussionTurns,
          timestamp: Date.now(),
        });
        break;
      }
    }

    state.cycleCount++;
    currentAgent = getNextAgent(currentAgent.id);

    setPhase('idle');
    await new Promise<void>((resolve) => {
      const delay = 2000 + Math.random() * 2000;
      const timeout = setTimeout(resolve, delay);
      const check = setInterval(() => {
        if (isAborted()) {
          clearTimeout(timeout);
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  setPhase('idle');
}
