// kbot Streaming Tools — Multi-platform livestreaming to Twitch, Rumble, Kick
//
// Tools: stream_start, stream_stop, stream_status, stream_setup
//
// kbot captures screen/window/webcam via ffmpeg and simultaneously
// streams to multiple RTMP endpoints. Supports Twitch, Rumble, and Kick.
//
// Env: TWITCH_STREAM_KEY, RUMBLE_STREAM_KEY, KICK_STREAM_KEY
// Or configure via: kbot stream_setup
import { registerTool } from './index.js';
import { execFile, spawn } from 'node:child_process';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
const KBOT_DIR = join(homedir(), '.kbot');
const STREAM_STATE = join(KBOT_DIR, 'stream-state.json');
const STREAM_PID = join(KBOT_DIR, 'stream.pid');
// ─── RTMP Ingest Endpoints ────────────────────────────────────
const RTMP_ENDPOINTS = {
    twitch: 'rtmp://live.twitch.tv/app',
    rumble: 'rtmp://rtmp.rumble.com/live',
    kick: 'rtmps://fa723fc1b171.global-contribute.live-video.net/app',
};
function loadState() {
    try {
        if (existsSync(STREAM_STATE))
            return JSON.parse(readFileSync(STREAM_STATE, 'utf-8'));
    }
    catch { /* fresh state */ }
    return {
        active: false, platforms: [], startedAt: null,
        source: 'screen', resolution: '1920x1080', bitrate: 4500,
        pid: null, history: [],
    };
}
function saveState(state) {
    if (!existsSync(KBOT_DIR))
        mkdirSync(KBOT_DIR, { recursive: true });
    if (state.history.length > 100)
        state.history = state.history.slice(-100);
    writeFileSync(STREAM_STATE, JSON.stringify(state, null, 2));
}
// ─── Stream Key Resolution ─────────────────────────────────────
function getStreamKey(platform) {
    const envMap = {
        twitch: 'TWITCH_STREAM_KEY',
        rumble: 'RUMBLE_STREAM_KEY',
        kick: 'KICK_STREAM_KEY',
    };
    const envVar = envMap[platform];
    if (!envVar)
        return null;
    return process.env[envVar] || null;
}
function getConfiguredPlatforms() {
    return Object.keys(RTMP_ENDPOINTS).filter(p => getStreamKey(p));
}
// ─── FFmpeg Check ──────────────────────────────────────────────
function checkFfmpeg() {
    return new Promise(resolve => {
        execFile('ffmpeg', ['-version'], { timeout: 5000 }, (err) => {
            resolve(!err);
        });
    });
}
// ─── Screen Capture Input (platform-specific) ──────────────────
function getInputArgs(source) {
    const os = platform();
    if (source === 'screen') {
        if (os === 'darwin') {
            // macOS: AVFoundation screen capture (device 1 = screen, 0 = webcam typically)
            return ['-f', 'avfoundation', '-framerate', '30', '-i', '1:0'];
        }
        else if (os === 'linux') {
            return ['-f', 'x11grab', '-framerate', '30', '-video_size', '1920x1080', '-i', ':0.0'];
        }
        else {
            // Windows
            return ['-f', 'gdigrab', '-framerate', '30', '-i', 'desktop'];
        }
    }
    if (source === 'webcam') {
        if (os === 'darwin') {
            return ['-f', 'avfoundation', '-framerate', '30', '-i', '0:0'];
        }
        else if (os === 'linux') {
            return ['-f', 'v4l2', '-framerate', '30', '-i', '/dev/video0'];
        }
        else {
            return ['-f', 'dshow', '-framerate', '30', '-i', 'video=Integrated Camera'];
        }
    }
    // File input (e.g., a video file or test pattern)
    if (source === 'test') {
        return [
            '-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=30',
            '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100',
        ];
    }
    // Assume it's a file path
    return ['-re', '-i', source];
}
// ─── Build FFmpeg Command ──────────────────────────────────────
function buildFfmpegArgs(opts) {
    const { platforms, source, resolution, bitrate } = opts;
    const inputArgs = getInputArgs(source);
    // Video encoding settings
    const videoArgs = [
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-b:v', `${bitrate}k`,
        '-maxrate', `${bitrate}k`,
        '-bufsize', `${bitrate * 2}k`,
        '-s', resolution,
        '-g', '60', // keyframe every 2s at 30fps
        '-keyint_min', '60',
        '-pix_fmt', 'yuv420p',
    ];
    // Audio encoding
    const audioArgs = [
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
    ];
    // For multi-platform: use tee muxer to send to all RTMP endpoints
    if (platforms.length === 1) {
        const key = getStreamKey(platforms[0]);
        const endpoint = RTMP_ENDPOINTS[platforms[0]];
        return [
            ...inputArgs,
            ...videoArgs,
            ...audioArgs,
            '-f', 'flv',
            `${endpoint}/${key}`,
        ];
    }
    // Multiple platforms: use tee muxer
    const teeTargets = platforms.map(p => {
        const key = getStreamKey(p);
        const endpoint = RTMP_ENDPOINTS[p];
        return `[f=flv]${endpoint}/${key}`;
    }).join('|');
    return [
        ...inputArgs,
        ...videoArgs,
        ...audioArgs,
        '-f', 'tee',
        '-map', '0:v',
        '-map', source === 'test' ? '1:a' : '0:a',
        teeTargets,
    ];
}
// ─── Active Process Tracking ───────────────────────────────────
let activeProcess = null;
function isStreamRunning() {
    if (activeProcess && !activeProcess.killed)
        return true;
    // Check PID file for streams started in a different session
    try {
        if (existsSync(STREAM_PID)) {
            const pid = parseInt(readFileSync(STREAM_PID, 'utf-8').trim());
            process.kill(pid, 0); // signal 0 = check if process exists
            return true;
        }
    }
    catch {
        // Process doesn't exist, clean up stale PID
        try {
            writeFileSync(STREAM_PID, '');
        }
        catch { /* ignore */ }
    }
    return false;
}
// ─── Register Tools ────────────────────────────────────────────
export function registerStreamingTools() {
    registerTool({
        name: 'stream_start',
        description: 'Start livestreaming to one or more platforms simultaneously. Supports Twitch, Rumble, and Kick. Uses ffmpeg to capture screen/webcam and stream via RTMP.',
        parameters: {
            platforms: { type: 'string', description: 'Comma-separated platforms: "twitch,rumble,kick" or "all". Default: all configured', required: false },
            source: { type: 'string', description: 'Video source: "screen" (default), "webcam", "test" (test pattern), or a file path' },
            resolution: { type: 'string', description: 'Output resolution: "1920x1080" (default), "1280x720", "2560x1440"' },
            bitrate: { type: 'string', description: 'Video bitrate in kbps. Default: 4500. Twitch max: 6000' },
            title: { type: 'string', description: 'Stream title (for logging/state tracking)' },
        },
        tier: 'free',
        timeout: 600_000, // 10 min timeout for the start command itself
        execute: async (args) => {
            // Pre-flight checks
            const hasFfmpeg = await checkFfmpeg();
            if (!hasFfmpeg) {
                return 'Error: ffmpeg not found. Install it:\n  macOS: brew install ffmpeg\n  Linux: sudo apt install ffmpeg\n  Windows: choco install ffmpeg';
            }
            if (isStreamRunning()) {
                return 'Error: A stream is already active. Run stream_stop first.';
            }
            // Resolve platforms
            const configured = getConfiguredPlatforms();
            if (configured.length === 0) {
                return 'Error: No stream keys configured. Set environment variables:\n  TWITCH_STREAM_KEY=your_key\n  RUMBLE_STREAM_KEY=your_key\n  KICK_STREAM_KEY=your_key\n\nOr run stream_setup to configure interactively.';
            }
            let platforms;
            if (args.platforms) {
                const requested = String(args.platforms).toLowerCase();
                if (requested === 'all') {
                    platforms = configured;
                }
                else {
                    platforms = requested.split(',').map(p => p.trim());
                    // Validate
                    const missing = platforms.filter(p => !getStreamKey(p));
                    if (missing.length > 0) {
                        return `Error: Missing stream keys for: ${missing.join(', ')}\nConfigured platforms: ${configured.join(', ')}`;
                    }
                    const unknown = platforms.filter(p => !RTMP_ENDPOINTS[p]);
                    if (unknown.length > 0) {
                        return `Error: Unknown platforms: ${unknown.join(', ')}\nSupported: twitch, rumble, kick`;
                    }
                }
            }
            else {
                platforms = configured;
            }
            const source = String(args.source || 'screen');
            const resolution = String(args.resolution || '1920x1080');
            const bitrate = parseInt(String(args.bitrate || '4500'));
            // Build ffmpeg command
            const ffmpegArgs = buildFfmpegArgs({ platforms, source, resolution, bitrate });
            // Spawn ffmpeg in background
            const proc = spawn('ffmpeg', ffmpegArgs, {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: true,
            });
            activeProcess = proc;
            const pid = proc.pid;
            // Save PID for cross-session tracking
            writeFileSync(STREAM_PID, String(pid));
            // Collect stderr for initial connection status
            let stderrBuffer = '';
            proc.stderr?.on('data', (chunk) => {
                stderrBuffer += chunk.toString();
            });
            // Wait a moment to check if ffmpeg started successfully
            await new Promise(resolve => setTimeout(resolve, 3000));
            if (proc.exitCode !== null) {
                // Process already exited — something went wrong
                const error = stderrBuffer.slice(-500);
                return `Error: ffmpeg exited immediately.\n\n${error}\n\nCheck your stream keys and source device.`;
            }
            // Detach so kbot can continue
            proc.unref();
            // Update state
            const state = loadState();
            state.active = true;
            state.platforms = platforms;
            state.startedAt = new Date().toISOString();
            state.source = source;
            state.resolution = resolution;
            state.bitrate = bitrate;
            state.pid = pid;
            saveState(state);
            const platformList = platforms.map(p => {
                const urls = {
                    twitch: 'https://twitch.tv/your-channel',
                    rumble: 'https://rumble.com/your-channel',
                    kick: 'https://kick.com/your-channel',
                };
                return `  - ${p.charAt(0).toUpperCase() + p.slice(1)}: ${urls[p] || p}`;
            }).join('\n');
            return `Stream started!\n\nPlatforms:\n${platformList}\n\nSettings:\n  Source: ${source}\n  Resolution: ${resolution}\n  Bitrate: ${bitrate}kbps\n  PID: ${pid}\n\nUse stream_status to check health, stream_stop to end.`;
        },
    });
    registerTool({
        name: 'stream_stop',
        description: 'Stop the active livestream. Gracefully terminates ffmpeg and records the session.',
        parameters: {},
        tier: 'free',
        execute: async () => {
            const state = loadState();
            if (!state.active && !isStreamRunning()) {
                return 'No active stream to stop.';
            }
            let stopped = false;
            // Try in-process reference first
            if (activeProcess && !activeProcess.killed) {
                activeProcess.kill('SIGINT'); // graceful shutdown
                activeProcess = null;
                stopped = true;
            }
            // Try PID file
            if (!stopped && state.pid) {
                try {
                    process.kill(state.pid, 'SIGINT');
                    stopped = true;
                }
                catch {
                    // Process already dead
                }
            }
            // Calculate duration
            let durationMinutes = 0;
            if (state.startedAt) {
                durationMinutes = Math.round((Date.now() - new Date(state.startedAt).getTime()) / 60_000);
            }
            // Record in history
            state.history.push({
                date: state.startedAt || new Date().toISOString(),
                platforms: state.platforms,
                duration_minutes: durationMinutes,
                source: state.source,
            });
            // Reset active state
            state.active = false;
            state.pid = null;
            state.startedAt = null;
            state.platforms = [];
            saveState(state);
            // Clean PID file
            try {
                writeFileSync(STREAM_PID, '');
            }
            catch { /* ignore */ }
            return `Stream stopped after ${durationMinutes} minutes.\n\nSession recorded in history. Run stream_status to see past streams.`;
        },
    });
    registerTool({
        name: 'stream_status',
        description: 'Check livestream status — active stream info, configured platforms, and stream history.',
        parameters: {},
        tier: 'free',
        execute: async () => {
            const state = loadState();
            const configured = getConfiguredPlatforms();
            const running = isStreamRunning();
            const lines = [];
            // Active stream
            if (running && state.active) {
                const elapsed = state.startedAt
                    ? Math.round((Date.now() - new Date(state.startedAt).getTime()) / 60_000)
                    : 0;
                lines.push('🔴 LIVE');
                lines.push(`  Platforms: ${state.platforms.join(', ')}`);
                lines.push(`  Duration: ${elapsed} minutes`);
                lines.push(`  Source: ${state.source}`);
                lines.push(`  Resolution: ${state.resolution}`);
                lines.push(`  Bitrate: ${state.bitrate}kbps`);
                lines.push(`  PID: ${state.pid}`);
            }
            else {
                lines.push('⚫ Offline');
                // Clean up stale state
                if (state.active) {
                    state.active = false;
                    state.pid = null;
                    saveState(state);
                }
            }
            lines.push('');
            lines.push('Configured platforms:');
            for (const p of Object.keys(RTMP_ENDPOINTS)) {
                const has = configured.includes(p);
                lines.push(`  ${has ? '✓' : '✗'} ${p.charAt(0).toUpperCase() + p.slice(1)}`);
            }
            // History
            if (state.history.length > 0) {
                lines.push('');
                lines.push(`Stream history (${state.history.length} sessions):`);
                for (const h of state.history.slice(-5).reverse()) {
                    lines.push(`  ${h.date.split('T')[0]} — ${h.platforms.join(', ')} — ${h.duration_minutes}m — ${h.source}`);
                }
            }
            return lines.join('\n');
        },
    });
    registerTool({
        name: 'stream_setup',
        description: 'Show setup instructions for configuring stream keys for Twitch, Rumble, and Kick.',
        parameters: {
            platform: { type: 'string', description: 'Platform to show setup for: "twitch", "rumble", "kick", or "all" (default)' },
        },
        tier: 'free',
        execute: async (args) => {
            const p = String(args.platform || 'all').toLowerCase();
            const lines = ['Stream Setup — Multi-Platform Livestreaming', ''];
            const instructions = {
                twitch: `Twitch:
  1. Go to https://dashboard.twitch.tv/settings → Stream
  2. Copy your Primary Stream Key
  3. Set: export TWITCH_STREAM_KEY="your_key"
  4. Or add to ~/.kbot/.env: TWITCH_STREAM_KEY=your_key

  RTMP endpoint: ${RTMP_ENDPOINTS.twitch}
  Max bitrate: 6000kbps
  Recommended: 1080p @ 4500kbps or 720p @ 2500kbps`,
                rumble: `Rumble:
  1. Go to https://rumble.com/account/live-stream
  2. Create a stream → copy the Stream Key
  3. Set: export RUMBLE_STREAM_KEY="your_key"
  4. Or add to ~/.kbot/.env: RUMBLE_STREAM_KEY=your_key

  RTMP endpoint: ${RTMP_ENDPOINTS.rumble}
  Recommended: 1080p @ 4500kbps`,
                kick: `Kick:
  1. Go to https://kick.com/dashboard/settings/stream
  2. Copy your Stream Key
  3. Set: export KICK_STREAM_KEY="your_key"
  4. Or add to ~/.kbot/.env: KICK_STREAM_KEY=your_key

  RTMP endpoint: ${RTMP_ENDPOINTS.kick}
  Recommended: 1080p @ 4500kbps`,
            };
            if (p === 'all') {
                for (const [name, inst] of Object.entries(instructions)) {
                    lines.push(inst);
                    lines.push('');
                }
            }
            else if (instructions[p]) {
                lines.push(instructions[p]);
            }
            else {
                return `Unknown platform: ${p}. Supported: twitch, rumble, kick`;
            }
            lines.push('Prerequisites:');
            lines.push('  - ffmpeg installed (brew install ffmpeg / apt install ffmpeg)');
            lines.push('  - Screen Recording permission granted (macOS)');
            lines.push('');
            lines.push('Quick test:');
            lines.push('  kbot stream_start --source test --platforms all');
            lines.push('  (sends test pattern to verify keys work)');
            const configured = getConfiguredPlatforms();
            if (configured.length > 0) {
                lines.push('');
                lines.push(`Currently configured: ${configured.join(', ')}`);
            }
            return lines.join('\n');
        },
    });
    registerTool({
        name: 'stream_scene',
        description: 'Switch stream scene/source without stopping. Change between screen, webcam, file, or test pattern.',
        parameters: {
            source: { type: 'string', description: 'New source: "screen", "webcam", "test", or file path', required: true },
        },
        tier: 'free',
        execute: async (args) => {
            const state = loadState();
            if (!state.active || !isStreamRunning()) {
                return 'No active stream. Start one with stream_start first.';
            }
            // To switch source, we need to restart ffmpeg with new input
            // Store current settings, stop, restart with new source
            const platforms = state.platforms;
            const resolution = state.resolution;
            const bitrate = state.bitrate;
            const newSource = String(args.source);
            // Stop current
            if (activeProcess && !activeProcess.killed) {
                activeProcess.kill('SIGINT');
                activeProcess = null;
            }
            else if (state.pid) {
                try {
                    process.kill(state.pid, 'SIGINT');
                }
                catch { /* */ }
            }
            await new Promise(r => setTimeout(r, 2000));
            // Restart with new source
            const ffmpegArgs = buildFfmpegArgs({ platforms, source: newSource, resolution, bitrate });
            const proc = spawn('ffmpeg', ffmpegArgs, {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: true,
            });
            activeProcess = proc;
            const pid = proc.pid;
            writeFileSync(STREAM_PID, String(pid));
            await new Promise(r => setTimeout(r, 3000));
            if (proc.exitCode !== null) {
                return `Error switching source to "${newSource}". ffmpeg exited.`;
            }
            proc.unref();
            state.source = newSource;
            state.pid = pid;
            saveState(state);
            return `Scene switched to: ${newSource}\nStream continues on: ${platforms.join(', ')}`;
        },
    });
}
//# sourceMappingURL=streaming.js.map