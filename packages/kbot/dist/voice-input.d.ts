export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large';
export type TranscriptionBackend = 'whisper-cli' | 'ollama' | 'none';
export type RecorderBackend = 'rec' | 'arecord' | 'none';
export interface VoiceInputOptions {
    /** Whisper model size (default: 'base') */
    model?: WhisperModel;
    /** Language code for transcription (default: 'en') */
    language?: string;
    /** Max recording duration in seconds (default: 15) */
    maxRecordSeconds?: number;
    /** Silence threshold for sox-based recording stop, as a percentage (default: '1.5') */
    silenceThreshold?: string;
    /** Ollama host URL (default: OLLAMA_HOST env or 'http://localhost:11434') */
    ollamaHost?: string;
    /** Ollama whisper model name (default: 'whisper') */
    ollamaWhisperModel?: string;
}
export interface VoiceInputStatus {
    available: boolean;
    recorder: RecorderBackend;
    transcriber: TranscriptionBackend;
    whisperCliPath: string | null;
    ollamaReachable: boolean;
    ollamaHasWhisper: boolean;
    issues: string[];
    suggestions: string[];
}
export interface TranscriptionResult {
    text: string;
    source: TranscriptionBackend;
    durationMs: number;
    audioFile: string | null;
}
/**
 * Check voice input system status — microphone, transcription engine, models.
 * Call this to diagnose issues before recording.
 */
export declare function checkVoiceInputStatus(options?: Pick<VoiceInputOptions, 'ollamaHost' | 'ollamaWhisperModel'>): Promise<VoiceInputStatus>;
/**
 * Record audio from the microphone and transcribe it locally.
 * Returns the transcribed text.
 *
 * This is the main entry point — call this for push-to-talk.
 *
 * @throws Error if no recorder or transcriber is available
 */
export declare function getVoiceInput(options?: VoiceInputOptions): Promise<TranscriptionResult>;
/**
 * Quick check: can voice input work right now?
 * Returns true if both a recorder and transcriber are available.
 */
export declare function isVoiceInputAvailable(options?: Pick<VoiceInputOptions, 'ollamaHost' | 'ollamaWhisperModel'>): Promise<boolean>;
//# sourceMappingURL=voice-input.d.ts.map