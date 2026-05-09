import { describe, it, expect } from 'vitest';
import { toAgentSdkTool, toAgentSdkTools, fromAgentSdkTool, fromAgentSdkExecutableTool, fromAgentSdkTools, } from './index.js';
const sampleKbotTool = {
    name: 'echo',
    description: 'Echo back the input string',
    parameters: {
        text: { type: 'string', description: 'The text to echo', required: true },
        times: { type: 'integer', description: 'Repeat count', required: false, default: 1 },
        tags: {
            type: 'array',
            description: 'Optional tags',
            required: false,
            items: { type: 'string' },
        },
    },
    tier: 'free',
    async execute(args) {
        const t = String(args.text ?? '');
        const n = Number(args.times ?? 1);
        return Array(n).fill(t).join(' ');
    },
};
describe('toAgentSdkTool', () => {
    it('converts a kbot tool into an Agent SDK tool', () => {
        const out = toAgentSdkTool(sampleKbotTool);
        expect(out.name).toBe('echo');
        expect(out.description).toBe('Echo back the input string');
        expect(out.input_schema.type).toBe('object');
        expect(out.input_schema.properties.text.type).toBe('string');
        expect(out.input_schema.properties.times.type).toBe('integer');
        expect(out.input_schema.required).toEqual(['text']);
        expect(out.input_schema.additionalProperties).toBe(false);
    });
    it('passes default values through', () => {
        const out = toAgentSdkTool(sampleKbotTool);
        expect(out.input_schema.properties.times.default).toBe(1);
    });
    it('passes items spec for array params', () => {
        const out = toAgentSdkTool(sampleKbotTool);
        expect(out.input_schema.properties.tags.items).toEqual({ type: 'string' });
    });
    it('omits required[] when nothing is required', () => {
        const allOptional = {
            ...sampleKbotTool,
            parameters: { foo: { type: 'string', description: '', required: false } },
        };
        const out = toAgentSdkTool(allOptional);
        expect(out.input_schema.required).toBeUndefined();
    });
    it('respects strict: false (additionalProperties: true)', () => {
        const out = toAgentSdkTool(sampleKbotTool, { strict: false });
        expect(out.input_schema.additionalProperties).toBe(true);
    });
    it('renameTool hook overrides the name', () => {
        const out = toAgentSdkTool(sampleKbotTool, { renameTool: (n) => `kbot__${n}` });
        expect(out.name).toBe('kbot__echo');
    });
    it('preserveName: false sanitizes the name', () => {
        const weird = { ...sampleKbotTool, name: 'echo.weird name' };
        const out = toAgentSdkTool(weird, { preserveName: false });
        expect(out.name).toBe('echo_weird_name');
    });
    it('toAgentSdkTools maps a list', () => {
        const out = toAgentSdkTools([sampleKbotTool, sampleKbotTool]);
        expect(out).toHaveLength(2);
        expect(out[0].name).toBe('echo');
    });
    it('falls back to "string" type for unknown kbot types', () => {
        const weird = {
            ...sampleKbotTool,
            parameters: { x: { type: 'whatever', description: '', required: false } },
        };
        const out = toAgentSdkTool(weird);
        expect(out.input_schema.properties.x.type).toBe('string');
    });
});
describe('fromAgentSdkTool', () => {
    const sdkTool = {
        name: 'lookup',
        description: 'Look something up',
        input_schema: {
            type: 'object',
            properties: {
                q: { type: 'string', description: 'query' },
                limit: { type: 'integer', description: 'max results' },
            },
            required: ['q'],
        },
    };
    it('converts an Agent SDK tool into a kbot ToolDefinition', () => {
        const out = fromAgentSdkTool(sdkTool);
        expect(out.name).toBe('lookup');
        expect(out.tier).toBe('free');
        expect(out.parameters.q.required).toBe(true);
        expect(out.parameters.limit.required).toBe(false);
        expect(out.parameters.q.type).toBe('string');
        expect(out.parameters.limit.type).toBe('integer');
    });
    it('returns a structured error when invoked without a fallbackExecutor', async () => {
        const out = fromAgentSdkTool(sdkTool);
        const result = await out.execute({ q: 'x' });
        expect(result).toMatch(/Error.*without a handler/);
    });
    it('routes through fallbackExecutor when supplied', async () => {
        const out = fromAgentSdkTool(sdkTool, {
            fallbackExecutor: (name, args) => `${name}:${JSON.stringify(args)}`,
        });
        const result = await out.execute({ q: 'hello' });
        expect(result).toBe(`lookup:${JSON.stringify({ q: 'hello' })}`);
    });
    it('catches errors from the fallback and returns a string', async () => {
        const out = fromAgentSdkTool(sdkTool, {
            fallbackExecutor: () => {
                throw new Error('boom');
            },
        });
        const result = await out.execute({ q: 'x' });
        expect(result).toBe('Error: boom');
    });
    it('handles array type union ["string", "null"] by picking string', () => {
        const t = {
            name: 'nullable',
            description: '',
            input_schema: {
                type: 'object',
                properties: {
                    x: { type: ['string', 'null'], description: '' },
                },
            },
        };
        const out = fromAgentSdkTool(t);
        expect(out.parameters.x.type).toBe('string');
    });
    it('honors options (tier/timeout/maxResultSize)', () => {
        const out = fromAgentSdkTool(sdkTool, { tier: 'pro', timeout: 1234, maxResultSize: 999 });
        expect(out.tier).toBe('pro');
        expect(out.timeout).toBe(1234);
        expect(out.maxResultSize).toBe(999);
    });
    it('fromAgentSdkTools maps a list', () => {
        const out = fromAgentSdkTools([sdkTool, sdkTool]);
        expect(out).toHaveLength(2);
    });
});
describe('fromAgentSdkExecutableTool', () => {
    const exec = {
        name: 'add',
        description: 'add two numbers',
        input_schema: {
            type: 'object',
            properties: {
                a: { type: 'number', description: '' },
                b: { type: 'number', description: '' },
            },
            required: ['a', 'b'],
        },
        handler: (args) => String(Number(args.a) + Number(args.b)),
    };
    it('runs the embedded handler', async () => {
        const out = fromAgentSdkExecutableTool(exec);
        const r = await out.execute({ a: 2, b: 3 });
        expect(r).toBe('5');
    });
    it('JSON-stringifies non-string handler results', async () => {
        const t = {
            ...exec,
            handler: () => ({ ok: true }),
        };
        const out = fromAgentSdkExecutableTool(t);
        const r = await out.execute({ a: 0, b: 0 });
        expect(JSON.parse(r)).toEqual({ ok: true });
    });
    it('catches handler errors and returns a string', async () => {
        const t = {
            ...exec,
            handler: () => {
                throw new Error('nope');
            },
        };
        const out = fromAgentSdkExecutableTool(t);
        const r = await out.execute({ a: 1, b: 1 });
        expect(r).toBe('Error: nope');
    });
});
describe('round-trip kbot → SDK → kbot', () => {
    it('preserves the name, description, required fields, and types', () => {
        const sdk = toAgentSdkTool(sampleKbotTool);
        const back = fromAgentSdkTool(sdk, {
            fallbackExecutor: () => 'ok',
        });
        expect(back.name).toBe(sampleKbotTool.name);
        expect(back.description).toBe(sampleKbotTool.description);
        expect(back.parameters.text.required).toBe(true);
        expect(back.parameters.times.required).toBe(false);
        expect(back.parameters.text.type).toBe('string');
        expect(back.parameters.times.type).toBe('integer');
    });
});
//# sourceMappingURL=adapter.test.js.map