import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { IconMic, IconMicOff, IconVolume, IconVolumeOff, IconChevronDown } from './KernelIcons'
import { TTS_VOICES, type TTSVoice } from '../engine/tts'
import type { VoiceMode } from '../hooks/useVoiceLoop'
import { SPRING } from '../constants/motion'

interface VoiceControlsProps {
  voiceMode: VoiceMode
  setVoiceMode: (mode: VoiceMode) => void
  isListening: boolean
  isSpeaking: boolean
  transcript: string
  selectedVoice: TTSVoice
  setSelectedVoice: (voice: TTSVoice) => void
  onToggleVoice: () => void
  isPro: boolean
  disabled?: boolean
  isMini?: boolean
}

/**
 * Voice controls for the chat input area.
 * Shows mic button with mode selector dropdown.
 */
export function VoiceControls({
  voiceMode, setVoiceMode, isListening, isSpeaking, transcript,
  selectedVoice, setSelectedVoice, onToggleVoice,
  isPro, disabled, isMini,
}: VoiceControlsProps) {
  const { t } = useTranslation('home')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const longPressRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const longPressTriggered = useRef(false)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDropdown])

  // Long-press to open dropdown (mobile-friendly)
  const handlePointerDown = useCallback(() => {
    longPressTriggered.current = false
    longPressRef.current = setTimeout(() => {
      longPressTriggered.current = true
      setShowDropdown(true)
    }, 500)
  }, [])

  const handlePointerUp = useCallback(() => {
    clearTimeout(longPressRef.current)
    if (!longPressTriggered.current) {
      // Short press — toggle voice
      onToggleVoice()
    }
  }, [onToggleVoice])

  const handlePointerCancel = useCallback(() => {
    clearTimeout(longPressRef.current)
  }, [])

  if (isMini) {
    // In mini mode, render as a popover item
    return (
      <button
        type="button"
        className={`ka-mini-popover-item${isListening ? ' ka-voice-btn--active' : ''}`}
        onClick={onToggleVoice}
        disabled={disabled}
      >
        {isListening ? <IconMicOff size={16} /> : <IconMic size={16} />}
        <span>{isListening ? t('voice.listening') : t('voice.off')}</span>
      </button>
    )
  }

  const isActive = voiceMode !== 'off'

  return (
    <div className="ka-voice-controls" ref={dropdownRef}>
      {/* Main mic button */}
      <button
        type="button"
        className={`ka-voice-btn${isListening ? ' ka-voice-btn--active' : ''}${isSpeaking ? ' ka-voice-btn--speaking' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        disabled={disabled}
        aria-label={
          isListening ? t('voice.listening') :
          isSpeaking ? t('voice.speaking') :
          t('voice.off')
        }
      >
        {isSpeaking ? (
          <IconVolume size={18} />
        ) : isListening ? (
          <IconMicOff size={18} />
        ) : (
          <IconMic size={18} />
        )}
      </button>

      {/* Mode badge */}
      {isActive && !isListening && !isSpeaking && (
        <span className="ka-voice-mode-badge" onClick={() => setShowDropdown(!showDropdown)}>
          {voiceMode === 'full' ? <IconVolume size={10} /> : <IconMic size={10} />}
        </span>
      )}

      {/* Transcript indicator */}
      <AnimatePresence>
        {isListening && transcript && (
          <motion.div
            className="ka-voice-transcript"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
          >
            {transcript.length > 40 ? transcript.slice(-40) + '...' : transcript}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dropdown menu */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            className="ka-voice-dropdown"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={SPRING}
          >
            <div className="ka-voice-dropdown-section">
              <span className="ka-voice-dropdown-label">{t('voice.modeLabel')}</span>
              {(['off', 'listen', 'full'] as VoiceMode[]).map(mode => (
                <button
                  key={mode}
                  className={`ka-voice-dropdown-item${voiceMode === mode ? ' ka-voice-dropdown-item--active' : ''}${mode === 'full' && !isPro ? ' ka-voice-dropdown-item--disabled' : ''}`}
                  onClick={() => {
                    if (mode === 'full' && !isPro) return
                    setVoiceMode(mode)
                    if (mode !== 'off' && !isListening) {
                      // Will start listening on next render cycle
                    }
                    setShowDropdown(false)
                  }}
                  disabled={mode === 'full' && !isPro}
                >
                  {mode === 'off' && <IconVolumeOff size={14} />}
                  {mode === 'listen' && <IconMic size={14} />}
                  {mode === 'full' && <IconVolume size={14} />}
                  <span>
                    {t(`voice.${mode}`)}
                    {mode === 'full' && !isPro && <span className="ka-voice-pro-badge">Pro</span>}
                  </span>
                </button>
              ))}
            </div>

            {isPro && voiceMode === 'full' && (
              <div className="ka-voice-dropdown-section">
                <span className="ka-voice-dropdown-label">{t('voice.voiceLabel')}</span>
                {TTS_VOICES.map(v => (
                  <button
                    key={v.id}
                    className={`ka-voice-dropdown-item${selectedVoice === v.id ? ' ka-voice-dropdown-item--active' : ''}`}
                    onClick={() => {
                      setSelectedVoice(v.id)
                      setShowDropdown(false)
                    }}
                  >
                    <span>{v.label}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Small speaker button on kernel messages to replay via TTS.
 */
export function MessageSpeakButton({
  content,
  onSpeak,
  isSpeaking,
}: {
  content: string
  onSpeak: (text: string) => void
  isSpeaking: boolean
}) {
  const { t } = useTranslation('home')

  return (
    <button
      type="button"
      className={`ka-msg-speak-btn${isSpeaking ? ' ka-msg-speak-btn--active' : ''}`}
      onClick={() => onSpeak(content)}
      aria-label={t('voice.speakMessage')}
      title={t('voice.speakMessage')}
    >
      <IconVolume size={13} />
    </button>
  )
}
