// Supabase Client - Persistent storage for the swarm
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co';
// IMPORTANT: If Supabase API keys are rotated, update this fallback to match.
// The .env value takes precedence at build time; this is only a safety net.
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || '';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: 'implicit', // Implicit puts tokens in hash fragment — no code_verifier to lose on mobile redirects
    detectSessionInUrl: false, // We handle URL detection manually in main.tsx (hash router would clobber it)
    autoRefreshToken: true,
  },
});

// Database types
export interface DBProject {
  id: string;
  client_name: string;
  client_email?: string;
  description: string;
  project_type: string;
  status: 'quoted' | 'paid' | 'in_progress' | 'delivered' | 'completed';
  quoted_price: number;
  paid_amount: number;
  created_at: string;
  updated_at: string;
}

export interface DBOpportunity {
  id: string;
  source: string;
  url?: string;
  author: string;
  content: string;
  is_viable: boolean;
  project_type?: string;
  estimated_value: number;
  urgency: string;
  confidence: number;
  status: 'new' | 'contacted' | 'converted' | 'rejected';
  created_at: string;
}

export interface DBTransaction {
  id: string;
  type: 'revenue' | 'expense' | 'trading_profit' | 'trading_loss';
  amount: number;
  description: string;
  project_id?: string;
  created_at: string;
}

export interface DBMessage {
  id: string;
  channel_id: string;
  agent_id: string;
  content: string;
  tool_calls?: any;
  user_id?: string;
  created_at: string;
}

export interface DBConversation {
  id: string;
  user_id: string;
  title: string;
  folder_id: string | null;
  starred_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

// Projects
export async function saveProject(project: Omit<DBProject, 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('projects')
    .upsert({
      ...project,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) console.error('Error saving project:', error);
  return data;
}

export async function getProjects(status?: DBProject['status']) {
  let query = supabase.from('projects').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) console.error('Error fetching projects:', error);
  return data || [];
}

export async function updateProjectStatus(id: string, status: DBProject['status']) {
  const { error } = await supabase
    .from('projects')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('Error updating project:', error);
}

// Opportunities
export async function saveOpportunity(opp: Omit<DBOpportunity, 'created_at'>) {
  const { data, error } = await supabase
    .from('opportunities')
    .upsert(opp)
    .select()
    .single();

  if (error) console.error('Error saving opportunity:', error);
  return data;
}

export async function getOpportunities(status?: DBOpportunity['status']) {
  let query = supabase.from('opportunities').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) console.error('Error fetching opportunities:', error);
  return data || [];
}

export async function updateOpportunityStatus(id: string, status: DBOpportunity['status']) {
  const { error } = await supabase
    .from('opportunities')
    .update({ status })
    .eq('id', id);
  if (error) console.error('Error updating opportunity:', error);
}

// Transactions
export async function saveTransaction(tx: Omit<DBTransaction, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      ...tx,
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    })
    .select()
    .single();

  if (error) console.error('Error saving transaction:', error);
  return data;
}

export async function getTransactions(type?: DBTransaction['type']) {
  let query = supabase.from('transactions').select('*').order('created_at', { ascending: false });
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) console.error('Error fetching transactions:', error);
  return data || [];
}

export async function getTotalRevenue(): Promise<number> {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'revenue');

  if (error) {
    console.error('Error fetching revenue:', error);
    return 0;
  }
  return data?.reduce((sum, tx) => sum + tx.amount, 0) || 0;
}

// Messages (for conversation persistence)
export async function saveMessage(msg: Omit<DBMessage, 'created_at'> & { attachments?: { name: string; type: string; url?: string }[] }) {
  const { error } = await supabase.from('messages').insert(msg);
  if (error) console.error('Error saving message:', error);
}

export async function getUserRecentMessages(userId: string, limit = 40): Promise<DBMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) console.error('Error fetching user history:', error);
  return (data || []).reverse();
}

export async function getChannelMessages(channelId: string, limit = 50) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) console.error('Error fetching messages:', error);
  return data || [];
}

// Conversations
export async function createConversation(
  userId: string,
  title = 'New Conversation',
  metadata?: Record<string, unknown>
): Promise<DBConversation | null> {
  const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Proactively refresh session — getSession() can return a stale/expired JWT
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    console.error('[createConversation] Session refresh failed:', refreshError.message);
  }

  const row: Record<string, unknown> = { id, user_id: userId, title }
  if (metadata) row.metadata = metadata

  const { data, error } = await supabase
    .from('conversations')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('[createConversation] Error:', error.code, error.message, error.details);
    throw new Error(`${error.message} (${error.code})`);
  }
  return data;
}

export async function getUserConversations(
  userId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<(DBConversation & { metadata?: Record<string, unknown> })[]> {
  let query = supabase
    .from('conversations')
    .select('*, metadata, folder_id, starred_at, archived_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (!includeArchived) {
    query = query.is('archived_at', null);
  }

  const { data, error } = await query;
  if (error) console.error('Error fetching conversations:', error);
  return (data || []).map(d => ({
    ...d,
    folder_id: d.folder_id ?? null,
    starred_at: d.starred_at ?? null,
    archived_at: d.archived_at ?? null,
  }));
}

export async function getArchivedConversations(userId: string): Promise<DBConversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*, folder_id, starred_at, archived_at')
    .eq('user_id', userId)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false });
  if (error) console.error('Error fetching archived conversations:', error);
  return (data || []).map(d => ({ ...d, folder_id: d.folder_id ?? null, starred_at: d.starred_at ?? null, archived_at: d.archived_at ?? null }));
}

export async function starConversation(id: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ starred_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('Error starring conversation:', error);
}

export async function unstarConversation(id: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ starred_at: null })
    .eq('id', id);
  if (error) console.error('Error unstarring conversation:', error);
}

export async function archiveConversation(id: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('Error archiving conversation:', error);
}

export async function unarchiveConversation(id: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ archived_at: null })
    .eq('id', id);
  if (error) console.error('Error unarchiving conversation:', error);
}

export async function getWorkspaceConversations(workspaceId: string): Promise<DBConversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*, folder_id, starred_at, archived_at')
    .eq('workspace_id', workspaceId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false });
  if (error) console.error('Error fetching workspace conversations:', error);
  return (data || []).map(d => ({ ...d, folder_id: d.folder_id ?? null, starred_at: d.starred_at ?? null, archived_at: d.archived_at ?? null }));
}

export async function getSharedWithMeConversations(userId: string): Promise<DBConversation[]> {
  const { data, error } = await supabase
    .from('live_share_participants')
    .select('share:live_shares!inner(conversation_id)')
    .eq('user_id', userId);
  if (error || !data) {
    console.error('Error fetching shared conversations:', error);
    return [];
  }
  const convIds = data.map((d: any) => d.share?.conversation_id).filter(Boolean) as string[];
  if (convIds.length === 0) return [];
  const { data: convs, error: convErr } = await supabase
    .from('conversations')
    .select('*, folder_id, starred_at, archived_at')
    .in('id', convIds)
    .order('updated_at', { ascending: false });
  if (convErr) console.error('Error fetching shared conversations:', convErr);
  return (convs || []).map(d => ({ ...d, folder_id: d.folder_id ?? null, starred_at: d.starred_at ?? null, archived_at: d.archived_at ?? null }));
}

// ─── Conversation Folders ────────────────────────────────

export async function moveConversationToFolder(
  conversationId: string,
  folderId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ folder_id: folderId })
    .eq('id', conversationId);
  if (error) console.error('Error moving conversation to folder:', error);
}

// ─── Conversation Metadata ──────────────────────────────

/** Patch-merge metadata on a conversation's JSONB column */
export async function updateConversationMetadata(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  // Read current metadata, merge, write back
  const { data } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', id)
    .maybeSingle();

  const existing = (data?.metadata as Record<string, unknown>) || {};
  const merged = { ...existing, ...patch };

  const { error } = await supabase
    .from('conversations')
    .update({ metadata: merged, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('Error updating conversation metadata:', error);
}

/** Read metadata from a conversation */
export async function getConversationMetadata(
  id: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', id)
    .maybeSingle();

  if (error) console.error('Error fetching conversation metadata:', error);
  return (data?.metadata as Record<string, unknown>) || null;
}

export async function getLastAgentId(conversationId: string): Promise<string> {
  const { data } = await supabase
    .from('messages')
    .select('agent_id')
    .eq('channel_id', conversationId)
    .neq('agent_id', 'user')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data?.agent_id || 'kernel';
}

export async function updateConversationTitle(id: string, title: string) {
  const { error } = await supabase
    .from('conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('Error updating conversation title:', error);
}

export async function touchConversation(id: string) {
  const { error } = await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('Error touching conversation:', error);
}

export async function deleteConversation(id: string) {
  // Delete messages first, then the conversation
  const { error: msgErr } = await supabase
    .from('messages')
    .delete()
    .eq('channel_id', id);
  if (msgErr) console.error('Error deleting conversation messages:', msgErr);

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id);
  if (error) console.error('Error deleting conversation:', error);
}

// Initialize database tables if they don't exist
export async function initializeDatabase() {
  console.log('Checking database connection...');

  // Test connection
  const { error } = await supabase.from('projects').select('count').limit(1);

  if (error && error.code === '42P01') {
    console.log('Tables do not exist. Please run the SQL schema in Supabase dashboard.');
    return false;
  }

  if (error) {
    console.error('Database error:', error);
    return false;
  }

  console.log('Database connected successfully!');
  return true;
}

// Subscriptions (billing)
export interface DBSubscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: 'active' | 'trialing' | 'canceled' | 'past_due' | 'inactive';
  plan: 'pro_monthly' | 'pro_annual' | 'max_monthly' | 'max_annual';
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export async function getMySubscription(): Promise<DBSubscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .in('status', ['active', 'trialing'])
    .maybeSingle();

  if (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }
  return data;
}

// ─── User Goals ─────────────────────────────────────────

import type { UserGoal } from './GoalTracker'

export async function getUserGoals(userId: string): Promise<UserGoal[]> {
  const { data, error } = await supabase
    .from('user_goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) console.error('Error fetching user goals:', error);
  return (data || []) as UserGoal[];
}

export async function upsertUserGoal(goal: UserGoal): Promise<UserGoal | null> {
  if (goal.id) {
    const { data, error } = await supabase
      .from('user_goals')
      .update({
        title: goal.title,
        description: goal.description,
        category: goal.category,
        status: goal.status,
        priority: goal.priority,
        target_date: goal.target_date,
        milestones: goal.milestones,
        progress_notes: goal.progress_notes,
        check_in_frequency: goal.check_in_frequency,
        last_check_in_at: goal.last_check_in_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', goal.id)
      .select()
      .single();

    if (error) console.error('Error updating goal:', error);
    return data as UserGoal | null;
  }

  const { data, error } = await supabase
    .from('user_goals')
    .insert({
      user_id: goal.user_id,
      title: goal.title,
      description: goal.description,
      category: goal.category,
      status: goal.status,
      priority: goal.priority,
      target_date: goal.target_date,
      milestones: goal.milestones,
      progress_notes: goal.progress_notes,
      check_in_frequency: goal.check_in_frequency,
    })
    .select()
    .single();

  if (error) console.error('Error creating goal:', error);
  return data as UserGoal | null;
}

export async function deleteUserGoal(id: string): Promise<void> {
  const { error } = await supabase
    .from('user_goals')
    .delete()
    .eq('id', id);
  if (error) console.error('Error deleting goal:', error);
}

// ─── Shared Conversations ───────────────────────────────

export async function createSharedConversation(params: {
  conversationId: string;
  userId: string;
  title: string;
  messages: { role: string; content: string; agentName?: string; timestamp: number }[];
  expiresAt: string | null;
}): Promise<string | null> {
  const id = crypto.randomUUID();
  const { error } = await supabase
    .from('shared_conversations')
    .insert({
      id,
      conversation_id: params.conversationId,
      user_id: params.userId,
      title: params.title,
      messages: params.messages,
      expires_at: params.expiresAt,
    });

  if (error) {
    console.error('Error creating shared conversation:', error);
    return null;
  }
  return id;
}

export async function deleteSharedConversation(id: string): Promise<void> {
  const { error } = await supabase
    .from('shared_conversations')
    .delete()
    .eq('id', id);
  if (error) console.error('Error deleting shared conversation:', error);
}

export async function getShareCountToday(userId: string): Promise<number> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { count, error } = await supabase
    .from('shared_conversations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', todayStart.toISOString());
  if (error) {
    console.error('Error counting shares:', error);
    return 0;
  }
  return count ?? 0;
}

export async function getSharedConversation(conversationId: string): Promise<{
  id: string;
  expires_at: string | null;
  created_at: string;
} | null> {
  const { data, error } = await supabase
    .from('shared_conversations')
    .select('id, expires_at, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching shared conversation:', error);
    return null;
  }
  return data;
}

// ─── Fork Shared Conversation ────────────────────────────

export async function forkSharedConversation(
  userId: string,
  title: string,
  messages: { role: string; content: string; agentName?: string; timestamp?: number }[],
  metadata?: Record<string, unknown>
): Promise<string> {
  const conv = await createConversation(userId, title, metadata)
  if (!conv) throw new Error('Failed to create conversation — no data returned.')

  const MAX_CONTENT = 32_000
  const now = Date.now()
  const rows = messages.map((msg, i) => {
    const ts = msg.timestamp && !isNaN(msg.timestamp) ? msg.timestamp : now - (messages.length - i) * 1000
    return {
      id: `msg_${now}_${i}_${Math.random().toString(36).substr(2, 6)}`,
      channel_id: conv.id,
      agent_id: msg.role === 'user' ? 'user' : (msg.agentName?.toLowerCase() || 'kernel'),
      content: msg.content.slice(0, MAX_CONTENT),
      user_id: userId,
      created_at: new Date(ts).toISOString(),
    }
  })

  // Insert in batches of 50 to avoid payload limits
  const BATCH = 50
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase.from('messages').insert(batch)
    if (error) {
      console.error('Error inserting messages batch:', error)
      throw new Error(`Failed to save messages: ${error.message}`)
    }
  }

  return conv.id
}

// ─── Collective Intelligence ────────────────────────────

export interface DBResponseSignal {
  id: string;
  user_id: string;
  conversation_id: string;
  topic: string;
  response_quality: 'helpful' | 'neutral' | 'poor';
  created_at: string;
}

export interface DBCollectiveInsight {
  id: string;
  insight_type: 'topic_trend' | 'effective_pattern' | 'user_learning';
  content: string;
  strength: number;
  contributor_count: number;
  created_at: string;
  updated_at: string;
}

export async function saveResponseSignal(signal: Omit<DBResponseSignal, 'created_at'>): Promise<boolean> {
  const { error } = await supabase.from('response_signals').insert(signal);
  if (error) { console.error('Error saving response signal:', error); return false }
  return true
}

export async function updateSignalQuality(id: string, quality: 'helpful' | 'poor'): Promise<boolean> {
  const { error } = await supabase
    .from('response_signals')
    .update({ response_quality: quality })
    .eq('id', id);
  if (error) { console.error('Error updating signal quality:', error); return false }
  return true
}

export async function getCollectiveInsights(limit = 10): Promise<DBCollectiveInsight[]> {
  const { data, error } = await supabase
    .from('collective_insights')
    .select('*')
    .order('strength', { ascending: false })
    .limit(limit);

  if (error) console.error('Error fetching collective insights:', error);
  return data || [];
}

export async function upsertCollectiveInsight(
  topic: string,
  insightType: DBCollectiveInsight['insight_type'] = 'topic_trend'
) {
  const id = `insight_${topic.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60)}`;

  // Check if it already exists
  const { data: existing } = await supabase
    .from('collective_insights')
    .select('strength, contributor_count')
    .eq('id', id)
    .maybeSingle();

  if (existing) {
    const newStrength = Math.min(1, existing.strength + 0.05);
    const { error } = await supabase
      .from('collective_insights')
      .update({
        strength: newStrength,
        contributor_count: existing.contributor_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) console.error('Error updating collective insight:', error);
  } else {
    const { error } = await supabase
      .from('collective_insights')
      .insert({
        id,
        insight_type: insightType,
        content: `Users find responses about "${topic}" helpful`,
        strength: 0.1,
        contributor_count: 1,
      });
    if (error) console.error('Error creating collective insight:', error);
  }
}

// ─── User Memory ────────────────────────────────────────

export interface DBUserMemory {
  user_id: string;
  profile: Record<string, unknown>;
  message_count: number;
  updated_at: string;
  agent_facets?: Record<string, unknown>;
  convergence_insights?: unknown[];
  last_convergence?: string | null;
  loom_state?: Record<string, unknown>;
  user_theory?: Record<string, unknown>;
  growth_state?: Record<string, unknown>;
  identity_graph?: unknown[];
}

export async function getUserMemory(userId: string): Promise<DBUserMemory | null> {
  const { data, error } = await supabase
    .from('user_memory')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) console.error('Error fetching user memory:', error);
  return data;
}

export async function upsertUserMemory(
  userId: string,
  profile: Record<string, unknown>,
  _messageCount?: number
) {
  // message_count is now managed server-side by the atomic increment_message_count
  // Postgres function (called from claude-proxy). Client only updates profile data.
  const { error } = await supabase
    .from('user_memory')
    .upsert({
      user_id: userId,
      profile,
      updated_at: new Date().toISOString(),
    });
  if (error) console.error('Error upserting user memory:', error);
}

export async function upsertUserMirror(
  userId: string,
  agentFacets: Record<string, unknown>,
  convergenceInsights: unknown[],
  lastConvergence?: string | null,
) {
  const payload: Record<string, unknown> = {
    user_id: userId,
    agent_facets: agentFacets,
    convergence_insights: convergenceInsights,
    updated_at: new Date().toISOString(),
  };
  if (lastConvergence) payload.last_convergence = lastConvergence;
  const { error } = await supabase
    .from('user_memory')
    .upsert(payload);
  if (error) console.error('Error upserting user mirror:', error);
}

// ─── Loom State (reflexive intelligence) ─────────────────

export async function getLoomState(userId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('user_memory')
    .select('loom_state')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) console.error('Error fetching loom state:', error);
  return data?.loom_state as Record<string, unknown> | null;
}

export async function upsertLoomState(
  userId: string,
  loomState: Record<string, unknown>,
) {
  const { error } = await supabase
    .from('user_memory')
    .upsert({
      user_id: userId,
      loom_state: loomState,
      updated_at: new Date().toISOString(),
    });
  if (error) console.error('Error upserting loom state:', error);
}

// ─── User Theory (predictive model) ──────────────────────

export async function getUserTheory(userId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('user_memory')
    .select('user_theory')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) console.error('Error fetching user theory:', error);
  return data?.user_theory as Record<string, unknown> | null;
}

export async function upsertUserTheory(
  userId: string,
  userTheory: Record<string, unknown>,
) {
  const { error } = await supabase
    .from('user_memory')
    .upsert({
      user_id: userId,
      user_theory: userTheory,
      updated_at: new Date().toISOString(),
    });
  if (error) console.error('Error upserting user theory:', error);
}

// ─── Growth State (relationship maturity) ────────────────

export async function upsertGrowthState(
  userId: string,
  growthState: Record<string, unknown>,
) {
  const { error } = await supabase
    .from('user_memory')
    .upsert({
      user_id: userId,
      growth_state: growthState,
      updated_at: new Date().toISOString(),
    });
  if (error) console.error('Error upserting growth state:', error);
}

// ─── Identity Graph (values, beliefs, traits) ────────────

export async function upsertIdentityGraph(
  userId: string,
  identityGraph: unknown[],
) {
  const { error } = await supabase
    .from('user_memory')
    .upsert({
      user_id: userId,
      identity_graph: identityGraph,
      updated_at: new Date().toISOString(),
    });
  if (error) console.error('Error upserting identity graph:', error);
}

// ─── Engine State (world model + lasting memory) ─────────

export interface DBEngineState {
  user_id: string;
  world_model: Record<string, unknown>;
  lasting_memory: Record<string, unknown>;
  version: number;
  updated_at: string;
}

export async function getEngineState(userId: string): Promise<DBEngineState | null> {
  const { data, error } = await supabase
    .from('user_engine_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) console.error('Error fetching engine state:', error);
  return data;
}

export async function syncEngineState(
  userId: string,
  worldModel: Record<string, unknown>,
  lastingMemory: Record<string, unknown>,
  knownVersion: number
): Promise<number> {
  const newVersion = knownVersion + 1;
  const { error } = await supabase
    .from('user_engine_state')
    .upsert({
      user_id: userId,
      world_model: worldModel,
      lasting_memory: lastingMemory,
      version: newVersion,
      updated_at: new Date().toISOString(),
    });
  if (error) {
    console.error('Error syncing engine state:', error);
    return knownVersion; // return old version on failure
  }
  return newVersion;
}

// ─── MCP Tools ───────────────────────────────────────────

/**
 * Invokes a tool on an external MCP server via the secure `mcp-proxy` edge function.
 */
export async function invokeMCPTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Authentication required for MCP tools');

  const proxyUrl = `${supabaseUrl}/functions/v1/mcp-proxy`;

  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': supabaseKey,
    },
    body: JSON.stringify({
      serverUrl,
      toolName,
      args
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`MCP Tool Error (\${res.status}): \${errText}`);
  }

  return res.json();
}

// ─── Knowledge Graph ─────────────────────────────────────

import type { KGEntity, KGRelation } from './KnowledgeGraph'
import { applyDecay } from './KnowledgeGraph'

export async function getKGEntities(userId: string): Promise<KGEntity[]> {
  const { data, error } = await supabase
    .from('knowledge_graph_entities')
    .select('*')
    .eq('user_id', userId)
    .order('mention_count', { ascending: false })
    .limit(100);

  if (error) console.error('Error fetching KG entities:', error);
  return applyDecay((data || []) as KGEntity[]);
}

export async function getKGRelations(userId: string): Promise<KGRelation[]> {
  const { data, error } = await supabase
    .from('knowledge_graph_relations')
    .select('*')
    .eq('user_id', userId)
    .limit(200);

  if (error) console.error('Error fetching KG relations:', error);
  return (data || []) as KGRelation[];
}

export async function upsertKGEntity(
  entity: Omit<KGEntity, 'id'> & { id?: string }
): Promise<KGEntity | null> {
  if (entity.id) {
    // Update existing
    const { data, error } = await supabase
      .from('knowledge_graph_entities')
      .update({
        mention_count: entity.mention_count,
        confidence: entity.confidence,
        last_seen_at: new Date().toISOString(),
        properties: entity.properties,
      })
      .eq('id', entity.id)
      .select()
      .single();

    if (error) console.error('Error updating KG entity:', error);
    return data as KGEntity | null;
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('knowledge_graph_entities')
      .insert({
        user_id: entity.user_id,
        name: entity.name,
        entity_type: entity.entity_type,
        properties: entity.properties,
        confidence: entity.confidence,
        source: entity.source,
        mention_count: entity.mention_count,
      })
      .select()
      .single();

    if (error) console.error('Error inserting KG entity:', error);
    return data as KGEntity | null;
  }
}

export async function upsertKGRelation(relation: Omit<KGRelation, 'id'>): Promise<KGRelation | null> {
  // Check if relation already exists
  const { data: existing } = await supabase
    .from('knowledge_graph_relations')
    .select('id, confidence')
    .eq('source_id', relation.source_id)
    .eq('target_id', relation.target_id)
    .eq('relation_type', relation.relation_type)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('knowledge_graph_relations')
      .update({
        confidence: Math.min(1, Math.max(existing.confidence, relation.confidence)),
        properties: relation.properties,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) console.error('Error updating KG relation:', error);
    return data as KGRelation | null;
  }

  const { data, error } = await supabase
    .from('knowledge_graph_relations')
    .insert(relation)
    .select()
    .single();

  if (error) console.error('Error inserting KG relation:', error);
  return data as KGRelation | null;
}

// ─── Procedural Memory ──────────────────────────────────

import type { Procedure } from './ProceduralMemory'

export async function getUserProcedures(userId: string): Promise<Procedure[]> {
  const { data, error } = await supabase
    .from('procedures')
    .select('*')
    .eq('user_id', userId)
    .order('times_executed', { ascending: false });

  if (error) console.error('Error fetching procedures:', error);
  return (data || []) as Procedure[];
}

export async function upsertProcedure(procedure: Procedure): Promise<Procedure | null> {
  if (procedure.id) {
    const { data, error } = await supabase
      .from('procedures')
      .update({
        name: procedure.name,
        trigger_phrase: procedure.trigger_phrase,
        steps: procedure.steps,
        times_executed: procedure.times_executed,
        last_executed_at: procedure.last_executed_at,
      })
      .eq('id', procedure.id)
      .select()
      .single();

    if (error) console.error('Error updating procedure:', error);
    return data as Procedure | null;
  }

  const { data, error } = await supabase
    .from('procedures')
    .insert({
      user_id: procedure.user_id,
      name: procedure.name,
      trigger_phrase: procedure.trigger_phrase,
      steps: procedure.steps,
      source: procedure.source,
    })
    .select()
    .single();

  if (error) console.error('Error inserting procedure:', error);
  return data as Procedure | null;
}

export async function deleteProcedure(id: string): Promise<void> {
  const { error } = await supabase
    .from('procedures')
    .delete()
    .eq('id', id);
  if (error) console.error('Error deleting procedure:', error);
}

export async function incrementProcedureExecution(id: string): Promise<void> {
  const { data: current } = await supabase
    .from('procedures')
    .select('times_executed')
    .eq('id', id)
    .single();

  if (current) {
    await supabase
      .from('procedures')
      .update({
        times_executed: (current.times_executed || 0) + 1,
        last_executed_at: new Date().toISOString(),
      })
      .eq('id', id);
  }
}

// ─── Workflow Runs ───────────────────────────────────────

export interface DBWorkflowRun {
  id: string;
  procedure_id: string;
  user_id: string;
  status: 'running' | 'completed' | 'failed';
  input: string;
  output: string;
  step_results: unknown[];
  duration_ms: number;
  created_at: string;
}

export async function getWorkflowRuns(procedureId: string, limit = 5): Promise<DBWorkflowRun[]> {
  const { data, error } = await supabase
    .from('workflow_runs')
    .select('*')
    .eq('procedure_id', procedureId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) console.error('Error fetching workflow runs:', error);
  return (data || []) as DBWorkflowRun[];
}

export async function saveWorkflowRun(run: Omit<DBWorkflowRun, 'id' | 'created_at'>): Promise<DBWorkflowRun | null> {
  const { data, error } = await supabase
    .from('workflow_runs')
    .insert(run)
    .select()
    .single();

  if (error) console.error('Error saving workflow run:', error);
  return data as DBWorkflowRun | null;
}

export async function updateWorkflowRun(id: string, updates: Partial<DBWorkflowRun>): Promise<void> {
  const { error } = await supabase
    .from('workflow_runs')
    .update(updates)
    .eq('id', id);
  if (error) console.error('Error updating workflow run:', error);
}

// ─── Auth Token Helper ───────────────────────────────────
// Returns the current user's JWT access token for authenticating edge function calls.
// Falls back to the anon key if no session exists (should not happen for gated routes).
export async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || supabaseKey
}

export async function refreshSession(): Promise<void> {
  await supabase.auth.refreshSession()
}

// Real-time subscriptions
export function subscribeToProjects(callback: (project: DBProject) => void) {
  return supabase
    .channel('projects')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' },
      (payload) => callback(payload.new as DBProject))
    .subscribe();
}

export function subscribeToOpportunities(callback: (opp: DBOpportunity) => void) {
  return supabase
    .channel('opportunities')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'opportunities' },
      (payload) => callback(payload.new as DBOpportunity))
    .subscribe();
}

// ─── User Stats ──────────────────────────────────────────

export interface UserStats {
  totalConversations: number
  totalMessages: number
  joinedAt: string | null
  agentBreakdown: { agent_id: string; count: number }[]
  feedbackStats: { helpful: number; poor: number; neutral: number }
  kgEntityCount: number
  kgRelationCount: number
  topEntities: { name: string; entity_type: string; mention_count: number }[]
  conversationsPerDay: { date: string; count: number }[]
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const [
    convRes,
    msgRes,
    agentRes,
    signalRes,
    kgEntRes,
    kgRelRes,
    topEntRes,
    dailyRes,
  ] = await Promise.all([
    supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('messages').select('agent_id').eq('user_id', userId).neq('agent_id', 'user'),
    supabase.from('response_signals').select('response_quality').eq('user_id', userId),
    supabase.from('knowledge_graph_entities').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('knowledge_graph_relations').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('knowledge_graph_entities').select('name, entity_type, mention_count').eq('user_id', userId).order('mention_count', { ascending: false }).limit(8),
    supabase.from('conversations').select('created_at').eq('user_id', userId).order('created_at', { ascending: true }),
  ])

  // Aggregate agent breakdown
  const agentCounts = new Map<string, number>()
  for (const row of (agentRes.data || [])) {
    const id = row.agent_id || 'kernel'
    agentCounts.set(id, (agentCounts.get(id) || 0) + 1)
  }
  const agentBreakdown = [...agentCounts.entries()]
    .map(([agent_id, count]) => ({ agent_id, count }))
    .sort((a, b) => b.count - a.count)

  // Feedback stats
  const signals = signalRes.data || []
  const feedbackStats = { helpful: 0, poor: 0, neutral: 0 }
  for (const s of signals) {
    if (s.response_quality === 'helpful') feedbackStats.helpful++
    else if (s.response_quality === 'poor') feedbackStats.poor++
    else feedbackStats.neutral++
  }

  // Conversations per day (last 30 days)
  const convsByDay = new Map<string, number>()
  for (const c of (dailyRes.data || [])) {
    const day = c.created_at.slice(0, 10)
    convsByDay.set(day, (convsByDay.get(day) || 0) + 1)
  }
  const conversationsPerDay = [...convsByDay.entries()]
    .map(([date, count]) => ({ date, count }))
    .slice(-30)

  // Get joined_at from auth (via conversations earliest or message)
  const firstConv = dailyRes.data?.[0]?.created_at || null

  return {
    totalConversations: convRes.count || 0,
    totalMessages: msgRes.count || 0,
    joinedAt: firstConv,
    agentBreakdown,
    feedbackStats,
    kgEntityCount: kgEntRes.count || 0,
    kgRelationCount: kgRelRes.count || 0,
    topEntities: (topEntRes.data || []) as { name: string; entity_type: string; mention_count: number }[],
    conversationsPerDay,
  }
}
