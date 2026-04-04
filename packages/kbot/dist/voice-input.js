// kbot Voice Input — Local-first speech-to-text foundation
//
// Push-to-talk flow: start recording → transcribe locally → return text
//
// Transcription backends (priority order):
//   1. whisper.cpp / openai-whisper CLI binary (fully local, $0)
//   2. Ollama with a whisper-compatible model (fully local, $0)
//   3. Falls back to text input if neither is available
//
// Recording backends:
//   - macOS: `rec` (sox) — 16kHz mono WAV with silence detection
//   - Linux: `arecord` (ALSA) — 16kHz mono WAV with fixed duration
//
// No cloud APIs. No subscriptions. BYOK philosophy.
//
// Usage:
//   import { getVoiceInput, checkVoiceInputStatus } from './voice-input.js'
//   const text = await getVoiceInput()          // record + transcribe
//   const status = await checkVoiceInputStatus() // check readiness
import { execSync, spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, unlinkSync, mkdirSync, statSync } from 'node:fs';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const KBOT_DIR = join(homedir(), '.kbot');
const VOICE_TMP_DIR = join(KBOT_DIR, 'voice-tmp');
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
// ---------------------------------------------------------------------------
// Platform detection helpers
// ---------------------------------------------------------------------------
function commandExists(cmd) {
    try {
        execSync(`which ${cmd}`, { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
function detectRecorder() {
    if (commandExists('rec'))
        return 'rec';
    if (commandExists('arecord'))
        return 'arecord';
    return 'none';
}
function getWhisperCliPath() {
    // Check common binary names in priority order
    for (const cmd of ['whisper', 'whisper.cpp', 'whisper-cpp']) {
        if (commandExists(cmd))
            return cmd;
    }
    return null;
}
async function isOllamaReachable(host) {
    try {
        const res = await fetch(`${host}/api/tags`, {
            signal: AbortSignal.timeout(3000),
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
async function ollamaHasWhisperModel(host, modelName) {
    try {
        const res = await fetch(`${host}/api/tags`, {
            signal: AbortSignal.timeout(3000),
        });
        if (!res.ok)
            return false;
        const data = await res.json();
        if (!data.models)
            return false;
        return data.models.some(m => m.name.toLowerCase().includes(modelName.toLowerCase()));
    }
    catch {
        return false;
    }
}
function detectTranscriber(whisperCli, ollamaWhisper) {
    if (whisperCli)
        return 'whisper-cli';
    if (ollamaWhisper)
        return 'ollama';
    return 'none';
}
// ---------------------------------------------------------------------------
// Audio recording
// ---------------------------------------------------------------------------
function ensureVoiceTmpDir() {
    if (!existsSync(VOICE_TMP_DIR)) {
        mkdirSync(VOICE_TMP_DIR, { recursive: true });
    }
}
function generateTmpPath() {
    ensureVoiceTmpDir();
    const id = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return join(VOICE_TMP_DIR, `${id}.wav`);
}
function cleanupFile(path) {
    try {
        if (existsSync(path))
            unlinkSync(path);
    }
    catch {
        // best effort cleanup
    }
}
/**
 * Record audio from the microphone.
 * Returns the path to the recorded WAV file, or null if recording failed.
 */
async function recordAudio(outputPath, recorder, maxSeconds, silenceThreshold) {
    if (recorder === 'none')
        return false;
    return new Promise((resolve) => {
        let proc;
        if (recorder === 'rec') {
            // sox rec: 16kHz mono WAV, auto-stop on silence after speech
            // silence 1 0.1 <threshold>% = start recording after sound above threshold
            // silence 1 2.0 <threshold>% = stop recording after 2s silence below threshold
            proc = spawn('rec', [
                outputPath,
                'rate', '16k',
                'channels', '1',
                'silence', '1', '0.1', `${silenceThreshold}%`,
                '1', '2.0', `${silenceThreshold}%`,
                'trim', '0', String(maxSeconds),
            ], {
                stdio: ['ignore', 'ignore', 'ignore'],
            });
        }
        else {
            // arecord: fixed-duration recording at 16kHz mono
            proc = spawn('arecord', [
                '-f', 'S16_LE',
                '-r', '16000',
                '-c', '1',
                '-d', String(maxSeconds),
                outputPath,
            ], {
                stdio: ['ignore', 'ignore', 'ignore'],
            });
        }
        // Safety timeout — kill if recording hangs
        const timeout = setTimeout(() => {
            proc.kill('SIGTERM');
        }, (maxSeconds + 5) * 1000);
        proc.on('close', () => {
            clearTimeout(timeout);
            // Verify the file exists and has content (not just a header)
            if (existsSync(outputPath)) {
                try {
                    const stat = statSync(outputPath);
                    resolve(stat.size > 44); // WAV header is 44 bytes; need actual audio data
                }
                catch {
                    resolve(false);
                }
            }
            else {
                resolve(false);
            }
        });
        proc.on('error', () => {
            clearTimeout(timeout);
            resolve(false);
        });
    });
}
// ---------------------------------------------------------------------------
// Transcription — whisper.cpp CLI
// ---------------------------------------------------------------------------
function transcribeWithWhisperCli(audioPath, whisperCmd, model, language) {
    // Both whisper.cpp and openai-whisper support --model and --language
    // whisper.cpp outputs to stdout with --output_format txt
    const output = execSync(`${whisperCmd} "${audioPath}" --model ${model} --language ${language} --output_format txt 2>/dev/null`, { encoding: 'utf-8', timeout: 120_000 }).trim();
    return output;
}
// ---------------------------------------------------------------------------
// Transcription — Ollama (whisper-compatible audio model)
// ---------------------------------------------------------------------------
async function transcribeWithOllama(audioPath, host, modelName) {
    // Ollama doesn't have a native whisper endpoint as of 2026-03.
    // But some audio-capable models can transcribe when given a base64-encoded
    // audio file as an "image" (multimodal input). This is the pattern used by
    // models like whisper variants on Ollama.
    //
    // If the model supports the /api/generate endpoint with images, we send
    // the audio as a base64 payload. If not, we fall back to asking the model
    // to transcribe (text-only, which won't work for actual audio).
    const { readFileSync } = await import('node:fs');
    const audioBytes = readFileSync(audioPath);
    const audioBase64 = audioBytes.toString('base64');
    const res = await fetch(`${host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: modelName,
            prompt: 'Transcribe this audio to text. Return only the transcription, no commentary.',
            images: [audioBase64],
            stream: false,
        }),
        signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
        const err = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(`Ollama transcription failed: ${err}`);
    }
    const data = await res.json();
    return (data.response || '').trim();
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Check voice input system status — microphone, transcription engine, models.
 * Call this to diagnose issues before recording.
 */
export async function checkVoiceInputStatus(options) {
    const host = options?.ollamaHost || OLLAMA_HOST;
    const whisperModel = options?.ollamaWhisperModel || 'whisper';
    const recorder = detectRecorder();
    const whisperCli = getWhisperCliPath();
    const ollamaReachable = await isOllamaReachable(host);
    const ollamaHasWhisper = ollamaReachable
        ? await ollamaHasWhisperModel(host, whisperModel)
        : false;
    const transcriber = detectTranscriber(whisperCli, ollamaHasWhisper);
    const issues = [];
    const suggestions = [];
    // Check recorder
    if (recorder === 'none') {
        issues.push('No audio recorder found (need `rec` from sox or `arecord` from ALSA)');
        if (process.platform === 'darwin') {
            suggestions.push('Install sox: brew install sox');
        }
        else {
            suggestions.push('Install sox: sudo apt install sox   OR   sudo apt install alsa-utils');
        }
    }
    // Check transcriber
    if (transcriber === 'none') {
        issues.push('No transcription engine found');
        suggestions.push('Install whisper.cpp: brew install whisper-cpp   (macOS)');
        suggestions.push('Or pull a whisper model in Ollama: ollama pull whisper');
        suggestions.push('Or install openai-whisper: pip install openai-whisper');
    }
    // Ollama status
    if (!ollamaReachable) {
        suggestions.push(`Ollama not reachable at ${host}. Start it: ollama serve`);
    }
    else if (!ollamaHasWhisper) {
        suggestions.push(`Ollama running but no whisper model found. Pull one: ollama pull whisper`);
    }
    const available = recorder !== 'none' && transcriber !== 'none';
    return {
        available,
        recorder,
        transcriber,
        whisperCliPath: whisperCli,
        ollamaReachable,
        ollamaHasWhisper,
        issues,
        suggestions,
    };
}
/**
 * Record audio from the microphone and transcribe it locally.
 * Returns the transcribed text.
 *
 * This is the main entry point — call this for push-to-talk.
 *
 * @throws Error if no recorder or transcriber is available
 */
export async function getVoiceInput(options) {
    const model = options?.model ?? 'base';
    const language = options?.language ?? 'en';
    const maxRecordSeconds = options?.maxRecordSeconds ?? 15;
    const silenceThreshold = options?.silenceThreshold ?? '1.5';
    const ollamaHost = options?.ollamaHost ?? OLLAMA_HOST;
    const ollamaWhisperModel = options?.ollamaWhisperModel ?? 'whisper';
    // Detect available backends
    const recorder = detectRecorder();
    if (recorder === 'none') {
        throw new Error('No audio recorder found. Install sox (brew install sox) or alsa-utils (sudo apt install alsa-utils).');
    }
    const whisperCli = getWhisperCliPath();
    const ollamaReachable = await isOllamaReachable(ollamaHost);
    const ollamaWhisper = ollamaReachable
        ? await ollamaHasWhisperModel(ollamaHost, ollamaWhisperModel)
        : false;
    const transcriber = detectTranscriber(whisperCli, ollamaWhisper);
    if (transcriber === 'none') {
        throw new Error('No transcription engine available.\n' +
            'Install one of:\n' +
            '  - whisper.cpp: brew install whisper-cpp\n' +
            '  - openai-whisper: pip install openai-whisper\n' +
            '  - Ollama whisper: ollama pull whisper');
    }
    // Record
    const audioPath = generateTmpPath();
    const startTime = Date.now();
    const recorded = await recordAudio(audioPath, recorder, maxRecordSeconds, silenceThreshold);
    if (!recorded) {
        cleanupFile(audioPath);
        throw new Error('Recording failed — no audio captured. Check microphone permissions and that the mic is connected.');
    }
    // Transcribe
    let text = '';
    let source = transcriber;
    try {
        if (transcriber === 'whisper-cli' && whisperCli) {
            text = transcribeWithWhisperCli(audioPath, whisperCli, model, language);
        }
        else if (transcriber === 'ollama') {
            text = await transcribeWithOllama(audioPath, ollamaHost, ollamaWhisperModel);
        }
    }
    catch (err) {
        // If primary transcriber fails, try fallback
        if (transcriber === 'whisper-cli' && ollamaWhisper) {
            try {
                text = await transcribeWithOllama(audioPath, ollamaHost, ollamaWhisperModel);
                source = 'ollama';
            }
            catch {
                cleanupFile(audioPath);
                throw new Error(`Transcription failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        else {
            cleanupFile(audioPath);
            throw new Error(`Transcription failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    const durationMs = Date.now() - startTime;
    // Clean up the temp audio file
    cleanupFile(audioPath);
    if (!text) {
        throw new Error('Transcription returned empty text — microphone may not have captured speech.');
    }
    return {
        text: text.trim(),
        source,
        durationMs,
        audioFile: null, // cleaned up
    };
}
/**
 * Quick check: can voice input work right now?
 * Returns true if both a recorder and transcriber are available.
 */
export async function isVoiceInputAvailable(options) {
    const status = await checkVoiceInputStatus(options);
    return status.available;
}
//# sourceMappingURL=voice-input.js.map