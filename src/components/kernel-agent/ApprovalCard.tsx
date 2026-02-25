// ─── Approval Card ──────────────────────────────────────────
//
// Renders a pending tool approval as an inline chat message.
// Shows tool name, description, and approve/reject buttons.

import { useState, useEffect } from 'react'
import type { ApprovalRequest } from '../../engine/tools/approval'

interface ApprovalCardProps {
  request: ApprovalRequest
  onApprove: (requestId: string) => void
  onReject: (requestId: string) => void
}

const TIMEOUT_MS = 60_000

export default function ApprovalCard({ request, onApprove, onReject }: ApprovalCardProps) {
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(TIMEOUT_MS / 1000))
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    if (resolved) return
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          if (!resolved) {
            setResolved(true)
            onReject(request.id)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [request.id, resolved, onReject])

  function handleApprove() {
    if (resolved) return
    setResolved(true)
    onApprove(request.id)
  }

  function handleReject() {
    if (resolved) return
    setResolved(true)
    onReject(request.id)
  }

  return (
    <div className="ka-approval-card">
      <div className="ka-approval-header">
        <span className="ka-approval-icon">&#9888;</span>
        <span className="ka-approval-title">Action Requires Approval</span>
      </div>
      <div className="ka-approval-body">
        <div className="ka-approval-tool">{request.toolName}</div>
        <div className="ka-approval-desc">{request.description}</div>
        {Object.keys(request.args).length > 0 && (
          <pre className="ka-approval-args">
            {JSON.stringify(request.args, null, 2)}
          </pre>
        )}
      </div>
      {!resolved ? (
        <div className="ka-approval-actions">
          <button className="ka-approval-btn ka-approval-approve" onClick={handleApprove}>
            Approve
          </button>
          <button className="ka-approval-btn ka-approval-reject" onClick={handleReject}>
            Reject
          </button>
          <span className="ka-approval-timer">{secondsLeft}s</span>
        </div>
      ) : (
        <div className="ka-approval-resolved">
          {resolved && secondsLeft > 0 ? 'Approved' : 'Rejected (timeout)'}
        </div>
      )}
    </div>
  )
}
