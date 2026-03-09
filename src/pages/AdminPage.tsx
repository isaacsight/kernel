import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'motion/react'
import { Navigate, useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconUsers, IconChats, IconBrain, IconTrendingUp, IconCrown, IconActivity, IconDownload, IconTrash, IconShieldCheck, IconShieldOff, IconSearch, IconRefresh, IconChevronRight, IconStar } from '../components/KernelIcons'
import { useAuthContext } from '../providers/AuthProvider'
import { supabase } from '../engine/SupabaseClient'

// ─── Types ──────────────────────────────────────────
interface UserRow {
  id: string
  email: string
  created_at: string
  provider: string
  subscription?: string
  messageCount: number
  memoryProfile?: Record<string, unknown>
  kgEntityCount?: number
}

interface ConversationRow {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

interface MessageRow {
  id: string
  agent_id: string
  content: string
  created_at: string
}

interface StorageUsage {
  userId: string
  email: string
  totalBytes: number
  fileCount: number
}

interface ScoreSummary {
  user_id: string
  email: string
  total_submissions: number
  avg_score: number | null
  avg_project: number | null
  avg_session: number | null
  avg_work: number | null
  latest_score_at: string
}

interface ScoreEntry {
  id: string
  user_id: string
  email: string
  conversation_id: string | null
  score_type: string
  score: number
  notes: string | null
  created_at: string
}

interface ParsedScoreNotes {
  categories: { e: number; rd: number; qa: number; p: number; d: number; l: number }
  market: { label: string; multiplier: number }
  relevance: { label: string; multiplier: number }
  rd: { complexity: string; multiplier: number }
  webMultiplier: number
  tier: string
  total: number
  tax: number
  stripeFee: number
  subtotal: number
}

function parseScoreNotes(notes: string | null): ParsedScoreNotes | null {
  if (!notes) return null
  const parts = notes.split(' | ').map(s => s.trim())
  if (parts.length < 6) return null
  try {
    // "E15 RD12 QA14 P10 D8 L7"
    const catMatch = parts[0].match(/E(\d+)\s+RD(\d+)\s+QA(\d+)\s+P(\d+)\s+D(\d+)\s+L(\d+)/)
    if (!catMatch) return null
    // "Finance & Banking ×1.8"
    const marketMatch = parts[1].match(/^(.+?)\s+×([\d.]+)$/)
    // "Focused ×1.28"
    const relMatch = parts[2].match(/^(.+?)\s+×([\d.]+)$/)
    // "Significant R&D ×1.25"
    const rdMatch = parts[3].match(/^(.+?)\s+×([\d.]+)$/)
    // "Web ×1.1"
    const webMatch = parts[4].match(/×([\d.]+)/)
    // "Premium $34,267"
    const tierMatch = parts[5].match(/^(\w+)\s+\$([\d,]+)$/)
    // "tax$2997 fee$1024 sub$34267" (optional 7th segment)
    let tax = 0, stripeFee = 0, subtotal = 0
    if (parts[6]) {
      const taxMatch = parts[6].match(/tax\$(\d+)/)
      const feeMatch = parts[6].match(/fee\$(\d+)/)
      const subMatch = parts[6].match(/sub\$(\d+)/)
      tax = +(taxMatch?.[1] || 0)
      stripeFee = +(feeMatch?.[1] || 0)
      subtotal = +(subMatch?.[1] || 0)
    }
    return {
      categories: {
        e: +catMatch[1], rd: +catMatch[2], qa: +catMatch[3],
        p: +catMatch[4], d: +catMatch[5], l: +catMatch[6],
      },
      market: { label: marketMatch?.[1] || '—', multiplier: +(marketMatch?.[2] || 1) },
      relevance: { label: relMatch?.[1] || '—', multiplier: +(relMatch?.[2] || 1) },
      rd: { complexity: rdMatch?.[1] || '—', multiplier: +(rdMatch?.[2] || 1) },
      webMultiplier: +(webMatch?.[1] || 1),
      tier: tierMatch?.[1] || '—',
      total: +(tierMatch?.[2]?.replace(/,/g, '') || 0),
      tax,
      stripeFee,
      subtotal,
    }
  } catch {
    return null
  }
}

interface Stats {
  totalUsers: number
  subscribers: number
  messages: number
  conversations: number
  memoryProfiles: number
  qualitySignals: number
  helpfulRate: number
  mrr: number
  kgEntities: number
  kgRelations: number
}

interface ActivityEntry {
  type: 'message' | 'signup' | 'subscription'
  email: string
  detail: string
  timestamp: string
}

// ─── Component ──────────────────────────────────────
export function AdminPage() {
  const { isAdmin } = useAuthContext()
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserRow[]>([])
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, subscribers: 0, messages: 0,
    conversations: 0, memoryProfiles: 0, qualitySignals: 0,
    helpfulRate: 0, mrr: 0, kgEntities: 0, kgRelations: 0,
  })
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [insights, setInsights] = useState<any[]>([])
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [userKGEntities, setUserKGEntities] = useState<any[]>([])
  const [modQueue, setModQueue] = useState<any[]>([])
  const [modLoading, setModLoading] = useState(false)
  const [userConversations, setUserConversations] = useState<ConversationRow[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [convMessages, setConvMessages] = useState<MessageRow[]>([])
  const [convsLoading, setConvsLoading] = useState(false)
  const [storageUsage, setStorageUsage] = useState<StorageUsage[]>([])
  const [scoreSummaries, setScoreSummaries] = useState<ScoreSummary[]>([])
  const [scoreEntries, setScoreEntries] = useState<ScoreEntry[]>([])
  const [scoresExpanded, setScoresExpanded] = useState(false)
  const [sendingFile, setSendingFile] = useState(false)
  const [sendFileStatus, setSendFileStatus] = useState<string | null>(null)
  // Invoicing: minimum score to bill, margin multiplier
  const INVOICE_THRESHOLD = 70 // minimum avg score to invoice (must hit 70+)
  const MARGIN_MULTIPLIER = 3  // 3x markup on ideas marketplace

  if (!isAdmin) return <Navigate to="/" replace />

  const fetchData = useCallback(async () => {
    const [
      { count: msgCount },
      { count: convCount },
      { count: memCount },
      { count: sigCount },
      { count: helpfulCount },
      { count: kgEntCount },
      { count: kgRelCount },
      { data: subsData },
      { data: insightsData },
      { data: memoryData },
      { data: msgData },
      { data: recentMsgs },
      { data: kgPerUser },
    ] = await Promise.all([
      supabase.from('messages').select('id', { count: 'exact', head: true }),
      supabase.from('conversations').select('id', { count: 'exact', head: true }),
      supabase.from('user_memory').select('user_id', { count: 'exact', head: true }),
      supabase.from('response_signals').select('id', { count: 'exact', head: true }),
      supabase.from('response_signals').select('id', { count: 'exact', head: true }).eq('response_quality', 'helpful'),
      supabase.from('knowledge_graph_entities').select('id', { count: 'exact', head: true }),
      supabase.from('knowledge_graph_relations').select('id', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('user_id, status'),
      supabase.from('collective_insights').select('*').order('strength', { ascending: false }).limit(10),
      supabase.from('user_memory').select('*'),
      supabase.from('messages').select('user_id'),
      supabase.from('messages').select('user_id, agent_id, content, created_at').order('created_at', { ascending: false }).limit(20),
      supabase.from('knowledge_graph_entities').select('user_id'),
    ])

    // Count messages per user
    const msgCountMap: Record<string, number> = {}
    for (const m of msgData || []) {
      if (m.user_id) msgCountMap[m.user_id] = (msgCountMap[m.user_id] || 0) + 1
    }

    // KG entities per user
    const kgCountMap: Record<string, number> = {}
    for (const e of kgPerUser || []) {
      if (e.user_id) kgCountMap[e.user_id] = (kgCountMap[e.user_id] || 0) + 1
    }

    // Subscription map
    const subMap: Record<string, string> = {}
    let activeSubs = 0
    for (const s of subsData || []) {
      subMap[s.user_id] = s.status
      if (s.status === 'active') activeSubs++
    }

    // Memory map
    const memMap: Record<string, any> = {}
    for (const m of memoryData || []) {
      memMap[m.user_id] = m.profile
    }

    // Try to get auth users
    let authUsers: UserRow[] = []
    try {
      const { data: authData } = await supabase.auth.admin.listUsers()
      authUsers = (authData?.users || []).map(u => ({
        id: u.id,
        email: u.email || u.id.slice(0, 16),
        created_at: u.created_at || '',
        provider: u.app_metadata?.provider || 'email',
        subscription: subMap[u.id],
        messageCount: msgCountMap[u.id] || 0,
        memoryProfile: memMap[u.id],
        kgEntityCount: kgCountMap[u.id] || 0,
      }))
    } catch {
      // Fallback without auth admin
    }

    // Sort: subscribers first, then by messages
    authUsers.sort((a, b) => {
      const aSub = a.subscription === 'active' ? 1 : 0
      const bSub = b.subscription === 'active' ? 1 : 0
      if (bSub !== aSub) return bSub - aSub
      return b.messageCount - a.messageCount
    })

    // Build activity feed from recent messages
    const userMap = new Map(authUsers.map(u => [u.id, u.email]))
    const activityEntries: ActivityEntry[] = (recentMsgs || []).map(m => ({
      type: 'message' as const,
      email: userMap.get(m.user_id) || m.user_id.slice(0, 8),
      detail: m.agent_id === 'user'
        ? (m.content || '').slice(0, 60) + ((m.content?.length || 0) > 60 ? '...' : '')
        : `${m.agent_id} responded`,
      timestamp: m.created_at,
    }))

    const totalSigs = sigCount ?? 0
    const totalHelpful = helpfulCount ?? 0

    // Storage usage per user
    try {
      const { data: fileRows } = await supabase
        .from('user_files')
        .select('user_id, size_bytes')
      if (fileRows && fileRows.length > 0) {
        const byUser: Record<string, { totalBytes: number; fileCount: number }> = {}
        for (const f of fileRows) {
          if (!byUser[f.user_id]) byUser[f.user_id] = { totalBytes: 0, fileCount: 0 }
          byUser[f.user_id].totalBytes += f.size_bytes
          byUser[f.user_id].fileCount++
        }
        const userMap = new Map(authUsers.map(u => [u.id, u.email]))
        const usage: StorageUsage[] = Object.entries(byUser)
          .map(([uid, v]) => ({ userId: uid, email: userMap.get(uid) || uid.slice(0, 8), ...v }))
          .sort((a, b) => b.totalBytes - a.totalBytes)
        setStorageUsage(usage)
      } else {
        setStorageUsage([])
      }
    } catch { setStorageUsage([]) }

    // Client scores
    try {
      const [{ data: summaries }, { data: entries }] = await Promise.all([
        supabase.rpc('get_client_score_summary'),
        supabase.rpc('get_all_client_scores'),
      ])
      setScoreSummaries(summaries || [])
      setScoreEntries(entries || [])
    } catch {
      setScoreSummaries([])
      setScoreEntries([])
    }

    setUsers(authUsers)
    setInsights(insightsData || [])
    setActivity(activityEntries)
    setStats({
      totalUsers: authUsers.length,
      subscribers: activeSubs,
      messages: msgCount ?? 0,
      conversations: convCount ?? 0,
      memoryProfiles: memCount ?? 0,
      qualitySignals: totalSigs,
      helpfulRate: totalSigs > 0 ? Math.round((totalHelpful / totalSigs) * 100) : 0,
      mrr: activeSubs * 20,
      kgEntities: kgEntCount ?? 0,
      kgRelations: kgRelCount ?? 0,
    })
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 30s
  useEffect(() => {
    const iv = setInterval(fetchData, 30_000)
    return () => clearInterval(iv)
  }, [fetchData])

  // Fetch user KG entities when selecting a user
  useEffect(() => {
    if (!selectedUser) { setUserKGEntities([]); return }
    supabase
      .from('knowledge_graph_entities')
      .select('name, entity_type, confidence, mention_count')
      .eq('user_id', selectedUser.id)
      .order('mention_count', { ascending: false })
      .limit(12)
      .then(({ data }) => setUserKGEntities(data || []))
  }, [selectedUser?.id])

  // Fetch conversations for selected user
  const fetchUserConversations = useCallback(async (userId: string) => {
    setConvsLoading(true)
    setSelectedConvId(null)
    setConvMessages([])
    const { data } = await supabase
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50)
    setUserConversations(data || [])
    setConvsLoading(false)
  }, [])

  // Fetch messages for selected conversation
  const fetchConvMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('id, agent_id, content, created_at')
      .eq('channel_id', convId)
      .order('created_at', { ascending: true })
      .limit(200)
    setConvMessages(data || [])
  }, [])

  // ── Admin Actions ──
  const grantSubscription = async (userId: string) => {
    await supabase.from('subscriptions').upsert({
      user_id: userId,
      status: 'active',
      stripe_customer_id: `admin_grant_${Date.now()}`,
    }, { onConflict: 'user_id' })
    fetchData()
  }

  const revokeSubscription = async (userId: string) => {
    await supabase.from('subscriptions')
      .update({ status: 'canceled' })
      .eq('user_id', userId)
    fetchData()
  }

  const deleteUserConversations = async (userId: string) => {
    if (!confirm(`Delete ALL conversations for ${selectedUser?.email}?`)) return
    const { data: convs } = await supabase
      .from('conversations').select('id').eq('user_id', userId)
    if (convs) {
      for (const c of convs) {
        await supabase.from('messages').delete().eq('channel_id', c.id)
      }
      await supabase.from('conversations').delete().eq('user_id', userId)
    }
    await supabase.from('user_memory').delete().eq('user_id', userId)
    await supabase.from('knowledge_graph_entities').delete().eq('user_id', userId)
    await supabase.from('knowledge_graph_relations').delete().eq('user_id', userId)
    fetchData()
    setSelectedUser(null)
  }

  // ── Stripe Invoice ──
  const createStripeInvoice = async (
    targetUserId: string,
    email: string,
    amount: number,
    tier: string,
    parsed: ParsedScoreNotes | null,
  ) => {
    if (!confirm(`Create Stripe invoice for ${email}?\n\nAmount: $${amount.toLocaleString()} (${tier} Tier)\n\nThis will send a real invoice via Stripe.`)) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-invoice`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_KEY || '',
          },
          body: JSON.stringify({
            target_user_id: targetUserId,
            email,
            amount_cents: amount * 100,
            description: `Kernel ${tier} Tier — Project Invoice`,
            metadata: parsed ? {
              tier,
              market: parsed.market.label,
              market_mult: parsed.market.multiplier,
              relevance: parsed.relevance.label,
              rd: parsed.rd.complexity,
              subtotal: parsed.subtotal,
              tax: parsed.tax,
              stripe_fee: parsed.stripeFee,
            } : {},
          }),
        },
      )
      const result = await res.json()
      if (result.success) {
        const openDashboard = confirm(`Draft invoice created for ${email}.\n\nInvoice ID: ${result.invoice_id}\n\nOpen Stripe dashboard to review and send?`)
        if (openDashboard) {
          window.open(result.dashboard_url, '_blank')
        }
      } else {
        alert(`Invoice failed: ${result.error}`)
      }
    } catch (err) {
      alert(`Invoice error: ${String(err)}`)
    }
  }

  // ── Send File to User ──
  const sendFileToUser = async (targetUserId: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > 50 * 1024 * 1024) {
        setSendFileStatus('File too large (50MB max)')
        return
      }
      setSendingFile(true)
      setSendFileStatus(null)
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            resolve(result.split(',')[1]) // strip data:...;base64,
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-send-file`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_KEY || '',
            },
            body: JSON.stringify({
              target_user_id: targetUserId,
              filename: file.name,
              mime_type: file.type || 'application/octet-stream',
              file_base64: base64,
            }),
          },
        )
        const result = await res.json()
        if (result.success) {
          setSendFileStatus(`Sent "${file.name}" to ${result.target_email} (Inbox folder)`)
        } else {
          setSendFileStatus(`Error: ${result.error}`)
        }
      } catch (err) {
        setSendFileStatus(`Failed: ${String(err)}`)
      } finally {
        setSendingFile(false)
      }
    }
    input.click()
  }

  // ── Moderation Queue ──
  const fetchModQueue = useCallback(async () => {
    setModLoading(true)
    try {
      const { data } = await supabase
        .from('content_moderation')
        .select(`
          id, content_id, status, verdict, review_note, created_at,
          content_items!inner (title, slug, author_name, user_id, tags)
        `)
        .in('status', ['pending', 'flagged'])
        .order('created_at', { ascending: false })
        .limit(50)
      setModQueue(data || [])
    } catch {
      // non-critical
    } finally {
      setModLoading(false)
    }
  }, [])

  useEffect(() => { fetchModQueue() }, [fetchModQueue])

  const moderateContent = async (contentId: string, moderationId: string, action: 'approved' | 'rejected', note?: string) => {
    const { user } = (await supabase.auth.getUser()).data || {}
    await supabase.from('content_moderation')
      .update({
        status: action,
        reviewed_by: user?.id,
        review_note: note || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', moderationId)

    await supabase.from('content_items')
      .update({ moderation_status: action })
      .eq('id', contentId)

    fetchModQueue()
  }

  const exportUsersCSV = () => {
    const header = 'email,provider,subscription,messages,kg_entities,joined'
    const rows = users.map(u =>
      `${u.email},${u.provider},${u.subscription || 'free'},${u.messageCount},${u.kgEntityCount || 0},${u.created_at}`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `kernel-users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Filtered users
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users
    const q = searchQuery.toLowerCase()
    return users.filter(u =>
      u.email.toLowerCase().includes(q) ||
      u.provider.toLowerCase().includes(q) ||
      (u.subscription === 'active' && 'pro'.includes(q))
    )
  }, [users, searchQuery])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  return (
    <div className="admin-page">
      {/* Header */}
      <header className="admin-header">
        <button className="admin-back" onClick={() => navigate('/')}>
          <IconArrowLeft size={18} />
          <span>Back to Kernel</span>
        </button>
        <h1>Admin Dashboard</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="admin-action-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh data"
          >
            <IconRefresh size={14} className={refreshing ? 'ka-spin' : ''} /> Refresh
          </button>
          <button className="admin-action-btn" onClick={exportUsersCSV} title="Export users CSV">
            <IconDownload size={14} /> Export
          </button>
        </div>
      </header>

      {loading ? (
        <div className="admin-loading">
          <p style={{ opacity: 0.5, fontStyle: 'italic' }}>Loading dashboard...</p>
        </div>
      ) : (
        <>
          {/* Metric Cards */}
          <div className="admin-metrics">
            <MetricCard icon={<IconUsers size={18} />} label="Users" value={stats.totalUsers} />
            <MetricCard icon={<IconCrown size={18} />} label="Subscribers" value={stats.subscribers} accent />
            <MetricCard icon={<IconTrendingUp size={18} />} label="MRR" value={`$${stats.mrr}`} accent />
            <MetricCard icon={<IconChats size={18} />} label="Messages" value={stats.messages} />
            <MetricCard icon={<IconBrain size={18} />} label="KG Entities" value={stats.kgEntities} />
            <MetricCard icon={<IconActivity size={18} />} label="Helpful Rate" value={`${stats.helpfulRate}%`} />
            {scoreSummaries.length > 0 && (
              <MetricCard
                icon={<IconStar size={18} />}
                label="Avg Score"
                value={Math.round(scoreSummaries.reduce((sum, s) => sum + (s.avg_score ?? 0), 0) / scoreSummaries.length)}
                accent
              />
            )}
          </div>

          {/* Storage Warning — users approaching 100GB */}
          {storageUsage.some(u => u.totalBytes > 80 * 1024 * 1024 * 1024) && (
            <div style={{
              background: '#f5e6e0', border: '1px solid #d4a0a0', borderRadius: 8,
              padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8
            }}>
              <span style={{ fontSize: 18 }}>&#9888;</span>
              <span style={{ fontFamily: 'Courier Prime, monospace', fontSize: 13 }}>
                <strong>Storage alert:</strong>{' '}
                {storageUsage.filter(u => u.totalBytes > 80 * 1024 * 1024 * 1024).map(u =>
                  `${u.email} (${formatBytes(u.totalBytes)})`
                ).join(', ')}{' '}
                approaching 100GB
              </span>
            </div>
          )}

          {/* Main Content */}
          <div className="admin-grid">
            {/* User Directory */}
            <div className="admin-panel">
              <h3 className="mono admin-panel-title">USER DIRECTORY</h3>
              <div className="admin-search">
                <IconSearch size={14} />
                <input
                  className="admin-search-input"
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="admin-user-list">
                {filteredUsers.map(u => (
                  <motion.div
                    key={u.id}
                    className={`admin-user-row ${selectedUser?.id === u.id ? 'selected' : ''}`}
                    onClick={() => setSelectedUser(u)}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <div className="admin-user-info">
                      <span className="admin-user-email">
                        {u.subscription === 'active' && <IconCrown size={12} style={{ color: '#8B7355', marginRight: 4 }} />}
                        {u.email}
                      </span>
                      <span className="admin-user-meta mono">
                        {u.messageCount} msgs · {u.kgEntityCount || 0} entities · {u.provider}
                      </span>
                    </div>
                    <IconChevronRight size={14} style={{ opacity: 0.3 }} />
                  </motion.div>
                ))}
                {filteredUsers.length === 0 && (
                  <p style={{ opacity: 0.4, fontStyle: 'italic', padding: 16, textAlign: 'center' }}>
                    {searchQuery ? 'No matching users' : 'No users yet'}
                  </p>
                )}
              </div>
            </div>

            {/* User Detail */}
            <div className="admin-panel">
              <h3 className="mono admin-panel-title">USER PROFILE</h3>
              {selectedUser ? (
                <div className="admin-user-detail">
                  <h2 style={{ fontSize: 20, marginBottom: 8 }}>{selectedUser.email}</h2>
                  <div className="admin-detail-meta mono">
                    <span>{selectedUser.subscription === 'active' ? 'Active Subscriber' : 'Free'}</span>
                    <span>{selectedUser.messageCount} messages</span>
                    <span>{selectedUser.kgEntityCount || 0} entities</span>
                    <span>via {selectedUser.provider}</span>
                    <span>Joined {new Date(selectedUser.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* Storage Usage */}
                  {(() => {
                    const su = storageUsage.find(s => s.userId === selectedUser.id)
                    return su ? (
                      <div className="admin-detail-meta mono" style={{ marginTop: 8 }}>
                        <span style={su.totalBytes > 80 * 1024 * 1024 * 1024 ? { color: '#c53030', fontWeight: 700 } : {}}>
                          {formatBytes(su.totalBytes)} storage
                        </span>
                        <span>{su.fileCount} files</span>
                      </div>
                    ) : null
                  })()}

                  {/* Admin Actions */}
                  <div className="admin-user-actions">
                    {selectedUser.subscription === 'active' ? (
                      <button className="admin-action-btn admin-action-btn--danger" onClick={() => revokeSubscription(selectedUser.id)}>
                        <IconShieldOff size={14} /> Revoke Pro
                      </button>
                    ) : (
                      <button className="admin-action-btn admin-action-btn--accent" onClick={() => grantSubscription(selectedUser.id)}>
                        <IconShieldCheck size={14} /> Grant Pro
                      </button>
                    )}
                    <button className="admin-action-btn admin-action-btn--danger" onClick={() => deleteUserConversations(selectedUser.id)}>
                      <IconTrash size={14} /> Delete Data
                    </button>
                    <button
                      className="admin-action-btn"
                      onClick={() => sendFileToUser(selectedUser.id)}
                      disabled={sendingFile}
                    >
                      <IconDownload size={14} style={{ transform: 'rotate(180deg)' }} />
                      {sendingFile ? 'Sending...' : 'Send File'}
                    </button>
                  </div>
                  {sendFileStatus && (
                    <div style={{
                      fontFamily: 'Courier Prime, monospace', fontSize: 11,
                      padding: '6px 10px', marginTop: 6, borderRadius: 6,
                      background: sendFileStatus.startsWith('Error') || sendFileStatus.startsWith('Failed')
                        ? 'rgba(160,80,80,0.08)' : 'rgba(90,122,90,0.08)',
                      color: sendFileStatus.startsWith('Error') || sendFileStatus.startsWith('Failed')
                        ? '#a05050' : '#5a7a5a',
                    }}>
                      {sendFileStatus}
                    </div>
                  )}

                  {/* User's KG Entities */}
                  {userKGEntities.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <h4 className="mono" style={{ marginBottom: 8, opacity: 0.5, fontSize: 11 }}>KNOWLEDGE GRAPH</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {userKGEntities.map((e, i) => (
                          <span
                            key={i}
                            className="stats-entity-chip"
                            title={`${e.entity_type} · ${(e.confidence * 100).toFixed(0)}% confidence`}
                          >
                            {e.name}
                            <span className="stats-entity-count">{e.mention_count}x</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View Conversations */}
                  <div style={{ marginTop: 16 }}>
                    <button
                      className="admin-action-btn"
                      onClick={() => fetchUserConversations(selectedUser.id)}
                      disabled={convsLoading}
                    >
                      <IconChats size={14} /> {convsLoading ? 'Loading...' : 'View Conversations'}
                    </button>

                    {userConversations.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <h4 className="mono" style={{ marginBottom: 8, opacity: 0.5, fontSize: 11 }}>
                          CONVERSATIONS ({userConversations.length})
                        </h4>
                        <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {userConversations.map(c => (
                            <div
                              key={c.id}
                              className={`admin-user-row${selectedConvId === c.id ? ' selected' : ''}`}
                              onClick={() => { setSelectedConvId(c.id); fetchConvMessages(c.id) }}
                              style={{ padding: '8px 12px', cursor: 'pointer' }}
                            >
                              <div className="admin-user-info">
                                <span className="admin-user-email" style={{ fontSize: 13 }}>
                                  {c.title || 'Untitled'}
                                </span>
                                <span className="admin-user-meta mono">
                                  {new Date(c.updated_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Message thread */}
                    {selectedConvId && convMessages.length > 0 && (
                      <div style={{ marginTop: 12, maxHeight: 400, overflowY: 'auto', border: '1px solid var(--rubin-border, #e5e5e5)', borderRadius: 8, padding: 12 }}>
                        <h4 className="mono" style={{ marginBottom: 8, opacity: 0.5, fontSize: 11 }}>
                          MESSAGES ({convMessages.length})
                        </h4>
                        {convMessages.map(m => (
                          <div
                            key={m.id}
                            style={{
                              padding: '8px 12px',
                              marginBottom: 6,
                              borderRadius: 6,
                              background: m.agent_id === 'user' ? 'rgba(107,91,149,0.06)' : 'rgba(0,0,0,0.02)',
                              borderLeft: m.agent_id === 'user' ? '3px solid #6B5B95' : '3px solid rgba(0,0,0,0.1)',
                            }}
                          >
                            <div className="mono" style={{ fontSize: 10, opacity: 0.5, marginBottom: 4 }}>
                              {m.agent_id === 'user' ? 'User' : m.agent_id} · {new Date(m.created_at).toLocaleTimeString()}
                            </div>
                            <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {(m.content || '').slice(0, 2000)}
                              {(m.content || '').length > 2000 && '... (truncated)'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedUser.memoryProfile && Object.keys(selectedUser.memoryProfile).length > 0 ? (
                    <div className="admin-memory">
                      <h4 className="mono" style={{ marginTop: 16, marginBottom: 8, opacity: 0.5, fontSize: 11 }}>LEARNED MEMORY</h4>
                      {Object.entries(selectedUser.memoryProfile).map(([key, val]) => (
                        <div key={key} className="admin-memory-item">
                          <span className="admin-memory-key mono">{key}:</span>
                          <span className="admin-memory-val">
                            {Array.isArray(val) ? val.join(', ') : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ opacity: 0.4, fontStyle: 'italic', marginTop: 16 }}>
                      No learned memory yet
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ opacity: 0.4, fontStyle: 'italic', padding: 16 }}>
                  Select a user to view their profile
                </p>
              )}
            </div>
          </div>

          {/* Activity Feed + Insights side by side */}
          <div className="admin-grid" style={{ marginTop: 16 }}>
            {/* Activity Feed */}
            <div className="admin-panel">
              <h3 className="mono admin-panel-title">RECENT ACTIVITY</h3>
              {activity.length > 0 ? (
                <div className="admin-activity-list">
                  {activity.map((a, i) => (
                    <div key={i} className="admin-activity-row">
                      <span className="admin-activity-time mono">
                        {relativeTime(a.timestamp)}
                      </span>
                      <span className="admin-activity-email">{a.email}</span>
                      <span className="admin-activity-detail">{a.detail}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ opacity: 0.4, fontStyle: 'italic', padding: 16 }}>No recent activity</p>
              )}
            </div>

            {/* Collective Insights */}
            <div className="admin-panel">
              <h3 className="mono admin-panel-title">COLLECTIVE INSIGHTS</h3>
              {insights.length > 0 ? (
                <div className="admin-insights">
                  {insights.map(i => (
                    <div key={i.id} className="admin-insight-row">
                      <div className="admin-insight-bar" style={{ width: `${Math.round(i.strength * 100)}%` }} />
                      <span className="admin-insight-pct mono">{Math.round(i.strength * 100)}%</span>
                      <span className="admin-insight-text">{i.content}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ opacity: 0.4, fontStyle: 'italic', padding: 16 }}>
                  No collective insights yet
                </p>
              )}
            </div>
          </div>

          {/* Content Moderation Queue */}
          <div className="admin-panel" style={{ marginTop: 16 }}>
            <h3 className="mono admin-panel-title">CONTENT MODERATION QUEUE</h3>
            {modLoading ? (
              <p style={{ opacity: 0.4, fontStyle: 'italic', padding: 16 }}>Loading...</p>
            ) : modQueue.length === 0 ? (
              <p style={{ opacity: 0.4, fontStyle: 'italic', padding: 16 }}>
                No content pending review
              </p>
            ) : (
              <div className="admin-mod-list">
                {modQueue.map((item: any) => {
                  const ci = item.content_items
                  const verdict = item.verdict || {}
                  return (
                    <div key={item.id} className="admin-mod-row">
                      <div className="admin-mod-info">
                        <span className="admin-mod-title">
                          {ci?.title || 'Untitled'}
                        </span>
                        <span className="admin-mod-meta mono">
                          by {ci?.author_name || 'Unknown'} · {item.status}
                          {ci?.slug && (
                            <> · <a href={`/#/p/${ci.slug}`} target="_blank" rel="noopener noreferrer">view</a></>
                          )}
                        </span>
                        {verdict.reasoning && (
                          <span className="admin-mod-reasoning">{verdict.reasoning}</span>
                        )}
                        <span className="admin-mod-scores mono">
                          toxicity: {(verdict.toxicity ?? 0).toFixed(2)} · spam: {(verdict.spam ?? 0).toFixed(2)} · guidelines: {(verdict.guidelines ?? 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="admin-mod-actions">
                        <button
                          className="admin-action-btn admin-action-btn--accent"
                          onClick={() => moderateContent(item.content_id, item.id, 'approved')}
                        >
                          Approve
                        </button>
                        <button
                          className="admin-action-btn admin-action-btn--danger"
                          onClick={() => {
                            const note = prompt('Rejection reason (optional):')
                            moderateContent(item.content_id, item.id, 'rejected', note || undefined)
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {/* Client Scores — Invoicing Dashboard */}
          <div className="admin-panel" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="mono admin-panel-title">
                <IconStar size={14} style={{ marginRight: 6, opacity: 0.6 }} />
                CLIENT SCORES
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="admin-action-btn" onClick={() => setScoresExpanded(!scoresExpanded)}>
                  {scoresExpanded ? 'Summary' : 'All Scores'}
                </button>
                <button className="admin-action-btn" onClick={exportScoresCSV} title="Export scores CSV">
                  <IconDownload size={14} /> Export
                </button>
              </div>
            </div>

            {/* Invoicing threshold bar */}
            {scoreSummaries.length > 0 && (
              <div style={{
                display: 'flex', gap: 16, alignItems: 'center',
                padding: '12px 16px', marginBottom: 12,
                background: 'rgba(107,91,149,0.04)', borderRadius: 8,
                fontFamily: 'Courier Prime, monospace', fontSize: 11,
              }}>
                <span style={{ opacity: 0.6 }}>INVOICE THRESHOLD: <strong>{INVOICE_THRESHOLD}/100</strong></span>
                <span style={{ opacity: 0.6 }}>MARGIN: <strong>{MARGIN_MULTIPLIER}x</strong></span>
                <span style={{ color: '#5a7a5a' }}>
                  {scoreSummaries.filter(s => (s.avg_score ?? 0) >= INVOICE_THRESHOLD).length} billable
                </span>
                <span style={{ color: '#a05050' }}>
                  {scoreSummaries.filter(s => (s.avg_score ?? 0) < INVOICE_THRESHOLD).length} below threshold
                </span>
              </div>
            )}

            {scoreSummaries.length === 0 ? (
              <p style={{ opacity: 0.4, fontStyle: 'italic', padding: 16 }}>
                No client scores yet. Clients type <code style={{ fontFamily: 'Courier Prime, monospace', background: 'rgba(0,0,0,0.04)', padding: '2px 6px', borderRadius: 3 }}>kernel.hat</code> to submit.
              </p>
            ) : scoresExpanded ? (
              /* All individual scores */
              <div className="admin-scores-detail">
                {scoreEntries.map(entry => {
                  const parsed = parseScoreNotes(entry.notes)
                  return (
                    <div key={entry.id} className="admin-score-row">
                      <div
                        className="admin-score-value"
                        style={{ color: getScoreColor(entry.score) }}
                      >
                        {entry.score}
                      </div>
                      <div className="admin-score-info">
                        <div className="admin-score-info-email">{entry.email}</div>
                        <div className="admin-score-info-meta">
                          {entry.score_type} · {new Date(entry.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      {parsed ? (
                        <div className="admin-score-pricing-inline">
                          <span className="admin-score-pricing-total-sm">${parsed.total.toLocaleString()}</span>
                          <span className="admin-score-pricing-tier-sm">{parsed.tier}</span>
                          <span className="admin-score-pricing-mult-sm" title={parsed.market.label}>Mkt ×{parsed.market.multiplier}</span>
                          <span className="admin-score-pricing-mult-sm" title={parsed.relevance.label}>Rel ×{parsed.relevance.multiplier}</span>
                          <span className="admin-score-pricing-mult-sm" title={parsed.rd.complexity}>R&D ×{parsed.rd.multiplier}</span>
                          <span className="admin-score-pricing-mult-sm">Web ×{parsed.webMultiplier}</span>
                        </div>
                      ) : entry.notes ? (
                        <div className="admin-score-note" title={entry.notes}>{entry.notes}</div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : (
              /* Summary cards per client */
              <div className="admin-scores-summary">
                {scoreSummaries.map(s => {
                  const latestEntry = scoreEntries.find(e => e.user_id === s.user_id)
                  const parsed = latestEntry ? parseScoreNotes(latestEntry.notes) : null
                  return (
                    <div key={s.user_id} className="admin-score-card">
                      <div className="admin-score-card-header">
                        <span className="admin-score-email">{s.email}</span>
                        <span
                          className="admin-score-avg"
                          style={{ color: getScoreColor(s.avg_score ?? 0) }}
                        >
                          {s.avg_score ?? '—'}
                        </span>
                      </div>
                      <div className="admin-score-breakdown">
                        <div className="admin-score-type">
                          PROJECT
                          <span style={{ color: getScoreColor(s.avg_project ?? 0) }}>
                            {s.avg_project ?? '—'}
                          </span>
                        </div>
                        <div className="admin-score-type">
                          SESSION
                          <span style={{ color: getScoreColor(s.avg_session ?? 0) }}>
                            {s.avg_session ?? '—'}
                          </span>
                        </div>
                        <div className="admin-score-type">
                          WORK
                          <span style={{ color: getScoreColor(s.avg_work ?? 0) }}>
                            {s.avg_work ?? '—'}
                          </span>
                        </div>
                      </div>
                      {/* Full pricing breakdown from latest score */}
                      {parsed && (
                        <div className="admin-score-pricing">
                          <div className="admin-score-pricing-total">
                            ${parsed.total.toLocaleString()}
                            <span className="admin-score-pricing-tier">{parsed.tier}</span>
                          </div>
                          <div className="admin-score-pricing-grid">
                            <div className="admin-score-pricing-item">
                              <span className="admin-score-pricing-label">Market</span>
                              <span>{parsed.market.label}</span>
                              <span className="admin-score-pricing-mult">×{parsed.market.multiplier}</span>
                            </div>
                            <div className="admin-score-pricing-item">
                              <span className="admin-score-pricing-label">Relevance</span>
                              <span>{parsed.relevance.label}</span>
                              <span className="admin-score-pricing-mult">×{parsed.relevance.multiplier}</span>
                            </div>
                            <div className="admin-score-pricing-item">
                              <span className="admin-score-pricing-label">R&D</span>
                              <span>{parsed.rd.complexity}</span>
                              <span className="admin-score-pricing-mult">×{parsed.rd.multiplier}</span>
                            </div>
                            <div className="admin-score-pricing-item">
                              <span className="admin-score-pricing-label">Web Rate</span>
                              <span>Live check</span>
                              <span className="admin-score-pricing-mult">×{parsed.webMultiplier}</span>
                            </div>
                          </div>
                          {parsed.tax > 0 && (
                            <div className="admin-score-pricing-item" style={{ gridColumn: '1 / -1' }}>
                              <span className="admin-score-pricing-label">Tax</span>
                              <span>${parsed.tax.toLocaleString()}</span>
                              <span className="admin-score-pricing-label">Stripe</span>
                              <span>${parsed.stripeFee.toLocaleString()}</span>
                              <span className="admin-score-pricing-label">Subtotal</span>
                              <span>${parsed.subtotal.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="admin-score-pricing-cats">
                            <span>E{parsed.categories.e}</span>
                            <span>RD{parsed.categories.rd}</span>
                            <span>QA{parsed.categories.qa}</span>
                            <span>P{parsed.categories.p}</span>
                            <span>D{parsed.categories.d}</span>
                            <span>L{parsed.categories.l}</span>
                          </div>
                        </div>
                      )}
                      <div className="admin-score-meta">
                        {s.total_submissions} submissions · last {relativeTime(s.latest_score_at)}
                        {(s.avg_score ?? 0) >= INVOICE_THRESHOLD ? (
                          <>
                            <span style={{ color: '#5a7a5a', fontWeight: 700, marginLeft: 8 }}>BILLABLE</span>
                            <button
                              className="admin-action-btn admin-action-btn--accent"
                              style={{ marginLeft: 8, padding: '2px 8px', fontSize: 10 }}
                              onClick={() => createStripeInvoice(s.user_id, s.email, parsed?.total ?? 0, parsed?.tier ?? 'Standard', parsed)}
                            >
                              Invoice via Stripe
                            </button>
                          </>
                        ) : (
                          <span style={{ color: '#a05050', marginLeft: 8 }}>BELOW THRESHOLD</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )

  function exportScoresCSV() {
    // Summary sheet with invoicing status + pricing
    const summaryHeader = 'email,avg_score,avg_project,avg_session,avg_work,submissions,billable,status,latest_cost,tier,market,market_mult,relevance,rel_mult,rd_complexity,rd_mult,web_mult'
    const summaryRows = scoreSummaries.map(s => {
      const billable = (s.avg_score ?? 0) >= INVOICE_THRESHOLD
      const latestEntry = scoreEntries.find(e => e.user_id === s.user_id)
      const parsed = latestEntry ? parseScoreNotes(latestEntry.notes) : null
      const p = parsed
      return `${s.email},${s.avg_score ?? ''},${s.avg_project ?? ''},${s.avg_session ?? ''},${s.avg_work ?? ''},${s.total_submissions},${billable},${billable ? 'INVOICE' : 'BELOW_THRESHOLD'},${p ? p.total : ''},"${p?.tier || ''}","${p?.market.label || ''}",${p?.market.multiplier || ''},"${p?.relevance.label || ''}",${p?.relevance.multiplier || ''},"${p?.rd.complexity || ''}",${p?.rd.multiplier || ''},${p?.webMultiplier || ''}`
    })
    // Detail sheet with parsed pricing
    const detailHeader = '\n\nemail,score_type,score,cost,tier,market,market_mult,relevance,rel_mult,rd,rd_mult,web_mult,date'
    const detailRows = scoreEntries.map(e => {
      const p = parseScoreNotes(e.notes)
      return `${e.email},${e.score_type},${e.score},${p ? p.total : ''},"${p?.tier || ''}","${p?.market.label || ''}",${p?.market.multiplier || ''},"${p?.relevance.label || ''}",${p?.relevance.multiplier || ''},"${p?.rd.complexity || ''}",${p?.rd.multiplier || ''},${p?.webMultiplier || ''},${e.created_at}`
    })
    const csv = ['INVOICE SUMMARY', summaryHeader, ...summaryRows, detailHeader, ...detailRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `kernel-invoice-scores-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#5a7a5a'
  if (score >= 60) return '#8B7355'
  if (score >= 40) return '#B8875C'
  return '#a05050'
}

// ─── Helpers ────────────────────────────────────────
function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function MetricCard({ icon, label, value, accent }: {
  icon: React.ReactNode
  label: string
  value: string | number
  accent?: boolean
}) {
  return (
    <div className={`admin-metric ${accent ? 'accent' : ''}`}>
      <div className="admin-metric-icon">{icon}</div>
      <div className="admin-metric-val">{value}</div>
      <div className="admin-metric-label mono">{label}</div>
    </div>
  )
}
