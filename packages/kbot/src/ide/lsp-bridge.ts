// kbot LSP Diagnostics Bridge
//
// Spawns language-specific LSP servers and collects diagnostics
// after kbot edits a file. Enables auto-correction loop:
//   1. kbot edits a file
//   2. LSP bridge sends textDocument/didOpen
//   3. Collects textDocument/publishDiagnostics
//   4. Returns errors/warnings to agent loop for self-correction

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'

export interface Diagnostic {
  file: string
  line: number
  column: number
  severity: 'error' | 'warning' | 'info' | 'hint'
  message: string
  source?: string
  code?: string | number
}

export interface LspBridgeOptions {
  /** Timeout in ms for LSP response (default: 10000) */
  timeout?: number
  /** Custom LSP server commands by language */
  servers?: Record<string, string[]>
}

interface LspMessage {
  jsonrpc: '2.0'
  id?: number
  method?: string
  params?: unknown
  result?: unknown
  error?: { code: number; message: string }
}

/** Map file extensions to LSP server commands */
const DEFAULT_SERVERS: Record<string, string[]> = {
  '.ts': ['typescript-language-server', '--stdio'],
  '.tsx': ['typescript-language-server', '--stdio'],
  '.js': ['typescript-language-server', '--stdio'],
  '.jsx': ['typescript-language-server', '--stdio'],
  '.py': ['pyright-langserver', '--stdio'],
  '.rs': ['rust-analyzer'],
  '.go': ['gopls', 'serve'],
}

/** Detect which LSP server to use for a file */
function detectServer(filePath: string, options?: LspBridgeOptions): string[] | null {
  const ext = extname(filePath).toLowerCase()

  // Check custom overrides first
  if (options?.servers?.[ext]) {
    return options.servers[ext]
  }

  const serverCmd = DEFAULT_SERVERS[ext]
  if (!serverCmd) return null

  // Check if the server binary exists in PATH
  try {
    const { execSync } = require('node:child_process')
    execSync(`which ${serverCmd[0]}`, { stdio: 'ignore', timeout: 3000 })
    return serverCmd
  } catch {
    return null // Server binary not in PATH — expected for languages without LSP installed
  }
}

/** Encode a JSON-RPC message with Content-Length header */
function encodeMessage(msg: LspMessage): string {
  const body = JSON.stringify(msg)
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
}

/** Parse JSON-RPC messages from LSP server output */
function parseMessages(data: string): LspMessage[] {
  const messages: LspMessage[] = []
  let remaining = data

  while (remaining.length > 0) {
    const headerEnd = remaining.indexOf('\r\n\r\n')
    if (headerEnd === -1) break

    const header = remaining.slice(0, headerEnd)
    const lengthMatch = header.match(/Content-Length:\s*(\d+)/i)
    if (!lengthMatch) break

    const contentLength = parseInt(lengthMatch[1], 10)
    const bodyStart = headerEnd + 4
    const body = remaining.slice(bodyStart, bodyStart + contentLength)

    if (body.length < contentLength) break

    try {
      messages.push(JSON.parse(body))
    } catch (err) {
      // Skip malformed JSON-RPC messages — log for debugging
      if (process.env.KBOT_DEBUG) console.error('[lsp-bridge] malformed message:', (err as Error).message)
    }

    remaining = remaining.slice(bodyStart + contentLength)
  }

  return messages
}

/** Map LSP severity number to string */
function mapSeverity(severity?: number): Diagnostic['severity'] {
  switch (severity) {
    case 1: return 'error'
    case 2: return 'warning'
    case 3: return 'info'
    case 4: return 'hint'
    default: return 'warning'
  }
}

/**
 * Get diagnostics for a file by spawning the appropriate LSP server.
 *
 * This is a one-shot operation: spawn LSP, initialize, open file,
 * collect diagnostics, shut down. Not a persistent connection.
 */
export async function getDiagnostics(
  filePath: string,
  options?: LspBridgeOptions,
): Promise<Diagnostic[]> {
  const absPath = resolve(filePath)
  if (!existsSync(absPath)) {
    return [{ file: filePath, line: 0, column: 0, severity: 'error', message: 'File not found' }]
  }

  const serverCmd = detectServer(absPath, options)
  if (!serverCmd) {
    return [] // No LSP server available — not an error, just no diagnostics
  }

  const timeout = options?.timeout || 10000
  const fileUri = `file://${absPath}`
  const fileContent = readFileSync(absPath, 'utf-8')
  const rootUri = `file://${findProjectRoot(absPath)}`

  return new Promise<Diagnostic[]>((resolve) => {
    const diagnostics: Diagnostic[] = []
    let lsp: ChildProcess | null = null
    let buffer = ''
    let messageId = 0
    let initialized = false
    let timer: NodeJS.Timeout | null = null

    const cleanup = () => {
      if (timer) clearTimeout(timer)
      if (lsp) {
        try {
          // Send shutdown + exit
          lsp.stdin?.write(encodeMessage({ jsonrpc: '2.0', id: ++messageId, method: 'shutdown', params: null }))
          setTimeout(() => {
            lsp?.stdin?.write(encodeMessage({ jsonrpc: '2.0', method: 'exit', params: null }))
            lsp?.kill()
          }, 200)
        } catch (err) {
          if (process.env.KBOT_DEBUG) console.error('[lsp-bridge] cleanup error:', (err as Error).message)
          lsp.kill()
        }
      }
      resolve(diagnostics)
    }

    // Timeout — return whatever we have
    timer = setTimeout(cleanup, timeout)

    try {
      lsp = spawn(serverCmd[0], serverCmd.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: findProjectRoot(absPath),
      })
    } catch (err) {
      if (process.env.KBOT_DEBUG) console.error('[lsp-bridge] spawn failed:', (err as Error).message)
      resolve([])
      return
    }

    lsp.on('error', () => {
      resolve([])
    })

    lsp.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const messages = parseMessages(buffer)

      for (const msg of messages) {
        // Initialize response — send didOpen
        if (msg.id === 1 && msg.result) {
          initialized = true
          // Send initialized notification
          lsp!.stdin?.write(encodeMessage({
            jsonrpc: '2.0',
            method: 'initialized',
            params: {},
          }))
          // Open the file
          lsp!.stdin?.write(encodeMessage({
            jsonrpc: '2.0',
            method: 'textDocument/didOpen',
            params: {
              textDocument: {
                uri: fileUri,
                languageId: getLanguageId(absPath),
                version: 1,
                text: fileContent,
              },
            },
          }))
        }

        // Diagnostics notification
        if (msg.method === 'textDocument/publishDiagnostics') {
          const params = msg.params as { uri: string; diagnostics: Array<{
            range: { start: { line: number; character: number } }
            severity?: number
            message: string
            source?: string
            code?: string | number
          }> }

          if (params.uri === fileUri) {
            for (const d of params.diagnostics) {
              diagnostics.push({
                file: filePath,
                line: d.range.start.line + 1,
                column: d.range.start.character + 1,
                severity: mapSeverity(d.severity),
                message: d.message,
                source: d.source,
                code: d.code,
              })
            }
            // Got diagnostics — we can clean up
            cleanup()
          }
        }
      }
    })

    // Send initialize request
    lsp.stdin?.write(encodeMessage({
      jsonrpc: '2.0',
      id: ++messageId,
      method: 'initialize',
      params: {
        processId: process.pid,
        capabilities: {
          textDocument: {
            publishDiagnostics: { relatedInformation: true },
          },
        },
        rootUri,
        workspaceFolders: [{ uri: rootUri, name: 'workspace' }],
      },
    }))
  })
}

/** Find the nearest project root (package.json, Cargo.toml, go.mod, etc.) */
function findProjectRoot(filePath: string): string {
  const markers = ['package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml', 'setup.py', '.git']
  let dir = filePath

  for (let i = 0; i < 20; i++) {
    const parent = join(dir, '..')
    if (parent === dir) break
    dir = parent
    for (const marker of markers) {
      if (existsSync(join(dir, marker))) return dir
    }
  }

  return process.cwd()
}

/** Map file extension to LSP language ID */
function getLanguageId(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescriptreact',
    '.js': 'javascript',
    '.jsx': 'javascriptreact',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.json': 'json',
    '.md': 'markdown',
    '.css': 'css',
    '.html': 'html',
  }
  return map[ext] || 'plaintext'
}

/**
 * Format diagnostics as a human-readable string for the agent loop.
 */
export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) return 'No diagnostics.'

  const errors = diagnostics.filter(d => d.severity === 'error')
  const warnings = diagnostics.filter(d => d.severity === 'warning')

  const lines: string[] = []
  if (errors.length > 0) {
    lines.push(`${errors.length} error(s):`)
    for (const e of errors) {
      lines.push(`  ${e.file}:${e.line}:${e.column} — ${e.message}${e.source ? ` [${e.source}]` : ''}`)
    }
  }
  if (warnings.length > 0) {
    lines.push(`${warnings.length} warning(s):`)
    for (const w of warnings) {
      lines.push(`  ${w.file}:${w.line}:${w.column} — ${w.message}${w.source ? ` [${w.source}]` : ''}`)
    }
  }
  return lines.join('\n')
}
