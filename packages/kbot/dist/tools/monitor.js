// kbot Monitor — Live TUI dashboard for kernel.chat platform health
//
// Commands:
//   platform_monitor  — Live dashboard: requests, errors, costs, active users
//   platform_logs     — Recent edge function logs
//   platform_uptime   — Uptime and health check for all services
//   platform_alerts   — View/manage platform alerts
import { execSync } from 'node:child_process';
import { registerTool } from './index.js';
// ── Helpers ──────────────────────────────────────────────────────────
function supabaseQuery(table, query) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    return execSync(`curl -sS "${url}/rest/v1/${table}?${query}" \
    -H "apikey: ${key}" \
    -H "Authorization: Bearer ${key}" \
    -H "Content-Type: application/json"`, {
        encoding: 'utf-8', timeout: 15_000,
    }).trim();
}
function supabaseRpc(fnName, body = {}) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    return execSync(`curl -sS -X POST "${url}/rest/v1/rpc/${fnName}" \
    -H "apikey: ${key}" \
    -H "Authorization: Bearer ${key}" \
    -H "Content-Type: application/json" \
    -d '${JSON.stringify(body)}'`, {
        encoding: 'utf-8', timeout: 15_000,
    }).trim();
}
function httpCheck(url, label) {
    const start = Date.now();
    try {
        const code = execSync(`curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "${url}"`, {
            encoding: 'utf-8', timeout: 15_000,
        }).trim();
        const latency = Date.now() - start;
        return {
            label,
            status: code === '200' || code === '204' ? '✓ UP' : `⚠ ${code}`,
            latency: `${latency}ms`,
        };
    }
    catch {
        return { label, status: '✗ DOWN', latency: `${Date.now() - start}ms` };
    }
}
// ── Tools ────────────────────────────────────────────────────────────
export function registerMonitorTools() {
    let count = 0;
    registerTool({
        name: 'platform_monitor',
        description: 'Platform health dashboard: message volume, error rate, active users, cost burn, service status. One-shot snapshot.',
        parameters: {
            period: { type: 'string', description: 'Period: "1h", "24h", "7d"', default: '24h' },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const period = String(args.period || '24h');
            const hours = period === '1h' ? 1 : period === '7d' ? 168 : 24;
            const since = new Date(Date.now() - hours * 3600_000).toISOString();
            // Message states (recent)
            let msgStats = { total: 0, success: 0, failed: 0, pending: 0 };
            try {
                const raw = supabaseQuery('message_states', `select=state&created_at=gte.${since}&limit=5000`);
                const states = JSON.parse(raw);
                msgStats.total = states.length;
                msgStats.success = states.filter(s => s.state === 'success').length;
                msgStats.failed = states.filter(s => s.state.startsWith('failed')).length;
                msgStats.pending = states.filter(s => s.state === 'pending' || s.state === 'streaming').length;
            }
            catch { /* table may not exist */ }
            const errorRate = msgStats.total > 0
                ? ((msgStats.failed / msgStats.total) * 100).toFixed(1) + '%'
                : 'n/a';
            // Active users (unique user_ids in message_states)
            let activeUsers = 0;
            try {
                const raw = supabaseQuery('message_states', `select=user_id&created_at=gte.${since}&limit=5000`);
                const msgs = JSON.parse(raw);
                activeUsers = new Set(msgs.map(m => m.user_id).filter(Boolean)).size;
            }
            catch { /* */ }
            // Cost burn
            let costInfo = 'check audit_log';
            try {
                const raw = supabaseQuery('usage_costs', `select=cost_usd&created_at=gte.${since}`);
                const costs = JSON.parse(raw);
                const total = costs.reduce((sum, c) => sum + (c.cost_usd || 0), 0);
                costInfo = `$${total.toFixed(2)}`;
            }
            catch { /* table may not exist */ }
            // Audit events
            let auditCount = 0;
            try {
                const raw = supabaseQuery('audit_log', `select=id&created_at=gte.${since}&limit=0`);
                // Use length if array returned
                const events = JSON.parse(raw);
                auditCount = Array.isArray(events) ? events.length : 0;
            }
            catch { /* */ }
            // Service health checks
            const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
            const services = [
                httpCheck('https://kernel.chat', 'kernel.chat'),
                httpCheck(`${supabaseUrl}/functions/v1/claude-proxy`, 'claude-proxy'),
                httpCheck('https://api.anthropic.com/v1/messages', 'anthropic-api'),
                httpCheck('https://registry.npmjs.org/@kernel.chat/kbot', 'npm-registry'),
            ];
            const svcTable = services.map(s => `  ${s.status.padEnd(8)} ${s.label.padEnd(20)} ${s.latency}`).join('\n');
            return [
                `╔══════════════════════════════════════╗`,
                `║     KERNEL PLATFORM MONITOR          ║`,
                `║     Period: ${period.padEnd(24)}║`,
                `╚══════════════════════════════════════╝`,
                ``,
                `── Messages ──`,
                `  Total:     ${msgStats.total}`,
                `  Success:   ${msgStats.success}`,
                `  Failed:    ${msgStats.failed}`,
                `  Pending:   ${msgStats.pending}`,
                `  Error rate: ${errorRate}`,
                ``,
                `── Users ──`,
                `  Active (${period}): ${activeUsers}`,
                ``,
                `── Cost ──`,
                `  Burn (${period}): ${costInfo}`,
                `  Audit events: ${auditCount}`,
                ``,
                `── Services ──`,
                svcTable,
            ].join('\n');
        },
    });
    count++;
    registerTool({
        name: 'platform_logs',
        description: 'View recent platform logs from audit_log table — edge function calls, errors, rate limits.',
        parameters: {
            filter: { type: 'string', description: 'Filter: "all", "errors", "rate_limited", "claude-proxy"', default: 'all' },
            limit: { type: 'string', description: 'Max results', default: '30' },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const filter = String(args.filter || 'all');
            const limit = parseInt(String(args.limit || '30'));
            let query = `select=id,actor_id,action,status,status_code,created_at,ip&order=created_at.desc&limit=${limit}`;
            if (filter === 'errors')
                query += '&status=eq.error';
            else if (filter === 'rate_limited')
                query += '&status=eq.rate_limited';
            else if (filter === 'claude-proxy')
                query += '&action=eq.claude-proxy';
            const raw = supabaseQuery('audit_log', query);
            let logs;
            try {
                logs = JSON.parse(raw);
            }
            catch {
                return `Error parsing logs: ${raw}`;
            }
            if (!logs.length)
                return 'No logs found for this filter.';
            const formatted = logs.map((l) => {
                const time = String(l.created_at || '').slice(11, 19);
                const status = String(l.status || '');
                const icon = status === 'error' ? '✗' : status === 'rate_limited' ? '⚠' : '·';
                return `${icon} ${time}  ${String(l.action || '').padEnd(20)} ${String(l.status_code || '').padEnd(4)} ${status.padEnd(14)} ${String(l.actor_id || '').slice(0, 8)}`;
            });
            return `── Platform Logs (${filter}, last ${logs.length}) ──\n\n` +
                `  TIME     ACTION               CODE STATUS         USER\n` +
                `  ${'─'.repeat(70)}\n` +
                formatted.join('\n');
        },
    });
    count++;
    registerTool({
        name: 'platform_uptime',
        description: 'Health check all kernel.chat services and report latency.',
        parameters: {},
        tier: 'free',
        execute: async () => {
            const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
            const checks = [
                httpCheck('https://kernel.chat', 'Web (kernel.chat)'),
                httpCheck(`${supabaseUrl}/functions/v1/claude-proxy`, 'Claude Proxy'),
                httpCheck(`${supabaseUrl}/functions/v1/web-search`, 'Web Search'),
                httpCheck(`${supabaseUrl}/functions/v1/create-checkout`, 'Checkout'),
                httpCheck(`${supabaseUrl}/functions/v1/stripe-webhook`, 'Stripe Webhook'),
                httpCheck(`${supabaseUrl}/rest/v1/`, 'Supabase REST'),
                httpCheck('https://api.anthropic.com/v1/messages', 'Anthropic API'),
                httpCheck('https://api.openai.com/v1/models', 'OpenAI API'),
                httpCheck('https://registry.npmjs.org/@kernel.chat/kbot', 'npm Registry'),
                httpCheck('https://api.github.com/repos/isaacsight/kernel', 'GitHub API'),
            ];
            const up = checks.filter(c => c.status.includes('UP')).length;
            const down = checks.filter(c => c.status.includes('DOWN')).length;
            const warn = checks.length - up - down;
            const table = checks.map(c => `  ${c.status.padEnd(10)} ${c.label.padEnd(25)} ${c.latency}`).join('\n');
            return [
                `── Service Health ──`,
                `  ${up} up / ${warn} warning / ${down} down`,
                ``,
                `  STATUS     SERVICE                   LATENCY`,
                `  ${'─'.repeat(50)}`,
                table,
            ].join('\n');
        },
    });
    count++;
    registerTool({
        name: 'platform_alerts',
        description: 'View platform alerts: high error rates, cost spikes, service outages.',
        parameters: {
            period: { type: 'string', description: 'Period: "1h", "24h"', default: '24h' },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const hours = String(args.period) === '1h' ? 1 : 24;
            const since = new Date(Date.now() - hours * 3600_000).toISOString();
            const alerts = [];
            // Check error rate
            try {
                const raw = supabaseQuery('message_states', `select=state&created_at=gte.${since}&limit=5000`);
                const states = JSON.parse(raw);
                const total = states.length;
                const failed = states.filter(s => s.state.startsWith('failed')).length;
                if (total > 0 && (failed / total) > 0.05) {
                    alerts.push(`🔴 HIGH ERROR RATE: ${((failed / total) * 100).toFixed(1)}% (${failed}/${total} messages failed)`);
                }
            }
            catch { /* */ }
            // Check rate limits
            try {
                const raw = supabaseQuery('audit_log', `select=id&status=eq.rate_limited&created_at=gte.${since}&limit=100`);
                const rls = JSON.parse(raw);
                if (rls.length > 10) {
                    alerts.push(`🟡 RATE LIMITING: ${rls.length} rate-limited requests in period`);
                }
            }
            catch { /* */ }
            // Check costs
            try {
                const raw = supabaseQuery('usage_costs', `select=cost_usd&created_at=gte.${since}`);
                const costs = JSON.parse(raw);
                const total = costs.reduce((sum, c) => sum + (c.cost_usd || 0), 0);
                if (total > 3) {
                    alerts.push(`🟡 COST SPIKE: $${total.toFixed(2)} in ${hours}h (threshold: $3.00)`);
                }
                if (total > 5) {
                    alerts.push(`🔴 COST CRITICAL: $${total.toFixed(2)} exceeds hard limit`);
                }
            }
            catch { /* */ }
            if (!alerts.length) {
                return `── Platform Alerts ──\n\n  ✓ All clear — no alerts in the last ${hours}h`;
            }
            return `── Platform Alerts (${alerts.length}) ──\n\n` + alerts.map(a => `  ${a}`).join('\n');
        },
    });
    count++;
    return count;
}
//# sourceMappingURL=monitor.js.map