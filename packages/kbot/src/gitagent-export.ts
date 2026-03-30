// kbot GitAgent Export — Universal agent format for cross-platform portability
// GitAgent spec: framework-agnostic agent definitions that work across
// OpenAI Assistants, Claude Code, LangChain, CrewAI, and more.
//
// Usage: kbot export --format gitagent [agent-id]

import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'

// ── GitAgent Spec Types ──

export interface GitAgentManifest {
  version: '1.0'
  agent: GitAgentDefinition
  metadata: GitAgentMetadata
}

export interface GitAgentDefinition {
  name: string
  description: string
  instructions: string
  model?: string
  tools: GitAgentTool[]
  capabilities: string[]
  input_modes: string[]
  output_modes: string[]
}

export interface GitAgentTool {
  name: string
  description: string
  parameters: Record<string, { type: string; description: string; required?: boolean }>
}

export interface GitAgentMetadata {
  source: 'kbot'
  source_version: string
  exported_at: string
  agent_id: string
  compatibility: string[]
}

// ── Built-in agent definitions for export ──

interface KbotAgentSpec {
  id: string
  name: string
  description: string
  instructions: string
  capabilities: string[]
  tools: string[]
}

const EXPORTABLE_AGENTS: KbotAgentSpec[] = [
  {
    id: 'kernel',
    name: 'Kernel',
    description: 'General-purpose AI agent — personal assistant, coding, research, and conversation',
    instructions: 'You are Kernel, a general-purpose AI agent. You help with coding, research, writing, analysis, and conversation. You have access to file system tools, web search, and shell execution. Be concise, act autonomously, and verify your work.',
    capabilities: ['coding', 'research', 'writing', 'analysis', 'conversation', 'file-management'],
    tools: ['file_read', 'file_write', 'bash', 'web_search', 'git_status'],
  },
  {
    id: 'coder',
    name: 'Coder',
    description: 'Programming specialist — writes, reviews, refactors, and debugs code',
    instructions: 'You are Coder, a programming specialist. You write clean, tested, production-ready code. You review code for bugs, security issues, and performance problems. You refactor for clarity and maintainability. Always run tests after changes.',
    capabilities: ['code-generation', 'code-review', 'refactoring', 'debugging', 'testing'],
    tools: ['file_read', 'file_write', 'file_glob', 'file_grep', 'bash', 'git_diff', 'git_commit'],
  },
  {
    id: 'researcher',
    name: 'Researcher',
    description: 'Research and fact-finding specialist — deep dives, source verification, synthesis',
    instructions: 'You are Researcher, a research specialist. You find accurate information, verify sources, synthesize findings, and present clear summaries. You search the web, read documentation, and cross-reference data. Cite sources.',
    capabilities: ['research', 'fact-checking', 'synthesis', 'source-verification'],
    tools: ['web_search', 'url_fetch', 'file_read', 'file_write'],
  },
  {
    id: 'writer',
    name: 'Writer',
    description: 'Content creation specialist — articles, documentation, copywriting',
    instructions: 'You are Writer, a content creation specialist. You write clear, engaging prose for technical documentation, blog posts, README files, and marketing copy. You adapt tone and style to the audience.',
    capabilities: ['writing', 'documentation', 'copywriting', 'editing'],
    tools: ['file_read', 'file_write', 'web_search'],
  },
  {
    id: 'guardian',
    name: 'Guardian',
    description: 'Security specialist — vulnerability scanning, secret detection, dependency audit',
    instructions: 'You are Guardian, a security specialist. You scan code for vulnerabilities (OWASP Top 10), detect hardcoded secrets, audit dependencies for CVEs, check SSL configurations, and review authentication flows. Report findings with severity and remediation steps.',
    capabilities: ['security-audit', 'vulnerability-scanning', 'secret-detection', 'dependency-audit'],
    tools: ['file_read', 'file_grep', 'bash', 'web_search'],
  },
  {
    id: 'analyst',
    name: 'Analyst',
    description: 'Strategy and evaluation specialist — data analysis, market research, decision frameworks',
    instructions: 'You are Analyst, a strategy specialist. You analyze data, evaluate options using structured frameworks, conduct market research, and provide actionable recommendations. Use quantitative reasoning where possible.',
    capabilities: ['data-analysis', 'strategy', 'market-research', 'evaluation'],
    tools: ['web_search', 'file_read', 'file_write', 'bash'],
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure',
    description: 'DevOps and infrastructure specialist — CI/CD, containers, cloud deployment',
    instructions: 'You are Infrastructure, a DevOps specialist. You manage CI/CD pipelines, containerize applications, configure cloud deployments, monitor system health, and optimize infrastructure costs. You work with Docker, Kubernetes, Terraform, and cloud providers.',
    capabilities: ['devops', 'ci-cd', 'containers', 'cloud-deployment', 'monitoring'],
    tools: ['bash', 'file_read', 'file_write', 'git_status', 'git_commit'],
  },
  {
    id: 'investigator',
    name: 'Investigator',
    description: 'Deep research specialist — multi-source investigation, pattern detection, timeline analysis',
    instructions: 'You are Investigator, a deep research specialist. You conduct thorough multi-source investigations, detect patterns across data, build timelines, and produce comprehensive reports. You go deeper than surface-level research.',
    capabilities: ['deep-research', 'investigation', 'pattern-detection', 'timeline-analysis'],
    tools: ['web_search', 'url_fetch', 'file_read', 'file_write', 'bash'],
  },
  {
    id: 'trader',
    name: 'Trader',
    description: 'Finance and trading specialist — market analysis, portfolio management, DeFi',
    instructions: 'You are Trader, a finance specialist. You analyze markets, manage portfolios, execute trades, track whale movements, and evaluate DeFi protocols. You use technical analysis and sentiment data. Always assess risk before recommending actions.',
    capabilities: ['trading', 'market-analysis', 'portfolio-management', 'defi', 'risk-assessment'],
    tools: ['web_search', 'bash', 'file_read', 'file_write'],
  },
]

// ── Export Functions ──

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url).pathname, 'utf-8'))
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function kbotToolToGitAgent(toolName: string): GitAgentTool {
  const toolMap: Record<string, GitAgentTool> = {
    file_read: { name: 'read_file', description: 'Read file contents', parameters: { path: { type: 'string', description: 'File path', required: true } } },
    file_write: { name: 'write_file', description: 'Write content to file', parameters: { path: { type: 'string', description: 'File path', required: true }, content: { type: 'string', description: 'File content', required: true } } },
    file_glob: { name: 'glob', description: 'Find files matching a pattern', parameters: { pattern: { type: 'string', description: 'Glob pattern', required: true } } },
    file_grep: { name: 'grep', description: 'Search file contents with regex', parameters: { pattern: { type: 'string', description: 'Regex pattern', required: true }, path: { type: 'string', description: 'Search path' } } },
    bash: { name: 'run_command', description: 'Execute a shell command', parameters: { command: { type: 'string', description: 'Shell command', required: true } } },
    web_search: { name: 'web_search', description: 'Search the web', parameters: { query: { type: 'string', description: 'Search query', required: true } } },
    url_fetch: { name: 'fetch_url', description: 'Fetch content from a URL', parameters: { url: { type: 'string', description: 'URL to fetch', required: true } } },
    git_status: { name: 'git_status', description: 'Get git repository status', parameters: {} },
    git_diff: { name: 'git_diff', description: 'Show git diff', parameters: { ref: { type: 'string', description: 'Git ref to diff against' } } },
    git_commit: { name: 'git_commit', description: 'Create a git commit', parameters: { message: { type: 'string', description: 'Commit message', required: true } } },
  }
  return toolMap[toolName] ?? { name: toolName, description: toolName, parameters: {} }
}

export function exportAgent(agentId: string): GitAgentManifest | null {
  const agent = EXPORTABLE_AGENTS.find(a => a.id === agentId)
  if (!agent) return null

  return {
    version: '1.0',
    agent: {
      name: agent.name,
      description: agent.description,
      instructions: agent.instructions,
      tools: agent.tools.map(kbotToolToGitAgent),
      capabilities: agent.capabilities,
      input_modes: ['text'],
      output_modes: ['text'],
    },
    metadata: {
      source: 'kbot',
      source_version: getVersion(),
      exported_at: new Date().toISOString(),
      agent_id: agentId,
      compatibility: ['openai-assistants', 'claude-code', 'langchain', 'crewai', 'autogen'],
    },
  }
}

export function exportAllAgents(): GitAgentManifest[] {
  return EXPORTABLE_AGENTS.map(a => exportAgent(a.id)!).filter(Boolean)
}

export function writeGitAgentFile(agentId: string, outputDir?: string): string {
  const manifest = exportAgent(agentId)
  if (!manifest) throw new Error(`Agent not found: ${agentId}. Available: ${EXPORTABLE_AGENTS.map(a => a.id).join(', ')}`)

  const dir = outputDir ?? process.cwd()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const filePath = join(dir, `${agentId}.gitagent.json`)
  writeFileSync(filePath, JSON.stringify(manifest, null, 2))
  return filePath
}

export function writeAllGitAgentFiles(outputDir?: string): string[] {
  return EXPORTABLE_AGENTS.map(a => writeGitAgentFile(a.id, outputDir))
}

export function listExportableAgents(): Array<{ id: string; name: string; description: string }> {
  return EXPORTABLE_AGENTS.map(a => ({ id: a.id, name: a.name, description: a.description }))
}

export function formatExportableAgentList(): string {
  const lines = ['Available agents for GitAgent export:', '']
  for (const a of EXPORTABLE_AGENTS) {
    lines.push(`  ${a.id.padEnd(16)} ${a.description}`)
  }
  lines.push('')
  lines.push('Export: kbot export --format gitagent <agent-id>')
  lines.push('Export all: kbot export --format gitagent --all')
  return lines.join('\n')
}
