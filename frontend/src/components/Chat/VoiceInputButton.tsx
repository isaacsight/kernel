import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { useEffect, useRef } from 'react';

interface VoiceInputButtonProps {
    /** Called when voice input produces text */
    onTranscript: (text: string) => void;
    /** Called when user finishes speaking (for auto-send) */
    onComplete?: (text: string) => void;
    /** Current theme */
    isDark?: boolean;
    /** Disable the button */
    disabled?: boolean;
}

/**
 * Mobile-optimized voice input button
 * Large tap target with visual feedback
 */
export function VoiceInputButton({
    onTranscript,
    onComplete,
    isDark = true,
    disabled = false,
}: VoiceInputButtonProps) {
    const lastTranscriptRef = useRef('');

    const {
        isSupported,
        isListening,
        transcript,
        finalTranscript,
        error,
        toggleListening,
        hasPermission,
    } = useVoiceInput({
        continuous: false,
        interimResults: true,
        onResult: (text) => {
            // Accumulate final transcript
            lastTranscriptRef.current += text;
        },
    });

    // Update parent with transcript as it comes in
    useEffect(() => {
        if (transcript) {
            onTranscript(transcript);
        }
    }, [transcript, onTranscript]);

    // When listening stops and we have text, trigger complete
    useEffect(() => {
        if (!isListening && lastTranscriptRef.current) {
            onComplete?.(lastTranscriptRef.current);
            lastTranscriptRef.current = '';
        }
    }, [isListening, onComplete]);

    if (!isSupported) {
        return null; // Don't show if not supported
    }

    const buttonClass = `voice-input-btn ${isListening ? 'listening' : ''} ${disabled ? 'disabled' : ''}`;

    return (
        <div className="voice-input-container">
            <button
                className={buttonClass}
                onClick={toggleListening}
                disabled={disabled}
                title={isListening ? 'Tap to stop' : 'Tap to speak'}
                aria-label={isListening ? 'Stop listening' : 'Start voice input'}
            >
                {isListening ? (
                    <div className="mic-active">
                        <Mic size={24} />
                        <div className="pulse-ring" />
                        <div className="pulse-ring delay" />
                    </div>
                ) : hasPermission === false ? (
                    <MicOff size={24} />
                ) : (
                    <Mic size={24} />
                )}
            </button>

            {/* Listening indicator */}
            {isListening && (
                <div className="listening-indicator">
                    <div className="wave-container">
                        <div className="wave" />
                        <div className="wave" />
                        <div className="wave" />
                        <div className="wave" />
                        <div className="wave" />
                    </div>
                    <span>Listening...</span>
                </div>
            )}

            {/* Error display */}
            {error && (
                <div className="voice-error">
                    {error}
                </div>
            )}

            <style>{`
                .voice-input-container {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .voice-input-btn {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    border: 2px solid ${isDark ? '#444' : '#ddd'};
                    background: ${isDark ? '#2d2d2d' : '#f5f5f5'};
                    color: ${isDark ? '#d4d4d4' : '#333'};
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    position: relative;
                    overflow: visible;
                }

                .voice-input-btn:hover:not(:disabled) {
                    border-color: #007acc;
                    background: ${isDark ? '#333' : '#eee'};
                }

                .voice-input-btn.listening {
                    border-color: #4ec9b0;
                    background: rgba(78, 201, 176, 0.15);
                    color: #4ec9b0;
                }

                .voice-input-btn.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .mic-active {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .pulse-ring {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border: 2px solid #4ec9b0;
                    border-radius: 50%;
                    animation: pulse 1.5s ease-out infinite;
                }

                .pulse-ring.delay {
                    animation-delay: 0.5s;
                }

                @keyframes pulse {
                    0% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: scale(2);
                        opacity: 0;
                    }
                }

                .listening-indicator {
                    position: absolute;
                    bottom: -40px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    white-space: nowrap;
                }

                .listening-indicator span {
                    font-size: 0.7rem;
                    color: #4ec9b0;
                    font-weight: 500;
                }

                .wave-container {
                    display: flex;
                    align-items: center;
                    gap: 3px;
                    height: 20px;
                }

                .wave {
                    width: 3px;
                    height: 100%;
                    background: #4ec9b0;
                    border-radius: 2px;
                    animation: wave 0.8s ease-in-out infinite;
                }

                .wave:nth-child(1) { animation-delay: 0s; height: 60%; }
                .wave:nth-child(2) { animation-delay: 0.1s; height: 80%; }
                .wave:nth-child(3) { animation-delay: 0.2s; height: 100%; }
                .wave:nth-child(4) { animation-delay: 0.3s; height: 80%; }
                .wave:nth-child(5) { animation-delay: 0.4s; height: 60%; }

                @keyframes wave {
                    0%, 100% { transform: scaleY(0.5); }
                    50% { transform: scaleY(1); }
                }

                .voice-error {
                    position: absolute;
                    bottom: -30px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #f14c4c;
                    color: white;
                    font-size: 0.7rem;
                    padding: 4px 8px;
                    border-radius: 4px;
                    white-space: nowrap;
                    z-index: 10;
                }

                /* Mobile: Larger tap target */
                @media (max-width: 768px) {
                    .voice-input-btn {
                        width: 56px;
                        height: 56px;
                    }

                    .voice-input-btn svg {
                        width: 28px;
                        height: 28px;
                    }
                }

                /* Even larger on small phones */
                @media (max-width: 480px) {
                    .voice-input-btn {
                        width: 52px;
                        height: 52px;
                    }
                }
            `}</style>
        </div>
    );
}

export default VoiceInputButton;
