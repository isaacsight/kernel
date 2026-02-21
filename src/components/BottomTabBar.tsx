import { IconHome, IconChats, IconGoals, IconBriefings, IconMore } from './KernelIcons'
import { useMiniPhone } from '../hooks/useMiniPhone'

export type TabId = 'home' | 'chats' | 'goals' | 'briefings' | 'more'

interface Tab {
  id: TabId
  label: string
  icon: typeof IconHome
}

const TABS: Tab[] = [
  { id: 'home', label: 'Home', icon: IconHome },
  { id: 'chats', label: 'Chats', icon: IconChats },
  { id: 'goals', label: 'Goals', icon: IconGoals },
  { id: 'briefings', label: 'Briefings', icon: IconBriefings },
  { id: 'more', label: 'More', icon: IconMore },
]

interface BottomTabBarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  undiscoveredCount?: number
}

export function BottomTabBar({ activeTab, onTabChange, undiscoveredCount = 0 }: BottomTabBarProps) {
  const isMini = useMiniPhone()

  const visibleTabs = isMini
    ? TABS.filter(t => ['home', 'chats', 'more'].includes(t.id))
    : TABS

  return (
    <nav className="ka-tab-bar" role="tablist" aria-label="Main navigation">
      {visibleTabs.map(tab => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        const showDot = tab.id === 'more' && undiscoveredCount > 0
        return (
          <button
            key={tab.id}
            className={`ka-tab-item${isActive ? ' ka-tab-item--active' : ''}`}
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="ka-tab-icon-wrap">
              <Icon size={isMini ? 20 : 22} />
              {showDot && <span className="ka-feature-dot ka-feature-dot--tab" />}
            </span>
            <span className="ka-tab-label">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
