export interface VoiceLoopOptions {
    /** macOS TTS voice name (default: 'Samantha') */
    voice?: string;
    /** Whisper model size: 'tiny' | 'base' | 'small' | 'medium' | 'large' (default: 'base') */
    model?: WhisperModel;
    /** kbot agent to route to: 'auto' uses agent routing, or specify a specialist (default: 'auto') */
    agent?: string;
    /** Language code for Whisper transcription (default: 'en') */
    language?: string;
    /** TTS speech rate in words per minute (default: 190) */
    rate?: number;
    /** Maximum recording duration in seconds (default: 15) */
    maxRecordSeconds?: number;
    /** Silence threshold for recording stop — sox silence detection (default: '1.5') */
    silenceThreshold?: string;
    /** Ollama host URL (default: from OLLAMA_HOST env or 'http://localhost:11434') */
    ollamaHost?: string;
    /** Ollama model for chat (default: 'gemma3:12b') */
    ollamaModel?: string;
    /** OpenAI API key for Whisper fallback (reads from config if not provided) */
    openaiApiKey?: string;
}
export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large';
export interface VoiceLoopState {
    running: boolean;
    voice: string;
    model: WhisperModel;
    agent: string;
    language: string;
    rate: number;
    maxRecordSeconds: number;
    silenceThreshold: string;
    ollamaHost: string;
    ollamaModel: string;
    whisperBackend: 'local' | 'api' | 'none';
    recorder: 'rec' | 'arecord' | 'none';
    ttsAvailable: boolean;
    turnCount: number;
    conversationHistory: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
}
/**
 * Run the kbot voice conversation loop.
 *
 * 1. Print status banner
 * 2. Record audio until silence detected (or accept text input)
 * 3. Transcribe with Whisper (local or API)
 * 4. Route to Ollama for agent inference
 * 5. Speak the response with macOS `say`
 * 6. Loop back to step 2
 */
export declare function runVoiceLoop(options?: VoiceLoopOptions): Promise<void>;
/** Get the current voice loop state description (for diagnostics) */
export declare function describeVoiceCapabilities(): string;
/** List available macOS voices */
export declare function listMacVoices(): string[];
//# sourceMappingURL=voice-loop.d.ts.map