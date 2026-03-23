// Tests for kbot Consultation Engine
import { describe, it, expect } from 'vitest';
import { checkDomainGuardrails, getIntakeMessage, parseIntakeAnswers, detectThreadClosure } from './consultation.js';
describe('Domain Guardrails', () => {
    it('blocks legal advice requests', () => {
        const result = checkDomainGuardrails('Can you give me legal advice about my lawsuit?');
        expect(result.blocked).toBe(true);
        expect(result.domain).toBe('legal');
        expect(result.message).toBeTruthy();
        expect(result.suggestedTopic).toBeTruthy();
    });
    it('blocks medical advice requests', () => {
        const result = checkDomainGuardrails('What medication should I take for my symptoms?');
        expect(result.blocked).toBe(true);
        expect(result.domain).toBe('medical');
    });
    it('blocks financial investment advice', () => {
        const result = checkDomainGuardrails('Should I invest in this stock?');
        expect(result.blocked).toBe(true);
        expect(result.domain).toBe('financial');
    });
    it('blocks tax advice', () => {
        const result = checkDomainGuardrails('How should I file my tax return?');
        expect(result.blocked).toBe(true);
        expect(result.domain).toBe('tax');
    });
    it('allows business strategy questions', () => {
        const result = checkDomainGuardrails('How should I price my SaaS product?');
        expect(result.blocked).toBe(false);
    });
    it('allows technical questions', () => {
        const result = checkDomainGuardrails('How do I set up a CI/CD pipeline?');
        expect(result.blocked).toBe(false);
    });
    it('allows general business questions', () => {
        const result = checkDomainGuardrails('What marketing channels should I use for my startup?');
        expect(result.blocked).toBe(false);
    });
});
describe('Intake System', () => {
    it('generates intake questions', () => {
        const msg = getIntakeMessage();
        expect(msg).toContain('industry');
        expect(msg).toContain('challenge');
        expect(msg.length).toBeGreaterThan(100);
    });
    it('parses numbered intake answers', () => {
        const answers = parseIntakeAnswers(`
1. SaaS
2. We build project management tools
3. Customer churn is our biggest problem
4. Reduce churn by 20% in 6 months
5. Help with retention strategy
    `);
        expect(answers.industry).toBe('SaaS');
        expect(answers.goals).toBeTruthy();
        expect(answers.challenges).toBeTruthy();
    });
    it('parses paragraph-format answers', () => {
        const answers = parseIntakeAnswers('I run a fintech startup that helps small businesses with payments.');
        expect(answers.industry).toBe('fintech');
        expect(answers.context).toBeTruthy();
    });
    it('handles empty input gracefully', () => {
        const answers = parseIntakeAnswers('');
        expect(answers).toBeTruthy();
    });
});
describe('Thread Closure Detection', () => {
    it('detects thank you as closure', () => {
        expect(detectThreadClosure('Thanks!')).toBe(true);
        expect(detectThreadClosure('Thank you so much')).toBe(true);
    });
    it('detects goodbye as closure', () => {
        expect(detectThreadClosure('Goodbye!')).toBe(true);
        expect(detectThreadClosure('Take care')).toBe(true);
    });
    it('does not detect long messages as closure', () => {
        const longMsg = 'Thanks for the information. I have a follow-up question about the implementation timeline. Can you provide more details about the phased approach you mentioned? I want to make sure we have enough resources allocated for each phase and understand the dependencies between them.';
        expect(detectThreadClosure(longMsg)).toBe(false);
    });
    it('does not detect questions as closure', () => {
        expect(detectThreadClosure('What should I do next?')).toBe(false);
    });
});
//# sourceMappingURL=consultation.test.js.map