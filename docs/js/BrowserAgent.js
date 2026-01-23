/**
 * BrowserAgent.js
 * Core logic for the "Agent over Page" experience.
 * Handles DOM context sniffing, intent planning, and tool execution.
 */

class BrowserAgent {
    constructor() {
        this.capabilities = ['read_dom', 'summarize', 'navigate', 'workflow'];
        this.trajectory = [];
    }

    /**
     * Scrapes the current page for relevant context.
     */
    getContext() {
        const context = {
            title: document.title,
            url: window.location.href,
            h1: document.querySelector('h1')?.innerText || '',
            description: document.querySelector('meta[name="description"]')?.content || '',
            snippet: document.body.innerText.substring(0, 1000) // First 1000 chars
        };
        return context;
    }

    /**
     * Translates user intent into a sequence of steps.
     * Simple implementation for local logic.
     */
    plan(input) {
        const lower = input.toLowerCase();
        let plan = [];

        if (lower.includes('summarize') || lower.includes('what is this')) {
            plan.push({ action: 'read_dom', params: {} });
            plan.push({ action: 'summarize', params: { target: 'current_page' } });
        } else if (lower.includes('related') || lower.includes('find')) {
            plan.push({ action: 'identify_keywords', params: {} });
            plan.push({ action: 'search_site', params: {} });
        } else if (lower.includes('audit')) {
            plan.push({ action: 'read_dom', params: { detail: 'high' } });
            plan.push({ action: 'audit_ux', params: {} });
        }

        return plan;
    }

    /**
     * Executes the plan and reports results.
     */
    async execute(plan, onStep) {
        let results = [];
        for (const step of plan) {
            if (onStep) onStep(step);

            // Log trajectory
            this.trajectory.push({ ...step, timestamp: new Date() });

            // Simulated execution for now
            const result = await this.simulateStep(step);
            results.push(result);
        }
        return this.report(results);
    }

    async simulateStep(step) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({ step: step.action, status: 'success', data: {} });
            }, 600);
        });
    }

    report(results) {
        return {
            summary: "Task completed successfully.",
            steps: results,
            followUps: [
                { label: "Summarize more", cmd: "deep summary" },
                { label: "Check related tabs", cmd: "related tabs" },
                { label: "Log this", cmd: "log action" }
            ]
        };
    }
}

window.browserAgent = new BrowserAgent();
