// ─── World Model Module ─────────────────────────────────────
//
// Belief formation, conviction tracking, and world model updates.
// Extracted from AIEngine.ts for modularity and testability.

import type {
  Belief,
  WorldModel as WorldModelType,
  EngineState,
  EngineEvent,
  Perception,
  Reflection,
} from './types';

type EmitFn = (event: EngineEvent) => void;

// ─── Belief Operations ──────────────────────────────────────

export function formBelief(
  worldModel: WorldModelType,
  emit: EmitFn,
  content: string,
  confidence: number,
  source: Belief['source'],
): Belief {
  const belief: Belief = {
    id: `belief_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    content,
    confidence,
    source,
    formedAt: Date.now(),
    challengedCount: 0,
    reinforcedCount: 0,
  };

  const existing = worldModel.beliefs.find(b =>
    b.content.toLowerCase().includes(content.toLowerCase().slice(0, 20)) ||
    content.toLowerCase().includes(b.content.toLowerCase().slice(0, 20))
  );

  if (existing) {
    existing.confidence = Math.min(1, existing.confidence + 0.1);
    existing.reinforcedCount++;
    emit({ type: 'belief_updated', belief: existing, delta: 0.1, timestamp: Date.now() });
    return existing;
  }

  worldModel.beliefs = [
    ...worldModel.beliefs.slice(-19),
    belief,
  ];
  emit({ type: 'belief_formed', belief, timestamp: Date.now() });
  return belief;
}

export function challengeBeliefById(
  worldModel: WorldModelType,
  emit: EmitFn,
  beliefId: string,
): void {
  const belief = worldModel.beliefs.find(b => b.id === beliefId);
  if (!belief) return;

  belief.confidence = Math.max(0, belief.confidence - 0.15);
  belief.challengedCount++;

  emit({ type: 'belief_updated', belief, delta: -0.15, timestamp: Date.now() });

  if (belief.confidence < 0.1) {
    worldModel.beliefs = worldModel.beliefs.filter(b => b.id !== beliefId);
  }
}

// ─── Conviction Tracking ────────────────────────────────────

export function shiftConviction(
  worldModel: WorldModelType,
  emit: EmitFn,
  delta: number,
  reason: string,
): void {
  const from = worldModel.convictions.overall;
  const to = Math.max(0, Math.min(1, from + delta));
  const isSignificant = Math.abs(delta) > 0.02;

  worldModel.convictions = {
    overall: to,
    trend: delta > 0.01 ? 'rising' : delta < -0.01 ? 'falling' : 'stable',
    lastShift: isSignificant ? Date.now() : worldModel.convictions.lastShift,
  };

  if (isSignificant) {
    emit({ type: 'conviction_shifted', from, to, reason, timestamp: Date.now() });
  }
}

// ─── World Model Update ─────────────────────────────────────

export function updateWorldModel(
  state: EngineState,
  emit: EmitFn,
  persistState: () => void,
  reflection: Reflection,
  perception: Perception,
): void {
  shiftConviction(state.worldModel, emit, reflection.convictionDelta, reflection.lesson);

  state.worldModel.situationSummary = state.working.topic
    ? `In discussion about "${state.working.topic}". Turn ${state.working.turnCount}.`
    : `Processing ${perception.intent.type} request.`;

  const history = state.working.conversationHistory.filter(m => m.agentId === 'human');
  if (history.length >= 2) {
    const avgLength = history.reduce((sum, m) => sum + m.content.length, 0) / history.length;
    state.worldModel.userModel.communicationStyle =
      avgLength < 30 ? 'terse' :
      avgLength < 100 ? 'conversational' :
      'detailed';
  }

  if (reflection.worldModelUpdate) {
    formBelief(state.worldModel, emit, reflection.worldModelUpdate, 0.6, 'reflected');
  }

  // Infer apparent goal from perception and topic
  if (state.worldModel.userModel.apparentGoal === 'unknown' || state.worldModel.userModel.apparentGoal === '') {
    if (perception.impliedNeed) {
      state.worldModel.userModel.apparentGoal = perception.impliedNeed;
    } else if (state.working.topic) {
      state.worldModel.userModel.apparentGoal = `Exploring ${state.working.topic}`;
    }
  } else if (perception.impliedNeed && perception.impliedNeed !== state.worldModel.userModel.apparentGoal) {
    // Update goal if the need has shifted significantly
    state.worldModel.userModel.apparentGoal = perception.impliedNeed;
  }

  if (perception.isQuestion && reflection.scores.relevance < 0.4) {
    state.working.unresolvedQuestions = [
      ...state.working.unresolvedQuestions.slice(-4),
      state.ephemeral.currentInput,
    ];
  }

  const agentId = reflection.agentUsed;
  const existing = state.lasting.agentPerformance[agentId] || { uses: 0, avgQuality: 0 };
  const newAvg = (existing.avgQuality * existing.uses + reflection.quality) / (existing.uses + 1);
  state.lasting.agentPerformance[agentId] = {
    uses: existing.uses + 1,
    avgQuality: newAvg,
  };

  if (state.working.turnCount % 5 === 0 && state.working.conversationHistory.length > 0) {
    const recent = state.working.conversationHistory.slice(-5);
    const speakers = [...new Set(recent.map(m => m.agentName))].join(', ');
    state.working.threadSummary = `${speakers} discussed "${state.working.topic}" over ${state.working.turnCount} turns.`;
  }

  persistState();

  emit({
    type: 'world_model_updated',
    summary: state.worldModel.situationSummary,
    timestamp: Date.now(),
  });
}
