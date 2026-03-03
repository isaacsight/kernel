// ─── Computer Engine — Sandboxed Compute for Agents ──────────
//
// Provides isolated compute environments where agents can execute
// code, manage files, browse URLs, and run terminal commands.
//
// Architecture:
// - Client-side: WebContainer API (StackBlitz) for browser-based sandboxes
// - Server-side: Supabase Edge Function for code that needs a real runtime
//
// Security: Sandboxes are isolated per-agent, no access to internal
// services, CPU/memory limits, auto-destroy after idle timeout.

import type {
  Sandbox,
  SandboxFile,
  SandboxResult,
  ComputerEngineCallbacks,
} from './computer/types'
import { supabase } from './SupabaseClient'

/** Active sandboxes tracked in memory */
const activeSandboxes = new Map<string, Sandbox>()

/** Default idle timeout: 30 minutes */
const DEFAULT_IDLE_TIMEOUT = 30 * 60 * 1000

/** Generate a sandbox ID */
function generateSandboxId(): string {
  return `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Create a new sandbox for an agent.
 */
export async function createSandbox(
  userId: string,
  agentId: string,
  callbacks?: Partial<ComputerEngineCallbacks>,
): Promise<Sandbox> {
  const id = generateSandboxId()
  const now = Date.now()

  const sandbox: Sandbox = {
    id,
    agentId,
    userId,
    status: 'creating',
    filesystem: [],
    processes: [],
    createdAt: now,
    expiresAt: now + DEFAULT_IDLE_TIMEOUT,
    idleTimeout: DEFAULT_IDLE_TIMEOUT,
    lastActivityAt: now,
  }

  callbacks?.onStatusChange?.(id, 'creating')

  // Persist to database
  const { error } = await supabase.from('sandboxes').insert({
    id,
    user_id: userId,
    agent_id: agentId,
    status: 'ready',
    filesystem_snapshot: { files: [] },
    expires_at: new Date(sandbox.expiresAt).toISOString(),
  })

  if (error) {
    sandbox.status = 'error'
    callbacks?.onStatusChange?.(id, 'error')
    callbacks?.onError?.(id, `Failed to create sandbox: ${error.message}`)
    throw new Error(`Failed to create sandbox: ${error.message}`)
  }

  sandbox.status = 'ready'
  activeSandboxes.set(id, sandbox)
  callbacks?.onStatusChange?.(id, 'ready')

  return sandbox
}

/**
 * Execute code in a sandbox via the edge function.
 */
export async function executeCode(
  sandboxId: string,
  code: string,
  language: string,
  callbacks?: Partial<ComputerEngineCallbacks>,
): Promise<SandboxResult> {
  const sandbox = activeSandboxes.get(sandboxId)
  if (!sandbox) throw new Error(`Sandbox not found: ${sandboxId}`)
  if (sandbox.status === 'destroyed') throw new Error('Sandbox has been destroyed')

  sandbox.status = 'busy'
  sandbox.lastActivityAt = Date.now()
  callbacks?.onStatusChange?.(sandboxId, 'busy')

  const startTime = Date.now()

  try {
    const { data, error } = await supabase.functions.invoke('computer-engine', {
      body: {
        action: 'execute',
        sandbox_id: sandboxId,
        code,
        language,
      },
    })

    if (error) throw new Error(error.message)

    const result: SandboxResult = {
      stdout: data?.stdout || '',
      stderr: data?.stderr || '',
      exitCode: data?.exit_code ?? 0,
      files: data?.files,
      duration_ms: Date.now() - startTime,
    }

    if (result.stdout) callbacks?.onOutput?.(sandboxId, result.stdout)
    if (result.stderr) callbacks?.onError?.(sandboxId, result.stderr)

    // Record execution (non-critical)
    try {
      await supabase.from('sandbox_executions').insert({
        sandbox_id: sandboxId,
        action: 'execute_code',
        input: { code: code.slice(0, 500), language },
        output: { stdout: result.stdout.slice(0, 1000), exitCode: result.exitCode },
        duration_ms: result.duration_ms,
      })
    } catch { /* non-critical */ }

    sandbox.status = 'ready'
    callbacks?.onStatusChange?.(sandboxId, 'ready')

    return result
  } catch (err) {
    sandbox.status = 'ready'
    callbacks?.onStatusChange?.(sandboxId, 'ready')
    throw err
  }
}

/**
 * Read a file from the sandbox.
 */
export async function readFile(
  sandboxId: string,
  path: string,
): Promise<string> {
  const sandbox = activeSandboxes.get(sandboxId)
  if (!sandbox) throw new Error(`Sandbox not found: ${sandboxId}`)

  // Check in-memory filesystem first
  const cached = sandbox.filesystem.find(f => f.path === path)
  if (cached) return cached.content

  // Fall back to edge function
  const { data, error } = await supabase.functions.invoke('computer-engine', {
    body: { action: 'read_file', sandbox_id: sandboxId, path },
  })

  if (error) throw new Error(error.message)
  return data?.content || ''
}

/**
 * Write a file to the sandbox.
 */
export async function writeFile(
  sandboxId: string,
  path: string,
  content: string,
  callbacks?: Partial<ComputerEngineCallbacks>,
): Promise<void> {
  const sandbox = activeSandboxes.get(sandboxId)
  if (!sandbox) throw new Error(`Sandbox not found: ${sandboxId}`)

  sandbox.lastActivityAt = Date.now()

  const file: SandboxFile = {
    path,
    content,
    language: path.split('.').pop() || 'text',
    size: content.length,
    lastModified: Date.now(),
  }

  // Update in-memory filesystem
  const existingIdx = sandbox.filesystem.findIndex(f => f.path === path)
  if (existingIdx >= 0) {
    sandbox.filesystem[existingIdx] = file
  } else {
    sandbox.filesystem.push(file)
  }

  callbacks?.onFileChange?.(sandboxId, file)

  // Persist to edge function
  await supabase.functions.invoke('computer-engine', {
    body: { action: 'write_file', sandbox_id: sandboxId, path, content },
  })
}

/**
 * Browse a URL and return content (optionally with screenshot).
 */
export async function browseUrl(
  sandboxId: string,
  url: string,
  screenshot = false,
  callbacks?: Partial<ComputerEngineCallbacks>,
): Promise<SandboxResult> {
  const sandbox = activeSandboxes.get(sandboxId)
  if (!sandbox) throw new Error(`Sandbox not found: ${sandboxId}`)

  sandbox.lastActivityAt = Date.now()
  const startTime = Date.now()

  const { data, error } = await supabase.functions.invoke('computer-engine', {
    body: { action: 'browse', sandbox_id: sandboxId, url, screenshot },
  })

  if (error) throw new Error(error.message)

  const result: SandboxResult = {
    stdout: data?.content || '',
    stderr: '',
    exitCode: 0,
    screenshot: data?.screenshot,
    duration_ms: Date.now() - startTime,
  }

  if (result.screenshot) callbacks?.onScreenshot?.(sandboxId, result.screenshot)

  return result
}

/**
 * Run a terminal command in the sandbox.
 */
export async function runTerminal(
  sandboxId: string,
  command: string,
  callbacks?: Partial<ComputerEngineCallbacks>,
): Promise<SandboxResult> {
  const sandbox = activeSandboxes.get(sandboxId)
  if (!sandbox) throw new Error(`Sandbox not found: ${sandboxId}`)

  sandbox.lastActivityAt = Date.now()
  sandbox.status = 'busy'
  callbacks?.onStatusChange?.(sandboxId, 'busy')

  const startTime = Date.now()

  try {
    const { data, error } = await supabase.functions.invoke('computer-engine', {
      body: { action: 'terminal', sandbox_id: sandboxId, command },
    })

    if (error) throw new Error(error.message)

    const result: SandboxResult = {
      stdout: data?.stdout || '',
      stderr: data?.stderr || '',
      exitCode: data?.exit_code ?? 0,
      duration_ms: Date.now() - startTime,
    }

    if (result.stdout) callbacks?.onOutput?.(sandboxId, result.stdout)

    sandbox.status = 'ready'
    callbacks?.onStatusChange?.(sandboxId, 'ready')

    return result
  } catch (err) {
    sandbox.status = 'ready'
    callbacks?.onStatusChange?.(sandboxId, 'ready')
    throw err
  }
}

/**
 * Destroy a sandbox and clean up resources.
 */
export async function destroySandbox(
  sandboxId: string,
  callbacks?: Partial<ComputerEngineCallbacks>,
): Promise<void> {
  const sandbox = activeSandboxes.get(sandboxId)
  if (sandbox) {
    sandbox.status = 'destroyed'
    callbacks?.onStatusChange?.(sandboxId, 'destroyed')
  }

  activeSandboxes.delete(sandboxId)

  // Clean up in database
  try {
    await supabase.from('sandboxes')
      .update({ status: 'destroyed' })
      .eq('id', sandboxId)
  } catch { /* non-critical */ }
}

/**
 * List all active sandboxes for a user.
 */
export async function listSandboxes(userId: string): Promise<Sandbox[]> {
  const { data } = await supabase
    .from('sandboxes')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'destroyed')
    .order('created_at', { ascending: false })

  if (!data) return []

  return data.map(row => ({
    id: row.id,
    agentId: row.agent_id,
    userId: row.user_id,
    status: row.status as Sandbox['status'],
    filesystem: (row.filesystem_snapshot as { files?: SandboxFile[] })?.files || [],
    processes: [],
    createdAt: new Date(row.created_at).getTime(),
    expiresAt: new Date(row.expires_at).getTime(),
    idleTimeout: DEFAULT_IDLE_TIMEOUT,
    lastActivityAt: new Date(row.created_at).getTime(),
  }))
}

/**
 * Get active sandbox count for tier limit checking.
 */
export async function getActiveSandboxCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('sandboxes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'ready')

  return count || 0
}
