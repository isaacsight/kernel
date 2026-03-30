// kbot Voice Realtime — Bidirectional real-time voice conversation
//
// Real-time voice mode with natural turn-taking, VAD, streaming TTS,
// interrupt handling, and waveform visualization.
//
// Usage:
//   import { startRealtimeVoice } from './voice-realtime.js'
//   await startRealtimeVoice({ stt: 'whisper-local', tts: 'system', continuous: true })
import { execSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, unlinkSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import chalk from 'chalk';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const KBOT_DIR = join(homedir(), '.kbot');
const VOICE_DIR = join(KBOT_DIR, 'voice');
const ACCENT = chalk.hex('#A78BFA');
const DIM = chalk.dim;
const OLLAMA_DEFAULT = process.env.OLLAMA_HOST || 'http://localhost:11434';
const WAVE = [' ', '\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const has = (cmd) => {
    try {
        execSync(`which ${cmd}`, { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
};
const hasSox = () => has('sox') && has('rec');
const hasRec = () => has('rec') || has('arecord');
function loadKey(provider) {
    const p = join(KBOT_DIR, 'config.json');
    if (!existsSync(p))
        return null;
    try {
        const c = JSON.parse(readFileSync(p, 'utf-8'));
        return (c.providers?.[provider]?.apiKey || (c.provider === provider && c.apiKey) || null);
    }
    catch {
        return null;
    }
}
function detectSTT(preferred) {
    if (preferred === 'whisper-local' || preferred === 'whisper-api' || preferred === 'system')
        return preferred;
    if (has('whisper') || has('whisper.cpp') || has('whisper-cpp'))
        return 'whisper-local';
    if (loadKey('openai'))
        return 'whisper-api';
    return 'system';
}
function detectTTS(preferred) {
    if (preferred === 'system' || preferred === 'elevenlabs' || preferred === 'openai-tts')
        return preferred;
    if (process.platform === 'darwin' || has('espeak') || has('piper'))
        return 'system';
    if (loadKey('openai'))
        return 'openai-tts';
    if (loadKey('elevenlabs'))
        return 'elevenlabs';
    return 'system';
}
function stripMd(text) {
    return text
        .replace(/```(\w+)?\n[\s\S]*?```/g, (_, l) => l ? `Here's a ${l} snippet.` : 'Here\'s a code snippet.')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
        .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        .replace(/^>\s+/gm, '')
        .replace(/^[\s]*[-*+]\s+/gm, '')
        .replace(/^[\s]*\d+\.\s+/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
const shellSafe = (t) => t.replace(/[;&|`$(){}[\]!#\\]/g, '');
function splitSentences(text) {
    return (text.match(/[^.!?]+[.!?]+[\s]?|[^.!?]+$/g) || [text]).map(s => s.trim()).filter(Boolean);
}
// ---------------------------------------------------------------------------
// Waveform visualization
// ---------------------------------------------------------------------------
function showWaveform(volume) {
    const bars = [];
    for (let i = 0; i < 30; i++) {
        const v = Math.max(0, Math.min(1, volume + Math.sin(i * 0.5 + Date.now() * 0.001) * 0.3 * volume));
        bars.push(WAVE[Math.round(v * (WAVE.length - 1))]);
    }
    process.stdout.write(`\r  ${chalk.cyan('\uD83C\uDF99')} ${chalk.cyan(bars.join(''))} `);
}
function showStatus(status, extra) {
    const labels = {
        listening: chalk.cyan('\uD83C\uDF99  Listening...'),
        processing: chalk.yellow('\uD83D\uDD04 Processing...'),
        speaking: chalk.green('\uD83D\uDD0A Speaking...'),
        idle: chalk.dim('\u23F8  Idle'),
    };
    process.stdout.write(`\r${' '.repeat(80)}\r  ${labels[status]}${extra ? ` ${DIM(extra)}` : ''}`);
}
// ---------------------------------------------------------------------------
// Voice Activity Detection (VAD) via sox
// ---------------------------------------------------------------------------
class VAD {
    cfg;
    proc = null;
    speaking = false;
    silenceAt = 0;
    speechAt = 0;
    onStart;
    onEnd;
    onVol;
    constructor(cfg) { this.cfg = cfg; }
    start(cb) {
        this.onStart = cb.onStart;
        this.onEnd = cb.onEnd;
        this.onVol = cb.onVol;
        if (!hasSox())
            return;
        this.proc = spawn('rec', [
            '-q', '-r', String(this.cfg.sampleRate), '-c', '1',
            '-t', 'raw', '-b', '16', '-e', 'signed-integer', '-',
        ], { stdio: ['ignore', 'pipe', 'ignore'] });
        this.proc.stdout?.on('data', (chunk) => {
            let sum = 0;
            const n = chunk.length / 2;
            for (let i = 0; i < chunk.length - 1; i += 2) {
                const s = chunk.readInt16LE(i);
                sum += s * s;
            }
            const vol = Math.min(1, Math.sqrt(sum / (n || 1)) / 32768);
            this.onVol?.(vol);
            this.process(vol);
        });
    }
    process(vol) {
        const now = Date.now();
        if (!this.speaking) {
            if (vol > this.cfg.threshold) {
                this.speaking = true;
                this.speechAt = now;
                this.silenceAt = 0;
                this.onStart?.();
            }
        }
        else {
            if (vol < this.cfg.threshold) {
                if (!this.silenceAt)
                    this.silenceAt = now;
                else if (now - this.silenceAt >= this.cfg.silenceDuration * 1000) {
                    if ((now - this.speechAt) / 1000 >= this.cfg.minSpeechDuration)
                        this.onEnd?.();
                    this.speaking = false;
                    this.silenceAt = 0;
                }
            }
            else {
                this.silenceAt = 0;
            }
        }
    }
    stop() {
        this.proc?.kill('SIGTERM');
        this.proc = null;
        this.speaking = false;
    }
}
// ---------------------------------------------------------------------------
// Audio recording
// ---------------------------------------------------------------------------
async function record(path, maxSec, silenceSec) {
    return new Promise(resolve => {
        const proc = has('rec')
            ? spawn('rec', [
                path, 'rate', '16k', 'channels', '1',
                'silence', '1', '0.1', '1.5%', '1', String(silenceSec), '1.5%',
                'trim', '0', String(maxSec),
            ], { stdio: ['ignore', 'ignore', 'ignore'] })
            : spawn('arecord', [
                '-f', 'S16_LE', '-r', '16000', '-c', '1', '-d', String(maxSec), path,
            ], { stdio: ['ignore', 'ignore', 'ignore'] });
        const t = setTimeout(() => proc.kill('SIGTERM'), (maxSec + 3) * 1000);
        proc.on('close', () => { clearTimeout(t); resolve(existsSync(path)); });
        proc.on('error', () => { clearTimeout(t); resolve(false); });
    });
}
// ---------------------------------------------------------------------------
// STT engines (fallback chain)
// ---------------------------------------------------------------------------
async function sttLocal(path, lang) {
    const cmd = ['whisper', 'whisper.cpp', 'whisper-cpp'].find(has);
    if (!cmd)
        throw new Error('No whisper binary');
    return execSync(`${cmd} "${path}" --model base --language ${lang} --output_format txt 2>/dev/null`, { encoding: 'utf-8', timeout: 60_000 }).trim();
}
async function sttAPI(path, key, lang) {
    return execSync(`curl -s https://api.openai.com/v1/audio/transcriptions ` +
        `-H "Authorization: Bearer ${key}" ` +
        `-F "file=@${path}" -F "model=whisper-1" -F "language=${lang}" -F "response_format=text"`, { encoding: 'utf-8', timeout: 30_000 }).trim();
}
async function transcribe(path, engine, lang, key) {
    const chain = [];
    if (engine === 'whisper-local')
        chain.push(() => sttLocal(path, lang));
    if (key)
        chain.push(() => sttAPI(path, key, lang));
    if (engine !== 'whisper-local' && ['whisper', 'whisper.cpp', 'whisper-cpp'].some(has))
        chain.push(() => sttLocal(path, lang));
    for (const fn of chain) {
        try {
            const t = await fn();
            if (t)
                return t;
        }
        catch { /* next */ }
    }
    return '';
}
// ---------------------------------------------------------------------------
// TTS engines (fallback chain)
// ---------------------------------------------------------------------------
async function ttsSystem(text, voice, rate) {
    const t = shellSafe(text);
    if (!t)
        return null;
    if (process.platform === 'darwin')
        return spawn('say', ['-v', voice, '-r', String(rate), t], { stdio: 'ignore' });
    if (has('piper')) {
        const p = spawn('piper', ['--output-raw'], { stdio: ['pipe', 'pipe', 'ignore'] });
        const a = spawn('aplay', ['-r', '22050', '-f', 'S16_LE', '-'], { stdio: ['pipe', 'ignore', 'ignore'] });
        p.stdout?.pipe(a.stdin);
        p.stdin?.write(t);
        p.stdin?.end();
        return a;
    }
    if (has('espeak'))
        return spawn('espeak', [t], { stdio: 'ignore' });
    return null;
}
async function ttsOpenAI(text, key) {
    const t = shellSafe(stripMd(text));
    if (!t)
        return null;
    const tmp = join(tmpdir(), `kbot-tts-${Date.now()}.mp3`);
    try {
        execSync(`curl -s https://api.openai.com/v1/audio/speech -H "Authorization: Bearer ${key}" ` +
            `-H "Content-Type: application/json" -d '${JSON.stringify({ model: 'tts-1', input: t, voice: 'nova' })}' --output "${tmp}"`, { timeout: 30_000 });
        if (!existsSync(tmp))
            return null;
        const player = process.platform === 'darwin' ? 'afplay' : has('mpv') ? 'mpv' : has('aplay') ? 'aplay' : null;
        if (!player) {
            try {
                unlinkSync(tmp);
            }
            catch { }
            return null;
        }
        const p = spawn(player, player === 'mpv' ? ['--no-terminal', tmp] : [tmp], { stdio: 'ignore' });
        p.on('close', () => { try {
            unlinkSync(tmp);
        }
        catch { } });
        return p;
    }
    catch {
        try {
            unlinkSync(tmp);
        }
        catch { }
        return null;
    }
}
async function ttsElevenLabs(text, key, voiceId) {
    const t = stripMd(text);
    if (!t)
        return null;
    const tmp = join(tmpdir(), `kbot-el-${Date.now()}.mp3`);
    try {
        execSync(`curl -s "https://api.elevenlabs.io/v1/text-to-speech/${voiceId}" ` +
            `-H "xi-api-key: ${key}" -H "Content-Type: application/json" ` +
            `-d '${JSON.stringify({ text: t, model_id: 'eleven_monolingual_v1' })}' --output "${tmp}"`, { timeout: 30_000 });
        if (!existsSync(tmp))
            return null;
        const player = process.platform === 'darwin' ? 'afplay' : has('mpv') ? 'mpv' : null;
        if (!player) {
            try {
                unlinkSync(tmp);
            }
            catch { }
            return null;
        }
        const p = spawn(player, player === 'mpv' ? ['--no-terminal', tmp] : [tmp], { stdio: 'ignore' });
        p.on('close', () => { try {
            unlinkSync(tmp);
        }
        catch { } });
        return p;
    }
    catch {
        try {
            unlinkSync(tmp);
        }
        catch { }
        return null;
    }
}
async function speak(text, st) {
    switch (st.session.ttsEngine) {
        case 'system': return ttsSystem(text, st.voice, st.rate);
        case 'openai-tts': return st.openaiKey ? ttsOpenAI(text, st.openaiKey) : ttsSystem(text, st.voice, st.rate);
        case 'elevenlabs': return st.elevenKey ? ttsElevenLabs(text, st.elevenKey, st.elevenVoiceId) : ttsSystem(text, st.voice, st.rate);
        default: return null;
    }
}
// ---------------------------------------------------------------------------
// Streaming TTS — sentence-level chunking
// ---------------------------------------------------------------------------
async function speakChunked(text, st, isInterrupted) {
    const sentences = splitSentences(stripMd(text));
    for (let i = 0; i < sentences.length; i++) {
        if (isInterrupted())
            break;
        st.session.status = 'speaking';
        showStatus('speaking', `(${i + 1}/${sentences.length})`);
        const proc = await speak(sentences[i], st);
        if (!proc)
            continue;
        st.ttsProc = proc;
        await new Promise(resolve => {
            const iv = setInterval(() => { if (isInterrupted()) {
                clearInterval(iv);
                proc.kill('SIGTERM');
            } }, 100);
            proc.on('close', () => { clearInterval(iv); if (st.ttsProc === proc)
                st.ttsProc = null; resolve(); });
            proc.on('error', () => { clearInterval(iv); if (st.ttsProc === proc)
                st.ttsProc = null; resolve(); });
        });
    }
}
function interruptTTS(st) {
    if (st.ttsProc) {
        st.ttsProc.kill('SIGTERM');
        st.ttsProc = null;
    }
    st.interrupted = true;
    st.session.status = 'idle';
}
// ---------------------------------------------------------------------------
// Voice commands
// ---------------------------------------------------------------------------
function parseCommand(text) {
    const l = text.toLowerCase().trim();
    if (/^(stop|cancel|shut up|be quiet|enough)$/.test(l))
        return { action: 'stop' };
    if (/^(pause|hold on|wait)$/.test(l))
        return { action: 'pause' };
    if (/^(save this|save conversation|save)$/.test(l))
        return { action: 'save' };
    if (/^(exit|quit|goodbye|bye|end)$/.test(l))
        return { action: 'exit' };
    const m = l.match(/^switch\s+to\s+(\w+)$/);
    if (m)
        return { action: 'switch', arg: m[1] };
    return null;
}
// ---------------------------------------------------------------------------
// Audio recording to ~/.kbot/voice/
// ---------------------------------------------------------------------------
function ensureVoiceDir() { if (!existsSync(VOICE_DIR))
    mkdirSync(VOICE_DIR, { recursive: true }); }
function saveRecording(src, sessionId, idx, role) {
    ensureVoiceDir();
    const dest = join(VOICE_DIR, `${sessionId}-${String(idx).padStart(3, '0')}-${role}.wav`);
    try {
        writeFileSync(dest, readFileSync(src));
        return dest;
    }
    catch {
        return undefined;
    }
}
function audioDuration(path) {
    try {
        if (has('soxi'))
            return parseFloat(execSync(`soxi -D "${path}" 2>/dev/null`, { encoding: 'utf-8' })) || 0;
        return statSync(path).size / 32000;
    }
    catch {
        return 0;
    }
}
function saveSession(s) {
    ensureVoiceDir();
    try {
        writeFileSync(join(VOICE_DIR, `${s.id}.json`), JSON.stringify({
            id: s.id, timestamp: new Date().toISOString(), turns: s.history.length,
            sttEngine: s.sttEngine, ttsEngine: s.ttsEngine, language: s.language, history: s.history,
        }, null, 2));
    }
    catch { /* non-critical */ }
}
// ---------------------------------------------------------------------------
// Ollama LLM
// ---------------------------------------------------------------------------
async function checkOllama(host) {
    try {
        return (await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(3000) })).ok;
    }
    catch {
        return false;
    }
}
async function chat(msg, st, agent) {
    const sys = [
        'You are kbot, a helpful AI assistant in a real-time voice conversation.',
        'Keep responses concise and conversational. Avoid code blocks, markdown, long lists, URLs.',
        'Use natural speech. Ask if the user wants detail on complex topics.',
        agent !== 'auto' ? `You are the "${agent}" specialist.` : '',
    ].filter(Boolean).join(' ');
    const body = JSON.stringify({
        model: st.ollamaModel,
        messages: [{ role: 'system', content: sys }, ...st.messages.slice(-10), { role: 'user', content: msg }],
        stream: false, options: { temperature: 0.7, num_predict: 400 },
    });
    const res = await fetch(`${st.ollamaHost}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body, signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok)
        throw new Error(`Ollama ${res.status}`);
    const data = await res.json();
    return data.message?.content?.trim() || '(no response)';
}
// ---------------------------------------------------------------------------
// Text input fallback
// ---------------------------------------------------------------------------
function textInput(prompt) {
    return new Promise(resolve => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        rl.question(prompt, a => { rl.close(); resolve(a.trim()); });
    });
}
// ---------------------------------------------------------------------------
// Single voice turn (non-VAD mode)
// ---------------------------------------------------------------------------
async function voiceTurn(st, agent) {
    const { session } = st;
    const idx = session.history.length;
    let userText = '';
    const tmp = join(tmpdir(), `kbot-rt-${Date.now()}.wav`);
    // 1. Capture input
    if (hasRec() && session.sttEngine !== 'system') {
        session.status = 'listening';
        showStatus('listening');
        console.log();
        const ok = await record(tmp, 30, st.vad.silenceDuration);
        if (!ok || !existsSync(tmp)) {
            console.log(chalk.yellow('  No audio captured.'));
            userText = await textInput(chalk.cyan('  You: '));
        }
        else {
            saveRecording(tmp, session.id, idx, 'user');
            session.status = 'processing';
            showStatus('processing', '(transcribing)');
            userText = await transcribe(tmp, session.sttEngine, session.language, st.openaiKey);
            process.stdout.write(`\r${' '.repeat(80)}\r`);
            if (userText) {
                console.log(`  ${DIM('You:')} ${chalk.white(userText)}`);
                session.history.push({ role: 'user', text: userText, duration: audioDuration(tmp), timestamp: new Date().toISOString() });
            }
            else {
                console.log(chalk.yellow('  Could not transcribe.'));
                userText = await textInput(chalk.cyan('  You: '));
            }
        }
        try {
            if (existsSync(tmp))
                unlinkSync(tmp);
        }
        catch { }
    }
    else {
        userText = await textInput(chalk.cyan('\n  You: '));
    }
    if (!userText || !st.running)
        return { cont: true };
    if (session.history.length === idx)
        session.history.push({ role: 'user', text: userText, duration: 0, timestamp: new Date().toISOString() });
    // 2. Voice commands
    const cmd = parseCommand(userText);
    if (cmd) {
        if (cmd.action === 'exit') {
            console.log(ACCENT('  kbot: ') + 'Goodbye!');
            await speakChunked('Goodbye!', st, () => false);
            return { cont: false };
        }
        if (cmd.action === 'stop') {
            interruptTTS(st);
            console.log(DIM('  (stopped)'));
            return { cont: true };
        }
        if (cmd.action === 'pause') {
            interruptTTS(st);
            await new Promise(resolve => {
                console.log(chalk.yellow('\n  \u23F8  Paused') + DIM(' — press Enter to resume'));
                const rl = createInterface({ input: process.stdin, output: process.stdout });
                rl.question(DIM('  > '), a => { rl.close(); if (a.trim() === 'exit')
                    st.running = false; resolve(); });
            });
            return { cont: st.running };
        }
        if (cmd.action === 'switch' && cmd.arg) {
            console.log(ACCENT('  kbot: ') + `Switching to ${cmd.arg}.`);
            await speakChunked(`Switching to ${cmd.arg}.`, st, () => false);
            return { cont: true, newAgent: cmd.arg };
        }
        if (cmd.action === 'save') {
            saveSession(session);
            console.log(chalk.green(`  Saved: ${VOICE_DIR}/${session.id}.json`));
            await speakChunked('Conversation saved.', st, () => false);
            return { cont: true };
        }
    }
    // 3. LLM response
    session.status = 'processing';
    showStatus('processing', '(thinking)');
    st.messages.push({ role: 'user', content: userText });
    try {
        const resp = await chat(userText, st, agent);
        process.stdout.write(`\r${' '.repeat(80)}\r`);
        console.log(ACCENT('  kbot: ') + resp);
        st.messages.push({ role: 'assistant', content: resp });
        session.history.push({ role: 'assistant', text: resp, duration: 0, timestamp: new Date().toISOString() });
        st.interrupted = false;
        await speakChunked(resp, st, () => st.interrupted);
        session.status = 'idle';
    }
    catch (e) {
        process.stdout.write(`\r${' '.repeat(80)}\r`);
        console.log(chalk.red(`  Error: ${e instanceof Error ? e.message : e}`));
        await speakChunked('Sorry, I encountered an error.', st, () => false);
    }
    return { cont: true };
}
// ---------------------------------------------------------------------------
// VAD-driven continuous loop
// ---------------------------------------------------------------------------
async function vadLoop(st, agent) {
    const vad = new VAD(st.vad);
    let recProc = null, recPath = '', recording = false;
    const startRec = () => {
        if (recording)
            return;
        recording = true;
        if (st.session.status === 'speaking') {
            interruptTTS(st);
            console.log(DIM('\n  (interrupted)'));
        }
        st.session.status = 'listening';
        recPath = join(tmpdir(), `kbot-vad-${Date.now()}.wav`);
        if (has('rec'))
            recProc = spawn('rec', [recPath, 'rate', '16k', 'channels', '1', 'trim', '0', '30'], { stdio: ['ignore', 'ignore', 'ignore'] });
    };
    const stopRec = async () => {
        if (!recording || !recProc)
            return;
        recording = false;
        recProc.kill('SIGTERM');
        recProc = null;
        await new Promise(r => setTimeout(r, 200));
        if (!existsSync(recPath))
            return;
        st.session.status = 'processing';
        showStatus('processing', '(transcribing)');
        const text = await transcribe(recPath, st.session.sttEngine, st.session.language, st.openaiKey);
        try {
            unlinkSync(recPath);
        }
        catch { }
        process.stdout.write(`\r${' '.repeat(80)}\r`);
        if (!text)
            return;
        console.log(`  ${DIM('You:')} ${chalk.white(text)}`);
        const cmd = parseCommand(text);
        if (cmd) {
            if (cmd.action === 'exit') {
                st.running = false;
                return;
            }
            if (cmd.action === 'pause') {
                vad.stop();
                await new Promise(r => {
                    console.log(chalk.yellow('\n  \u23F8  Paused'));
                    const rl = createInterface({ input: process.stdin, output: process.stdout });
                    rl.question(DIM('  > '), () => { rl.close(); r(); });
                });
                if (st.running)
                    vad.start({ onStart: startRec, onEnd: () => { stopRec(); }, onVol: v => { if (st.session.status !== 'speaking')
                            showWaveform(v); } });
                return;
            }
            if (cmd.action === 'save') {
                saveSession(st.session);
                console.log(chalk.green('  Saved.'));
                return;
            }
            return;
        }
        st.session.history.push({ role: 'user', text, duration: 0, timestamp: new Date().toISOString() });
        st.session.status = 'processing';
        showStatus('processing', '(thinking)');
        st.messages.push({ role: 'user', content: text });
        try {
            const resp = await chat(text, st, agent);
            process.stdout.write(`\r${' '.repeat(80)}\r`);
            console.log(ACCENT('  kbot: ') + resp);
            st.messages.push({ role: 'assistant', content: resp });
            st.session.history.push({ role: 'assistant', text: resp, duration: 0, timestamp: new Date().toISOString() });
            st.interrupted = false;
            await speakChunked(resp, st, () => st.interrupted);
        }
        catch (e) {
            process.stdout.write(`\r${' '.repeat(80)}\r`);
            console.log(chalk.red(`  Error: ${e instanceof Error ? e.message : e}`));
        }
        st.session.status = 'idle';
    };
    vad.start({
        onStart: startRec, onEnd: () => { stopRec(); },
        onVol: v => { if (st.session.status === 'listening' || st.session.status === 'idle')
            showWaveform(v); },
    });
    console.log(DIM('  VAD active — start speaking...\n'));
    await new Promise(resolve => {
        const iv = setInterval(() => { if (!st.running) {
            clearInterval(iv);
            vad.stop();
            resolve();
        } }, 200);
    });
}
// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------
function banner(st) {
    const s = st.session;
    console.log();
    console.log(ACCENT.bold('  kbot Realtime Voice'));
    console.log(ACCENT('  ' + '='.repeat(44)));
    console.log();
    console.log(`  ${DIM('Session:')}    ${DIM(s.id)}`);
    console.log(`  ${DIM('STT:')}        ${chalk.green(s.sttEngine)}`);
    console.log(`  ${DIM('TTS:')}        ${chalk.green(s.ttsEngine)}${s.ttsEngine === 'system' ? DIM(` (${st.voice}, ${st.rate} wpm)`) : ''}`);
    console.log(`  ${DIM('Language:')}   ${s.language}`);
    console.log(`  ${DIM('VAD:')}        ${s.vadEnabled ? chalk.green('on') + DIM(` (thresh ${st.vad.threshold}, silence ${st.vad.silenceDuration}s)`) : chalk.yellow('off')}`);
    console.log(`  ${DIM('Continuous:')} ${s.continuous ? chalk.green('yes') : chalk.yellow('no')}`);
    console.log(`  ${DIM('LLM:')}        ${chalk.cyan(`${st.ollamaModel} @ ${st.ollamaHost}`)}`);
    console.log(`  ${DIM('Recording:')}  ${chalk.cyan(VOICE_DIR)}`);
    console.log();
    console.log(DIM('  Voice commands: "stop", "pause", "switch to [agent]", "save this"'));
    console.log(DIM('  Say "exit" / "goodbye" to end. Ctrl+C anytime.'));
    console.log();
}
// ---------------------------------------------------------------------------
// Entry point: startRealtimeVoice
// ---------------------------------------------------------------------------
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
export async function startRealtimeVoice(opts) {
    const id = `voice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const vadEnabled = opts?.vad !== false && hasSox();
    const session = {
        id, status: 'idle',
        sttEngine: detectSTT(opts?.stt), ttsEngine: detectTTS(opts?.tts),
        language: opts?.language ?? 'en', continuous: opts?.continuous ?? true,
        vadEnabled, history: [],
    };
    const st = {
        session,
        vad: { threshold: opts?.vadThreshold ?? 0.02, silenceDuration: opts?.vadSilence ?? 1.5, minSpeechDuration: 0.3, sampleRate: 16000 },
        running: false, interrupted: false, ttsProc: null,
        ollamaHost: opts?.ollamaHost ?? OLLAMA_DEFAULT,
        ollamaModel: opts?.ollamaModel ?? 'gemma3:12b',
        messages: [], openaiKey: loadKey('openai'), elevenKey: loadKey('elevenlabs'),
        elevenVoiceId: 'EXAVITQu4vr4xnSDxMaL', voice: opts?.voice ?? 'Samantha', rate: opts?.rate ?? 190,
    };
    // Pre-flight
    if (!(await checkOllama(st.ollamaHost))) {
        console.error(chalk.red(`\n  Ollama is not running at ${st.ollamaHost}`));
        console.error(chalk.yellow(`  Start: ollama serve && ollama pull ${st.ollamaModel}`));
        return;
    }
    if (!hasRec())
        console.warn(chalk.yellow('  \u26A0 No recorder — install sox: brew install sox\n'));
    if (session.sttEngine === 'system')
        console.warn(chalk.yellow('  \u26A0 Install whisper.cpp for STT\n'));
    if (vadEnabled && !hasSox()) {
        console.warn(chalk.yellow('  \u26A0 VAD needs sox\n'));
        session.vadEnabled = false;
    }
    ensureVoiceDir();
    banner(st);
    st.running = true;
    const cleanup = () => {
        if (st.running) {
            st.running = false;
            interruptTTS(st);
            console.log(DIM('\n\n  Session ended.'));
            saveSession(session);
        }
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    // Greeting
    const greeting = 'Hey! Real-time voice mode is active. Go ahead and speak.';
    console.log(ACCENT('  kbot: ') + greeting);
    await speakChunked(greeting, st, () => false);
    // Main loop
    if (session.vadEnabled) {
        await vadLoop(st, opts?.agent ?? 'auto');
    }
    else {
        let agent = opts?.agent ?? 'auto';
        while (st.running) {
            const result = await voiceTurn(st, agent);
            if (!result.cont) {
                st.running = false;
                break;
            }
            if (result.newAgent)
                agent = result.newAgent;
            if (!session.continuous)
                break;
        }
    }
    saveSession(session);
    process.removeListener('SIGINT', cleanup);
    process.removeListener('SIGTERM', cleanup);
}
// ---------------------------------------------------------------------------
// Utility exports
// ---------------------------------------------------------------------------
/** Describe real-time voice capabilities of the current system */
export function describeRealtimeCapabilities() {
    return [
        'Real-time Voice Capabilities:',
        `  STT:      ${detectSTT()}`,
        `  TTS:      ${detectTTS()}`,
        `  VAD:      ${hasSox() ? 'available' : 'unavailable (install sox)'}`,
        `  Recorder: ${hasRec() ? 'available' : 'unavailable'}`,
        `  Platform: ${process.platform}`,
        `  Voice dir: ${VOICE_DIR}`,
    ].join('\n');
}
/** List saved voice sessions from ~/.kbot/voice/ */
export function listVoiceSessions() {
    ensureVoiceDir();
    try {
        return execSync(`ls "${VOICE_DIR}"/*.json 2>/dev/null || true`, { encoding: 'utf-8' })
            .split('\n').filter(Boolean).map(f => {
            try {
                const d = JSON.parse(readFileSync(f, 'utf-8'));
                return { id: d.id, timestamp: d.timestamp, turns: d.turns };
            }
            catch {
                return null;
            }
        }).filter((x) => x !== null);
    }
    catch {
        return [];
    }
}
/** Load a saved voice session by ID */
export function getVoiceSession(sessionId) {
    const p = join(VOICE_DIR, `${sessionId}.json`);
    if (!existsSync(p))
        return null;
    try {
        return JSON.parse(readFileSync(p, 'utf-8'));
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=voice-realtime.js.map