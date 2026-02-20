import { MessageSquare, List, Target, Newspaper, MoreHorizontal } from 'lucide-react'

export type TabId = 'home' | 'chats' | 'goals' | 'briefings' | 'more'

interface Tab {
  id: TabId
  label: string
  icon: typeof MessageSquare
}

const TABS: Tab[] = [
  { id: 'home', label: 'Home', icon: MessageSquare },
  { id: 'chats', label: 'Chats', icon: List },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'briefings', label: 'Briefings', icon: Newspaper },
  { id: 'more', label: 'More', icon: MoreHorizontal },
]

interface BottomTabBarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  undiscoveredCount?: number
}

export function BottomTabBar({ activeTab, onTabChange, undiscoveredCount = 0 }: BottomTabBarProps) {
  return (
    <nav className="ka-tab-bar" role="tablist" aria-label="Main navigation">
      {TABS.map(tab => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        const showDot = tab.id === 'more' && undiscoveredCount > 0
        return (
          <button
            key={tab.id}
            className={`ka-tab-item${isActive ? ' ka-tab-item--active' : ''}`}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="ka-tab-icon-wrap">
              <Icon size={20} />
              {showDot && <span className="ka-feature-dot ka-feature-dot--tab" />}
            </span>
            <span className="ka-tab-label">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
