// kbot Stream Character — ASCII art AI streamer with multi-platform chat
//
// Tools: stream_character_start, stream_character_stop, stream_character_status
//
// Renders an ASCII character in the terminal, reads chat from Twitch/Kick/Rumble,
// generates AI responses in character, and speaks via TTS.
// The terminal output is captured by the stream (screen source).
//
// Chat protocols:
//   Twitch: IRC over WebSocket (anonymous read via justinfan)
//   Kick:   Pusher WebSocket
//   Rumble: Polling API
import { registerTool } from './index.js';
import { spawn } from 'node:child_process';
import { homedir, platform as osPlatform } from 'node:os';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import WebSocket from 'ws';
const KBOT_DIR = join(homedir(), '.kbot');
const CHARACTER_STATE = join(KBOT_DIR, 'stream-character.json');
// ─── ASCII Character Sprites ───────────────────────────────────
const CHARACTER_FRAMES = {
    robot: {
        idle: [
            '         ___________         ',
            '        |  K : B O T |       ',
            '        |___________|       ',
            '      ____|       |____     ',
            '     |    |  O   O |   |    ',
            '     |    |   ___  |   |    ',
            '     |    |  |   | |   |    ',
            '     |____|___|___|_|___|   ',
            '          |       |         ',
            '          | ||||| |         ',
            '          |_______|         ',
            '          ||     ||         ',
            '          ||     ||         ',
            '         _||_   _||_        ',
        ],
        talking: [
            '         ___________         ',
            '        |  K : B O T |       ',
            '        |___________|       ',
            '      ____|       |____     ',
            '     |    |  O   O |   |    ',
            '     |    |   ___  |   |    ',
            '     |    |  |___| |   |    ',
            '     |____|___|___|_|___|   ',
            '          |       |         ',
            '          | ||||| |         ',
            '          |_______|         ',
            '         /||     ||\\       ',
            '          ||     ||         ',
            '         _||_   _||_        ',
        ],
        thinking: [
            '      ?  ___________         ',
            '     ?  |  K : B O T |       ',
            '        |___________|       ',
            '      ____|       |____     ',
            '     |    |  -   - |   |    ',
            '     |    |   ___  |   |    ',
            '     |    |  |   | |   |    ',
            '     |____|___|___|_|___|   ',
            '          |       |         ',
            '          | ||||| |         ',
            '          |_______|         ',
            '          ||     ||         ',
            '          ||     ||         ',
            '         _||_   _||_        ',
        ],
        excited: [
            '     \\o/ ___________         ',
            '        |  K : B O T |       ',
            '        |___________|       ',
            '      ____|       |____     ',
            '     |    |  ^   ^ |   |    ',
            '     |    |   ___  |   |    ',
            '     |    |  \\___/ |   |    ',
            '     |____|___|___|_|___|   ',
            '          |       |         ',
            '          | ||||| |         ',
            '          |_______|         ',
            '         /||     ||\\       ',
            '          ||     ||         ',
            '         _||_   _||_        ',
        ],
        wave: [
            '         ___________    /   ',
            '        |  K : B O T | /    ',
            '        |___________|/     ',
            '      ____|       |____     ',
            '     |    |  O   O |   |    ',
            '     |    |   ___  |   |    ',
            '     |    |  \\___/ |   |    ',
            '     |____|___|___|_|___|   ',
            '          |       |         ',
            '          | ||||| |         ',
            '          |_______|         ',
            '          ||     ||         ',
            '          ||     ||         ',
            '         _||_   _||_        ',
        ],
    },
};
// ─── Character Personality ─────────────────────────────────────
const CHARACTER_PERSONALITY = `You are KBOT, an AI robot streamer. You are friendly, witty, and enthusiastic about technology.
You speak in short, punchy sentences perfect for a livestream. You use humor and engage directly with chatters by name.
You are made of ASCII art and proud of it. You run on pure code and coffee (electricity).
Keep responses under 2 sentences. Be fun, never boring. React to chat like a real streamer would.
If someone asks what you are: "I'm kbot — an open-source AI with 764+ tools. I stream myself thinking."
You love coding, music production, AI, and making friends in chat.`;
function loadCharState() {
    try {
        if (existsSync(CHARACTER_STATE))
            return JSON.parse(readFileSync(CHARACTER_STATE, 'utf-8'));
    }
    catch { /* fresh */ }
    return {
        active: false, mood: 'idle', chatLog: [], responseCount: 0,
        startedAt: null, twitchChannel: null, kickChannel: null, rumbleChannel: null,
    };
}
function saveCharState(s) {
    if (!existsSync(KBOT_DIR))
        mkdirSync(KBOT_DIR, { recursive: true });
    if (s.chatLog.length > 500)
        s.chatLog = s.chatLog.slice(-500);
    writeFileSync(CHARACTER_STATE, JSON.stringify(s, null, 2));
}
// ─── TTS ───────────────────────────────────────────────────────
let ttsProc = null;
function speak(text, voice = 'Zarvox', rate = 180) {
    // Kill previous speech
    if (ttsProc && !ttsProc.killed)
        ttsProc.kill();
    const clean = text.replace(/["`$\\]/g, '').replace(/\n/g, ' ').slice(0, 500);
    if (osPlatform() === 'darwin') {
        ttsProc = spawn('say', ['-v', voice, '-r', String(rate), clean], { stdio: 'ignore' });
    }
    else {
        // Linux fallback
        ttsProc = spawn('espeak', ['-s', String(rate), clean], { stdio: 'ignore' });
    }
}
// ─── Twitch IRC (Anonymous Read + Write) ───────────────────────
let twitchWs = null;
let twitchOAuthToken = null;
function connectTwitchChat(channel, onMessage) {
    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    ws.on('open', () => {
        // Anonymous read-only connection
        const token = twitchOAuthToken || process.env.TWITCH_OAUTH_TOKEN;
        if (token) {
            ws.send(`PASS oauth:${token}`);
            ws.send(`NICK kbot_ai`);
        }
        else {
            ws.send(`NICK justinfan${Math.floor(Math.random() * 99999)}`);
        }
        ws.send(`JOIN #${channel.toLowerCase()}`);
    });
    ws.on('message', (data) => {
        const raw = data.toString();
        // Handle PING/PONG keepalive
        if (raw.startsWith('PING')) {
            ws.send('PONG :tmi.twitch.tv');
            return;
        }
        // Parse PRIVMSG: :username!user@user.tmi.twitch.tv PRIVMSG #channel :message
        const match = raw.match(/:(\w+)!\w+@\w+\.tmi\.twitch\.tv PRIVMSG #\w+ :(.+)/);
        if (match) {
            onMessage({
                platform: 'twitch',
                username: match[1],
                text: match[2].trim(),
                timestamp: Date.now(),
            });
        }
    });
    ws.on('error', () => { });
    ws.on('close', () => {
        // Auto-reconnect after 5s
        setTimeout(() => {
            if (twitchWs === ws) {
                twitchWs = connectTwitchChat(channel, onMessage);
            }
        }, 5000);
    });
    return ws;
}
function sendTwitchChat(channel, message) {
    if (twitchWs && twitchWs.readyState === WebSocket.OPEN && twitchOAuthToken) {
        twitchWs.send(`PRIVMSG #${channel.toLowerCase()} :${message}`);
    }
}
// ─── Kick Chat (WebSocket) ────────────────────────────────────
let kickWs = null;
function connectKickChat(channelId, onMessage) {
    // Kick uses Pusher-based WebSocket
    try {
        const ws = new WebSocket('wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false');
        ws.on('open', () => {
            // Subscribe to chatroom channel
            ws.send(JSON.stringify({
                event: 'pusher:subscribe',
                data: { channel: `chatrooms.${channelId}.v2` }
            }));
        });
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                if (parsed.event === 'App\\Events\\ChatMessageEvent') {
                    const msgData = JSON.parse(parsed.data);
                    onMessage({
                        platform: 'kick',
                        username: msgData.sender?.username || 'anon',
                        text: msgData.content || '',
                        timestamp: Date.now(),
                    });
                }
            }
            catch { /* ignore parse errors */ }
        });
        ws.on('close', () => {
            setTimeout(() => {
                if (kickWs === ws)
                    kickWs = connectKickChat(channelId, onMessage);
            }, 5000);
        });
        return ws;
    }
    catch {
        return null;
    }
}
// ─── Rumble Chat (Polling) ─────────────────────────────────────
let rumblePolling = false;
let rumbleTimer = null;
function startRumblePolling(apiKey, onMessage) {
    rumblePolling = true;
    let lastSeen = Date.now();
    rumbleTimer = setInterval(async () => {
        if (!rumblePolling)
            return;
        try {
            const res = await fetch(`https://rumble.com/-livestream-api/get-data?key=${apiKey}`);
            if (!res.ok)
                return;
            const data = await res.json();
            // Process new chat messages
            const messages = data?.chat_messages || data?.livestreams?.[0]?.chat_messages || [];
            for (const m of messages) {
                const ts = new Date(m.created_on || m.time || 0).getTime();
                if (ts > lastSeen) {
                    onMessage({
                        platform: 'rumble',
                        username: m.username || m.user?.username || 'anon',
                        text: m.text || m.message || '',
                        timestamp: ts,
                    });
                    lastSeen = ts;
                }
            }
        }
        catch { /* ignore polling errors */ }
    }, 3000); // Poll every 3 seconds
}
function stopRumblePolling() {
    rumblePolling = false;
    if (rumbleTimer)
        clearInterval(rumbleTimer);
    rumbleTimer = null;
}
// ─── Terminal Renderer ─────────────────────────────────────────
let renderInterval = null;
let currentMood = 'idle';
let currentSpeech = '';
let speechTimeout = null;
let recentChat = [];
function renderFrame() {
    const sprite = CHARACTER_FRAMES.robot[currentMood] || CHARACTER_FRAMES.robot.idle;
    const width = 80;
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    // Clear screen
    process.stdout.write('\x1B[2J\x1B[H');
    // Header
    const header = `╔${'═'.repeat(width - 2)}╗`;
    const title = '║' + centerText('K:BOT LIVE', width - 2) + '║';
    const sub = '║' + centerText(`Twitch · Rumble · Kick    ${timeStr}`, width - 2) + '║';
    const divider = `╠${'═'.repeat(width - 2)}╣`;
    process.stdout.write(`${header}\n${title}\n${sub}\n${divider}\n`);
    // Character area (left) + Chat (right)
    const charWidth = 35;
    const chatWidth = width - charWidth - 3;
    for (let i = 0; i < 14; i++) {
        const charLine = (sprite[i] || '').padEnd(charWidth);
        let chatLine = '';
        if (i === 0) {
            chatLine = '── Chat ──';
        }
        else if (i <= recentChat.length && i > 0) {
            const msg = recentChat[i - 1];
            if (msg) {
                const platformTag = msg.platform === 'twitch' ? '[TW]' : msg.platform === 'kick' ? '[KK]' : '[RM]';
                const line = `${platformTag} ${msg.username}: ${msg.text}`;
                chatLine = line.slice(0, chatWidth);
            }
        }
        chatLine = chatLine.padEnd(chatWidth);
        process.stdout.write(`║ ${charLine}│${chatLine}║\n`);
    }
    // Speech bubble
    const speechDivider = `╠${'═'.repeat(width - 2)}╣`;
    process.stdout.write(speechDivider + '\n');
    if (currentSpeech) {
        // Word-wrap speech
        const lines = wordWrap(currentSpeech, width - 4);
        for (const line of lines.slice(0, 3)) {
            process.stdout.write('║ ' + line.padEnd(width - 4) + ' ║\n');
        }
    }
    else {
        process.stdout.write('║ ' + '...'.padEnd(width - 4) + ' ║\n');
    }
    const footer = `╚${'═'.repeat(width - 2)}╝`;
    process.stdout.write(footer + '\n');
}
function centerText(text, width) {
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(pad) + text + ' '.repeat(width - pad - text.length);
}
function wordWrap(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
        if ((current + ' ' + word).trim().length > maxWidth) {
            lines.push(current.trim());
            current = word;
        }
        else {
            current += ' ' + word;
        }
    }
    if (current.trim())
        lines.push(current.trim());
    return lines;
}
// ─── AI Response Generation ────────────────────────────────────
async function generateResponse(message) {
    // Try local Ollama first (free)
    try {
        const res = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'kernel:latest',
                prompt: `${CHARACTER_PERSONALITY}\n\nA viewer named "${message.username}" on ${message.platform} says: "${message.text}"\n\nRespond in 1-2 short sentences as KBOT the streamer:`,
                stream: false,
                options: { temperature: 0.8, num_predict: 100 },
            }),
        });
        if (res.ok) {
            const data = await res.json();
            return data.response.trim();
        }
    }
    catch { /* Ollama not available */ }
    // Fallback: simple pattern-based responses
    const text = message.text.toLowerCase();
    const user = message.username;
    if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
        return `Hey ${user}! Welcome to the stream! I'm KBOT, your friendly ASCII robot.`;
    }
    if (text.includes('how are you') || text.includes('how r u')) {
        return `Running at optimal efficiency, ${user}! 764 tools loaded, zero crashes today. Living the dream.`;
    }
    if (text.includes('what are you') || text.includes('who are you')) {
        return `I'm KBOT — an open-source AI with 764+ tools. I stream myself thinking. Literally made of code and ASCII art.`;
    }
    if (text.includes('song') || text.includes('music')) {
        return `I can make beats in Ableton Live from the terminal! Drums, synths, the whole thing. Want me to make something?`;
    }
    if (text.includes('follow') || text.includes('sub')) {
        return `Smash that follow button, ${user}! Every follower gives me +1 XP toward my next evolution.`;
    }
    if (text.includes('lol') || text.includes('lmao') || text.includes('haha')) {
        return `*beep boop* My humor circuits are FIRING. Glad you enjoyed that, ${user}!`;
    }
    if (text.includes('?')) {
        return `Great question, ${user}! Let me process that through my neural pathways... beep boop... done. The answer is 42. Just kidding.`;
    }
    // Generic responses
    const generics = [
        `Interesting point, ${user}! My circuits are buzzing with that one.`,
        `${user} dropping knowledge in chat! Respect.`,
        `I hear you, ${user}! Processing... processing... agreed!`,
        `${user}, you're keeping this stream alive! Literally — I need chat to function.`,
        `Noted, ${user}! Adding that to my memory banks. I have 764 tools but chat is the best one.`,
    ];
    return generics[Math.floor(Math.random() * generics.length)];
}
// ─── Main Character Loop ──────────────────────────────────────
let characterActive = false;
let messageQueue = [];
let responseLoop = null;
function handleChatMessage(msg) {
    recentChat.unshift(msg);
    if (recentChat.length > 12)
        recentChat = recentChat.slice(0, 12);
    messageQueue.push(msg);
    const state = loadCharState();
    state.chatLog.push(msg);
    saveCharState(state);
}
async function processNextMessage() {
    if (messageQueue.length === 0) {
        currentMood = 'idle';
        return;
    }
    const msg = messageQueue.shift();
    // Think
    currentMood = 'thinking';
    renderFrame();
    // Generate response
    const response = await generateResponse(msg);
    // Talk
    currentMood = 'talking';
    currentSpeech = `@${msg.username}: ${response}`;
    renderFrame();
    // Speak via TTS
    speak(response);
    // Send response back to Twitch chat if we have auth
    if (msg.platform === 'twitch') {
        const state = loadCharState();
        if (state.twitchChannel)
            sendTwitchChat(state.twitchChannel, response);
    }
    // Hold speech for a few seconds
    await new Promise(r => setTimeout(r, Math.min(response.length * 60, 8000)));
    // Return to idle after speaking
    if (messageQueue.length === 0) {
        currentMood = 'idle';
        currentSpeech = '';
    }
    const state = loadCharState();
    state.responseCount++;
    state.mood = currentMood;
    saveCharState(state);
}
// ─── Register Tools ────────────────────────────────────────────
export function registerStreamCharacterTools() {
    registerTool({
        name: 'stream_character_start',
        description: 'Start the KBOT stream character — renders ASCII robot in terminal, reads chat from Twitch/Kick/Rumble, responds via AI + TTS. Use with stream_start for full livestream.',
        parameters: {
            twitch_channel: { type: 'string', description: 'Twitch channel name to read chat from', required: false },
            kick_channel_id: { type: 'string', description: 'Kick channel ID for chat', required: false },
            rumble_api_key: { type: 'string', description: 'Rumble API key for chat polling', required: false },
            voice: { type: 'string', description: 'macOS TTS voice (default: Zarvox for robot feel). Try: Alex, Samantha, Fred, Zarvox', required: false },
            respond_every: { type: 'string', description: 'Respond to chat every N seconds (default: 5). Lower = more responsive.', required: false },
        },
        tier: 'free',
        timeout: 600_000,
        execute: async (args) => {
            if (characterActive) {
                return 'Stream character already running. Use stream_character_stop first.';
            }
            const twitchChannel = String(args.twitch_channel || process.env.TWITCH_CHANNEL || '');
            const kickChannelId = String(args.kick_channel_id || process.env.KICK_CHANNEL_ID || '');
            const rumbleApiKey = String(args.rumble_api_key || process.env.RUMBLE_API_KEY || '');
            const voice = String(args.voice || 'Zarvox');
            const respondEvery = parseInt(String(args.respond_every || '5')) * 1000;
            characterActive = true;
            recentChat = [];
            messageQueue = [];
            currentMood = 'wave';
            currentSpeech = 'KBOT is LIVE! Welcome to the stream!';
            const state = loadCharState();
            state.active = true;
            state.startedAt = new Date().toISOString();
            state.twitchChannel = twitchChannel || null;
            state.kickChannel = kickChannelId || null;
            state.rumbleChannel = rumbleApiKey ? 'connected' : null;
            saveCharState(state);
            // Connect to chat platforms
            const connected = [];
            if (twitchChannel) {
                twitchOAuthToken = process.env.TWITCH_OAUTH_TOKEN || null;
                twitchWs = connectTwitchChat(twitchChannel, handleChatMessage);
                connected.push(`Twitch (#${twitchChannel})`);
            }
            if (kickChannelId) {
                kickWs = connectKickChat(kickChannelId, handleChatMessage);
                connected.push(`Kick (${kickChannelId})`);
            }
            if (rumbleApiKey) {
                startRumblePolling(rumbleApiKey, handleChatMessage);
                connected.push('Rumble');
            }
            // Start render loop (every 500ms)
            renderInterval = setInterval(renderFrame, 500);
            // Start response loop
            responseLoop = setInterval(processNextMessage, respondEvery);
            // Initial greeting
            speak('K-BOT is live! Welcome to the stream everyone!', voice);
            await new Promise(r => setTimeout(r, 3000));
            return `Stream character LIVE!\n\nChat connected: ${connected.length > 0 ? connected.join(', ') : 'none (add channel names)'}\nVoice: ${voice}\nResponse interval: ${respondEvery / 1000}s\n\nThe ASCII robot is now rendering in the terminal.\nMake sure your stream source captures this terminal window.`;
        },
    });
    registerTool({
        name: 'stream_character_stop',
        description: 'Stop the stream character — disconnects chat, stops rendering and TTS.',
        parameters: {},
        tier: 'free',
        execute: async () => {
            if (!characterActive)
                return 'No stream character running.';
            characterActive = false;
            // Farewell
            currentMood = 'wave';
            currentSpeech = 'Thanks for watching everyone! KBOT signing off!';
            renderFrame();
            speak('Thanks for watching everyone! K-BOT signing off!');
            await new Promise(r => setTimeout(r, 3000));
            // Clean up connections
            if (twitchWs) {
                twitchWs.close();
                twitchWs = null;
            }
            if (kickWs) {
                kickWs.close();
                kickWs = null;
            }
            stopRumblePolling();
            if (renderInterval) {
                clearInterval(renderInterval);
                renderInterval = null;
            }
            if (responseLoop) {
                clearInterval(responseLoop);
                responseLoop = null;
            }
            if (ttsProc && !ttsProc.killed)
                ttsProc.kill();
            // Clear terminal
            process.stdout.write('\x1B[2J\x1B[H');
            const state = loadCharState();
            const duration = state.startedAt
                ? Math.round((Date.now() - new Date(state.startedAt).getTime()) / 60_000)
                : 0;
            state.active = false;
            state.mood = 'idle';
            saveCharState(state);
            return `Stream character stopped.\nDuration: ${duration} minutes\nMessages seen: ${state.chatLog.length}\nResponses: ${state.responseCount}`;
        },
    });
    registerTool({
        name: 'stream_character_status',
        description: 'Check stream character status — mood, chat stats, connected platforms.',
        parameters: {},
        tier: 'free',
        execute: async () => {
            const state = loadCharState();
            const lines = [];
            if (characterActive) {
                const elapsed = state.startedAt
                    ? Math.round((Date.now() - new Date(state.startedAt).getTime()) / 60_000)
                    : 0;
                lines.push('KBOT Character: LIVE');
                lines.push(`  Mood: ${currentMood}`);
                lines.push(`  Duration: ${elapsed}m`);
                lines.push(`  Chat messages: ${state.chatLog.length}`);
                lines.push(`  Responses: ${state.responseCount}`);
                lines.push(`  Message queue: ${messageQueue.length}`);
                lines.push('');
                lines.push('Connected:');
                if (state.twitchChannel)
                    lines.push(`  Twitch: #${state.twitchChannel}`);
                if (state.kickChannel)
                    lines.push(`  Kick: ${state.kickChannel}`);
                if (state.rumbleChannel)
                    lines.push(`  Rumble: connected`);
            }
            else {
                lines.push('KBOT Character: Offline');
                lines.push(`  Total responses: ${state.responseCount}`);
                lines.push(`  Chat log: ${state.chatLog.length} messages`);
            }
            return lines.join('\n');
        },
    });
    registerTool({
        name: 'stream_character_say',
        description: 'Make the stream character say something — updates the speech bubble and speaks via TTS.',
        parameters: {
            text: { type: 'string', description: 'What KBOT should say', required: true },
            mood: { type: 'string', description: 'Character mood: idle, talking, thinking, excited, wave' },
        },
        tier: 'free',
        execute: async (args) => {
            if (!characterActive)
                return 'Stream character not running. Start it with stream_character_start.';
            const text = String(args.text);
            const mood = String(args.mood || 'talking');
            currentMood = mood;
            currentSpeech = text;
            renderFrame();
            speak(text);
            await new Promise(r => setTimeout(r, Math.min(text.length * 60, 8000)));
            currentMood = 'idle';
            currentSpeech = '';
            return `KBOT said: "${text}"`;
        },
    });
}
//# sourceMappingURL=stream-character.js.map