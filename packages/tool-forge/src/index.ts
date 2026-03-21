// @kernel.chat/tool-forge — Runtime Tool Creation for AI Agents
//
// Create new tools at runtime from structured definitions.
// The agent builds its own tools — no restart, no recompile.
//
// Usage:
//   import { ToolForge } from '@kernel.chat/tool-forge'
//
//   const forge = new ToolForge()
//
//   forge.create({
//     name: 'count_lines',
//     description: 'Count lines in a file',
//     parameters: { path: { type: 'string', description: 'File path', required: true } },
//     implementation: async (args) => {
//       const fs = await import('fs/promises')
//       const content = await fs.readFile(args.path as string, 'utf-8')
//       return `${content.split('\n').length} lines`
//     },
//   })
//
//   const result = await forge.execute('count_lines', { path: './README.md' })

// ── Types ──────────────────────────────────────────────────────────────

/** Parameter definition for a forged tool */
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required?: boolean
  default?: unknown
}

/** Tool definition — everything needed to create a tool at runtime */
export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, ToolParameter>
  /** The actual implementation */
  implementation: (args: Record<string, unknown>) => Promise<string>
  /** Optional timeout in ms (default: 30000) */
  timeout?: number
  /** Optional tags for categorization */
  tags?: string[]
  /** Who created this tool */
  createdBy?: string
  /** When this tool was created */
  createdAt?: string
}

/** Result of a tool execution */
export interface ToolResult {
  name: string
  result: string
  error?: string
  durationMs: number
}

/** Tool execution metrics */
export interface ToolMetrics {
  name: string
  calls: number
  errors: number
  totalDurationMs: number
  avgDurationMs: number
  lastCalled: string
}

/** Serializable tool definition (without the implementation function) */
export interface ToolManifest {
  name: string
  description: string
  parameters: Record<string, ToolParameter>
  tags: string[]
  createdBy: string
  createdAt: string
  metrics: ToolMetrics
}

// ── Implementation Templates ───────────────────────────────────────────

/** Pre-built implementation patterns for common tool types */
export const TEMPLATES = {
  /** Tool that runs a shell command */
  shell: (command: string) => async (args: Record<string, unknown>): Promise<string> => {
    const { execSync } = await import('child_process')
    // Substitute {{arg}} placeholders
    let cmd = command
    for (const [key, value] of Object.entries(args)) {
      cmd = cmd.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value))
    }
    return execSync(cmd, { encoding: 'utf-8', timeout: 30000 }).trim()
  },

  /** Tool that reads a file and transforms it */
  fileRead: (transform?: (content: string) => string) => async (args: Record<string, unknown>): Promise<string> => {
    const fs = await import('fs/promises')
    const content = await fs.readFile(args.path as string, 'utf-8')
    return transform ? transform(content) : content
  },

  /** Tool that fetches a URL */
  fetch: (options?: { headers?: Record<string, string> }) => async (args: Record<string, unknown>): Promise<string> => {
    const res = await globalThis.fetch(args.url as string, { headers: options?.headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
  },

  /** Tool that does a JSON API call */
  jsonApi: (baseUrl: string) => async (args: Record<string, unknown>): Promise<string> => {
    const path = args.path as string ?? ''
    const res = await globalThis.fetch(`${baseUrl}${path}`, {
      method: (args.method as string) ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: args.body ? JSON.stringify(args.body) : undefined,
    })
    return JSON.stringify(await res.json(), null, 2)
  },

  /** Tool that computes something from input */
  compute: (fn: (input: string) => string) => async (args: Record<string, unknown>): Promise<string> => {
    return fn(args.input as string)
  },
}

// ── Core Forge ─────────────────────────────────────────────────────────

export class ToolForge {
  private tools = new Map<string, ToolDefinition>()
  private metrics = new Map<string, ToolMetrics>()

  /**
   * Create and register a new tool.
   * Throws if a tool with the same name already exists (use replace to overwrite).
   */
  create(def: ToolDefinition): void {
    if (this.tools.has(def.name)) {
      throw new Error(`Tool "${def.name}" already exists. Use forge.replace() to overwrite.`)
    }
    def.createdAt = def.createdAt ?? new Date().toISOString()
    def.createdBy = def.createdBy ?? 'forge'
    def.tags = def.tags ?? []
    this.tools.set(def.name, def)
    this.metrics.set(def.name, {
      name: def.name,
      calls: 0,
      errors: 0,
      totalDurationMs: 0,
      avgDurationMs: 0,
      lastCalled: '',
    })
  }

  /** Replace an existing tool or create a new one */
  replace(def: ToolDefinition): void {
    this.tools.delete(def.name)
    this.create(def)
  }

  /** Remove a tool */
  remove(name: string): boolean {
    this.metrics.delete(name)
    return this.tools.delete(name)
  }

  /** Check if a tool exists */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /** Get a tool definition */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  /** List all tools */
  list(): ToolManifest[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      tags: t.tags ?? [],
      createdBy: t.createdBy ?? 'forge',
      createdAt: t.createdAt ?? '',
      metrics: this.metrics.get(t.name) ?? {
        name: t.name, calls: 0, errors: 0,
        totalDurationMs: 0, avgDurationMs: 0, lastCalled: '',
      },
    }))
  }

  /** List tools filtered by tag */
  listByTag(tag: string): ToolManifest[] {
    return this.list().filter(t => t.tags.includes(tag))
  }

  /**
   * Execute a tool by name with arguments.
   * Validates required parameters, applies defaults, enforces timeout.
   */
  async execute(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { name, result: '', error: `Unknown tool: ${name}`, durationMs: 0 }
    }

    // Validate required parameters
    for (const [key, param] of Object.entries(tool.parameters)) {
      if (param.required && !(key in args)) {
        return { name, result: '', error: `Missing required parameter: ${key}`, durationMs: 0 }
      }
      // Apply defaults
      if (!(key in args) && param.default !== undefined) {
        args[key] = param.default
      }
    }

    const timeout = tool.timeout ?? 30000
    const start = Date.now()

    try {
      const result = await Promise.race([
        tool.implementation(args),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Tool "${name}" timed out after ${timeout}ms`)), timeout)
        ),
      ])

      const durationMs = Date.now() - start
      this.recordMetric(name, durationMs, false)
      return { name, result, durationMs }
    } catch (err) {
      const durationMs = Date.now() - start
      this.recordMetric(name, durationMs, true)
      return { name, result: '', error: err instanceof Error ? err.message : String(err), durationMs }
    }
  }

  private recordMetric(name: string, durationMs: number, isError: boolean): void {
    const m = this.metrics.get(name)
    if (!m) return
    m.calls++
    if (isError) m.errors++
    m.totalDurationMs += durationMs
    m.avgDurationMs = m.totalDurationMs / m.calls
    m.lastCalled = new Date().toISOString()
  }

  /** Get metrics for a tool or all tools */
  getMetrics(name?: string): ToolMetrics[] {
    if (name) {
      const m = this.metrics.get(name)
      return m ? [m] : []
    }
    return Array.from(this.metrics.values()).sort((a, b) => b.calls - a.calls)
  }

  // ── Persistence ──

  /**
   * Export tool definitions as JSON (without implementations).
   * Implementations are functions and can't be serialized — only metadata is saved.
   */
  toJSON(): string {
    return JSON.stringify(this.list(), null, 2)
  }

  /** Save manifests to a file */
  save(path: string): void {
    const { writeFileSync, mkdirSync } = require('fs') as typeof import('fs')
    const { dirname } = require('path') as typeof import('path')
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, this.toJSON())
  }

  // ── Quick Creation Helpers ──

  /** Create a shell-command tool in one line */
  createShell(name: string, description: string, command: string, params?: Record<string, ToolParameter>): void {
    this.create({
      name,
      description,
      parameters: params ?? {},
      implementation: TEMPLATES.shell(command),
      tags: ['shell'],
    })
  }

  /** Create a file-reading tool in one line */
  createFileReader(name: string, description: string, transform?: (content: string) => string): void {
    this.create({
      name,
      description,
      parameters: { path: { type: 'string', description: 'File path', required: true } },
      implementation: TEMPLATES.fileRead(transform),
      tags: ['file'],
    })
  }

  /** Create a URL-fetching tool in one line */
  createFetcher(name: string, description: string, headers?: Record<string, string>): void {
    this.create({
      name,
      description,
      parameters: { url: { type: 'string', description: 'URL to fetch', required: true } },
      implementation: TEMPLATES.fetch({ headers }),
      tags: ['fetch'],
    })
  }

  /** Create a JSON API tool in one line */
  createApi(name: string, description: string, baseUrl: string): void {
    this.create({
      name,
      description,
      parameters: {
        path: { type: 'string', description: 'API path', default: '' },
        method: { type: 'string', description: 'HTTP method', default: 'GET' },
        body: { type: 'object', description: 'Request body (for POST/PUT)' },
      },
      implementation: TEMPLATES.jsonApi(baseUrl),
      tags: ['api'],
    })
  }

  /** Get a human-readable summary */
  summary(): string {
    const tools = this.list()
    const lines = [
      'Tool Forge',
      '═'.repeat(40),
      `${tools.length} tools registered`,
      '',
    ]

    for (const t of tools) {
      const params = Object.keys(t.parameters).join(', ') || 'none'
      lines.push(`  ${t.name} (${params}) — ${t.description.slice(0, 60)}`)
      if (t.metrics.calls > 0) {
        lines.push(`    ${t.metrics.calls} calls, ${t.metrics.errors} errors, avg ${t.metrics.avgDurationMs.toFixed(0)}ms`)
      }
    }

    return lines.join('\n')
  }
}
