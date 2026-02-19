import { useState, useRef, useCallback } from 'react'
import { validateFileSize } from '../components/ChatHelpers'

export function useFileAttachments(isPro: boolean, onError: (msg: string) => void) {
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const newFiles = Array.from(files)
    for (const file of newFiles) {
      const error = validateFileSize(file, isPro)
      if (error) {
        onError(error)
        e.target.value = ''
        return
      }
    }
    setAttachedFiles(prev => [...prev, ...newFiles])
    e.target.value = ''
  }, [isPro, onError])

  const removeFile = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  return { attachedFiles, setAttachedFiles, fileInputRef, handleFileSelect, removeFile }
}
