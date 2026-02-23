import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { User, Provider } from '@supabase/supabase-js'
import { useAccountSettings } from '../hooks/useAccountSettings'
import { useAuthContext } from '../providers/AuthProvider'
import {
  IconUser, IconShield, IconCrown, IconLogOut, IconTrash, IconCheck, IconAlertCircle,
} from './KernelIcons'

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'github', label: 'GitHub' },
  { id: 'twitter', label: 'X (Twitter)' },
]

interface AccountSettingsPanelProps {
  user: User
  isPro: boolean
  isAdmin: boolean
  onClose: () => void
  onToast: (msg: string) => void
  onUpgrade: () => void
  onManageSubscription: () => void
  onSignOut: () => void
  onDeleteAccount: () => void
}

export default function AccountSettingsPanel({
  user, isPro, isAdmin, onClose, onToast, onUpgrade, onManageSubscription, onSignOut, onDeleteAccount,
}: AccountSettingsPanelProps) {
  const { t } = useTranslation('settings')
  const auth = useAuthContext()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const settings = useAccountSettings(user, {
    updateEmail: auth.updateEmail,
    updatePassword: auth.updatePassword,
    updateProfile: auth.updateProfile,
    getUserIdentities: auth.getUserIdentities,
    linkIdentity: auth.linkIdentity,
    unlinkIdentity: auth.unlinkIdentity,
  })

  const initials = (settings.displayName || user.email || '?')
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('')

  const tierLabel = isAdmin ? t('subscription.admin') : isPro ? t('subscription.pro') : t('subscription.free')

  return (
    <div className="ka-settings-panel">
      <h2 className="ka-panel-title">{t('title')}</h2>

      {/* User Summary */}
      <div className="ka-settings-user-summary">
        <div
          className="ka-settings-avatar ka-settings-avatar--lg"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label={t('profile.avatarChange')}
        >
          {settings.avatarUrl ? (
            <img src={settings.avatarUrl} alt="" className="ka-settings-avatar-img" />
          ) : (
            <span className="ka-settings-avatar-initials">{initials}</span>
          )}
          <span className="ka-settings-avatar-overlay">{t('profile.avatarChange')}</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="ka-attach-input"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) settings.uploadAvatar(file)
            e.target.value = ''
          }}
        />
        <div className="ka-settings-user-info">
          <span className="ka-settings-user-name">{settings.displayName || user.email}</span>
          {settings.displayName && <span className="ka-settings-user-email">{user.email}</span>}
          <span className={`ka-settings-tier-badge${isAdmin ? ' ka-settings-tier-badge--admin' : isPro ? ' ka-settings-tier-badge--pro' : ''}`}>
            {isAdmin ? <IconShield size={12} /> : isPro ? <IconCrown size={12} /> : <IconUser size={12} />}
            {tierLabel}
          </span>
        </div>
      </div>

      {/* Profile Section */}
      <div className="ka-settings-section">
        <h3 className="ka-settings-section-header">{t('profile.heading')}</h3>
        <div className="ka-settings-section-body">
          <label className="ka-settings-field">
            <span className="ka-settings-label">{t('profile.displayName')}</span>
            <input
              className="ka-gate-input"
              type="text"
              value={settings.displayName}
              onChange={e => settings.setDisplayName(e.target.value)}
              placeholder={t('profile.displayNamePlaceholder')}
            />
          </label>
          {settings.profileState.error && <p className="ka-gate-error">{settings.profileState.error}</p>}
          {settings.profileState.success && <p className="ka-gate-success"><IconCheck size={14} /> {t('profile.saved')}</p>}
          <button className="ka-gate-submit" onClick={settings.saveProfile} disabled={settings.profileState.loading}>
            {settings.profileState.loading ? '...' : t('profile.save')}
          </button>
        </div>
      </div>

      {/* Security Section */}
      <div className="ka-settings-section">
        <h3 className="ka-settings-section-header">{t('security.heading')}</h3>
        <div className="ka-settings-section-body">
          {/* Change Email */}
          <label className="ka-settings-field">
            <span className="ka-settings-label">{t('security.changeEmail')}</span>
            <div className="ka-settings-field-row">
              <input
                className="ka-gate-input"
                type="email"
                value={settings.newEmail}
                onChange={e => settings.setNewEmail(e.target.value)}
                placeholder={t('security.emailPlaceholder')}
              />
              <button className="ka-gate-submit ka-settings-inline-btn" onClick={settings.changeEmail} disabled={settings.emailState.loading}>
                {settings.emailState.loading ? '...' : t('security.emailSubmit')}
              </button>
            </div>
          </label>
          {settings.emailState.error && <p className="ka-gate-error">{settings.emailState.error}</p>}
          {settings.emailState.success && <p className="ka-gate-success"><IconCheck size={14} /> {t('security.emailConfirmationSent')}</p>}

          {/* Change Password */}
          {(settings.hasPassword || !settings.identities.length) ? (
            <>
              <label className="ka-settings-field">
                <span className="ka-settings-label">{t('security.changePassword')}</span>
                <input
                  className="ka-gate-input"
                  type="password"
                  value={settings.newPassword}
                  onChange={e => settings.setNewPassword(e.target.value)}
                  placeholder={t('security.newPasswordPlaceholder')}
                />
              </label>
              <label className="ka-settings-field">
                <input
                  className="ka-gate-input"
                  type="password"
                  value={settings.confirmPassword}
                  onChange={e => settings.setConfirmPassword(e.target.value)}
                  placeholder={t('security.confirmPasswordPlaceholder')}
                />
              </label>
              {settings.passwordState.error && (
                <p className="ka-gate-error">
                  {settings.passwordState.error === 'tooShort' ? t('security.tooShort') :
                   settings.passwordState.error === 'mismatch' ? t('security.mismatch') :
                   settings.passwordState.error}
                </p>
              )}
              {settings.passwordState.success && <p className="ka-gate-success"><IconCheck size={14} /> {t('security.passwordChanged')}</p>}
              <button className="ka-gate-submit" onClick={settings.changePassword} disabled={settings.passwordState.loading}>
                {settings.passwordState.loading ? '...' : t('security.passwordSubmit')}
              </button>
            </>
          ) : (
            <>
              <label className="ka-settings-field">
                <span className="ka-settings-label">{t('security.setPassword')}</span>
                <input
                  className="ka-gate-input"
                  type="password"
                  value={settings.newPassword}
                  onChange={e => settings.setNewPassword(e.target.value)}
                  placeholder={t('security.newPasswordPlaceholder')}
                />
              </label>
              <label className="ka-settings-field">
                <input
                  className="ka-gate-input"
                  type="password"
                  value={settings.confirmPassword}
                  onChange={e => settings.setConfirmPassword(e.target.value)}
                  placeholder={t('security.confirmPasswordPlaceholder')}
                />
              </label>
              {settings.passwordState.error && (
                <p className="ka-gate-error">
                  {settings.passwordState.error === 'tooShort' ? t('security.tooShort') :
                   settings.passwordState.error === 'mismatch' ? t('security.mismatch') :
                   settings.passwordState.error}
                </p>
              )}
              {settings.passwordState.success && <p className="ka-gate-success"><IconCheck size={14} /> {t('security.passwordChanged')}</p>}
              <button className="ka-gate-submit" onClick={settings.changePassword} disabled={settings.passwordState.loading}>
                {settings.passwordState.loading ? '...' : t('security.passwordSubmit')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Linked Accounts */}
      <div className="ka-settings-section">
        <h3 className="ka-settings-section-header">{t('linkedAccounts.heading')}</h3>
        <div className="ka-settings-section-body">
          {PROVIDERS.map(p => {
            const identity = settings.identities.find(id => id.provider === p.id)
            const isConnected = !!identity
            const isLastIdentity = settings.identities.length <= 1
            return (
              <div key={p.id} className="ka-settings-provider-row">
                <span className="ka-settings-provider-name">{p.label}</span>
                {isConnected ? (
                  <div className="ka-settings-provider-actions">
                    <span className="ka-settings-connected"><IconCheck size={12} /> {t('linkedAccounts.connected')}</span>
                    <button
                      className="ka-settings-unlink-btn"
                      onClick={() => identity && settings.unlinkProvider(identity)}
                      disabled={isLastIdentity || settings.linkState.loading}
                      title={isLastIdentity ? t('linkedAccounts.cannotUnlinkLast') : undefined}
                    >
                      {t('linkedAccounts.disconnect')}
                    </button>
                  </div>
                ) : (
                  <button
                    className="ka-settings-link-btn"
                    onClick={() => settings.linkProvider(p.id)}
                    disabled={settings.linkState.loading}
                  >
                    {t('linkedAccounts.connect')}
                  </button>
                )}
              </div>
            )
          })}
          {settings.linkState.error && (
            <p className="ka-gate-error">
              <IconAlertCircle size={14} />
              {settings.linkState.error === 'cannotUnlinkLast' ? t('linkedAccounts.cannotUnlinkLast') : settings.linkState.error}
            </p>
          )}
          {settings.linkState.success && <p className="ka-gate-success"><IconCheck size={14} /> {t('linkedAccounts.unlinked')}</p>}
        </div>
      </div>

      {/* Subscription */}
      {!isAdmin && (
        <div className="ka-settings-section">
          <h3 className="ka-settings-section-header">{t('subscription.heading')}</h3>
          <div className="ka-settings-section-body">
            <div className="ka-settings-provider-row">
              <span className="ka-settings-provider-name">{isPro ? t('subscription.pro') : t('subscription.free')}</span>
              {isPro ? (
                <button className="ka-settings-link-btn" onClick={onManageSubscription}>{t('subscription.manage')}</button>
              ) : (
                <button className="ka-settings-link-btn ka-settings-link-btn--upgrade" onClick={onUpgrade}>{t('subscription.upgrade')}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="ka-settings-section ka-settings-section--danger">
        <h3 className="ka-settings-section-header">{t('danger.heading')}</h3>
        <div className="ka-settings-section-body">
          <button className="ka-settings-danger-btn" onClick={onSignOut}>
            <IconLogOut size={16} />
            <div>
              <span className="ka-settings-danger-label">{t('danger.signOut')}</span>
              <span className="ka-settings-danger-desc">{t('danger.signOutDesc')}</span>
            </div>
          </button>
          <button className="ka-settings-danger-btn ka-settings-danger-btn--destructive" onClick={onDeleteAccount}>
            <IconTrash size={16} />
            <div>
              <span className="ka-settings-danger-label">{t('danger.deleteAccount')}</span>
              <span className="ka-settings-danger-desc">{t('danger.deleteDesc')}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
