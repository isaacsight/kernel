import { motion } from 'framer-motion'
import { Zap, Clock, Brain, BarChart3, Eye, Crown, Settings, LogOut, Trash2, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'ru', name: 'Русский' },
  { code: 'zh', name: '中文(简体)' },
  { code: 'zh-TW', name: '中文(繁體)' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'pl', name: 'Polski' },
  { code: 'sv', name: 'Svenska' },
  { code: 'no', name: 'Norsk' },
  { code: 'da', name: 'Dansk' },
  { code: 'fi', name: 'Suomi' },
  { code: 'fa', name: 'فارسی' },
  { code: 'he', name: 'עברית' },
  { code: 'ur', name: 'اردو' },
  { code: 'ckb', name: 'کوردی سۆرانی' },
]

export type MoreAction =
  | 'workflows'
  | 'scheduled'
  | 'knowledge'
  | 'stats'
  | 'insights'
  | 'upgrade'
  | 'manage-subscription'
  | 'sign-out'
  | 'delete-account'

interface MoreMenuItem {
  id: MoreAction
  labelKey: string
  icon: typeof Zap
  danger?: boolean
  condition?: 'not-pro' | 'subscribed' | 'always'
}

const ITEMS: MoreMenuItem[] = [
  { id: 'workflows', labelKey: 'menu.workflows', icon: Zap },
  { id: 'scheduled', labelKey: 'menu.scheduledTasks', icon: Clock },
  { id: 'knowledge', labelKey: 'menu.whatKernelKnows', icon: Brain },
  { id: 'stats', labelKey: 'menu.yourStats', icon: BarChart3 },
  { id: 'insights', labelKey: 'menu.insights', icon: Eye },
]

const ACCOUNT_ITEMS: MoreMenuItem[] = [
  { id: 'upgrade', labelKey: 'menu.upgradeToPro', icon: Crown, condition: 'not-pro' },
  { id: 'manage-subscription', labelKey: 'menu.manageSubscription', icon: Settings, condition: 'subscribed' },
  { id: 'sign-out', labelKey: 'menu.signOut', icon: LogOut },
  { id: 'delete-account', labelKey: 'menu.deleteAccount', icon: Trash2, danger: true },
]

interface MoreMenuProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (action: MoreAction) => void
  isPro: boolean
  isAdmin: boolean
}

export function MoreMenu({ isOpen, onClose, onSelect, isPro, isAdmin }: MoreMenuProps) {
  const { t, i18n } = useTranslation('home')
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
          <div className="ka-more-menu-label">{t('features', { ns: 'common' })}</div>
          {ITEMS.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className="ka-more-menu-item"
                onClick={() => { onSelect(item.id); onClose() }}
              >
                <Icon size={18} />
                <span>{t(item.labelKey)}</span>
              </button>
            )
          })}
          <div className="ka-more-menu-divider" />
          <div className="ka-more-menu-label">{t('language', { ns: 'common' })}</div>
          <div className="ka-more-menu-item ka-more-language-select">
            <Globe size={18} />
            <select
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="ka-language-picker"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>
          <div className="ka-more-menu-divider" />
          <div className="ka-more-menu-label">{t('account', { ns: 'common' })}</div>
          {filteredAccount.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`ka-more-menu-item${item.danger ? ' ka-more-menu-item--danger' : ''}${item.id === 'upgrade' ? ' ka-more-menu-item--upgrade' : ''}`}
                onClick={() => { onSelect(item.id); onClose() }}
              >
                <Icon size={18} />
                <span>{t(item.labelKey)}</span>
              </button>
            )
          })}
        </div>
      </motion.div>
    </>
  )
}
