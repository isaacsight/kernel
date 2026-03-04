import { useState, useRef, useCallback, useEffect } from 'react'
import { useVoiceInput } from './useVoiceInput'
import { useVoiceOutput, type TTSVoice } from './useVoiceOutput'

type LoopState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface UseVoiceLoopReturn {
  isActive: boolean
  state: LoopState
  transcript: string
  start: () => void
  stop: () => void
  voice: TTSVoice
  setVoice: (v: TTSVoice) => void
}

/**
 * Continuous voice loop: user speaks → auto-submit → Kernel responds → TTS → re-enable mic.
 * Pro-only feature. Requires both voice input and output hooks.
 *
 * The caller provides `onSubmit` (to send the transcribed text) and `lastResponse`
 * (Kernel's latest reply text) which triggers TTS playback.
 */
export function useVoiceLoop(
  isPro: boolean,
  onSubmit: (text: string) => void,
  lastResponse: string | null,
  isStreaming: boolean,
): UseVoiceLoopReturn {
  const [isActive, setIsActive] = useState(false)
  const [state, setState] = useState<LoopState>('idle')
  const voiceInput = useVoiceInput()
  const voiceOutput = useVoiceOutput(isPro)
  const lastResponseRef = useRef<string | null>(null)
  const submittedRef = useRef(false)

  // When loop is active and final transcript arrives, auto-submit
  useEffect(() => {
    if (!isActive || !voiceInput.finalTranscript || submittedRef.current) return

    const text = voiceInput.finalTranscript.trim()
    if (!text) return

    // Check for stop keywords
    const lowerText = text.toLowerCase()
    if (lowerText === 'stop' || lowerText === 'stop listening' || lowerText === 'exit') {
      setIsActive(false)
      setState('idle')
      voiceInput.stopRecording()
      return
    }

    submittedRef.current = true
    voiceInput.stopRecording()
    setState('thinking')
    onSubmit(text)
  }, [isActive, voiceInput.finalTranscript, onSubmit, voiceInput])

  // When streaming ends and we have a new response, speak it
  useEffect(() => {
    if (!isActive || state !== 'thinking') return
    if (isStreaming) return // wait for streaming to finish
    if (!lastResponse || lastResponse === lastResponseRef.current) return

    lastResponseRef.current = lastResponse
    setState('speaking')

    voiceOutput.speak(lastResponse).then(() => {
      // After speaking, re-enable mic
      if (isActive) {
        submittedRef.current = false
        setState('listening')
        voiceInput.startRecording()
      }
    }).catch(() => {
      // TTS failed — still re-enable mic
      if (isActive) {
        submittedRef.current = false
        setState('listening')
        voiceInput.startRecording()
      }
    })
  }, [isActive, state, isStreaming, lastResponse, voiceInput, voiceOutput])

  const start = useCallback(() => {
    if (!isPro) return
    setIsActive(true)
    setState('listening')
    submittedRef.current = false
    lastResponseRef.current = null
    voiceInput.startRecording()
  }, [isPro, voiceInput])

  const stop = useCallback(() => {
    setIsActive(false)
    setState('idle')
    voiceInput.stopRecording()
    voiceOutput.stop()
    submittedRef.current = false
  }, [voiceInput, voiceOutput])

  return {
    isActive,
    state,
    transcript: voiceInput.transcript || voiceInput.finalTranscript,
    start,
    stop,
    voice: voiceOutput.voice,
    setVoice: voiceOutput.setVoice,
  }
}
