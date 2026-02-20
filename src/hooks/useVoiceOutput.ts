import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Text-to-speech hook using Web Speech API.
 * Speaks text aloud and tracks speaking state.
 * Works on Safari (iOS + Mac), Chrome, Edge.
 */
export function useVoiceOutput() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const lastSpokenRef = useRef('')

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
    utteranceRef.current = null
  }, [])

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !text.trim()) return
    if (!window.speechSynthesis) return

    // Don't re-speak the same text
    if (text === lastSpokenRef.current) return
    lastSpokenRef.current = text

    // Cancel any current speech
    window.speechSynthesis.cancel()

    // Strip markdown for cleaner speech
    const clean = text
      .replace(/```[\s\S]*?```/g, ' code block ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[-*] /g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim()

    if (!clean) return

    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0

    // Prefer a natural-sounding voice
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v =>
      v.name.includes('Samantha') || // iOS/Mac
      v.name.includes('Karen') ||
      v.name.includes('Daniel') ||
      v.name.includes('Google UK English Female')
    ) || voices.find(v => v.lang.startsWith('en') && v.localService)
    if (preferred) utterance.voice = preferred

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [voiceEnabled])

  // Clean up on unmount
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel() }
  }, [])

  // Load voices (some browsers load async)
  useEffect(() => {
    window.speechSynthesis?.getVoices()
    const handler = () => window.speechSynthesis?.getVoices()
    window.speechSynthesis?.addEventListener?.('voiceschanged', handler)
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', handler)
  }, [])

  return { isSpeaking, voiceEnabled, setVoiceEnabled, speak, stop }
}
