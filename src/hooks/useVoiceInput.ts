import { useState, useRef, useCallback, useEffect } from 'react'
import { transcribeAudio } from '../engine/transcribe'

interface UseVoiceInputReturn {
  isRecording: boolean
  isSupported: boolean
  transcript: string        // interim (live) transcript
  finalTranscript: string   // committed transcript
  startRecording: () => void
  stopRecording: () => void
  error: string | null
}

/**
 * Voice input via Web Speech API (primary) with MediaRecorder → Whisper fallback.
 * Returns live transcript while recording, final transcript on stop.
 */
export function useVoiceInput(): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const modeRef = useRef<'speech-api' | 'media-recorder' | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const restartCountRef = useRef(0)
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check if Web Speech API is available
  const hasSpeechAPI = typeof window !== 'undefined' && (
    'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  )
  const hasMediaRecorder = typeof window !== 'undefined' && 'MediaRecorder' in window
  const isSupported = hasSpeechAPI || hasMediaRecorder

  const cleanup = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* noop */ }
      recognitionRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch { /* noop */ }
    }
    mediaRecorderRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    chunksRef.current = []
    modeRef.current = null
    restartCountRef.current = 0
  }, [])

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup])

  const startWithSpeechAPI = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Reset restart counter on successful recognition
      restartCountRef.current = 0
      let interim = ''
      let final = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      setTranscript(interim)
      if (final) setFinalTranscript(prev => prev + final)
    }

    recognition.onerror = (e: Event) => {
      const err = e as SpeechRecognitionErrorEvent
      // Fatal errors — tear down completely
      if (err.error === 'not-allowed') {
        setError('Microphone access denied')
        setIsRecording(false)
        cleanup()
        return
      }
      if (err.error === 'aborted') {
        setIsRecording(false)
        cleanup()
        return
      }
      // Recoverable errors — let onend handle restart
      if (err.error !== 'no-speech') {
        setError(`Speech recognition error: ${err.error}`)
      }
    }

    recognition.onend = () => {
      // If still in recording state, user didn't explicitly stop — auto-restart
      if (modeRef.current === 'speech-api' && recognitionRef.current) {
        restartCountRef.current++
        // Cap restarts to prevent infinite loops
        if (restartCountRef.current > 50) {
          setError('Voice connection lost — tap to retry')
          setIsRecording(false)
          cleanup()
          return
        }
        // Small delay to avoid rapid reconnection storms
        restartTimerRef.current = setTimeout(() => {
          if (modeRef.current === 'speech-api' && recognitionRef.current) {
            try { recognition.start() } catch { /* noop */ }
          }
        }, 300)
      }
    }

    recognitionRef.current = recognition
    modeRef.current = 'speech-api'
    recognition.start()
  }, [cleanup])

  const startWithMediaRecorder = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    const recorder = new MediaRecorder(stream, { mimeType })
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      if (chunksRef.current.length === 0) return
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const file = new File([blob], 'recording.webm', { type: mimeType })

      setTranscript('Transcribing...')
      try {
        const result = await transcribeAudio(file)
        setFinalTranscript(result.text)
        setTranscript('')
      } catch (err) {
        setError('Transcription failed')
        setTranscript('')
      }
      setIsRecording(false)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }

    recorder.onerror = () => {
      setError('Recording failed')
      setIsRecording(false)
      cleanup()
    }

    mediaRecorderRef.current = recorder
    modeRef.current = 'media-recorder'
    recorder.start(1000) // collect chunks every 1s
  }, [cleanup])

  const startRecording = useCallback(() => {
    setError(null)
    setTranscript('')
    setFinalTranscript('')
    setIsRecording(true)

    if (hasSpeechAPI) {
      startWithSpeechAPI()
    } else if (hasMediaRecorder) {
      startWithMediaRecorder().catch(err => {
        setError(err?.message || 'Failed to access microphone')
        setIsRecording(false)
      })
    }
  }, [hasSpeechAPI, hasMediaRecorder, startWithSpeechAPI, startWithMediaRecorder])

  const stopRecording = useCallback(() => {
    setIsRecording(false)
    if (modeRef.current === 'speech-api' && recognitionRef.current) {
      const ref = recognitionRef.current
      recognitionRef.current = null
      modeRef.current = null
      try { ref.stop() } catch { /* noop */ }
    } else if (modeRef.current === 'media-recorder' && mediaRecorderRef.current) {
      modeRef.current = null
      try { mediaRecorderRef.current.stop() } catch { /* noop */ }
      // onstop handler will process the audio
    }
  }, [])

  return {
    isRecording,
    isSupported,
    transcript,
    finalTranscript,
    startRecording,
    stopRecording,
    error,
  }
}
