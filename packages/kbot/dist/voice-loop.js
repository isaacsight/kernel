// kbot Voice Loop — Full voice conversation loop
//
// Continuous voice conversation: listen → transcribe → think → speak → loop
//
// Uses:
//   - macOS `say` for text-to-speech (free, pre-installed)
//   - `rec` (sox) or macOS `rec` for audio recording
//   - Whisper API (OpenAI) or local whisper.cpp for speech-to-text
//   - Ollama at localhost:11434 for agent inference
//
// Usage:
//   import { runVoiceLoop } from './voice-loop.js'
//   await runVoiceLoop({ voice: 'Samantha', model: 'base', agent: 'auto' })
import { execSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, unlinkSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import chalk from 'chalk';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const KBOT_DIR = join(homedir(), '.kbot');
const VOICE_LOG_DIR = join(KBOT_DIR, 'voice-logs');
const OLLAMA_HOST_DEFAULT = process.env.OLLAMA_HOST || 'http://localhost:11434';
const ACCENT = chalk.hex('#A78BFA');
const DIM = chalk.dim;
// ---------------------------------------------------------------------------
// Platform detection
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
function detectWhisperBackend(openaiKey) {
    // Prefer local whisper.cpp (free, private)
    if (commandExists('whisper') || commandExists('whisper.cpp') || commandExists('whisper-cpp'))
        return 'local';
    // Fallback to OpenAI Whisper API
    if (openaiKey)
        return 'api';
    // Try loading from kbot config
    const configKey = loadOpenAIKeyFromConfig();
    if (configKey)
        return 'api';
    return 'none';
}
function detectTTS() {
    return process.platform === 'darwin' && commandExists('say');
}
function loadOpenAIKeyFromConfig() {
    const configPath = join(KBOT_DIR, 'config.json');
    if (!existsSync(configPath))
        return null;
    try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        // OpenAI key may be stored under 'openai' provider
        if (config.providers?.openai?.apiKey)
            return config.providers.openai.apiKey;
        if (config.apiKey && config.provider === 'openai')
            return config.apiKey;
    }
    catch { /* ignore */ }
    return null;
}
// ---------------------------------------------------------------------------
// Text cleaning for TTS
// ---------------------------------------------------------------------------
function stripMarkdownForSpeech(text) {
    let cleaned = text;
    // Replace code blocks with spoken description
    cleaned = cleaned.replace(/```(\w+)?\n[\s\S]*?```/g, (_match, lang) => lang ? `Here's a ${lang} code snippet.` : 'Here\'s a code snippet.');
    // Remove inline code backticks
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
    // Remove heading markers
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
    // Remove bold/italic markers
    cleaned = cleaned.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
    cleaned = cleaned.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');
    // Remove links — keep label
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // Remove images
    cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
    // Remove blockquote markers
    cleaned = cleaned.replace(/^>\s+/gm, '');
    // Remove list markers
    cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, '');
    cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, '');
    // Collapse whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    return cleaned.trim();
}
function sanitizeForShell(text) {
    return text.replace(/[;&|`$(){}[\]!#\\]/g, '');
}
// ---------------------------------------------------------------------------
// Audio recording
// ---------------------------------------------------------------------------
async function recordAudio(outputPath, recorder, maxSeconds, silenceThreshold) {
    return new Promise((resolve) => {
        let proc;
        if (recorder === 'rec') {
            // sox rec: 16kHz mono WAV, stop on silence after speech detected
            // silence 1 0.1 3% = start recording after sound above 3%
            // silence 1 2.0 3% = stop recording after 2s of silence below 3%
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
            // arecord: record 16kHz mono WAV with fixed duration
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
            resolve(existsSync(outputPath));
        });
        proc.on('error', () => {
            clearTimeout(timeout);
            resolve(false);
        });
    });
}
// ---------------------------------------------------------------------------
// Speech-to-text (Whisper)
// ---------------------------------------------------------------------------
function getLocalWhisperCommand() {
    if (commandExists('whisper'))
        return 'whisper';
    if (commandExists('whisper.cpp'))
        return 'whisper.cpp';
    if (commandExists('whisper-cpp'))
        return 'whisper-cpp';
    return null;
}
async function transcribeLocal(audioPath, model, language) {
    const cmd = getLocalWhisperCommand();
    if (!cmd)
        throw new Error('No local whisper binary found');
    // whisper.cpp and openai-whisper have slightly different flags
    // Both support --model and --language
    const output = execSync(`${cmd} "${audioPath}" --model ${model} --language ${language} --output_format txt 2>/dev/null`, { encoding: 'utf-8', timeout: 60_000 }).trim();
    return output;
}
async function transcribeWithAPI(audioPath, apiKey, language) {
    // Use OpenAI Whisper API via curl (no external deps needed)
    const output = execSync(`curl -s https://api.openai.com/v1/audio/transcriptions ` +
        `-H "Authorization: Bearer ${apiKey}" ` +
        `-F "file=@${audioPath}" ` +
        `-F "model=whisper-1" ` +
        `-F "language=${language}" ` +
        `-F "response_format=text"`, { encoding: 'utf-8', timeout: 30_000 }).trim();
    return output;
}
async function transcribe(audioPath, state, openaiKey) {
    // Try local whisper first
    if (state.whisperBackend === 'local') {
        try {
            const text = await transcribeLocal(audioPath, state.model, state.language);
            if (text)
                return { text, source: 'whisper-local' };
        }
        catch {
            // Fall through to API
        }
    }
    // Try OpenAI Whisper API
    const key = openaiKey || loadOpenAIKeyFromConfig();
    if (key) {
        try {
            const text = await transcribeWithAPI(audioPath, key, state.language);
            if (text)
                return { text, source: 'whisper-api' };
        }
        catch {
            // Fall through to text input
        }
    }
    return { text: '', source: 'text-fallback' };
}
// ---------------------------------------------------------------------------
// Text-to-speech
// ---------------------------------------------------------------------------
async function speakText(text, voice, rate) {
    if (!detectTTS())
        return;
    const cleaned = sanitizeForShell(stripMarkdownForSpeech(text));
    if (!cleaned)
        return;
    return new Promise((resolve) => {
        const proc = spawn('say', ['-v', voice, '-r', String(rate), cleaned], {
            stdio: 'ignore',
        });
        proc.on('close', () => resolve());
        proc.on('error', () => resolve());
    });
}
// ---------------------------------------------------------------------------
// Ollama chat
// ---------------------------------------------------------------------------
async function chatWithOllama(message, conversationHistory, ollamaHost, ollamaModel, agent) {
    const systemPrompt = buildVoiceSystemPrompt(agent);
    const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-10), // Keep last 10 turns for context
        { role: 'user', content: message },
    ];
    const body = JSON.stringify({
        model: ollamaModel,
        messages,
        stream: false,
        options: {
            temperature: 0.7,
            num_predict: 500, // Keep responses concise for voice
        },
    });
    const res = await fetch(`${ollamaHost}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Ollama returned ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.message?.content?.trim() || '(no response)';
}
function buildVoiceSystemPrompt(agent) {
    const base = [
        'You are kbot, a helpful AI assistant in a voice conversation.',
        'Keep your responses concise and conversational — the user is listening, not reading.',
        'Avoid code blocks, markdown formatting, and long lists.',
        'Prefer short, direct answers. If a topic needs detail, ask if the user wants to go deeper.',
        'Speak naturally, as if having a face-to-face conversation.',
    ];
    if (agent !== 'auto') {
        base.push(`You are acting as the "${agent}" specialist agent.`);
    }
    return base.join(' ');
}
// ---------------------------------------------------------------------------
// Ollama availability check
// ---------------------------------------------------------------------------
async function checkOllama(host) {
    try {
        const res = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
    }
    catch {
        return false;
    }
}
// ---------------------------------------------------------------------------
// Text input fallback
// ---------------------------------------------------------------------------
function readlineInput(prompt) {
    return new Promise((resolve) => {
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}
// ---------------------------------------------------------------------------
// Voice session logging
// ---------------------------------------------------------------------------
function ensureLogDir() {
    if (!existsSync(VOICE_LOG_DIR))
        mkdirSync(VOICE_LOG_DIR, { recursive: true });
}
function logVoiceSession(history) {
    ensureLogDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logPath = join(VOICE_LOG_DIR, `voice-${timestamp}.json`);
    try {
        writeFileSync(logPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            turns: history.length,
            conversation: history,
        }, null, 2));
    }
    catch { /* non-critical */ }
}
// ---------------------------------------------------------------------------
// Initialize state
// ---------------------------------------------------------------------------
function initState(options) {
    const openaiKey = options?.openaiApiKey || loadOpenAIKeyFromConfig() || undefined;
    return {
        running: false,
        voice: options?.voice ?? 'Samantha',
        model: options?.model ?? 'base',
        agent: options?.agent ?? 'auto',
        language: options?.language ?? 'en',
        rate: options?.rate ?? 190,
        maxRecordSeconds: options?.maxRecordSeconds ?? 15,
        silenceThreshold: options?.silenceThreshold ?? '1.5',
        ollamaHost: options?.ollamaHost ?? OLLAMA_HOST_DEFAULT,
        ollamaModel: options?.ollamaModel ?? 'gemma3:12b',
        whisperBackend: detectWhisperBackend(openaiKey),
        recorder: detectRecorder(),
        ttsAvailable: detectTTS(),
        turnCount: 0,
        conversationHistory: [],
    };
}
// ---------------------------------------------------------------------------
// Print status
// ---------------------------------------------------------------------------
function printVoiceStatus(state) {
    console.log();
    console.log(ACCENT.bold('  kbot Voice Loop'));
    console.log(ACCENT('  ' + '='.repeat(40)));
    console.log();
    console.log(`  ${DIM('TTS:')}        ${state.ttsAvailable ? chalk.green('say') + DIM(` (${state.voice}, ${state.rate} wpm)`) : chalk.red('unavailable')}`);
    console.log(`  ${DIM('STT:')}        ${state.whisperBackend === 'local' ? chalk.green('whisper (local)') : state.whisperBackend === 'api' ? chalk.yellow('OpenAI Whisper API') : chalk.red('unavailable')}`);
    console.log(`  ${DIM('Recorder:')}   ${state.recorder !== 'none' ? chalk.green(state.recorder) : chalk.red('none — will use text input')}`);
    console.log(`  ${DIM('LLM:')}        ${chalk.cyan(`${state.ollamaModel} @ ${state.ollamaHost}`)}`);
    console.log(`  ${DIM('Agent:')}      ${chalk.cyan(state.agent)}`);
    console.log(`  ${DIM('Language:')}   ${state.language}`);
    console.log();
    console.log(DIM('  Say "exit", "quit", or "goodbye" to end the conversation.'));
    console.log(DIM('  Press Ctrl+C to stop at any time.'));
    console.log();
}
// ---------------------------------------------------------------------------
// Main: runVoiceLoop
// ---------------------------------------------------------------------------
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
export async function runVoiceLoop(options) {
    const state = initState(options);
    // Check Ollama availability
    const ollamaUp = await checkOllama(state.ollamaHost);
    if (!ollamaUp) {
        console.error(chalk.red(`\n  Ollama is not running at ${state.ollamaHost}`));
        console.error(chalk.yellow('  Start Ollama with: ollama serve'));
        console.error(chalk.yellow(`  Then pull a model: ollama pull ${state.ollamaModel}`));
        return;
    }
    printVoiceStatus(state);
    state.running = true;
    // Handle Ctrl+C gracefully
    const cleanup = () => {
        if (state.running) {
            state.running = false;
            console.log(chalk.dim('\n\n  Voice loop ended.'));
            logVoiceSession(state.conversationHistory);
        }
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    // Greeting
    const greeting = 'Hey! I\'m kbot. What can I help you with?';
    console.log(ACCENT(`  kbot: `) + greeting);
    if (state.ttsAvailable) {
        await speakText(greeting, state.voice, state.rate);
    }
    // Main conversation loop
    while (state.running) {
        let userText;
        // Step 1: Get user input (audio or text)
        if (state.recorder !== 'none' && state.whisperBackend !== 'none') {
            // Audio path
            console.log(chalk.cyan('\n  \uD83C\uDF99  Listening...'));
            const tempFile = join(tmpdir(), `kbot-voice-${Date.now()}.wav`);
            try {
                const recorded = await recordAudio(tempFile, state.recorder, state.maxRecordSeconds, state.silenceThreshold);
                if (!recorded || !existsSync(tempFile)) {
                    console.log(chalk.yellow('  No audio captured. Type your message instead:'));
                    userText = await readlineInput(chalk.cyan('  You: '));
                }
                else {
                    // Step 2: Transcribe
                    process.stdout.write(DIM('  Transcribing...'));
                    const result = await transcribe(tempFile, state, options?.openaiApiKey);
                    if (result.text) {
                        process.stdout.write(`\r  ${DIM('[')}${DIM(result.source)}${DIM(']')} `);
                        console.log(chalk.white(result.text));
                        userText = result.text;
                    }
                    else {
                        console.log(chalk.yellow('\r  Could not transcribe. Type your message instead:'));
                        userText = await readlineInput(chalk.cyan('  You: '));
                    }
                }
                // Clean up temp file
                try {
                    if (existsSync(tempFile))
                        unlinkSync(tempFile);
                }
                catch { /* ignore */ }
            }
            catch {
                console.log(chalk.yellow('  Recording error. Type your message instead:'));
                userText = await readlineInput(chalk.cyan('  You: '));
            }
        }
        else {
            // Text-only mode
            userText = await readlineInput(chalk.cyan('\n  You: '));
        }
        if (!userText || !state.running)
            continue;
        // Check for exit commands
        const exitCommands = ['exit', 'quit', 'goodbye', 'bye', 'stop', 'end'];
        if (exitCommands.includes(userText.toLowerCase().trim())) {
            const farewell = 'Goodbye! Talk to you later.';
            console.log(ACCENT('  kbot: ') + farewell);
            if (state.ttsAvailable) {
                await speakText(farewell, state.voice, state.rate);
            }
            state.running = false;
            break;
        }
        // Step 3: Route to Ollama
        state.conversationHistory.push({ role: 'user', content: userText });
        state.turnCount++;
        process.stdout.write(DIM('  Thinking...'));
        try {
            const response = await chatWithOllama(userText, state.conversationHistory, state.ollamaHost, state.ollamaModel, state.agent);
            // Clear "Thinking..." line
            process.stdout.write('\r' + ' '.repeat(40) + '\r');
            // Step 4: Display and speak the response
            console.log(ACCENT('  kbot: ') + response);
            state.conversationHistory.push({ role: 'assistant', content: response });
            // Step 5: Speak
            if (state.ttsAvailable) {
                await speakText(response, state.voice, state.rate);
            }
        }
        catch (err) {
            process.stdout.write('\r' + ' '.repeat(40) + '\r');
            const message = err instanceof Error ? err.message : String(err);
            console.log(chalk.red(`  Error: ${message}`));
            // Try to speak the error
            if (state.ttsAvailable) {
                await speakText('Sorry, I encountered an error. Please try again.', state.voice, state.rate);
            }
        }
    }
    // Save session log
    logVoiceSession(state.conversationHistory);
    process.removeListener('SIGINT', cleanup);
    process.removeListener('SIGTERM', cleanup);
}
// ---------------------------------------------------------------------------
// Utility exports
// ---------------------------------------------------------------------------
/** Get the current voice loop state description (for diagnostics) */
export function describeVoiceCapabilities() {
    const state = initState();
    const lines = [
        'Voice Loop Capabilities:',
        `  TTS: ${state.ttsAvailable ? 'available (macOS say)' : 'unavailable'}`,
        `  STT: ${state.whisperBackend === 'local' ? 'whisper (local)' : state.whisperBackend === 'api' ? 'OpenAI API' : 'unavailable'}`,
        `  Recorder: ${state.recorder !== 'none' ? state.recorder : 'unavailable'}`,
    ];
    return lines.join('\n');
}
/** List available macOS voices */
export function listMacVoices() {
    if (process.platform !== 'darwin')
        return [];
    try {
        const output = execSync('say -v ?', { encoding: 'utf-8' });
        return output
            .split('\n')
            .filter(Boolean)
            .map((line) => {
            const match = line.match(/^(\S+)/);
            return match ? match[1] : '';
        })
            .filter(Boolean);
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=voice-loop.js.map