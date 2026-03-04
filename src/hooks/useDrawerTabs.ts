import { useState, useCallback } from 'react'

export function useDrawerTabs() {
  const [showFolders, setShowFolders] = useState(false)
  const [showArchive, setShowArchive] = useState(false)

  const toggleFolders = useCallback(() => setShowFolders(prev => !prev), [])
  const openArchive = useCallback(() => setShowArchive(true), [])
  const closeArchive = useCallback(() => setShowArchive(false), [])

  return {
    showFolders,
    toggleFolders,
    showArchive,
    openArchive,
    closeArchive,
  }
}
