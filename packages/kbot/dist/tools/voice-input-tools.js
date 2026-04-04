// kbot Voice Input Tools — Agent-accessible push-to-talk transcription
//
// Exposes local voice input to kbot's tool system so agents can:
//   - Listen and transcribe speech via push-to-talk
//   - Check voice input availability (mic, whisper model, recorder)
//
// Fully local — no cloud APIs. Uses whisper.cpp or Ollama whisper.
import { registerTool } from './index.js';
import { getVoiceInput, checkVoiceInputStatus } from '../voice-input.js';
export function registerVoiceInputTools() {
    // ── voice_listen ──
    // Start listening and return transcribed text
    registerTool({
        name: 'voice_listen',
        description: 'Listen via microphone and transcribe speech to text using local whisper. Push-to-talk: records until silence is detected (up to max duration), then transcribes locally at $0 cost. Requires sox (rec) and whisper.cpp or Ollama whisper model. Returns the transcribed text.',
        parameters: {
            model: {
                type: 'string',
                description: 'Whisper model size: tiny, base, small, medium, large (default: base). Larger = more accurate but slower.',
                required: false,
                default: 'base',
            },
            language: {
                type: 'string',
                description: 'Language code for transcription (default: en). Examples: en, es, fr, de, ja, zh',
                required: false,
                default: 'en',
            },
            max_seconds: {
                type: 'number',
                description: 'Maximum recording duration in seconds (default: 15). Recording auto-stops on silence.',
                required: false,
                default: 15,
            },
            silence_threshold: {
                type: 'string',
                description: 'Silence detection threshold as percentage for sox (default: 1.5). Lower = more sensitive.',
                required: false,
                default: '1.5',
            },
        },
        tier: 'free',
        timeout: 180_000, // 3 min — recording (up to 15s) + transcription (up to 2 min)
        execute: async (args) => {
            const model = args.model || 'base';
            const language = args.language || 'en';
            const maxSeconds = args.max_seconds || 15;
            const silenceThreshold = args.silence_threshold || '1.5';
            // Validate model
            const validModels = ['tiny', 'base', 'small', 'medium', 'large'];
            if (!validModels.includes(model)) {
                return `Error: invalid model "${model}". Choose from: ${validModels.join(', ')}`;
            }
            try {
                const result = await getVoiceInput({
                    model: model,
                    language,
                    maxRecordSeconds: maxSeconds,
                    silenceThreshold,
                });
                const lines = [
                    `Transcription: ${result.text}`,
                    '',
                    `  Backend: ${result.source}`,
                    `  Duration: ${result.durationMs}ms`,
                    `  Language: ${language}`,
                    `  Model: ${model}`,
                ];
                return lines.join('\n');
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                // If it's a setup issue, include helpful guidance
                if (message.includes('No audio recorder') || message.includes('No transcription engine')) {
                    const status = await checkVoiceInputStatus();
                    const guidance = [
                        `Error: ${message}`,
                        '',
                        'Setup suggestions:',
                        ...status.suggestions.map(s => `  - ${s}`),
                    ];
                    return guidance.join('\n');
                }
                return `Error: ${message}`;
            }
        },
    });
    // ── voice_status ──
    // Check if voice input is available (mic permissions, whisper model)
    registerTool({
        name: 'voice_status',
        description: 'Check voice input readiness — reports whether a microphone recorder (sox/arecord) and transcription engine (whisper.cpp/Ollama whisper) are available. Lists any issues and installation suggestions. Call this before voice_listen to diagnose problems.',
        parameters: {},
        tier: 'free',
        execute: async () => {
            const status = await checkVoiceInputStatus();
            const lines = [
                'Voice Input Status',
                '══════════════════',
                `Available: ${status.available ? 'YES' : 'NO'}`,
                '',
                'Recorder:',
                `  Backend: ${status.recorder === 'none' ? 'NOT FOUND' : status.recorder}`,
                ...(status.recorder === 'rec' ? ['  (sox rec — silence detection, auto-stop)'] : []),
                ...(status.recorder === 'arecord' ? ['  (ALSA arecord — fixed duration)'] : []),
                '',
                'Transcription:',
                `  Backend: ${status.transcriber === 'none' ? 'NOT FOUND' : status.transcriber}`,
                ...(status.whisperCliPath ? [`  Whisper CLI: ${status.whisperCliPath}`] : []),
                `  Ollama reachable: ${status.ollamaReachable ? 'yes' : 'no'}`,
                `  Ollama whisper model: ${status.ollamaHasWhisper ? 'yes' : 'no'}`,
            ];
            if (status.issues.length > 0) {
                lines.push('', 'Issues:');
                for (const issue of status.issues) {
                    lines.push(`  ! ${issue}`);
                }
            }
            if (status.suggestions.length > 0) {
                lines.push('', 'Suggestions:');
                for (const suggestion of status.suggestions) {
                    lines.push(`  - ${suggestion}`);
                }
            }
            if (status.available) {
                lines.push('', 'Ready to use. Call voice_listen to start recording.');
            }
            return lines.join('\n');
        },
    });
} // end registerVoiceInputTools
//# sourceMappingURL=voice-input-tools.js.map