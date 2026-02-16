import { useState } from 'react';
import { useAuthContext } from '../../providers/AuthProvider';
import { getAccessToken } from '../../engine/SupabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || '';
const PRICE_ID = import.meta.env.VITE_STRIPE_KERNEL_PRICE_ID || '';

export function KernelAgentGate() {
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
        setError('Unable to start checkout. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="kernel-gate">
        <div className="kernel-gate-card">
          <div className="kernel-gate-icon">K</div>
          <h2 className="kernel-gate-title">Subscribe</h2>
          <p className="kernel-gate-price">$20<span>/month</span></p>
          <p className="kernel-gate-desc">
            Signed in as {user.email}. Subscribe to unlock Chat and Control.
          </p>
          <div className="kernel-gate-features">
            <div className="kernel-gate-feature"><span className="kernel-gate-check">&check;</span> Conversational engine analysis</div>
            <div className="kernel-gate-feature"><span className="kernel-gate-check">&check;</span> Real-time belief management</div>
            <div className="kernel-gate-feature"><span className="kernel-gate-check">&check;</span> Conviction steering</div>
            <div className="kernel-gate-feature"><span className="kernel-gate-check">&check;</span> Unlimited messages</div>
          </div>
          <button className="kernel-gate-submit" onClick={handleSubscribe} disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Loading...' : 'Subscribe — $20/mo'}
          </button>
          {error && <p className="kernel-gate-error">{error}</p>}
          <button className="kernel-gate-admin-toggle" onClick={() => refreshSubscription()}>
            Refresh status
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
      setError('Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kernel-gate">
      <div className="kernel-gate-card">
        <div className="kernel-gate-icon">K</div>
        <h2 className="kernel-gate-title">Kernel Agent</h2>
        <p className="kernel-gate-price">$20<span>/month</span></p>
        <p className="kernel-gate-desc">
          Sign in to access Chat and Control.
        </p>

        <div className="kernel-gate-social">
          <button className="kernel-gate-social-btn" onClick={() => signInWithProvider('google')}>Continue with Google</button>
          <button className="kernel-gate-social-btn" onClick={() => signInWithProvider('github')}>Continue with GitHub</button>
        </div>

        <div className="kernel-gate-divider"><span>or</span></div>

        <form className="kernel-gate-form" onSubmit={handleEmailAuth} style={{ flexDirection: 'column', gap: 8 }}>
          <input type="email" className="kernel-gate-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
          <input type="password" className="kernel-gate-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
          <button type="submit" className="kernel-gate-submit" disabled={loading || !email.trim() || !password.trim()}>
            {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <button className="kernel-gate-admin-toggle" onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>

        {error && <p className="kernel-gate-error">{error}</p>}

        <p className="kernel-gate-free">The Observer tab is free.</p>
      </div>
    </div>
  );
}
