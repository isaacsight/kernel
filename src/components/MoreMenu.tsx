import { motion, useDragControls } from 'framer-motion'
import { SPRING } from '../constants/motion'
import { IconSettings, IconLogOut, IconGlobe, IconBell, IconSun, IconMoon, IconBookOpen } from './KernelIcons'
import { useTranslation } from 'react-i18next'
import { useNotificationPrefs } from '../hooks/useNotificationPrefs'
import { useWebPush } from '../hooks/useWebPush'
import type { ThemeMode } from '../hooks/useTheme'

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
  | 'account-settings'
  | 'upgrade'
  | 'manage-subscription'
  | 'sign-out'
  | 'delete-account'

const THEMES: { id: ThemeMode; icon: typeof IconSun; labelKey: string }[] = [
  { id: 'light', icon: IconSun, labelKey: 'menu.themeLight' },
  { id: 'dark', icon: IconMoon, labelKey: 'menu.themeDark' },
  { id: 'eink', icon: IconBookOpen, labelKey: 'menu.themeEink' },
]

interface MoreMenuProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (action: MoreAction) => void
  isPro: boolean
  isAdmin: boolean
  theme?: ThemeMode
  onSetTheme?: (t: ThemeMode) => void
}

export function MoreMenu({ isOpen, onClose, onSelect, theme, onSetTheme }: MoreMenuProps) {
  const { t, i18n } = useTranslation('home')
  const { prefs, update: updateNotifPrefs } = useNotificationPrefs()
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, isLoading: pushLoading, toggle: togglePush } = useWebPush()
  const dragControls = useDragControls()
  if (!isOpen) return null

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
          {onSetTheme && (
            <>
              <div className="ka-more-menu-label">{t('menu.theme')}</div>
              <div className="ka-theme-switcher">
                {THEMES.map(({ id, icon: Icon, labelKey }) => (
                  <button
                    key={id}
                    className={`ka-theme-option${theme === id ? ' ka-theme-option--active' : ''}`}
                    onClick={() => onSetTheme(id)}
                    aria-pressed={theme === id}
                  >
                    <Icon size={14} />
                    <span>{t(labelKey)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
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
          <label className="ka-more-toggle">
            <span>{t('menu.notifProactive')}</span>
            <input type="checkbox" role="switch" aria-checked={prefs.proactive} checked={prefs.proactive} onChange={e => updateNotifPrefs({ proactive: e.target.checked })} />
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
          <button className="ka-more-menu-item" onClick={() => { onSelect('account-settings'); onClose() }}>
            <IconSettings size={18} />
            <span>{t('menu.accountSettings')}</span>
          </button>
          <button className="ka-more-menu-item" onClick={() => { onSelect('sign-out'); onClose() }}>
            <IconLogOut size={18} />
            <span>{t('menu.signOut')}</span>
          </button>
        </div>
      </motion.div>
    </>
  )
}
