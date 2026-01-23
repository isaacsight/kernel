import { useState, useEffect, useRef, useCallback } from 'react';

// Web Speech API types (not included in standard TypeScript)
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
    isFinal: boolean;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message?: string;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

export interface UseVoiceInputOptions {
    /** Language for speech recognition (default: 'en-US') */
    lang?: string;
    /** Enable continuous listening mode */
    continuous?: boolean;
    /** Show interim (partial) results while speaking */
    interimResults?: boolean;
    /** Callback when final transcript is ready */
    onResult?: (transcript: string) => void;
    /** Callback for interim results */
    onInterimResult?: (transcript: string) => void;
    /** Auto-submit when speech ends (for mobile convenience) */
    autoSubmit?: boolean;
}

export interface UseVoiceInputReturn {
    /** Whether the browser supports speech recognition */
    isSupported: boolean;
    /** Whether currently listening for speech */
    isListening: boolean;
    /** Current transcript (final + interim) */
    transcript: string;
    /** Only the final confirmed transcript */
    finalTranscript: string;
    /** Error message if any */
    error: string | null;
    /** Start listening */
    startListening: () => void;
    /** Stop listening */
    stopListening: () => void;
    /** Toggle listening on/off */
    toggleListening: () => void;
    /** Clear the current transcript */
    clearTranscript: () => void;
    /** Whether microphone permission is granted */
    hasPermission: boolean | null;
}

/**
 * Hook for voice input using Web Speech API
 * Optimized for mobile browsers (Chrome Android, Safari iOS)
 */
export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
    const {
        lang = 'en-US',
        continuous = false,
        interimResults = true,
        onResult,
        onInterimResult,
        autoSubmit = false,
    } = options;

    const [isSupported, setIsSupported] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [finalTranscript, setFinalTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    const recognitionRef = useRef<SpeechRecognition | null>(null);

    // Check for browser support
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        setIsSupported(!!SpeechRecognition);

        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = continuous;
            recognitionRef.current.interimResults = interimResults;
            recognitionRef.current.lang = lang;
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, [continuous, interimResults, lang]);

    // Set up recognition event handlers
    useEffect(() => {
        const recognition = recognitionRef.current;
        if (!recognition) return;

        recognition.onstart = () => {
            setIsListening(true);
            setError(null);
            setHasPermission(true);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interimText = '';
            let finalText = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const text = result[0].transcript;

                if (result.isFinal) {
                    finalText += text;
                } else {
                    interimText += text;
                }
            }

            if (finalText) {
                setFinalTranscript(prev => prev + finalText);
                setTranscript(prev => prev + finalText);
                onResult?.(finalText);
            }

            if (interimText) {
                setTranscript(prev => {
                    // Replace interim portion with new interim
                    const baseText = finalTranscript || '';
                    return baseText + interimText;
                });
                onInterimResult?.(interimText);
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            setIsListening(false);

            switch (event.error) {
                case 'not-allowed':
                    setError('Microphone access denied. Please allow microphone permissions.');
                    setHasPermission(false);
                    break;
                case 'no-speech':
                    setError('No speech detected. Try again.');
                    break;
                case 'audio-capture':
                    setError('No microphone found. Please check your device.');
                    break;
                case 'network':
                    setError('Network error. Check your connection.');
                    break;
                case 'aborted':
                    // User aborted, not an error
                    setError(null);
                    break;
                default:
                    setError(`Speech recognition error: ${event.error}`);
            }
        };

        recognition.onend = () => {
            setIsListening(false);

            // Auto-submit final transcript if enabled
            if (autoSubmit && finalTranscript) {
                onResult?.(finalTranscript);
            }
        };
    }, [onResult, onInterimResult, autoSubmit, finalTranscript]);

    const startListening = useCallback(() => {
        if (!recognitionRef.current) {
            setError('Speech recognition not supported');
            return;
        }

        setError(null);
        setTranscript('');
        setFinalTranscript('');

        try {
            recognitionRef.current.start();
        } catch (err) {
            // Already started or other error
            if (err instanceof Error && err.message.includes('already started')) {
                recognitionRef.current.stop();
                setTimeout(() => recognitionRef.current?.start(), 100);
            }
        }
    }, []);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListening(false);
    }, []);

    const toggleListening = useCallback(() => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }, [isListening, startListening, stopListening]);

    const clearTranscript = useCallback(() => {
        setTranscript('');
        setFinalTranscript('');
    }, []);

    return {
        isSupported,
        isListening,
        transcript,
        finalTranscript,
        error,
        startListening,
        stopListening,
        toggleListening,
        clearTranscript,
        hasPermission,
    };
}

export default useVoiceInput;
