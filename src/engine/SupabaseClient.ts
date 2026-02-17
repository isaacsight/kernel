// Supabase Client - Persistent storage for the swarm
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || 'placeholder-key';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
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
export async function saveMessage(msg: Omit<DBMessage, 'created_at'>) {
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
export async function createConversation(userId: string, title = 'New Conversation'): Promise<DBConversation | null> {
  const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Verify session is active before attempting insert (RLS requires auth.uid())
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.error('[createConversation] No active session — RLS will block insert');
    // Try refreshing the session
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (!refreshed) {
      console.error('[createConversation] Session refresh failed');
      return null;
    }
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({ id, user_id: userId, title })
    .select()
    .single();

  if (error) {
    console.error('[createConversation] Error:', error.code, error.message, error.details);
  }
  return data;
}

export async function getUserConversations(userId: string): Promise<DBConversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) console.error('Error fetching conversations:', error);
  return data || [];
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
  status: 'active' | 'canceled' | 'past_due' | 'inactive';
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export async function getMySubscription(): Promise<DBSubscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }
  return data;
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

export async function saveResponseSignal(signal: Omit<DBResponseSignal, 'created_at'>) {
  const { error } = await supabase.from('response_signals').insert(signal);
  if (error) console.error('Error saving response signal:', error);
}

export async function updateSignalQuality(id: string, quality: 'helpful' | 'poor') {
  const { error } = await supabase
    .from('response_signals')
    .update({ response_quality: quality })
    .eq('id', id);
  if (error) console.error('Error updating signal quality:', error);
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
  messageCount: number
) {
  const { error } = await supabase
    .from('user_memory')
    .upsert({
      user_id: userId,
      profile,
      message_count: messageCount,
      updated_at: new Date().toISOString(),
    });
  if (error) console.error('Error upserting user memory:', error);
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

// ─── Knowledge Graph ─────────────────────────────────────

import type { KGEntity, KGRelation } from './KnowledgeGraph'

export async function getKGEntities(userId: string): Promise<KGEntity[]> {
  const { data, error } = await supabase
    .from('knowledge_graph_entities')
    .select('*')
    .eq('user_id', userId)
    .order('mention_count', { ascending: false })
    .limit(100);

  if (error) console.error('Error fetching KG entities:', error);
  return (data || []) as KGEntity[];
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

// ─── Auth Token Helper ───────────────────────────────────
// Returns the current user's JWT access token for authenticating edge function calls.
// Falls back to the anon key if no session exists (should not happen for gated routes).
export async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || supabaseKey
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
