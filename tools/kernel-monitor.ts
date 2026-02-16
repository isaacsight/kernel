#!/usr/bin/env npx tsx
// ─── Kernel Engine Monitor ─── Terminal Dashboard ───
// Run: npx tsx tools/kernel-monitor.ts

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import blessed from 'blessed';
import contrib from 'blessed-contrib';

// ─── Supabase (service_role key bypasses RLS for full admin access) ───
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── State ──────────────────────────────────────────
interface AgentCount { agent_id: string; count: number }
interface UserProfile {
  user_id: string;
  email?: string;
  message_count: number;
  updated_at: string;
  profile: Record<string, unknown>;
}

let agentCounts: AgentCount[] = [];
let allUsers: UserProfile[] = [];
let selectedUserIndex = 0;
let authEmailMap: Record<string, string> = {};
let stats = {
  messages: 0,
  conversations: 0,
  users: 0,
  memoryProfiles: 0,
  qualitySignals: 0,
  helpfulRate: 0,
  subscribers: 0,
};
let revenue = {
  activeCount: 0,
  canceledCount: 0,
  mrr: 0,
  trend: '',
};

// ─── TUI Setup ──────────────────────────────────────
const screen = blessed.screen({
  smartCSR: true,
  title: 'Kernel Engine Monitor',
  fullUnicode: true,
});

const grid = new contrib.grid({ rows: 12, cols: 12, screen });

// ─── Title ──────────────────────────────────────────
const title = grid.set(0, 0, 1, 12, blessed.box, {
  content: '{center}{bold} KERNEL ENGINE MONITOR {/bold}{/center}',
  tags: true,
  style: {
    fg: 'white',
    bg: 'black',
    border: { fg: 'cyan' },
  },
  border: { type: 'line' },
});

// ─── Message Feed (top-left, rows 1-5, cols 0-7) ───
const messageFeed = grid.set(1, 0, 5, 7, contrib.log, {
  label: ' Message Feed ',
  fg: 'green',
  tags: true,
  border: { type: 'line', fg: 'cyan' },
  style: { border: { fg: 'cyan' } },
  bufferLength: 100,
  scrollback: 200,
});

// ─── Agent Routing (top-right, rows 1-3, cols 7-12) ─
const agentChart = grid.set(1, 7, 3, 5, contrib.bar, {
  label: ' Agent Routing ',
  barWidth: 8,
  barSpacing: 2,
  xOffset: 0,
  maxHeight: 100,
  border: { type: 'line', fg: 'cyan' },
  style: { border: { fg: 'cyan' } },
});

// ─── Revenue / MRR (rows 3-5, cols 7-12) ────────────
const revenueBox = grid.set(3, 7, 2, 5, blessed.box, {
  label: ' Revenue / MRR ',
  tags: true,
  border: { type: 'line', fg: 'cyan' },
  style: {
    fg: 'white',
    border: { fg: 'cyan' },
  },
  padding: { left: 1, right: 1 },
});

// ─── User Directory (rows 5-8, cols 0-3) ────────────
const userList = grid.set(5, 0, 3, 3, blessed.list, {
  label: ' User Directory ',
  tags: true,
  border: { type: 'line', fg: 'cyan' },
  style: {
    fg: 'white',
    border: { fg: 'cyan' },
    selected: { fg: 'black', bg: 'cyan' },
  },
  keys: true,
  mouse: true,
  scrollable: true,
  padding: { left: 1, right: 1 },
});

// ─── User Memory (rows 5-8, cols 3-8) ───────────────
const memoryBox = grid.set(5, 3, 3, 5, blessed.box, {
  label: ' User Memory ',
  tags: true,
  border: { type: 'line', fg: 'cyan' },
  style: {
    fg: 'white',
    border: { fg: 'cyan' },
  },
  scrollable: true,
  alwaysScroll: true,
  padding: { left: 1, right: 1 },
});

// ─── System Stats (middle-right) ────────────────────
const statsBox = grid.set(5, 8, 3, 4, blessed.box, {
  label: ' System Stats ',
  tags: true,
  border: { type: 'line', fg: 'cyan' },
  style: {
    fg: 'white',
    border: { fg: 'cyan' },
  },
  padding: { left: 1, right: 1 },
});

// ─── Collective Insights (bottom-middle) ────────────
const insightsBox = grid.set(8, 0, 2, 12, blessed.box, {
  label: ' Collective Insights ',
  tags: true,
  border: { type: 'line', fg: 'cyan' },
  style: {
    fg: 'white',
    border: { fg: 'cyan' },
  },
  scrollable: true,
  padding: { left: 1, right: 1 },
});

// ─── Activity Log (bottom) ──────────────────────────
const activityLog = grid.set(10, 0, 2, 12, contrib.log, {
  label: ' Activity Log ',
  fg: 'yellow',
  tags: true,
  border: { type: 'line', fg: 'cyan' },
  style: { border: { fg: 'cyan' } },
  bufferLength: 50,
  scrollback: 100,
});

// ─── Helpers ────────────────────────────────────────
function timestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function truncate(s: string, len: number): string {
  if (!s) return '';
  const clean = s.replace(/\n/g, ' ').trim();
  return clean.length > len ? clean.slice(0, len) + '...' : clean;
}

function renderStats() {
  statsBox.setContent(
    `{bold}Messages:{/bold}        ${stats.messages.toLocaleString()}\n` +
    `{bold}Conversations:{/bold}   ${stats.conversations.toLocaleString()}\n` +
    `{bold}Users:{/bold}           ${stats.users.toLocaleString()}\n` +
    `{bold}Subscribers:{/bold}     ${stats.subscribers.toLocaleString()}\n` +
    `{bold}Memory profiles:{/bold} ${stats.memoryProfiles.toLocaleString()}\n` +
    `{bold}Quality signals:{/bold} ${stats.qualitySignals.toLocaleString()}\n` +
    `{bold}Helpful rate:{/bold}    ${stats.helpfulRate}%`
  );
  screen.render();
}

function renderAgentChart() {
  if (agentCounts.length === 0) {
    agentChart.setData({
      titles: ['(no data)'],
      data: [0],
    });
  } else {
    agentChart.setData({
      titles: agentCounts.map(a => a.agent_id.slice(0, 10)),
      data: agentCounts.map(a => a.count),
    });
  }
  screen.render();
}

function renderRevenue() {
  const mrrFormatted = `$${revenue.mrr.toLocaleString()}`;
  const trendColor = revenue.trend === 'Growing' ? 'green' : revenue.trend === 'Declining' ? 'red' : 'yellow';
  revenueBox.setContent(
    `{bold}MRR:{/bold}          ${mrrFormatted}\n` +
    `{bold}Subscribers:{/bold}  ${revenue.activeCount}\n` +
    `{bold}Churned:{/bold}      ${revenue.canceledCount}\n` +
    `{bold}Trend:{/bold}        {${trendColor}-fg}${revenue.trend || 'N/A'}{/}`
  );
  screen.render();
}

// ─── Data Fetchers ──────────────────────────────────

async function fetchAgentCounts() {
  const { data, error } = await supabase
    .from('messages')
    .select('agent_id');

  if (error) {
    activityLog.log(`{red-fg}Error fetching agent counts: ${error.message}{/}`);
    return;
  }

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    counts[row.agent_id] = (counts[row.agent_id] || 0) + 1;
  }

  agentCounts = Object.entries(counts)
    .map(([agent_id, count]) => ({ agent_id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  renderAgentChart();
}

const PRICE_PER_MONTH = 10;

async function fetchRevenue() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status');

  if (error) {
    activityLog.log(`{red-fg}Error fetching revenue: ${error.message}{/}`);
    return;
  }

  const statusCounts: Record<string, number> = {};
  for (const row of data || []) {
    statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
  }

  revenue.activeCount = statusCounts['active'] || 0;
  revenue.canceledCount = statusCounts['canceled'] || 0;
  revenue.mrr = revenue.activeCount * PRICE_PER_MONTH;

  const total = revenue.activeCount + revenue.canceledCount;
  if (total === 0) {
    revenue.trend = 'No data';
  } else if (revenue.canceledCount === 0) {
    revenue.trend = 'Growing';
  } else if (revenue.canceledCount > revenue.activeCount) {
    revenue.trend = 'Declining';
  } else {
    revenue.trend = 'Stable';
  }

  renderRevenue();
}

async function fetchStats() {
  const [msgRes, convRes, memRes, sigRes, helpfulRes, subRes] = await Promise.all([
    supabase.from('messages').select('id', { count: 'exact', head: true }),
    supabase.from('conversations').select('id', { count: 'exact', head: true }),
    supabase.from('user_memory').select('user_id', { count: 'exact', head: true }),
    supabase.from('response_signals').select('id', { count: 'exact', head: true }),
    supabase.from('response_signals').select('id', { count: 'exact', head: true }).eq('response_quality', 'helpful'),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ]);

  stats.messages = msgRes.count ?? 0;
  stats.conversations = convRes.count ?? 0;
  stats.memoryProfiles = memRes.count ?? 0;
  stats.qualitySignals = sigRes.count ?? 0;
  stats.subscribers = subRes.count ?? 0;

  const helpfulCount = helpfulRes.count ?? 0;
  stats.helpfulRate = stats.qualitySignals > 0
    ? Math.round((helpfulCount / stats.qualitySignals) * 100)
    : 0;

  // Get auth users for total count + email mapping
  try {
    const { data: authData } = await supabase.auth.admin.listUsers();
    if (authData?.users) {
      stats.users = authData.users.length;
      // Store email map for user directory
      for (const u of authData.users) {
        authEmailMap[u.id] = u.email || '';
      }
    }
  } catch {
    // Fallback: count unique users from conversations
    const { data: userRows } = await supabase
      .from('conversations')
      .select('user_id');
    const uniqueUsers = new Set((userRows || []).map(r => r.user_id));
    stats.users = uniqueUsers.size;
  }

  renderStats();
}

async function fetchInsights() {
  const { data, error } = await supabase
    .from('collective_insights')
    .select('*')
    .order('strength', { ascending: false })
    .limit(10);

  if (error) {
    activityLog.log(`{red-fg}Error fetching insights: ${error.message}{/}`);
    return;
  }

  if (!data || data.length === 0) {
    insightsBox.setContent('{gray-fg}No collective insights yet{/}');
  } else {
    const lines = data.map(i => {
      const pct = Math.round(i.strength * 100);
      return `{cyan-fg}[${pct}%]{/} ${truncate(i.content, 70)}`;
    });
    insightsBox.setContent(lines.join('\n'));
  }
  screen.render();
}

function renderSelectedUser() {
  if (allUsers.length === 0) {
    memoryBox.setContent('{gray-fg}Select a user from the directory{/}');
    screen.render();
    return;
  }

  const user = allUsers[selectedUserIndex];
  if (!user) return;

  const profile = user.profile || {};
  const subLabel = profile.subscription === 'active'
    ? '{green-fg}Active subscriber{/}'
    : '{gray-fg}Free{/}';

  const lines = [
    `{bold}${user.email || user.user_id.slice(0, 24)}{/bold}`,
    `${subLabel}  |  ${user.message_count} msgs`,
    `{gray-fg}Signed up: ${profile.signed_up || '?'}  via ${profile.provider || '?'}{/}`,
    '',
  ];

  // Show learned memory fields (skip meta fields we added)
  const skip = new Set(['subscription', 'signed_up', 'provider']);
  for (const [key, val] of Object.entries(profile)) {
    if (skip.has(key)) continue;
    if (Array.isArray(val)) {
      lines.push(`{bold}${key}:{/bold} ${val.join(', ')}`);
    } else if (typeof val === 'string') {
      lines.push(`{bold}${key}:{/bold} ${truncate(val, 50)}`);
    } else if (val && typeof val === 'object') {
      lines.push(`{bold}${key}:{/bold} ${truncate(JSON.stringify(val), 50)}`);
    }
  }

  if (Object.keys(profile).filter(k => !skip.has(k)).length === 0) {
    lines.push('{gray-fg}No learned memory yet{/}');
  }

  memoryBox.setContent(lines.join('\n'));
  screen.render();
}

function renderUserList() {
  if (allUsers.length === 0) {
    (userList as any).setItems(['{gray-fg}No users yet{/}']);
  } else {
    const items = allUsers.map((u) => {
      const name = u.email || u.user_id.slice(0, 16) + '...';
      const sub = u.profile.subscription === 'active' ? '{green-fg}${/} ' : '  ';
      return `${sub}${name}`;
    });
    (userList as any).setItems(items);
    (userList as any).select(selectedUserIndex);
  }
  screen.render();
}

async function fetchAllUsers() {
  // Fetch auth users, memory profiles, subscriptions, and message counts in parallel
  const [authRes, memoryRes, subsRes, msgRes] = await Promise.all([
    supabase.auth.admin.listUsers(),
    supabase.from('user_memory').select('*').order('updated_at', { ascending: false }),
    supabase.from('subscriptions').select('user_id, status'),
    supabase.from('messages').select('user_id'),
  ]);

  // Build lookup maps
  const memoryMap: Record<string, any> = {};
  for (const m of memoryRes.data || []) {
    memoryMap[m.user_id] = m;
  }

  const subStatusMap: Record<string, string> = {};
  for (const s of subsRes.data || []) {
    if (s.user_id) subStatusMap[s.user_id] = s.status;
  }

  // Count messages per user
  const msgCountMap: Record<string, number> = {};
  for (const m of msgRes.data || []) {
    if (m.user_id) msgCountMap[m.user_id] = (msgCountMap[m.user_id] || 0) + 1;
  }

  // Update auth email map
  const authUsers = authRes.data?.users || [];
  for (const u of authUsers) {
    authEmailMap[u.id] = u.email || '';
  }

  // Build user list from ALL auth users
  allUsers = authUsers.map(u => {
    const mem = memoryMap[u.id];
    const sub = subStatusMap[u.id];
    return {
      user_id: u.id,
      email: u.email || undefined,
      message_count: mem?.message_count ?? msgCountMap[u.id] ?? 0,
      updated_at: mem?.updated_at || u.created_at || '',
      profile: {
        ...(mem?.profile as Record<string, unknown> || {}),
        ...(sub ? { subscription: sub } : {}),
        signed_up: new Date(u.created_at || '').toLocaleDateString(),
        provider: u.app_metadata?.provider || 'email',
      },
    };
  });

  // Sort: subscribers first, then by message count
  allUsers.sort((a, b) => {
    const aSub = a.profile.subscription ? 1 : 0;
    const bSub = b.profile.subscription ? 1 : 0;
    if (bSub !== aSub) return bSub - aSub;
    return b.message_count - a.message_count;
  });

  stats.memoryProfiles = Object.keys(memoryMap).length;
  stats.users = allUsers.length;
  renderUserList();
  renderSelectedUser();
  renderStats();
}

async function fetchRecentMessages() {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    activityLog.log(`{red-fg}Error fetching messages: ${error.message}{/}`);
    return;
  }

  for (const msg of (data || []).reverse()) {
    const agent = msg.agent_id || 'unknown';
    const role = msg.user_id ? 'User' : 'Agent';
    messageFeed.log(`{cyan-fg}[${agent}]{/} ${role}: ${truncate(msg.content, 60)}`);
  }
}

// ─── Real-time Subscriptions ────────────────────────
const channels: RealtimeChannel[] = [];

function setupRealtime() {
  // Messages
  const msgChannel = supabase
    .channel('monitor-messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const msg = payload.new as any;
      const agent = msg.agent_id || 'unknown';
      const role = msg.user_id ? 'User' : 'Agent';
      messageFeed.log(`{cyan-fg}[${agent}]{/} ${role}: ${truncate(msg.content, 60)}`);
      activityLog.log(`{green-fg}${timestamp()}{/}  new message  {cyan-fg}[${agent}]{/} "${truncate(msg.content, 40)}"`);
      stats.messages++;
      renderStats();
      fetchAgentCounts();
    })
    .subscribe();
  channels.push(msgChannel);

  // Quality signals
  const sigChannel = supabase
    .channel('monitor-signals')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'response_signals' }, (payload) => {
      const sig = payload.new as any;
      activityLog.log(`{green-fg}${timestamp()}{/}  quality signal  {yellow-fg}${sig.response_quality}{/}  ${sig.conversation_id?.slice(0, 16) || ''}`);
      stats.qualitySignals++;
      fetchStats();
    })
    .subscribe();
  channels.push(sigChannel);

  // User memory
  const memChannel = supabase
    .channel('monitor-memory')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_memory' }, (payload) => {
      const mem = payload.new as any;
      activityLog.log(`{green-fg}${timestamp()}{/}  memory updated  user ${mem.user_id?.slice(0, 16) || '?'}...  count: ${mem.message_count ?? '?'}`);
      fetchAllUsers();
      renderStats();
    })
    .subscribe();
  channels.push(memChannel);

  // Conversations
  const convChannel = supabase
    .channel('monitor-conversations')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, (payload) => {
      const conv = payload.new as any;
      activityLog.log(`{green-fg}${timestamp()}{/}  new conversation  "${truncate(conv.title, 30)}"`);
      stats.conversations++;
      renderStats();
    })
    .subscribe();
  channels.push(convChannel);
}

// ─── Boot ───────────────────────────────────────────
async function boot() {
  activityLog.log(`{green-fg}${timestamp()}{/}  Connecting to Supabase...`);

  // Load initial data in parallel
  await Promise.all([
    fetchRecentMessages(),
    fetchAgentCounts(),
    fetchStats(),
    fetchRevenue(),
    fetchInsights(),
    fetchAllUsers(),
  ]);

  activityLog.log(`{green-fg}${timestamp()}{/}  Initial data loaded. Subscribing to real-time...`);

  setupRealtime();

  activityLog.log(`{green-fg}${timestamp()}{/}  {bold}Monitor active.{/bold} Tab to browse users. q or Ctrl+C to exit.`);

  // Periodic refreshes
  setInterval(fetchStats, 30_000);
  setInterval(fetchRevenue, 30_000);
  setInterval(fetchInsights, 60_000);
  setInterval(fetchAllUsers, 30_000);

  screen.render();
}

// ─── User List Navigation ───────────────────────────
userList.on('select item', (_item: any, index: number) => {
  selectedUserIndex = index;
  renderSelectedUser();
});

// Tab to focus user list for keyboard navigation
screen.key(['tab'], () => {
  userList.focus();
  screen.render();
});

// ─── Keybindings ────────────────────────────────────
screen.key(['escape', 'q', 'C-c'], () => {
  for (const ch of channels) {
    supabase.removeChannel(ch);
  }
  return process.exit(0);
});

// ─── Start ──────────────────────────────────────────
boot().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
