import { useState, useRef, useEffect, useCallback } from 'react'

export function useVoiceLoop(
    onInterimResult: (text: string) => void,
    onFinalResult: (text: string) => void,
    onError: (msg: string) => void
) {
    const [isVoiceMode, setIsVoiceMode] = useState(false)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const recognitionRef = useRef<any>(null)

    const startListening = useCallback(() => {
        if (recognitionRef.current || isSpeaking) return

        const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognition) {
            onError('Speech recognition not supported in this browser')
            return
        }

        const recognition = new SpeechRecognition()
        recognition.continuous = false // Stop after phrase finishes
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = (event: any) => {
            let transcript = ''
            let isFinal = false
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript
                if (event.results[i].isFinal) isFinal = true
            }

            onInterimResult(transcript)

            if (isFinal && transcript.trim()) {
                onFinalResult(transcript.trim())
            }
        }

        recognition.onend = () => {
            recognitionRef.current = null
        }

        recognition.onerror = () => {
            recognitionRef.current = null
        }

        recognitionRef.current = recognition
        try {
            recognition.start()
        } catch (err) {
            console.warn('SpeechRecognition start error:', err)
        }
    }, [isSpeaking, onInterimResult, onFinalResult, onError])

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop()
        recognitionRef.current = null
    }, [])

    const toggleVoiceMode = useCallback(() => {
        setIsVoiceMode(prev => {
            const next = !prev
            if (next) {
                startListening()
            } else {
                stopListening()
                window.speechSynthesis?.cancel()
                setIsSpeaking(false)
            }
            return next
        })
    }, [startListening, stopListening])

    const speakResponse = useCallback((text: string, agentId: string = 'kernel') => {
        if (!isVoiceMode) return
        if (!window.speechSynthesis) return

        // Clean up text
        const cleanText = text
            .replace(/```[\s\S]*?```/g, ' [code block] ')
            .replace(/https?:\/\/[^\s]+/g, ' [link] ')
            .replace(/\*|_|#/g, '')
            .trim()

        if (!cleanText) {
            if (isVoiceMode) startListening()
            return
        }

        setIsSpeaking(true)
        stopListening()

        const utterance = new SpeechSynthesisUtterance(cleanText)
        const voices = window.speechSynthesis.getVoices()

        const femaleVoice = voices.find(v => v.name.includes('Samantha') || v.name.includes('Siri female'))
        const maleVoice = voices.find(v => v.name.includes('Alex') || v.name.includes('Daniel') || v.name.includes('Google UK English Male'))

        if (agentId === 'aesthete' && femaleVoice) utterance.voice = femaleVoice
        else if (maleVoice) utterance.voice = maleVoice

        utterance.rate = 1.05
        utterance.pitch = agentId === 'aesthete' ? 1.1 : 1.0

        utterance.onend = () => {
            setIsSpeaking(false)
            if (isVoiceMode) startListening()
        }

        utterance.onerror = () => {
            setIsSpeaking(false)
            if (isVoiceMode) startListening()
        }

        window.speechSynthesis.speak(utterance)
    }, [isVoiceMode, stopListening, startListening])

    useEffect(() => {
        return () => {
            stopListening()
            window.speechSynthesis?.cancel()
        }
    }, [stopListening])

    return { isVoiceMode, toggleVoiceMode, speakResponse, isSpeaking }
}
