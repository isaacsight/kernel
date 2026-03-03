// ─── Shared Engine Types ─────────────────────────────────
//
// All type/interface definitions for the cognitive engine.
// Extracted from AIEngine.ts for modularity and testability.

import type { Agent, Message } from '../types'

// ─── Cognitive Phase ────────────────────────────────────────

export type CognitivePhase =
  | 'idle'        // Resting — awaiting stimulus
  | 'perceiving'  // Processing input, extracting signal
  | 'attending'   // Deciding what matters most right now
  | 'deciding'    // Selecting agent and strategy
  | 'acting'      // Generating response
  | 'reflecting'; // Evaluating output, updating world model

// ─── Intent Classification ──────────────────────────────────

export type IntentType = 'discuss' | 'reason' | 'build' | 'evaluate' | 'converse' | 'workflow';
export type ReasoningDomain = 'financial' | 'technical' | 'strategic' | 'general';

export type Intent =
  | { type: 'discuss'; topic: string }
  | { type: 'reason'; question: string; domain: ReasoningDomain }
  | { type: 'build'; description: string }
  | { type: 'evaluate'; opportunity: string }
  | { type: 'converse'; message: string }
  | { type: 'workflow'; request: string };

// ─── Perception ─────────────────────────────────────────────

export interface Perception {
  intent: Intent;
  urgency: number;          // 0 (contemplative) → 1 (immediate)
  complexity: number;       // 0 (trivial) → 1 (deeply layered)
  sentiment: number;        // -1 (frustrated/negative) → 1 (excited/positive)
  impliedNeed: string;      // what the human actually needs (often unstated)
  keyEntities: string[];    // important nouns/concepts extracted
  isQuestion: boolean;
  isFollowUp: boolean;      // does this build on prior conversation?
  routerClassification?: {  // AgentRouter result — single source of truth for routing
    agentId: string;
    confidence: number;
    needsResearch: boolean;
    isMultiStep: boolean;
    needsSwarm: boolean;
  };
}

// ─── Attention ──────────────────────────────────────────────

export interface AttentionState {
  primaryFocus: string;              // the one thing that matters most
  salience: Record<string, number>;  // concept → weight (0-1)
  distractions: string[];            // things to deliberately ignore
  depth: 'surface' | 'moderate' | 'deep';  // how deep to go
}

// ─── World Model ────────────────────────────────────────────

export interface Belief {
  id: string;
  content: string;            // what the engine believes
  confidence: number;         // 0-1 how sure
  source: 'inferred' | 'stated' | 'observed' | 'reflected';
  formedAt: number;           // timestamp
  challengedCount: number;    // how many times this has been questioned
  reinforcedCount: number;    // how many times this has been confirmed
}

export interface WorldModel {
  beliefs: Belief[];
  convictions: {
    overall: number;          // 0-1: how sure the engine is about its worldview
    trend: 'rising' | 'stable' | 'falling';
    lastShift: number;        // timestamp of last significant change
  };
  situationSummary: string;   // one-sentence: what's happening right now
  userModel: {
    apparentGoal: string;     // what the human seems to be trying to do
    communicationStyle: 'terse' | 'conversational' | 'detailed' | 'unknown';
    expertise: 'beginner' | 'intermediate' | 'expert' | 'unknown';
  };
}

// ─── Memory Layers ──────────────────────────────────────────

export interface EphemeralMemory {
  currentInput: string;
  perception: Perception | null;
  attention: AttentionState | null;
  activeAgent: Agent | null;
  startedAt: number;
}

export interface WorkingMemory {
  conversationHistory: Message[];
  topic: string;
  turnCount: number;
  agentSequence: string[];
  emotionalTone: number;       // running average: -1 → 1
  coherenceScore: number;      // 0-1: how well the conversation flows
  threadSummary: string;       // compressed summary of conversation so far
  unresolvedQuestions: string[];
}

export interface LastingMemory {
  totalInteractions: number;
  preferredAgents: Record<string, number>;
  topicHistory: string[];
  reflections: Reflection[];
  feedbackRatio: { positive: number; negative: number };
  agentPerformance: Record<string, { uses: number; avgQuality: number }>;
  patternNotes: string[];      // engine's own notes about what works
}

// ─── Reflection ─────────────────────────────────────────────

export interface Reflection {
  timestamp: number;
  phase: CognitivePhase;
  input: string;
  output: string;
  agentUsed: string;
  durationMs: number;
  quality: number;             // 0-1 composite score
  scores: {
    substance: number;         // did it say something real?
    coherence: number;         // does it flow from what came before?
    relevance: number;         // does it address the actual need?
    brevity: number;           // is it tight, or bloated?
    craft: number;             // aesthetic quality — rhythm, word choice
    continuity?: number;       // does it build on conversational arc?
    attunement?: number;       // is response length/tone calibrated to user?
  };
  lesson: string;
  worldModelUpdate: string | null;  // did this change what the engine believes?
  convictionDelta: number;          // +/- change to overall conviction
}

// ─── Engine State ───────────────────────────────────────────

export interface EngineState {
  phase: CognitivePhase;
  ephemeral: EphemeralMemory;
  working: WorkingMemory;
  lasting: LastingMemory;
  worldModel: WorldModel;
  isOnline: boolean;
  cycleCount: number;
}

// ─── Engine Events ──────────────────────────────────────────

export type EngineEvent =
  | { type: 'phase_changed'; phase: CognitivePhase; timestamp: number }
  | { type: 'perception_complete'; perception: Perception; timestamp: number }
  | { type: 'attention_set'; attention: AttentionState; timestamp: number }
  | { type: 'intent_parsed'; intent: Intent; timestamp: number }
  | { type: 'belief_formed'; belief: Belief; timestamp: number }
  | { type: 'belief_updated'; belief: Belief; delta: number; timestamp: number }
  | { type: 'conviction_shifted'; from: number; to: number; reason: string; timestamp: number }
  | { type: 'agent_selected'; agent: Agent; reason: string; timestamp: number }
  | { type: 'response_chunk'; text: string; timestamp: number }
  | { type: 'cycle_complete'; reflection: Reflection; timestamp: number }
  | { type: 'world_model_updated'; summary: string; timestamp: number }
  | { type: 'discussion_stopped'; reason: string; turns: number; timestamp: number }
  | { type: 'approval_needed'; toolName: string; args: Record<string, unknown>; description: string; requestId: string; timestamp: number }
  | { type: 'approval_resolved'; requestId: string; approved: boolean; timestamp: number }
  | { type: 'procedure_detected'; name: string; triggerPhrase: string; timestamp: number }
  | { type: 'procedure_matched'; name: string; timestamp: number }
  | { type: 'workflow_progress'; state: string; step: string; details?: string; timestamp: number }
  | { type: 'error'; message: string; timestamp: number };

export type EngineListener = (event: EngineEvent) => void;

export interface WorkflowEvent {
  type: 'workflow_progress';
  state: string;
  step: string;
  details?: string;
  timestamp: number;
}
