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
  const [showKGPanel, setShowKGPanel] = useState(false)
  const [showStatsPanel, setShowStatsPanel] = useState(false)
  const [showGoalsPanel, setShowGoalsPanel] = useState(false)
  const [showWorkflowsPanel, setShowWorkflowsPanel] = useState(false)
  const [showScheduledPanel, setShowScheduledPanel] = useState(false)
  const [showBriefingPanel, setShowBriefingPanel] = useState(false)
  const [showInsightsPanel, setShowInsightsPanel] = useState(false)
  const [showAccountSettings, setShowAccountSettings] = useState(false)
  const [showMirrorPanel, setShowMirrorPanel] = useState(false)
  const [showProjectPanel, setShowProjectPanel] = useState(false)
  const [showImageGallery, setShowImageGallery] = useState(false)
  const [showKnowledgePanel, setShowKnowledgePanel] = useState(false)
  const [showSocialPanel, setShowSocialPanel] = useState(false)
  const [showPlatformPanel, setShowPlatformPanel] = useState(false)
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
    setShowInsightsPanel(false)
    setShowAccountSettings(false)
    setShowMirrorPanel(false)
    setShowProjectPanel(false)
    setShowImageGallery(false)
    setShowKnowledgePanel(false)
    setShowSocialPanel(false)
    setShowPlatformPanel(false)
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
    if (except !== 'insights') setShowInsightsPanel(false)
    if (except !== 'account-settings') setShowAccountSettings(false)
    if (except !== 'mirror') setShowMirrorPanel(false)
    if (except !== 'project') setShowProjectPanel(false)
    if (except !== 'image-gallery') setShowImageGallery(false)
    if (except !== 'knowledge') setShowKnowledgePanel(false)
    if (except !== 'social') setShowSocialPanel(false)
    if (except !== 'platform') setShowPlatformPanel(false)
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
        callbacks.handleNewChat()
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

  type PanelId = 'kg' | 'stats' | 'goals' | 'workflows' | 'scheduled' | 'briefings' | 'insights' | 'account-settings' | 'mirror' | 'project' | 'image-gallery' | 'knowledge' | 'social' | 'platform' | 'more' | 'drawer'

  const closePanel = useCallback((id: PanelId) => {
    switch (id) {
      case 'kg': setShowKGPanel(false); break
      case 'stats': setShowStatsPanel(false); break
      case 'goals': setShowGoalsPanel(false); break
      case 'workflows': setShowWorkflowsPanel(false); break
      case 'scheduled': setShowScheduledPanel(false); break
      case 'briefings': setShowBriefingPanel(false); break
      case 'insights': setShowInsightsPanel(false); break
      case 'account-settings': setShowAccountSettings(false); break
      case 'mirror': setShowMirrorPanel(false); break
      case 'project': setShowProjectPanel(false); break
      case 'image-gallery': setShowImageGallery(false); break
      case 'knowledge': setShowKnowledgePanel(false); break
      case 'social': setShowSocialPanel(false); break
      case 'platform': setShowPlatformPanel(false); break
      case 'more': setShowMoreMenu(false); break
      case 'drawer': callbacks.setIsDrawerOpen(false); break
    }
    setActiveTab('home')
  }, [callbacks])

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
      case 'insights':
        closeOtherPanels('insights')
        setShowInsightsPanel(true)
        break
      case 'account-settings':
        closeOtherPanels('account-settings')
        setShowAccountSettings(true)
        break
      case 'mirror':
        closeOtherPanels('mirror')
        setShowMirrorPanel(true)
        break
      case 'project':
        closeOtherPanels('project')
        setShowProjectPanel(true)
        break
      case 'image-gallery':
        closeOtherPanels('image-gallery')
        setShowImageGallery(true)
        break
      case 'knowledge-base':
        closeOtherPanels('knowledge')
        setShowKnowledgePanel(true)
        break
      case 'social':
        closeOtherPanels('social')
        setShowSocialPanel(true)
        break
      case 'platform':
        closeOtherPanels('platform')
        setShowPlatformPanel(true)
        break
      case 'explore':
        closeAllPanels()
        window.location.hash = '#/explore'
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
    showInsightsPanel, setShowInsightsPanel,
    showAccountSettings, setShowAccountSettings,
    showMirrorPanel, setShowMirrorPanel,
    showProjectPanel, setShowProjectPanel,
    showImageGallery, setShowImageGallery,
    showKnowledgePanel, setShowKnowledgePanel,
    showSocialPanel, setShowSocialPanel,
    showPlatformPanel, setShowPlatformPanel,
    activeTab, setActiveTab,
    showMoreMenu, setShowMoreMenu,
    headerMenuOpen, setHeaderMenuOpen,
    closeAllPanels, closeOtherPanels, closePanel,
    handleTabChange, handleMoreAction,
  }
}
