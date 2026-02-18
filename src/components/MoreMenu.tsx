import { motion } from 'framer-motion'
import { Zap, Clock, Brain, BarChart3, Crown, Settings, LogOut, Trash2 } from 'lucide-react'

export type MoreAction =
  | 'workflows'
  | 'scheduled'
  | 'knowledge'
  | 'stats'
  | 'upgrade'
  | 'manage-subscription'
  | 'sign-out'
  | 'delete-account'

interface MoreMenuItem {
  id: MoreAction
  label: string
  icon: typeof Zap
  danger?: boolean
  condition?: 'not-pro' | 'subscribed' | 'always'
}

const ITEMS: MoreMenuItem[] = [
  { id: 'workflows', label: 'Workflows', icon: Zap },
  { id: 'scheduled', label: 'Scheduled Tasks', icon: Clock },
  { id: 'knowledge', label: 'What Kernel Knows', icon: Brain },
  { id: 'stats', label: 'Your Stats', icon: BarChart3 },
]

const ACCOUNT_ITEMS: MoreMenuItem[] = [
  { id: 'upgrade', label: 'Upgrade to Pro', icon: Crown, condition: 'not-pro' },
  { id: 'manage-subscription', label: 'Manage Subscription', icon: Settings, condition: 'subscribed' },
  { id: 'sign-out', label: 'Sign Out', icon: LogOut },
  { id: 'delete-account', label: 'Delete Account', icon: Trash2, danger: true },
]

interface MoreMenuProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (action: MoreAction) => void
  isPro: boolean
  isAdmin: boolean
}

export function MoreMenu({ isOpen, onClose, onSelect, isPro, isAdmin }: MoreMenuProps) {
  if (!isOpen) return null

  const filteredAccount = ACCOUNT_ITEMS.filter(item => {
    if (item.condition === 'not-pro') return !isPro
    if (item.condition === 'subscribed') return !isAdmin && isPro
    return true
  })

  return (
    <>
      <motion.div
        className="ka-more-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="ka-more-menu"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 300) onClose()
        }}
      >
        <div className="ka-more-drag-handle" />
        <div className="ka-more-menu-items">
          <div className="ka-more-menu-label">Features</div>
          {ITEMS.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className="ka-more-menu-item"
                onClick={() => { onSelect(item.id); onClose() }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
          <div className="ka-more-menu-divider" />
          <div className="ka-more-menu-label">Account</div>
          {filteredAccount.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`ka-more-menu-item${item.danger ? ' ka-more-menu-item--danger' : ''}${item.id === 'upgrade' ? ' ka-more-menu-item--upgrade' : ''}`}
                onClick={() => { onSelect(item.id); onClose() }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </motion.div>
    </>
  )
}
