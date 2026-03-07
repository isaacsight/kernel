import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../../providers/AuthProvider';

export function KernelAgentGate() {
  const { t } = useTranslation('auth');
  const { signInWithProvider, signInWithEmail, signUpWithEmail } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

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
        <p className="kernel-gate-desc">
          Sign in to start using the Kernel. Pay only for what you use.
        </p>

        <div className="kernel-gate-social">
          <button className="kernel-gate-social-btn" onClick={() => signInWithProvider('google')}>{t('modal.continueGoogle')}</button>
          <button className="kernel-gate-social-btn" onClick={() => signInWithProvider('github')}>{t('modal.continueGitHub')}</button>
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
      </div>
    </div>
  );
}
