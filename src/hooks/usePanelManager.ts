import { useState, useCallback } from 'react'
import type { TabId } from '../components/BottomTabBar'
import type { MoreAction } from '../components/MoreMenu'

export function usePanelManager(callbacks: {
  handleUpgrade: () => void
  handleManageSubscription: () => void
  signOut: () => void
  setShowDeleteConfirm: (v: boolean) => void
  setIsDrawerOpen: (v: boolean) => void
}) {
  const [showKGPanel, setShowKGPanel] = useState(false)
  const [showStatsPanel, setShowStatsPanel] = useState(false)
  const [showGoalsPanel, setShowGoalsPanel] = useState(false)
  const [showWorkflowsPanel, setShowWorkflowsPanel] = useState(false)
  const [showScheduledPanel, setShowScheduledPanel] = useState(false)
  const [showBriefingPanel, setShowBriefingPanel] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)

  const closeAllPanels = useCallback(() => {
    setShowKGPanel(false)
    setShowStatsPanel(false)
    setShowGoalsPanel(false)
    setShowWorkflowsPanel(false)
    setShowScheduledPanel(false)
    setShowBriefingPanel(false)
    setActiveTab('home')
    setShowMoreMenu(false)
  }, [])

  const closeOtherPanels = useCallback((except?: string) => {
    if (except !== 'kg') setShowKGPanel(false)
    if (except !== 'stats') setShowStatsPanel(false)
    if (except !== 'goals') setShowGoalsPanel(false)
    if (except !== 'workflows') setShowWorkflowsPanel(false)
    if (except !== 'scheduled') setShowScheduledPanel(false)
    if (except !== 'briefings') setShowBriefingPanel(false)
    if (except !== 'drawer') callbacks.setIsDrawerOpen(false)
    if (except !== 'more') setShowMoreMenu(false)
  }, [callbacks])

  const handleTabChange = useCallback((tab: TabId) => {
    if (tab === activeTab && tab !== 'home') {
      closeAllPanels()
      return
    }
    setActiveTab(tab)
    switch (tab) {
      case 'home':
        closeOtherPanels()
        break
      case 'chats':
        closeOtherPanels('drawer')
        callbacks.setIsDrawerOpen(true)
        break
      case 'goals':
        closeOtherPanels('goals')
        setShowGoalsPanel(true)
        break
      case 'briefings':
        closeOtherPanels('briefings')
        setShowBriefingPanel(true)
        break
      case 'more':
        closeOtherPanels('more')
        setShowMoreMenu(true)
        break
    }
  }, [activeTab, closeAllPanels, closeOtherPanels, callbacks])

  const handleMoreAction = useCallback((action: MoreAction) => {
    setShowMoreMenu(false)
    setActiveTab('home')
    switch (action) {
      case 'workflows':
        closeOtherPanels('workflows')
        setShowWorkflowsPanel(true)
        break
      case 'scheduled':
        closeOtherPanels('scheduled')
        setShowScheduledPanel(true)
        break
      case 'knowledge':
        closeOtherPanels('kg')
        setShowKGPanel(true)
        break
      case 'stats':
        closeOtherPanels('stats')
        setShowStatsPanel(true)
        break
      case 'upgrade':
        callbacks.handleUpgrade()
        break
      case 'manage-subscription':
        callbacks.handleManageSubscription()
        break
      case 'sign-out':
        callbacks.signOut()
        break
      case 'delete-account':
        callbacks.setShowDeleteConfirm(true)
        break
    }
  }, [closeOtherPanels, callbacks])

  return {
    showKGPanel, setShowKGPanel,
    showStatsPanel, setShowStatsPanel,
    showGoalsPanel, setShowGoalsPanel,
    showWorkflowsPanel, setShowWorkflowsPanel,
    showScheduledPanel, setShowScheduledPanel,
    showBriefingPanel, setShowBriefingPanel,
    activeTab, setActiveTab,
    showMoreMenu, setShowMoreMenu,
    headerMenuOpen, setHeaderMenuOpen,
    closeAllPanels, closeOtherPanels,
    handleTabChange, handleMoreAction,
  }
}
