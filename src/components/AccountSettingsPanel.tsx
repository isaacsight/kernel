import { useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { User } from '@supabase/supabase-js'
import { useAccountSettings, type ResetScope } from '../hooks/useAccountSettings'
import { useIdentityRecovery } from '../hooks/useIdentityRecovery'
import { useAuthContext } from '../providers/AuthProvider'
import {
  IconUser, IconShield, IconCrown, IconLogOut, IconTrash, IconCheck, IconAlertCircle,
  IconMessageCircle, IconBrain, IconLink, IconTarget, IconSettings, IconDownload, IconClose,
} from './KernelIcons'
import type { ReactNode } from 'react'

const RESET_SCOPE_ICONS: Record<ResetScope, ReactNode> = {
  conversations: <IconMessageCircle size={16} />,
  memory: <IconBrain size={16} />,
  knowledge: <IconLink size={16} />,
  goals: <IconTarget size={16} />,
  preferences: <IconSettings size={16} />,
  all: <IconAlertCircle size={16} />,
}

const RESET_SCOPES: ResetScope[] = ['conversations', 'memory', 'knowledge', 'goals', 'preferences', 'all']

interface AccountSettingsPanelProps {
  user: User
  isPro: boolean
  isAdmin: boolean
  planId?: string
  onClose: () => void
  onToast: (msg: string) => void
  onUpgrade: (plan: 'pro_monthly' | 'pro_annual' | 'max_monthly' | 'max_annual') => void
  onManageSubscription: () => void
  onSignOut: () => void
  onDeleteAccount: () => void
}

export default function AccountSettingsPanel({
  user, isPro, isAdmin, planId, onClose, onToast, onUpgrade, onManageSubscription, onSignOut, onDeleteAccount,
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

  // ─── Identity Governance ──────────────────────────
  const identity = useIdentityRecovery()
  const [verificationCode, setVerificationCode] = useState('')

  const isVerified = identity.request?.state === 'verified' || identity.request?.state === 'executed'
  const isChallenged = identity.request?.state === 'challenged'

  const handleSendCode = useCallback(async () => {
    const req = await identity.initiate('password_reset')
    if (req) {
      await identity.sendChallenge(req.requestId)
    }
  }, [identity])

  const handleVerifyCode = useCallback(async () => {
    if (!identity.request || !verificationCode.trim()) return
    const ok = await identity.verify(identity.request.requestId, verificationCode.trim())
    if (ok) setVerificationCode('')
  }, [identity, verificationCode])

  // Resend creates a fresh request (old one auto-revoked via supersession)
  const handleResendCode = handleSendCode

  const initials = (settings.displayName || user.email || '?')
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('')

  const isMax = planId?.startsWith('max_') ?? false
  const tierLabel = isAdmin ? t('subscription.admin') : isMax ? t('subscription.max') : isPro ? t('subscription.pro') : t('subscription.free')

  return (
    <div className="ka-settings-panel">
      <div className="ka-settings-panel-header">
        <h2 className="ka-panel-title">{t('title')}</h2>
        <button className="ka-project-panel-close" onClick={onClose} aria-label={t('close', { ns: 'common' })}>
          <IconClose size={16} />
        </button>
      </div>

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
          <span className={`ka-settings-tier-badge${isAdmin ? ' ka-settings-tier-badge--admin' : isMax ? ' ka-settings-tier-badge--max' : isPro ? ' ka-settings-tier-badge--pro' : ''}`}>
            {isAdmin ? <IconShield size={12} /> : isPro ? <IconCrown size={12} /> : <IconUser size={12} />}
            {tierLabel}
          </span>
        </div>
      </div>

      {/* Verify Identity */}
      <div className="ka-settings-section">
        <h3 className="ka-settings-section-header">{t('security.heading')}</h3>
        <div className="ka-settings-section-body">
          {!isVerified ? (
            <div className="ka-settings-verify-block">
              <span className="ka-settings-label">{t('security.verifyIdentity')}</span>
              <p className="ka-settings-verify-hint">{t('security.verifyHint')}</p>

              {!isChallenged ? (
                <button className="ka-gate-submit" onClick={handleSendCode} disabled={identity.loading}>
                  {identity.loading ? '...' : t('security.sendCode')}
                </button>
              ) : (
                <>
                  <p className="ka-gate-success" style={{ margin: '4px 0 8px' }}>
                    <IconCheck size={14} /> {t('security.codeSent')}
                  </p>
                  <input
                    className="ka-gate-input"
                    type="text"
                    inputMode="numeric"
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value)}
                    placeholder={t('security.codePlaceholder')}
                    autoComplete="one-time-code"
                  />
                  <button
                    className="ka-gate-submit"
                    onClick={handleVerifyCode}
                    disabled={identity.loading || !verificationCode.trim()}
                  >
                    {identity.loading ? '...' : t('security.verify')}
                  </button>
                  <div className="ka-settings-resend-row">
                    <button
                      className="ka-settings-text-btn"
                      onClick={handleResendCode}
                      disabled={identity.cooldown > 0 || identity.loading}
                    >
                      {identity.cooldown > 0
                        ? t('security.resendIn', { seconds: identity.cooldown })
                        : t('security.resendCode')}
                    </button>
                  </div>
                </>
              )}

              {identity.error && <p className="ka-gate-error">{identity.error}</p>}
            </div>
          ) : (
            <div className="ka-settings-verify-block ka-settings-verify-block--active">
              <p className="ka-gate-success" style={{ margin: 0 }}>
                <IconCheck size={14} /> {t('security.verified')}
              </p>
            </div>
          )}
        </div>
      </div>

      {isVerified && (
        <>
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
                {settings.displayNameAvailable === false && (
                  <p className="ka-gate-error ka-settings-availability">{t('profile.displayNameTaken')}</p>
                )}
                {settings.displayNameAvailable === true && (
                  <p className="ka-gate-success ka-settings-availability"><IconCheck size={12} /> {t('profile.available')}</p>
                )}
              </label>
              <label className="ka-settings-field">
                <span className="ka-settings-label">{t('profile.username')}</span>
                <input
                  className="ka-gate-input"
                  type="text"
                  value={settings.username}
                  onChange={e => settings.setUsername(e.target.value)}
                  placeholder={t('profile.usernamePlaceholder')}
                />
                {settings.usernameAvailable === false && (
                  <p className="ka-gate-error ka-settings-availability">{t('profile.usernameTaken')}</p>
                )}
                {settings.usernameAvailable === true && (
                  <p className="ka-gate-success ka-settings-availability"><IconCheck size={12} /> {t('profile.available')}</p>
                )}
              </label>
              {settings.profileState.error && (
                <p className="ka-gate-error">
                  {settings.profileState.error === 'username_taken' ? t('profile.usernameTaken') :
                   settings.profileState.error === 'display_name_taken' ? t('profile.displayNameTaken') :
                   settings.profileState.error}
                </p>
              )}
              {settings.profileState.success === 'saved' && <p className="ka-gate-success"><IconCheck size={14} /> {t('profile.saved')}</p>}
              {settings.profileState.success === 'profileReset' && <p className="ka-gate-success"><IconCheck size={14} /> {t('profile.profileReset')}</p>}
              <div className="ka-settings-btn-row">
                <button className="ka-gate-submit" onClick={settings.saveProfile} disabled={settings.profileState.loading || settings.usernameAvailable === false || settings.displayNameAvailable === false}>
                  {settings.profileState.loading ? '...' : t('profile.save')}
                </button>
                {(settings.displayName || settings.username || settings.avatarUrl) && (
                  <button
                    className="ka-settings-text-btn"
                    onClick={settings.resetProfile}
                    disabled={settings.profileState.loading}
                  >
                    {t('profile.resetProfile')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Email & Password */}
          <div className="ka-settings-section">
            <h3 className="ka-settings-section-header">{t('security.credentialsHeading')}</h3>
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

              {/* Change / Set Password */}
              <label className="ka-settings-field">
                <span className="ka-settings-label">{settings.hasPassword ? t('security.changePassword') : t('security.setPassword')}</span>
                <input
                  className="ka-gate-input"
                  type="password"
                  value={settings.newPassword}
                  onChange={e => settings.setNewPassword(e.target.value)}
                  placeholder={t('security.newPasswordPlaceholder')}
                  autoComplete="new-password"
                />
              </label>

              {/* Password Strength Indicator */}
              {settings.passwordStrength !== 'none' && (
                <div className="ka-settings-strength">
                  <div className="ka-settings-strength-bar">
                    <div className={`ka-settings-strength-fill ka-settings-strength-fill--${settings.passwordStrength}`} />
                  </div>
                  <span className={`ka-settings-strength-label ka-settings-strength-label--${settings.passwordStrength}`}>
                    {t(`security.strength.${settings.passwordStrength}`)}
                  </span>
                </div>
              )}

              <label className="ka-settings-field">
                <input
                  className="ka-gate-input"
                  type="password"
                  value={settings.confirmPassword}
                  onChange={e => settings.setConfirmPassword(e.target.value)}
                  placeholder={t('security.confirmPasswordPlaceholder')}
                  autoComplete="new-password"
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
            </div>
          </div>
        </>
      )}


      {/* Subscription */}
      {!isAdmin && (
        <div className="ka-settings-section">
          <h3 className="ka-settings-section-header">{t('subscription.heading')}</h3>
          <div className="ka-settings-section-body">
            <span className="ka-settings-provider-name">{isMax ? t('subscription.max') : isPro ? t('subscription.pro') : t('subscription.free')}</span>
            {(isPro || isMax) && (
              <button className="ka-settings-link-btn" onClick={onManageSubscription} style={{ marginTop: 8 }}>{t('subscription.manage')}</button>
            )}
            {!isPro && !isMax && (
              <div className="ka-plan-grid" style={{ padding: '12px 0 0' }}>
                <button className="ka-plan-card" onClick={() => onUpgrade('pro_monthly')}>
                  <span className="ka-plan-card-name">Pro</span>
                  <span className="ka-plan-card-price">$39<span className="ka-plan-card-period">/mo</span></span>
                </button>
                <button className="ka-plan-card" onClick={() => onUpgrade('pro_annual')}>
                  <span className="ka-plan-card-name">Pro</span>
                  <span className="ka-plan-card-price">$390<span className="ka-plan-card-period">/yr</span></span>
                  <span className="ka-plan-card-badge">Save 17%</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Data */}
      <div className="ka-settings-section">
        <h3 className="ka-settings-section-header">{t('exportData.heading')}</h3>
        <div className="ka-settings-section-body">
          <p className="ka-settings-section-desc">{t('exportData.description')}</p>
          <button
            className="ka-gate-submit"
            onClick={settings.exportData}
            disabled={settings.exportState.loading}
          >
            <IconDownload size={16} />
            {settings.exportState.loading ? '...' : t('exportData.button')}
          </button>
          {settings.exportState.error && (
            <p className="ka-gate-error">
              <IconAlertCircle size={14} />{' '}
              {settings.exportState.error.startsWith('rateLimited:')
                ? t('exportData.rateLimited', { hours: settings.exportState.error.split(':')[1] })
                : settings.exportState.error}
            </p>
          )}
          {settings.exportState.success && (
            <p className="ka-gate-success"><IconCheck size={14} /> {t('exportData.success')}</p>
          )}
        </div>
      </div>

      {/* Reset Data */}
      <div className="ka-settings-section ka-settings-section--warning">
        <h3 className="ka-settings-section-header">{t('resetData.heading')}</h3>
        <p className="ka-settings-section-desc">{t('resetData.description')}</p>
        <div className="ka-settings-section-body">
          {RESET_SCOPES.map(scope => (
            <div key={scope} className="ka-settings-reset-item">
              {settings.resetConfirmScope === scope ? (
                <div className="ka-settings-reset-confirm">
                  <p className="ka-settings-reset-confirm-text">{t(`resetData.confirm.${scope}`)}</p>
                  <div className="ka-settings-reset-confirm-actions">
                    <button
                      className="ka-settings-danger-btn ka-settings-danger-btn--sm"
                      onClick={async () => {
                        const deleted = await settings.resetUserData(scope)
                        if (deleted) {
                          onToast(t('resetData.success', { scope: t(`resetData.scopes.${scope}`) }))
                        }
                      }}
                      disabled={settings.resetState.loading}
                    >
                      {settings.resetState.loading ? '...' : t('resetData.confirmBtn')}
                    </button>
                    <button
                      className="ka-settings-text-btn"
                      onClick={() => settings.setResetConfirmScope(null)}
                      disabled={settings.resetState.loading}
                    >
                      {t('resetData.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className={`ka-settings-reset-btn${scope === 'all' ? ' ka-settings-reset-btn--all' : ''}`}
                  onClick={() => settings.setResetConfirmScope(scope)}
                  disabled={settings.resetState.loading}
                >
                  <span className="ka-settings-reset-icon">{RESET_SCOPE_ICONS[scope]}</span>
                  <div className="ka-settings-reset-info">
                    <span className="ka-settings-reset-name">{t(`resetData.scopes.${scope}`)}</span>
                    <span className="ka-settings-reset-desc">{t(`resetData.scopeDesc.${scope}`)}</span>
                  </div>
                </button>
              )}
            </div>
          ))}
          {settings.resetState.error && <p className="ka-gate-error"><IconAlertCircle size={14} /> {settings.resetState.error}</p>}
          {settings.resetState.success && <p className="ka-gate-success"><IconCheck size={14} /> {t('resetData.done')}</p>}
        </div>
      </div>

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
