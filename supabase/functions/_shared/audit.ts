// Shared audit logging — fire-and-forget event recording
//
// Usage:
//   import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
//
//   await logAudit(svc, {
//     actorId: user.id,
//     eventType: 'edge_function.call',
//     action: 'claude-proxy',
//     source: 'claude-proxy',
//     status: 'success',
//     statusCode: 200,
//     metadata: { model: 'sonnet', tokens: 1234 },
//     ip: getClientIP(req),
//     userAgent: getUA(req),
//   })

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface AuditEvent {
  actorId?: string
  actorType?: string    // 'user' | 'service' | 'anonymous' | 'system'
  eventType: string     // 'edge_function.call' | 'user.action' | 'payment.*' | 'system.*'
  action: string        // endpoint name or specific action
  source?: string       // edge function name
  status?: string       // 'success' | 'error' | 'blocked' | 'rate_limited'
  statusCode?: number
  metadata?: Record<string, unknown>
  ip?: string | null
  userAgent?: string | null
}

/**
 * Log an audit event via RPC. Never throws — catches all errors internally.
 */
export async function logAudit(svc: SupabaseClient, event: AuditEvent): Promise<void> {
  try {
    await svc.rpc('log_audit_event', {
      p_actor_id: event.actorId || null,
      p_actor_type: event.actorType || 'user',
      p_event_type: event.eventType,
      p_action: event.action,
      p_source: event.source || null,
      p_status: event.status || 'success',
      p_status_code: event.statusCode ?? null,
      p_metadata: event.metadata || {},
      p_ip_address: event.ip || null,
      p_user_agent: event.userAgent || null,
    })
  } catch (err) {
    console.warn('[audit] log failed (non-blocking):', err)
  }
}

/** Extract client IP from standard proxy headers */
export function getClientIP(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || null
}

/** Extract User-Agent header */
export function getUA(req: Request): string | null {
  return req.headers.get('user-agent') || null
}
