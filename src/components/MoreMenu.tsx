import { motion, useDragControls } from 'framer-motion'
import { SPRING } from '../constants/motion'
import { IconZap, IconClock, IconBrain, IconChart, IconEye, IconCrown, IconSettings, IconLogOut, IconTrash, IconGlobe, IconBell, IconSun, IconMoon, IconShield } from './KernelIcons'
import { useTranslation } from 'react-i18next'
import { useNotificationPrefs } from '../hooks/useNotificationPrefs'
import { useWebPush } from '../hooks/useWebPush'

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
  | 'reliability'
  | 'account-settings'
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
  { id: 'reliability', labelKey: 'menu.reliability', icon: IconShield },
]

const ACCOUNT_ITEMS: MoreMenuItem[] = [
  { id: 'account-settings', labelKey: 'menu.accountSettings', icon: IconSettings },
  { id: 'sign-out', labelKey: 'menu.signOut', icon: IconLogOut },
]

interface MoreMenuProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (action: MoreAction) => void
  isPro: boolean
  isAdmin: boolean
  isNewFeature?: (id: string) => boolean
  onFeatureDiscovered?: (id: string) => void
  darkMode?: boolean
  onToggleDarkMode?: () => void
}

export function MoreMenu({ isOpen, onClose, onSelect, isPro, isAdmin, isNewFeature, onFeatureDiscovered, darkMode, onToggleDarkMode }: MoreMenuProps) {
  const { t, i18n } = useTranslation('home')
  const { prefs, update: updateNotifPrefs } = useNotificationPrefs()
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, isLoading: pushLoading, toggle: togglePush } = useWebPush()
  const dragControls = useDragControls()
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
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 300) onClose()
        }}
      >
        <div className="ka-more-drag-handle" onPointerDown={(e) => dragControls.start(e)} />
        <div className="ka-more-menu-items">
          <div className="ka-more-menu-label">{t('features', { ns: 'common' })}</div>
          {ITEMS.filter(item => {
            if (item.condition === 'not-pro') return !isPro
            if (item.condition === 'subscribed') return isPro || isAdmin
            return true
          }).map(item => {
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
          {onToggleDarkMode && (
            <label className="ka-more-toggle">
              <span>
                {darkMode ? <IconSun size={14} /> : <IconMoon size={14} />}
                {' '}{t('menu.darkMode')}
              </span>
              <input type="checkbox" role="switch" aria-checked={!!darkMode} checked={!!darkMode} onChange={onToggleDarkMode} />
              <span className="ka-more-toggle-track" />
            </label>
          )}
          <div className="ka-more-menu-divider" />
          <div className="ka-more-menu-label">
            <IconBell size={14} />
            {t('menu.notifications')}
          </div>
          <label className="ka-more-toggle">
            <span>{t('menu.notifInApp')}</span>
            <input type="checkbox" role="switch" aria-checked={prefs.inApp} checked={prefs.inApp} onChange={e => updateNotifPrefs({ inApp: e.target.checked })} />
            <span className="ka-more-toggle-track" />
          </label>
          <label className="ka-more-toggle">
            <span>{t('menu.notifBriefings')}</span>
            <input type="checkbox" role="switch" aria-checked={prefs.briefings} checked={prefs.briefings} onChange={e => updateNotifPrefs({ briefings: e.target.checked })} />
            <span className="ka-more-toggle-track" />
          </label>
          <label className="ka-more-toggle">
            <span>{t('menu.notifGoals')}</span>
            <input type="checkbox" role="switch" aria-checked={prefs.goals} checked={prefs.goals} onChange={e => updateNotifPrefs({ goals: e.target.checked })} />
            <span className="ka-more-toggle-track" />
          </label>
          <label className="ka-more-toggle">
            <span>{t('menu.notifReminders')}</span>
            <input type="checkbox" role="switch" aria-checked={prefs.reminders} checked={prefs.reminders} onChange={e => updateNotifPrefs({ reminders: e.target.checked })} />
            <span className="ka-more-toggle-track" />
          </label>
          {pushSupported && (
            <label className="ka-more-toggle">
              <span>{t('menu.notifPush')}</span>
              <input
                type="checkbox"
                role="switch"
                aria-checked={pushSubscribed}
                checked={pushSubscribed}
                disabled={pushLoading}
                onChange={togglePush}
              />
              <span className="ka-more-toggle-track" />
            </label>
          )}
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
