import { useRef, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { User } from '@supabase/supabase-js'
import { useAccountSettings, type ResetScope } from '../hooks/useAccountSettings'
import { useIdentityRecovery } from '../hooks/useIdentityRecovery'
import { useApiKeys, type ApiKey } from '../hooks/useApiKeys'
import { useAuthContext } from '../providers/AuthProvider'
import {
  IconUser, IconShield, IconCrown, IconLogOut, IconTrash, IconCheck, IconAlertCircle,
  IconMessageCircle, IconBrain, IconLink, IconTarget, IconSettings, IconDownload, IconClose,
  IconCopy, IconRefresh, IconPlus, IconEye,
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

  // ─── API Keys ────────────────────────────────────
  const apiKeys = useApiKeys()
  const [newKeyName, setNewKeyName] = useState('')
  const [showApiKeys, setShowApiKeys] = useState(false)
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [apiCheckoutLoading, setApiCheckoutLoading] = useState(false)

  useEffect(() => {
    if (showApiKeys && apiKeys.keys.length === 0 && !apiKeys.loading) {
      apiKeys.fetchKeys()
    }
  }, [showApiKeys]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleApiUpgrade = useCallback(async (tier: 'pro' | 'growth') => {
    setApiCheckoutLoading(true)
    try {
      const { supabase } = await import('../engine/SupabaseClient')
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
      const supabaseKey = import.meta.env.VITE_SUPABASE_KEY as string

      // Force a fresh session — this handles expired JWTs
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession()
      if (sessionError || !session?.access_token) {
        onToast('Session expired. Please sign in again.')
        return
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: supabaseKey,
        },
        body: JSON.stringify({
          type: 'api',
          api_tier: tier,
          mode: 'subscription',
          success_url: `${window.location.origin}${window.location.pathname}#/?checkout=complete`,
          cancel_url: window.location.href,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        console.error('[API Checkout] Error:', res.status, text)
        let msg = `Checkout failed (${res.status})`
        try {
          const data = JSON.parse(text)
          msg = data?.error || data?.message || data?.details || msg
        } catch { /* not JSON */ }
        throw new Error(msg)
      }
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (err) {
      console.error('[API Checkout] Exception:', err)
      onToast(err instanceof Error && err.message !== 'Failed to fetch'
        ? err.message
        : 'Checkout failed. Please try again.')
    } finally {
      setApiCheckoutLoading(false)
    }
  }, [onToast])

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
  const tierLabel = isAdmin ? t('subscription.admin') : isMax ? 'Growth' : isPro ? t('subscription.pro') : t('subscription.free')

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


      {/* ═══ Plan & Billing (Unified) ═══ */}
      <div className="ka-settings-section">
        <h3 className="ka-settings-section-header">Plan & Billing</h3>
        <div className="ka-settings-section-body">

          {/* ── Current Plans ── */}
          <div className="ka-billing-plans-row">
            <div className={`ka-billing-plan-current${isPro || isMax || isAdmin ? ' ka-billing-plan-current--active' : ''}`}>
              <div className="ka-billing-plan-header">
                <IconMessageCircle size={16} />
                <span className="ka-billing-plan-label">Chat</span>
                <span className={`ka-billing-tier-pill ka-billing-tier-pill--${isAdmin ? 'admin' : isMax ? 'max' : isPro ? 'pro' : 'free'}`}>
                  {isAdmin ? 'Admin' : isMax ? 'Growth' : isPro ? 'Pro' : 'Free'}
                </span>
              </div>
              {!isAdmin && !isPro && !isMax && (
                <span className="ka-billing-plan-upgrade-hint">20 msgs/day</span>
              )}
              {isPro && !isMax && (
                <span className="ka-billing-plan-upgrade-hint">1,500 msgs/mo</span>
              )}
              {isMax && (
                <span className="ka-billing-plan-upgrade-hint">10,000 msgs/mo</span>
              )}
            </div>
            <div className={`ka-billing-plan-current${(apiKeys.keys.length > 0 && apiKeys.keys[0]?.tier !== 'free') ? ' ka-billing-plan-current--active' : ''}`}>
              <div className="ka-billing-plan-header">
                <IconShield size={16} />
                <span className="ka-billing-plan-label">API</span>
                <span className={`ka-billing-tier-pill ka-billing-tier-pill--${apiKeys.keys.length > 0 ? (apiKeys.keys[0]?.tier || 'free') : 'free'}`}>
                  {apiKeys.keys.length > 0 ? (apiKeys.keys[0]?.tier || 'Free') : 'Free'}
                </span>
              </div>
              {apiKeys.keys.length > 0 && apiKeys.keys[0]?.monthly_message_limit > 0 && (
                <>
                  <div className="ka-billing-plan-usage-text">
                    {apiKeys.keys[0].monthly_message_count} / {apiKeys.keys[0].monthly_message_limit} msgs
                  </div>
                  <div className="ka-billing-usage-bar">
                    <div
                      className={`ka-billing-usage-fill${
                        (apiKeys.keys[0].monthly_message_count / apiKeys.keys[0].monthly_message_limit) > 0.9 ? ' ka-billing-usage-fill--critical' :
                        (apiKeys.keys[0].monthly_message_count / apiKeys.keys[0].monthly_message_limit) > 0.7 ? ' ka-billing-usage-fill--warning' : ''
                      }`}
                      style={{ width: `${Math.min(100, (apiKeys.keys[0].monthly_message_count / apiKeys.keys[0].monthly_message_limit) * 100)}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Manage Billing */}
          {(isPro || isMax) && (
            <button className="ka-billing-manage-btn" onClick={onManageSubscription}>
              <IconSettings size={14} />
              Manage Billing
            </button>
          )}

          {/* ── Upgrade Cards (Chat) ── */}
          {!isAdmin && (
            <>
              {!isPro && !isMax && (
                <>
                  <span className="ka-billing-upgrade-label">Upgrade Chat</span>
                  <div className="ka-billing-upgrade-grid">
                    <button className="ka-billing-upgrade-card" onClick={() => onUpgrade('pro_monthly')}>
                      <div className="ka-billing-upgrade-card-top">
                        <span className="ka-billing-upgrade-card-name">Pro</span>
                        <span className="ka-billing-upgrade-card-badge">Recommended</span>
                      </div>
                      <span className="ka-billing-upgrade-card-price">$39<span>/mo</span></span>
                      <ul className="ka-billing-upgrade-card-features">
                        <li>1,500 messages/mo</li>
                        <li>Extended thinking & voice</li>
                        <li>File & image analysis</li>
                      </ul>
                      <span className="ka-billing-upgrade-card-cta">Get Pro</span>
                    </button>
                  </div>
                </>
              )}
              {!isMax && (
                <>
                  <span className="ka-billing-upgrade-label">{isPro ? 'Upgrade to Growth' : 'Or go Growth'}</span>
                  <div className="ka-billing-upgrade-grid">
                    <button className="ka-billing-upgrade-card ka-billing-upgrade-card--max" onClick={() => onUpgrade('max_monthly')}>
                      <div className="ka-billing-upgrade-card-top">
                        <span className="ka-billing-upgrade-card-name">Growth</span>
                        {isPro && <span className="ka-billing-upgrade-card-badge">Recommended</span>}
                      </div>
                      <span className="ka-billing-upgrade-card-price">$249<span>/mo</span></span>
                      <ul className="ka-billing-upgrade-card-features">
                        <li>10,000 messages/mo</li>
                        <li>All agents + swarm</li>
                        <li>120 req/min rate limit</li>
                      </ul>
                      <span className="ka-billing-upgrade-card-cta">Get Growth</span>
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── Quick Start + API Keys (Pro+ only) ── */}
          {(isPro || isMax || isAdmin) ? (
            <>
              {/* Quick Start (promoted — visible without expanding API Keys) */}
              <div className="ka-billing-quickstart">
                <span className="ka-billing-quickstart-label">Quick Start</span>
                <div className="ka-billing-quickstart-steps">
                  <code className="ka-billing-code-block">npm install -g kbot</code>
                  <code className="ka-billing-code-block">kbot auth</code>
                  <span className="ka-billing-quickstart-hint">Paste your API key when prompted, then:</span>
                  <code className="ka-billing-code-block">kbot &quot;build me a React app&quot;</code>
                </div>
                <span className="ka-billing-quickstart-or">Or use the REST API directly:</span>
                <code className="ka-billing-code-block">{'curl -X POST https://kernel.chat/api/chat \\\n  -H "Authorization: Bearer kn_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"message": "Hello"}\''}</code>
              </div>

              {/* API Keys (collapsible) */}
              <div
                className="ka-billing-api-toggle"
                onClick={() => setShowApiKeys(v => !v)}
                role="button"
                tabIndex={0}
              >
                <IconShield size={14} />
                <span>API Keys</span>
                <span className={`ka-api-keys-chevron${showApiKeys ? ' ka-api-keys-chevron--open' : ''}`}>▸</span>
              </div>

              {showApiKeys && (
                <div className="ka-billing-api-body">
              {/* New key banner */}
              {apiKeys.newKey && (
                <div className="ka-api-keys-banner">
                  <p className="ka-api-keys-banner-text">
                    Copy your key now — it won't be shown again.
                  </p>
                  <div className="ka-api-keys-banner-key">
                    <code className="ka-api-keys-secret">{apiKeys.newKey}</code>
                    <button
                      className="ka-api-keys-copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(apiKeys.newKey!)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      }}
                    >
                      {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                    </button>
                  </div>
                  <button className="ka-settings-text-btn" onClick={() => { apiKeys.clearNewKey(); setCopied(false) }}>
                    Dismiss
                  </button>
                </div>
              )}

              {/* Key list */}
              {apiKeys.keys.length > 0 ? (
                <div className="ka-api-keys-list">
                  {apiKeys.keys.map((k: ApiKey) => {
                    const usagePct = k.monthly_message_limit > 0 ? k.monthly_message_count / k.monthly_message_limit : 0
                    return (
                      <div key={k.id} className={`ka-api-keys-item${k.status === 'revoked' ? ' ka-api-keys-item--revoked' : ''}`}>
                        <div className="ka-api-keys-item-header">
                          <span className="ka-api-keys-name">{k.name}</span>
                          <span className={`ka-api-keys-tier ka-api-keys-tier--${k.tier}`}>{k.tier}</span>
                          {k.status === 'revoked' && <span className="ka-api-keys-revoked">revoked</span>}
                        </div>
                        <code className="ka-api-keys-prefix">{k.key_prefix}...</code>
                        <div className="ka-api-keys-meta">
                          <span>{k.monthly_message_count}/{k.monthly_message_limit} msgs</span>
                          {k.last_used_at && (
                            <span>Last used {new Date(k.last_used_at).toLocaleDateString()}</span>
                          )}
                          {k.monthly_message_limit > 0 && (
                            <span className={`ka-api-keys-meta-pct${usagePct > 0.9 ? ' ka-api-keys-meta-pct--critical' : usagePct > 0.7 ? ' ka-api-keys-meta-pct--warning' : ''}`}>
                              {Math.round(usagePct * 100)}%
                            </span>
                          )}
                        </div>
                        {k.monthly_message_limit > 0 && (
                          <div className="ka-billing-usage-bar ka-billing-usage-bar--key">
                            <div
                              className={`ka-billing-usage-fill${usagePct > 0.9 ? ' ka-billing-usage-fill--critical' : usagePct > 0.7 ? ' ka-billing-usage-fill--warning' : ''}`}
                              style={{ width: `${Math.min(100, usagePct * 100)}%` }}
                            />
                          </div>
                        )}
                        {k.status === 'active' && (
                          <div className="ka-api-keys-actions">
                            {revokeConfirmId === k.id ? (
                              <div className="ka-api-keys-confirm">
                                <span>Revoke this key?</span>
                                <button
                                  className="ka-settings-danger-btn ka-settings-danger-btn--sm"
                                  onClick={() => { apiKeys.revokeKey(k.id); setRevokeConfirmId(null) }}
                                  disabled={apiKeys.loading}
                                >
                                  Confirm
                                </button>
                                <button
                                  className="ka-settings-text-btn"
                                  onClick={() => setRevokeConfirmId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  className="ka-api-keys-action-btn"
                                  onClick={() => apiKeys.rotateKey(k.id)}
                                  disabled={apiKeys.loading}
                                  title="Rotate key"
                                >
                                  <IconRefresh size={14} /> Rotate
                                </button>
                                <button
                                  className="ka-api-keys-action-btn ka-api-keys-action-btn--danger"
                                  onClick={() => setRevokeConfirmId(k.id)}
                                  disabled={apiKeys.loading}
                                  title="Revoke key"
                                >
                                  <IconTrash size={14} /> Revoke
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : !apiKeys.loading ? (
                <p className="ka-api-keys-empty">No API keys yet.</p>
              ) : null}

              {/* Create new key */}
              {apiKeys.keys.filter(k => k.status === 'active').length < 5 && (
                <div className="ka-api-keys-create">
                  <input
                    className="ka-gate-input"
                    type="text"
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    placeholder="Key name (e.g. My App)"
                    maxLength={64}
                  />
                  <button
                    className="ka-gate-submit ka-settings-inline-btn"
                    onClick={() => {
                      apiKeys.createKey(newKeyName.trim() || 'Default')
                      setNewKeyName('')
                    }}
                    disabled={apiKeys.loading}
                  >
                    <IconPlus size={14} /> Create Key
                  </button>
                </div>
              )}

              {/* API Tier Upgrade */}
              <div className="ka-api-keys-upgrade">
                <span className="ka-api-keys-upgrade-label">API Plans</span>
                <div className="ka-api-keys-tier-cards">
                  <div className="ka-api-keys-tier-card">
                    <span className="ka-api-keys-tier-card-name">Free</span>
                    <span className="ka-api-keys-tier-card-price">$0</span>
                    <span className="ka-api-keys-tier-card-detail">50 msgs/mo</span>
                    <span className="ka-api-keys-tier-card-detail">10/min rate</span>
                  </div>
                  <button
                    className="ka-api-keys-tier-card ka-api-keys-tier-card--active"
                    onClick={() => handleApiUpgrade('pro')}
                    disabled={apiCheckoutLoading}
                  >
                    <span className="ka-api-keys-tier-card-name">Pro</span>
                    <span className="ka-api-keys-tier-card-price">$39<span>/mo</span></span>
                    <span className="ka-api-keys-tier-card-detail">1,500 msgs/mo</span>
                    <span className="ka-api-keys-tier-card-detail">All agents + swarm</span>
                    <span className="ka-api-keys-tier-card-detail">$0.03/msg overage</span>
                  </button>
                  <button
                    className="ka-api-keys-tier-card ka-api-keys-tier-card--active"
                    onClick={() => handleApiUpgrade('growth')}
                    disabled={apiCheckoutLoading}
                  >
                    <span className="ka-api-keys-tier-card-name">Growth</span>
                    <span className="ka-api-keys-tier-card-price">$249<span>/mo</span></span>
                    <span className="ka-api-keys-tier-card-detail">10,000 msgs/mo</span>
                    <span className="ka-api-keys-tier-card-detail">All agents + swarm</span>
                    <span className="ka-api-keys-tier-card-detail">$0.025/msg overage</span>
                  </button>
                </div>
              </div>

              {apiKeys.error && (
                <p className="ka-gate-error"><IconAlertCircle size={14} /> {apiKeys.error}</p>
              )}
              {apiKeys.loading && <p className="ka-api-keys-loading">Loading...</p>}
            </div>
          )}
            </>
          ) : (
            <div className="ka-billing-api-locked">
              <IconShield size={16} />
              <span>API access is available on Pro and above.</span>
            </div>
          )}
        </div>
      </div>

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
