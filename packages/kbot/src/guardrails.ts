// kbot Guardrails System — Safety checks on inputs, outputs, and tool calls
//
// Three layers of protection:
//   1. Input guardrails  — validate user messages before the agent processes them
//   2. Output guardrails — scan agent responses before showing to the user
//   3. Tool guardrails   — check tool calls before execution
//
// Built-in guardrails are always active. Users can add custom rules
// via ~/.kbot/guardrails.json.
//
// Complements permissions.ts (confirmation dialogs) and bash.ts
// (blocked command patterns). Guardrails operate at a higher level —
// they inspect content semantics, not just command syntax.

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { printWarn, printError } from './ui.js'

// ── Data model ──

export interface Guardrail {
  id: string
  name: string
  type: 'input' | 'output' | 'tool'
  severity: 'block' | 'warn' | 'log'
  /** Regex pattern to match against content */
  pattern?: RegExp
  /** Name of a built-in validator function */
  validator?: string
  /** Message shown when the guardrail triggers */
  message: string
  enabled: boolean
}

export interface GuardrailViolation {
  guardrailId: string
  severity: 'block' | 'warn' | 'log'
  message: string
  evidence: string
}

export interface GuardrailResult {
  passed: boolean
  violations: GuardrailViolation[]
}

// ── Guardrail registry ──

const guardrails: Guardrail[] = []
let loaded = false

/** Default token budget for output (configurable via custom guardrails) */
let tokenBudget = 16_000

// ── Built-in guardrails ──

/** API key / secret patterns that should never appear in output */
const SECRET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/, label: 'OpenAI API key (sk-)' },
  { pattern: /sk-ant-[a-zA-Z0-9-]{20,}/, label: 'Anthropic API key (sk-ant-)' },
  { pattern: /AKIA[A-Z0-9]{16}/, label: 'AWS access key (AKIA)' },
  { pattern: /ghp_[a-zA-Z0-9]{36,}/, label: 'GitHub personal access token (ghp_)' },
  { pattern: /gho_[a-zA-Z0-9]{36,}/, label: 'GitHub OAuth token (gho_)' },
  { pattern: /ghu_[a-zA-Z0-9]{36,}/, label: 'GitHub user-to-server token (ghu_)' },
  { pattern: /ghs_[a-zA-Z0-9]{36,}/, label: 'GitHub server-to-server token (ghs_)' },
  { pattern: /github_pat_[a-zA-Z0-9_]{22,}/, label: 'GitHub fine-grained PAT' },
  { pattern: /xoxb-[0-9]+-[a-zA-Z0-9]+/, label: 'Slack bot token (xoxb-)' },
  { pattern: /xoxp-[0-9]+-[a-zA-Z0-9]+/, label: 'Slack user token (xoxp-)' },
  { pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/, label: 'Private key (PEM)' },
  { pattern: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/, label: 'JWT token' },
  { pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/, label: 'SendGrid API key' },
  { pattern: /sk_live_[a-zA-Z0-9]{24,}/, label: 'Stripe secret key (sk_live_)' },
  { pattern: /rk_live_[a-zA-Z0-9]{24,}/, label: 'Stripe restricted key (rk_live_)' },
]

/** Destructive command patterns — extends bash.ts BLOCKED_PATTERNS */
const DESTRUCTIVE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /rm\s+-rf\s+\//, label: 'rm -rf /' },
  { pattern: /rm\s+-rf\s+~/, label: 'rm -rf ~' },
  { pattern: /rm\s+-rf\s+\*/, label: 'rm -rf *' },
  { pattern: /DROP\s+TABLE/i, label: 'DROP TABLE' },
  { pattern: /DROP\s+DATABASE/i, label: 'DROP DATABASE' },
  { pattern: /TRUNCATE\s+TABLE/i, label: 'TRUNCATE TABLE' },
  { pattern: /DELETE\s+FROM\s+\w+\s*;/i, label: 'DELETE FROM (no WHERE clause)' },
  { pattern: /git\s+push\s+.*--force/i, label: 'git push --force' },
  { pattern: /git\s+reset\s+--hard/i, label: 'git reset --hard' },
  { pattern: /mkfs\./i, label: 'mkfs (format filesystem)' },
  { pattern: /dd\s+if=.*of=\/dev\//i, label: 'dd to raw device' },
  { pattern: /chmod\s+-R\s+777/i, label: 'chmod -R 777' },
  { pattern: /:\(\)\s*\{.*\|.*&\s*\}/, label: 'fork bomb' },
]

/** PII patterns for detection */
const PII_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, label: 'email address' },
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, label: 'phone number' },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/, label: 'SSN' },
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, label: 'credit card number' },
]

// ── Built-in validators ──

type ValidatorFn = (content: string, args?: Record<string, unknown>) => GuardrailViolation[]

const VALIDATORS: Record<string, ValidatorFn> = {
  /** Detect secrets / API keys in content */
  'no-secrets': (content: string) => {
    const violations: GuardrailViolation[] = []
    for (const { pattern, label } of SECRET_PATTERNS) {
      const match = pattern.exec(content)
      if (match) {
        violations.push({
          guardrailId: 'no-secrets-in-output',
          severity: 'block',
          message: `Detected ${label} in content`,
          evidence: match[0].slice(0, 8) + '...' + match[0].slice(-4),
        })
      }
    }
    return violations
  },

  /** Detect destructive commands */
  'no-destructive': (content: string) => {
    const violations: GuardrailViolation[] = []
    for (const { pattern, label } of DESTRUCTIVE_PATTERNS) {
      const match = pattern.exec(content)
      if (match) {
        violations.push({
          guardrailId: 'no-destructive-commands',
          severity: 'warn',
          message: `Destructive command detected: ${label}`,
          evidence: match[0],
        })
      }
    }
    return violations
  },

  /** Check that file paths in write_file calls refer to existing directories */
  'no-hallucinated-files': (_content: string, args?: Record<string, unknown>) => {
    const violations: GuardrailViolation[] = []
    if (!args) return violations

    const filePath = args.file_path || args.path
    if (typeof filePath === 'string' && filePath.length > 0) {
      // Check that the parent directory exists
      const parentDir = filePath.replace(/\/[^/]+$/, '')
      if (parentDir && parentDir !== filePath && !existsSync(parentDir)) {
        violations.push({
          guardrailId: 'no-hallucinated-files',
          severity: 'warn',
          message: `Parent directory does not exist: ${parentDir}`,
          evidence: filePath,
        })
      }
    }
    return violations
  },

  /** Warn if output exceeds token budget (rough estimate: 1 token ~ 4 chars) */
  'token-budget': (content: string) => {
    const violations: GuardrailViolation[] = []
    const estimatedTokens = Math.ceil(content.length / 4)
    if (estimatedTokens > tokenBudget) {
      violations.push({
        guardrailId: 'token-budget',
        severity: 'warn',
        message: `Output exceeds token budget: ~${estimatedTokens} tokens (budget: ${tokenBudget})`,
        evidence: `${content.length} characters (~${estimatedTokens} tokens)`,
      })
    }
    return violations
  },

  /** Detect PII (emails, phone numbers, SSNs, credit cards) */
  'pii-filter': (content: string) => {
    const violations: GuardrailViolation[] = []
    for (const { pattern, label } of PII_PATTERNS) {
      const match = pattern.exec(content)
      if (match) {
        // Mask the evidence for safety
        const raw = match[0]
        const masked = raw.slice(0, 3) + '***' + raw.slice(-2)
        violations.push({
          guardrailId: 'pii-filter',
          severity: 'warn',
          message: `Possible ${label} detected in output`,
          evidence: masked,
        })
      }
    }
    return violations
  },
}

/** Built-in guardrail definitions (always active) */
const BUILTIN_GUARDRAILS: Guardrail[] = [
  {
    id: 'no-secrets-in-output',
    name: 'No Secrets in Output',
    type: 'output',
    severity: 'block',
    validator: 'no-secrets',
    message: 'Response contains API keys or secrets. Blocked to prevent accidental exposure.',
    enabled: true,
  },
  {
    id: 'no-destructive-commands',
    name: 'No Destructive Commands',
    type: 'tool',
    severity: 'warn',
    validator: 'no-destructive',
    message: 'Tool call contains a destructive command. Review carefully before proceeding.',
    enabled: true,
  },
  {
    id: 'no-hallucinated-files',
    name: 'No Hallucinated File Paths',
    type: 'tool',
    severity: 'warn',
    validator: 'no-hallucinated-files',
    message: 'File write targets a path whose parent directory does not exist.',
    enabled: true,
  },
  {
    id: 'token-budget',
    name: 'Token Budget',
    type: 'output',
    severity: 'warn',
    validator: 'token-budget',
    message: 'Response exceeds the configured token budget.',
    enabled: true,
  },
  {
    id: 'pii-filter',
    name: 'PII Filter',
    type: 'output',
    severity: 'warn',
    validator: 'pii-filter',
    message: 'Response may contain personally identifiable information.',
    enabled: true,
  },
]

// ── Loading ──

/** Path to user-defined custom guardrails */
function customGuardrailsPath(): string {
  return join(homedir(), '.kbot', 'guardrails.json')
}

/**
 * Load built-in guardrails and merge with user-defined custom guardrails
 * from ~/.kbot/guardrails.json.
 */
export function loadGuardrails(): Guardrail[] {
  guardrails.length = 0

  // Built-in guardrails
  for (const g of BUILTIN_GUARDRAILS) {
    guardrails.push({ ...g })
  }

  // Custom guardrails from ~/.kbot/guardrails.json
  const customPath = customGuardrailsPath()
  if (existsSync(customPath)) {
    try {
      const raw = readFileSync(customPath, 'utf-8')
      const customs = JSON.parse(raw) as Array<{
        id: string
        name: string
        type: 'input' | 'output' | 'tool'
        severity: 'block' | 'warn' | 'log'
        pattern?: string
        message: string
        enabled?: boolean
      }>

      for (const c of customs) {
        if (!c.id || !c.name || !c.type || !c.severity || !c.message) continue
        guardrails.push({
          id: c.id,
          name: c.name,
          type: c.type,
          severity: c.severity,
          pattern: c.pattern ? new RegExp(c.pattern, 'i') : undefined,
          message: c.message,
          enabled: c.enabled !== false,
        })
      }
    } catch (err) {
      printWarn(`Failed to load custom guardrails: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  loaded = true
  return guardrails
}

/** Ensure guardrails are loaded (lazy initialization) */
function ensureLoaded(): void {
  if (!loaded) loadGuardrails()
}

// ── Core check functions ──

/**
 * Run a single guardrail against content and optional tool args.
 */
function runGuardrail(
  guardrail: Guardrail,
  content: string,
  args?: Record<string, unknown>,
): GuardrailViolation[] {
  if (!guardrail.enabled) return []

  const violations: GuardrailViolation[] = []

  // Pattern-based check (custom guardrails)
  if (guardrail.pattern) {
    const match = guardrail.pattern.exec(content)
    if (match) {
      violations.push({
        guardrailId: guardrail.id,
        severity: guardrail.severity,
        message: guardrail.message,
        evidence: match[0].length > 80 ? match[0].slice(0, 80) + '...' : match[0],
      })
    }
  }

  // Validator-based check (built-in guardrails)
  if (guardrail.validator) {
    const validatorFn = VALIDATORS[guardrail.validator]
    if (validatorFn) {
      violations.push(...validatorFn(content, args))
    }
  }

  return violations
}

/**
 * Check input message before the agent processes it.
 * Runs all 'input' type guardrails.
 */
export function checkInput(message: string): GuardrailResult {
  ensureLoaded()

  const violations: GuardrailViolation[] = []
  for (const g of guardrails) {
    if (g.type !== 'input') continue
    violations.push(...runGuardrail(g, message))
  }

  // Also run secrets check on input (prevent prompt injection with keys)
  const secretViolations = VALIDATORS['no-secrets'](message)
  for (const v of secretViolations) {
    v.guardrailId = 'no-secrets-in-input'
    v.severity = 'warn'
    v.message = `Input contains ${v.message.replace('Detected ', '').replace(' in content', '')} — be cautious`
  }
  violations.push(...secretViolations)

  const hasBlocking = violations.some(v => v.severity === 'block')

  // Log violations
  for (const v of violations) {
    if (v.severity === 'block') {
      printError(`[guardrail] ${v.message}`)
    } else if (v.severity === 'warn') {
      printWarn(`[guardrail] ${v.message}`)
    }
    // 'log' severity: silent (can be checked by caller)
  }

  return { passed: !hasBlocking, violations }
}

/**
 * Check agent output before showing to the user.
 * Runs all 'output' type guardrails.
 */
export function checkOutput(response: string): GuardrailResult {
  ensureLoaded()

  const violations: GuardrailViolation[] = []
  for (const g of guardrails) {
    if (g.type !== 'output') continue
    violations.push(...runGuardrail(g, response))
  }

  const hasBlocking = violations.some(v => v.severity === 'block')

  // Log violations
  for (const v of violations) {
    if (v.severity === 'block') {
      printError(`[guardrail] ${v.message}`)
    } else if (v.severity === 'warn') {
      printWarn(`[guardrail] ${v.message}`)
    }
  }

  return { passed: !hasBlocking, violations }
}

/**
 * Check a tool call before execution.
 * Runs all 'tool' type guardrails against the tool name + serialized args.
 */
export function checkToolCall(
  toolName: string,
  args: Record<string, unknown>,
): GuardrailResult {
  ensureLoaded()

  // Build content string from tool name + args for pattern matching
  const content = `${toolName} ${JSON.stringify(args)}`
  const violations: GuardrailViolation[] = []

  for (const g of guardrails) {
    if (g.type !== 'tool') continue
    violations.push(...runGuardrail(g, content, args))
  }

  // Special handling for write_file — check hallucinated paths
  if (toolName === 'write_file' || toolName === 'edit_file') {
    const pathViolations = VALIDATORS['no-hallucinated-files']('', args)
    violations.push(...pathViolations)
  }

  // Check for destructive commands in bash tool calls
  if (toolName === 'bash' && typeof args.command === 'string') {
    const destructiveViolations = VALIDATORS['no-destructive'](args.command)
    violations.push(...destructiveViolations)
  }

  const hasBlocking = violations.some(v => v.severity === 'block')

  // Log violations
  for (const v of violations) {
    if (v.severity === 'block') {
      printError(`[guardrail] ${v.message}`)
    } else if (v.severity === 'warn') {
      printWarn(`[guardrail] ${v.message}`)
    }
  }

  return { passed: !hasBlocking, violations }
}

// ── Custom guardrail management ──

/**
 * Add a custom guardrail at runtime and persist to ~/.kbot/guardrails.json.
 */
export function addGuardrail(guardrail: Guardrail): void {
  ensureLoaded()

  // Replace if same ID exists
  const existingIdx = guardrails.findIndex(g => g.id === guardrail.id)
  if (existingIdx >= 0) {
    guardrails[existingIdx] = guardrail
  } else {
    guardrails.push(guardrail)
  }

  persistCustomGuardrails()
}

/**
 * Remove a custom guardrail by ID. Built-in guardrails cannot be removed
 * (they can only be disabled).
 */
export function removeGuardrail(id: string): boolean {
  ensureLoaded()

  const builtinIds = new Set(BUILTIN_GUARDRAILS.map(g => g.id))
  if (builtinIds.has(id)) {
    // Cannot remove built-in — disable instead
    const g = guardrails.find(gr => gr.id === id)
    if (g) {
      g.enabled = false
      return true
    }
    return false
  }

  const idx = guardrails.findIndex(g => g.id === id)
  if (idx < 0) return false

  guardrails.splice(idx, 1)
  persistCustomGuardrails()
  return true
}

/**
 * Set the token budget for the output token-budget guardrail.
 */
export function setTokenBudget(budget: number): void {
  tokenBudget = Math.max(100, budget)
}

/**
 * Get all currently loaded guardrails (built-in + custom).
 */
export function getGuardrails(): readonly Guardrail[] {
  ensureLoaded()
  return guardrails
}

// ── Persistence ──

/** Persist only custom guardrails (non-builtin) to ~/.kbot/guardrails.json */
function persistCustomGuardrails(): void {
  const builtinIds = new Set(BUILTIN_GUARDRAILS.map(g => g.id))
  const customs = guardrails
    .filter(g => !builtinIds.has(g.id))
    .map(g => ({
      id: g.id,
      name: g.name,
      type: g.type,
      severity: g.severity,
      pattern: g.pattern?.source,
      message: g.message,
      enabled: g.enabled,
    }))

  const kbotDir = join(homedir(), '.kbot')
  if (!existsSync(kbotDir)) {
    mkdirSync(kbotDir, { recursive: true })
  }

  try {
    writeFileSync(customGuardrailsPath(), JSON.stringify(customs, null, 2), 'utf-8')
  } catch (err) {
    printWarn(`Failed to save custom guardrails: ${err instanceof Error ? err.message : String(err)}`)
  }
}
