// kbot Pika Skills Integration — AI video meeting bots, avatars, voice cloning
//
// Wraps the Pika-Labs/Pika-Skills Python toolkit so kbot users can:
//   - Install the Pika Skills repo to ~/.kbot/pika-skills/
//   - Join Google Meet calls with an AI avatar bot
//   - Leave active meetings
//   - Generate AI avatar images
//   - Clone voices from audio files
//   - Check installation status and list available skills
//
// Requires: Python 3.10+, PIKA_DEV_KEY env var, optional ffmpeg
// All tools are tier: 'free' — Pika's API handles its own billing.
import { registerTool } from './index.js';
import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
const PIKA_DIR = join(homedir(), '.kbot', 'pika-skills');
const MEETING_SKILL_DIR = join(PIKA_DIR, 'pikastream-video-meeting');
const REPO_URL = 'https://github.com/Pika-Labs/Pika-Skills.git';
// Track active meeting sessions (pid-based, lives in memory for the kbot process)
const activeSessions = new Map();
// ── Helpers ─────────────────────────────────────────────────────────────
/** Check if Python 3.10+ is available */
function checkPython() {
    for (const bin of ['python3', 'python']) {
        try {
            const raw = execSync(`${bin} --version 2>&1`, { encoding: 'utf-8', timeout: 5000 }).trim();
            const match = raw.match(/Python\s+(\d+)\.(\d+)\.(\d+)/);
            if (match) {
                const major = parseInt(match[1], 10);
                const minor = parseInt(match[2], 10);
                if (major >= 3 && minor >= 10) {
                    const fullPath = execSync(`which ${bin}`, { encoding: 'utf-8', timeout: 5000 }).trim();
                    return { ok: true, version: `${major}.${minor}.${match[3]}`, path: fullPath };
                }
            }
        }
        catch { /* try next binary */ }
    }
    return { ok: false, version: '', path: '' };
}
/** Get the PIKA_DEV_KEY from env or kbot config */
function getPikaKey() {
    // Check environment variable first
    if (process.env.PIKA_DEV_KEY)
        return process.env.PIKA_DEV_KEY;
    // Check ~/.kbot/config.json (stored alongside other API keys)
    try {
        const configPath = join(homedir(), '.kbot', 'config.json');
        if (existsSync(configPath)) {
            const config = JSON.parse(readFileSync(configPath, 'utf-8'));
            if (config.pika_dev_key)
                return config.pika_dev_key;
            if (config.PIKA_DEV_KEY)
                return config.PIKA_DEV_KEY;
        }
    }
    catch { /* not found */ }
    return null;
}
/** Check if ffmpeg is available */
function checkFfmpeg() {
    try {
        execSync('ffmpeg -version', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
        return true;
    }
    catch {
        return false;
    }
}
/** Check if the Pika Skills repo is cloned and ready */
function isInstalled() {
    return existsSync(PIKA_DIR) && existsSync(join(PIKA_DIR, '.git'));
}
/** Check if the video meeting skill specifically is installed */
function isMeetingSkillInstalled() {
    return existsSync(MEETING_SKILL_DIR) && existsSync(join(MEETING_SKILL_DIR, 'SKILL.md'));
}
/** Generate a unique session ID */
function generateSessionId() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `pika-${ts}-${rand}`;
}
/** Run a Python script in the meeting skill directory */
function runPythonScript(scriptName, args, opts) {
    const python = checkPython();
    if (!python.ok) {
        throw new Error('Python 3.10+ is required but not found. Install from https://python.org');
    }
    const scriptPath = join(MEETING_SKILL_DIR, 'scripts', scriptName);
    if (!existsSync(scriptPath)) {
        throw new Error(`Script not found: ${scriptPath}. Run ghost_install first.`);
    }
    const pikaKey = getPikaKey();
    const env = { ...process.env };
    if (pikaKey)
        env.PIKA_DEV_KEY = pikaKey;
    const timeout = opts?.timeout ?? 60_000;
    const result = execSync(`${python.path} ${scriptPath} ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`, {
        cwd: MEETING_SKILL_DIR,
        encoding: 'utf-8',
        timeout,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
}
/** Spawn a long-running Python process (for meeting join which stays alive) */
function spawnPythonProcess(scriptName, args) {
    const python = checkPython();
    if (!python.ok) {
        throw new Error('Python 3.10+ is required but not found. Install from https://python.org');
    }
    const scriptPath = join(MEETING_SKILL_DIR, 'scripts', scriptName);
    if (!existsSync(scriptPath)) {
        throw new Error(`Script not found: ${scriptPath}. Run ghost_install first.`);
    }
    const pikaKey = getPikaKey();
    const env = { ...process.env };
    if (pikaKey)
        env.PIKA_DEV_KEY = pikaKey;
    const sessionId = generateSessionId();
    const child = spawn(python.path, [scriptPath, ...args], {
        cwd: MEETING_SKILL_DIR,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true,
    });
    // Allow the parent process to exit without waiting for the child
    child.unref();
    return { process: child, sessionId };
}
function scanSkills() {
    if (!isInstalled())
        return [];
    const skills = [];
    try {
        const entries = readdirSync(PIKA_DIR, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            if (entry.name.startsWith('.'))
                continue; // skip .git etc
            const skillDir = join(PIKA_DIR, entry.name);
            const skillMdPath = join(skillDir, 'SKILL.md');
            const hasSkillMd = existsSync(skillMdPath);
            let description = '';
            if (hasSkillMd) {
                try {
                    const content = readFileSync(skillMdPath, 'utf-8');
                    // Extract first non-empty, non-heading line as description
                    const lines = content.split('\n');
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
                            description = trimmed.slice(0, 120);
                            break;
                        }
                    }
                }
                catch { /* skip */ }
            }
            skills.push({
                name: entry.name,
                path: skillDir,
                hasSkillMd,
                description,
            });
        }
    }
    catch { /* dir unreadable */ }
    return skills;
}
// ── Tool Registration ───────────────────────────────────────────────────
export function registerGhostTools() {
    // ── ghost_install ──────────────────────────────────────────────────────
    registerTool({
        name: 'ghost_install',
        description: 'Install Pika Skills — clone the repo to ~/.kbot/pika-skills/, install Python dependencies. Checks for Python 3.10+ and PIKA_DEV_KEY.',
        parameters: {
            force: {
                type: 'boolean',
                description: 'Force re-clone even if already installed',
                required: false,
                default: false,
            },
        },
        tier: 'free',
        timeout: 300_000, // 5 min for clone + pip install
        async execute(args) {
            const force = args.force === true;
            // 1. Check Python
            const python = checkPython();
            if (!python.ok) {
                return JSON.stringify({
                    success: false,
                    error: 'Python 3.10+ is required but not found.',
                    fix: 'Install Python 3.10+ from https://python.org or via your package manager (brew install python, apt install python3.10)',
                });
            }
            // 2. Check PIKA_DEV_KEY
            const pikaKey = getPikaKey();
            const keyStatus = pikaKey
                ? `configured (${pikaKey.slice(0, 6)}...)`
                : 'NOT SET — set PIKA_DEV_KEY env var or add pika_dev_key to ~/.kbot/config.json';
            // 3. Clone or update
            const kbotDir = join(homedir(), '.kbot');
            if (!existsSync(kbotDir))
                mkdirSync(kbotDir, { recursive: true });
            if (isInstalled() && !force) {
                // Pull latest
                try {
                    execSync('git pull --ff-only', { cwd: PIKA_DIR, encoding: 'utf-8', timeout: 30_000, stdio: 'pipe' });
                }
                catch {
                    // Not critical — repo exists, may be offline
                }
            }
            else {
                // Clone fresh
                if (existsSync(PIKA_DIR)) {
                    execSync(`rm -rf "${PIKA_DIR}"`, { encoding: 'utf-8', timeout: 15_000 });
                }
                try {
                    execSync(`git clone --depth 1 "${REPO_URL}" "${PIKA_DIR}"`, {
                        encoding: 'utf-8',
                        timeout: 60_000,
                        stdio: 'pipe',
                    });
                }
                catch (err) {
                    return JSON.stringify({
                        success: false,
                        error: `Failed to clone Pika-Skills repo: ${err instanceof Error ? err.message : String(err)}`,
                        fix: `Check your internet connection and try again. Repo: ${REPO_URL}`,
                    });
                }
            }
            // 4. Install Python dependencies for the video meeting skill
            let pipStatus = 'skipped';
            if (isMeetingSkillInstalled()) {
                const requirementsPath = join(MEETING_SKILL_DIR, 'requirements.txt');
                if (existsSync(requirementsPath)) {
                    try {
                        execSync(`${python.path} -m pip install -r "${requirementsPath}" --quiet`, {
                            cwd: MEETING_SKILL_DIR,
                            encoding: 'utf-8',
                            timeout: 120_000,
                            stdio: 'pipe',
                        });
                        pipStatus = 'installed';
                    }
                    catch (err) {
                        pipStatus = `failed: ${err instanceof Error ? err.message : String(err)}`;
                    }
                }
                else {
                    pipStatus = 'no requirements.txt found';
                }
            }
            // 5. Check ffmpeg
            const hasFfmpeg = checkFfmpeg();
            // 6. Scan available skills
            const skills = scanSkills();
            return JSON.stringify({
                success: true,
                installed_at: PIKA_DIR,
                python: { version: python.version, path: python.path },
                pika_dev_key: keyStatus,
                pip_dependencies: pipStatus,
                ffmpeg: hasFfmpeg ? 'available' : 'not found (optional, needed for voice cloning)',
                skills_found: skills.length,
                skills: skills.map(s => ({ name: s.name, description: s.description })),
                meeting_skill: isMeetingSkillInstalled() ? 'ready' : 'not found in repo',
            });
        },
    });
    // ── ghost_join ─────────────────────────────────────────────────
    registerTool({
        name: 'ghost_join',
        description: 'Join a Google Meet call with a Pika AI avatar bot. The bot can participate in the meeting with custom behavior defined by a system prompt. Returns a session ID for later leaving.',
        parameters: {
            meet_url: {
                type: 'string',
                description: 'Google Meet URL (e.g. https://meet.google.com/abc-defg-hij)',
                required: true,
            },
            bot_name: {
                type: 'string',
                description: 'Name of the bot that appears in the meeting (default: "kbot Assistant")',
                required: false,
                default: 'kbot Assistant',
            },
            avatar: {
                type: 'string',
                description: 'Path to avatar image file, or a previously generated avatar path',
                required: false,
            },
            voice_id: {
                type: 'string',
                description: 'Voice ID from a previous ghost_voice call',
                required: false,
            },
            system_prompt: {
                type: 'string',
                description: 'Instructions for what the bot should say and do in the meeting (e.g. "Take notes and summarize action items")',
                required: false,
            },
        },
        tier: 'free',
        timeout: 120_000,
        async execute(args) {
            // Validate installation
            if (!isMeetingSkillInstalled()) {
                return JSON.stringify({
                    success: false,
                    error: 'Pika Skills not installed. Run ghost_install first.',
                });
            }
            // Validate PIKA_DEV_KEY
            const pikaKey = getPikaKey();
            if (!pikaKey) {
                return JSON.stringify({
                    success: false,
                    error: 'PIKA_DEV_KEY not set. Set the environment variable or add pika_dev_key to ~/.kbot/config.json',
                });
            }
            const meetUrl = String(args.meet_url || '').trim();
            if (!meetUrl || !meetUrl.includes('meet.google.com')) {
                return JSON.stringify({
                    success: false,
                    error: 'Invalid meet_url — must be a Google Meet link (e.g. https://meet.google.com/abc-defg-hij)',
                });
            }
            const botName = String(args.bot_name || 'kbot Assistant');
            const avatar = args.avatar ? String(args.avatar) : undefined;
            const voiceId = args.voice_id ? String(args.voice_id) : undefined;
            const systemPrompt = args.system_prompt ? String(args.system_prompt) : undefined;
            // Build command args
            const scriptArgs = ['--meet-url', meetUrl, '--bot-name', botName];
            if (avatar)
                scriptArgs.push('--avatar', avatar);
            if (voiceId)
                scriptArgs.push('--voice-id', voiceId);
            if (systemPrompt)
                scriptArgs.push('--system-prompt', systemPrompt);
            try {
                const { process: child, sessionId } = spawnPythonProcess('join.py', scriptArgs);
                // Wait briefly for early errors
                let earlyOutput = '';
                let earlyError = '';
                await new Promise((resolve) => {
                    const timer = setTimeout(() => resolve(), 5000);
                    child.stdout?.on('data', (data) => {
                        earlyOutput += data.toString();
                    });
                    child.stderr?.on('data', (data) => {
                        earlyError += data.toString();
                    });
                    child.on('error', (err) => {
                        earlyError += err.message;
                        clearTimeout(timer);
                        resolve();
                    });
                    child.on('exit', (code) => {
                        if (code !== null && code !== 0) {
                            earlyError += `Process exited with code ${code}`;
                        }
                        clearTimeout(timer);
                        resolve();
                    });
                });
                // Check for immediate failure
                if (earlyError && !child.pid) {
                    return JSON.stringify({
                        success: false,
                        error: `Failed to start meeting bot: ${earlyError}`,
                    });
                }
                // Track the session
                if (child.pid) {
                    activeSessions.set(sessionId, {
                        pid: child.pid,
                        meetUrl,
                        startedAt: new Date().toISOString(),
                    });
                }
                return JSON.stringify({
                    success: true,
                    session_id: sessionId,
                    pid: child.pid,
                    meet_url: meetUrl,
                    bot_name: botName,
                    avatar: avatar ?? 'default',
                    voice_id: voiceId ?? 'default',
                    system_prompt: systemPrompt ?? 'none',
                    early_output: earlyOutput || undefined,
                    message: `Bot "${botName}" is joining ${meetUrl}. Use ghost_leave with session_id "${sessionId}" to end the session.`,
                });
            }
            catch (err) {
                return JSON.stringify({
                    success: false,
                    error: `Failed to join meeting: ${err instanceof Error ? err.message : String(err)}`,
                });
            }
        },
    });
    // ── ghost_leave ────────────────────────────────────────────────
    registerTool({
        name: 'ghost_leave',
        description: 'Leave an active Pika meeting session. Terminates the bot process.',
        parameters: {
            session_id: {
                type: 'string',
                description: 'Session ID returned from ghost_join',
                required: true,
            },
        },
        tier: 'free',
        timeout: 30_000,
        async execute(args) {
            const sessionId = String(args.session_id || '').trim();
            if (!sessionId) {
                return JSON.stringify({
                    success: false,
                    error: 'session_id is required',
                });
            }
            const session = activeSessions.get(sessionId);
            // Try the leave script first (graceful leave)
            if (isMeetingSkillInstalled()) {
                try {
                    const output = runPythonScript('leave.py', ['--session-id', sessionId], { timeout: 15_000 });
                    activeSessions.delete(sessionId);
                    return JSON.stringify({
                        success: true,
                        session_id: sessionId,
                        message: 'Bot left the meeting gracefully.',
                        output,
                    });
                }
                catch {
                    // Fall through to process kill
                }
            }
            // Fallback: kill the process directly
            if (session) {
                try {
                    process.kill(session.pid, 'SIGTERM');
                    activeSessions.delete(sessionId);
                    return JSON.stringify({
                        success: true,
                        session_id: sessionId,
                        message: `Process ${session.pid} terminated. Bot removed from meeting.`,
                    });
                }
                catch (err) {
                    activeSessions.delete(sessionId);
                    return JSON.stringify({
                        success: true,
                        session_id: sessionId,
                        message: `Session cleaned up. Process may have already exited: ${err instanceof Error ? err.message : String(err)}`,
                    });
                }
            }
            return JSON.stringify({
                success: false,
                error: `Session "${sessionId}" not found. It may have already ended. Active sessions: ${activeSessions.size}`,
            });
        },
    });
    // ── ghost_avatar ──────────────────────────────────────────────
    registerTool({
        name: 'ghost_avatar',
        description: 'Generate an AI avatar image using Pika. Returns the path to the generated image for use in ghost_join.',
        parameters: {
            prompt: {
                type: 'string',
                description: 'Description of the avatar (e.g. "professional woman with short brown hair in a blue blazer")',
                required: true,
            },
            output_path: {
                type: 'string',
                description: 'Optional path to save the avatar image. Defaults to ~/.kbot/pika-skills/avatars/<timestamp>.png',
                required: false,
            },
        },
        tier: 'free',
        timeout: 120_000,
        async execute(args) {
            if (!isMeetingSkillInstalled()) {
                return JSON.stringify({
                    success: false,
                    error: 'Pika Skills not installed. Run ghost_install first.',
                });
            }
            const pikaKey = getPikaKey();
            if (!pikaKey) {
                return JSON.stringify({
                    success: false,
                    error: 'PIKA_DEV_KEY not set. Set the environment variable or add pika_dev_key to ~/.kbot/config.json',
                });
            }
            const prompt = String(args.prompt || '').trim();
            if (!prompt) {
                return JSON.stringify({ success: false, error: 'prompt is required' });
            }
            const outputPath = args.output_path
                ? String(args.output_path)
                : undefined;
            const scriptArgs = ['--prompt', prompt];
            if (outputPath)
                scriptArgs.push('--output', outputPath);
            try {
                const output = runPythonScript('generate-avatar.py', scriptArgs, { timeout: 90_000 });
                // Try to extract the file path from script output
                const pathMatch = output.match(/(?:saved|generated|output|path)[:\s]+(.+\.(?:png|jpg|jpeg|webp))/i);
                const generatedPath = pathMatch ? pathMatch[1].trim() : output.trim();
                return JSON.stringify({
                    success: true,
                    prompt,
                    avatar_path: generatedPath,
                    output,
                    message: `Avatar generated. Use the avatar_path with ghost_join to join meetings with this avatar.`,
                });
            }
            catch (err) {
                return JSON.stringify({
                    success: false,
                    error: `Avatar generation failed: ${err instanceof Error ? err.message : String(err)}`,
                });
            }
        },
    });
    // ── ghost_voice ──────────────────────────────────────────────────
    registerTool({
        name: 'ghost_voice',
        description: 'Clone a voice from an audio file using Pika. Returns a voice_id for use in ghost_join.',
        parameters: {
            audio_path: {
                type: 'string',
                description: 'Path to an audio file (WAV, MP3, etc.) containing the voice to clone',
                required: true,
            },
            noise_reduction: {
                type: 'boolean',
                description: 'Apply noise reduction before cloning (recommended for noisy recordings)',
                required: false,
                default: false,
            },
        },
        tier: 'free',
        timeout: 120_000,
        async execute(args) {
            if (!isMeetingSkillInstalled()) {
                return JSON.stringify({
                    success: false,
                    error: 'Pika Skills not installed. Run ghost_install first.',
                });
            }
            const pikaKey = getPikaKey();
            if (!pikaKey) {
                return JSON.stringify({
                    success: false,
                    error: 'PIKA_DEV_KEY not set. Set the environment variable or add pika_dev_key to ~/.kbot/config.json',
                });
            }
            const audioPath = String(args.audio_path || '').trim();
            if (!audioPath) {
                return JSON.stringify({ success: false, error: 'audio_path is required' });
            }
            if (!existsSync(audioPath)) {
                return JSON.stringify({
                    success: false,
                    error: `Audio file not found: ${audioPath}`,
                });
            }
            const noiseReduction = args.noise_reduction === true;
            // Check ffmpeg if noise reduction requested
            if (noiseReduction && !checkFfmpeg()) {
                return JSON.stringify({
                    success: false,
                    error: 'Noise reduction requires ffmpeg. Install: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)',
                });
            }
            const scriptArgs = ['--audio', audioPath];
            if (noiseReduction)
                scriptArgs.push('--noise-reduction');
            try {
                const output = runPythonScript('clone-voice.py', scriptArgs, { timeout: 90_000 });
                // Try to extract voice_id from script output
                const idMatch = output.match(/(?:voice[_-]?id|id)[:\s]+([a-zA-Z0-9_-]+)/i);
                const voiceId = idMatch ? idMatch[1].trim() : output.trim();
                return JSON.stringify({
                    success: true,
                    voice_id: voiceId,
                    audio_path: audioPath,
                    noise_reduction: noiseReduction,
                    output,
                    message: `Voice cloned. Use voice_id "${voiceId}" with ghost_join.`,
                });
            }
            catch (err) {
                return JSON.stringify({
                    success: false,
                    error: `Voice cloning failed: ${err instanceof Error ? err.message : String(err)}`,
                });
            }
        },
    });
    // ── ghost_status ───────────────────────────────────────────────────────
    registerTool({
        name: 'ghost_status',
        description: 'Check Pika Skills installation status, API key configuration, Python version, ffmpeg, and active meeting sessions.',
        parameters: {},
        tier: 'free',
        async execute() {
            const python = checkPython();
            const pikaKey = getPikaKey();
            const hasFfmpeg = checkFfmpeg();
            const installed = isInstalled();
            const meetingSkill = isMeetingSkillInstalled();
            const skills = installed ? scanSkills() : [];
            // Check active sessions
            const sessions = [];
            for (const [id, session] of activeSessions) {
                let alive = false;
                try {
                    process.kill(session.pid, 0); // Check if process is alive (signal 0)
                    alive = true;
                }
                catch {
                    activeSessions.delete(id); // Clean up dead sessions
                }
                if (alive) {
                    sessions.push({ id, meetUrl: session.meetUrl, startedAt: session.startedAt, alive });
                }
            }
            return JSON.stringify({
                installed,
                install_path: PIKA_DIR,
                python: python.ok
                    ? { status: 'ok', version: python.version, path: python.path }
                    : { status: 'missing', fix: 'Install Python 3.10+ from https://python.org' },
                pika_dev_key: pikaKey
                    ? { status: 'configured', preview: `${pikaKey.slice(0, 6)}...` }
                    : { status: 'not set', fix: 'Set PIKA_DEV_KEY env var or add pika_dev_key to ~/.kbot/config.json' },
                ffmpeg: hasFfmpeg ? 'available' : 'not found (optional, needed for voice cloning noise reduction)',
                meeting_skill: meetingSkill ? 'ready' : installed ? 'not found in repo' : 'not installed',
                skills_count: skills.length,
                skills: skills.map(s => ({ name: s.name, description: s.description })),
                active_sessions: sessions,
            });
        },
    });
    // ── ghost_skills ──────────────────────────────────────────────────
    registerTool({
        name: 'ghost_skills',
        description: 'List all available Pika Skills installed at ~/.kbot/pika-skills/. Scans for directories containing SKILL.md files.',
        parameters: {
            verbose: {
                type: 'boolean',
                description: 'Include full SKILL.md content for each skill',
                required: false,
                default: false,
            },
        },
        tier: 'free',
        async execute(args) {
            if (!isInstalled()) {
                return JSON.stringify({
                    success: false,
                    error: 'Pika Skills not installed. Run ghost_install first.',
                    install_command: 'Use the ghost_install tool to clone the Pika-Skills repository.',
                });
            }
            const verbose = args.verbose === true;
            const skills = scanSkills();
            if (skills.length === 0) {
                return JSON.stringify({
                    success: true,
                    skills: [],
                    message: 'No skills found. The Pika-Skills repository may be empty or have a different structure. Try running ghost_install with force=true.',
                });
            }
            const result = skills.map(s => {
                const entry = {
                    name: s.name,
                    path: s.path,
                    has_skill_md: s.hasSkillMd,
                    description: s.description,
                };
                if (verbose && s.hasSkillMd) {
                    try {
                        entry.skill_md = readFileSync(join(s.path, 'SKILL.md'), 'utf-8');
                    }
                    catch { /* skip */ }
                }
                return entry;
            });
            return JSON.stringify({
                success: true,
                install_path: PIKA_DIR,
                skills_count: skills.length,
                skills: result,
            });
        },
    });
}
//# sourceMappingURL=ghost.js.map