import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../engine/SupabaseClient'

export interface Folder {
  id: string
  user_id: string
  name: string
  color: string | null
  sort_order: number
  created_at: string
}

export function useFolders(userId: string | null) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch folders on mount / userId change
  useEffect(() => {
    if (!userId) { setFolders([]); return }
    let cancelled = false
    setLoading(true)
    supabase
      .from('conversation_folders')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Error fetching folders:', error)
        setFolders((data || []) as Folder[])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [userId])

  const createFolder = useCallback(async (name: string, color?: string) => {
    if (!userId) return null
    const id = `folder_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    const maxOrder = folders.length > 0 ? Math.max(...folders.map(f => f.sort_order)) + 1 : 0
    const row = { id, user_id: userId, name, color: color || null, sort_order: maxOrder }
    const { data, error } = await supabase
      .from('conversation_folders')
      .insert(row)
      .select()
      .single()
    if (error) { console.error('Error creating folder:', error); return null }
    const folder = data as Folder
    setFolders(prev => [...prev, folder])
    return folder
  }, [userId, folders])

  const renameFolder = useCallback(async (id: string, name: string) => {
    const { error } = await supabase
      .from('conversation_folders')
      .update({ name })
      .eq('id', id)
    if (error) { console.error('Error renaming folder:', error); return }
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f))
  }, [])

  const deleteFolder = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('conversation_folders')
      .delete()
      .eq('id', id)
    if (error) { console.error('Error deleting folder:', error); return }
    setFolders(prev => prev.filter(f => f.id !== id))
  }, [])

  const reorderFolders = useCallback(async (orderedIds: string[]) => {
    const updates = orderedIds.map((id, i) => ({ id, sort_order: i }))
    // Optimistic update
    setFolders(prev => {
      const map = new Map(prev.map(f => [f.id, f]))
      return orderedIds.map((id, i) => ({ ...map.get(id)!, sort_order: i }))
    })
    // Persist each (no batch upsert in Supabase JS client for partial updates)
    for (const u of updates) {
      await supabase.from('conversation_folders').update({ sort_order: u.sort_order }).eq('id', u.id)
    }
  }, [])

  const moveConversation = useCallback(async (conversationId: string, folderId: string | null) => {
    const { error } = await supabase
      .from('conversations')
      .update({ folder_id: folderId })
      .eq('id', conversationId)
    if (error) console.error('Error moving conversation:', error)
  }, [])

  return {
    folders,
    loading,
    createFolder,
    renameFolder,
    deleteFolder,
    reorderFolders,
    moveConversation,
  }
}
