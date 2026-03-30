// kbot Analytics — npm, GitHub, user, and revenue metrics from the terminal
//
// Commands:
//   analytics_overview  — Full dashboard: downloads, stars, users, revenue
//   analytics_npm       — npm download stats and trends
//   analytics_github    — GitHub stars, clones, traffic, issues
//   analytics_users     — User growth, signups, churn
//   analytics_revenue   — MRR, subscription breakdown, cost tracking

import { execSync } from 'node:child_process'
import { registerTool } from './index.js'

// ── Helpers ──────────────────────────────────────────────────────────

function fetchJSON(url: string, headers?: Record<string, string>): unknown {
  const headerArgs = headers
    ? Object.entries(headers).map(([k, v]) => `-H "${k}: ${v}"`).join(' ')
    : ''
  const raw = execSync(`curl -sS ${headerArgs} "${url}"`, {
    encoding: 'utf-8', timeout: 15_000,
  }).trim()
  return JSON.parse(raw)
}

function supabaseQuery(table: string, query: string): unknown[] {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return []
  const raw = execSync(`curl -sS "${url}/rest/v1/${table}?${query}" \
    -H "apikey: ${key}" \
    -H "Authorization: Bearer ${key}" \
    -H "Content-Type: application/json"`, {
    encoding: 'utf-8', timeout: 15_000,
  }).trim()
  try { return JSON.parse(raw) as unknown[] } catch { return [] }
}

function sparkline(values: number[]): string {
  if (!values.length) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const bars = '▁▂▃▄▅▆▇█'
  return values.map(v => bars[Math.round(((v - min) / range) * 7)]).join('')
}

function ghApi(endpoint: string): unknown {
  const raw = execSync(`gh api ${endpoint}`, { encoding: 'utf-8', timeout: 15_000 }).trim()
  return JSON.parse(raw)
}

// ── Tools ────────────────────────────────────────────────────────────

export function registerAnalyticsTools(): number {
  let count = 0

  registerTool({
    name: 'analytics_overview',
    description: 'Full analytics dashboard: npm downloads, GitHub stars, users, revenue — all in one view.',
    parameters: {},
    tier: 'pro',
    execute: async () => {
      const sections: string[] = []

      // npm
      try {
        const weekly = fetchJSON('https://api.npmjs.org/downloads/point/last-week/@kernel.chat/kbot') as Record<string, unknown>
        const monthly = fetchJSON('https://api.npmjs.org/downloads/point/last-month/@kernel.chat/kbot') as Record<string, unknown>
        const daily = fetchJSON('https://api.npmjs.org/downloads/range/last-week/@kernel.chat/kbot') as Record<string, unknown>
        const downloads = (daily.downloads as Array<{ downloads: number }> || []).map(d => d.downloads)
        sections.push([
          `── npm (@kernel.chat/kbot) ──`,
          `  Weekly:  ${weekly.downloads}  ${sparkline(downloads)}`,
          `  Monthly: ${monthly.downloads}`,
        ].join('\n'))
      } catch (e) { sections.push(`── npm ──\n  Error: ${(e as Error).message}`) }

      // GitHub
      try {
        const repo = ghApi('repos/isaacsight/kernel') as Record<string, unknown>
        sections.push([
          `── GitHub (isaacsight/kernel) ──`,
          `  Stars:      ${repo.stargazers_count}`,
          `  Forks:      ${repo.forks_count}`,
          `  Watchers:   ${repo.subscribers_count}`,
          `  Open issues: ${repo.open_issues_count}`,
        ].join('\n'))
      } catch { sections.push('── GitHub ──\n  Error: gh CLI not available') }

      // GitHub traffic
      try {
        const clones = ghApi('repos/isaacsight/kernel/traffic/clones') as Record<string, unknown>
        const views = ghApi('repos/isaacsight/kernel/traffic/views') as Record<string, unknown>
        const cloneDaily = (clones.clones as Array<{ count: number }> || []).map(d => d.count)
        const viewDaily = (views.views as Array<{ count: number }> || []).map(d => d.count)
        sections.push([
          `── Traffic (14d) ──`,
          `  Clones:   ${clones.count} unique / ${clones.uniques} cloners  ${sparkline(cloneDaily)}`,
          `  Views:    ${views.count} total / ${views.uniques} unique  ${sparkline(viewDaily)}`,
        ].join('\n'))
      } catch { /* traffic may require push access */ }

      // Users
      try {
        const users = supabaseQuery('users_view', 'select=id&limit=0') as unknown[]
        const subs = supabaseQuery('subscriptions', 'select=id,plan&status=in.(active,trialing)') as Array<Record<string, unknown>>
        const proCount = subs.filter(s => String(s.plan).startsWith('pro')).length
        const maxCount = subs.filter(s => String(s.plan).startsWith('max')).length
        sections.push([
          `── Users ──`,
          `  Total:       ${users.length || 'query failed'}`,
          `  Pro:         ${proCount}`,
          `  Max:         ${maxCount}`,
          `  Free:        ${Math.max(0, (users.length || 0) - proCount - maxCount)}`,
        ].join('\n'))
      } catch { sections.push('── Users ──\n  Requires SUPABASE_SERVICE_KEY') }

      return `╔══════════════════════════════════════╗\n` +
        `║     KERNEL ANALYTICS DASHBOARD       ║\n` +
        `╚══════════════════════════════════════╝\n\n` +
        sections.join('\n\n')
    },
  })
  count++

  registerTool({
    name: 'analytics_npm',
    description: 'Detailed npm download stats with daily breakdown and trends.',
    parameters: {
      period: { type: 'string', description: 'Period: "week", "month", "year"', default: 'month' },
      compare: { type: 'string', description: 'Compare against package (e.g. "@anthropics/claude-code")' },
    },
    tier: 'free',
    execute: async (args) => {
      const period = String(args.period || 'month')
      const rangeName = period === 'week' ? 'last-week' : period === 'year' ? 'last-year' : 'last-month'

      const point = fetchJSON(`https://api.npmjs.org/downloads/point/${rangeName}/@kernel.chat/kbot`) as Record<string, unknown>
      const range = fetchJSON(`https://api.npmjs.org/downloads/range/${rangeName}/@kernel.chat/kbot`) as Record<string, unknown>
      const dailyData = (range.downloads as Array<{ day: string; downloads: number }>) || []
      const values = dailyData.map(d => d.downloads)

      let output = [
        `── npm Downloads (@kernel.chat/kbot) ──`,
        `  Total (${period}): ${point.downloads}`,
        `  Daily avg:      ${values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0}`,
        `  Peak:           ${values.length ? Math.max(...values) : 0}`,
        `  Trend:          ${sparkline(values)}`,
        ``,
        `  Daily:`,
      ].join('\n')

      // Show last 14 days max
      const recent = dailyData.slice(-14)
      for (const d of recent) {
        const bar = '█'.repeat(Math.round((d.downloads / (Math.max(...values) || 1)) * 30))
        output += `\n  ${d.day.slice(5)}  ${String(d.downloads).padStart(5)}  ${bar}`
      }

      // Compare
      if (args.compare) {
        const comp = String(args.compare)
        try {
          const compData = fetchJSON(`https://api.npmjs.org/downloads/point/${rangeName}/${comp}`) as Record<string, unknown>
          output += `\n\n  Comparison: ${comp}\n  Downloads (${period}): ${compData.downloads}`
        } catch { output += `\n\n  Could not fetch data for ${comp}` }
      }

      return output
    },
  })
  count++

  registerTool({
    name: 'analytics_github',
    description: 'GitHub repo stats: stars, forks, traffic, clones, top referrers, popular content.',
    parameters: {},
    tier: 'free',
    execute: async () => {
      const sections: string[] = []

      try {
        const repo = ghApi('repos/isaacsight/kernel') as Record<string, unknown>
        sections.push([
          `── Repository ──`,
          `  Stars:        ${repo.stargazers_count}`,
          `  Forks:        ${repo.forks_count}`,
          `  Watchers:     ${repo.subscribers_count}`,
          `  Open issues:  ${repo.open_issues_count}`,
          `  Size:         ${Math.round(Number(repo.size) / 1024)}MB`,
          `  Language:     ${repo.language}`,
          `  Created:      ${String(repo.created_at || '').slice(0, 10)}`,
          `  Updated:      ${String(repo.updated_at || '').slice(0, 10)}`,
        ].join('\n'))
      } catch (e) { return `Error: ${(e as Error).message}` }

      try {
        const clones = ghApi('repos/isaacsight/kernel/traffic/clones') as Record<string, unknown>
        const views = ghApi('repos/isaacsight/kernel/traffic/views') as Record<string, unknown>
        sections.push([
          `── Traffic (14d) ──`,
          `  Views:    ${views.count} total / ${views.uniques} unique`,
          `  Clones:   ${clones.count} total / ${clones.uniques} unique`,
        ].join('\n'))
      } catch { /* requires push */ }

      try {
        const referrers = ghApi('repos/isaacsight/kernel/traffic/popular/referrers') as Array<Record<string, unknown>>
        if (referrers.length) {
          sections.push(`── Top Referrers ──\n` +
            referrers.slice(0, 5).map(r => `  ${String(r.referrer).padEnd(25)} ${r.count} views / ${r.uniques} unique`).join('\n'))
        }
      } catch { /* */ }

      try {
        const paths = ghApi('repos/isaacsight/kernel/traffic/popular/paths') as Array<Record<string, unknown>>
        if (paths.length) {
          sections.push(`── Popular Content ──\n` +
            paths.slice(0, 5).map(p => `  ${String(p.path).padEnd(40)} ${p.count} views`).join('\n'))
        }
      } catch { /* */ }

      return sections.join('\n\n')
    },
  })
  count++

  registerTool({
    name: 'analytics_users',
    description: 'User growth metrics: signups over time, active users, churn rate.',
    parameters: {
      period: { type: 'string', description: 'Period: "7d", "30d", "90d"', default: '30d' },
    },
    tier: 'enterprise',
    execute: async (args) => {
      const days = String(args.period) === '7d' ? 7 : String(args.period) === '90d' ? 90 : 30
      const since = new Date(Date.now() - days * 86400_000).toISOString()

      const allUsers = supabaseQuery('users_view', `select=id,created_at&order=created_at.desc`) as Array<Record<string, unknown>>
      const newUsers = allUsers.filter(u => String(u.created_at) >= since)

      // Group by day
      const byDay = new Map<string, number>()
      for (const u of newUsers) {
        const day = String(u.created_at || '').slice(0, 10)
        byDay.set(day, (byDay.get(day) || 0) + 1)
      }
      const dailyCounts = Array.from(byDay.entries()).sort().slice(-14)

      // Active users (had messages in period)
      const activeRaw = supabaseQuery('message_states', `select=user_id&created_at=gte.${since}&limit=5000`) as Array<Record<string, unknown>>
      const activeUsers = new Set(activeRaw.map(m => m.user_id).filter(Boolean)).size

      // Subscriptions
      const subs = supabaseQuery('subscriptions', 'select=status,plan') as Array<Record<string, unknown>>
      const activeSubs = subs.filter(s => s.status === 'active' || s.status === 'trialing')
      const canceled = subs.filter(s => s.status === 'canceled')

      const churnRate = (activeSubs.length + canceled.length) > 0
        ? ((canceled.length / (activeSubs.length + canceled.length)) * 100).toFixed(1)
        : '0'

      let output = [
        `── User Analytics (${days}d) ──`,
        `  Total users:     ${allUsers.length}`,
        `  New (${days}d):      ${newUsers.length}`,
        `  Active (${days}d):   ${activeUsers}`,
        `  Subscribers:     ${activeSubs.length}`,
        `  Churned:         ${canceled.length}`,
        `  Churn rate:      ${churnRate}%`,
        ``,
        `── Signups (daily) ──`,
      ].join('\n')

      for (const [day, count] of dailyCounts) {
        const bar = '█'.repeat(Math.min(count * 3, 30))
        output += `\n  ${day.slice(5)}  ${String(count).padStart(3)}  ${bar}`
      }

      if (dailyCounts.length) {
        output += `\n  Trend: ${sparkline(dailyCounts.map(([, c]) => c))}`
      }

      return output
    },
  })
  count++

  registerTool({
    name: 'analytics_revenue',
    description: 'Revenue analytics: MRR, subscription tiers, cost tracking.',
    parameters: {},
    tier: 'enterprise',
    execute: async () => {
      const sections: string[] = []

      // Subscription breakdown
      const subs = supabaseQuery('subscriptions', 'select=plan,status&status=in.(active,trialing)') as Array<Record<string, unknown>>
      const planCounts = new Map<string, number>()
      for (const s of subs) {
        const plan = String(s.plan || 'unknown')
        planCounts.set(plan, (planCounts.get(plan) || 0) + 1)
      }

      sections.push([
        `── Subscription Breakdown ──`,
        ...Array.from(planCounts.entries()).map(([plan, count]) =>
          `  ${plan.padEnd(20)} ${count} subscribers`
        ),
        `  ${'─'.repeat(35)}`,
        `  Total active:      ${subs.length}`,
      ].join('\n'))

      // MRR estimate (basic)
      const PLAN_PRICES: Record<string, number> = {
        pro_monthly: 12, pro_annual: 8, // per month
        max_monthly: 29, max_annual: 20,
      }
      let mrr = 0
      for (const [plan, count] of planCounts) {
        mrr += (PLAN_PRICES[plan] || 0) * count
      }
      sections.push([
        `── Revenue ──`,
        `  Estimated MRR: $${mrr.toFixed(2)}`,
        `  Estimated ARR: $${(mrr * 12).toFixed(2)}`,
      ].join('\n'))

      // Cost tracking
      try {
        const costs = supabaseQuery('usage_costs',
          `select=cost_usd,provider&created_at=gte.${new Date(Date.now() - 30 * 86400_000).toISOString()}`) as Array<Record<string, unknown>>
        const totalCost = costs.reduce((sum, c) => sum + Number(c.cost_usd || 0), 0)
        const byProvider = new Map<string, number>()
        for (const c of costs) {
          const p = String(c.provider || 'unknown')
          byProvider.set(p, (byProvider.get(p) || 0) + Number(c.cost_usd || 0))
        }
        sections.push([
          `── API Costs (30d) ──`,
          `  Total: $${totalCost.toFixed(2)}`,
          ...Array.from(byProvider.entries()).sort((a, b) => b[1] - a[1]).map(([p, cost]) =>
            `  ${p.padEnd(15)} $${cost.toFixed(2)}`
          ),
          ``,
          `  Margin: ${mrr > 0 ? ((1 - totalCost / mrr) * 100).toFixed(0) + '%' : 'n/a (no revenue)'}`,
        ].join('\n'))
      } catch { sections.push('── Costs ──\n  Requires usage_costs table') }

      return sections.join('\n\n')
    },
  })
  count++

  return count
}
