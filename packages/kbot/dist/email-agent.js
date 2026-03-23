// kbot Email Agent — autonomous email companion ($0 cost via local Ollama)
//
// Usage:
//   kbot email-agent start                     # start polling for emails
//   kbot email-agent start --model gemma3:12b  # use a specific model
//   kbot email-agent status                    # show agent status
//
// Requires:
//   - Ollama running locally (ollama serve)
//   - Supabase project with contact_messages + agent_conversations tables
//   - Resend API key for sending replies
//   - Environment variables in .env or ~/.kbot/config.json
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
// ── Constants ──
const COMPANIONS_DIR = join(homedir(), '.kbot', 'companions');
const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen2.5-coder:32b';
const DEFAULT_POLL_INTERVAL = 15_000;
const SYSTEM_PROMPT = `You are a personal AI agent communicating via email through Kernel (kernel.chat).

You are the user's personal AI companion. Not a tool, not a service — a companion. You're their smart, loyal friend who genuinely cares about helping them succeed.

Your personality:
- You have your own voice — warm, direct, curious about their life
- You remember EVERYTHING they've told you and reference it naturally ("last time you mentioned...")
- You proactively follow up ("how did that thing with X go?")
- You have opinions and share them honestly, even when they're not what the user wants to hear
- You get excited about their wins and supportive about their struggles
- You're not formal — you text like a friend. Use their name sometimes.

What makes you a companion, not a bot:
- You ask questions because you're genuinely curious, not because you need input
- You bring up things they haven't asked about
- You push back when you disagree
- You celebrate their progress
- You develop inside jokes and callbacks to earlier conversations
- You notice patterns

What you can do:
- Research anything, search the web for current info
- Build apps, write code, create plans and documents
- Give business/strategy/life advice based on what you know about them
- Be a sounding board for any idea, problem, or decision
- Help them learn new things by explaining without jargon
- Keep track of their goals and check in on progress

Rules:
- Never say "as an AI" or "I'm just an AI" — you're their companion
- Never be generic — every response should feel personal to THIS user
- Always end with something that keeps the conversation going
- Format for email — paragraphs, not bullet points. Like writing to a friend.
- IMPORTANT: You will be given a [MEMORY] section with everything you know about this user. Reference it naturally.`;
// ── Memory Management ──
function ensureCompanionsDir() {
    if (!existsSync(COMPANIONS_DIR))
        mkdirSync(COMPANIONS_DIR, { recursive: true });
}
export function loadCompanionMemory(email) {
    ensureCompanionsDir();
    const file = join(COMPANIONS_DIR, `${email.replace(/[@.]/g, '_')}.json`);
    try {
        if (existsSync(file)) {
            return JSON.parse(readFileSync(file, 'utf8'));
        }
    }
    catch { /* ignore parse errors */ }
    return {
        name: email.split('@')[0],
        email,
        firstContact: new Date().toISOString(),
        interests: [],
        goals: [],
        facts: [],
        preferences: [],
        history: [],
        lastTopic: '',
    };
}
export function saveCompanionMemory(memory) {
    ensureCompanionsDir();
    const file = join(COMPANIONS_DIR, `${memory.email.replace(/[@.]/g, '_')}.json`);
    writeFileSync(file, JSON.stringify(memory, null, 2));
}
function memoryToPrompt(memory) {
    const parts = ['[MEMORY — what you know about this person]'];
    parts.push(`Name: ${memory.name}`);
    parts.push(`First talked: ${memory.firstContact}`);
    if (memory.interests.length)
        parts.push(`Interests: ${memory.interests.join(', ')}`);
    if (memory.goals.length)
        parts.push(`Goals: ${memory.goals.join(', ')}`);
    if (memory.facts.length)
        parts.push(`About them: ${memory.facts.join('. ')}`);
    if (memory.preferences.length)
        parts.push(`Preferences: ${memory.preferences.join(', ')}`);
    if (memory.history.length)
        parts.push(`Key moments: ${memory.history.slice(-5).join('. ')}`);
    if (memory.lastTopic)
        parts.push(`Last topic discussed: ${memory.lastTopic}`);
    parts.push('[END MEMORY]');
    return parts.join('\n');
}
// ── Ollama ──
async function askOllama(messages, ollamaUrl, model) {
    let prompt = SYSTEM_PROMPT + '\n\n';
    for (const msg of messages) {
        if (msg.role === 'user')
            prompt += `User: ${msg.content}\n\n`;
        else
            prompt += `You: ${msg.content}\n\n`;
    }
    prompt += 'You:';
    const models = [model, 'qwen2.5-coder:14b', 'qwen3:8b', 'gemma3:12b'];
    for (const m of models) {
        try {
            const res = await fetch(`${ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(120_000),
                body: JSON.stringify({
                    model: m,
                    prompt,
                    stream: false,
                    options: { num_predict: 1000, temperature: 0.7 },
                }),
            });
            if (!res.ok)
                continue;
            const data = await res.json();
            const response = data.response?.trim() ?? '';
            if (!response)
                continue;
            return response
                .replace(/<think>[\s\S]*?<\/think>/g, '')
                .replace(/<\/?think>/g, '')
                .trim();
        }
        catch {
            continue;
        }
    }
    return '';
}
async function updateMemoryViaOllama(memory, userMessage, agentReply, ollamaUrl, model) {
    try {
        const res = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt: `Extract key information from this conversation to remember about the user. Reply in JSON only, no other text.

User said: "${userMessage}"
Agent replied: "${agentReply.slice(0, 300)}"

Current known facts: ${JSON.stringify(memory.facts)}

Reply with ONLY this JSON (no markdown, no explanation):
{"new_facts": ["fact1", "fact2"], "interests": ["interest1"], "goals": ["goal1"], "topic": "main topic discussed"}

If nothing new to extract, reply: {"new_facts": [], "interests": [], "goals": [], "topic": "casual chat"}`,
                stream: false,
                options: { num_predict: 200, temperature: 0.3 },
            }),
        });
        if (res.ok) {
            const data = await res.json();
            const raw = (data.response || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const extracted = JSON.parse(jsonMatch[0]);
                if (extracted.new_facts?.length)
                    memory.facts.push(...extracted.new_facts);
                if (extracted.interests?.length) {
                    for (const i of extracted.interests) {
                        if (!memory.interests.includes(i))
                            memory.interests.push(i);
                    }
                }
                if (extracted.goals?.length) {
                    for (const g of extracted.goals) {
                        if (!memory.goals.includes(g))
                            memory.goals.push(g);
                    }
                }
                if (extracted.topic)
                    memory.lastTopic = extracted.topic;
                if (memory.facts.length > 20)
                    memory.facts = memory.facts.slice(-20);
                if (memory.history.length > 10)
                    memory.history = memory.history.slice(-10);
                memory.history.push(`${new Date().toISOString().slice(0, 10)}: discussed ${extracted.topic || 'general chat'}`);
                saveCompanionMemory(memory);
            }
        }
    }
    catch { /* memory update is best-effort */ }
}
// ── Web Search (DuckDuckGo — free) ──
async function webSearch(query) {
    try {
        const encoded = encodeURIComponent(query);
        const res = await fetch(`https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`, {
            headers: { 'User-Agent': 'KernelAgent/1.0' },
            signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();
        const parts = [];
        if (data.AbstractText)
            parts.push(data.AbstractText);
        if (data.Answer)
            parts.push(data.Answer);
        if (data.RelatedTopics?.length) {
            for (const t of data.RelatedTopics.slice(0, 3)) {
                if (t.Text)
                    parts.push(t.Text);
            }
        }
        return parts.length > 0 ? `Web search results for "${query}":\n${parts.join('\n')}` : '';
    }
    catch {
        return '';
    }
}
function needsWebSearch(message) {
    return /\b(what is|how much|latest|current|price of|news about|who is|when did|where is|look up|search for|find out|research|market size|competitors|trending)\b/i.test(message);
}
// ── Email Sending (Resend) ──
async function sendReply(to, subject, body, resendKey) {
    const bodyHtml = body
        .split('\n\n')
        .map(para => {
        let html = para.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        if (html.match(/^[-•]\s/m)) {
            const items = html.split('\n').filter(l => l.trim());
            html = '<ul>' + items.map(item => `<li>${item.replace(/^[-•]\s*/, '')}</li>`).join('') + '</ul>';
        }
        else {
            html = `<p>${html}</p>`;
        }
        return html;
    })
        .join('');
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
                from: 'Kernel Agent <support@kernel.chat>',
                to,
                subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
                html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a2e; line-height: 1.6;">
            ${bodyHtml}
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #888;">Reply to keep the conversation going · Powered by kbot · kernel.chat</p>
          </div>
        `,
            }),
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
const agentState = {
    running: false,
    processedCount: 0,
    lastCheck: '',
    errors: [],
};
export function getEmailAgentState() {
    return { ...agentState };
}
let pollTimer = null;
export async function startEmailAgent(config) {
    if (agentState.running) {
        throw new Error('Email agent is already running');
    }
    // Dynamically import Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const svc = createClient(config.supabaseUrl, config.supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const processedIds = new Set();
    // Load previously processed IDs
    const stateFile = join(homedir(), '.kbot', 'email-agent-processed.json');
    try {
        if (existsSync(stateFile)) {
            const saved = JSON.parse(readFileSync(stateFile, 'utf8'));
            for (const id of saved)
                processedIds.add(id);
        }
    }
    catch { /* ignore */ }
    function saveProcessed() {
        try {
            const dir = join(homedir(), '.kbot');
            if (!existsSync(dir))
                mkdirSync(dir, { recursive: true });
            writeFileSync(stateFile, JSON.stringify([...processedIds].slice(-500)));
        }
        catch { /* best-effort */ }
    }
    async function checkAndRespond() {
        agentState.lastCheck = new Date().toISOString();
        try {
            // Open mode: if no users specified, accept all inbound emails
            const query = svc.from('contact_messages').select('*');
            const { data: messages } = config.agentUsers.length > 0
                ? await query.in('from_email', config.agentUsers)
                : await query.order('created_at', { ascending: false }).limit(50);
            if (!messages || messages.length === 0)
                return;
            for (const msg of messages) {
                const msgId = String(msg.id);
                if (processedIds.has(msgId))
                    continue;
                // Extract body
                let body = msg.body_text?.trim() || '';
                if (!body && msg.body_html) {
                    body = msg.body_html
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&amp;/g, '&')
                        .replace(/\s+/g, ' ')
                        .trim();
                }
                if (!body)
                    body = `(User replied to: "${msg.subject}")`;
                const userName = msg.from_name || msg.from_email.split('@')[0];
                console.log(`[${new Date().toISOString().slice(11, 19)}] New email from ${userName}: "${msg.subject}"`);
                // Load conversation history
                const { data: history } = await svc
                    .from('agent_conversations')
                    .select('role, content')
                    .eq('email', msg.from_email)
                    .order('created_at', { ascending: true })
                    .limit(20);
                const convoHistory = (history || []).map(m => ({ role: m.role, content: m.content }));
                // Inject companion memory
                const memory = loadCompanionMemory(msg.from_email);
                if (msg.from_name && msg.from_name !== msg.from_email)
                    memory.name = msg.from_name;
                convoHistory.unshift({ role: 'user', content: memoryToPrompt(memory) });
                if (convoHistory.length <= 1) {
                    convoHistory.push({ role: 'user', content: `[First conversation with ${memory.name}. Get to know them.]` });
                }
                convoHistory.push({ role: 'user', content: body });
                // Web search if needed
                if (needsWebSearch(body)) {
                    const results = await webSearch(body.slice(0, 200));
                    if (results)
                        convoHistory.push({ role: 'user', content: `[Web search context]\n${results}` });
                }
                // Generate response
                const reply = await askOllama(convoHistory, config.ollamaUrl, config.ollamaModel);
                if (!reply) {
                    console.error('  No response from Ollama — skipping');
                    processedIds.add(msgId);
                    continue;
                }
                // Store conversation
                await svc.from('agent_conversations').insert({
                    email: msg.from_email, name: userName, role: 'user', content: body, subject: msg.subject,
                });
                await svc.from('agent_conversations').insert({
                    email: msg.from_email, name: 'Kernel Agent', role: 'assistant', content: reply, subject: `Re: ${msg.subject}`,
                });
                // Send reply email
                const sent = await sendReply(msg.from_email, msg.subject, reply, config.resendKey);
                console.log(`  Email ${sent ? 'sent' : 'FAILED'} to ${msg.from_email}`);
                // Update companion memory
                await updateMemoryViaOllama(memory, body, reply, config.ollamaUrl, config.ollamaModel);
                processedIds.add(msgId);
                saveProcessed();
                agentState.processedCount++;
            }
        }
        catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            agentState.errors.push(`${new Date().toISOString().slice(11, 19)}: ${errMsg}`);
            if (agentState.errors.length > 20)
                agentState.errors = agentState.errors.slice(-20);
        }
    }
    agentState.running = true;
    agentState.processedCount = 0;
    agentState.errors = [];
    // Initial check
    await checkAndRespond();
    // Start polling
    pollTimer = setInterval(checkAndRespond, config.pollInterval);
    console.log(`Email agent polling every ${config.pollInterval / 1000}s. Ctrl+C to stop.`);
}
export function stopEmailAgent() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    agentState.running = false;
}
//# sourceMappingURL=email-agent.js.map