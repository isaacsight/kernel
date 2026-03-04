import { useState, useCallback } from 'react'

export type DrawerTab = 'yours' | 'folders' | 'shared'

export function useDrawerTabs() {
  const [activeTab, setActiveTab] = useState<DrawerTab>('yours')
  const [showArchive, setShowArchive] = useState(false)

  const openArchive = useCallback(() => setShowArchive(true), [])
  const closeArchive = useCallback(() => setShowArchive(false), [])

  return {
    activeTab,
    setActiveTab,
    showArchive,
    openArchive,
    closeArchive,
  }
}
