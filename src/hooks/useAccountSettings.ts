import { useState, useEffect, useCallback } from 'react'
import type { User, Provider, UserIdentity } from '@supabase/supabase-js'
import { supabase } from '../engine/SupabaseClient'

interface SectionState {
  loading: boolean
  error: string | null
  success: string | null
}

const INITIAL_SECTION: SectionState = { loading: false, error: null, success: null }

export function useAccountSettings(
  user: User | null,
  auth: {
    updateEmail: (email: string, nonce?: string) => Promise<{ error: string | null }>
    updatePassword: (password: string, nonce?: string) => Promise<{ error: string | null }>
    reauthenticate: () => Promise<{ error: string | null }>
    updateProfile: (data: { display_name?: string; avatar_url?: string }) => Promise<{ error: string | null }>
    getUserIdentities: () => UserIdentity[]
    linkIdentity: (provider: Provider) => Promise<void>
    unlinkIdentity: (identity: UserIdentity) => Promise<{ error: string | null }>
  },
) {
  // ─── Profile ──────────────────────────────────────
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [profileState, setProfileState] = useState<SectionState>(INITIAL_SECTION)

  useEffect(() => {
    if (user) {
      setDisplayName(user.user_metadata?.display_name || user.user_metadata?.full_name || '')
      setAvatarUrl(user.user_metadata?.avatar_url || '')
    }
  }, [user])

  const saveProfile = useCallback(async () => {
    setProfileState({ loading: true, error: null, success: null })
    const { error } = await auth.updateProfile({
      display_name: displayName.trim(),
      avatar_url: avatarUrl,
    })
    if (error) {
      setProfileState({ loading: false, error, success: null })
    } else {
      setProfileState({ loading: false, error: null, success: 'saved' })
      setTimeout(() => setProfileState(s => ({ ...s, success: null })), 3000)
    }
  }, [displayName, avatarUrl, auth])

  const uploadAvatar = useCallback(async (file: File) => {
    if (!user) return
    if (file.size > 2 * 1024 * 1024) {
      setProfileState({ loading: false, error: 'File must be under 2MB', success: null })
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

  // ─── Email Verification (re-auth) ──────────────────
  const [verificationCode, setVerificationCode] = useState('')
  const [verifyState, setVerifyState] = useState<SectionState>(INITIAL_SECTION)
  const [codeSent, setCodeSent] = useState(false)

  const sendVerificationCode = useCallback(async () => {
    setVerifyState({ loading: true, error: null, success: null })
    const { error } = await auth.reauthenticate()
    if (error) {
      setVerifyState({ loading: false, error, success: null })
    } else {
      setCodeSent(true)
      setVerifyState({ loading: false, error: null, success: 'codeSent' })
      setTimeout(() => setVerifyState(s => ({ ...s, success: null })), 5000)
    }
  }, [auth])

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
    if (!codeSent) {
      setVerifyState({ loading: false, error: 'verificationRequired', success: null })
      return
    }
    if (!verificationCode.trim()) {
      setVerifyState({ loading: false, error: 'codeRequired', success: null })
      return
    }
    setEmailState({ loading: true, error: null, success: null })
    const { error } = await auth.updateEmail(newEmail.trim(), verificationCode.trim())
    if (error) {
      setEmailState({ loading: false, error, success: null })
    } else {
      setEmailState({ loading: false, error: null, success: 'confirmationSent' })
      setNewEmail('')
      setVerificationCode('')
      setCodeSent(false)
    }
  }, [newEmail, auth, codeSent, verificationCode])

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
    if (hasPassword) {
      if (!codeSent) {
        setVerifyState({ loading: false, error: 'verificationRequired', success: null })
        return
      }
      if (!verificationCode.trim()) {
        setVerifyState({ loading: false, error: 'codeRequired', success: null })
        return
      }
    }
    setPasswordState({ loading: true, error: null, success: null })
    const { error } = await auth.updatePassword(newPassword, hasPassword ? verificationCode.trim() : undefined)
    if (error) {
      setPasswordState({ loading: false, error, success: null })
    } else {
      setPasswordState({ loading: false, error: null, success: 'changed' })
      setNewPassword('')
      setConfirmPassword('')
      setVerificationCode('')
      setCodeSent(false)
      setTimeout(() => setPasswordState(s => ({ ...s, success: null })), 3000)
    }
  }, [newPassword, confirmPassword, auth, hasPassword, codeSent, verificationCode])

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

  return {
    // Profile
    displayName, setDisplayName,
    avatarUrl, setAvatarUrl,
    profileState, saveProfile, uploadAvatar,
    // Verification
    verificationCode, setVerificationCode,
    verifyState, codeSent, sendVerificationCode,
    // Email
    newEmail, setNewEmail,
    emailState, changeEmail,
    // Password
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    passwordState, changePassword,
    // Linked accounts
    identities, hasPassword,
    linkState, linkProvider, unlinkProvider,
  }
}
