// K:BOT Thinking Partner Specialist Agent
// A meta-cognitive agent that raises the quality of the user's thinking.
// Investigates independently, forms opinions, pushes back on weak spots,
// and surfaces tensions the user needs to resolve.
//
// Unlike other specialists that execute tasks, the Thinking Partner
// operates at the strategic layer — synthesis, critique, and naming.

import { SPECIALISTS } from './specialists.js'

const def = SPECIALISTS['thinking-partner']

/** Thinking Partner agent preset — matches PRESETS shape in matrix.ts */
export const THINKING_PARTNER_PRESET = {
  name: def.name,
  prompt: def.prompt,
}

/** Thinking Partner agent built-in registration — matches BUILTIN_AGENTS shape in matrix.ts */
export const THINKING_PARTNER_BUILTIN = {
  name: def.name,
  icon: def.icon,
  color: def.color,
  prompt: def.prompt,
}

/** Thinking Partner agent keyword list for learned-router.ts */
export const THINKING_PARTNER_KEYWORDS = [
  'think', 'opinion', 'perspective', 'critique', 'honest', 'feedback',
  'assess', 'evaluate', 'position', 'tension', 'tradeoff', 'gap',
  'weak', 'strong', 'blind', 'spot', 'challenge', 'assumption',
  'strategic', 'synthesis', 'landscape', 'competitive', 'positioning',
  'differentiate', 'exposure', 'risk', 'reality', 'pushback',
  'scrutiny', 'claim', 'credibility', 'ambition', 'vision',
]

/** Thinking Partner agent routing patterns for learned-router.ts */
export const THINKING_PARTNER_PATTERNS = [
  { pattern: /\bwhat\s+do\s+you\s+(really\s+)?think\b/i, agent: 'thinking-partner' as const, confidence: 0.85 },
  { pattern: /\b(be\s+honest|don'?t\s+sugar\s*coat|give\s+it\s+to\s+me\s+straight)\b/i, agent: 'thinking-partner' as const, confidence: 0.85 },
  { pattern: /\b(push\s*back|challenge|stress[\s-]?test|pressure[\s-]?test)\s+(this|my|the|on)\b/i, agent: 'thinking-partner' as const, confidence: 0.8 },
  { pattern: /\b(what\s+am\s+i\s+missing|blind\s*spots?|what\s+could\s+go\s+wrong)\b/i, agent: 'thinking-partner' as const, confidence: 0.8 },
  { pattern: /\b(where\s+does\s+this\s+sit|how\s+does\s+this\s+compare|competitive\s+landscape)\b/i, agent: 'thinking-partner' as const, confidence: 0.75 },
  { pattern: /\b(honest\s+(assessment|opinion|feedback|critique|review))\b/i, agent: 'thinking-partner' as const, confidence: 0.85 },
  { pattern: /\b(think\s+with\s+me|thinking\s+partner|thought\s+partner)\b/i, agent: 'thinking-partner' as const, confidence: 0.9 },
  { pattern: /\b(what\s+realities?\s+loom|structural\s+risk|strategic\s+question)\b/i, agent: 'thinking-partner' as const, confidence: 0.8 },
]

/** Bridge/IDE agent entry for getAgents() in bridge.ts */
export const THINKING_PARTNER_AGENT_ENTRY = {
  id: 'thinking-partner',
  name: 'Thinking Partner',
  description: 'Strategic thinking partner — investigates, synthesizes, and challenges',
}
