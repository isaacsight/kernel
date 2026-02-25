import { useState, useRef, useCallback } from 'react'
import { validateFileSize, ACCEPTED_FILES } from '../components/ChatHelpers'

const ACCEPTED_SET = new Set(ACCEPTED_FILES.split(','))

export function useFileAttachments(isPro: boolean, onError: (msg: string) => void) {
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((files: File[]) => {
    for (const file of files) {
      const error = validateFileSize(file, isPro)
      if (error) { onError(error); return }
    }
    setAttachedFiles(prev => [...prev, ...files])
  }, [isPro, onError])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    addFiles(Array.from(files))
    e.target.value = ''
  }, [addFiles])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    const files: File[] = []
    for (const item of Array.from(items)) {
      if (item.kind !== 'file') continue
      const file = item.getAsFile()
      if (!file) continue
      // Check extension for named files, or accept known MIME types for screenshots
      const ext = file.name.includes('.') ? '.' + file.name.split('.').pop()?.toLowerCase() : null
      const hasAcceptedExt = ext && ACCEPTED_SET.has(ext)
      const hasAcceptedMime = file.type.startsWith('image/') || file.type === 'application/pdf'
      if (hasAcceptedExt || hasAcceptedMime) files.push(file)
    }
    if (files.length > 0) {
      e.preventDefault()
      addFiles(files)
    }
  }, [addFiles])

  const removeFile = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  return { attachedFiles, setAttachedFiles, fileInputRef, handleFileSelect, handlePaste, removeFile }
}
