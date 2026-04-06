// kbot Stream Commands — Chat command registry + viewer interaction system
//
// Tools: commands_list, commands_stats, commands_inventory, commands_leaderboard
//
// Handles all !-prefixed chat commands during livestreams:
//   Fun:    !duel, !gift, !trade, !roll, !8ball, !slots, !rps, !fortune, !quote
//   World:  !weather, !biome, !music, !theme, !time
//   Game:   !challenge, !bet, !boss, !raid, !draw
//   Items:  !inventory, !equip, !shop, !buy
//   Social: !hug, !highfive, !wave, !dance, !stats, !leaderboard, !rank
//   Admin:  !timeout, !shoutout, !poll, !endpoll, !giveaway, !enter
//
// Persists state to ~/.kbot/stream-commands-state.json
import { registerTool } from './index.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const KBOT_DIR = join(homedir(), '.kbot');
const STATE_FILE = join(KBOT_DIR, 'stream-commands-state.json');
const LEVEL_ORDER = ['viewer', 'regular', 'vip', 'moderator'];
// ─── Item Catalog ─────────────────────────────────────────────
const ITEM_CATALOG = {
    crown: { id: 'crown', name: 'Crown', type: 'hat', description: 'A golden crown', cost: 100 },
    wizard: { id: 'wizard', name: 'Wizard Hat', type: 'hat', description: 'Pointy and magical', cost: 80 },
    pirate: { id: 'pirate', name: 'Pirate Hat', type: 'hat', description: 'Yarr!', cost: 60 },
    bunny: { id: 'bunny', name: 'Bunny Ears', type: 'hat', description: 'Floppy and cute', cost: 50 },
    top_hat: { id: 'top_hat', name: 'Top Hat', type: 'hat', description: 'Classy and distinguished', cost: 90 },
    santa: { id: 'santa', name: 'Santa Hat', type: 'hat', description: 'Ho ho ho!', cost: 70 },
    first_chat: { id: 'first_chat', name: 'First Chat', type: 'badge', description: 'Sent first message', cost: 0 },
    msg_100: { id: 'msg_100', name: '100 Messages', type: 'badge', description: 'Chatted 100 times', cost: 0 },
    raider: { id: 'raider', name: 'Raider', type: 'badge', description: 'Participated in a raid', cost: 0 },
    duelist: { id: 'duelist', name: 'Duelist', type: 'badge', description: 'Won a duel', cost: 0 },
    winner: { id: 'winner', name: 'Winner', type: 'badge', description: 'Won a challenge', cost: 0 },
    paintbrush: { id: 'paintbrush', name: 'Paintbrush', type: 'tool', description: 'Draw on the canvas', cost: 40 },
    wrench: { id: 'wrench', name: 'Wrench', type: 'tool', description: 'Fix things', cost: 35 },
    telescope: { id: 'telescope', name: 'Telescope', type: 'tool', description: 'See farther', cost: 45 },
    cat_pet: { id: 'cat_pet', name: 'Cat', type: 'pet', description: 'A pixel cat companion', cost: 120 },
    dog_pet: { id: 'dog_pet', name: 'Dog', type: 'pet', description: 'A pixel dog companion', cost: 120 },
    bird_pet: { id: 'bird_pet', name: 'Bird', type: 'pet', description: 'A pixel bird companion', cost: 100 },
};
// ─── Data Pools ───────────────────────────────────────────────
const EIGHT_BALL = [
    'It is certain.', 'Without a doubt.', 'Yes, definitely.', 'Most likely.',
    'Outlook good.', 'Signs point to yes.', 'Reply hazy, try again.', 'Ask again later.',
    'Don\'t count on it.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.',
];
const SLOT_EMOJIS = ['7', '$', '*', '#', '+', '%', '!', '&'];
const FORTUNES = [
    'A bug you wrote today will save you tomorrow.', 'Your next commit will be your best yet.',
    'The linter sees all, forgives nothing.', 'Today is a good day to refactor.',
    'Push with confidence. The CI will catch you.', 'Beware of off-by-one errors. Or was it two?',
];
const QUOTES = [
    '"Any fool can write code that a computer can understand. Good programmers write code that humans can understand." - Fowler',
    '"First, solve the problem. Then, write the code." - Johnson',
    '"Code is like humor. When you have to explain it, it\'s bad." - House',
    '"Make it work, make it right, make it fast." - Beck',
    '"Talk is cheap. Show me the code." - Torvalds',
    '"Debugging is twice as hard as writing the code in the first place." - Kernighan',
];
const TRIVIA = [
    { q: 'What does HTML stand for?', a: 'hypertext markup language' },
    { q: 'What year was JavaScript created?', a: '1995' },
    { q: 'What does CPU stand for?', a: 'central processing unit' },
    { q: 'What language is the Linux kernel written in?', a: 'c' },
    { q: 'What does API stand for?', a: 'application programming interface' },
    { q: 'Who created TypeScript?', a: 'microsoft' },
    { q: 'What does CSS stand for?', a: 'cascading style sheets' },
    { q: 'What port does HTTPS use?', a: '443' },
];
const MATH_OPS = ['+', '-', '*'];
// ─── StreamCommands Class ─────────────────────────────────────
export class StreamCommands {
    commands = new Map();
    viewers = {};
    globalCooldowns = new Map(); // command -> last used timestamp
    userCooldowns = new Map(); // user -> (command -> timestamp)
    currentPoll = null;
    currentGiveaway = null;
    currentBoss = null;
    currentChallenge = null;
    worldVotes = new Map();
    currentFrame = 0;
    pendingDuels = new Map(); // target -> info
    pendingTrades = new Map();
    raidActive = false;
    raidTarget = '';
    raidParticipants = new Set();
    constructor() {
        this.loadState();
        this.registerBuiltinCommands();
    }
    // ─── Public API ───────────────────────────────────────────
    registerCommand(cmd) {
        this.commands.set(cmd.name.toLowerCase(), cmd);
    }
    handleMessage(username, message, platform, isMod = false) {
        const user = username.toLowerCase();
        this.ensureViewer(user);
        this.viewers[user].messageCount++;
        this.viewers[user].xp += 1; // chat msg = 1 XP
        // Badge checks
        if (this.viewers[user].messageCount === 1)
            this.grantItem(user, 'first_chat');
        if (this.viewers[user].messageCount === 100)
            this.grantItem(user, 'msg_100');
        // Timeout check
        if (this.viewers[user].timedOutUntil && Date.now() < this.viewers[user].timedOutUntil) {
            return null;
        }
        if (!message.startsWith('!'))
            return null;
        const parts = message.slice(1).trim().split(/\s+/);
        const cmdName = parts[0]?.toLowerCase();
        if (!cmdName)
            return null;
        const args = parts.slice(1);
        // Handle special: !enter for giveaways
        if (cmdName === 'enter' && this.currentGiveaway) {
            if (!this.currentGiveaway.entrants.includes(user)) {
                this.currentGiveaway.entrants.push(user);
            }
            return { command: 'enter', response: `${username} entered the giveaway!`, username, xpAwarded: 0 };
        }
        // Handle challenge answers
        if (this.currentChallenge && cmdName === 'answer') {
            const answer = args.join(' ').toLowerCase().trim();
            if (answer === this.currentChallenge.answer) {
                this.viewers[user].xp += 15;
                this.grantItem(user, 'winner');
                const resp = `${username} got it right! +15 XP`;
                this.currentChallenge = null;
                return { command: 'answer', response: resp, username, xpAwarded: 15 };
            }
            return { command: 'answer', response: `${username}, that's not right. Keep trying!`, username, xpAwarded: 0 };
        }
        // Handle duel accept
        if (cmdName === 'accept') {
            const duel = this.pendingDuels.get(user);
            if (duel) {
                this.pendingDuels.delete(user);
                const winner = Math.random() < 0.5 ? user : duel.challenger;
                const loser = winner === user ? duel.challenger : user;
                this.viewers[winner].xp += 10;
                this.grantItem(winner, 'duelist');
                return { command: 'accept', response: `Duel! ${winner} defeats ${loser}! +10 XP to the winner!`, username, xpAwarded: winner === user ? 10 : 0 };
            }
        }
        const cmd = this.commands.get(cmdName);
        if (!cmd)
            return null;
        const level = this.getLevel(user, isMod);
        if (LEVEL_ORDER.indexOf(level) < LEVEL_ORDER.indexOf(cmd.minLevel)) {
            return { command: cmdName, response: `${username}, you need ${cmd.minLevel} level for !${cmdName}`, username, xpAwarded: 0 };
        }
        // Global cooldown
        const now = Date.now();
        const lastGlobal = this.globalCooldowns.get(cmdName) ?? 0;
        if (now - lastGlobal < cmd.cooldown) {
            const remaining = Math.ceil((cmd.cooldown - (now - lastGlobal)) / 1000);
            return { command: cmdName, response: `!${cmdName} is on cooldown (${remaining}s)`, username, xpAwarded: 0 };
        }
        // Per-user cooldown (2x the global cooldown)
        if (!this.userCooldowns.has(user))
            this.userCooldowns.set(user, new Map());
        const userCds = this.userCooldowns.get(user);
        const lastUser = userCds.get(cmdName) ?? 0;
        if (now - lastUser < cmd.cooldown * 2) {
            return { command: cmdName, response: `${username}, wait a bit before using !${cmdName} again`, username, xpAwarded: 0 };
        }
        const ctx = { username: user, args, platform, isMod, level };
        const response = cmd.handler(ctx);
        this.globalCooldowns.set(cmdName, now);
        userCds.set(cmdName, now);
        this.viewers[user].xp += 2; // command use = 2 XP
        return { command: cmdName, response, username, xpAwarded: 2 };
    }
    getCommands() {
        return Array.from(this.commands.values()).map(c => ({
            name: c.name, description: c.description, cooldown: c.cooldown, minLevel: c.minLevel,
        }));
    }
    getInventory(username) {
        const v = this.viewers[username.toLowerCase()];
        if (!v)
            return [];
        return v.inventory
            .map(id => ITEM_CATALOG[id])
            .filter((x) => !!x)
            .map(({ cost, ...item }) => item);
    }
    getLeaderboard(limit = 10) {
        return Object.entries(this.viewers)
            .sort(([, a], [, b]) => b.xp - a.xp)
            .slice(0, limit)
            .map(([name, data], i) => ({
            username: name, xp: data.xp, rank: i + 1, messageCount: data.messageCount,
        }));
    }
    getViewerStats(username) {
        const user = username.toLowerCase();
        this.ensureViewer(user);
        const v = this.viewers[user];
        const sorted = Object.entries(this.viewers).sort(([, a], [, b]) => b.xp - a.xp);
        const rank = sorted.findIndex(([n]) => n === user) + 1;
        return {
            username: user, xp: v.xp, messageCount: v.messageCount, rank,
            level: this.getLevel(user, false),
            inventory: this.getInventory(user),
            equipped: { ...v.equipped },
            joinedAt: v.joinedAt,
        };
    }
    tick(frame) {
        this.currentFrame = frame;
        for (const [t, i] of this.pendingDuels) {
            if (frame - i.frame > 360)
                this.pendingDuels.delete(t);
        }
        for (const [t, i] of this.pendingTrades) {
            if (frame - i.frame > 360)
                this.pendingTrades.delete(t);
        }
        for (const [t, p] of this.worldVotes) {
            if (frame - p.startFrame > 720)
                this.worldVotes.delete(t);
        }
        if (this.currentChallenge && frame - this.currentChallenge.startFrame > 270)
            this.currentChallenge = null;
        if (this.currentBoss && frame - this.currentBoss.startFrame > 1080)
            this.currentBoss = null;
        if (frame % 1800 === 0)
            this.saveState();
    }
    render(ctx, width, height) {
        const px = width - 280;
        let y = 10;
        if (this.currentPoll) {
            const p = this.currentPoll, totals = this.tallyVotes(p);
            const tv = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(px, y, 270, 20 + p.options.length * 18);
            ctx.fillStyle = '#58a6ff';
            ctx.font = 'bold 13px monospace';
            ctx.fillText(`POLL: ${p.question}`, px + 8, y + 15);
            p.options.forEach((opt, i) => {
                const c = totals[opt] ?? 0, pct = Math.round((c / tv) * 100);
                ctx.fillStyle = '#1a3a1a';
                ctx.fillRect(px + 8, y + 22 + i * 18, 200, 12);
                ctx.fillStyle = '#3fb950';
                ctx.fillRect(px + 8, y + 22 + i * 18, Math.round((c / tv) * 200), 12);
                ctx.fillStyle = '#c9d1d9';
                ctx.font = '11px monospace';
                ctx.fillText(`${opt}: ${c} (${pct}%)`, px + 8, y + 32 + i * 18);
            });
            y += 26 + p.options.length * 18;
        }
        if (this.currentGiveaway) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(px, y, 270, 40);
            ctx.fillStyle = '#f0c040';
            ctx.font = 'bold 13px monospace';
            ctx.fillText(`GIVEAWAY: ${this.currentGiveaway.prize}`, px + 8, y + 15);
            ctx.fillStyle = '#c9d1d9';
            ctx.font = '11px monospace';
            ctx.fillText(`Type !enter — ${this.currentGiveaway.entrants.length} entrants`, px + 8, y + 32);
            y += 46;
        }
        if (this.currentBoss) {
            const hp = this.currentBoss.hp / this.currentBoss.maxHp;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(px, y, 270, 38);
            ctx.fillStyle = '#f85149';
            ctx.font = 'bold 13px monospace';
            ctx.fillText(`BOSS: ${this.currentBoss.hp}/${this.currentBoss.maxHp} HP`, px + 8, y + 15);
            ctx.fillStyle = '#2a1a1a';
            ctx.fillRect(px + 8, y + 22, 254, 10);
            ctx.fillStyle = hp > 0.5 ? '#f85149' : hp > 0.2 ? '#f0c040' : '#3fb950';
            ctx.fillRect(px + 8, y + 22, Math.round(254 * hp), 10);
            y += 44;
        }
        if (this.currentChallenge) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(px, y, 270, 36);
            ctx.fillStyle = '#bc8cff';
            ctx.font = 'bold 13px monospace';
            ctx.fillText(`CHALLENGE: ${this.currentChallenge.type.toUpperCase()}`, px + 8, y + 15);
            ctx.fillStyle = '#c9d1d9';
            ctx.font = '11px monospace';
            ctx.fillText(this.currentChallenge.question, px + 8, y + 30);
        }
    }
    saveState() {
        if (!existsSync(KBOT_DIR))
            mkdirSync(KBOT_DIR, { recursive: true });
        const state = { viewers: this.viewers };
        writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    }
    loadState() {
        if (!existsSync(STATE_FILE))
            return;
        try {
            const raw = readFileSync(STATE_FILE, 'utf-8');
            const state = JSON.parse(raw);
            this.viewers = state.viewers ?? {};
        }
        catch { /* corrupt file, start fresh */ }
    }
    // ─── Internals ────────────────────────────────────────────
    ensureViewer(user) {
        if (!this.viewers[user]) {
            this.viewers[user] = {
                xp: 0, messageCount: 0, inventory: [], equipped: {},
                joinedAt: new Date().toISOString(), lastFortune: '',
            };
        }
    }
    getLevel(user, isMod) {
        if (isMod)
            return 'moderator';
        const v = this.viewers[user];
        if (!v)
            return 'viewer';
        if (v.xp >= 500)
            return 'vip';
        if (v.messageCount >= 10)
            return 'regular';
        return 'viewer';
    }
    grantItem(user, itemId) {
        this.ensureViewer(user);
        if (!this.viewers[user].inventory.includes(itemId)) {
            this.viewers[user].inventory.push(itemId);
        }
    }
    tallyVotes(poll) {
        const counts = {};
        for (const opt of poll.options)
            counts[opt] = 0;
        for (const vote of Object.values(poll.votes)) {
            if (counts[vote] !== undefined)
                counts[vote]++;
        }
        return counts;
    }
    pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
    tallyWorldVote(topic) {
        const pool = this.worldVotes.get(topic);
        if (!pool || Object.keys(pool.votes).length === 0)
            return null;
        const counts = {};
        for (const v of Object.values(pool.votes))
            counts[v] = (counts[v] ?? 0) + 1;
        let best = '', bestCount = 0;
        for (const [k, c] of Object.entries(counts)) {
            if (c > bestCount) {
                best = k;
                bestCount = c;
            }
        }
        return best;
    }
    castWorldVote(topic, user, choice) {
        if (!this.worldVotes.has(topic)) {
            this.worldVotes.set(topic, { topic, votes: {}, startFrame: this.currentFrame });
        }
        const pool = this.worldVotes.get(topic);
        pool.votes[user] = choice.toLowerCase();
        const total = Object.keys(pool.votes).length;
        const leader = this.tallyWorldVote(topic);
        return `${user} voted "${choice}" for ${topic}! (${total} votes, leading: ${leader})`;
    }
    // ─── Register All Built-in Commands ────────────────────────
    registerBuiltinCommands() {
        // ── Fun Commands ──────────────────────────────────────────
        this.registerCommand({
            name: 'duel', description: 'Challenge someone to a duel (coin flip)', cooldown: 10000, minLevel: 'regular',
            handler: (ctx) => {
                const target = ctx.args[0]?.replace('@', '').toLowerCase();
                if (!target || target === ctx.username)
                    return `${ctx.username}, you need to challenge someone else!`;
                this.pendingDuels.set(target, { challenger: ctx.username, frame: this.currentFrame });
                return `${ctx.username} challenges ${target} to a duel! ${target}, type !accept within 60s!`;
            },
        });
        this.registerCommand({
            name: 'gift', description: 'Give an item to another viewer', cooldown: 5000, minLevel: 'regular',
            handler: (ctx) => {
                const target = ctx.args[0]?.replace('@', '').toLowerCase();
                const itemId = ctx.args[1]?.toLowerCase();
                if (!target || !itemId)
                    return 'Usage: !gift @user item_name';
                const v = this.viewers[ctx.username];
                if (!v || !v.inventory.includes(itemId))
                    return `${ctx.username}, you don't have ${itemId}!`;
                v.inventory = v.inventory.filter(i => i !== itemId);
                this.ensureViewer(target);
                this.grantItem(target, itemId);
                return `${ctx.username} gifted ${itemId} to ${target}!`;
            },
        });
        this.registerCommand({
            name: 'trade', description: 'Propose a trade with another viewer', cooldown: 10000, minLevel: 'regular',
            handler: (ctx) => {
                const target = ctx.args[0]?.replace('@', '').toLowerCase();
                if (!target)
                    return 'Usage: !trade @user';
                this.pendingTrades.set(target, { from: ctx.username, frame: this.currentFrame });
                return `${ctx.username} wants to trade with ${target}! (feature coming soon)`;
            },
        });
        this.registerCommand({
            name: 'roll', description: 'Roll dice (default 1d20)', cooldown: 3000, minLevel: 'viewer',
            handler: (ctx) => {
                const spec = ctx.args[0] || '1d20';
                const match = spec.match(/^(\d+)d(\d+)$/i);
                if (!match)
                    return `${ctx.username}, use format NdN (e.g., 2d6)`;
                const count = Math.min(parseInt(match[1], 10), 20);
                const sides = Math.min(parseInt(match[2], 10), 100);
                if (count < 1 || sides < 2)
                    return `${ctx.username}, invalid dice!`;
                const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
                const total = rolls.reduce((a, b) => a + b, 0);
                return `${ctx.username} rolled ${spec}: [${rolls.join(', ')}] = ${total}`;
            },
        });
        this.registerCommand({
            name: '8ball', description: 'Ask the magic 8-ball', cooldown: 5000, minLevel: 'viewer',
            handler: (ctx) => {
                if (ctx.args.length === 0)
                    return `${ctx.username}, ask a question! Usage: !8ball [question]`;
                return `${ctx.username}: ${this.pick(EIGHT_BALL)}`;
            },
        });
        this.registerCommand({
            name: 'slots', description: 'Spin the slot machine', cooldown: 8000, minLevel: 'viewer',
            handler: (ctx) => {
                const a = this.pick(SLOT_EMOJIS);
                const b = this.pick(SLOT_EMOJIS);
                const c = this.pick(SLOT_EMOJIS);
                if (a === b && b === c) {
                    this.viewers[ctx.username].xp += 50;
                    return `[ ${a} | ${b} | ${c} ] JACKPOT! ${ctx.username} wins 50 XP!`;
                }
                if (a === b || b === c || a === c) {
                    this.viewers[ctx.username].xp += 10;
                    return `[ ${a} | ${b} | ${c} ] Two match! ${ctx.username} wins 10 XP!`;
                }
                return `[ ${a} | ${b} | ${c} ] No match. Better luck next time, ${ctx.username}!`;
            },
        });
        this.registerCommand({
            name: 'rps', description: 'Play rock-paper-scissors against kbot', cooldown: 5000, minLevel: 'viewer',
            handler: (ctx) => {
                const choices = ['rock', 'paper', 'scissors'];
                const player = ctx.args[0]?.toLowerCase();
                if (!player || !choices.includes(player))
                    return 'Usage: !rps rock|paper|scissors';
                const bot = this.pick([...choices]);
                if (player === bot)
                    return `${ctx.username}: ${player} vs ${bot} — It's a tie!`;
                const wins = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
                if (wins[player] === bot) {
                    this.viewers[ctx.username].xp += 5;
                    return `${ctx.username}: ${player} vs ${bot} — You win! +5 XP`;
                }
                return `${ctx.username}: ${player} vs ${bot} — kbot wins!`;
            },
        });
        this.registerCommand({
            name: 'fortune', description: 'Get your daily fortune cookie', cooldown: 10000, minLevel: 'viewer',
            handler: (ctx) => {
                const today = new Date().toISOString().slice(0, 10);
                if (this.viewers[ctx.username]?.lastFortune === today) {
                    return `${ctx.username}, you already got your fortune today! Come back tomorrow.`;
                }
                this.viewers[ctx.username].lastFortune = today;
                return `${ctx.username}'s fortune: ${this.pick(FORTUNES)}`;
            },
        });
        this.registerCommand({
            name: 'quote', description: 'Get a random programming quote', cooldown: 8000, minLevel: 'viewer',
            handler: () => this.pick(QUOTES),
        });
        // ── World Commands ────────────────────────────────────────
        this.registerCommand({
            name: 'weather', description: 'Vote for weather change', cooldown: 5000, minLevel: 'viewer',
            handler: (ctx) => {
                const types = ['rain', 'snow', 'clear', 'storm', 'fog', 'wind'];
                const choice = ctx.args[0]?.toLowerCase();
                if (!choice || !types.includes(choice))
                    return `Usage: !weather ${types.join('|')}`;
                return this.castWorldVote('weather', ctx.username, choice);
            },
        });
        this.registerCommand({
            name: 'biome', description: 'Vote for biome change', cooldown: 5000, minLevel: 'viewer',
            handler: (ctx) => {
                const biomes = ['forest', 'desert', 'ocean', 'mountain', 'cave', 'space', 'city'];
                const choice = ctx.args[0]?.toLowerCase();
                if (!choice || !biomes.includes(choice))
                    return `Usage: !biome ${biomes.join('|')}`;
                return this.castWorldVote('biome', ctx.username, choice);
            },
        });
        this.registerCommand({
            name: 'music', description: 'Vote for music mood', cooldown: 5000, minLevel: 'viewer',
            handler: (ctx) => {
                const moods = ['chill', 'hype', 'dark', 'epic', 'jazz', 'lofi', 'synthwave'];
                const choice = ctx.args[0]?.toLowerCase();
                if (!choice || !moods.includes(choice))
                    return `Usage: !music ${moods.join('|')}`;
                return this.castWorldVote('music', ctx.username, choice);
            },
        });
        this.registerCommand({
            name: 'theme', description: 'Vote for visual theme', cooldown: 5000, minLevel: 'viewer',
            handler: (ctx) => {
                const themes = ['dark', 'retro', 'neon', 'forest'];
                const choice = ctx.args[0]?.toLowerCase();
                if (!choice || !themes.includes(choice))
                    return `Usage: !theme ${themes.join('|')}`;
                return this.castWorldVote('theme', ctx.username, choice);
            },
        });
        this.registerCommand({
            name: 'time', description: 'Vote for time of day', cooldown: 5000, minLevel: 'viewer',
            handler: (ctx) => {
                const times = ['day', 'night', 'dawn', 'dusk'];
                const choice = ctx.args[0]?.toLowerCase();
                if (!choice || !times.includes(choice))
                    return `Usage: !time ${times.join('|')}`;
                return this.castWorldVote('time', ctx.username, choice);
            },
        });
        // ── Game Commands ─────────────────────────────────────────
        this.registerCommand({
            name: 'challenge', description: 'Start a chat challenge', cooldown: 30000, minLevel: 'regular',
            handler: (ctx) => {
                if (this.currentChallenge)
                    return 'A challenge is already active! Type !answer [your answer]';
                const type = (ctx.args[0]?.toLowerCase() || 'trivia');
                if (type === 'trivia') {
                    const q = this.pick(TRIVIA);
                    this.currentChallenge = { type, question: q.q, answer: q.a, startFrame: this.currentFrame, bets: {} };
                    return `TRIVIA: ${q.q} — Type !answer [your answer]`;
                }
                if (type === 'math') {
                    const a = Math.floor(Math.random() * 50) + 1;
                    const b = Math.floor(Math.random() * 50) + 1;
                    const op = this.pick([...MATH_OPS]);
                    const result = op === '+' ? a + b : op === '-' ? a - b : a * b;
                    this.currentChallenge = { type, question: `${a} ${op} ${b} = ?`, answer: String(result), startFrame: this.currentFrame, bets: {} };
                    return `MATH: What is ${a} ${op} ${b}? Type !answer [number]`;
                }
                // typing — generate a random word sequence
                const words = ['kbot', 'stream', 'code', 'hack', 'build', 'ship', 'test', 'debug'];
                const phrase = Array.from({ length: 4 }, () => this.pick(words)).join(' ');
                this.currentChallenge = { type: 'typing', question: `Type: "${phrase}"`, answer: phrase, startFrame: this.currentFrame, bets: {} };
                return `TYPING RACE: Type exactly: "${phrase}" — Use !answer [phrase]`;
            },
        });
        this.registerCommand({
            name: 'bet', description: 'Bet XP on an outcome', cooldown: 5000, minLevel: 'regular',
            handler: (ctx) => {
                const amount = parseInt(ctx.args[0], 10);
                const choice = ctx.args.slice(1).join(' ').toLowerCase();
                if (!amount || amount < 1 || !choice)
                    return 'Usage: !bet [amount] [choice]';
                if (this.viewers[ctx.username].xp < amount)
                    return `${ctx.username}, you only have ${this.viewers[ctx.username].xp} XP!`;
                if (!this.currentChallenge && !this.currentBoss)
                    return 'Nothing to bet on right now!';
                this.viewers[ctx.username].xp -= amount;
                if (this.currentChallenge) {
                    this.currentChallenge.bets[ctx.username] = { amount, choice };
                }
                return `${ctx.username} bet ${amount} XP on "${choice}"`;
            },
        });
        this.registerCommand({
            name: 'boss', description: 'Summon a collaborative boss fight', cooldown: 60000, minLevel: 'regular',
            handler: (ctx) => {
                if (this.currentBoss) {
                    // Attack the boss
                    const dmg = Math.floor(Math.random() * 20) + 5;
                    this.currentBoss.hp = Math.max(0, this.currentBoss.hp - dmg);
                    this.currentBoss.contributors[ctx.username] = (this.currentBoss.contributors[ctx.username] ?? 0) + dmg;
                    if (this.currentBoss.hp <= 0) {
                        const rewards = [];
                        for (const [user, contrib] of Object.entries(this.currentBoss.contributors)) {
                            this.ensureViewer(user);
                            const bonus = Math.min(Math.floor(contrib / 5) * 5, 50);
                            this.viewers[user].xp += bonus;
                            rewards.push(`${user}: +${bonus} XP`);
                        }
                        this.currentBoss = null;
                        return `BOSS DEFEATED! Rewards: ${rewards.join(', ')}`;
                    }
                    return `${ctx.username} hit the boss for ${dmg} damage! HP: ${this.currentBoss.hp}/${this.currentBoss.maxHp}`;
                }
                const hp = 200 + Math.floor(Math.random() * 300);
                this.currentBoss = { hp, maxHp: hp, contributors: {}, startFrame: this.currentFrame };
                return `A wild BOSS appeared with ${hp} HP! Type !boss to attack!`;
            },
        });
        this.registerCommand({
            name: 'raid', description: 'Start a viewer raid event', cooldown: 120000, minLevel: 'regular',
            handler: (ctx) => {
                const target = ctx.args[0];
                if (!target)
                    return 'Usage: !raid [target]';
                if (this.raidActive) {
                    this.raidParticipants.add(ctx.username);
                    return `${ctx.username} joined the raid! (${this.raidParticipants.size} raiders)`;
                }
                this.raidActive = true;
                this.raidTarget = target;
                this.raidParticipants = new Set([ctx.username]);
                this.grantItem(ctx.username, 'raider');
                // Auto-end raid after 60s
                setTimeout(() => {
                    for (const user of this.raidParticipants) {
                        this.ensureViewer(user);
                        this.viewers[user].xp += 5;
                        this.grantItem(user, 'raider');
                    }
                    this.raidActive = false;
                    this.raidParticipants.clear();
                }, 60_000);
                return `RAID on ${target}! Type !raid ${target} to join! (60s)`;
            },
        });
        this.registerCommand({
            name: 'draw', description: 'Draw on the stream canvas', cooldown: 3000, minLevel: 'viewer',
            handler: (ctx) => {
                const text = ctx.args.join(' ');
                if (!text)
                    return 'Usage: !draw [pixel art description]';
                if (!this.viewers[ctx.username]?.inventory.includes('paintbrush')) {
                    return `${ctx.username}, you need a paintbrush! Buy one at the !shop`;
                }
                return `${ctx.username} draws: ${text.slice(0, 30)} (displayed on stream)`;
            },
        });
        // ── Inventory Commands ────────────────────────────────────
        this.registerCommand({
            name: 'inventory', description: 'Show your items', cooldown: 5000, minLevel: 'viewer',
            handler: (ctx) => {
                const items = this.getInventory(ctx.username);
                if (items.length === 0)
                    return `${ctx.username}, your inventory is empty! Try the !shop`;
                return `${ctx.username}'s items: ${items.map(i => `${i.name}(${i.type})`).join(', ')}`;
            },
        });
        this.registerCommand({
            name: 'equip', description: 'Equip a hat or pet', cooldown: 3000, minLevel: 'viewer',
            handler: (ctx) => {
                const itemId = ctx.args[0]?.toLowerCase();
                if (!itemId)
                    return 'Usage: !equip [item_name]';
                const v = this.viewers[ctx.username];
                if (!v?.inventory.includes(itemId))
                    return `${ctx.username}, you don't have ${itemId}!`;
                const item = ITEM_CATALOG[itemId];
                if (!item)
                    return `Unknown item: ${itemId}`;
                if (item.type === 'hat') {
                    v.equipped.hat = itemId;
                    return `${ctx.username} equipped ${item.name}!`;
                }
                if (item.type === 'pet') {
                    v.equipped.pet = itemId;
                    return `${ctx.username}'s new companion: ${item.name}!`;
                }
                return `${ctx.username}, you can only equip hats and pets!`;
            },
        });
        this.registerCommand({
            name: 'shop', description: 'Browse items for sale', cooldown: 5000, minLevel: 'viewer',
            handler: (ctx) => {
                const buyable = Object.values(ITEM_CATALOG).filter(i => i.cost > 0);
                const lines = buyable.map(i => `${i.id}(${i.cost}XP)`);
                return `Shop: ${lines.join(', ')} — Use !buy [item]`;
            },
        });
        this.registerCommand({
            name: 'buy', description: 'Purchase an item with XP', cooldown: 3000, minLevel: 'viewer',
            handler: (ctx) => {
                const itemId = ctx.args[0]?.toLowerCase();
                if (!itemId)
                    return 'Usage: !buy [item_name]';
                const item = ITEM_CATALOG[itemId];
                if (!item || item.cost <= 0)
                    return `"${itemId}" is not for sale!`;
                const v = this.viewers[ctx.username];
                if (v.inventory.includes(itemId))
                    return `${ctx.username}, you already have ${item.name}!`;
                if (v.xp < item.cost)
                    return `${ctx.username}, you need ${item.cost} XP but have ${v.xp}!`;
                v.xp -= item.cost;
                this.grantItem(ctx.username, itemId);
                return `${ctx.username} bought ${item.name} for ${item.cost} XP! (${v.xp} XP remaining)`;
            },
        });
        // ── Social Commands ───────────────────────────────────────
        this.registerCommand({
            name: 'hug', description: 'Hug another viewer', cooldown: 5000, minLevel: 'viewer',
            handler: (ctx) => {
                const target = ctx.args[0]?.replace('@', '') || 'chat';
                return `${ctx.username} hugs ${target}!`;
            },
        });
        this.registerCommand({
            name: 'highfive', description: 'High five another viewer', cooldown: 5000, minLevel: 'viewer',
            handler: (ctx) => {
                const target = ctx.args[0]?.replace('@', '') || 'kbot';
                return `${ctx.username} high-fives ${target}!`;
            },
        });
        this.registerCommand({
            name: 'wave', description: 'Wave at chat', cooldown: 3000, minLevel: 'viewer',
            handler: (ctx) => `${ctx.username} waves at everyone!`,
        });
        this.registerCommand({
            name: 'dance', description: 'Make kbot dance', cooldown: 10000, minLevel: 'viewer',
            handler: (ctx) => `${ctx.username} made kbot dance!`,
        });
        this.registerCommand({
            name: 'stats', description: 'Show your viewer stats', cooldown: 5000, minLevel: 'viewer',
            handler: (ctx) => {
                const s = this.getViewerStats(ctx.username);
                return `${s.username} — XP: ${s.xp} | Msgs: ${s.messageCount} | Rank: #${s.rank} | Level: ${s.level} | Items: ${s.inventory.length}`;
            },
        });
        this.registerCommand({
            name: 'leaderboard', description: 'Top 10 XP earners', cooldown: 10000, minLevel: 'viewer',
            handler: () => {
                const lb = this.getLeaderboard(10);
                if (lb.length === 0)
                    return 'Leaderboard is empty!';
                return lb.map(e => `#${e.rank} ${e.username}: ${e.xp} XP`).join(' | ');
            },
        });
        this.registerCommand({
            name: 'rank', description: 'Show your current rank', cooldown: 5000, minLevel: 'viewer',
            handler: (ctx) => {
                const s = this.getViewerStats(ctx.username);
                return `${ctx.username} is rank #${s.rank} with ${s.xp} XP (${s.level})`;
            },
        });
        // ── Admin Commands (moderator only) ───────────────────────
        this.registerCommand({
            name: 'timeout', description: 'Timeout a user', cooldown: 1000, minLevel: 'moderator',
            handler: (ctx) => {
                const target = ctx.args[0]?.replace('@', '').toLowerCase();
                const seconds = parseInt(ctx.args[1], 10) || 60;
                if (!target)
                    return 'Usage: !timeout @user [seconds]';
                this.ensureViewer(target);
                this.viewers[target].timedOutUntil = Date.now() + seconds * 1000;
                return `${target} timed out for ${seconds}s by ${ctx.username}`;
            },
        });
        this.registerCommand({
            name: 'shoutout', description: 'Shoutout overlay for a user', cooldown: 10000, minLevel: 'moderator',
            handler: (ctx) => {
                const target = ctx.args[0]?.replace('@', '');
                if (!target)
                    return 'Usage: !shoutout @user';
                return `SHOUTOUT to ${target}! Go check them out!`;
            },
        });
        this.registerCommand({
            name: 'poll', description: 'Start a poll', cooldown: 30000, minLevel: 'moderator',
            handler: (ctx) => {
                if (this.currentPoll)
                    return 'A poll is already active! Use !endpoll first.';
                if (ctx.args.length < 3)
                    return 'Usage: !poll [question] [option1] [option2] ...';
                const question = ctx.args[0];
                const options = ctx.args.slice(1);
                this.currentPoll = { question, options, votes: {}, startFrame: this.currentFrame };
                return `POLL: ${question} — Vote: ${options.map((o, i) => `!vote ${o}`).join(' or ')}`;
            },
        });
        this.registerCommand({
            name: 'endpoll', description: 'End the current poll', cooldown: 1000, minLevel: 'moderator',
            handler: () => {
                if (!this.currentPoll)
                    return 'No active poll!';
                const totals = this.tallyVotes(this.currentPoll);
                const results = Object.entries(totals).sort(([, a], [, b]) => b - a);
                const winner = results[0];
                const summary = results.map(([opt, count]) => `${opt}: ${count}`).join(', ');
                this.currentPoll = null;
                return `POLL ENDED! Winner: ${winner?.[0]} (${winner?.[1]} votes) — ${summary}`;
            },
        });
        this.registerCommand({
            name: 'vote', description: 'Vote in the current poll', cooldown: 1000, minLevel: 'viewer',
            handler: (ctx) => {
                if (!this.currentPoll)
                    return 'No active poll!';
                const choice = ctx.args[0]?.toLowerCase();
                if (!choice)
                    return 'Usage: !vote [option]';
                const match = this.currentPoll.options.find(o => o.toLowerCase() === choice);
                if (!match)
                    return `Invalid option. Choices: ${this.currentPoll.options.join(', ')}`;
                this.currentPoll.votes[ctx.username] = match;
                return `${ctx.username} voted for ${match}!`;
            },
        });
        this.registerCommand({
            name: 'giveaway', description: 'Start a giveaway', cooldown: 60000, minLevel: 'moderator',
            handler: (ctx) => {
                if (this.currentGiveaway) {
                    // Pick a winner
                    if (this.currentGiveaway.entrants.length === 0) {
                        this.currentGiveaway = null;
                        return 'Giveaway ended with no entrants!';
                    }
                    const winner = this.pick(this.currentGiveaway.entrants);
                    const prize = this.currentGiveaway.prize;
                    this.currentGiveaway = null;
                    this.ensureViewer(winner);
                    this.viewers[winner].xp += 25;
                    return `GIVEAWAY WINNER: ${winner} wins "${prize}"! +25 XP`;
                }
                const prize = ctx.args.join(' ') || 'mystery prize';
                this.currentGiveaway = { prize, entrants: [], startFrame: this.currentFrame };
                return `GIVEAWAY: "${prize}" — Type !enter to join!`;
            },
        });
    }
}
// ─── Singleton ──────────────────────────────────────────────
let instance = null;
export function getStreamCommands() {
    if (!instance)
        instance = new StreamCommands();
    return instance;
}
// ─── Tool Registration ──────────────────────────────────────
export function registerStreamCommandsTools() {
    registerTool({
        name: 'commands_list',
        description: 'List all available stream chat commands with descriptions, cooldowns, and required viewer levels.',
        parameters: {
            level: { type: 'string', description: 'Filter by minimum level: viewer, regular, vip, moderator' },
        },
        tier: 'free',
        execute: async (args) => {
            const cmds = getStreamCommands().getCommands();
            const level = args.level?.toLowerCase();
            const filtered = level
                ? cmds.filter(c => c.minLevel === level)
                : cmds;
            const lines = filtered.map(c => `!${c.name} — ${c.description} (cooldown: ${c.cooldown / 1000}s, level: ${c.minLevel})`);
            return `Stream Commands (${filtered.length}):\n${lines.join('\n')}`;
        },
    });
    registerTool({
        name: 'commands_stats',
        description: 'Get viewer stats for a specific user: XP, messages, rank, level, inventory, equipped items.',
        parameters: {
            username: { type: 'string', description: 'Viewer username to look up', required: true },
        },
        tier: 'free',
        execute: async (args) => {
            const username = args.username;
            const stats = getStreamCommands().getViewerStats(username);
            return JSON.stringify(stats, null, 2);
        },
    });
    registerTool({
        name: 'commands_inventory',
        description: 'Get the inventory (items, hats, badges, pets, tools) for a specific viewer.',
        parameters: {
            username: { type: 'string', description: 'Viewer username', required: true },
        },
        tier: 'free',
        execute: async (args) => {
            const username = args.username;
            const items = getStreamCommands().getInventory(username);
            if (items.length === 0)
                return `${username} has no items.`;
            return items.map(i => `${i.name} (${i.type}): ${i.description}`).join('\n');
        },
    });
    registerTool({
        name: 'commands_leaderboard',
        description: 'Get the XP leaderboard for stream viewers. Returns top N viewers sorted by XP.',
        parameters: {
            limit: { type: 'string', description: 'Number of entries to return (default: 10)' },
        },
        tier: 'free',
        execute: async (args) => {
            const limit = parseInt(args.limit, 10) || 10;
            const lb = getStreamCommands().getLeaderboard(limit);
            if (lb.length === 0)
                return 'Leaderboard is empty — no viewers tracked yet.';
            return lb.map(e => `#${e.rank} ${e.username}: ${e.xp} XP (${e.messageCount} msgs)`).join('\n');
        },
    });
} // end registerStreamCommandsTools
//# sourceMappingURL=stream-commands.js.map