import { type EvalResult } from './self-eval.js';
export interface ConsultationClient {
    id: string;
    email: string;
    name?: string;
    industry?: string;
    goals?: string;
    challenges?: string;
    context: Record<string, unknown>;
    intake_complete: boolean;
}
export interface ConsultationThread {
    id: string;
    client_id: string;
    subject: string;
    status: 'intake' | 'valuation' | 'awaiting_payment' | 'active' | 'completed' | 'capped';
    reply_count: number;
    max_replies: number;
    agent?: string;
    quality_scores: EvalResult[];
    idea_summary?: string;
    market_value_low?: number;
    market_value_high?: number;
    consultation_fee?: number;
    paid?: boolean;
    summary?: string;
    action_items: Array<{
        task: string;
        owner: string;
    }>;
    completed_at?: string;
}
export interface ConsultationMessage {
    role: 'client' | 'kbot';
    content: string;
    agent?: string;
    eval_score?: EvalResult;
}
export interface ConsultationResult {
    reply: string;
    eval: EvalResult;
    agent: string;
    guardrailBlocked: boolean;
    guardrailMessage?: string;
    threadStatus: 'intake' | 'valuation' | 'awaiting_payment' | 'active' | 'completed' | 'capped';
    summary?: string;
    actionItems?: Array<{
        task: string;
        owner: string;
    }>;
}
interface DomainGuardrailResult {
    blocked: boolean;
    domain?: string;
    message?: string;
    suggestedTopic?: string;
}
/**
 * Check if a message touches restricted domains.
 * Uses keyword/regex detection — fast and free ($0).
 */
export declare function checkDomainGuardrails(message: string): DomainGuardrailResult;
/**
 * Parse intake answers from a client's reply.
 * Looks for numbered responses or paragraph breaks.
 */
export declare function parseIntakeAnswers(message: string): Partial<ConsultationClient>;
/**
 * Generate the intake email for a new client.
 */
export declare function getIntakeMessage(): string;
/**
 * Run the critic gate on a consultation response.
 * Returns the response if it passes, or a clarifying question if it doesn't.
 */
export declare function criticGate(clientMessage: string, proposedResponse: string, threadHistory: string): Promise<{
    passed: boolean;
    response: string;
    eval: EvalResult;
}>;
/**
 * Detect if a client message signals thread closure.
 */
export declare function detectThreadClosure(message: string): boolean;
/**
 * Generate a consultation summary with action items.
 * Uses the analyst agent for structured output.
 */
export declare function generateThreadSummary(messages: ConsultationMessage[], client: ConsultationClient): Promise<{
    summary: string;
    actionItems: Array<{
        task: string;
        owner: string;
    }>;
}>;
/**
 * Process an inbound consultation email through the full pipeline.
 *
 * @param clientEmail - The sender's email address
 * @param clientName - The sender's name (if available)
 * @param subject - Email subject line
 * @param messageBody - Email body text
 * @param db - Database adapter (Supabase client or compatible)
 */
export declare function processConsultationEmail(clientEmail: string, clientName: string | null, subject: string, messageBody: string, db: ConsultationDB): Promise<ConsultationResult>;
export interface ConsultationDB {
    getClientByEmail(email: string): Promise<ConsultationClient | null>;
    createClient(email: string, name: string | null): Promise<ConsultationClient>;
    updateClient(id: string, data: Partial<ConsultationClient>): Promise<void>;
    getActiveThread(clientId: string): Promise<ConsultationThread | null>;
    createThread(clientId: string, subject: string, status: string): Promise<ConsultationThread>;
    updateThread(id: string, data: Partial<ConsultationThread>): Promise<void>;
    addMessage(threadId: string, role: 'client' | 'kbot', content: string, evalScore?: EvalResult, agent?: string): Promise<void>;
    getThreadMessages(threadId: string): Promise<ConsultationMessage[]>;
}
export {};
//# sourceMappingURL=consultation.d.ts.map