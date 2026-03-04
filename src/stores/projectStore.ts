// ─── Project Store — Session File Persistence ─────────────────
//
// Tracks all generated files across a conversation. Injects manifest
// into coder prompts so subsequent requests have awareness of existing files.
// Files are registered when ArtifactCard mounts via callback.
// Pro users get server-side persistence via the project-files edge function.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../engine/SupabaseClient'

export interface ProjectFile {
  filename: string
  language: string
  content: string
  version: number
  lastModifiedMessageId: string
  createdAt: number
  updatedAt: number
}

export type SyncStatus = 'syncing' | 'synced' | 'error'

interface ProjectState {
  /** Files keyed by conversationId -> filename */
  projects: Record<string, Record<string, ProjectFile>>
  /** Cloud sync status keyed by conversationId -> filename */
  syncStatus: Record<string, Record<string, SyncStatus>>
}

interface ProjectActions {
  /** Register or update a file in the current conversation's project */
  registerFile: (conversationId: string, filename: string, language: string, content: string, messageId: string) => void
  /** Get all files for a conversation */
  getFiles: (conversationId: string) => ProjectFile[]
  /** Get a specific file by name */
  getFile: (conversationId: string, filename: string) => ProjectFile | undefined
  /** Get the previous version of a file (for diff) */
  getPreviousContent: (conversationId: string, filename: string) => string | undefined
  /** Remove a file from the project */
  removeFile: (conversationId: string, filename: string) => void
  /** Clear all files for a conversation */
  clearProject: (conversationId: string) => void
  /** Format manifest for injection into coder prompt */
  formatManifest: (conversationId: string) => string
  /** Sync a file to cloud storage (Pro only, fire-and-forget) */
  syncToCloud: (conversationId: string, filename: string) => void
  /** Load all files from cloud for a conversation (Pro only) */
  loadFromCloud: (conversationId: string) => Promise<void>
  /** Get cloud sync status for a specific file */
  getSyncStatus: (conversationId: string, filename: string) => SyncStatus | undefined
}

type ProjectStore = ProjectState & ProjectActions

// Track previous content for diff (not persisted — only within session)
const previousContents: Record<string, Record<string, string>> = {}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: {},
      syncStatus: {},

      registerFile: (conversationId, filename, language, content, messageId) => {
        const state = get()
        const project = state.projects[conversationId] || {}
        const existing = project[filename]

        // Store previous content for diff
        if (existing) {
          if (!previousContents[conversationId]) previousContents[conversationId] = {}
          previousContents[conversationId][filename] = existing.content
        }

        set({
          projects: {
            ...state.projects,
            [conversationId]: {
              ...project,
              [filename]: {
                filename,
                language,
                content,
                version: existing ? existing.version + 1 : 1,
                lastModifiedMessageId: messageId,
                createdAt: existing?.createdAt || Date.now(),
                updatedAt: Date.now(),
              },
            },
          },
        })
      },

      getFiles: (conversationId) => {
        const project = get().projects[conversationId]
        return project ? Object.values(project).sort((a, b) => a.createdAt - b.createdAt) : []
      },

      getFile: (conversationId, filename) => {
        return get().projects[conversationId]?.[filename]
      },

      getPreviousContent: (conversationId, filename) => {
        return previousContents[conversationId]?.[filename]
      },

      removeFile: (conversationId, filename) => {
        const state = get()
        const project = { ...state.projects[conversationId] }
        delete project[filename]
        set({
          projects: {
            ...state.projects,
            [conversationId]: project,
          },
        })
      },

      clearProject: (conversationId) => {
        const state = get()
        const projects = { ...state.projects }
        delete projects[conversationId]
        delete previousContents[conversationId]
        set({ projects })
      },

      syncToCloud: (conversationId, filename) => {
        const file = get().projects[conversationId]?.[filename]
        if (!file || !file.content) return

        // Set syncing status
        const ss = { ...get().syncStatus }
        if (!ss[conversationId]) ss[conversationId] = {}
        ss[conversationId] = { ...ss[conversationId], [filename]: 'syncing' }
        set({ syncStatus: ss })

        // Fire-and-forget — don't block the UI
        supabase.functions.invoke('project-files', {
          body: {
            action: 'save',
            conversation_id: conversationId,
            filename: file.filename,
            language: file.language,
            content: file.content,
            version: file.version,
          },
        }).then(() => {
          const s = { ...get().syncStatus }
          if (!s[conversationId]) s[conversationId] = {}
          s[conversationId] = { ...s[conversationId], [filename]: 'synced' }
          set({ syncStatus: s })
        }).catch((err: unknown) => {
          console.warn('[project-sync] cloud save failed:', err)
          const s = { ...get().syncStatus }
          if (!s[conversationId]) s[conversationId] = {}
          s[conversationId] = { ...s[conversationId], [filename]: 'error' }
          set({ syncStatus: s })
        })
      },

      loadFromCloud: async (conversationId) => {
        try {
          const { data, error } = await supabase.functions.invoke('project-files', {
            body: { action: 'load', conversation_id: conversationId },
          })

          if (error || !data?.files) return

          const state = get()
          const project = { ...state.projects[conversationId] }
          let changed = false

          for (const file of data.files as Array<{ filename: string; language: string; content: string | null; version: number }>) {
            if (!file.content) continue
            const existing = project[file.filename]
            // Only hydrate if we don't already have content in memory
            if (existing?.content) continue

            project[file.filename] = {
              filename: file.filename,
              language: file.language,
              content: file.content,
              version: file.version,
              lastModifiedMessageId: existing?.lastModifiedMessageId || '',
              createdAt: existing?.createdAt || Date.now(),
              updatedAt: existing?.updatedAt || Date.now(),
            }
            changed = true
          }

          if (changed) {
            set({ projects: { ...state.projects, [conversationId]: project } })
          }
        } catch (err) {
          console.warn('[project-sync] cloud load failed:', err)
        }
      },

      getSyncStatus: (conversationId, filename) => {
        return get().syncStatus[conversationId]?.[filename]
      },

      formatManifest: (conversationId) => {
        const files = get().getFiles(conversationId)
        if (files.length === 0) return ''

        // Only include files that have content (content is stripped from localStorage persistence)
        const filesWithContent = files.filter(f => f.content.length > 0)
        if (filesWithContent.length === 0) return ''

        const lines = filesWithContent.map(f => {
          const size = f.content.length
          const sizeStr = size > 1000 ? `${(size / 1000).toFixed(1)}KB` : `${size}B`
          return `- ${f.filename} (${f.language}, v${f.version}, ${sizeStr})`
        })

        return `## Project Context\nFiles generated in this conversation:\n${lines.join('\n')}\n\nWhen modifying existing files, produce the COMPLETE updated file — do not show only the changed parts.`
      },
    }),
    {
      name: 'kernel-projects',
      partialize: (state) => {
        // Persist only metadata (no file content) to avoid hitting localStorage limits.
        // Content lives in memory only — lost on page reload.
        // syncStatus is transient — don't persist.
        const stripped: Record<string, Record<string, ProjectFile>> = {}
        const convIds = Object.keys(state.projects).slice(-10) // keep last 10 conversations
        for (const cid of convIds) {
          stripped[cid] = {}
          for (const [fname, file] of Object.entries(state.projects[cid])) {
            stripped[cid][fname] = { ...file, content: '' }
          }
        }
        return { projects: stripped }
      },
      merge: (persisted, current) => {
        // On rehydration, merge persisted metadata but preserve in-memory content
        const p = persisted as { projects: Record<string, Record<string, ProjectFile>> } | undefined
        if (!p?.projects) return current as ProjectStore
        const merged = { ...p.projects }
        for (const [cid, files] of Object.entries((current as ProjectStore).projects || {})) {
          if (!merged[cid]) merged[cid] = {}
          for (const [fname, file] of Object.entries(files)) {
            if (file.content) merged[cid][fname] = file // prefer in-memory version with content
          }
        }
        return { ...(current as ProjectStore), projects: merged }
      },
    },
  ),
)
