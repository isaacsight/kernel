import { useState, useRef, useEffect, useCallback } from 'react'
import { synthesizeSpeech, playAudio, stopAudio, cleanTextForTTS, type TTSVoice } from '../engine/tts'

export type VoiceMode = 'off' | 'listen' | 'full'

const VOICE_PREF_KEY = 'kernel-voice-preference'
const VOICE_MODE_KEY = 'kernel-voice-mode'

function loadVoicePref(): TTSVoice {
  try {
    const v = localStorage.getItem(VOICE_PREF_KEY)
    if (v === 'alloy' || v === 'nova' || v === 'echo' || v === 'onyx' || v === 'shimmer') return v
  } catch { /* ignore */ }
  return 'alloy'
}

function loadVoiceMode(): VoiceMode {
  try {
    const v = localStorage.getItem(VOICE_MODE_KEY)
    if (v === 'listen' || v === 'full') return v
  } catch { /* ignore */ }
  return 'off'
}

export function useVoiceLoop(
  onInterimResult: (text: string) => void,
  onFinalResult: (text: string) => void,
  onError: (msg: string) => void,
) {
  const [voiceMode, setVoiceModeState] = useState<VoiceMode>(loadVoiceMode)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [selectedVoice, setSelectedVoiceState] = useState<TTSVoice>(loadVoicePref)

  const recognitionRef = useRef<any>(null)
  const voiceModeRef = useRef<VoiceMode>(voiceMode)
  voiceModeRef.current = voiceMode
  const isSpeakingRef = useRef(false)
  isSpeakingRef.current = isSpeaking

  // Persist voice preference
  const setSelectedVoice = useCallback((voice: TTSVoice) => {
    setSelectedVoiceState(voice)
    try { localStorage.setItem(VOICE_PREF_KEY, voice) } catch { /* ignore */ }
  }, [])

  // Persist voice mode
  const setVoiceMode = useCallback((mode: VoiceMode) => {
    setVoiceModeState(mode)
    try { localStorage.setItem(VOICE_MODE_KEY, mode) } catch { /* ignore */ }
    // If turning off, stop everything
    if (mode === 'off') {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
      setIsListening(false)
      stopAudio()
      setIsSpeaking(false)
      setTranscript('')
    }
  }, [])

  const startListening = useCallback(() => {
    if (recognitionRef.current || isSpeakingRef.current) return

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      onError('Speech recognition not supported in this browser')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let fullTranscript = ''
      let isFinal = false
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript
        if (event.results[i].isFinal) isFinal = true
      }

      setTranscript(fullTranscript)
      onInterimResult(fullTranscript)

      if (isFinal && fullTranscript.trim()) {
        onFinalResult(fullTranscript.trim())
        setTranscript('')
      }
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setIsListening(false)
    }

    recognition.onerror = () => {
      recognitionRef.current = null
      setIsListening(false)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setIsListening(true)
    } catch (err) {
      console.warn('SpeechRecognition start error:', err)
      recognitionRef.current = null
    }
  }, [onInterimResult, onFinalResult, onError])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
    setTranscript('')
  }, [])

  // Toggle voice mode on/off from the mic button
  // Clicking mic when off -> 'listen' mode + start listening
  // Clicking mic when listen/full -> stop listening (but keep mode)
  const toggleVoiceMode = useCallback(() => {
    if (voiceModeRef.current === 'off') {
      // Activate voice mode — default to 'listen'
      setVoiceModeState('listen')
      try { localStorage.setItem(VOICE_MODE_KEY, 'listen') } catch { /* ignore */ }
      startListening()
    } else if (isListening) {
      // Currently listening — stop and turn off
      stopListening()
      stopAudio()
      setIsSpeaking(false)
      setVoiceModeState('off')
      try { localStorage.setItem(VOICE_MODE_KEY, 'off') } catch { /* ignore */ }
    } else {
      // Voice mode is on but not listening — start listening
      startListening()
    }
  }, [isListening, startListening, stopListening])

  // Speak a response using TTS (for full-loop mode)
  const speakResponse = useCallback(async (text: string, _agentId?: string) => {
    const mode = voiceModeRef.current
    if (mode !== 'full') return

    const cleaned = cleanTextForTTS(text)
    if (!cleaned) {
      // Nothing to speak — restart listening in full mode
      if (mode === 'full') startListening()
      return
    }

    // Truncate for TTS (max 4096 chars)
    const truncated = cleaned.length > 4096 ? cleaned.slice(0, 4096) : cleaned

    setIsSpeaking(true)
    stopListening()

    try {
      const blob = await synthesizeSpeech(truncated, selectedVoice)
      await playAudio(blob)
    } catch (err) {
      console.warn('[VoiceLoop] TTS error:', err)
    } finally {
      setIsSpeaking(false)
      // In full-loop mode, auto-restart listening after TTS completes
      if (voiceModeRef.current === 'full') {
        startListening()
      }
    }
  }, [selectedVoice, startListening, stopListening])

  // Legacy compatibility — maps to the old isVoiceMode boolean
  const isVoiceMode = voiceMode !== 'off'

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
      stopAudio()
    }
  }, [])

  return {
    voiceMode,
    setVoiceMode,
    isListening,
    isSpeaking,
    transcript,
    startListening,
    stopListening,
    toggleVoiceMode,
    speakResponse,
    selectedVoice,
    setSelectedVoice,
    // Legacy compatibility
    isVoiceMode,
  }
}
