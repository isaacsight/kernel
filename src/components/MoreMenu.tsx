import { motion } from 'framer-motion'
import { SPRING } from '../constants/motion'
import { IconZap, IconClock, IconBrain, IconChart, IconEye, IconExport, IconCrown, IconSettings, IconLogOut, IconTrash, IconGlobe } from './KernelIcons'
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
  | 'portability'
  | 'upgrade'
  | 'manage-subscription'
  | 'sign-out'
  | 'delete-account'

interface MoreMenuItem {
  id: MoreAction
  labelKey: string
  icon: typeof IconZap
  danger?: boolean
  condition?: 'not-pro' | 'subscribed' | 'always'
}

const ITEMS: MoreMenuItem[] = [
  { id: 'workflows', labelKey: 'menu.workflows', icon: IconZap },
  { id: 'scheduled', labelKey: 'menu.scheduledTasks', icon: IconClock },
  { id: 'knowledge', labelKey: 'menu.whatKernelKnows', icon: IconBrain },
  { id: 'stats', labelKey: 'menu.yourStats', icon: IconChart },
  { id: 'insights', labelKey: 'menu.insights', icon: IconEye },
  { id: 'portability', labelKey: 'menu.portability', icon: IconExport },
]

const ACCOUNT_ITEMS: MoreMenuItem[] = [
  { id: 'upgrade', labelKey: 'menu.upgradeToPro', icon: IconCrown, condition: 'not-pro' },
  { id: 'manage-subscription', labelKey: 'menu.manageSubscription', icon: IconSettings, condition: 'subscribed' },
  { id: 'sign-out', labelKey: 'menu.signOut', icon: IconLogOut },
  { id: 'delete-account', labelKey: 'menu.deleteAccount', icon: IconTrash, danger: true },
]

interface MoreMenuProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (action: MoreAction) => void
  isPro: boolean
  isAdmin: boolean
  isNewFeature?: (id: string) => boolean
  onFeatureDiscovered?: (id: string) => void
}

export function MoreMenu({ isOpen, onClose, onSelect, isPro, isAdmin, isNewFeature, onFeatureDiscovered }: MoreMenuProps) {
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
        transition={SPRING.DEFAULT}
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
            const isNew = isNewFeature?.(item.id)
            return (
              <button
                key={item.id}
                className="ka-more-menu-item"
                onClick={() => { onFeatureDiscovered?.(item.id); onSelect(item.id); onClose() }}
              >
                <Icon size={18} />
                <span>{t(item.labelKey)}</span>
                {isNew && <span className="ka-feature-dot" />}
              </button>
            )
          })}
          <div className="ka-more-menu-divider" />
          <div className="ka-more-menu-label">{t('language', { ns: 'common' })}</div>
          <div className="ka-more-menu-item ka-more-language-select">
            <IconGlobe size={18} />
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
