/**
 * Phase-kind heuristic — pick a coarse mode for a user turn.
 *
 * This is the cheap, no-LLM signal the hierarchical planner uses to decide
 * whether to keep the active Phase or open a new one. It deliberately leans on
 * keyword shape rather than semantic meaning so it's predictable and free.
 *
 * The classifier is order-sensitive: more specific intents (debug, refactor)
 * are checked before general ones (build, write). Anything ambiguous falls
 * through to `other`.
 */

import type { PhaseKind } from './types.js'

interface Rule {
  kind: PhaseKind
  pattern: RegExp
}

const RULES: Rule[] = [
  { kind: 'debug',    pattern: /\b(debug|fix|broken|failing|error|bug|crash|stack ?trace|repro)\b/i },
  { kind: 'refactor', pattern: /\b(refactor|rename|extract|inline|move|reorganize|cleanup|simplif)/i },
  { kind: 'review',   pattern: /\b(review|audit|check|inspect|critique|grade)\b/i },
  { kind: 'deploy',   pattern: /\b(deploy|publish|release|ship|push to (prod|main|origin)|npm publish)\b/i },
  { kind: 'explore',  pattern: /\b(explore|investigate|look into|understand|map|trace|find|search)\b/i },
  { kind: 'write',    pattern: /\b(write|draft|document|docs?|readme|changelog|blog|article|tweet|post)\b/i },
  { kind: 'build',    pattern: /\b(build|implement|create|add|scaffold|generate|wire|hook|integrat)/i },
]

export function detectPhaseKind(userTurn: string): PhaseKind {
  for (const r of RULES) {
    if (r.pattern.test(userTurn)) return r.kind
  }
  return 'other'
}
