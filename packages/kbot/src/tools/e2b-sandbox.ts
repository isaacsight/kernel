// kbot E2B Cloud Sandbox — Run code in E2B cloud-hosted sandboxes
//
// E2B (e2b.dev) provides secure, ephemeral cloud sandboxes via API.
// Alternative to local Docker sandboxes for users without Docker installed
// or who want isolated cloud execution.
//
// API key stored in ~/.kbot/config.json under `e2b_api_key`.
// All tools are Pro-tier (cloud sandbox = paid feature).
//
// Tools:
//   e2b_create   — Create a new E2B sandbox
//   e2b_execute  — Execute code in a sandbox
//   e2b_upload   — Upload a file to a sandbox
//   e2b_download — Download a file from a sandbox
//   e2b_close    — Close and clean up a sandbox

import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { registerTool } from './index.js'

// ── Constants ──

const E2B_API_BASE = 'https://api.e2b.dev/v1'
const DEFAULT_TIMEOUT_S = 300 // 5 minutes
const CONFIG_PATH = join(homedir(), '.kbot', 'config.json')

/** Language → E2B template mapping */
const LANGUAGE_TEMPLATES: Record<string, string> = {
  python: 'Python3',
  node: 'Node18',
  bash: 'Bash',
}

// ── Active sandbox tracking ──

interface E2bSandbox {
  id: string
  shortId: string
  language: string
  createdAt: string
  timeoutS: number
}

const activeSandboxes = new Map<string, E2bSandbox>()

// ── Cleanup on process exit ──

let cleanupRegistered = false

function registerCleanupHook(): void {
  if (cleanupRegistered) return
  cleanupRegistered = true

  const cleanup = (): void => {
    const apiKey = getApiKey()
    if (!apiKey || activeSandboxes.size === 0) return

    // Best-effort cleanup — fire-and-forget since process is exiting
    for (const [, sandbox] of activeSandboxes) {
      try {
        // Use sync XMLHttpRequest-style fetch isn't available at exit,
        // so we fire the request and don't await it
        fetch(`${E2B_API_BASE}/sandboxes/${sandbox.id}`, {
          method: 'DELETE',
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
          },
        }).catch(() => {})
      } catch {
        // Best effort — process is exiting
      }
    }
    activeSandboxes.clear()
  }

  process.on('exit', cleanup)
  process.on('SIGINT', () => { cleanup(); process.exit(130) })
  process.on('SIGTERM', () => { cleanup(); process.exit(143) })
}

// ── Helpers ──

/** Read the E2B API key from ~/.kbot/config.json */
function getApiKey(): string | null {
  try {
    if (!existsSync(CONFIG_PATH)) return null
    const raw = readFileSync(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(raw) as Record<string, unknown>
    const key = config.e2b_api_key
    return typeof key === 'string' && key.length > 0 ? key : null
  } catch {
    return null
  }
}

/** Make an authenticated request to the E2B API */
async function e2bFetch(
  path: string,
  options: {
    method?: string
    body?: unknown
    timeoutMs?: number
  } = {},
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error(
      'E2B API key not configured. Add "e2b_api_key" to ~/.kbot/config.json\n' +
      'Get your key at https://e2b.dev/dashboard',
    )
  }

  const { method = 'GET', body, timeoutMs = 30_000 } = options
  const url = `${E2B_API_BASE}${path}`

  const headers: Record<string, string> = {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    let data: unknown
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    return { ok: response.ok, status: response.status, data }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`E2B API request timed out after ${timeoutMs / 1000}s`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** Format an E2B API error for display */
function formatApiError(status: number, data: unknown): string {
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>
    const message = d.message || d.error || d.detail || JSON.stringify(data)
    return `E2B API error (${status}): ${message}`
  }
  return `E2B API error (${status}): ${String(data)}`
}

/** Lookup a sandbox by its short ID (first 8 chars) */
function findSandbox(shortId: string): E2bSandbox | null {
  // Direct match on short ID
  const direct = activeSandboxes.get(shortId)
  if (direct) return direct

  // Search by short ID prefix
  for (const [, sandbox] of activeSandboxes) {
    if (sandbox.shortId === shortId || sandbox.id.startsWith(shortId)) {
      return sandbox
    }
  }
  return null
}

// ── Tool Registration ──

export function registerE2bTools(): void {
  registerCleanupHook()

  // ── e2b_create ──

  registerTool({
    name: 'e2b_create',
    description:
      'Create a new E2B cloud sandbox. Returns a sandbox ID for use with other e2b_* tools. ' +
      'Cloud-hosted, no Docker required. Sandboxes auto-terminate after timeout.',
    parameters: {
      language: {
        type: 'string',
        description: 'Sandbox language/runtime: python, node, or bash',
        required: true,
      },
      timeout: {
        type: 'number',
        description: `Sandbox timeout in seconds (default: ${DEFAULT_TIMEOUT_S}, max: 3600)`,
      },
    },
    tier: 'free',
    async execute(args) {
      const language = String(args.language).toLowerCase()
      const timeoutS = Math.min(
        Math.max(typeof args.timeout === 'number' ? args.timeout : DEFAULT_TIMEOUT_S, 10),
        3600,
      )

      const template = LANGUAGE_TEMPLATES[language]
      if (!template) {
        return `Error: Unsupported language "${language}". Supported: ${Object.keys(LANGUAGE_TEMPLATES).join(', ')}`
      }

      try {
        const { ok, status, data } = await e2bFetch('/sandboxes', {
          method: 'POST',
          body: {
            template,
            timeout: timeoutS,
          },
          timeoutMs: 60_000, // Sandbox creation can take longer
        })

        if (!ok) {
          return formatApiError(status, data)
        }

        const result = data as Record<string, unknown>
        const sandboxId = String(result.sandboxID || result.id || result.sandbox_id || '')
        if (!sandboxId) {
          return 'Error: E2B API returned no sandbox ID. Response: ' + JSON.stringify(data)
        }

        const shortId = sandboxId.slice(0, 8)
        const sandbox: E2bSandbox = {
          id: sandboxId,
          shortId,
          language,
          createdAt: new Date().toISOString(),
          timeoutS,
        }
        activeSandboxes.set(shortId, sandbox)

        return [
          `E2B sandbox created`,
          `  ID:       ${shortId}`,
          `  Language: ${language}`,
          `  Timeout:  ${timeoutS}s`,
          `  Template: ${template}`,
          '',
          `Use e2b_execute with sandbox_id="${shortId}" to run code.`,
        ].join('\n')
      } catch (err) {
        return `Error creating E2B sandbox: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── e2b_execute ──

  registerTool({
    name: 'e2b_execute',
    description:
      'Execute code in an E2B cloud sandbox. Returns stdout, stderr, and exit code. ' +
      'The sandbox retains state between executions (installed packages, files, variables).',
    parameters: {
      sandbox_id: {
        type: 'string',
        description: 'Sandbox ID (from e2b_create)',
        required: true,
      },
      code: {
        type: 'string',
        description: 'Code to execute in the sandbox',
        required: true,
      },
      timeout: {
        type: 'number',
        description: 'Execution timeout in seconds (default: 60)',
      },
    },
    tier: 'free',
    timeout: 120_000, // 2 min tool-level timeout for long executions
    async execute(args) {
      const shortId = String(args.sandbox_id)
      const code = String(args.code)
      const timeoutS = Math.min(typeof args.timeout === 'number' ? args.timeout : 60, 300)

      const sandbox = findSandbox(shortId)
      if (!sandbox) {
        const ids = activeSandboxes.size > 0
          ? `Active sandboxes: ${[...activeSandboxes.keys()].join(', ')}`
          : 'No active sandboxes. Use e2b_create first.'
        return `Error: Sandbox "${shortId}" not found. ${ids}`
      }

      try {
        const startTime = Date.now()

        const { ok, status, data } = await e2bFetch(`/sandboxes/${sandbox.id}/executions`, {
          method: 'POST',
          body: {
            code,
            timeout: timeoutS,
          },
          timeoutMs: (timeoutS + 10) * 1000, // HTTP timeout slightly longer than exec timeout
        })

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

        if (!ok) {
          // Check if sandbox expired
          if (status === 404) {
            activeSandboxes.delete(sandbox.shortId)
            return `Error: Sandbox "${shortId}" has expired or been terminated. Create a new one with e2b_create.`
          }
          return formatApiError(status, data)
        }

        const result = data as Record<string, unknown>
        const stdout = String(result.stdout || '')
        const stderr = String(result.stderr || '')
        const exitCode = typeof result.exit_code === 'number' ? result.exit_code
          : typeof result.exitCode === 'number' ? result.exitCode : null
        const error = result.error ? String(result.error) : ''

        const parts: string[] = []

        if (stdout.trim()) parts.push(stdout.trim())
        if (stderr.trim()) parts.push(`stderr: ${stderr.trim()}`)
        if (error) parts.push(`error: ${error}`)

        if (parts.length === 0) parts.push('(no output)')

        if (exitCode !== null && exitCode !== 0) {
          parts.unshift(`Exit code: ${exitCode}`)
        }

        parts.push(`\n[${elapsed}s, cloud sandbox ${shortId}, ${sandbox.language}]`)

        return parts.join('\n')
      } catch (err) {
        return `Error executing in E2B sandbox: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── e2b_upload ──

  registerTool({
    name: 'e2b_upload',
    description:
      'Upload a file to an E2B cloud sandbox. Writes content to the specified path inside the sandbox filesystem.',
    parameters: {
      sandbox_id: {
        type: 'string',
        description: 'Sandbox ID (from e2b_create)',
        required: true,
      },
      path: {
        type: 'string',
        description: 'Destination path inside the sandbox (e.g., /home/user/data.csv)',
        required: true,
      },
      content: {
        type: 'string',
        description: 'File content to upload (text)',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      const shortId = String(args.sandbox_id)
      const filePath = String(args.path)
      const content = String(args.content)

      const sandbox = findSandbox(shortId)
      if (!sandbox) {
        return `Error: Sandbox "${shortId}" not found. Use e2b_create first.`
      }

      try {
        const { ok, status, data } = await e2bFetch(`/sandboxes/${sandbox.id}/files`, {
          method: 'POST',
          body: {
            path: filePath,
            content,
          },
        })

        if (!ok) {
          if (status === 404) {
            activeSandboxes.delete(sandbox.shortId)
            return `Error: Sandbox "${shortId}" has expired. Create a new one with e2b_create.`
          }
          return formatApiError(status, data)
        }

        const sizeKb = (Buffer.byteLength(content, 'utf-8') / 1024).toFixed(1)
        return `Uploaded ${sizeKb}KB to ${filePath} in sandbox ${shortId}`
      } catch (err) {
        return `Error uploading to E2B sandbox: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── e2b_download ──

  registerTool({
    name: 'e2b_download',
    description:
      'Download a file from an E2B cloud sandbox. Returns the file content as text.',
    parameters: {
      sandbox_id: {
        type: 'string',
        description: 'Sandbox ID (from e2b_create)',
        required: true,
      },
      path: {
        type: 'string',
        description: 'File path inside the sandbox to download (e.g., /home/user/output.txt)',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      const shortId = String(args.sandbox_id)
      const filePath = String(args.path)

      const sandbox = findSandbox(shortId)
      if (!sandbox) {
        return `Error: Sandbox "${shortId}" not found. Use e2b_create first.`
      }

      try {
        const encodedPath = encodeURIComponent(filePath)
        const { ok, status, data } = await e2bFetch(
          `/sandboxes/${sandbox.id}/files?path=${encodedPath}`,
          { method: 'GET' },
        )

        if (!ok) {
          if (status === 404) {
            // Could be sandbox expired or file not found
            const result = data as Record<string, unknown>
            const message = String(result.message || result.error || '')
            if (message.toLowerCase().includes('sandbox')) {
              activeSandboxes.delete(sandbox.shortId)
              return `Error: Sandbox "${shortId}" has expired. Create a new one with e2b_create.`
            }
            return `Error: File "${filePath}" not found in sandbox ${shortId}.`
          }
          return formatApiError(status, data)
        }

        // Response may be the file content directly or wrapped in an object
        let content: string
        if (typeof data === 'string') {
          content = data
        } else if (typeof data === 'object' && data !== null) {
          const d = data as Record<string, unknown>
          content = String(d.content || d.data || JSON.stringify(data))
        } else {
          content = String(data)
        }

        if (content.length === 0) {
          return `File "${filePath}" is empty.`
        }

        const sizeKb = (Buffer.byteLength(content, 'utf-8') / 1024).toFixed(1)
        return `File: ${filePath} (${sizeKb}KB)\n\n${content}`
      } catch (err) {
        return `Error downloading from E2B sandbox: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── e2b_close ──

  registerTool({
    name: 'e2b_close',
    description:
      'Close and clean up an E2B cloud sandbox. Frees cloud resources. ' +
      'Sandboxes also auto-terminate after their timeout expires.',
    parameters: {
      sandbox_id: {
        type: 'string',
        description: 'Sandbox ID to close (from e2b_create). Use "all" to close all active sandboxes.',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      const shortId = String(args.sandbox_id)

      // Close all sandboxes
      if (shortId === 'all') {
        if (activeSandboxes.size === 0) {
          return 'No active E2B sandboxes to close.'
        }

        const results: string[] = []
        const toClose = [...activeSandboxes.values()]

        for (const sandbox of toClose) {
          try {
            await e2bFetch(`/sandboxes/${sandbox.id}`, { method: 'DELETE' })
            activeSandboxes.delete(sandbox.shortId)
            results.push(`  Closed ${sandbox.shortId} (${sandbox.language})`)
          } catch {
            results.push(`  Failed to close ${sandbox.shortId} (may have already expired)`)
            activeSandboxes.delete(sandbox.shortId)
          }
        }

        return `Closed ${toClose.length} sandbox(es):\n${results.join('\n')}`
      }

      // Close a single sandbox
      const sandbox = findSandbox(shortId)
      if (!sandbox) {
        return `Error: Sandbox "${shortId}" not found. No active sandboxes to close.`
      }

      try {
        await e2bFetch(`/sandboxes/${sandbox.id}`, { method: 'DELETE' })
        activeSandboxes.delete(sandbox.shortId)
        return `E2B sandbox ${sandbox.shortId} (${sandbox.language}) closed and resources freed.`
      } catch {
        // Sandbox may have already expired — remove from tracking either way
        activeSandboxes.delete(sandbox.shortId)
        return `Sandbox ${sandbox.shortId} removed (may have already expired).`
      }
    },
  })
}
