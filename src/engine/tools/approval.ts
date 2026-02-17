// ─── Human-in-the-Loop Approval Gates ──────────────────────
//
// When a tool has `requiresApproval: true`, the executor pauses
// and asks the user before executing. This module manages the
// approval queue and timeout logic.

export interface ApprovalRequest {
  id: string
  toolName: string
  args: Record<string, unknown>
  description: string
  timestamp: number
}

export type ApprovalCallback = (request: ApprovalRequest) => Promise<boolean>

const APPROVAL_TIMEOUT_MS = 60_000  // Auto-reject after 60s

export function createApprovalGate(): {
  requestApproval: ApprovalCallback
  pendingApprovals: () => ApprovalRequest[]
  clearAll: () => void
} {
  const pending = new Map<string, {
    request: ApprovalRequest
    resolve: (approved: boolean) => void
  }>()

  let resolveCallback: ((requestId: string, approved: boolean) => void) | null = null

  function requestApproval(request: ApprovalRequest): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      pending.set(request.id, { request, resolve })

      // Auto-reject after timeout
      const timer = setTimeout(() => {
        if (pending.has(request.id)) {
          pending.delete(request.id)
          resolve(false)
        }
      }, APPROVAL_TIMEOUT_MS)

      // If an external callback resolves it, clear the timeout
      const originalResolve = resolve
      const wrappedResolve = (approved: boolean) => {
        clearTimeout(timer)
        pending.delete(request.id)
        originalResolve(approved)
      }

      pending.set(request.id, { request, resolve: wrappedResolve })

      // Notify external handler
      resolveCallback?.(request.id, false) // initial notification
    })
  }

  return {
    requestApproval,
    pendingApprovals: () => Array.from(pending.values()).map(p => p.request),
    clearAll: () => {
      for (const { resolve } of pending.values()) {
        resolve(false) // Reject all pending
      }
      pending.clear()
    },
  }
}

export function formatApprovalDescription(toolName: string, args: Record<string, unknown>): string {
  const argSummary = Object.entries(args)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(', ')
  return `${toolName}(${argSummary})`
}
