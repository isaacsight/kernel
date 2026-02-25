import { useState, useRef, useEffect, useCallback } from 'react'

export function useVoiceInput(onResult: (text: string) => void, onError: (msg: string) => void) {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  const toggleVoice = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      onError('Speech recognition not supported in this browser')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      onResult(transcript)
    }

    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening, onResult, onError])

  // Clean up on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  return { isListening, toggleVoice }
}
