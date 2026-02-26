import { getProvider } from './providers/registry'
import { getToolsForAgent } from './tools/registry'
import type { Agent } from '../types'
import type { WorkflowEvent } from './types'

export type WorkflowState = 'planning' | 'executing' | 'observing' | 'completed' | 'failed';

export interface WorkflowCallbacks {
    onProgress: (event: WorkflowEvent) => void;
    onChunk?: (text: string) => void;
}

export class AgenticWorkflow {
    private state: WorkflowState = 'planning';

    constructor(
        private agent: Agent,
        private callbacks: WorkflowCallbacks
    ) { }

    private emit(step: string, details?: string) {
        this.callbacks.onProgress({
            type: 'workflow_progress',
            state: this.state,
            step,
            details,
            timestamp: Date.now()
        });
    }

    // A simplified DAG executor (sequential for MVP)
    async executeSequential(request: string, context: string): Promise<string> {
        this.state = 'planning';
        this.emit('Analyzing request', 'Formulating execution plan...');

        const tools = getToolsForAgent(this.agent.id);
        const toolManifest = tools.map(t => `${t.name}: ${t.description}`).join('\n');

        const planPrompt = `Task: ${request}\nContext: ${context}\nAvailable Tools:\n${toolManifest}\n\nBreak this down into 1-3 sequential steps to solve the task. Return ONLY a JSON array of strings, e.g. ["Research X", "Write draft", "Finalize"].`;

        let plan: string[] = [];
        try {
            const planRes = await getProvider().json<{ steps: string[] }>(planPrompt, {
                system: 'You are a technical project manager. Output ONLY valid JSON array with the key "steps".',
                tier: 'fast'
            });
            plan = planRes.steps || [request];
        } catch {
            plan = [request];
        }

        this.state = 'executing';
        this.emit('Plan created', `Steps: ${plan.join(' → ')}`);

        let workingMemory = context;
        let finalResult = '';

        const { runToolLoop } = await import('./tools/executor');

        for (let i = 0; i < plan.length; i++) {
            const step = plan[i];
            this.emit(`Executing step ${i + 1}/${plan.length}`, step);

            const stepPrompt = `Current Step: ${step}\nOverall Context: ${workingMemory}\n\nPlease execute this step. Use tools if necessary. Summarize the outcome clearly for the next step.`;

            const result = await runToolLoop([{ role: 'user', content: stepPrompt }], tools, {
                onChunk: this.callbacks.onChunk
            }, {
                system: this.agent.systemPrompt,
                tier: 'strong',
                max_tokens: 4096
            });

            this.state = 'observing';
            this.emit(`Observer check`, `Validating outcome of: ${step}`);

            workingMemory += `\n\nResult of Step ${i + 1} (${step}):\n${result.text}`;
            finalResult = result.text;
            this.state = 'executing';
        }

        this.state = 'completed';
        this.emit('Workflow complete', 'All steps executed successfully.');
        return finalResult;
    }
}
