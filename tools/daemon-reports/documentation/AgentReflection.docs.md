# JSDoc for src/engine/AgentReflection.ts

Undocumented exports: EvidenceType, Severity, ReflectionQuestion, ReflectionFinding, ALL_REFLECTION_QUESTIONS

---

```typescript
/**
 * Represents the type of evidence required to answer a reflection question.
 */
export type EvidenceType =
  | 'metric'       // number with unit (e.g., "93KB gzip")
  | 'code-path'    // file:line reference
  | 'screenshot'   // visual proof
  | 'test-result'  // pass/fail with details
  | 'comparison'   // before/after or A/B
  | 'user-signal'  // analytics, feedback, behavior
  | 'reasoning'    // logical argument with cited facts

/**
 * Represents the severity level of a reflection question.
 */
export type Severity = 'critical' | 'important' | 'exploratory'

/**
 * Interface representing a reflection question.
 */
export interface ReflectionQuestion {
  id: string
  domain: ReflectionDomain
  severity: Severity
  question: string
  context: string
  evidence: EvidenceType[]
  agent: 'qa' | 'designer' | 'performance' | 'security' | 'devops' | 'product' | 'all'
}

/**
 * Interface representing a reflection finding.
 */
export interface ReflectionFinding {
  questionId: string
  agent: string
  answer: string
  evidence: string[]
  severity: 'p0' | 'p1' | 'p2' | 'info'
  actionRequired: boolean
  suggestedFix?: string
  timestamp: number
}

/**
 * An array containing all reflection questions.
 */
export const ALL_REFLECTION_QUESTIONS: ReflectionQuestion[] = [
  // ... (questions omitted for brevity)
]
```
