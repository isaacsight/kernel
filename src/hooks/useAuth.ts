import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, getMySubscription } from '../engine/SupabaseClient';
import type { User, Session, Provider, UserIdentity } from '@supabase/supabase-js';
import { PLAN_LIMITS, type PlanId, type PlanLimits } from '../config/planLimits';

// Admin is determined by Supabase app_metadata.is_admin (set via dashboard or service role).
// To make a user admin: Supabase Dashboard → Auth → Users → Edit → app_metadata: {"is_admin": true}
function checkIsAdmin(user: User | null): boolean {
  return user?.app_metadata?.is_admin === true;
}

// localStorage key for pending password recovery.
// Set when user clicks "Forgot password?", consumed when the recovery redirect lands.
const RECOVERY_FLAG = 'kernel-pending-recovery';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSubscribed: boolean;
  isAdmin: boolean;
  isPasswordRecovery: boolean;
  planId: PlanId;
  planLimits: PlanLimits;

  signInWithProvider: (provider: Provider) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null; confirmationPending: boolean }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string, nonce?: string) => Promise<{ error: string | null }>;
  updateEmail: (email: string, nonce?: string) => Promise<{ error: string | null }>;
  reauthenticate: () => Promise<{ error: string | null }>;
  updateProfile: (data: { display_name?: string; username?: string; avatar_url?: string }) => Promise<{ error: string | null }>;
  getUserIdentities: () => UserIdentity[];
  linkIdentity: (provider: Provider) => Promise<void>;
  unlinkIdentity: (identity: UserIdentity) => Promise<{ error: string | null }>;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
  refreshSubscription: () => Promise<boolean>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribed] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const planId: PlanId = 'free';

  const isAdmin = checkIsAdmin(user);

  // Use refs so checkSubscription stays stable (avoids re-triggering the auth effect)
  const userRef = useRef(user);
  userRef.current = user;
  const mountedRef = useRef(true);

  // No paid tiers — always free
  const checkSubscription = useCallback(async (): Promise<boolean> => {
    return false;
  }, []);

  // Initialize auth — handle token_hash recovery, PKCE callback, or existing session
  //
  // Recovery flow (token_hash strategy — cross-device safe):
  //   1. User clicks "Forgot password?" → resetPasswordForEmail sends email
  //   2. Email links to: https://kernel.chat/?token_hash=xxx&type=recovery
  //   3. App detects token_hash → calls verifyOtp() → creates session
  //   4. SetNewPasswordModal appears
  //
  // Fallback (legacy PKCE — same-browser only):
  //   Email links through Supabase /auth/v1/verify → redirects with ?code=xxx
  //   App exchanges code for session using code_verifier from localStorage
  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams(window.location.search);
    const hasCode = params.has('code');
    const hasError = params.has('error');
    const tokenHash = params.get('token_hash');
    const tokenType = params.get('type');

    const pendingRecovery = localStorage.getItem(RECOVERY_FLAG);

    console.log('[Auth] init — code:', hasCode, 'error:', hasError, 'tokenHash:', !!tokenHash, 'pendingRecovery:', !!pendingRecovery, 'url:', window.location.href);

    if (hasError) {
      console.warn('[Auth] OAuth error:', params.get('error'), params.get('error_description'));
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }

    // Consume the recovery flag and show the modal once the user has a session.
    const consumeRecoveryFlag = () => {
      if (pendingRecovery && mounted) {
        console.log('[Auth] Consuming pending recovery flag — showing credential reset modal');
        localStorage.removeItem(RECOVERY_FLAG);
        setIsPasswordRecovery(true);
      }
    };

    // Helper: restore session from existing tokens (shared fallback)
    const fallbackToSession = () => {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (!mounted) return;
        setSession(s);
        setUser(s?.user ?? null);
        setIsLoading(false);
        if (s?.user) {
          checkSubscription();
          consumeRecoveryFlag();
        }
      });
    };

    // ─── Primary: token_hash recovery (cross-device safe) ─────────
    if (tokenHash && tokenType === 'recovery') {
      console.log('[Auth] Token hash recovery detected, verifying...');
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        .then(({ data, error }) => {
          if (!mounted) return;
          if (error) {
            console.error('[Auth] Token hash verification failed:', error.message);
            fallbackToSession();
          } else if (data.session) {
            console.log('[Auth] Token hash verification success');
            setSession(data.session);
            setUser(data.session.user);
            setIsPasswordRecovery(true);
            localStorage.removeItem(RECOVERY_FLAG);
            checkSubscription().finally(() => { if (mounted) setIsLoading(false); });
          } else {
            setIsLoading(false);
          }
          window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        });

    // ─── Fallback: PKCE code exchange (legacy emails) ─────────────
    } else if (hasCode) {
      console.log('[Auth] PKCE code detected, exchanging...');
      supabase.auth.exchangeCodeForSession(params.get('code')!)
        .then(({ data, error }) => {
          if (!mounted) return;
          if (error) {
            console.error('[Auth] Code exchange failed:', error.message);
            fallbackToSession();
          } else {
            console.log('[Auth] Code exchange success');
            setSession(data.session);
            setUser(data.session.user);
            checkSubscription().finally(() => { if (mounted) setIsLoading(false); });
            consumeRecoveryFlag();
          }
          window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        })
        .catch(() => {
          if (!mounted) return;
          console.log('[Auth] Exchange threw, trying getSession fallback...');
          fallbackToSession();
          window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        });

    // ─── Default: restore existing session ────────────────────────
    } else {
      supabase.auth.getSession()
        .then(({ data: { session: s } }) => {
          if (!mounted) return;
          console.log('[Auth] getSession:', s ? 'authenticated' : 'no session');
          setSession(s);
          setUser(s?.user ?? null);
          setIsLoading(false);
          if (s?.user) {
            checkSubscription();
            consumeRecoveryFlag();
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
      console.log('[Auth] onAuthStateChange:', event, s ? 'authenticated' : 'no user');
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        localStorage.removeItem(RECOVERY_FLAG);
      }
      // If user signs in manually while recovery flag is pending
      // (e.g., PKCE failed, user logged in with password/OAuth)
      if (event === 'SIGNED_IN' && localStorage.getItem(RECOVERY_FLAG)) {
        console.log('[Auth] User signed in with pending recovery — showing modal');
        localStorage.removeItem(RECOVERY_FLAG);
        setIsPasswordRecovery(true);
      }
      setSession(s);
      // Always update user on USER_UPDATED (metadata may have changed);
      // for other events, only update if ID changed to prevent re-render loops
      if (event === 'USER_UPDATED') {
        setUser(s?.user ?? null);
      } else {
        setUser(prev => prev?.id === s?.user?.id ? prev : (s?.user ?? null));
      }
      if (s?.user) {
        checkSubscription();
      } else {
        // no paid tiers
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      mountedRef.current = false;
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
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
    if (error) return { error: error.message, confirmationPending: false };
    // When email confirmation is enabled, signUp succeeds but session is null
    const confirmationPending = !data.session;
    return { error: null, confirmationPending };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    // Store a recovery flag so we can show the modal when the redirect lands,
    // even if Supabase strips query params or the PKCE exchange fails.
    localStorage.setItem(RECOVERY_FLAG, 'true');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      localStorage.removeItem(RECOVERY_FLAG);
    }
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    // no paid tiers
    localStorage.removeItem(RECOVERY_FLAG);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[Auth] signOut error (clearing state anyway):', err);
    }
    // Always clear state even if signOut throws (stale session edge case)
    setUser(null);
    setSession(null);
  }, []);

  const updatePassword = useCallback(async (password: string, nonce?: string) => {
    const { error } = await supabase.auth.updateUser({ password, nonce });
    if (!error) setIsPasswordRecovery(false);
    return { error: error?.message ?? null };
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
    localStorage.removeItem(RECOVERY_FLAG);
  }, []);

  const updateEmail = useCallback(async (email: string, nonce?: string) => {
    const { error } = await supabase.auth.updateUser({ email, nonce });
    return { error: error?.message ?? null };
  }, []);

  const reauthenticate = useCallback(async () => {
    const { error } = await supabase.auth.reauthenticate();
    return { error: error?.message ?? null };
  }, []);

  const updateProfile = useCallback(async (data: { display_name?: string; username?: string; avatar_url?: string }) => {
    // Use RPC for atomic uniqueness enforcement (user_profiles table)
    const { data: result, error: rpcError } = await supabase.rpc('update_user_profile', {
      p_display_name: data.display_name ?? null,
      p_username: data.username ?? null,
      p_avatar_url: data.avatar_url ?? null,
    });
    if (rpcError) return { error: rpcError.message };
    if (result?.error) return { error: result.error as string };
    // Refresh user object to pick up metadata changes
    const { data: refreshed } = await supabase.auth.getUser();
    if (refreshed.user) setUser(refreshed.user);
    return { error: null };
  }, []);

  const getUserIdentities = useCallback((): UserIdentity[] => {
    return user?.identities ?? [];
  }, [user]);

  const linkIdentity = useCallback(async (provider: Provider) => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    localStorage.setItem('kernel-reopen-settings', 'true');
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo },
    });
    if (error) throw new Error(error.message);
  }, []);

  const unlinkIdentity = useCallback(async (identity: UserIdentity) => {
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (!error) {
      // Refresh user to get updated identities
      const { data } = await supabase.auth.getUser();
      if (data.user) setUser(data.user);
    }
    return { error: error?.message ?? null };
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
    isPasswordRecovery,
    planId,
    planLimits: PLAN_LIMITS.free,
    signInWithProvider,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    updatePassword,
    updateEmail,
    reauthenticate,
    updateProfile,
    getUserIdentities,
    linkIdentity,
    unlinkIdentity,
    clearPasswordRecovery,
    signOut,
    refreshSubscription,
  };
}
