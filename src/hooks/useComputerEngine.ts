// ─── useComputerEngine — React bridge for Computer Engine ────

import { useCallback } from 'react'
import {
  createSandbox,
  executeCode,
  readFile,
  writeFile,
  browseUrl,
  runTerminal,
  destroySandbox,
  listSandboxes,
  getActiveSandboxCount,
} from '../engine/ComputerEngine'
import type { ComputerEngineCallbacks, Sandbox } from '../engine/computer/types'
import { useComputerStore } from '../stores/computerStore'

interface UseComputerEngineParams {
  userId: string
  isPro: boolean
}

export function useComputerEngine({ userId, isPro }: UseComputerEngineParams) {
  const store = useComputerStore()

  const callbacks: Partial<ComputerEngineCallbacks> = {
    onOutput: (sandboxId, output) => {
      store.appendOutput(sandboxId, output)
    },
    onFileChange: (sandboxId, file) => {
      const sb = store.sandboxes[sandboxId]
      if (sb) {
        const files = [...sb.filesystem]
        const idx = files.findIndex(f => f.path === file.path)
        if (idx >= 0) files[idx] = file
        else files.push(file)
        store.upsertSandbox({ ...sb, filesystem: files })
      }
    },
    onScreenshot: (sandboxId, base64) => {
      store.appendOutput(sandboxId, `[Screenshot captured]`)
    },
    onError: (sandboxId, error) => {
      store.appendOutput(sandboxId, `ERROR: ${error}`)
    },
    onStatusChange: (sandboxId, status) => {
      store.updateSandboxStatus(sandboxId, status)
    },
  }

  const create = useCallback(async (agentId: string) => {
    if (!isPro) throw new Error('Computer Engine requires Pro subscription')
    const count = await getActiveSandboxCount(userId)
    if (count >= 3) throw new Error('Maximum concurrent sandboxes reached (3)')
    const sandbox = await createSandbox(userId, agentId, callbacks)
    store.upsertSandbox(sandbox)
    store.setActiveSandbox(sandbox.id)
    return sandbox
  }, [userId, isPro, callbacks, store])

  const execute = useCallback(async (sandboxId: string, code: string, language: string) => {
    return await executeCode(sandboxId, code, language, callbacks)
  }, [callbacks])

  const read = useCallback(async (sandboxId: string, path: string) => {
    return await readFile(sandboxId, path)
  }, [])

  const write = useCallback(async (sandboxId: string, path: string, content: string) => {
    return await writeFile(sandboxId, path, content, callbacks)
  }, [callbacks])

  const browse = useCallback(async (sandboxId: string, url: string, screenshot = false) => {
    return await browseUrl(sandboxId, url, screenshot, callbacks)
  }, [callbacks])

  const terminal = useCallback(async (sandboxId: string, command: string) => {
    return await runTerminal(sandboxId, command, callbacks)
  }, [callbacks])

  const destroy = useCallback(async (sandboxId: string) => {
    await destroySandbox(sandboxId, callbacks)
    store.removeSandbox(sandboxId)
  }, [callbacks, store])

  const refresh = useCallback(async () => {
    const sandboxes = await listSandboxes(userId)
    for (const sb of sandboxes) {
      store.upsertSandbox(sb)
    }
  }, [userId, store])

  return {
    sandboxes: store.getSandboxes(),
    activeSandboxId: store.activeSandboxId,
    outputs: store.recentOutputs,
    createSandbox: create,
    executeCode: execute,
    readFile: read,
    writeFile: write,
    browseUrl: browse,
    runTerminal: terminal,
    destroySandbox: destroy,
    setActiveSandbox: store.setActiveSandbox,
    refreshSandboxes: refresh,
    clearOutputs: store.clearOutputs,
  }
}
