// kbot Agent Feedback Tool — User feedback integration
import { registerTool } from './index.js';
export function registerAgentFeedbackTools() {
    registerTool({
        name: 'agent_feedback',
        description: 'Ask the user for feedback on the agent\'s recent actions and incorporate it into the planning process.',
        parameters: {
            prompt: { type: 'string', description: 'The prompt to display to the user for feedback.', required: true },
        },
        tier: 'free',
        async execute(args) {
            const prompt = String(args.prompt);
            // Simulate user feedback (replace with actual user interaction)
            const feedback = "This was helpful, but could be more concise.";
            return `User feedback: ${feedback}.  Incorporating into next plan.`;
        },
    });
}
//# sourceMappingURL=agent-feedback.js.map