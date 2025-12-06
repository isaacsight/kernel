export interface TokenEvent {
    text: string;
    logprob?: number;
    candidates?: { token: string; logprob: number; prob: number }[];
    time?: number; // ms latency from start
}

export interface ModelConfig {
    temperature?: number;
    maxTokens?: number;
    modelName: string;
    apiKey?: string; // Optional, usually handled by backend proxy but useful for client-side override if needed
}

export interface ModelAdapter {
    name: string;
    generate: (prompt: string, config: ModelConfig) => AsyncGenerator<TokenEvent>;
}

export class MockModelAdapter implements ModelAdapter {
    name = "MockModel";

    async *generate(prompt: string, config: ModelConfig): AsyncGenerator<TokenEvent> {
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const mockOutput = `Response from ${config.modelName || "Mock"}: Analysis of "${prompt.slice(0, 20)}..."\n\nThis stream simulates latency and tokenization. We are calculating mock probabilities.`;
        const words = mockOutput.split(/(\s+)/);

        let startTime = Date.now();
        await delay(200);

        for (const word of words) {
            if (!word) continue;
            await delay(15 + Math.random() * 30);
            yield {
                text: word,
                logprob: -0.1 * Math.random(),
                time: Date.now() - startTime
            };
        }
    }
}

// Placeholder for Real Adapters (Implemented in App via API Routes to keep secrets server-side)
// Or we can implement a ClientSideAPIAdapter that calls our own /api/generate endpoint
export class APIProxyAdapter implements ModelAdapter {
    name: string;
    endpoint: string;

    constructor(name: string, endpoint: string = '/api/generate') {
        this.name = name;
        this.endpoint = endpoint;
    }

    async *generate(prompt: string, config: ModelConfig): AsyncGenerator<TokenEvent> {
        let startTime = Date.now();

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, config })
            });

            if (!response.ok || !response.body) {
                yield { text: `Error: ${response.statusText}`, time: Date.now() - startTime };
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(l => l.trim() !== '');

                for (const line of lines) {
                    // Expecting SSE format or simple JSON Lines
                    // For simplicity, let's assume our API returns simple JSON lines with { token: "foo" }
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.replace('data: ', ''));
                            yield {
                                text: data.text,
                                logprob: data.logprob,
                                time: Date.now() - startTime
                            };
                        } catch (e) {
                            console.error("Parse error", e);
                        }
                    }
                }
            }

        } catch (e) {
            yield { text: `Connection Error: ${e}`, time: Date.now() - startTime };
        }
    }
}

// Client-Side Adapter for OpenAI
export class OpenAIClientAdapter implements ModelAdapter {
    name: string;
    model: string;

    constructor(name: string, model: string) {
        this.name = name;
        this.model = model;
    }

    async *generate(prompt: string, config: ModelConfig): AsyncGenerator<TokenEvent> {
        if (!config.apiKey) {
            yield { text: "Error: No API Key provided" };
            return;
        }

        const startTime = Date.now();

        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: "user", content: prompt }],
                    stream: true,
                    temperature: config.temperature ?? 0.7,
                    max_tokens: config.maxTokens ?? 1000
                })
            });

            if (!response.ok) {
                const err = await response.text();
                yield { text: `API Error: ${response.status} ${err}`, time: Date.now() - startTime };
                return;
            }

            if (!response.body) return;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    if (line.includes('[DONE]')) return;

                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const content = data.choices[0]?.delta?.content;

                            if (content) {
                                yield {
                                    text: content,
                                    time: Date.now() - startTime
                                };
                            }
                        } catch (e) {
                            console.error('Error parsing chunk', e);
                        }
                    }
                }
            }

        } catch (e) {
            yield { text: `Connection Error: ${e}`, time: Date.now() - startTime };
        }
    }
}

// Client-Side Adapter for Anthropic
export class AnthropicClientAdapter implements ModelAdapter {
    name: string;
    model: string;

    constructor(name: string, model: string) {
        this.name = name;
        this.model = model;
    }

    async *generate(prompt: string, config: ModelConfig): AsyncGenerator<TokenEvent> {
        if (!config.apiKey) {
            yield { text: "Error: No API Key provided" };
            return;
        }

        const startTime = Date.now();

        try {
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": config.apiKey,
                    "anthropic-version": "2023-06-01",
                    "anthropic-dangerous-direct-browser-access": "true"
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: "user", content: prompt }],
                    stream: true,
                    max_tokens: config.maxTokens ?? 1024
                })
            });

            if (!response.ok) {
                const err = await response.text();
                yield { text: `API Error: ${response.status} ${err}`, time: Date.now() - startTime };
                return;
            }

            if (!response.body) return;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === 'content_block_delta' && data.delta?.text) {
                                yield {
                                    text: data.delta.text,
                                    time: Date.now() - startTime
                                };
                            }
                        } catch (e) {
                            console.error('Error parsing chunk', e);
                        }
                    }
                }
            }

        } catch (e) {
            yield { text: `Connection Error: ${e}`, time: Date.now() - startTime };
        }
    }
}
