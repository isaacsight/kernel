import { useState, useEffect, useCallback } from 'react'
import { supabase, getAccessToken } from '../engine/SupabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''

export interface Workspace {
  id: string
  name: string
  slug: string | null
  owner_id: string
  max_members: number
  settings: Record<string, any>
  created_at: string
}

export interface WorkspaceMember {
  workspace_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  accepted_at: string | null
  removed_at: string | null
}

export interface WorkspaceInvitation {
  id: string
  email: string
  role: string
  invite_code: string
  expires_at: string
  accepted_at: string | null
}

interface UseWorkspaceReturn {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  setActiveWorkspaceId: (id: string | null) => void
  members: WorkspaceMember[]
  invitations: WorkspaceInvitation[]
  loading: boolean
  createWorkspace: (name: string) => Promise<Workspace | null>
  updateWorkspace: (id: string, updates: Partial<Pick<Workspace, 'name' | 'settings'>>) => Promise<void>
  inviteMember: (email: string, role?: string) => Promise<WorkspaceInvitation | null>
  removeMember: (userId: string) => Promise<void>
  revokeInvitation: (invitationId: string) => Promise<void>
  acceptInvitation: (inviteCode: string) => Promise<string | null>
  loadMembers: () => Promise<void>
  loadInvitations: () => Promise<void>
}

async function callWorkspaceInvite(action: string, params: Record<string, any> = {}) {
  const token = await getAccessToken()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/workspace-invite`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...params }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return res.json()
}

export function useWorkspace(userId: string | null): UseWorkspaceReturn {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([])
  const [loading, setLoading] = useState(false)

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || null

  // Load workspaces on mount
  useEffect(() => {
    if (!userId) return

    const load = async () => {
      setLoading(true)
      // Get workspaces where user is owner
      const { data: owned } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', userId)

      // Get workspaces where user is a member
      const { data: memberOf } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .not('accepted_at', 'is', null)
        .is('removed_at', null)

      const memberWorkspaceIds = (memberOf || []).map(m => m.workspace_id)
      let memberWorkspaces: Workspace[] = []
      if (memberWorkspaceIds.length > 0) {
        const { data } = await supabase
          .from('workspaces')
          .select('*')
          .in('id', memberWorkspaceIds)
        memberWorkspaces = data || []
      }

      const all = [...(owned || []), ...memberWorkspaces]
      // Deduplicate by id
      const unique = Array.from(new Map(all.map(w => [w.id, w])).values())
      setWorkspaces(unique)
      setLoading(false)
    }

    load()
  }, [userId])

  const createWorkspace = useCallback(async (name: string): Promise<Workspace | null> => {
    if (!userId) return null
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const { data, error } = await supabase
      .from('workspaces')
      .insert({ name, slug, owner_id: userId })
      .select()
      .single()

    if (error || !data) {
      console.error('Failed to create workspace:', error)
      return null
    }

    // Add owner as member
    await supabase.from('workspace_members').insert({
      workspace_id: data.id,
      user_id: userId,
      role: 'owner',
      accepted_at: new Date().toISOString(),
    })

    setWorkspaces(prev => [...prev, data])
    return data
  }, [userId])

  const updateWorkspace = useCallback(async (id: string, updates: Partial<Pick<Workspace, 'name' | 'settings'>>) => {
    const { error } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', id)

    if (!error) {
      setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w))
    }
  }, [])

  const loadMembers = useCallback(async () => {
    if (!activeWorkspaceId) return
    const { data } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', activeWorkspaceId)
      .is('removed_at', null)
    setMembers(data || [])
  }, [activeWorkspaceId])

  const loadInvitations = useCallback(async () => {
    if (!activeWorkspaceId) return
    try {
      const result = await callWorkspaceInvite('list', { workspace_id: activeWorkspaceId })
      setInvitations(result.invitations || [])
    } catch (err) {
      console.error('Failed to load invitations:', err)
    }
  }, [activeWorkspaceId])

  // Load members/invitations when workspace changes
  useEffect(() => {
    if (activeWorkspaceId) {
      loadMembers()
      loadInvitations()
    }
  }, [activeWorkspaceId, loadMembers, loadInvitations])

  const inviteMember = useCallback(async (email: string, role = 'member'): Promise<WorkspaceInvitation | null> => {
    if (!activeWorkspaceId) return null
    try {
      const result = await callWorkspaceInvite('invite', {
        workspace_id: activeWorkspaceId,
        email,
        role,
      })
      const inv = result.invitation
      setInvitations(prev => [...prev, inv])
      return inv
    } catch (err) {
      console.error('Failed to invite:', err)
      return null
    }
  }, [activeWorkspaceId])

  const removeMember = useCallback(async (targetUserId: string) => {
    if (!activeWorkspaceId) return
    await supabase
      .from('workspace_members')
      .update({ removed_at: new Date().toISOString() })
      .eq('workspace_id', activeWorkspaceId)
      .eq('user_id', targetUserId)
    setMembers(prev => prev.filter(m => m.user_id !== targetUserId))
  }, [activeWorkspaceId])

  const revokeInvitation = useCallback(async (invitationId: string) => {
    if (!activeWorkspaceId) return
    try {
      await callWorkspaceInvite('revoke', {
        invitation_id: invitationId,
        workspace_id: activeWorkspaceId,
      })
      setInvitations(prev => prev.filter(i => i.id !== invitationId))
    } catch (err) {
      console.error('Failed to revoke invitation:', err)
    }
  }, [activeWorkspaceId])

  const acceptInvitation = useCallback(async (inviteCode: string): Promise<string | null> => {
    try {
      const result = await callWorkspaceInvite('accept', { invite_code: inviteCode })
      return result.workspace_id
    } catch (err) {
      console.error('Failed to accept invitation:', err)
      return null
    }
  }, [])

  return {
    workspaces,
    activeWorkspace,
    setActiveWorkspaceId,
    members,
    invitations,
    loading,
    createWorkspace,
    updateWorkspace,
    inviteMember,
    removeMember,
    revokeInvitation,
    acceptInvitation,
    loadMembers,
    loadInvitations,
  }
}
