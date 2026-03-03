// ─── AuthorProfilePanel — Bottom-sheet for editing author profile ──
//
// Edit display name, bio, and avatar URL. Uses the useDiscovery hook
// for profile operations (getOwnProfile, updateProfile).

import { useState, useEffect, useCallback } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { SPRING } from '../constants/motion'
import { IconClose, IconUser, IconCheck } from './KernelIcons'
import { useDiscovery } from '../hooks/useDiscovery'

interface AuthorProfilePanelProps {
  onClose: () => void
  onToast?: (msg: string) => void
}

export function AuthorProfilePanel({ onClose, onToast }: AuthorProfilePanelProps) {
  const dragControls = useDragControls()
  const { getOwnProfile, updateProfile } = useDiscovery()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getOwnProfile().then(profile => {
      if (cancelled) return
      if (profile) {
        setDisplayName(profile.display_name || '')
        setBio(profile.bio || '')
        setAvatarUrl(profile.avatar_url || '')
      }
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [getOwnProfile])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateProfile({
        display_name: displayName || null,
        bio: bio || null,
        avatar_url: avatarUrl || null,
      })
      setSaved(true)
      onToast?.('Profile updated')
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [displayName, bio, avatarUrl, updateProfile, onToast])

  return (
    <>
      <motion.div
        className="ka-author-profile-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="ka-author-profile-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SPRING.DEFAULT}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.2 }}
        onDragEnd={(_, info) => { if (info.offset.y > 80 || info.velocity.y > 300) onClose() }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="ka-author-profile-drag-handle" onPointerDown={(e) => dragControls.start(e)} />

        <div className="ka-author-profile-header">
          <h3 className="ka-author-profile-title">
            <IconUser size={18} /> Author Profile
          </h3>
          <button className="ka-author-profile-close" onClick={onClose}>
            <IconClose size={14} />
          </button>
        </div>

        {loading ? (
          <div className="ka-author-profile-loading">Loading profile...</div>
        ) : (
          <div className="ka-author-profile-body">
            {/* Avatar preview */}
            <div className="ka-author-profile-avatar-section">
              <div className="ka-author-profile-avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="ka-author-profile-avatar-img" />
                ) : (
                  <IconUser size={32} />
                )}
              </div>
            </div>

            {/* Display Name */}
            <div className="ka-author-profile-field">
              <label className="ka-author-profile-label">Display name</label>
              <input
                type="text"
                className="ka-author-profile-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your public name..."
                maxLength={50}
              />
            </div>

            {/* Bio */}
            <div className="ka-author-profile-field">
              <label className="ka-author-profile-label">Bio</label>
              <textarea
                className="ka-author-profile-textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short bio..."
                maxLength={300}
                rows={3}
              />
              <span className="ka-author-profile-char-count">{bio.length}/300</span>
            </div>

            {/* Avatar URL */}
            <div className="ka-author-profile-field">
              <label className="ka-author-profile-label">Avatar URL</label>
              <input
                type="url"
                className="ka-author-profile-input"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {error && <div className="ka-author-profile-error">{error}</div>}

            <button
              className="ka-author-profile-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saved ? <><IconCheck size={14} /> Saved</> : saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        )}
      </motion.div>
    </>
  )
}
