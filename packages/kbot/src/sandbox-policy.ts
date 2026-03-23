// kbot Sandbox Policies — YAML-defined agent restrictions
//
// Inspired by NemoClaw's OpenShell sandbox.
// Each agent gets a policy defining what it can and cannot do.
//
// Default-deny: agents have NO permissions until explicitly granted.
// Policy files live in ~/.kbot/policies/agents/
//
// Example policy (coder.yaml):
//   allowedTools:
//     - read_file
//     - write_file
//     - edit_file
//     - bash
//     - grep
//     - glob
//   blockedTools:
//     - social_post
//     - forge_publish
//   allowedPaths:
//     - ./src/**
//     - ./tests/**
//   blockedPaths:
//     - .env
//     - ~/.ssh/**
//   maxExecutionTime: 300
//   networkAccess: false

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

// ── Types ──

export interface AgentPolicy {
  /** Agent ID this policy applies to */
  agentId: string
  /** Tools this agent is allowed to use (empty = all allowed) */
  allowedTools: string[]
  /** Tools explicitly blocked */
  blockedTools: string[]
  /** File paths the agent can access (glob patterns) */
  allowedPaths: string[]
  /** File paths the agent cannot access */
  blockedPaths: string[]
  /** Max execution time in seconds per tool call */
  maxExecutionTime: number
  /** Whether the agent can make network requests */
  networkAccess: boolean
  /** Whether the agent can execute shell commands */
  shellAccess: boolean
  /** Max file size the agent can write (bytes) */
  maxFileSize: number
  /** Whether the agent can install packages */
  canInstallPackages: boolean
}

// ── Paths ──

const POLICY_DIR = join(homedir(), '.kbot', 'policies', 'agents')

function ensureDir(): void {
  if (!existsSync(POLICY_DIR)) mkdirSync(POLICY_DIR, { recursive: true })
}

// ── Default Policies ──

const DEFAULT_POLICY: Omit<AgentPolicy, 'agentId'> = {
  allowedTools: [], // empty = all allowed
  blockedTools: ['social_post', 'forge_publish'], // conservative defaults
  allowedPaths: ['./**'],
  blockedPaths: ['.env', '.env.*', '*.pem', '*.key', '~/.ssh/**', '~/.aws/**'],
  maxExecutionTime: 300,
  networkAccess: true,
  shellAccess: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  canInstallPackages: false,
}

/** Strict policy for untrusted/new agents */
const STRICT_POLICY: Omit<AgentPolicy, 'agentId'> = {
  allowedTools: ['read_file', 'grep', 'glob', 'web_search'],
  blockedTools: ['bash', 'write_file', 'edit_file', 'forge_tool', 'social_post'],
  allowedPaths: ['./**'],
  blockedPaths: ['.env', '.env.*', '*.pem', '*.key', '~/.ssh/**', '~/.aws/**', 'node_modules/**'],
  maxExecutionTime: 60,
  networkAccess: false,
  shellAccess: false,
  maxFileSize: 0,
  canInstallPackages: false,
}

/** Built-in policies for known agents */
const BUILTIN_POLICIES: Record<string, Partial<AgentPolicy>> = {
  coder: {
    allowedTools: [],
    blockedTools: ['social_post'],
    shellAccess: true,
    networkAccess: true,
    canInstallPackages: true,
    maxExecutionTime: 600,
  },
  researcher: {
    allowedTools: ['read_file', 'grep', 'glob', 'web_search', 'url_fetch', 'research_arxiv', 'research_papers'],
    blockedTools: ['bash', 'write_file', 'edit_file'],
    shellAccess: false,
    networkAccess: true,
    canInstallPackages: false,
  },
  guardian: {
    allowedTools: [],
    blockedTools: ['social_post', 'forge_publish'],
    shellAccess: true,
    networkAccess: true,
    maxExecutionTime: 600,
  },
  hacker: {
    allowedTools: [],
    blockedTools: ['social_post', 'forge_publish'],
    shellAccess: true,
    networkAccess: true,
    maxExecutionTime: 300,
  },
  writer: {
    allowedTools: ['read_file', 'write_file', 'edit_file', 'grep', 'glob', 'web_search'],
    blockedTools: ['bash', 'forge_tool'],
    shellAccess: false,
    networkAccess: true,
    canInstallPackages: false,
  },
  gamedev: {
    allowedTools: [],
    blockedTools: ['social_post'],
    shellAccess: true,
    networkAccess: true,
    canInstallPackages: true,
    maxExecutionTime: 600,
  },
}

// ── Policy Loading ──

/** Load a specific agent's policy from file, falling back to builtins then defaults */
export function loadAgentPolicy(agentId: string): AgentPolicy {
  const filePath = join(POLICY_DIR, `${agentId}.yaml`)

  // Try user-defined policy file first
  if (existsSync(filePath)) {
    try {
      const content = readFileSync(filePath, 'utf8')
      return parsePolicy(agentId, content)
    } catch { /* fall through to builtins */ }
  }

  // Try builtin policy
  const builtin = BUILTIN_POLICIES[agentId]
  if (builtin) {
    return { agentId, ...DEFAULT_POLICY, ...builtin }
  }

  // Default policy
  return { agentId, ...DEFAULT_POLICY }
}

/** Parse a YAML-like policy file */
function parsePolicy(agentId: string, content: string): AgentPolicy {
  const policy: AgentPolicy = { agentId, ...DEFAULT_POLICY }

  // Parse list fields
  const listFields = ['allowedTools', 'blockedTools', 'allowedPaths', 'blockedPaths'] as const
  for (const field of listFields) {
    const section = content.match(new RegExp(`${field}:\\n((?:\\s+-\\s+.+\\n?)+)`))
    if (section) {
      (policy as any)[field] = section[1]
        .split('\n')
        .map(l => l.replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    }
  }

  // Parse scalar fields
  const maxTime = content.match(/maxExecutionTime:\s*(\d+)/)
  if (maxTime) policy.maxExecutionTime = Number(maxTime[1])

  const network = content.match(/networkAccess:\s*(true|false)/)
  if (network) policy.networkAccess = network[1] === 'true'

  const shell = content.match(/shellAccess:\s*(true|false)/)
  if (shell) policy.shellAccess = shell[1] === 'true'

  const maxFile = content.match(/maxFileSize:\s*(\d+)/)
  if (maxFile) policy.maxFileSize = Number(maxFile[1])

  const install = content.match(/canInstallPackages:\s*(true|false)/)
  if (install) policy.canInstallPackages = install[1] === 'true'

  return policy
}

// ── Policy Enforcement ──

export interface PolicyCheckResult {
  allowed: boolean
  reason?: string
}

/** Check if an agent is allowed to use a specific tool */
export function checkToolAccess(agentId: string, toolName: string, policy?: AgentPolicy): PolicyCheckResult {
  const p = policy || loadAgentPolicy(agentId)

  // Blocked tools take priority
  if (p.blockedTools.includes(toolName)) {
    return { allowed: false, reason: `Tool "${toolName}" is blocked for agent "${agentId}"` }
  }

  // If allowedTools is non-empty, tool must be in the list
  if (p.allowedTools.length > 0 && !p.allowedTools.includes(toolName)) {
    return { allowed: false, reason: `Tool "${toolName}" is not in allowed list for agent "${agentId}"` }
  }

  // Shell access check
  if (toolName === 'bash' && !p.shellAccess) {
    return { allowed: false, reason: `Shell access denied for agent "${agentId}"` }
  }

  // Network access check
  if (['web_search', 'url_fetch', 'research_arxiv'].includes(toolName) && !p.networkAccess) {
    return { allowed: false, reason: `Network access denied for agent "${agentId}"` }
  }

  return { allowed: true }
}

/** Check if an agent can access a file path */
export function checkPathAccess(agentId: string, filePath: string, policy?: AgentPolicy): PolicyCheckResult {
  const p = policy || loadAgentPolicy(agentId)
  const normalized = filePath.toLowerCase()

  // Check blocked paths first
  for (const blocked of p.blockedPaths) {
    const b = blocked.toLowerCase()
    if (b.startsWith('**/')) {
      if (normalized.includes(b.slice(3))) {
        return { allowed: false, reason: `Path "${filePath}" is blocked for agent "${agentId}"` }
      }
    } else if (b.startsWith('*.')) {
      if (normalized.endsWith(b.slice(1))) {
        return { allowed: false, reason: `File type "${b}" is blocked for agent "${agentId}"` }
      }
    } else {
      if (normalized.endsWith(b) || normalized.includes(`/${b}`)) {
        return { allowed: false, reason: `Path "${filePath}" is blocked for agent "${agentId}"` }
      }
    }
  }

  return { allowed: true }
}

// ── Policy Management ──

/** List all agent policies (builtin + user-defined) */
export function listPolicies(): Array<{ agentId: string; source: 'builtin' | 'user'; policy: AgentPolicy }> {
  const result: Array<{ agentId: string; source: 'builtin' | 'user'; policy: AgentPolicy }> = []

  // User-defined policies
  ensureDir()
  try {
    const files = readdirSync(POLICY_DIR).filter(f => f.endsWith('.yaml'))
    for (const f of files) {
      const agentId = f.replace('.yaml', '')
      result.push({ agentId, source: 'user', policy: loadAgentPolicy(agentId) })
    }
  } catch { /* ignore */ }

  // Builtin policies (not already loaded from user files)
  const userIds = new Set(result.map(r => r.agentId))
  for (const [agentId] of Object.entries(BUILTIN_POLICIES)) {
    if (!userIds.has(agentId)) {
      result.push({ agentId, source: 'builtin', policy: loadAgentPolicy(agentId) })
    }
  }

  return result
}

/** Write a policy file for an agent */
export function writeAgentPolicy(agentId: string, policy: AgentPolicy): void {
  ensureDir()
  const filePath = join(POLICY_DIR, `${agentId}.yaml`)
  const yaml = `# kbot Sandbox Policy for agent: ${agentId}
# Edit this file to customize what this agent can do.

allowedTools:
${policy.allowedTools.map(t => `  - ${t}`).join('\n') || '  # empty = all allowed'}

blockedTools:
${policy.blockedTools.map(t => `  - ${t}`).join('\n')}

allowedPaths:
${policy.allowedPaths.map(p => `  - "${p}"`).join('\n')}

blockedPaths:
${policy.blockedPaths.map(p => `  - "${p}"`).join('\n')}

maxExecutionTime: ${policy.maxExecutionTime}
networkAccess: ${policy.networkAccess}
shellAccess: ${policy.shellAccess}
maxFileSize: ${policy.maxFileSize}
canInstallPackages: ${policy.canInstallPackages}
`
  writeFileSync(filePath, yaml)
}

export { DEFAULT_POLICY, STRICT_POLICY, BUILTIN_POLICIES }
