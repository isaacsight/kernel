// kbot LSP Client — Full Language Server Protocol integration
//
// Persistent LSP client connections for language intelligence:
//   - Go-to-definition, find-references, hover, completions
//   - Rename refactoring, document symbols, diagnostics
//   - Auto-detects and spawns the right LSP server per language
//   - JSON-RPC over stdio with Content-Length framing
//
// Unlike the one-shot lsp-bridge.ts (diagnostics only), this module
// maintains persistent connections for interactive queries.

import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { extname, resolve, join } from 'node:path'

// ── Types ──

export interface LspLocation {
  uri: string
  range: LspRange
}

export interface LspRange {
  start: LspPosition
  end: LspPosition
}

export interface LspPosition {
  line: number
  character: number
}

export interface LspDiagnostic {
  range: LspRange
  severity?: number
  code?: string | number
  source?: string
  message: string
}

export interface LspSymbol {
  name: string
  kind: number
  range: LspRange
  selectionRange: LspRange
  children?: LspSymbol[]
}

export interface LspCompletionItem {
  label: string
  kind?: number
  detail?: string
  documentation?: string | { kind: string; value: string }
  insertText?: string
}

export interface LspHoverResult {
  contents: string | { kind: string; value: string } | Array<string | { kind: string; value: string }>
  range?: LspRange
}

export interface LspWorkspaceEdit {
  changes?: Record<string, Array<{ range: LspRange; newText: string }>>
  documentChanges?: Array<{
    textDocument: { uri: string; version?: number | null }
    edits: Array<{ range: LspRange; newText: string }>
  }>
}

interface JsonRpcMessage {
  jsonrpc: '2.0'
  id?: number
  method?: string
  params?: unknown
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

// ── Constants ──

const REQUEST_TIMEOUT = 10_000 // 10 seconds

/** LSP server commands by language identifier */
const SERVER_COMMANDS: Record<string, string[][]> = {
  typescript: [
    ['typescript-language-server', '--stdio'],
  ],
  typescriptreact: [
    ['typescript-language-server', '--stdio'],
  ],
  javascript: [
    ['typescript-language-server', '--stdio'],
  ],
  javascriptreact: [
    ['typescript-language-server', '--stdio'],
  ],
  python: [
    ['pyright-langserver', '--stdio'],
    ['pylsp'],
  ],
  go: [
    ['gopls', 'serve'],
  ],
  rust: [
    ['rust-analyzer'],
  ],
}

/** Map file extensions to language IDs */
const EXT_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.pyi': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.json': 'json',
  '.css': 'css',
  '.html': 'html',
  '.md': 'markdown',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
}

/** Symbol kind number → human-readable name */
const SYMBOL_KINDS: Record<number, string> = {
  1: 'File', 2: 'Module', 3: 'Namespace', 4: 'Package',
  5: 'Class', 6: 'Method', 7: 'Property', 8: 'Field',
  9: 'Constructor', 10: 'Enum', 11: 'Interface', 12: 'Function',
  13: 'Variable', 14: 'Constant', 15: 'String', 16: 'Number',
  17: 'Boolean', 18: 'Array', 19: 'Object', 20: 'Key',
  21: 'Null', 22: 'EnumMember', 23: 'Struct', 24: 'Event',
  25: 'Operator', 26: 'TypeParameter',
}

/** Completion item kind number → human-readable name */
const COMPLETION_KINDS: Record<number, string> = {
  1: 'Text', 2: 'Method', 3: 'Function', 4: 'Constructor',
  5: 'Field', 6: 'Variable', 7: 'Class', 8: 'Interface',
  9: 'Module', 10: 'Property', 11: 'Unit', 12: 'Value',
  13: 'Enum', 14: 'Keyword', 15: 'Snippet', 16: 'Color',
  17: 'File', 18: 'Reference', 19: 'Folder', 20: 'EnumMember',
  21: 'Constant', 22: 'Struct', 23: 'Event', 24: 'Operator',
  25: 'TypeParameter',
}

// ── LSP Connection ──

class LspConnection {
  private process: ChildProcess
  private buffer = ''
  private nextId = 1
  private pending = new Map<number, PendingRequest>()
  private notificationHandlers = new Map<string, (params: unknown) => void>()
  private diagnosticsStore = new Map<string, LspDiagnostic[]>()
  private initialized = false
  private rootUri: string

  constructor(
    private language: string,
    private command: string[],
    private workspaceRoot: string,
  ) {
    this.rootUri = pathToUri(workspaceRoot)

    this.process = spawn(command[0], command.slice(1), {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: workspaceRoot,
    })

    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString()
      this.drainBuffer()
    })

    this.process.stderr?.on('data', () => {
      // Discard stderr — some LSP servers are noisy
    })

    this.process.on('error', () => {
      // Reject all pending requests
      for (const [id, req] of this.pending) {
        clearTimeout(req.timer)
        req.reject(new Error(`LSP server process error (${this.language})`))
        this.pending.delete(id)
      }
    })

    this.process.on('exit', () => {
      for (const [id, req] of this.pending) {
        clearTimeout(req.timer)
        req.reject(new Error(`LSP server exited unexpectedly (${this.language})`))
        this.pending.delete(id)
      }
    })

    // Store incoming diagnostics
    this.onNotification('textDocument/publishDiagnostics', (params) => {
      const p = params as { uri: string; diagnostics: LspDiagnostic[] }
      this.diagnosticsStore.set(p.uri, p.diagnostics)
    })
  }

  /** Parse complete JSON-RPC messages from the buffer */
  private drainBuffer(): void {
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n')
      if (headerEnd === -1) break

      const header = this.buffer.slice(0, headerEnd)
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i)
      if (!lengthMatch) {
        // Malformed header — skip past it
        this.buffer = this.buffer.slice(headerEnd + 4)
        continue
      }

      const contentLength = parseInt(lengthMatch[1], 10)
      const bodyStart = headerEnd + 4
      const bodyEnd = bodyStart + contentLength

      if (this.buffer.length < bodyEnd) break // Incomplete body

      const body = this.buffer.slice(bodyStart, bodyEnd)
      this.buffer = this.buffer.slice(bodyEnd)

      try {
        const msg: JsonRpcMessage = JSON.parse(body)
        this.handleMessage(msg)
      } catch {
        // Skip malformed JSON
      }
    }
  }

  /** Dispatch an incoming message to the right handler */
  private handleMessage(msg: JsonRpcMessage): void {
    // Response to a request we sent
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const pending = this.pending.get(msg.id as number)
      if (pending) {
        clearTimeout(pending.timer)
        this.pending.delete(msg.id as number)
        if (msg.error) {
          pending.reject(new Error(`LSP error ${msg.error.code}: ${msg.error.message}`))
        } else {
          pending.resolve(msg.result)
        }
      }
      return
    }

    // Notification from the server
    if (msg.method) {
      const handler = this.notificationHandlers.get(msg.method)
      if (handler) handler(msg.params)
    }
  }

  /** Register a handler for a server notification */
  onNotification(method: string, handler: (params: unknown) => void): void {
    this.notificationHandlers.set(method, handler)
  }

  /** Send a JSON-RPC request and wait for the response */
  request(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process.stdin?.writable) {
        reject(new Error(`LSP server stdin not writable (${this.language})`))
        return
      }

      const id = this.nextId++
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`LSP request '${method}' timed out after ${REQUEST_TIMEOUT / 1000}s`))
      }, REQUEST_TIMEOUT)

      this.pending.set(id, { resolve, reject, timer })

      const msg: JsonRpcMessage = { jsonrpc: '2.0', id, method, params }
      const body = JSON.stringify(msg)
      const frame = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
      this.process.stdin.write(frame)
    })
  }

  /** Send a JSON-RPC notification (no response expected) */
  notify(method: string, params: unknown): void {
    if (!this.process.stdin?.writable) return
    const msg: JsonRpcMessage = { jsonrpc: '2.0', method, params }
    const body = JSON.stringify(msg)
    const frame = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
    this.process.stdin.write(frame)
  }

  /** Perform the LSP initialize handshake */
  async initialize(): Promise<void> {
    if (this.initialized) return

    await this.request('initialize', {
      processId: process.pid,
      clientInfo: { name: 'kbot', version: '2.7.0' },
      rootUri: this.rootUri,
      workspaceFolders: [{ uri: this.rootUri, name: 'workspace' }],
      capabilities: {
        textDocument: {
          synchronization: {
            didOpen: true,
            didChange: true,
            didClose: true,
          },
          publishDiagnostics: {
            relatedInformation: true,
            tagSupport: { valueSet: [1, 2] },
          },
          completion: {
            completionItem: {
              snippetSupport: false,
              documentationFormat: ['markdown', 'plaintext'],
              resolveSupport: { properties: ['documentation', 'detail'] },
            },
          },
          hover: {
            contentFormat: ['markdown', 'plaintext'],
          },
          definition: { linkSupport: false },
          references: {},
          rename: { prepareSupport: true },
          documentSymbol: {
            hierarchicalDocumentSymbolSupport: true,
          },
        },
        workspace: {
          workspaceFolders: true,
        },
      },
    })

    this.notify('initialized', {})
    this.initialized = true
  }

  /** Tell the server about an opened file */
  didOpen(uri: string, languageId: string, text: string): void {
    this.notify('textDocument/didOpen', {
      textDocument: { uri, languageId, version: 1, text },
    })
  }

  /** Get stored diagnostics for a URI */
  getDiagnostics(uri: string): LspDiagnostic[] {
    return this.diagnosticsStore.get(uri) || []
  }

  /** Graceful shutdown */
  async shutdown(): Promise<void> {
    try {
      await this.request('shutdown', null)
      this.notify('exit', null)
    } catch {
      // Force kill if shutdown fails
    }
    setTimeout(() => {
      try { this.process.kill() } catch { /* already dead */ }
    }, 500)
  }

  get isAlive(): boolean {
    return !this.process.killed && this.process.exitCode === null
  }
}

// ── Server Manager ──

/** Active LSP connections keyed by language */
const connections = new Map<string, LspConnection>()

/** Files already opened on each connection, keyed by language → Set<uri> */
const openedFiles = new Map<string, Set<string>>()

/** Check if a binary exists in PATH */
function binaryExists(name: string): boolean {
  try {
    execSync(`which ${name}`, { stdio: 'ignore', timeout: 3000 })
    return true
  } catch {
    return false
  }
}

/** Convert a file path to a file:// URI */
function pathToUri(filePath: string): string {
  return `file://${resolve(filePath)}`
}

/** Convert a file:// URI to a file path */
function uriToPath(uri: string): string {
  if (uri.startsWith('file://')) return uri.slice(7)
  return uri
}

/** Detect language from file extension */
export function detectLanguage(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase()
  return EXT_TO_LANGUAGE[ext] || null
}

/** Find the nearest project root (package.json, Cargo.toml, go.mod, etc.) */
function findProjectRoot(filePath: string): string {
  const markers = ['package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml', 'setup.py', '.git']
  let dir = resolve(filePath, '..')

  for (let i = 0; i < 20; i++) {
    for (const marker of markers) {
      if (existsSync(join(dir, marker))) return dir
    }
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }

  return process.cwd()
}

/** Find a working server command for a language, trying fallbacks */
function findServerCommand(language: string): string[] | null {
  const candidates = SERVER_COMMANDS[language]
  if (candidates) {
    for (const cmd of candidates) {
      if (binaryExists(cmd[0])) return cmd
    }
  }

  // Fallback: check for a generic `<language>-language-server` binary
  const genericName = `${language}-language-server`
  if (binaryExists(genericName)) return [genericName, '--stdio']

  return null
}

/**
 * Start or retrieve an LSP server for a given language.
 * Returns null if no server is available.
 */
export async function startLspServer(language: string): Promise<LspConnection | null> {
  // Return existing connection if alive
  const existing = connections.get(language)
  if (existing?.isAlive) return existing

  // Clean up dead connection
  if (existing) {
    connections.delete(language)
    openedFiles.delete(language)
  }

  const cmd = findServerCommand(language)
  if (!cmd) return null

  const workspaceRoot = process.cwd()
  const conn = new LspConnection(language, cmd, workspaceRoot)

  try {
    await conn.initialize()
    connections.set(language, conn)
    openedFiles.set(language, new Set())
    return conn
  } catch (err) {
    try { await conn.shutdown() } catch { /* ignore */ }
    return null
  }
}

/**
 * Get an LSP connection for a file, auto-detecting the language.
 * Opens the file on the server if not already opened.
 */
export async function getConnectionForFile(filePath: string): Promise<{
  conn: LspConnection
  uri: string
  language: string
} | null> {
  const absPath = resolve(filePath)
  const language = detectLanguage(absPath)
  if (!language) return null

  const conn = await startLspServer(language)
  if (!conn) return null

  const uri = pathToUri(absPath)
  const opened = openedFiles.get(language)!

  if (!opened.has(uri)) {
    // Read the file and send didOpen
    try {
      const text = readFileSync(absPath, 'utf-8')
      conn.didOpen(uri, language, text)
      opened.add(uri)
      // Give the server a moment to process the file
      await new Promise(r => setTimeout(r, 200))
    } catch {
      return null
    }
  }

  return { conn, uri, language }
}

// ── Public API ──

/**
 * Go to definition at position.
 * Returns location(s) where the symbol is defined.
 */
export async function gotoDefinition(
  filePath: string,
  line: number,
  character: number,
): Promise<LspLocation[]> {
  const ctx = await getConnectionForFile(filePath)
  if (!ctx) return []

  const result = await ctx.conn.request('textDocument/definition', {
    textDocument: { uri: ctx.uri },
    position: { line, character },
  })

  return normalizeLocations(result)
}

/**
 * Find all references to the symbol at position.
 */
export async function findReferences(
  filePath: string,
  line: number,
  character: number,
  includeDeclaration = true,
): Promise<LspLocation[]> {
  const ctx = await getConnectionForFile(filePath)
  if (!ctx) return []

  const result = await ctx.conn.request('textDocument/references', {
    textDocument: { uri: ctx.uri },
    position: { line, character },
    context: { includeDeclaration },
  })

  return normalizeLocations(result)
}

/**
 * Get hover information (type, docs) at position.
 */
export async function hover(
  filePath: string,
  line: number,
  character: number,
): Promise<string | null> {
  const ctx = await getConnectionForFile(filePath)
  if (!ctx) return null

  const result = await ctx.conn.request('textDocument/hover', {
    textDocument: { uri: ctx.uri },
    position: { line, character },
  }) as LspHoverResult | null

  if (!result?.contents) return null
  return formatHoverContents(result.contents)
}

/**
 * Get completions at position.
 */
export async function completions(
  filePath: string,
  line: number,
  character: number,
): Promise<LspCompletionItem[]> {
  const ctx = await getConnectionForFile(filePath)
  if (!ctx) return []

  const result = await ctx.conn.request('textDocument/completion', {
    textDocument: { uri: ctx.uri },
    position: { line, character },
  }) as { items?: LspCompletionItem[] } | LspCompletionItem[] | null

  if (!result) return []
  if (Array.isArray(result)) return result
  return result.items || []
}

/**
 * Rename a symbol across the project.
 * Returns a workspace edit describing all changes.
 */
export async function rename(
  filePath: string,
  line: number,
  character: number,
  newName: string,
): Promise<LspWorkspaceEdit | null> {
  const ctx = await getConnectionForFile(filePath)
  if (!ctx) return null

  const result = await ctx.conn.request('textDocument/rename', {
    textDocument: { uri: ctx.uri },
    position: { line, character },
    newName,
  }) as LspWorkspaceEdit | null

  return result
}

/**
 * Get diagnostics for a file.
 * Note: diagnostics arrive asynchronously via notifications.
 * This opens the file and waits briefly for diagnostics to arrive.
 */
export async function getDiagnostics(
  filePath: string,
): Promise<LspDiagnostic[]> {
  const ctx = await getConnectionForFile(filePath)
  if (!ctx) return []

  // Wait a bit for diagnostics to arrive (they come asynchronously)
  await new Promise(r => setTimeout(r, 1500))

  return ctx.conn.getDiagnostics(ctx.uri)
}

/**
 * Get document symbols (functions, classes, variables, etc.).
 */
export async function documentSymbols(
  filePath: string,
): Promise<LspSymbol[]> {
  const ctx = await getConnectionForFile(filePath)
  if (!ctx) return []

  const result = await ctx.conn.request('textDocument/documentSymbol', {
    textDocument: { uri: ctx.uri },
  }) as LspSymbol[] | null

  return result || []
}

/**
 * Shutdown all active LSP servers.
 */
export async function shutdownAll(): Promise<void> {
  const shutdowns: Promise<void>[] = []
  for (const [language, conn] of connections) {
    shutdowns.push(conn.shutdown())
    connections.delete(language)
    openedFiles.delete(language)
  }
  await Promise.allSettled(shutdowns)
}

/**
 * Get the list of active LSP server languages.
 */
export function getActiveServers(): string[] {
  return Array.from(connections.keys()).filter(lang => connections.get(lang)?.isAlive)
}

// Register cleanup on process exit
process.on('exit', () => {
  for (const conn of connections.values()) {
    try { conn.shutdown() } catch { /* best-effort */ }
  }
})

process.on('SIGINT', () => {
  shutdownAll().finally(() => process.exit(0))
})

process.on('SIGTERM', () => {
  shutdownAll().finally(() => process.exit(0))
})

// ── Formatting Helpers ──

/** Normalize definition/reference results into a consistent array of locations */
function normalizeLocations(result: unknown): LspLocation[] {
  if (!result) return []

  // Single location: { uri, range }
  if (typeof result === 'object' && 'uri' in (result as Record<string, unknown>)) {
    return [result as LspLocation]
  }

  // Array of locations
  if (Array.isArray(result)) {
    return result.filter(
      (item): item is LspLocation =>
        item && typeof item === 'object' && 'uri' in item,
    )
  }

  return []
}

/** Format hover contents into a readable string */
function formatHoverContents(
  contents: string | { kind: string; value: string } | Array<string | { kind: string; value: string }>,
): string {
  if (typeof contents === 'string') return contents

  if (Array.isArray(contents)) {
    return contents
      .map(c => (typeof c === 'string' ? c : c.value))
      .filter(Boolean)
      .join('\n\n')
  }

  if ('value' in contents) return contents.value

  return String(contents)
}

/** Format an LspLocation for display */
export function formatLocation(loc: LspLocation): string {
  const path = uriToPath(loc.uri)
  const line = loc.range.start.line + 1
  const col = loc.range.start.character + 1
  return `${path}:${line}:${col}`
}

/** Format locations array for display */
export function formatLocations(locations: LspLocation[]): string {
  if (locations.length === 0) return 'No results found.'
  return locations.map(formatLocation).join('\n')
}

/** Format a diagnostic severity number to a string */
export function formatSeverity(severity?: number): string {
  switch (severity) {
    case 1: return 'error'
    case 2: return 'warning'
    case 3: return 'info'
    case 4: return 'hint'
    default: return 'unknown'
  }
}

/** Format diagnostics for display */
export function formatDiagnosticsList(filePath: string, diagnostics: LspDiagnostic[]): string {
  if (diagnostics.length === 0) return 'No diagnostics.'

  const errors = diagnostics.filter(d => d.severity === 1)
  const warnings = diagnostics.filter(d => d.severity === 2)
  const others = diagnostics.filter(d => !d.severity || d.severity > 2)

  const lines: string[] = []

  if (errors.length > 0) {
    lines.push(`${errors.length} error(s):`)
    for (const d of errors) {
      const loc = `${filePath}:${d.range.start.line + 1}:${d.range.start.character + 1}`
      lines.push(`  ${loc} — ${d.message}${d.source ? ` [${d.source}]` : ''}`)
    }
  }

  if (warnings.length > 0) {
    lines.push(`${warnings.length} warning(s):`)
    for (const d of warnings) {
      const loc = `${filePath}:${d.range.start.line + 1}:${d.range.start.character + 1}`
      lines.push(`  ${loc} — ${d.message}${d.source ? ` [${d.source}]` : ''}`)
    }
  }

  if (others.length > 0) {
    lines.push(`${others.length} info/hint(s):`)
    for (const d of others) {
      const loc = `${filePath}:${d.range.start.line + 1}:${d.range.start.character + 1}`
      lines.push(`  ${loc} — ${d.message}${d.source ? ` [${d.source}]` : ''}`)
    }
  }

  return lines.join('\n')
}

/** Format a symbol for display, with indentation for hierarchy */
export function formatSymbol(sym: LspSymbol, indent = 0): string {
  const kind = SYMBOL_KINDS[sym.kind] || `kind(${sym.kind})`
  const line = sym.range.start.line + 1
  const prefix = '  '.repeat(indent)
  let result = `${prefix}${kind} ${sym.name} (line ${line})`

  if (sym.children?.length) {
    for (const child of sym.children) {
      result += '\n' + formatSymbol(child, indent + 1)
    }
  }

  return result
}

/** Format a completion item for display */
export function formatCompletion(item: LspCompletionItem): string {
  const kind = item.kind ? COMPLETION_KINDS[item.kind] || `kind(${item.kind})` : ''
  const detail = item.detail ? ` — ${item.detail}` : ''
  return `${item.label}${kind ? ` (${kind})` : ''}${detail}`
}

/** Format workspace edits into a human-readable summary */
export function formatWorkspaceEdit(edit: LspWorkspaceEdit): string {
  const lines: string[] = []

  if (edit.changes) {
    for (const [uri, edits] of Object.entries(edit.changes)) {
      const path = uriToPath(uri)
      lines.push(`${path}: ${edits.length} edit(s)`)
      for (const e of edits) {
        const loc = `  line ${e.range.start.line + 1}:${e.range.start.character + 1}`
        const preview = e.newText.length > 60 ? e.newText.slice(0, 60) + '...' : e.newText
        lines.push(`${loc} → "${preview}"`)
      }
    }
  }

  if (edit.documentChanges) {
    for (const change of edit.documentChanges) {
      const path = uriToPath(change.textDocument.uri)
      lines.push(`${path}: ${change.edits.length} edit(s)`)
      for (const e of change.edits) {
        const loc = `  line ${e.range.start.line + 1}:${e.range.start.character + 1}`
        const preview = e.newText.length > 60 ? e.newText.slice(0, 60) + '...' : e.newText
        lines.push(`${loc} → "${preview}"`)
      }
    }
  }

  if (lines.length === 0) return 'No edits.'
  return lines.join('\n')
}
