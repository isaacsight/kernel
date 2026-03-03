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
  const [showAgentBuilderPanel, setShowAgentBuilderPanel] = useState(false)
  const [showAgentLibraryPanel, setShowAgentLibraryPanel] = useState(false)
  const [showBackgroundAgentsPanel, setShowBackgroundAgentsPanel] = useState(false)
  const [showPublishPanel, setShowPublishPanel] = useState(false)
  const [showMyContentPanel, setShowMyContentPanel] = useState(false)
  const [showAuthorProfilePanel, setShowAuthorProfilePanel] = useState(false)
  const [showBookmarksPanel, setShowBookmarksPanel] = useState(false)
  const [showSandboxPanel, setShowSandboxPanel] = useState(false)
  const [showArchitecturePanel, setShowArchitecturePanel] = useState(false)
  const [showDesignPanel, setShowDesignPanel] = useState(false)
  const [showRoutingInsightsPanel, setShowRoutingInsightsPanel] = useState(false)
  const [showSystemPanel, setShowSystemPanel] = useState(false)
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
    setShowAgentBuilderPanel(false)
    setShowAgentLibraryPanel(false)
    setShowBackgroundAgentsPanel(false)
    setShowPublishPanel(false)
    setShowMyContentPanel(false)
    setShowAuthorProfilePanel(false)
    setShowBookmarksPanel(false)
    setShowSandboxPanel(false)
    setShowArchitecturePanel(false)
    setShowDesignPanel(false)
    setShowRoutingInsightsPanel(false)
    setShowSystemPanel(false)
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
    if (except !== 'agent-builder') setShowAgentBuilderPanel(false)
    if (except !== 'agent-library') setShowAgentLibraryPanel(false)
    if (except !== 'background-agents') setShowBackgroundAgentsPanel(false)
    if (except !== 'publish') setShowPublishPanel(false)
    if (except !== 'my-content') setShowMyContentPanel(false)
    if (except !== 'author-profile') setShowAuthorProfilePanel(false)
    if (except !== 'bookmarks') setShowBookmarksPanel(false)
    if (except !== 'sandbox') setShowSandboxPanel(false)
    if (except !== 'architecture') setShowArchitecturePanel(false)
    if (except !== 'design-system') setShowDesignPanel(false)
    if (except !== 'routing-insights') setShowRoutingInsightsPanel(false)
    if (except !== 'system') setShowSystemPanel(false)
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

  type PanelId = 'kg' | 'stats' | 'goals' | 'workflows' | 'scheduled' | 'briefings' | 'insights' | 'account-settings' | 'mirror' | 'project' | 'image-gallery' | 'knowledge' | 'social' | 'platform' | 'agent-builder' | 'agent-library' | 'background-agents' | 'publish' | 'my-content' | 'author-profile' | 'bookmarks' | 'sandbox' | 'architecture' | 'design-system' | 'routing-insights' | 'system' | 'more' | 'drawer'

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
      case 'agent-builder': setShowAgentBuilderPanel(false); break
      case 'agent-library': setShowAgentLibraryPanel(false); break
      case 'background-agents': setShowBackgroundAgentsPanel(false); break
      case 'publish': setShowPublishPanel(false); break
      case 'my-content': setShowMyContentPanel(false); break
      case 'author-profile': setShowAuthorProfilePanel(false); break
      case 'bookmarks': setShowBookmarksPanel(false); break
      case 'sandbox': setShowSandboxPanel(false); break
      case 'architecture': setShowArchitecturePanel(false); break
      case 'design-system': setShowDesignPanel(false); break
      case 'routing-insights': setShowRoutingInsightsPanel(false); break
      case 'system': setShowSystemPanel(false); break
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
      case 'agent-builder':
        closeOtherPanels('agent-builder')
        setShowAgentBuilderPanel(true)
        break
      case 'agent-library':
        closeOtherPanels('agent-library')
        setShowAgentLibraryPanel(true)
        break
      case 'background-agents':
        closeOtherPanels('background-agents')
        setShowBackgroundAgentsPanel(true)
        break
      case 'publish':
        closeOtherPanels('publish')
        setShowPublishPanel(true)
        break
      case 'my-content':
        closeOtherPanels('my-content')
        setShowMyContentPanel(true)
        break
      case 'author-profile':
        closeOtherPanels('author-profile')
        setShowAuthorProfilePanel(true)
        break
      case 'bookmarks':
        closeOtherPanels('bookmarks')
        setShowBookmarksPanel(true)
        break
      case 'sandbox':
        closeOtherPanels('sandbox')
        setShowSandboxPanel(true)
        break
      case 'architecture':
        closeOtherPanels('architecture')
        setShowArchitecturePanel(true)
        break
      case 'design-system':
        closeOtherPanels('design-system')
        setShowDesignPanel(true)
        break
      case 'routing-insights':
        closeOtherPanels('routing-insights')
        setShowRoutingInsightsPanel(true)
        break
      case 'system':
        closeOtherPanels('system')
        setShowSystemPanel(true)
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
    showAgentBuilderPanel, setShowAgentBuilderPanel,
    showAgentLibraryPanel, setShowAgentLibraryPanel,
    showBackgroundAgentsPanel, setShowBackgroundAgentsPanel,
    showPublishPanel, setShowPublishPanel,
    showMyContentPanel, setShowMyContentPanel,
    showAuthorProfilePanel, setShowAuthorProfilePanel,
    showBookmarksPanel, setShowBookmarksPanel,
    showSandboxPanel, setShowSandboxPanel,
    showArchitecturePanel, setShowArchitecturePanel,
    showDesignPanel, setShowDesignPanel,
    showRoutingInsightsPanel, setShowRoutingInsightsPanel,
    showSystemPanel, setShowSystemPanel,
    activeTab, setActiveTab,
    showMoreMenu, setShowMoreMenu,
    headerMenuOpen, setHeaderMenuOpen,
    closeAllPanels, closeOtherPanels, closePanel,
    handleTabChange, handleMoreAction,
  }
}
