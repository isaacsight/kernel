// kbot Consultation Engine — autonomous email consultation pipeline
//
// Flow: inbound email → guardrail check → client lookup → agent routing
//       → generate response → critic gate → send reply
//
// Features:
//   1. Client profile system (intake on first contact)
//   2. Critic gate (self-eval before sending)
//   3. Domain guardrails (refuse legal/medical/financial/tax)
//   4. Thread summary + action items on close
import { evaluateResponse } from './self-eval.js';
import { runAgent } from './agent.js';
const RESTRICTED_DOMAINS = [
    {
        domain: 'legal',
        patterns: [
            /\b(legal advice|lawyer|attorney|lawsuit|sue|litigation|court|plaintiff|defendant|statute|liability|tort|contract law|intellectual property law|patent law|trademark law|copyright law|legal obligation|legal rights|legal counsel)\b/i,
            /\b(should i sue|can i be sued|is this legal|legally binding|terms of service review|NDA review|employment law|labor law)\b/i,
        ],
        professional: 'lawyer or legal counsel',
        suggestion: 'business strategy, contract negotiation approach, or risk assessment from a business perspective',
    },
    {
        domain: 'medical',
        patterns: [
            /\b(medical advice|diagnosis|treatment|prescription|medication|symptoms|disease|illness|health condition|clinical|therapy|dosage|side effects|medical condition)\b/i,
            /\b(should i take|what medication|am i sick|health risk|medical opinion)\b/i,
        ],
        professional: 'qualified healthcare provider',
        suggestion: 'health tech strategy, wellness program design, or healthcare business operations',
    },
    {
        domain: 'financial',
        patterns: [
            /\b(investment advice|stock picks|buy or sell|portfolio allocation|financial planning|retirement planning|tax-loss harvesting|securities|hedge fund|mutual fund|cryptocurrency investment|forex trading)\b/i,
            /\b(should i invest|which stocks|financial advisor|fiduciary|wealth management|estate planning)\b/i,
        ],
        professional: 'licensed financial advisor',
        suggestion: 'business financial strategy, revenue modeling, pricing strategy, or fundraising approach',
    },
    {
        domain: 'tax',
        patterns: [
            /\b(tax advice|tax filing|tax deduction|tax return|tax liability|tax shelter|tax evasion|tax avoidance|IRS|tax audit|tax code|capital gains tax|estate tax|income tax filing)\b/i,
            /\b(how to file taxes|tax write-off|can i deduct|tax bracket|tax-exempt)\b/i,
        ],
        professional: 'certified accountant or tax professional',
        suggestion: 'business expense planning, financial modeling, or revenue optimization',
    },
];
/**
 * Check if a message touches restricted domains.
 * Uses keyword/regex detection — fast and free ($0).
 */
export function checkDomainGuardrails(message) {
    for (const domain of RESTRICTED_DOMAINS) {
        for (const pattern of domain.patterns) {
            if (pattern.test(message)) {
                return {
                    blocked: true,
                    domain: domain.domain,
                    message: `This touches on ${domain.domain} territory. I'd recommend consulting a ${domain.professional} for this specific question. I can definitely help with ${domain.suggestion} instead — would you like to explore that?`,
                    suggestedTopic: domain.suggestion,
                };
            }
        }
    }
    return { blocked: false };
}
// ── Intake System ──
const INTAKE_QUESTIONS = `Thank you for reaching out to Kernel Consultation.

Before I can give you the best possible advice, I'd love to learn a bit about your business. Could you answer these quick questions?

1. **What industry are you in?** (e.g., SaaS, e-commerce, healthcare, fintech, agency)
2. **What does your business do?** (one sentence is fine)
3. **What's your biggest challenge right now?**
4. **What are you hoping to achieve in the next 3-6 months?**
5. **Is there anything specific you'd like help with today?**

Just reply to this email with your answers and we'll get started right away.`;
/**
 * Parse intake answers from a client's reply.
 * Looks for numbered responses or paragraph breaks.
 */
export function parseIntakeAnswers(message) {
    const lines = message.split('\n').filter(l => l.trim());
    const answers = { context: {} };
    // Try numbered format first (1. answer, 2. answer, etc.)
    const numbered = lines.filter(l => /^\s*\d+[\.\)]\s*/.test(l));
    if (numbered.length >= 3) {
        const clean = numbered.map(l => l.replace(/^\s*\d+[\.\)]\s*/, '').trim());
        answers.industry = clean[0] || undefined;
        answers.goals = clean[1] || undefined;
        answers.challenges = clean[2] || undefined;
        if (clean[3])
            answers.context.timeline = clean[3];
        if (clean[4])
            answers.context.specific_request = clean[4];
    }
    else {
        // Paragraph format — use the whole message as context
        answers.context = { raw_intake: message };
        // Try to extract industry from keywords
        const industryMatch = message.match(/\b(SaaS|e-commerce|ecommerce|healthcare|fintech|agency|consulting|retail|manufacturing|education|real estate|media|tech|startup)\b/i);
        if (industryMatch)
            answers.industry = industryMatch[1];
    }
    return answers;
}
/**
 * Generate the intake email for a new client.
 */
export function getIntakeMessage() {
    return INTAKE_QUESTIONS;
}
// ── Critic Gate ──
/** Consultation-specific thresholds (stricter than default) */
const CONSULTATION_THRESHOLDS = {
    faithfulness: 0.6,
    relevancy: 0.7,
    overall: 0.5,
};
const CLARIFYING_QUESTION_PROMPT = `The client asked a question but I'm not confident enough in my answer to send it. Instead of guessing, generate a thoughtful clarifying question that will help me give a better answer. Be specific about what additional information would help.`;
/**
 * Run the critic gate on a consultation response.
 * Returns the response if it passes, or a clarifying question if it doesn't.
 */
export async function criticGate(clientMessage, proposedResponse, threadHistory) {
    const evalResult = await evaluateResponse(clientMessage, proposedResponse, threadHistory);
    const passes = evalResult.faithfulness >= CONSULTATION_THRESHOLDS.faithfulness &&
        evalResult.relevancy >= CONSULTATION_THRESHOLDS.relevancy &&
        evalResult.overall >= CONSULTATION_THRESHOLDS.overall;
    if (passes) {
        return { passed: true, response: proposedResponse, eval: evalResult };
    }
    // Generate a clarifying question instead
    try {
        const clarifyResult = await runAgent(`${CLARIFYING_QUESTION_PROMPT}\n\nClient's message: "${clientMessage}"\n\nThread context: ${threadHistory.slice(0, 500)}`, { agent: 'communicator', skipPlanner: true });
        return {
            passed: false,
            response: clarifyResult.content,
            eval: evalResult,
        };
    }
    catch {
        // Fallback clarifying question
        return {
            passed: false,
            response: `Thank you for your question. To make sure I give you the most relevant advice, could you provide a bit more context? Specifically, what outcome are you hoping to achieve, and what have you already tried?`,
            eval: evalResult,
        };
    }
}
// ── Thread Closure Detection ──
const CLOSURE_PATTERNS = [
    /\b(thanks?|thank you|thx|cheers|appreciate it|that's all|that's everything|perfect|great|awesome|wonderful)\b/i,
    /\b(goodbye|bye|talk later|have a good|take care|signing off|all set|no more questions)\b/i,
];
/**
 * Detect if a client message signals thread closure.
 */
export function detectThreadClosure(message) {
    // Short messages with closure words are strong signals
    if (message.length < 100) {
        return CLOSURE_PATTERNS.some(p => p.test(message));
    }
    return false;
}
// ── Thread Summary Generation ──
/**
 * Generate a consultation summary with action items.
 * Uses the analyst agent for structured output.
 */
export async function generateThreadSummary(messages, client) {
    const transcript = messages
        .map(m => `${m.role === 'client' ? 'Client' : 'Consultant'}: ${m.content}`)
        .join('\n\n');
    const prompt = `Analyze this consultation thread and produce a structured summary.

Client: ${client.name || client.email}
Industry: ${client.industry || 'Not specified'}
Goals: ${client.goals || 'Not specified'}

--- Transcript ---
${transcript.slice(0, 4000)}
--- End Transcript ---

Produce your response in this EXACT format:

## Key Points Discussed
- [point 1]
- [point 2]
- [point 3]

## Recommendations
- [recommendation 1]
- [recommendation 2]

## Action Items
- [ ] [task description] — Owner: [Client/Consultant]
- [ ] [task description] — Owner: [Client/Consultant]

## Next Steps
[1-2 sentences on suggested follow-up]`;
    try {
        const result = await runAgent(prompt, { agent: 'analyst', skipPlanner: true });
        const content = result.content;
        // Extract action items from the structured output
        const actionItems = [];
        const actionRegex = /- \[ ?\] (.+?) — Owner: (.+)/g;
        let match;
        while ((match = actionRegex.exec(content)) !== null) {
            actionItems.push({ task: match[1].trim(), owner: match[2].trim() });
        }
        return { summary: content, actionItems };
    }
    catch {
        return {
            summary: `Consultation with ${client.name || client.email} — ${messages.length} messages exchanged.`,
            actionItems: [],
        };
    }
}
// ── Main Pipeline ──
/**
 * Process an inbound consultation email through the full pipeline.
 *
 * @param clientEmail - The sender's email address
 * @param clientName - The sender's name (if available)
 * @param subject - Email subject line
 * @param messageBody - Email body text
 * @param db - Database adapter (Supabase client or compatible)
 */
export async function processConsultationEmail(clientEmail, clientName, subject, messageBody, db) {
    // 1. Domain guardrail check (before any processing)
    const guardrail = checkDomainGuardrails(messageBody);
    if (guardrail.blocked) {
        return {
            reply: guardrail.message,
            eval: { faithfulness: 1, relevancy: 1, overall: 1, shouldRetry: false },
            agent: 'guardrail',
            guardrailBlocked: true,
            guardrailMessage: guardrail.message,
            threadStatus: 'active',
        };
    }
    // 2. Client lookup / creation
    let client = await db.getClientByEmail(clientEmail);
    if (!client) {
        client = await db.createClient(clientEmail, clientName);
    }
    // 3. If intake not complete, handle intake flow
    if (!client.intake_complete) {
        // Check if this is the first message (send intake questions)
        // or the reply to intake (parse answers)
        const existingThread = await db.getActiveThread(client.id);
        if (!existingThread || existingThread.status === 'intake') {
            if (!existingThread) {
                // First contact — create intake thread and send questions
                const thread = await db.createThread(client.id, subject, 'intake');
                await db.addMessage(thread.id, 'client', messageBody);
                const intakeMsg = getIntakeMessage();
                await db.addMessage(thread.id, 'kbot', intakeMsg);
                return {
                    reply: intakeMsg,
                    eval: { faithfulness: 1, relevancy: 1, overall: 1, shouldRetry: false },
                    agent: 'intake',
                    guardrailBlocked: false,
                    threadStatus: 'intake',
                };
            }
            else {
                // Reply to intake — parse answers and activate
                await db.addMessage(existingThread.id, 'client', messageBody);
                const answers = parseIntakeAnswers(messageBody);
                await db.updateClient(client.id, { ...answers, intake_complete: true });
                await db.updateThread(existingThread.id, { status: 'active' });
                // Now process their original question + context
                client = { ...client, ...answers, intake_complete: true };
            }
        }
    }
    // 4. Get or create active thread
    let thread = await db.getActiveThread(client.id);
    if (!thread) {
        thread = await db.createThread(client.id, subject, 'active');
    }
    // 5. Check reply cap
    if (thread.reply_count >= thread.max_replies) {
        // Generate summary and close
        const messages = await db.getThreadMessages(thread.id);
        const { summary, actionItems } = await generateThreadSummary(messages, client);
        await db.updateThread(thread.id, {
            status: 'capped',
            summary,
            action_items: actionItems,
            completed_at: new Date().toISOString(),
        });
        const capMessage = `We've reached the end of this consultation thread (${thread.max_replies} exchanges). Here's a summary of what we covered:\n\n${summary}\n\nTo continue our work together, simply send a new email to start a fresh thread. Thank you for choosing Kernel Consultation.`;
        return {
            reply: capMessage,
            eval: { faithfulness: 1, relevancy: 1, overall: 1, shouldRetry: false },
            agent: 'summary',
            guardrailBlocked: false,
            threadStatus: 'capped',
            summary,
            actionItems,
        };
    }
    // 6. Record client message
    await db.addMessage(thread.id, 'client', messageBody);
    // 7. Build context for the agent
    const threadMessages = await db.getThreadMessages(thread.id);
    const threadHistory = threadMessages
        .slice(-10) // last 10 messages for context
        .map(m => `${m.role === 'client' ? 'Client' : 'Consultant'}: ${m.content}`)
        .join('\n\n');
    const clientContext = [
        client.industry ? `Industry: ${client.industry}` : '',
        client.goals ? `Goals: ${client.goals}` : '',
        client.challenges ? `Challenges: ${client.challenges}` : '',
    ].filter(Boolean).join('\n');
    const systemContext = `You are a professional business consultant responding via email. Be concise, actionable, and specific to the client's business.

Client Profile:
${clientContext || 'No profile data yet.'}

Thread History:
${threadHistory}

Respond to the client's latest message. Be professional but warm. Give specific, actionable advice. Do NOT give legal, medical, financial investment, or tax advice.`;
    // 8. Route to specialist agent and generate response
    let agentResponse;
    try {
        agentResponse = await runAgent(`${systemContext}\n\nClient's message: ${messageBody}`, { skipPlanner: true });
    }
    catch (err) {
        return {
            reply: `Thank you for your message. I'm experiencing a temporary issue processing your request. I'll get back to you shortly. If this is urgent, please send a follow-up email.`,
            eval: { faithfulness: 0, relevancy: 0, overall: 0, shouldRetry: false },
            agent: 'error',
            guardrailBlocked: false,
            threadStatus: 'active',
        };
    }
    // 9. Critic gate — evaluate quality before sending
    const criticResult = await criticGate(messageBody, agentResponse.content, threadHistory);
    // 10. Check for thread closure
    const isClosing = detectThreadClosure(messageBody);
    let finalReply = criticResult.response;
    let threadStatus = 'active';
    let summary;
    let actionItems;
    if (isClosing) {
        // Generate summary
        const messages = await db.getThreadMessages(thread.id);
        const summaryResult = await generateThreadSummary(messages, client);
        summary = summaryResult.summary;
        actionItems = summaryResult.actionItems;
        threadStatus = 'completed';
        finalReply += `\n\n---\n\n**Consultation Summary**\n\n${summary}\n\nThank you for choosing Kernel Consultation. Feel free to reach out anytime you need help.`;
        await db.updateThread(thread.id, {
            status: 'completed',
            summary,
            action_items: actionItems,
            completed_at: new Date().toISOString(),
        });
    }
    // 11. Record kbot's response
    await db.addMessage(thread.id, 'kbot', finalReply, criticResult.eval, agentResponse.agent);
    // 12. Update thread
    await db.updateThread(thread.id, {
        reply_count: thread.reply_count + 1,
        agent: agentResponse.agent,
        quality_scores: [...(thread.quality_scores || []), criticResult.eval],
    });
    return {
        reply: finalReply,
        eval: criticResult.eval,
        agent: agentResponse.agent,
        guardrailBlocked: false,
        threadStatus,
        summary,
        actionItems,
    };
}
//# sourceMappingURL=consultation.js.map