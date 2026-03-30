export interface VoiceSession {
    id: string;
    status: 'listening' | 'processing' | 'speaking' | 'idle';
    sttEngine: 'whisper-local' | 'whisper-api' | 'system';
    ttsEngine: 'system' | 'elevenlabs' | 'openai-tts';
    language: string;
    continuous: boolean;
    vadEnabled: boolean;
    history: VoiceTurn[];
}
export interface VoiceTurn {
    role: 'user' | 'assistant';
    text: string;
    audioFile?: string;
    duration: number;
    timestamp: string;
}
/**
 * Start a real-time bidirectional voice conversation.
 *
 * - Voice Activity Detection (VAD) via sox for natural turn-taking
 * - STT fallback: whisper-local -> whisper-api -> system
 * - TTS fallback: system -> openai-tts -> elevenlabs
 * - Streaming TTS: sentence-level chunking, speaks before full response
 * - Interrupt: speaking stops if user starts talking
 * - Voice commands: stop, pause, switch to [agent], save this
 * - Audio saved to ~/.kbot/voice/ for playback/review
 * - Waveform + status visualization in terminal
 */
export declare function startRealtimeVoice(opts?: {
    stt?: string;
    tts?: string;
    language?: string;
    continuous?: boolean;
    vad?: boolean;
    voice?: string;
    rate?: number;
    ollamaHost?: string;
    ollamaModel?: string;
    agent?: string;
    vadThreshold?: number;
    vadSilence?: number;
}): Promise<void>;
/** Describe real-time voice capabilities of the current system */
export declare function describeRealtimeCapabilities(): string;
/** List saved voice sessions from ~/.kbot/voice/ */
export declare function listVoiceSessions(): Array<{
    id: string;
    timestamp: string;
    turns: number;
}>;
/** Load a saved voice session by ID */
export declare function getVoiceSession(sessionId: string): VoiceSession | null;
//# sourceMappingURL=voice-realtime.d.ts.map