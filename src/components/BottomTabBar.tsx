import { IconHome, IconChats, IconFolder, IconSettings } from './KernelIcons'
import { useMiniPhone } from '../hooks/useMiniPhone'

export type TabId = 'home' | 'chats' | 'files' | 'gallery' | 'settings'

interface Tab {
  id: TabId
  label: string
  icon: typeof IconHome
}

const TABS: Tab[] = [
  { id: 'home', label: 'Home', icon: IconHome },
  { id: 'chats', label: 'Chats', icon: IconChats },
  { id: 'files', label: 'Files', icon: IconFolder },
  { id: 'settings', label: 'Settings', icon: IconSettings },
]

interface BottomTabBarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  const isMini = useMiniPhone()

  const visibleTabs = isMini
    ? TABS.filter(t => ['home', 'chats', 'settings'].includes(t.id))
    : TABS

  return (
    <nav className="ka-tab-bar" role="tablist" aria-label="Main navigation">
      {visibleTabs.map(tab => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            className={`ka-tab-item${isActive ? ' ka-tab-item--active' : ''}`}
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            onClick={() => {
              if ('vibrate' in navigator) navigator.vibrate(10)
              onTabChange(tab.id)
            }}
          >
            <Icon size={isMini ? 22 : 24} />
            {isActive && <span className="ka-tab-dot" />}
          </button>
        )
      })}
    </nav>
  )
}
