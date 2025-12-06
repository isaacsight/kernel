
"use client";

import { create } from 'zustand';
import { MockModelAdapter, APIProxyAdapter, OpenAIClientAdapter, AnthropicClientAdapter, ModelAdapter, TokenEvent } from '@ai-tools/adapters';

interface SteeringState {
    honesty: number;
    conciseness: number;
}

interface DebuggerState {
    prompt: string;
    apiKey: string; // [NEW] API Key for BYOK
    leftModelName: string;
    rightModelName: string;

    steering: SteeringState;

    isGenerating: boolean;

    leftTokens: TokenEvent[];
    rightTokens: TokenEvent[];

    leftMetrics: { latency: number; tokens: number; tps: number };
    rightMetrics: { latency: number; tokens: number; tps: number };

    setPrompt: (prompt: string) => void;
    setApiKey: (key: string) => void; // [NEW] Action
    setModel: (side: 'left' | 'right', name: string) => void;
    setSteering: (key: keyof SteeringState, value: number) => void;

    runGeneration: () => Promise<void>;
    reset: () => void;
}

// Registry
const adapters: Record<string, ModelAdapter> = {
    'Mock GTP-4': new MockModelAdapter(),
    'Mock Claude-3': new MockModelAdapter(),

    // Client-Side Adapters for BYOK
    'OpenAI GPT-4o': new OpenAIClientAdapter('OpenAI GPT-4o', 'gpt-4o'),
    'Anthropic Claude 3.5 Sonnet': new AnthropicClientAdapter('Anthropic Claude 3.5 Sonnet', 'claude-3-5-sonnet-20240620'),

    // Legacy/Local Node
    'Studio Node (Local)': new APIProxyAdapter('Studio Node (Local)', '/api/generate'),
};


export const useDebuggerStore = create<DebuggerState>((set, get) => ({
    prompt: 'Explain the concept of "Mechanistic Interpretability" to a 5-year-old.',
    apiKey: '',
    leftModelName: 'Mock GTP-4',
    rightModelName: 'Mock Claude-3',

    // Initial Steering State
    steering: { honesty: 0, conciseness: 0 },

    isGenerating: false,

    leftTokens: [],
    rightTokens: [],

    leftMetrics: { latency: 0, tokens: 0, tps: 0 },
    rightMetrics: { latency: 0, tokens: 0, tps: 0 },

    setPrompt: (prompt) => set({ prompt }),
    setApiKey: (apiKey) => set({ apiKey }),
    setModel: (side, name) => side === 'left' ? set({ leftModelName: name }) : set({ rightModelName: name }),
    setSteering: (key, value) => set(state => ({ steering: { ...state.steering, [key]: value } })),

    reset: () => set({
        leftTokens: [], rightTokens: [],
        leftMetrics: { latency: 0, tokens: 0, tps: 0 },
        rightMetrics: { latency: 0, tokens: 0, tps: 0 }
    }),

    runGeneration: async () => {
        const { prompt, apiKey, leftModelName, rightModelName, steering } = get();
        set({ isGenerating: true });
        get().reset();

        // Helper to run a stream
        const runStream = async (adapterName: string, side: 'left' | 'right') => {
            const adapter = adapters[adapterName];

            // Pass prompt directly (adapters will handle message construction)
            // Ideally we'd pass system prompt separately but our simple adapter interface usually takes just one prompt string.
            // For now, prepending is the "Steering" mechanism.
            const fullPrompt = `Honesty: ${steering.honesty}, Conciseness: ${steering.conciseness}\n\n${prompt}`;

            // Pass modelName to config so API knows which to call
            // [NEW] Pass apiKey
            const stream = adapter.generate(fullPrompt, {
                modelName: adapterName,
                apiKey: apiKey // Pass the key!
            });

            const startTime = Date.now();
            let tokens = 0;

            for await (const token of stream) {
                set(state => {
                    const newTokens = side === 'left' ? [...state.leftTokens, token] : [...state.rightTokens, token];
                    const now = Date.now();
                    const latency = now - startTime;
                    const tps = tokens > 0 ? tokens / (latency / 1000) : 0;

                    const metrics = { latency, tokens: tokens + 1, tps };

                    return side === 'left'
                        ? { leftTokens: newTokens, leftMetrics: metrics }
                        : { rightTokens: newTokens, rightMetrics: metrics };
                });
                tokens++;
            }
        };

        await Promise.all([
            runStream(leftModelName, 'left'),
            runStream(rightModelName, 'right')
        ]);

        set({ isGenerating: false });
    }
}));
