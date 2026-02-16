import { useState, useEffect, useCallback } from 'react';
import { supabase, getMySubscription } from '../engine/SupabaseClient';
import type { User, Session, Provider } from '@supabase/supabase-js';

const ADMIN_HASH = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
const ADMIN_KEY = 'kernel-admin-token';

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSubscribed: boolean;
  isAdmin: boolean;

  signInWithProvider: (provider: Provider) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  activateAdmin: (passphrase: string) => Promise<boolean>;
  refreshSubscription: () => Promise<boolean>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      return localStorage.getItem(ADMIN_KEY) === 'active';
    } catch {
      return false;
    }
  });

  const checkSubscription = useCallback(async (): Promise<boolean> => {
    if (isAdmin) return true;
    const sub = await getMySubscription();
    const active = sub?.status === 'active';
    setIsSubscribed(active);
    return active;
  }, [isAdmin]);

  // Initialize auth — handle PKCE callback + existing session
  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams(window.location.search);
    const hasCode = params.has('code');
    const hasError = params.has('error');

    // Log for debugging
    console.log('[Auth] init — code:', hasCode, 'error:', hasError, 'url:', window.location.href);

    // Clean error params
    if (hasError) {
      console.warn('[Auth] OAuth error:', params.get('error'), params.get('error_description'));
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }

    // If there's a PKCE code, let the Supabase client handle the exchange
    // automatically via _initialize(), then getSession() will return the result.
    // We just need to clean up the URL after.
    if (hasCode) {
      console.log('[Auth] PKCE code detected, exchanging...');
      supabase.auth.exchangeCodeForSession(params.get('code')!)
        .then(({ data, error }) => {
          if (!mounted) return;
          if (error) {
            console.error('[Auth] Code exchange failed:', error.message);
            // Fall through to getSession which may pick up auto-exchanged session
          } else {
            console.log('[Auth] Code exchange success, user:', data.session?.user?.email);
            setSession(data.session);
            setUser(data.session.user);
            checkSubscription().finally(() => { if (mounted) setIsLoading(false); });
          }
          // Clean ?code= from URL
          window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        })
        .catch(() => {
          // Auto-exchange may have already handled it, try getSession
          if (!mounted) return;
          console.log('[Auth] Exchange threw, trying getSession fallback...');
          supabase.auth.getSession().then(({ data: { session: s } }) => {
            if (!mounted) return;
            setSession(s);
            setUser(s?.user ?? null);
            if (s?.user) {
              checkSubscription().finally(() => { if (mounted) setIsLoading(false); });
            } else {
              setIsLoading(false);
            }
          });
          window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        });
    } else {
      // Normal load — check for existing session
      supabase.auth.getSession()
        .then(({ data: { session: s } }) => {
          if (!mounted) return;
          console.log('[Auth] getSession:', s?.user?.email ?? 'no session');
          setSession(s);
          setUser(s?.user ?? null);
          if (s?.user) {
            checkSubscription().finally(() => { if (mounted) setIsLoading(false); });
          } else {
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (!mounted) return;
          console.error('[Auth] getSession error:', err);
          setIsLoading(false);
        });
    }

    // Listen for auth state changes (handles token refresh, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      console.log('[Auth] onAuthStateChange:', event, s?.user?.email ?? 'no user');
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        checkSubscription();
      } else {
        setIsSubscribed(false);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkSubscription]);

  const signInWithProvider = useCallback(async (provider: Provider) => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    console.log('[Auth] signInWithOAuth:', provider, 'redirectTo:', redirectTo);
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(ADMIN_KEY);
    setIsAdmin(false);
    setIsSubscribed(false);
    await supabase.auth.signOut();
  }, []);

  const activateAdmin = useCallback(async (passphrase: string): Promise<boolean> => {
    const hash = await sha256(passphrase);
    if (hash === ADMIN_HASH) {
      localStorage.setItem(ADMIN_KEY, 'active');
      setIsAdmin(true);
      setIsSubscribed(true);
      return true;
    }
    return false;
  }, []);

  const refreshSubscription = useCallback(async (): Promise<boolean> => {
    return checkSubscription();
  }, [checkSubscription]);

  return {
    user,
    session,
    isLoading,
    isAuthenticated: !!user || isAdmin,
    isSubscribed: isSubscribed || isAdmin,
    isAdmin,
    signInWithProvider,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    activateAdmin,
    refreshSubscription,
  };
}
