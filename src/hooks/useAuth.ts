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

  // Clean up auth error params from URL (e.g. after failed OAuth redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('error')) {
      console.warn('Auth error in URL:', params.get('error'), params.get('error_description'));
      // Remove error params, keep the hash
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          checkSubscription().finally(() => setIsLoading(false));
        } else {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Auth session error:', err);
        setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        checkSubscription();
      } else {
        setIsSubscribed(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkSubscription]);

  const signInWithProvider = useCallback(async (provider: Provider) => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
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
