import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useProjectStore } from './projectStore'

// Mock Supabase client
const mockInvoke = vi.fn()
vi.mock('../engine/SupabaseClient', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}))

function store() {
  return useProjectStore.getState()
}

beforeEach(() => {
  // Reset store between tests
  useProjectStore.setState({ projects: {}, syncStatus: {} })
  mockInvoke.mockReset()
})

describe('projectStore', () => {
  describe('registerFile', () => {
    it('creates a new file with version 1', () => {
      store().registerFile('conv1', 'app.tsx', 'typescript', 'const x = 1', 'msg1')
      const file = store().getFile('conv1', 'app.tsx')
      expect(file).toBeDefined()
      expect(file!.filename).toBe('app.tsx')
      expect(file!.language).toBe('typescript')
      expect(file!.content).toBe('const x = 1')
      expect(file!.version).toBe(1)
      expect(file!.lastModifiedMessageId).toBe('msg1')
    })

    it('increments version on update', () => {
      store().registerFile('conv1', 'app.tsx', 'typescript', 'v1', 'msg1')
      store().registerFile('conv1', 'app.tsx', 'typescript', 'v2', 'msg2')
      const file = store().getFile('conv1', 'app.tsx')
      expect(file!.version).toBe(2)
      expect(file!.content).toBe('v2')
      expect(file!.lastModifiedMessageId).toBe('msg2')
    })

    it('preserves createdAt on update', () => {
      store().registerFile('conv1', 'app.tsx', 'typescript', 'v1', 'msg1')
      const created = store().getFile('conv1', 'app.tsx')!.createdAt
      store().registerFile('conv1', 'app.tsx', 'typescript', 'v2', 'msg2')
      expect(store().getFile('conv1', 'app.tsx')!.createdAt).toBe(created)
    })
  })

  describe('getFiles', () => {
    it('returns files sorted by createdAt', () => {
      // Register with small delay via manual timestamps
      store().registerFile('conv1', 'b.ts', 'typescript', 'b', 'msg1')
      store().registerFile('conv1', 'a.ts', 'typescript', 'a', 'msg2')
      const files = store().getFiles('conv1')
      expect(files).toHaveLength(2)
      // First registered = earlier createdAt
      expect(files[0].filename).toBe('b.ts')
      expect(files[1].filename).toBe('a.ts')
    })

    it('returns empty array for unknown conversation', () => {
      expect(store().getFiles('nonexistent')).toEqual([])
    })
  })

  describe('getFile', () => {
    it('returns specific file', () => {
      store().registerFile('conv1', 'main.rs', 'rust', 'fn main() {}', 'msg1')
      expect(store().getFile('conv1', 'main.rs')!.language).toBe('rust')
    })

    it('returns undefined for unknown file', () => {
      expect(store().getFile('conv1', 'nope.txt')).toBeUndefined()
    })
  })

  describe('getPreviousContent', () => {
    it('returns undefined for new files', () => {
      store().registerFile('conv-prev', 'fresh.tsx', 'typescript', 'v1', 'msg1')
      expect(store().getPreviousContent('conv-prev', 'fresh.tsx')).toBeUndefined()
    })

    it('returns previous version after update', () => {
      store().registerFile('conv1', 'app.tsx', 'typescript', 'original', 'msg1')
      store().registerFile('conv1', 'app.tsx', 'typescript', 'updated', 'msg2')
      expect(store().getPreviousContent('conv1', 'app.tsx')).toBe('original')
    })
  })

  describe('removeFile', () => {
    it('removes file without affecting others', () => {
      store().registerFile('conv1', 'a.ts', 'typescript', 'a', 'msg1')
      store().registerFile('conv1', 'b.ts', 'typescript', 'b', 'msg2')
      store().removeFile('conv1', 'a.ts')
      expect(store().getFile('conv1', 'a.ts')).toBeUndefined()
      expect(store().getFile('conv1', 'b.ts')).toBeDefined()
    })
  })

  describe('clearProject', () => {
    it('removes all files for conversation', () => {
      store().registerFile('conv1', 'a.ts', 'typescript', 'a', 'msg1')
      store().registerFile('conv1', 'b.ts', 'typescript', 'b', 'msg2')
      store().registerFile('conv2', 'c.ts', 'typescript', 'c', 'msg3')
      store().clearProject('conv1')
      expect(store().getFiles('conv1')).toEqual([])
      expect(store().getFiles('conv2')).toHaveLength(1)
    })
  })

  describe('formatManifest', () => {
    it('returns empty string when no files', () => {
      expect(store().formatManifest('conv1')).toBe('')
    })

    it('returns formatted manifest with file list', () => {
      store().registerFile('conv1', 'index.html', 'html', '<html></html>', 'msg1')
      const manifest = store().formatManifest('conv1')
      expect(manifest).toContain('## Project Context')
      expect(manifest).toContain('index.html')
      expect(manifest).toContain('html')
      expect(manifest).toContain('v1')
    })
  })

  describe('syncToCloud', () => {
    it('calls supabase.functions.invoke with correct payload', () => {
      mockInvoke.mockResolvedValue({ data: null, error: null })
      store().registerFile('conv1', 'app.tsx', 'typescript', 'code', 'msg1')
      store().syncToCloud('conv1', 'app.tsx')

      expect(mockInvoke).toHaveBeenCalledWith('project-files', {
        body: {
          action: 'save',
          conversation_id: 'conv1',
          filename: 'app.tsx',
          language: 'typescript',
          content: 'code',
          version: 1,
        },
      })
    })

    it('sets syncStatus to syncing immediately', () => {
      mockInvoke.mockReturnValue(new Promise(() => {})) // never resolves
      store().registerFile('conv1', 'app.tsx', 'typescript', 'code', 'msg1')
      store().syncToCloud('conv1', 'app.tsx')
      expect(store().getSyncStatus('conv1', 'app.tsx')).toBe('syncing')
    })

    it('sets syncStatus to synced on success', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: null })
      store().registerFile('conv1', 'app.tsx', 'typescript', 'code', 'msg1')
      store().syncToCloud('conv1', 'app.tsx')
      await vi.waitFor(() => {
        expect(store().getSyncStatus('conv1', 'app.tsx')).toBe('synced')
      })
    })

    it('sets syncStatus to error on failure', async () => {
      mockInvoke.mockRejectedValue(new Error('network'))
      store().registerFile('conv1', 'app.tsx', 'typescript', 'code', 'msg1')
      store().syncToCloud('conv1', 'app.tsx')
      await vi.waitFor(() => {
        expect(store().getSyncStatus('conv1', 'app.tsx')).toBe('error')
      })
    })

    it('does nothing for nonexistent file', () => {
      store().syncToCloud('conv1', 'nope.tsx')
      expect(mockInvoke).not.toHaveBeenCalled()
    })
  })

  describe('loadFromCloud', () => {
    it('hydrates store from cloud response', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          files: [
            { filename: 'app.tsx', language: 'typescript', content: 'cloud code', version: 3 },
          ],
        },
        error: null,
      })

      await store().loadFromCloud('conv1')
      const file = store().getFile('conv1', 'app.tsx')
      expect(file).toBeDefined()
      expect(file!.content).toBe('cloud code')
      expect(file!.version).toBe(3)
    })

    it('skips files with existing content in memory', async () => {
      store().registerFile('conv1', 'app.tsx', 'typescript', 'local code', 'msg1')

      mockInvoke.mockResolvedValue({
        data: {
          files: [
            { filename: 'app.tsx', language: 'typescript', content: 'cloud code', version: 5 },
          ],
        },
        error: null,
      })

      await store().loadFromCloud('conv1')
      expect(store().getFile('conv1', 'app.tsx')!.content).toBe('local code')
    })

    it('handles errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('network'))
      await store().loadFromCloud('conv1') // should not throw
      expect(store().getFiles('conv1')).toEqual([])
    })
  })
})
