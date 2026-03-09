import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../engine/SupabaseClient'
import { isSystemFolder } from '../engine/chatFolderAutoSave'

// ─── Types ──────────────────────────────────────────

export interface UserFile {
  id: string
  user_id: string
  folder_id: string | null
  filename: string
  mime_type: string
  size_bytes: number
  storage_path: string
  thumbnail_path: string | null
  created_at: string
  /** Resolved signed URL (populated on load) */
  url?: string
}

export interface UserFileFolder {
  id: string
  user_id: string
  name: string
  parent_id: string | null
  sort_order: number
  created_at: string
}

// ─── Hook ───────────────────────────────────────────

export function useUserFiles(userId: string | undefined) {
  const [files, setFiles] = useState<UserFile[]>([])
  const [folders, setFolders] = useState<UserFileFolder[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Load files + folders for current location ────────

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      // Fetch folders at current level
      const folderQuery = supabase
        .from('user_file_folders')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order')

      if (currentFolderId) {
        folderQuery.eq('parent_id', currentFolderId)
      } else {
        folderQuery.is('parent_id', null)
      }

      // Fetch files at current level
      const fileQuery = supabase
        .from('user_files')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (currentFolderId) {
        fileQuery.eq('folder_id', currentFolderId)
      } else {
        fileQuery.is('folder_id', null)
      }

      const [foldersRes, filesRes] = await Promise.all([folderQuery, fileQuery])

      if (foldersRes.error) throw foldersRes.error
      if (filesRes.error) throw filesRes.error

      setFolders(foldersRes.data || [])

      // Generate signed URLs for files
      const filesWithUrls = await Promise.all(
        (filesRes.data || []).map(async (f: UserFile) => {
          const { data } = await supabase.storage
            .from('user-files')
            .createSignedUrl(f.storage_path, 3600)
          return { ...f, url: data?.signedUrl || '' }
        })
      )

      setFiles(filesWithUrls)
    } catch (err: any) {
      setError(err.message || 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [userId, currentFolderId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // ── Upload files ─────────────────────────────────────

  const uploadFiles = useCallback(async (fileList: File[]) => {
    if (!userId || fileList.length === 0) return
    setUploading(true)
    setError(null)

    try {
      for (const file of fileList) {
        const ext = file.name.includes('.') ? file.name.split('.').pop() : ''
        const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`

        // Upload to storage
        const { error: uploadErr } = await supabase.storage
          .from('user-files')
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          })
        if (uploadErr) throw uploadErr

        // Insert metadata
        const { error: insertErr } = await supabase
          .from('user_files')
          .insert({
            user_id: userId,
            folder_id: currentFolderId,
            filename: file.name,
            mime_type: file.type || 'application/octet-stream',
            size_bytes: file.size,
            storage_path: storagePath,
          })
        if (insertErr) throw insertErr
      }

      await refresh()
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [userId, currentFolderId, refresh])

  // ── Delete file ──────────────────────────────────────

  const deleteFile = useCallback(async (fileId: string) => {
    if (!userId) return
    const file = files.find(f => f.id === fileId)
    if (!file) return

    try {
      // Delete from storage
      await supabase.storage.from('user-files').remove([file.storage_path])
      // Delete metadata
      await supabase.from('user_files').delete().eq('id', fileId)
      setFiles(prev => prev.filter(f => f.id !== fileId))
    } catch (err: any) {
      setError(err.message || 'Delete failed')
    }
  }, [userId, files])

  // ── Move file to folder ──────────────────────────────

  const moveFile = useCallback(async (fileId: string, folderId: string | null) => {
    try {
      const { error: err } = await supabase
        .from('user_files')
        .update({ folder_id: folderId })
        .eq('id', fileId)
      if (err) throw err
      await refresh()
    } catch (err: any) {
      setError(err.message || 'Move failed')
    }
  }, [refresh])

  // ── Folder CRUD ──────────────────────────────────────

  const createFolder = useCallback(async (name: string) => {
    if (!userId) return
    try {
      const maxOrder = folders.reduce((max, f) => Math.max(max, f.sort_order), -1)
      const { error: err } = await supabase
        .from('user_file_folders')
        .insert({
          user_id: userId,
          name,
          parent_id: currentFolderId,
          sort_order: maxOrder + 1,
        })
      if (err) throw err
      await refresh()
    } catch (err: any) {
      setError(err.message || 'Create folder failed')
    }
  }, [userId, currentFolderId, folders, refresh])

  const renameFolder = useCallback(async (folderId: string, name: string) => {
    try {
      const { error: err } = await supabase
        .from('user_file_folders')
        .update({ name })
        .eq('id', folderId)
      if (err) throw err
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name } : f))
    } catch (err: any) {
      setError(err.message || 'Rename failed')
    }
  }, [])

  const deleteFolder = useCallback(async (folderId: string) => {
    // Prevent deletion of system folders (Chat, Artifacts, Gallery)
    const folder = folders.find(f => f.id === folderId)
    if (folder && isSystemFolder(folder.name)) {
      setError('This folder cannot be deleted')
      return
    }

    try {
      // Move files in this folder to parent (current level)
      await supabase
        .from('user_files')
        .update({ folder_id: currentFolderId })
        .eq('folder_id', folderId)

      // Delete folder
      const { error: err } = await supabase
        .from('user_file_folders')
        .delete()
        .eq('id', folderId)
      if (err) throw err
      await refresh()
    } catch (err: any) {
      setError(err.message || 'Delete folder failed')
    }
  }, [currentFolderId, folders, refresh])

  // ── Navigation ───────────────────────────────────────

  const navigateToFolder = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId)
  }, [])

  // Build breadcrumb path
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'Files' },
  ])

  const navigateIntoFolder = useCallback(async (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId)
    setBreadcrumbs(prev => [...prev, { id: folderId, name: folderName }])
  }, [])

  const navigateToBreadcrumb = useCallback((index: number) => {
    const target = breadcrumbs[index]
    setCurrentFolderId(target.id)
    setBreadcrumbs(prev => prev.slice(0, index + 1))
  }, [breadcrumbs])

  return {
    files,
    folders,
    currentFolderId,
    loading,
    uploading,
    error,
    breadcrumbs,
    refresh,
    uploadFiles,
    deleteFile,
    moveFile,
    createFolder,
    renameFolder,
    deleteFolder,
    navigateToFolder,
    navigateIntoFolder,
    navigateToBreadcrumb,
  }
}
