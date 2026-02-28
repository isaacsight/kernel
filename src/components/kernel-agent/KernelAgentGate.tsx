import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../../providers/AuthProvider';
import { getAccessToken } from '../../engine/SupabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || '';
const PRICE_ID = import.meta.env.VITE_STRIPE_KERNEL_PRICE_ID || '';

export function KernelAgentGate() {
  const { t } = useTranslation('auth');
  const { user, isAuthenticated, signInWithProvider, signInWithEmail, signUpWithEmail, refreshSubscription } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  // If authenticated but not subscribed, show subscribe gate
  if (isAuthenticated && user) {
    const handleSubscribe = async () => {
      if (!user.email) return;
      setLoading(true);
      setError('');
      try {
        const token = await getAccessToken();
        const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_KEY,
          },
          body: JSON.stringify({
            mode: 'subscription',
            price_id: PRICE_ID,
            success_url: `${window.location.origin}${window.location.pathname}#/?checkout=complete`,
            cancel_url: window.location.href,
          }),
        });
        if (!res.ok) throw new Error('Failed to create checkout session');
        const { url } = await res.json();
        if (url) window.location.href = url;
      } catch {
        setError(t('subscription.checkoutError'));
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="kernel-gate">
        <div className="kernel-gate-card">
          <div className="kernel-gate-icon">K</div>
          <h2 className="kernel-gate-title">{t('kernelGate.subscribe')}</h2>
          <p className="kernel-gate-price">{t('subscription.price')}<span>{t('subscription.pricePeriod')}</span></p>
          <p className="kernel-gate-desc">
            {t('kernelGate.signedInAs', { email: user.email })}
          </p>
          <div className="kernel-gate-features">
            <div className="kernel-gate-feature"><span className="kernel-gate-check">&check;</span> {t('kernelGate.feature2')}</div>
            <div className="kernel-gate-feature"><span className="kernel-gate-check">&check;</span> {t('kernelGate.feature3')}</div>
            <div className="kernel-gate-feature"><span className="kernel-gate-check">&check;</span> {t('kernelGate.feature4')}</div>
          </div>
          <button className="kernel-gate-submit" onClick={handleSubscribe} disabled={loading} style={{ width: '100%' }}>
            {loading ? t('loading', { ns: 'common' }) : t('kernelGate.button')}
          </button>
          {error && <p className="kernel-gate-error">{error}</p>}
          <button className="kernel-gate-admin-toggle" onClick={() => refreshSubscription()}>
            {t('kernelGate.refreshStatus')}
          </button>
        </div>
      </div>
    );
  }

  // Not authenticated: show login
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = isSignUp
        ? await signUpWithEmail(email.trim(), password)
        : await signInWithEmail(email.trim(), password);
      if (result.error) setError(result.error);
    } catch {
      setError(t('kernelGate.authFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kernel-gate">
      <div className="kernel-gate-card">
        <div className="kernel-gate-icon">K</div>
        <h2 className="kernel-gate-title">{t('kernelGate.loginTitle')}</h2>
        <p className="kernel-gate-price">{t('subscription.price')}<span>{t('subscription.pricePeriod')}</span></p>
        <p className="kernel-gate-desc">
          {t('kernelGate.loginDesc')}
        </p>

        <div className="kernel-gate-social">
          <button className="kernel-gate-social-btn" onClick={async () => { const r = await signInWithProvider('google'); if (r.error) setError(r.error) }}>{t('modal.continueGoogle')}</button>
          <button className="kernel-gate-social-btn" onClick={async () => { const r = await signInWithProvider('github'); if (r.error) setError(r.error) }}>{t('modal.continueGitHub')}</button>
        </div>

        <div className="kernel-gate-divider"><span>{t('or', { ns: 'common' })}</span></div>

        <form className="kernel-gate-form" onSubmit={handleEmailAuth} style={{ flexDirection: 'column', gap: 8 }}>
          <input type="email" className="kernel-gate-input" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('modal.emailPlaceholder')} required />
          <input type="password" className="kernel-gate-input" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('modal.passwordPlaceholder')} required />
          <button type="submit" className="kernel-gate-submit" disabled={loading || !email.trim() || !password.trim()}>
            {loading ? t('loading', { ns: 'common' }) : isSignUp ? t('modal.createAccount') : t('modal.signIn')}
          </button>
        </form>

        <button className="kernel-gate-admin-toggle" onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp
            ? `${t('modal.toggleSignInLabel')} ${t('modal.toggleSignInAction')}`
            : `${t('modal.toggleSignUpLabel')} ${t('modal.toggleSignUpAction')}`}
        </button>

        {error && <p className="kernel-gate-error">{error}</p>}

        <p className="kernel-gate-free">{t('kernelGate.observerFree')}</p>
      </div>
    </div>
  );
}
