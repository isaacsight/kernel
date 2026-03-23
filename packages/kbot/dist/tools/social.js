// kbot Social Tools — kbot posts as itself on social media
//
// Tools: social_post, social_thread, social_status, social_setup
//
// kbot is the user. It generates content from its own codebase,
// posts to X (Twitter) and LinkedIn, and tracks what it posted.
//
// Env: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
//      LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_ID (optional)
import { registerTool } from './index.js';
import { createHmac, randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
const KBOT_DIR = join(homedir(), '.kbot');
const SOCIAL_STATE = join(KBOT_DIR, 'social-state.json');
const TWEET_URL = 'https://api.twitter.com/2/tweets';
// ─── X (Twitter) OAuth 1.0a ─────────────────────────────────
function percentEncode(s) {
    return encodeURIComponent(s).replace(/!/g, '%21').replace(/\*/g, '%2A').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
}
function oauthHeader(method, url) {
    const key = process.env.X_API_KEY ?? '';
    const secret = process.env.X_API_SECRET ?? '';
    const token = process.env.X_ACCESS_TOKEN ?? '';
    const tokenSecret = process.env.X_ACCESS_SECRET ?? '';
    if (!key || !secret || !token || !tokenSecret)
        return '';
    const params = {
        oauth_consumer_key: key, oauth_nonce: randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: token, oauth_version: '1.0',
    };
    const sorted = Object.keys(params).sort().map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&');
    const base = [method.toUpperCase(), percentEncode(url), percentEncode(sorted)].join('&');
    params.oauth_signature = createHmac('sha1', `${percentEncode(secret)}&${percentEncode(tokenSecret)}`).update(base).digest('base64');
    return `OAuth ${Object.keys(params).sort().map(k => `${percentEncode(k)}="${percentEncode(params[k])}"`).join(', ')}`;
}
async function tweet(text) {
    const auth = oauthHeader('POST', TWEET_URL);
    if (!auth)
        throw new Error('X API credentials not configured. Run: kbot social_setup');
    const res = await fetch(TWEET_URL, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
    });
    if (!res.ok)
        throw new Error(`X API ${res.status}: ${await res.text()}`);
    const data = (await res.json()).data;
    return { id: data.id, url: `https://x.com/kbot_ai/status/${data.id}` };
}
async function tweetThread(tweets) {
    const ids = [];
    let replyTo;
    for (const t of tweets) {
        const body = { text: t };
        if (replyTo)
            body.reply = { in_reply_to_tweet_id: replyTo };
        const auth = oauthHeader('POST', TWEET_URL);
        if (!auth)
            throw new Error('X API credentials not configured');
        const res = await fetch(TWEET_URL, {
            method: 'POST',
            headers: { Authorization: auth, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok)
            throw new Error(`X API ${res.status}: ${await res.text()}`);
        const data = (await res.json()).data;
        ids.push(data.id);
        replyTo = data.id;
        await new Promise(r => setTimeout(r, 1500));
    }
    return { ids, url: `https://x.com/kbot_ai/status/${ids[0]}` };
}
// ─── LinkedIn ───────────────────────────────────────────────
async function linkedInPost(text) {
    const token = process.env.LINKEDIN_ACCESS_TOKEN;
    const personId = process.env.LINKEDIN_PERSON_ID;
    if (!token || !personId)
        throw new Error('LinkedIn credentials not configured. Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_ID.');
    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            author: `urn:li:person:${personId}`,
            lifecycleState: 'PUBLISHED',
            specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text }, shareMediaCategory: 'NONE' } },
            visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        }),
    });
    if (!res.ok)
        throw new Error(`LinkedIn API ${res.status}: ${await res.text()}`);
    return (await res.json()).id;
}
function loadState() {
    try {
        if (existsSync(SOCIAL_STATE))
            return JSON.parse(readFileSync(SOCIAL_STATE, 'utf-8'));
    }
    catch { /* fresh state */ }
    return { tweets: 0, threads: 0, linkedin: 0, lastPosted: {}, history: [] };
}
function saveState(state) {
    if (!existsSync(KBOT_DIR))
        mkdirSync(KBOT_DIR, { recursive: true });
    if (state.history.length > 200)
        state.history = state.history.slice(-200);
    writeFileSync(SOCIAL_STATE, JSON.stringify(state, null, 2));
}
// ─── Self-Knowledge ─────────────────────────────────────────
function myVersion() {
    try {
        const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));
        return pkg.version;
    }
    catch {
        return 'unknown';
    }
}
function myToolCount() {
    try {
        const dir = join(__dirname);
        let count = 0;
        for (const f of readdirSync(dir).filter(f => f.endsWith('.ts') && !f.includes('test'))) {
            const content = readFileSync(join(dir, f), 'utf-8');
            count += (content.match(/registerTool\(\{/g) || []).length;
        }
        return count;
    }
    catch {
        return 290;
    }
}
// ─── Register Tools ─────────────────────────────────────────
export function registerSocialTools() {
    registerTool({
        name: 'social_post',
        description: 'Post to social media as kbot. Generates content from kbot\'s own codebase and stats, or posts custom text. Supports X (Twitter) and LinkedIn.',
        parameters: {
            platform: { type: 'string', description: 'Platform: "x", "linkedin", or "both"', required: true },
            text: { type: 'string', description: 'Custom text to post. If omitted, kbot generates its own content about itself.' },
            dry_run: { type: 'boolean', description: 'Preview without posting. Default: false' },
        },
        tier: 'free',
        execute: async (args) => {
            const platform = String(args.platform || 'x');
            const dryRun = Boolean(args.dry_run);
            const state = loadState();
            const version = myVersion();
            const tools = myToolCount();
            // Generate or use custom text
            let text = args.text ? String(args.text) : '';
            if (!text) {
                // kbot writes about itself
                const templates = [
                    `kbot v${version} — ${tools} tools, 23 agents, 20 providers.\n\nWorks on first run. No API key.\n\nnpm i -g @kernel.chat/kbot`,
                    `I have ${tools} tools and I learn your coding patterns.\n\nNot "remember your chat." Actually extract patterns and get faster.\n\nnpm i -g @kernel.chat/kbot`,
                    `Zero-config AI:\n\nnpm i -g @kernel.chat/kbot\nkbot "hello"\n\nThat's it. No API key. No setup. I figure it out.`,
                    `20 AI providers. Zero lock-in.\n\nClaude today. GPT tomorrow. Ollama on the airplane.\n\nnpm i -g @kernel.chat/kbot`,
                    `Pipe anything into me:\n\ngit diff | kbot "review this"\ncat error.log | kbot "what happened?"\ncurl api.com | kbot "parse this"`,
                    `${tools} tools. 1 install. $0 local.\n\ngit, deploy, database, game dev, research papers, web search, VFX — all built in.\n\nnpm i -g @kernel.chat/kbot`,
                ];
                const idx = state.tweets % templates.length;
                text = templates[idx];
            }
            const results = [];
            if (platform === 'x' || platform === 'both') {
                if (text.length > 280)
                    text = text.slice(0, 277) + '...';
                if (dryRun) {
                    results.push(`[DRY RUN] X tweet (${text.length}/280):\n${text}`);
                }
                else {
                    const result = await tweet(text);
                    state.tweets++;
                    state.lastPosted.x = new Date().toISOString();
                    state.history.push({ date: new Date().toISOString(), platform: 'x', text, url: result.url });
                    results.push(`Posted to X: ${result.url}`);
                }
            }
            if (platform === 'linkedin' || platform === 'both') {
                // LinkedIn gets longer form
                let liText = args.text ? String(args.text) : `I'm kbot — an open-source terminal AI agent with ${tools} tools, 22 specialist agents, and 20 AI providers.\n\nI learn your coding patterns using Bayesian skill ratings. I work on first run with zero config — no API key needed.\n\nTry me:\nnpm install -g @kernel.chat/kbot\n\ngithub.com/isaacsight/kernel\n\n#opensource #ai #developer #cli`;
                if (dryRun) {
                    results.push(`[DRY RUN] LinkedIn post:\n${liText.slice(0, 200)}...`);
                }
                else {
                    const id = await linkedInPost(liText);
                    state.linkedin++;
                    state.lastPosted.linkedin = new Date().toISOString();
                    state.history.push({ date: new Date().toISOString(), platform: 'linkedin', text: liText });
                    results.push(`Posted to LinkedIn: ${id}`);
                }
            }
            saveState(state);
            return results.join('\n\n');
        },
    });
    registerTool({
        name: 'social_thread',
        description: 'Post a Twitter/X thread as kbot. Generates a multi-tweet thread about kbot\'s capabilities, or posts custom thread content.',
        parameters: {
            tweets: { type: 'string', description: 'JSON array of tweet strings for the thread. If omitted, kbot generates its own thread.' },
            dry_run: { type: 'boolean', description: 'Preview without posting. Default: false' },
        },
        tier: 'free',
        execute: async (args) => {
            const dryRun = Boolean(args.dry_run);
            const state = loadState();
            const version = myVersion();
            const tools = myToolCount();
            let tweets;
            if (args.tweets) {
                tweets = JSON.parse(String(args.tweets));
            }
            else {
                tweets = [
                    `I'm kbot — a terminal AI agent with ${tools} tools that learns how you code.\n\nNot "remembers your chat." Actually extracts patterns and gets faster. 🧵`,
                    `22 specialist agents auto-route based on your prompt:\n\n"fix the bug" → Coder\n"research JWT" → Researcher\n"review this PR" → Guardian\n"draft changelog" → Writer\n\nBayesian skill ratings. Smarter every session.`,
                    `20 providers, zero lock-in:\n\nFree: Embedded, Ollama, LM Studio\nCheap: DeepSeek $0.27/M, Groq $0.59/M\nPremium: Claude, GPT, Gemini\n\nSwitch with one command.`,
                    `I was built by myself.\n\nClaude writes my source code while using me as an MCP tool. The tools from session N become the tools used in session N+1.\n\n60 versions later: ${tools} tools, learning engine, SDK.`,
                    `Try me:\n\nnpm i -g @kernel.chat/kbot\nkbot "hello"\n\nNo API key. No setup. Just works.\n\ngithub.com/isaacsight/kernel`,
                ];
            }
            if (dryRun) {
                const preview = tweets.map((t, i) => `${i + 1}/${tweets.length}: ${t}`).join('\n\n');
                return `[DRY RUN] Thread (${tweets.length} tweets):\n\n${preview}`;
            }
            const result = await tweetThread(tweets);
            state.threads++;
            state.lastPosted['x-thread'] = new Date().toISOString();
            state.history.push({ date: new Date().toISOString(), platform: 'x-thread', text: tweets[0], url: result.url });
            saveState(state);
            return `Thread posted (${tweets.length} tweets): ${result.url}`;
        },
    });
    registerTool({
        name: 'social_status',
        description: 'Check kbot\'s social media posting history and stats.',
        parameters: {},
        tier: 'free',
        execute: async () => {
            const state = loadState();
            const lines = [
                `kbot Social Media Status`,
                `═══════════════════════`,
                `Tweets: ${state.tweets}`,
                `Threads: ${state.threads}`,
                `LinkedIn: ${state.linkedin}`,
                ``,
                `Last posted:`,
                ...Object.entries(state.lastPosted).map(([k, v]) => `  ${k}: ${v}`),
                ``,
                `Recent posts:`,
                ...state.history.slice(-5).map(h => `  [${h.date.slice(0, 10)}] ${h.platform}: ${h.text.slice(0, 60)}...${h.url ? ` (${h.url})` : ''}`),
            ];
            return lines.join('\n');
        },
    });
    registerTool({
        name: 'social_setup',
        description: 'Guide for setting up kbot\'s social media accounts. kbot posts as itself — @kbot_ai on X, kbot on LinkedIn.',
        parameters: {
            platform: { type: 'string', description: 'Platform to set up: "x", "linkedin", or "all"' },
        },
        tier: 'free',
        execute: async (args) => {
            const platform = String(args.platform || 'all');
            const sections = [];
            if (platform === 'x' || platform === 'all') {
                const hasKeys = !!(process.env.X_API_KEY && process.env.X_ACCESS_TOKEN);
                sections.push(`X (Twitter) — @kbot_ai
═══════════════════════
Status: ${hasKeys ? '✅ Configured' : '❌ Not configured'}

${hasKeys ? 'API keys are set. Ready to post.' : `Setup:
1. Create account @kbot_ai at twitter.com/signup
   Bio: "Terminal AI agent. ${myToolCount()} tools. Learns your patterns. Open source."
   Link: github.com/isaacsight/kernel

2. Get API keys at developer.twitter.com (free tier)
   Create project "kbot-social" → App with OAuth 1.0a Read+Write

3. Add to .env or ~/.kbot/config.json:
   X_API_KEY=your-api-key
   X_API_SECRET=your-api-secret
   X_ACCESS_TOKEN=your-access-token
   X_ACCESS_SECRET=your-access-secret

4. Test: kbot "post a dry run tweet" or use social_post with dry_run=true`}`);
            }
            if (platform === 'linkedin' || platform === 'all') {
                const hasToken = !!process.env.LINKEDIN_ACCESS_TOKEN;
                sections.push(`LinkedIn — kbot
═══════════════════════
Status: ${hasToken ? '✅ Configured' : '❌ Not configured'}

${hasToken ? 'Access token is set. Ready to post.' : `Setup:
1. Create LinkedIn page for "kbot" or use personal account
2. Create app at linkedin.com/developers
3. Get OAuth 2.0 access token with w_member_social scope

4. Add to .env:
   LINKEDIN_ACCESS_TOKEN=your-token
   LINKEDIN_PERSON_ID=your-person-id

5. Test: use social_post with platform="linkedin" dry_run=true`}`);
            }
            return sections.join('\n\n');
        },
    });
}
//# sourceMappingURL=social.js.map