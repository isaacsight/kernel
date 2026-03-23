// kbot Programmatic SDK
// Clean public API for using kbot as a library.
//
// Usage:
//   import { agent, tools } from '@kernel.chat/kbot'
//
//   const result = await agent.run('fix the bug in login.ts')
//   console.log(result.content)
//   console.log(result.toolCalls)
//
//   const allTools = tools.list()
//   const execResult = await tools.execute('read_file', { path: 'README.md' })
//
//   for await (const event of agent.stream('explain this code')) {
//     if (event.type === 'content_delta') process.stdout.write(event.text)
//   }
import { runAgent } from './agent.js';
import { registerAllTools, getAllTools, executeTool, getTool, } from './tools/index.js';
import { SilentUIAdapter, CallbackUIAdapter } from './ui-adapter.js';
// ── Initialization guard ──
let initialized = false;
async function ensureInitialized() {
    if (initialized)
        return;
    await registerAllTools();
    initialized = true;
}
// ── Agent API ──
export const agent = {
    /**
     * Run the agent with a message and get a structured result.
     *
     * @example
     * const result = await agent.run('fix the bug in login.ts')
     * console.log(result.content)
     */
    async run(message, options) {
        await ensureInitialized();
        const ui = options?.ui ?? new SilentUIAdapter();
        const start = Date.now();
        const agentOpts = {
            agent: options?.agent,
            model: options?.model,
            stream: options?.stream ?? false,
            thinking: options?.thinking,
            thinkingBudget: options?.thinkingBudget,
            tier: options?.tier ?? 'free',
            ui,
        };
        const result = await runAgent(message, agentOpts);
        const durationMs = Date.now() - start;
        return {
            content: result.content ?? (ui instanceof SilentUIAdapter ? ui.content : ''),
            toolCalls: ui instanceof SilentUIAdapter ? ui.toolCalls : [],
            agent: result.agent ?? options?.agent ?? 'kernel',
            model: result.model ?? options?.model ?? '',
            usage: {
                inputTokens: result.usage?.input_tokens ?? 0,
                outputTokens: result.usage?.output_tokens ?? 0,
            },
            durationMs,
        };
    },
    /**
     * Stream agent events as an async generator.
     *
     * @example
     * for await (const event of agent.stream('explain this code')) {
     *   if (event.type === 'content_delta') process.stdout.write(event.text)
     * }
     */
    async *stream(message, options) {
        await ensureInitialized();
        // Channel for pushing events from the callback adapter
        const queue = [];
        let resolve = null;
        let done = false;
        function push(event) {
            queue.push(event);
            if (resolve) {
                const r = resolve;
                resolve = null;
                r();
            }
        }
        const ui = new CallbackUIAdapter({
            onToolCallStart(name, args) {
                push({ type: 'tool_call_start', name, args });
            },
            onToolCallEnd(name, result, error) {
                push({ type: 'tool_call_end', name, result, error });
            },
            onThinking(text) {
                push({ type: 'thinking_delta', text });
            },
            onContent(text) {
                push({ type: 'content_delta', text });
            },
            onContentEnd() {
                push({ type: 'content_end' });
            },
            onAgentRoute(agentId, method, confidence) {
                push({ type: 'agent_route', agentId, method, confidence });
            },
        });
        // Run the agent in the background, pushing events via callbacks
        const agentOpts = {
            agent: options?.agent,
            model: options?.model,
            stream: true,
            thinking: options?.thinking,
            thinkingBudget: options?.thinkingBudget,
            tier: options?.tier ?? 'free',
            ui,
        };
        const agentPromise = runAgent(message, agentOpts).then(result => {
            push({
                type: 'usage',
                inputTokens: result.usage?.input_tokens ?? 0,
                outputTokens: result.usage?.output_tokens ?? 0,
            });
            push({ type: 'done', content: result.content });
            done = true;
            queue.push(null); // sentinel
            if (resolve) {
                const r = resolve;
                resolve = null;
                r();
            }
        }).catch(err => {
            done = true;
            queue.push(null);
            if (resolve) {
                const r = resolve;
                resolve = null;
                r();
            }
            throw err;
        });
        // Yield events as they arrive
        while (true) {
            if (queue.length > 0) {
                const event = queue.shift();
                if (event === null)
                    break; // sentinel — agent finished
                yield event;
            }
            else if (done) {
                break;
            }
            else {
                await new Promise(r => { resolve = r; });
            }
        }
        // Ensure the agent promise is settled (propagates errors)
        await agentPromise;
    },
};
// ── Tools API ──
export const tools = {
    /**
     * List all registered tools with their descriptions and parameters.
     *
     * @example
     * const allTools = tools.list()
     * console.log(allTools.map(t => t.name))
     */
    list() {
        return getAllTools().map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
        }));
    },
    /**
     * Execute a single tool by name.
     *
     * @example
     * const result = await tools.execute('read_file', { path: 'README.md' })
     * console.log(result.result)
     */
    async execute(name, args) {
        await ensureInitialized();
        const start = Date.now();
        const call = { id: name, name, arguments: args };
        const toolResult = await executeTool(call);
        return {
            result: toolResult.result,
            error: toolResult.error ? toolResult.result : undefined,
            durationMs: Date.now() - start,
        };
    },
    /**
     * Get a single tool definition by name.
     *
     * @example
     * const readFile = tools.get('read_file')
     * if (readFile) console.log(readFile.description)
     */
    get(name) {
        return getTool(name);
    },
};
// ── Providers API ──
export const providers = {
    /**
     * Auto-detect available providers based on environment variables and config.
     */
    async detect() {
        const { getProvider, getByokProvider } = await import('./auth.js');
        const current = getByokProvider();
        if (!current)
            return [];
        const p = getProvider(current);
        return [{
                name: p.name,
                models: p.models || [],
            }];
    },
    /**
     * List all supported provider names.
     */
    async list() {
        const { PROVIDERS } = await import('./auth.js');
        return Object.keys(PROVIDERS);
    },
};
export { SilentUIAdapter, CallbackUIAdapter, TerminalUIAdapter } from './ui-adapter.js';
export { ResponseStream } from './streaming.js';
//# sourceMappingURL=sdk.js.map