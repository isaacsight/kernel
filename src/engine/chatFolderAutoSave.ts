/**
 * Auto-save artifacts and generated images to the user's "Chat" folder.
 *
 * Folder structure (undeletable "Chat" root):
 *   Chat/
 *   ├── Artifacts/    ← code artifacts from conversations
 *   └── Gallery/      ← generated images
 *
 * The "Chat" folder and its two subfolders are created lazily on first save.
 * They are marked as system folders (name prefixed check) to prevent deletion.
 */

import { supabase } from './SupabaseClient'

// System folder names — these cannot be deleted by the user
export const CHAT_FOLDER_NAME = 'Chat'
export const ARTIFACTS_FOLDER_NAME = 'Artifacts'
export const GALLERY_FOLDER_NAME = 'Gallery'
export const SYSTEM_FOLDERS = [CHAT_FOLDER_NAME, ARTIFACTS_FOLDER_NAME, GALLERY_FOLDER_NAME]

/** Check if a folder is a system folder that cannot be deleted */
export function isSystemFolder(folderName: string): boolean {
  return SYSTEM_FOLDERS.includes(folderName)
}

// Cache folder IDs per user to avoid repeated lookups
const folderIdCache = new Map<string, { chat: string; artifacts: string; gallery: string }>()

/**
 * Ensure the Chat/Artifacts and Chat/Gallery folders exist.
 * Returns { chat, artifacts, gallery } folder IDs.
 */
async function ensureChatFolders(userId: string): Promise<{ chat: string; artifacts: string; gallery: string }> {
  const cached = folderIdCache.get(userId)
  if (cached) return cached

  // Look for existing Chat folder at root level
  const { data: rootFolders } = await supabase
    .from('user_file_folders')
    .select('id, name')
    .eq('user_id', userId)
    .is('parent_id', null)
    .eq('name', CHAT_FOLDER_NAME)
    .limit(1)

  let chatFolderId: string

  if (rootFolders && rootFolders.length > 0) {
    chatFolderId = rootFolders[0].id
  } else {
    // Create Chat folder
    const { data: newFolder, error } = await supabase
      .from('user_file_folders')
      .insert({
        user_id: userId,
        name: CHAT_FOLDER_NAME,
        parent_id: null,
        sort_order: 0,
      })
      .select('id')
      .single()
    if (error || !newFolder) throw new Error('Failed to create Chat folder')
    chatFolderId = newFolder.id
  }

  // Look for existing subfolders
  const { data: subFolders } = await supabase
    .from('user_file_folders')
    .select('id, name')
    .eq('user_id', userId)
    .eq('parent_id', chatFolderId)
    .in('name', [ARTIFACTS_FOLDER_NAME, GALLERY_FOLDER_NAME])

  const existing = new Map((subFolders || []).map(f => [f.name, f.id]))

  let artifactsFolderId = existing.get(ARTIFACTS_FOLDER_NAME)
  let galleryFolderId = existing.get(GALLERY_FOLDER_NAME)

  // Create missing subfolders
  const toCreate: { name: string; sort_order: number }[] = []
  if (!artifactsFolderId) toCreate.push({ name: ARTIFACTS_FOLDER_NAME, sort_order: 0 })
  if (!galleryFolderId) toCreate.push({ name: GALLERY_FOLDER_NAME, sort_order: 1 })

  if (toCreate.length > 0) {
    const { data: created, error } = await supabase
      .from('user_file_folders')
      .insert(toCreate.map(f => ({
        user_id: userId,
        name: f.name,
        parent_id: chatFolderId,
        sort_order: f.sort_order,
      })))
      .select('id, name')

    if (error) throw new Error('Failed to create Chat subfolders')
    for (const f of created || []) {
      if (f.name === ARTIFACTS_FOLDER_NAME) artifactsFolderId = f.id
      if (f.name === GALLERY_FOLDER_NAME) galleryFolderId = f.id
    }
  }

  if (!artifactsFolderId || !galleryFolderId) {
    throw new Error('Failed to resolve Chat subfolder IDs')
  }

  const result = { chat: chatFolderId, artifacts: artifactsFolderId, gallery: galleryFolderId }
  folderIdCache.set(userId, result)
  return result
}

/**
 * Auto-save a code artifact to Chat/Artifacts.
 * Deduplicates by filename within the folder.
 */
export async function autoSaveArtifact(
  userId: string,
  filename: string,
  content: string,
  mimeType?: string,
): Promise<void> {
  try {
    const folders = await ensureChatFolders(userId)

    // Check if file already exists in Artifacts folder (same name = update)
    const { data: existing } = await supabase
      .from('user_files')
      .select('id, storage_path')
      .eq('user_id', userId)
      .eq('folder_id', folders.artifacts)
      .eq('filename', filename)
      .limit(1)

    const blob = new Blob([content], { type: mimeType || 'text/plain' })
    const ext = filename.includes('.') ? filename.split('.').pop() : 'txt'
    const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`

    // Upload to storage
    const { error: uploadErr } = await supabase.storage
      .from('user-files')
      .upload(storagePath, blob, {
        contentType: mimeType || 'text/plain',
        upsert: false,
      })
    if (uploadErr) return // silent fail

    if (existing && existing.length > 0) {
      // Update existing: replace storage path, delete old file
      const old = existing[0]
      await supabase.from('user_files')
        .update({
          storage_path: storagePath,
          size_bytes: blob.size,
          mime_type: mimeType || 'text/plain',
        })
        .eq('id', old.id)
      // Clean up old storage
      await supabase.storage.from('user-files').remove([old.storage_path])
    } else {
      // Insert new file record
      await supabase.from('user_files').insert({
        user_id: userId,
        folder_id: folders.artifacts,
        filename,
        mime_type: mimeType || 'text/plain',
        size_bytes: blob.size,
        storage_path: storagePath,
      })
    }
  } catch {
    // Silent fail — auto-save should never block the user
  }
}

/**
 * Auto-save a generated image to Chat/Gallery.
 */
export async function autoSaveGeneratedImage(
  userId: string,
  imageBase64: string,
  imageMimeType: string,
  prompt: string,
): Promise<void> {
  try {
    const folders = await ensureChatFolders(userId)

    // Convert base64 to blob
    const byteChars = atob(imageBase64)
    const byteArr = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) {
      byteArr[i] = byteChars.charCodeAt(i)
    }
    const blob = new Blob([byteArr], { type: imageMimeType })

    const ext = (imageMimeType || 'image/png').split('/')[1] || 'png'
    // Create a descriptive filename from the prompt
    const safeName = prompt
      .slice(0, 40)
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
    const timestamp = Date.now().toString(36)
    const filename = `${safeName || 'image'}-${timestamp}.${ext}`

    const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('user-files')
      .upload(storagePath, blob, {
        contentType: imageMimeType,
        upsert: false,
      })
    if (uploadErr) return

    await supabase.from('user_files').insert({
      user_id: userId,
      folder_id: folders.gallery,
      filename,
      mime_type: imageMimeType,
      size_bytes: blob.size,
      storage_path: storagePath,
    })
  } catch {
    // Silent fail
  }
}
