// kbot Admin Tools — Manage users, billing, moderation from the terminal
//
// Commands:
//   admin_users       — List/search users
//   admin_user_detail — Get detailed user info
//   admin_stats       — Platform stats (users, revenue, usage)
//   admin_billing     — Manage subscriptions, create invoices
//   admin_moderate    — Moderation queue management
//   admin_scores      — Client scoring/health
import { execSync } from 'node:child_process';
import { registerTool } from './index.js';
// ── Helpers ──────────────────────────────────────────────────────────
function supabaseRpc(fnName, body = {}) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY — run: kbot env check');
    const res = execSync(`curl -sS -X POST "${url}/rest/v1/rpc/${fnName}" \
    -H "apikey: ${key}" \
    -H "Authorization: Bearer ${key}" \
    -H "Content-Type: application/json" \
    -d '${JSON.stringify(body)}'`, {
        encoding: 'utf-8',
        timeout: 30_000,
    }).trim();
    return res;
}
function supabaseQuery(table, query) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY — run: kbot env check');
    const res = execSync(`curl -sS "${url}/rest/v1/${table}?${query}" \
    -H "apikey: ${key}" \
    -H "Authorization: Bearer ${key}" \
    -H "Content-Type: application/json"`, {
        encoding: 'utf-8',
        timeout: 30_000,
    }).trim();
    return res;
}
function stripeCmd(args) {
    try {
        return execSync(`stripe ${args}`, { encoding: 'utf-8', timeout: 30_000 }).trim();
    }
    catch (e) {
        throw new Error(`Stripe CLI failed: ${e.message}. Install: brew install stripe/stripe-cli/stripe`);
    }
}
function formatTable(rows, columns) {
    if (!rows.length)
        return '(no results)';
    const widths = columns.map(col => Math.max(col.length, ...rows.map(r => String(r[col] ?? '').length)));
    const header = columns.map((col, i) => col.padEnd(widths[i])).join('  ');
    const sep = widths.map(w => '─'.repeat(w)).join('──');
    const body = rows.map(row => columns.map((col, i) => String(row[col] ?? '').padEnd(widths[i])).join('  ')).join('\n');
    return `${header}\n${sep}\n${body}`;
}
// ── Tools ────────────────────────────────────────────────────────────
export function registerAdminTools() {
    let count = 0;
    registerTool({
        name: 'admin_users',
        description: 'List platform users with stats. Filter by plan, status, or search by email.',
        parameters: {
            filter: { type: 'string', description: 'Filter: "all", "free", "pro", "max", "active", "churned"', default: 'all' },
            search: { type: 'string', description: 'Search by email (partial match)' },
            limit: { type: 'string', description: 'Max results (default: 50)', default: '50' },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const filter = String(args.filter || 'all');
            const search = args.search ? String(args.search) : '';
            const limit = parseInt(String(args.limit || '50'));
            let query = `select=id,email,created_at,last_sign_in_at&order=created_at.desc&limit=${limit}`;
            if (search)
                query += `&email=ilike.*${search}*`;
            const usersRaw = supabaseQuery('users_view', query);
            let users;
            try {
                users = JSON.parse(usersRaw);
            }
            catch {
                return `Error parsing users: ${usersRaw}`;
            }
            // Get subscription data
            const subsRaw = supabaseQuery('subscriptions', 'select=user_id,status,plan&status=in.(active,trialing)');
            let subs;
            try {
                subs = JSON.parse(subsRaw);
            }
            catch {
                subs = [];
            }
            const subMap = new Map(subs.map((s) => [s.user_id, s]));
            // Enrich users with plan info
            const enriched = users.map((u) => {
                const sub = subMap.get(u.id);
                return {
                    email: u.email,
                    plan: sub?.plan || 'free',
                    status: sub?.status || 'free',
                    created: String(u.created_at || '').slice(0, 10),
                    last_active: String(u.last_sign_in_at || '').slice(0, 10),
                };
            });
            // Apply plan filter
            const filtered = filter === 'all' ? enriched
                : enriched.filter(u => {
                    if (filter === 'free')
                        return u.plan === 'free';
                    if (filter === 'pro')
                        return String(u.plan).startsWith('pro');
                    if (filter === 'max')
                        return String(u.plan).startsWith('max');
                    if (filter === 'active')
                        return u.last_active >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
                    if (filter === 'churned')
                        return u.status === 'canceled';
                    return true;
                });
            return `Users (${filtered.length}/${users.length} total, filter: ${filter}):\n\n` +
                formatTable(filtered, ['email', 'plan', 'status', 'created', 'last_active']);
        },
    });
    count++;
    registerTool({
        name: 'admin_user_detail',
        description: 'Get detailed info for a specific user — subscription, usage, message counts, files.',
        parameters: {
            email: { type: 'string', description: 'User email address', required: true },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const email = String(args.email);
            // Get user
            const userRaw = supabaseQuery('users_view', `select=*&email=eq.${encodeURIComponent(email)}&limit=1`);
            let users;
            try {
                users = JSON.parse(userRaw);
            }
            catch {
                return `Error: ${userRaw}`;
            }
            if (!users.length)
                return `User not found: ${email}`;
            const user = users[0];
            // Get subscription
            const subRaw = supabaseQuery('subscriptions', `select=*&user_id=eq.${user.id}&order=created_at.desc&limit=1`);
            let sub = {};
            try {
                const subs = JSON.parse(subRaw);
                sub = subs[0] || {};
            }
            catch { /* no sub */ }
            // Get usage
            const memRaw = supabaseQuery('user_memory', `select=daily_message_count,monthly_message_count,monthly_file_count,monthly_et_count&user_id=eq.${user.id}&limit=1`);
            let mem = {};
            try {
                const mems = JSON.parse(memRaw);
                mem = mems[0] || {};
            }
            catch { /* no mem */ }
            return [
                `── User Detail ──`,
                `Email:           ${user.email}`,
                `ID:              ${user.id}`,
                `Created:         ${String(user.created_at || '').slice(0, 19)}`,
                `Last sign-in:    ${String(user.last_sign_in_at || '').slice(0, 19)}`,
                `Provider:        ${user.raw_app_meta_data ? user.raw_app_meta_data.provider : 'unknown'}`,
                ``,
                `── Subscription ──`,
                `Plan:            ${sub.plan || 'free'}`,
                `Status:          ${sub.status || 'none'}`,
                `Stripe ID:       ${sub.stripe_customer_id || 'none'}`,
                `Period end:      ${sub.current_period_end || 'n/a'}`,
                ``,
                `── Usage (current period) ──`,
                `Messages today:  ${mem.daily_message_count ?? 0}`,
                `Messages month:  ${mem.monthly_message_count ?? 0}`,
                `Files month:     ${mem.monthly_file_count ?? 0}`,
                `ET uses month:   ${mem.monthly_et_count ?? 0}`,
            ].join('\n');
        },
    });
    count++;
    registerTool({
        name: 'admin_stats',
        description: 'Platform-wide stats: total users, active users, subscribers, MRR, daily messages, error rate.',
        parameters: {},
        tier: 'enterprise',
        execute: async () => {
            // Total users
            const usersRaw = supabaseQuery('users_view', 'select=id&limit=0&head=true');
            // Count via content-range header workaround — use RPC
            const countRaw = supabaseRpc('admin_platform_stats');
            let stats;
            try {
                stats = JSON.parse(countRaw);
            }
            catch {
                // Fallback: manual queries
                const allUsers = supabaseQuery('users_view', 'select=id');
                const allSubs = supabaseQuery('subscriptions', 'select=id,plan&status=in.(active,trialing)');
                let userCount = 0, subCount = 0;
                try {
                    userCount = JSON.parse(allUsers).length;
                }
                catch { /* */ }
                try {
                    subCount = JSON.parse(allSubs).length;
                }
                catch { /* */ }
                stats = {
                    total_users: userCount,
                    active_subscribers: subCount,
                };
            }
            // npm stats
            let npmWeekly = 'unknown';
            try {
                const npm = execSync('curl -sS "https://api.npmjs.org/downloads/point/last-week/@kernel.chat/kbot"', {
                    encoding: 'utf-8', timeout: 10_000,
                });
                const d = JSON.parse(npm);
                npmWeekly = String(d.downloads);
            }
            catch { /* */ }
            // GitHub stats
            let ghStars = 'unknown';
            try {
                const gh = execSync('gh api repos/isaacsight/kernel --jq ".stargazers_count"', {
                    encoding: 'utf-8', timeout: 10_000,
                });
                ghStars = gh.trim();
            }
            catch { /* */ }
            return [
                `── Platform Stats ──`,
                `Total users:        ${stats.total_users ?? 'query failed'}`,
                `Active subscribers: ${stats.active_subscribers ?? 'unknown'}`,
                `MRR:                ${stats.mrr ? `$${stats.mrr}` : 'check Stripe dashboard'}`,
                ``,
                `── Distribution ──`,
                `npm downloads/week: ${npmWeekly}`,
                `GitHub stars:        ${ghStars}`,
                ``,
                `── Usage (today) ──`,
                `Messages today:     ${stats.messages_today ?? 'check logs'}`,
                `Error rate:         ${stats.error_rate ?? 'check logs'}`,
                `Active today:       ${stats.active_today ?? 'check logs'}`,
            ].join('\n');
        },
    });
    count++;
    registerTool({
        name: 'admin_billing',
        description: 'Manage billing: list invoices, create invoice, change subscription, view MRR. Uses Stripe CLI.',
        parameters: {
            action: { type: 'string', description: 'Action: "invoices", "create-invoice", "change-plan", "mrr", "customer"', required: true },
            email: { type: 'string', description: 'Customer email (for customer-specific actions)' },
            plan: { type: 'string', description: 'Plan ID (for change-plan)' },
            amount: { type: 'string', description: 'Amount in cents (for create-invoice)' },
            description: { type: 'string', description: 'Invoice description' },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const action = String(args.action);
            switch (action) {
                case 'mrr': {
                    const out = stripeCmd('mrr');
                    return `── Monthly Recurring Revenue ──\n${out}`;
                }
                case 'invoices': {
                    const email = args.email ? String(args.email) : '';
                    const filter = email ? `--customer-email "${email}"` : '';
                    const out = stripeCmd(`invoices list ${filter} --limit 20`);
                    return `── Recent Invoices ──\n${out}`;
                }
                case 'customer': {
                    const email = String(args.email || '');
                    if (!email)
                        return 'Error: email required for customer lookup';
                    const out = stripeCmd(`customers list --email "${email}" --limit 1`);
                    return `── Customer ──\n${out}`;
                }
                case 'create-invoice': {
                    const email = String(args.email || '');
                    const amount = String(args.amount || '0');
                    const desc = String(args.description || 'Custom invoice');
                    if (!email)
                        return 'Error: email required';
                    // Look up customer
                    const custRaw = stripeCmd(`customers list --email "${email}" --limit 1 -o json`);
                    let custId = '';
                    try {
                        const custs = JSON.parse(custRaw);
                        custId = custs.data?.[0]?.id;
                    }
                    catch {
                        return 'Error: could not find Stripe customer';
                    }
                    if (!custId)
                        return `No Stripe customer found for ${email}`;
                    const out = stripeCmd(`invoices create --customer "${custId}" --auto-advance --description "${desc}"`);
                    return `Invoice created:\n${out}`;
                }
                case 'change-plan': {
                    return 'Plan changes require the web dashboard for safety. Use: kbot admin billing customer --email <email> to get the customer ID, then manage in Stripe dashboard.';
                }
                default:
                    return `Unknown action: ${action}. Options: mrr, invoices, customer, create-invoice, change-plan`;
            }
        },
    });
    count++;
    registerTool({
        name: 'admin_moderate',
        description: 'View and manage the moderation queue — flagged content, user reports, pending reviews.',
        parameters: {
            action: { type: 'string', description: 'Action: "queue", "approve", "reject", "flag-user"', default: 'queue' },
            item_id: { type: 'string', description: 'Item ID (for approve/reject)' },
            user_id: { type: 'string', description: 'User ID (for flag-user)' },
            reason: { type: 'string', description: 'Reason (for reject/flag)' },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const action = String(args.action || 'queue');
            switch (action) {
                case 'queue': {
                    const raw = supabaseQuery('moderation_queue', 'select=id,user_id,type,status,created_at&status=eq.pending&order=created_at.desc&limit=20');
                    let items;
                    try {
                        items = JSON.parse(raw);
                    }
                    catch {
                        return `No moderation queue table found. Create one with: kbot db migrate`;
                    }
                    if (!items.length)
                        return 'Moderation queue is empty — nothing to review.';
                    return `── Moderation Queue (${items.length} pending) ──\n\n` +
                        formatTable(items, ['id', 'user_id', 'type', 'status', 'created_at']);
                }
                case 'approve': {
                    const id = String(args.item_id || '');
                    if (!id)
                        return 'Error: item_id required';
                    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
                    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
                    execSync(`curl -sS -X PATCH "${url}/rest/v1/moderation_queue?id=eq.${id}" \
            -H "apikey: ${key}" \
            -H "Authorization: Bearer ${key}" \
            -H "Content-Type: application/json" \
            -d '{"status":"approved","resolved_at":"${new Date().toISOString()}"}'`, {
                        encoding: 'utf-8', timeout: 10_000,
                    });
                    return `Approved item ${id}`;
                }
                case 'reject': {
                    const id = String(args.item_id || '');
                    const reason = String(args.reason || 'rejected by admin');
                    if (!id)
                        return 'Error: item_id required';
                    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
                    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
                    execSync(`curl -sS -X PATCH "${url}/rest/v1/moderation_queue?id=eq.${id}" \
            -H "apikey: ${key}" \
            -H "Authorization: Bearer ${key}" \
            -H "Content-Type: application/json" \
            -d '{"status":"rejected","reason":"${reason}","resolved_at":"${new Date().toISOString()}"}'`, {
                        encoding: 'utf-8', timeout: 10_000,
                    });
                    return `Rejected item ${id}: ${reason}`;
                }
                default:
                    return `Unknown action: ${action}. Options: queue, approve, reject, flag-user`;
            }
        },
    });
    count++;
    registerTool({
        name: 'admin_scores',
        description: 'View client engagement scores and health metrics.',
        parameters: {
            sort: { type: 'string', description: 'Sort by: "score", "messages", "last_active"', default: 'score' },
            limit: { type: 'string', description: 'Max results', default: '20' },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const limit = parseInt(String(args.limit || '20'));
            const sort = String(args.sort || 'score');
            const raw = supabaseQuery('user_memory', `select=user_id,daily_message_count,monthly_message_count,updated_at&order=monthly_message_count.desc&limit=${limit}`);
            let rows;
            try {
                rows = JSON.parse(raw);
            }
            catch {
                return `Error: ${raw}`;
            }
            const scored = rows.map((r) => ({
                user_id: String(r.user_id || '').slice(0, 8) + '...',
                msgs_today: r.daily_message_count ?? 0,
                msgs_month: r.monthly_message_count ?? 0,
                last_active: String(r.updated_at || '').slice(0, 10),
                score: Math.min(100, Math.round((Number(r.monthly_message_count || 0) / 200) * 50 +
                    (Number(r.daily_message_count || 0) / 10) * 30 +
                    (r.updated_at && new Date(r.updated_at) > new Date(Date.now() - 86400000) ? 20 : 0))),
            }));
            if (sort === 'messages')
                scored.sort((a, b) => Number(b.msgs_month) - Number(a.msgs_month));
            else if (sort === 'last_active')
                scored.sort((a, b) => b.last_active.localeCompare(a.last_active));
            else
                scored.sort((a, b) => b.score - a.score);
            return `── Client Scores (top ${scored.length}) ──\n\n` +
                formatTable(scored, ['user_id', 'score', 'msgs_today', 'msgs_month', 'last_active']);
        },
    });
    count++;
    return count;
}
//# sourceMappingURL=admin.js.map