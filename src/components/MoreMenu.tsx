import { motion, useDragControls } from 'motion/react'
import { SPRING } from '../constants/motion'
import { IconSettings, IconLogOut, IconGlobe, IconSun, IconMoon, IconBookOpen, IconCrown, IconChart } from './KernelIcons'
import { useTranslation } from 'react-i18next'
import type { ThemeMode } from '../hooks/useTheme'
import type { PlanId } from '../config/planLimits'

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
  | 'usage'
  | 'upgrade'
  | 'manage-subscription'
  | 'sign-out'
  | 'delete-account'

const THEMES: { id: ThemeMode; icon: typeof IconSun; labelKey: string }[] = [
  { id: 'light', icon: IconSun, labelKey: 'menu.themeLight' },
  { id: 'dark', icon: IconMoon, labelKey: 'menu.themeDark' },
  { id: 'eink', icon: IconBookOpen, labelKey: 'menu.themeEink' },
]

interface PlanOption {
  id: PlanId
  name: string
  price: string
  period: string
  badge?: string
}

const PLANS: PlanOption[] = [
  { id: 'pro_monthly', name: 'Pro', price: '$39', period: '/mo' },
  { id: 'pro_annual', name: 'Pro', price: '$390', period: '/yr', badge: 'Save 17%' },
]

interface MoreMenuProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (action: MoreAction) => void
  onUpgrade: (plan: PlanId) => void
  isPro: boolean
  isSubscribed?: boolean
  isAdmin: boolean
  upgradeLoading?: boolean
  theme?: ThemeMode
  onSetTheme?: (t: ThemeMode) => void
}

export function MoreMenu({ isOpen, onClose, onSelect, onUpgrade, isPro, isSubscribed, upgradeLoading, theme, onSetTheme }: MoreMenuProps) {
  const { t, i18n } = useTranslation('home')
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

          {!isPro && (
            <>
              <div className="ka-more-menu-divider" />
              <div className="ka-more-menu-label">
                <IconCrown size={14} />
                Upgrade
              </div>
              <div className="ka-plan-grid">
                {PLANS.map(plan => (
                  <button
                    key={plan.id}
                    className="ka-plan-card"
                    disabled={upgradeLoading}
                    onClick={() => { onUpgrade(plan.id); onClose() }}
                  >
                    <span className="ka-plan-card-name">{plan.name}</span>
                    <span className="ka-plan-card-price">
                      {plan.price}<span className="ka-plan-card-period">{plan.period}</span>
                    </span>
                    {plan.badge && <span className="ka-plan-card-badge">{plan.badge}</span>}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="ka-more-menu-divider" />
          <div className="ka-more-menu-label">{t('account', { ns: 'common' })}</div>
          {isSubscribed && (
            <button className="ka-more-menu-item" onClick={() => { onSelect('manage-subscription'); onClose() }}>
              <IconCrown size={18} />
              <span>{t('menu.manageSubscription', { defaultValue: 'Manage Subscription' })}</span>
            </button>
          )}
          <button className="ka-more-menu-item" onClick={() => { onSelect('usage'); onClose() }}>
            <IconChart size={18} />
            <span>{t('menu.usage', 'Usage')}</span>
          </button>
          <button className="ka-more-menu-item" onClick={() => { onSelect('account-settings'); onClose() }}>
            <IconSettings size={18} />
            <span>{t('menu.accountSettings')}</span>
          </button>
          <button className="ka-more-menu-item" onClick={() => { onSelect('sign-out'); onClose() }}>
            <IconLogOut size={18} />
            <span>{t('menu.signOut')}</span>
          </button>
          <div className="ka-more-menu-version">Kernel v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.3'}</div>
        </div>
      </motion.div>
    </>
  )
}
