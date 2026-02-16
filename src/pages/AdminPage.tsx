import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, MessageSquare, Brain, TrendingUp, Crown, Activity, Download, Trash2, ShieldCheck, ShieldOff } from 'lucide-react'
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
}

// ─── Component ──────────────────────────────────────
export function AdminPage() {
  const { isAdmin } = useAuthContext()
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserRow[]>([])
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, subscribers: 0, messages: 0,
    conversations: 0, memoryProfiles: 0, qualitySignals: 0,
    helpfulRate: 0, mrr: 0,
  })
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [insights, setInsights] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  if (!isAdmin) return <Navigate to="/" replace />

  const fetchData = useCallback(async () => {
    const [
      { count: msgCount },
      { count: convCount },
      { count: memCount },
      { count: sigCount },
      { count: helpfulCount },
      { data: subsData },
      { data: insightsData },
      { data: memoryData },
      { data: msgData },
    ] = await Promise.all([
      supabase.from('messages').select('id', { count: 'exact', head: true }),
      supabase.from('conversations').select('id', { count: 'exact', head: true }),
      supabase.from('user_memory').select('user_id', { count: 'exact', head: true }),
      supabase.from('response_signals').select('id', { count: 'exact', head: true }),
      supabase.from('response_signals').select('id', { count: 'exact', head: true }).eq('response_quality', 'helpful'),
      supabase.from('subscriptions').select('user_id, status'),
      supabase.from('collective_insights').select('*').order('strength', { ascending: false }).limit(10),
      supabase.from('user_memory').select('*'),
      supabase.from('messages').select('user_id'),
    ])

    // Count messages per user
    const msgCountMap: Record<string, number> = {}
    for (const m of msgData || []) {
      if (m.user_id) msgCountMap[m.user_id] = (msgCountMap[m.user_id] || 0) + 1
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

    const totalSigs = sigCount ?? 0
    const totalHelpful = helpfulCount ?? 0

    setUsers(authUsers)
    setInsights(insightsData || [])
    setStats({
      totalUsers: authUsers.length,
      subscribers: activeSubs,
      messages: msgCount ?? 0,
      conversations: convCount ?? 0,
      memoryProfiles: memCount ?? 0,
      qualitySignals: totalSigs,
      helpfulRate: totalSigs > 0 ? Math.round((totalHelpful / totalSigs) * 100) : 0,
      mrr: activeSubs * 20,
    })
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 30s
  useEffect(() => {
    const iv = setInterval(fetchData, 30_000)
    return () => clearInterval(iv)
  }, [fetchData])

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
    fetchData()
    setSelectedUser(null)
  }

  const exportUsersCSV = () => {
    const header = 'email,provider,subscription,messages,joined'
    const rows = users.map(u =>
      `${u.email},${u.provider},${u.subscription || 'free'},${u.messageCount},${u.created_at}`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `kernel-users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="admin-page">
      {/* Header */}
      <header className="admin-header">
        <button className="admin-back" onClick={() => navigate('/')}>
          <ArrowLeft size={18} />
          <span>Back to Kernel</span>
        </button>
        <h1>Admin Dashboard</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="admin-action-btn" onClick={exportUsersCSV} title="Export users CSV">
            <Download size={14} /> Export CSV
          </button>
          <span className="mono" style={{ opacity: 0.4, fontSize: 11 }}>
            KERNEL ENGINE
          </span>
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
            <MetricCard icon={<Users size={18} />} label="Users" value={stats.totalUsers} />
            <MetricCard icon={<Crown size={18} />} label="Subscribers" value={stats.subscribers} accent />
            <MetricCard icon={<TrendingUp size={18} />} label="MRR" value={`$${stats.mrr}`} accent />
            <MetricCard icon={<MessageSquare size={18} />} label="Messages" value={stats.messages} />
            <MetricCard icon={<Brain size={18} />} label="Memory Profiles" value={stats.memoryProfiles} />
            <MetricCard icon={<Activity size={18} />} label="Helpful Rate" value={`${stats.helpfulRate}%`} />
          </div>

          {/* Main Content */}
          <div className="admin-grid">
            {/* User Directory */}
            <div className="admin-panel">
              <h3 className="mono admin-panel-title">USER DIRECTORY</h3>
              <div className="admin-user-list">
                {users.map(u => (
                  <motion.div
                    key={u.id}
                    className={`admin-user-row ${selectedUser?.id === u.id ? 'selected' : ''}`}
                    onClick={() => setSelectedUser(u)}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <div className="admin-user-info">
                      <span className="admin-user-email">
                        {u.subscription === 'active' && <Crown size={12} style={{ color: '#8B7355', marginRight: 4 }} />}
                        {u.email}
                      </span>
                      <span className="admin-user-meta mono">
                        {u.messageCount} msgs · {u.provider} · {new Date(u.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {u.subscription === 'active' && (
                      <span className="admin-badge">PRO</span>
                    )}
                  </motion.div>
                ))}
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
                    <span>via {selectedUser.provider}</span>
                    <span>Joined {new Date(selectedUser.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* Admin Actions */}
                  <div className="admin-user-actions">
                    {selectedUser.subscription === 'active' ? (
                      <button className="admin-action-btn admin-action-btn--danger" onClick={() => revokeSubscription(selectedUser.id)}>
                        <ShieldOff size={14} /> Revoke Pro
                      </button>
                    ) : (
                      <button className="admin-action-btn admin-action-btn--accent" onClick={() => grantSubscription(selectedUser.id)}>
                        <ShieldCheck size={14} /> Grant Pro
                      </button>
                    )}
                    <button className="admin-action-btn admin-action-btn--danger" onClick={() => deleteUserConversations(selectedUser.id)}>
                      <Trash2 size={14} /> Delete Data
                    </button>
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

          {/* Collective Insights */}
          <div className="admin-panel" style={{ marginTop: 16 }}>
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
                No collective insights yet — they build as users interact
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Metric Card ────────────────────────────────────
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
