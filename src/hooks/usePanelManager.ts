import { useState, useCallback } from 'react'
import type { TabId } from '../components/BottomTabBar'
import type { MoreAction } from '../components/MoreMenu'

export function usePanelManager(callbacks: {
  handleUpgrade: () => void
  handleManageSubscription: () => void
  signOut: () => void
  setShowDeleteConfirm: (v: boolean) => void
  setIsDrawerOpen: (v: boolean) => void
  handleNewChat: () => void
}) {
  const [showProjectPanel, setShowProjectPanel] = useState(false)
  const [showImageGallery, setShowImageGallery] = useState(false)
  const [showAccountSettings, setShowAccountSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)

  const closeAllPanels = useCallback(() => {
    setShowProjectPanel(false)
    setShowImageGallery(false)
    setShowAccountSettings(false)
    setActiveTab('home')
    setShowMoreMenu(false)
  }, [])

  type PanelId = 'project' | 'image-gallery' | 'account-settings' | 'settings' | 'drawer'

  const closeOtherPanels = useCallback((except?: string) => {
    if (except !== 'project') setShowProjectPanel(false)
    if (except !== 'image-gallery') setShowImageGallery(false)
    if (except !== 'account-settings') setShowAccountSettings(false)
    if (except !== 'drawer') callbacks.setIsDrawerOpen(false)
    if (except !== 'settings') setShowMoreMenu(false)
  }, [callbacks])

  const closePanel = useCallback((id: PanelId) => {
    switch (id) {
      case 'project': setShowProjectPanel(false); break
      case 'image-gallery': setShowImageGallery(false); break
      case 'account-settings': setShowAccountSettings(false); break
      case 'settings': setShowMoreMenu(false); break
      case 'drawer': callbacks.setIsDrawerOpen(false); break
    }
    setActiveTab('home')
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
        callbacks.handleNewChat()
        break
      case 'chats':
        closeOtherPanels('drawer')
        callbacks.setIsDrawerOpen(true)
        break
      case 'files':
        closeOtherPanels('project')
        setShowProjectPanel(true)
        break
      case 'gallery':
        closeOtherPanels('image-gallery')
        setShowImageGallery(true)
        break
      case 'settings':
        closeOtherPanels('settings')
        setShowMoreMenu(true)
        break
    }
  }, [activeTab, closeAllPanels, closeOtherPanels, callbacks])

  const handleSettingsAction = useCallback((action: MoreAction) => {
    setShowMoreMenu(false)
    setActiveTab('home')
    switch (action) {
      case 'account-settings':
        closeOtherPanels('account-settings')
        setShowAccountSettings(true)
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
    showProjectPanel, setShowProjectPanel,
    showImageGallery, setShowImageGallery,
    showAccountSettings, setShowAccountSettings,
    activeTab, setActiveTab,
    showMoreMenu, setShowMoreMenu,
    headerMenuOpen, setHeaderMenuOpen,
    closeAllPanels, closeOtherPanels, closePanel,
    handleTabChange, handleSettingsAction,
  }
}
