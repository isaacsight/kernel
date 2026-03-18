// kbot Local AI Tools
//
// Integrates kbot Local's AI capabilities as kbot tools.
// These run entirely on the user's machine — no cloud API needed.
//
// ENHANCEMENTS (v2.3):
//   - Configurable gateway URL via KBOT_LOCAL_URL env var
//   - Health check with graceful degradation (tools skip if gateway offline)
//   - Connection status caching (recheck every 60s)

import { registerTool } from './index.js'

const KBOT_LOCAL_BASE = process.env.KBOT_LOCAL_URL || 'http://127.0.0.1:18789'

/** Connection health state */
let _gatewayOnline: boolean | null = null  // null = unknown
let _lastHealthCheck = 0
const HEALTH_CHECK_INTERVAL = 60_000 // 60 seconds

/** Check if kbot Local gateway is reachable (cached) */
async function isGatewayOnline(): Promise<boolean> {
  const now = Date.now()
  if (_gatewayOnline !== null && (now - _lastHealthCheck) < HEALTH_CHECK_INTERVAL) {
    return _gatewayOnline
  }

  try {
    const res = await fetch(`${KBOT_LOCAL_BASE}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    _gatewayOnline = res.ok
  } catch {
    _gatewayOnline = false
  }
  _lastHealthCheck = now
  return _gatewayOnline
}

/** Call a kbot Local endpoint with graceful degradation */
async function callKbotLocal(
  endpoint: string,
  payload: Record<string, unknown>,
  timeout = 120_000,
): Promise<string> {
  // Quick health check — skip if gateway known to be offline
  const online = await isGatewayOnline()
  if (!online) {
    return `kbot Local gateway is offline. Start it with: kbot gateway start\nOr set KBOT_LOCAL_URL env var if running on a different port.`
  }

  try {
    const res = await fetch(`${KBOT_LOCAL_BASE}/v1/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeout),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => `HTTP ${res.status}`)
      return `Error: kbot Local ${endpoint} failed — ${err}`
    }

    const data = await res.json()
    return data.result || data.output || data.text || JSON.stringify(data, null, 2)
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return `Error: kbot Local ${endpoint} timed out after ${timeout / 1000}s`
    }
    // Mark gateway as offline for next check
    _gatewayOnline = false
    _lastHealthCheck = Date.now()
    return `Error: kbot Local gateway not reachable at ${KBOT_LOCAL_BASE}. Start it with: kbot gateway start`
  }
}

export function registerKbotLocalTools(): void {
  registerTool({
    name: 'kbot_local_explain',
    description: '[Local AI] Explain code using a local model. No API costs.',
    parameters: {
      code: { type: 'string', description: 'The code to explain', required: true },
      language: { type: 'string', description: 'Programming language (auto-detected if omitted)' },
    },
    tier: 'free',
    async execute(args) {
      return callKbotLocal('explain', { code: String(args.code), language: args.language })
    },
  })

  registerTool({
    name: 'kbot_local_review',
    description: '[Local AI] Review code for bugs, security issues, and style.',
    parameters: {
      code: { type: 'string', description: 'The code to review', required: true },
      focus: { type: 'string', description: 'Review focus: bugs, security, performance, style' },
    },
    tier: 'free',
    async execute(args) {
      return callKbotLocal('review', { code: String(args.code), focus: args.focus || 'all' })
    },
  })

  registerTool({
    name: 'kbot_local_refactor',
    description: '[Local AI] Suggest code refactoring improvements.',
    parameters: {
      code: { type: 'string', description: 'The code to refactor', required: true },
      goal: { type: 'string', description: 'Goal: readability, performance, DRY, testability' },
    },
    tier: 'free',
    async execute(args) {
      return callKbotLocal('refactor', { code: String(args.code), goal: args.goal || 'readability' })
    },
  })

  registerTool({
    name: 'kbot_local_test_gen',
    description: '[Local AI] Generate test cases for code.',
    parameters: {
      code: { type: 'string', description: 'The code to test', required: true },
      framework: { type: 'string', description: 'Test framework: jest, vitest, pytest, go' },
    },
    tier: 'free',
    async execute(args) {
      return callKbotLocal('test_gen', { code: String(args.code), framework: args.framework })
    },
  })

  registerTool({
    name: 'kbot_local_ask',
    description: '[Local AI] Ask a question to local AI. No cloud API needed.',
    parameters: {
      question: { type: 'string', description: 'The question to ask', required: true },
      context: { type: 'string', description: 'Additional context or code' },
    },
    tier: 'free',
    async execute(args) {
      return callKbotLocal('ask', { question: String(args.question), context: args.context })
    },
  })

  registerTool({
    name: 'kbot_local_diagram',
    description: '[Local AI] Generate Mermaid diagrams from description or code.',
    parameters: {
      input: { type: 'string', description: 'Description or code to diagram', required: true },
      type: { type: 'string', description: 'Diagram type: flowchart, sequence, class, state, er' },
    },
    tier: 'free',
    async execute(args) {
      return callKbotLocal('diagram', { input: String(args.input), type: args.type || 'auto' })
    },
  })

  registerTool({
    name: 'kbot_local_regex',
    description: '[Local AI] Build or explain regex patterns.',
    parameters: {
      input: { type: 'string', description: 'Description OR regex to explain', required: true },
      mode: { type: 'string', description: '"build" or "explain" (default: auto)' },
    },
    tier: 'free',
    async execute(args) {
      return callKbotLocal('regex', { input: String(args.input), mode: args.mode || 'auto' })
    },
  })

  registerTool({
    name: 'kbot_local_sql',
    description: '[Local AI] Write or explain SQL queries.',
    parameters: {
      input: { type: 'string', description: 'Natural language OR SQL to explain', required: true },
      dialect: { type: 'string', description: 'SQL dialect: postgres, mysql, sqlite' },
    },
    tier: 'free',
    async execute(args) {
      return callKbotLocal('sql', { input: String(args.input), dialect: args.dialect || 'postgres' })
    },
  })

  registerTool({
    name: 'kbot_local_shell',
    description: '[Local AI] Explain shell commands or build them from description.',
    parameters: {
      input: { type: 'string', description: 'Command to explain OR description to build', required: true },
      mode: { type: 'string', description: '"explain" or "build" (default: auto)' },
    },
    tier: 'free',
    async execute(args) {
      return callKbotLocal('shell_explain', { input: String(args.input), mode: args.mode || 'auto' })
    },
  })

  registerTool({
    name: 'kbot_local_summarize',
    description: '[Local AI] Summarize text or code.',
    parameters: {
      text: { type: 'string', description: 'Text or code to summarize', required: true },
      length: { type: 'string', description: 'Length: short, medium, long' },
    },
    tier: 'free',
    async execute(args) {
      return callKbotLocal('summarize', { text: String(args.text), length: args.length || 'medium' })
    },
  })
}
