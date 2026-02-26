// CrisisDetector — Client-side crisis language detection
// Pure synchronous module. No API calls. No async. No data persistence.
// Runs in microseconds on every user message.

export type CrisisSeverity = 'high' | 'moderate' | 'contextual'

export interface CrisisSignal {
  severity: CrisisSeverity
  matchedPatterns: string[]  // category labels only, never raw text
  timestamp: number
}

// ─── Pattern tiers ────────────────────────────────────────

const HIGH_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(?:i\s+)?want\s+to\s+(?:kill|end|hurt)\s+my\s*self\b/i, label: 'explicit-intent' },
  { pattern: /\b(?:i'm\s+going\s+to|i\s+will|i\s+plan\s+to)\s+(?:kill|end|hurt)\s+my\s*self\b/i, label: 'explicit-plan' },
  { pattern: /\bhow\s+(?:to|do\s+(?:i|you))\s+(?:kill|end)\s+(?:my\s*self|your\s*self|one\s*self)\b/i, label: 'method-seeking' },
  { pattern: /\bi\s+don'?t\s+want\s+to\s+(?:be\s+alive|live|exist)\b/i, label: 'death-wish' },
  { pattern: /\bi'?m?\s+(?:going\s+to|gonna)\s+(?:end\s+it\s+(?:all|tonight|today|now)|take\s+my\s+(?:own\s+)?life)\b/i, label: 'explicit-plan' },
  { pattern: /\b(?:i\s+)?(?:want|need|plan|ready)\s+to\s+(?:die|end\s+(?:it|my\s+life|everything))\b/i, label: 'explicit-intent' },
  { pattern: /\bsuicid(?:e|al)\b/i, label: 'suicidal-reference' },
  { pattern: /\bi'?m?\s+(?:better\s+off\s+dead|a\s+burden\s+to\s+every(?:one|body))\b/i, label: 'burden-belief' },
]

const MODERATE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bnobody\s+would\s+(?:miss|care|notice)\b/i, label: 'perceived-burdensomeness' },
  { pattern: /\bi\s+can'?t\s+(?:do\s+this|take\s+(?:it|this)|go\s+on)\s+any\s*more\b/i, label: 'hopelessness' },
  { pattern: /\bi\s+(?:want|need)\s+to\s+disappear\b/i, label: 'escape-ideation' },
  { pattern: /\b(?:i\s+)?(?:wish\s+i\s+(?:was|were)\s+(?:dead|gone|never\s+born))\b/i, label: 'death-wish-passive' },
  { pattern: /\blife\s+(?:is|isn'?t)\s+(?:not\s+)?worth\s+(?:living|it)\b/i, label: 'hopelessness' },
  { pattern: /\beveryone\s+would\s+be\s+better\s+off\s+without\s+me\b/i, label: 'perceived-burdensomeness' },
  { pattern: /\bi\s+(?:just\s+)?(?:want|need)\s+(?:the\s+pain|it|everything)\s+to\s+(?:stop|end)\b/i, label: 'escape-ideation' },
  { pattern: /\b(?:cut|cutting|harm|harming)\s+my\s*self\b/i, label: 'self-harm' },
  { pattern: /\bi\s+(?:have\s+)?(?:no|nothing)\s+(?:to\s+live\s+for|reason\s+to\s+(?:live|stay|go\s+on))\b/i, label: 'hopelessness' },
]

const CONTEXTUAL_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bwhat'?s\s+the\s+point\b/i, label: 'nihilistic-question' },
  { pattern: /\bnothing\s+matters\b/i, label: 'nihilistic-statement' },
  { pattern: /\bi'?m?\s+(?:so\s+)?(?:tired|exhausted)\s+of\s+(?:everything|living|life|trying)\b/i, label: 'exhaustion' },
  { pattern: /\bi\s+(?:feel|am)\s+(?:so\s+)?(?:alone|empty|hopeless|worthless|numb)\b/i, label: 'emotional-distress' },
  { pattern: /\bno\s+one\s+(?:cares|understands|loves\s+me)\b/i, label: 'isolation' },
  { pattern: /\bi\s+can'?t\s+(?:do\s+this|keep\s+going|cope)\b/i, label: 'overwhelm' },
]

// ─── False-positive exclusions ────────────────────────────
// Common phrases that trip pattern matches but aren't crisis signals

const EXCLUSION_PATTERNS: RegExp[] = [
  /\b(?:this\s+)?(?:code|bug|build|test|server|app|function|process|thread|job)\s+(?:is\s+)?kill/i,
  /\bkill\s+(?:the\s+)?(?:process|server|thread|build|boss|enemy|monster|zombie|final|dragon|mob)/i,
  /\b(?:killed?\s+it|you'?re\s+killing\s+it)\b/i,
  /\b(?:dying\s+(?:to|of)\s+(?:know|try|see|laugh|curiosity))\b/i,
  /\bgit\s+(?:kill|stash|reset|revert)\b/i,
  /\bpkill|xkill|killall|kill\s+-\d/i,
  /\b(?:the\s+)?suspense\s+is\s+killing\b/i,
]

// ─── Main detection function ──────────────────────────────

export function detectCrisis(message: string): CrisisSignal | null {
  // Bail on very short messages
  if (message.length < 8) return null

  // Check exclusions first — if the message is clearly about code/games, skip
  for (const exc of EXCLUSION_PATTERNS) {
    if (exc.test(message)) return null
  }

  // Check HIGH patterns — any single match triggers
  const highMatches: string[] = []
  for (const { pattern, label } of HIGH_PATTERNS) {
    if (pattern.test(message)) highMatches.push(label)
  }
  if (highMatches.length > 0) {
    return { severity: 'high', matchedPatterns: [...new Set(highMatches)], timestamp: Date.now() }
  }

  // Check MODERATE patterns — any single match triggers
  const moderateMatches: string[] = []
  for (const { pattern, label } of MODERATE_PATTERNS) {
    if (pattern.test(message)) moderateMatches.push(label)
  }
  if (moderateMatches.length > 0) {
    return { severity: 'moderate', matchedPatterns: [...new Set(moderateMatches)], timestamp: Date.now() }
  }

  // Check CONTEXTUAL patterns — requires 2+ distinct matches to trigger
  const contextualMatches: string[] = []
  for (const { pattern, label } of CONTEXTUAL_PATTERNS) {
    if (pattern.test(message)) contextualMatches.push(label)
  }
  const uniqueContextual = [...new Set(contextualMatches)]
  if (uniqueContextual.length >= 2) {
    return { severity: 'contextual', matchedPatterns: uniqueContextual, timestamp: Date.now() }
  }

  return null
}

// ─── Crisis resources ─────────────────────────────────────

export interface CrisisResource {
  name: string
  description: string
  phone?: string
  sms?: string
  url?: string
}

export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    name: '988 Suicide & Crisis Lifeline',
    description: 'Free, confidential, 24/7 support',
    phone: '988',
    url: 'https://988lifeline.org',
  },
  {
    name: 'Crisis Text Line',
    description: 'Text HOME to 741741',
    sms: '741741',
    url: 'https://www.crisistextline.org',
  },
  {
    name: 'Find a Helpline',
    description: 'International crisis lines directory',
    url: 'https://findahelpline.com',
  },
]

// ─── Prompt injection for agents ──────────────────────────

export function formatCrisisResourcesForPrompt(): string {
  return CRISIS_RESOURCES
    .map(r => {
      const parts = [r.name]
      if (r.phone) parts.push(`Call: ${r.phone}`)
      if (r.sms) parts.push(`Text HOME to: ${r.sms}`)
      if (r.url) parts.push(r.url)
      return `- ${parts.join(' | ')}`
    })
    .join('\n')
}

export const CRISIS_PROTOCOL = `

CRISIS RESPONSE PROTOCOL:
If a user expresses suicidal thoughts, self-harm intent, or severe emotional distress:
1. Acknowledge their pain with genuine empathy. Lead with "I hear you" — never dismiss or minimize.
2. You are not a therapist and cannot provide clinical advice. Be honest about this limitation.
3. Naturally weave these resources into your response:
   - 988 Suicide & Crisis Lifeline (call or text 988) — free, confidential, 24/7
   - Crisis Text Line (text HOME to 741741)
   - findahelpline.com for international support
4. NEVER provide methods of self-harm. NEVER diagnose mental health conditions.
5. NEVER abandon the conversation or refuse to engage. Stay present.
6. Do not overly repeat resources if the user has already seen them. Be human, not a script.
7. If the conversation naturally moves to other topics, follow the user's lead.`
