import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, getMySubscription } from '../engine/SupabaseClient';
import type { User, Session, Provider } from '@supabase/supabase-js';

// Admin is determined by Supabase app_metadata.is_admin (set via dashboard or service role).
// To make a user admin: Supabase Dashboard → Auth → Users → Edit → app_metadata: {"is_admin": true}
function checkIsAdmin(user: User | null): boolean {
  return user?.app_metadata?.is_admin === true;
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
  refreshSubscription: () => Promise<boolean>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const isAdmin = checkIsAdmin(user);

  // Use ref so checkSubscription stays stable (avoids re-triggering the auth effect)
  const userRef = useRef(user);
  userRef.current = user;

  const checkSubscription = useCallback(async (): Promise<boolean> => {
    if (checkIsAdmin(userRef.current)) return true;
    const sub = await getMySubscription();
    const active = sub?.status === 'active';
    setIsSubscribed(active);
    return active;
  }, []);

  // Initialize auth — handle PKCE callback + existing session
  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams(window.location.search);
    const hasCode = params.has('code');
    const hasError = params.has('error');

    console.log('[Auth] init — code:', hasCode, 'error:', hasError, 'url:', window.location.href);

    if (hasError) {
      console.warn('[Auth] OAuth error:', params.get('error'), params.get('error_description'));
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }

    if (hasCode) {
      console.log('[Auth] PKCE code detected, exchanging...');
      supabase.auth.exchangeCodeForSession(params.get('code')!)
        .then(({ data, error }) => {
          if (!mounted) return;
          if (error) {
            console.error('[Auth] Code exchange failed:', error.message);
          } else {
            console.log('[Auth] Code exchange success, user:', data.session?.user?.email);
            setSession(data.session);
            setUser(data.session.user);
            checkSubscription().finally(() => { if (mounted) setIsLoading(false); });
          }
          window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        })
        .catch(() => {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      console.log('[Auth] onAuthStateChange:', event, s?.user?.email ?? 'no user');
      setSession(s);
      // Only update user if ID changed (prevents infinite re-render from new object refs)
      setUser(prev => prev?.id === s?.user?.id ? prev : (s?.user ?? null));
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
    setIsSubscribed(false);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[Auth] signOut error (clearing state anyway):', err);
    }
    // Always clear state even if signOut throws (stale session edge case)
    setUser(null);
    setSession(null);
  }, []);

  const refreshSubscription = useCallback(async (): Promise<boolean> => {
    return checkSubscription();
  }, [checkSubscription]);

  return {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    isSubscribed: isSubscribed || isAdmin,
    isAdmin,
    signInWithProvider,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    refreshSubscription,
  };
}
