import { type ChildProcess } from 'node:child_process';
export interface VoiceOptions {
    /** TTS voice name (macOS: Alex, Samantha, etc. / Voxtral: voxtral-default, voxtral-expressive) */
    voice?: string;
    /** TTS speech rate (words per minute, default: 200) */
    rate?: number;
    /** Enable TTS output (default: true) */
    tts?: boolean;
    /** Enable STT input (default: false — requires whisper) */
    stt?: boolean;
}
export interface VoiceState {
    enabled: boolean;
    ttsProcess?: ChildProcess;
    sttAvailable: boolean;
    voice: string;
    rate: number;
}
export declare function initVoice(options?: VoiceOptions): VoiceState;
export declare function speak(text: string, state: VoiceState): Promise<void>;
export declare function stopSpeaking(state: VoiceState): void;
export declare function listen(state: VoiceState): Promise<string>;
export declare function listVoices(): string[];
export declare function formatVoiceStatus(state: VoiceState): string;
//# sourceMappingURL=voice.d.ts.map