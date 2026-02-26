// ─── Project Store — Session File Persistence ─────────────────
//
// Tracks all generated files across a conversation. Injects manifest
// into coder prompts so subsequent requests have awareness of existing files.
// Files are registered when ArtifactCard mounts via callback.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ProjectFile {
  filename: string
  language: string
  content: string
  version: number
  lastModifiedMessageId: string
  createdAt: number
  updatedAt: number
}

interface ProjectState {
  /** Files keyed by conversationId -> filename */
  projects: Record<string, Record<string, ProjectFile>>
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
}

type ProjectStore = ProjectState & ProjectActions

// Track previous content for diff (not persisted — only within session)
const previousContents: Record<string, Record<string, string>> = {}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: {},

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
