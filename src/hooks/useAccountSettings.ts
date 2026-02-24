import { useState, useEffect, useCallback, useRef } from 'react'
import type { User, Provider, UserIdentity } from '@supabase/supabase-js'
import { supabase, getAccessToken } from '../engine/SupabaseClient'

interface SectionState {
  loading: boolean
  error: string | null
  success: string | null
}

const INITIAL_SECTION: SectionState = { loading: false, error: null, success: null }

export type ResetScope = 'conversations' | 'memory' | 'knowledge' | 'goals' | 'preferences' | 'all'

export function useAccountSettings(
  user: User | null,
  auth: {
    updateEmail: (email: string, nonce?: string) => Promise<{ error: string | null }>
    updatePassword: (password: string, nonce?: string) => Promise<{ error: string | null }>
    updateProfile: (data: { display_name?: string; username?: string; avatar_url?: string }) => Promise<{ error: string | null }>
    getUserIdentities: () => UserIdentity[]
    linkIdentity: (provider: Provider) => Promise<void>
    unlinkIdentity: (identity: UserIdentity) => Promise<{ error: string | null }>
  },
) {
  // ─── Profile ──────────────────────────────────────
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [profileState, setProfileState] = useState<SectionState>(INITIAL_SECTION)

  // Availability tracking
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [displayNameAvailable, setDisplayNameAvailable] = useState<boolean | null>(null)
  const usernameCheckRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const displayNameCheckRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Original values from user metadata (to skip checks when unchanged)
  const origUsername = user?.user_metadata?.username || ''
  const origDisplayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || ''

  useEffect(() => {
    if (user) {
      setDisplayName(user.user_metadata?.display_name || user.user_metadata?.full_name || '')
      setUsername(user.user_metadata?.username || '')
      setAvatarUrl(user.user_metadata?.avatar_url || '')
      setUsernameAvailable(null)
      setDisplayNameAvailable(null)
    }
  }, [user])

  // Debounced username availability check
  useEffect(() => {
    clearTimeout(usernameCheckRef.current)
    const trimmed = username.trim()
    if (!trimmed || trimmed.toLowerCase() === origUsername.toLowerCase()) {
      setUsernameAvailable(null)
      return
    }
    usernameCheckRef.current = setTimeout(async () => {
      const { data } = await supabase.rpc('check_name_available', {
        p_field: 'username', p_value: trimmed,
      })
      setUsernameAvailable(data ?? null)
    }, 400)
    return () => clearTimeout(usernameCheckRef.current)
  }, [username, origUsername])

  // Debounced display name availability check
  useEffect(() => {
    clearTimeout(displayNameCheckRef.current)
    const trimmed = displayName.trim()
    if (!trimmed || trimmed.toLowerCase() === origDisplayName.toLowerCase()) {
      setDisplayNameAvailable(null)
      return
    }
    displayNameCheckRef.current = setTimeout(async () => {
      const { data } = await supabase.rpc('check_name_available', {
        p_field: 'display_name', p_value: trimmed,
      })
      setDisplayNameAvailable(data ?? null)
    }, 400)
    return () => clearTimeout(displayNameCheckRef.current)
  }, [displayName, origDisplayName])

  const saveProfile = useCallback(async () => {
    // Block save if either name is known to be taken
    if (usernameAvailable === false) {
      setProfileState({ loading: false, error: 'username_taken', success: null })
      return
    }
    if (displayNameAvailable === false) {
      setProfileState({ loading: false, error: 'display_name_taken', success: null })
      return
    }
    setProfileState({ loading: true, error: null, success: null })
    const { error } = await auth.updateProfile({
      display_name: displayName.trim(),
      username: username.trim(),
      avatar_url: avatarUrl,
    })
    if (error) {
      setProfileState({ loading: false, error, success: null })
    } else {
      setProfileState({ loading: false, error: null, success: 'saved' })
      setUsernameAvailable(null)
      setDisplayNameAvailable(null)
      setTimeout(() => setProfileState(s => ({ ...s, success: null })), 3000)
    }
  }, [displayName, username, avatarUrl, auth, usernameAvailable, displayNameAvailable])

  const resetProfile = useCallback(async () => {
    setProfileState({ loading: true, error: null, success: null })
    const { error } = await auth.updateProfile({
      display_name: '',
      username: '',
      avatar_url: '',
    })
    if (error) {
      setProfileState({ loading: false, error, success: null })
    } else {
      setDisplayName('')
      setUsername('')
      setAvatarUrl('')
      setProfileState({ loading: false, error: null, success: 'profileReset' })
      setTimeout(() => setProfileState(s => ({ ...s, success: null })), 3000)
    }
  }, [auth])

  const uploadAvatar = useCallback(async (file: File) => {
    if (!user) return
    if (file.size > 50 * 1024 * 1024) {
      setProfileState({ loading: false, error: 'File must be under 50MB', success: null })
      return
    }
    if (!file.type.startsWith('image/')) {
      setProfileState({ loading: false, error: 'Must be an image file', success: null })
      return
    }
    setProfileState({ loading: true, error: null, success: null })
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) {
      setProfileState({ loading: false, error: uploadError.message, success: null })
      return
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = `${urlData.publicUrl}?t=${Date.now()}`
    setAvatarUrl(url)
    const { error } = await auth.updateProfile({ avatar_url: url })
    if (error) {
      setProfileState({ loading: false, error, success: null })
    } else {
      setProfileState({ loading: false, error: null, success: 'saved' })
      setTimeout(() => setProfileState(s => ({ ...s, success: null })), 3000)
    }
  }, [user, auth])

  // ─── Linked Accounts (needed early for checks) ──
  const identities = auth.getUserIdentities()
  const hasPassword = identities.some(id => id.provider === 'email')

  // ─── Email ────────────────────────────────────────
  const [newEmail, setNewEmail] = useState('')
  const [emailState, setEmailState] = useState<SectionState>(INITIAL_SECTION)

  const changeEmail = useCallback(async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setEmailState({ loading: false, error: 'Enter a valid email', success: null })
      return
    }
    setEmailState({ loading: true, error: null, success: null })
    const { error } = await auth.updateEmail(newEmail.trim())
    if (error) {
      setEmailState({ loading: false, error, success: null })
    } else {
      setEmailState({ loading: false, error: null, success: 'confirmationSent' })
      setNewEmail('')
    }
  }, [newEmail, auth])

  // ─── Password ─────────────────────────────────────
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordState, setPasswordState] = useState<SectionState>(INITIAL_SECTION)

  const changePassword = useCallback(async () => {
    if (newPassword.length < 8) {
      setPasswordState({ loading: false, error: 'tooShort', success: null })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordState({ loading: false, error: 'mismatch', success: null })
      return
    }
    setPasswordState({ loading: true, error: null, success: null })
    const { error } = await auth.updatePassword(newPassword)
    if (error) {
      setPasswordState({ loading: false, error, success: null })
    } else {
      setPasswordState({ loading: false, error: null, success: 'changed' })
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordState(s => ({ ...s, success: null })), 3000)
    }
  }, [newPassword, confirmPassword, auth])

  // ─── Linked Accounts ─────────────────────────────
  const [linkState, setLinkState] = useState<SectionState>(INITIAL_SECTION)

  const linkProvider = useCallback(async (provider: Provider) => {
    setLinkState({ loading: true, error: null, success: null })
    try {
      await auth.linkIdentity(provider)
    } catch (err: unknown) {
      setLinkState({ loading: false, error: err instanceof Error ? err.message : 'Failed to link', success: null })
    }
  }, [auth])

  const unlinkProvider = useCallback(async (identity: UserIdentity) => {
    if (identities.length <= 1) {
      setLinkState({ loading: false, error: 'cannotUnlinkLast', success: null })
      return
    }
    setLinkState({ loading: true, error: null, success: null })
    const { error } = await auth.unlinkIdentity(identity)
    if (error) {
      setLinkState({ loading: false, error, success: null })
    } else {
      setLinkState({ loading: false, error: null, success: 'unlinked' })
      setTimeout(() => setLinkState(s => ({ ...s, success: null })), 3000)
    }
  }, [identities.length, auth])

  // ─── Reset User Data ─────────────────────────────
  const [resetState, setResetState] = useState<SectionState>(INITIAL_SECTION)
  const [resetConfirmScope, setResetConfirmScope] = useState<ResetScope | null>(null)

  const resetUserData = useCallback(async (scope: ResetScope) => {
    if (!user) return
    setResetState({ loading: true, error: null, success: null })
    try {
      const token = await getAccessToken()
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || ''
      const res = await fetch(`${supabaseUrl}/functions/v1/reset-user-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: supabaseKey,
        },
        body: JSON.stringify({ scope }),
      })
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('Rate limit reached. Try again later.')
        }
        if (res.status === 401) {
          throw new Error('Session expired. Please sign in again.')
        }
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setResetState({ loading: false, error: null, success: scope })
      setResetConfirmScope(null)
      setTimeout(() => setResetState(s => ({ ...s, success: null })), 5000)
      return data.deleted as Record<string, number>
    } catch (err: unknown) {
      setResetState({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to reset data',
        success: null,
      })
      return undefined
    }
  }, [user])

  // ─── Password Strength ────────────────────────────
  const passwordStrength = getPasswordStrength(newPassword)

  return {
    // Profile
    displayName, setDisplayName,
    username, setUsername,
    avatarUrl, setAvatarUrl,
    profileState, saveProfile, resetProfile, uploadAvatar,
    // Email
    newEmail, setNewEmail,
    emailState, changeEmail,
    // Password
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    passwordState, changePassword,
    passwordStrength,
    // Linked accounts
    identities, hasPassword,
    linkState, linkProvider, unlinkProvider,
    // Reset data
    resetState, resetConfirmScope, setResetConfirmScope, resetUserData,
  }
}

// ─── Password Strength Helper ──────────────────────
export type PasswordStrength = 'none' | 'weak' | 'fair' | 'strong'

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 'none'
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  if (score <= 1) return 'weak'
  if (score <= 3) return 'fair'
  return 'strong'
}
