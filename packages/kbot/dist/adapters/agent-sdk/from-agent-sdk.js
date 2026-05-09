// Anthropic Agent SDK tool → kbot ToolDefinition
//
// Lets a kbot host import third-party Agent SDK tools (or hand-written
// schema/handler pairs) and register them in the kbot tool registry. Schema
// is downconverted from JSON Schema to kbot's flatter parameter shape.
//
// Inverse of to-agent-sdk.ts. Round-trip is lossy in general (JSON Schema is
// strictly richer than kbot's shape), but is stable for the param shapes
// that kbot itself uses.
const JSON_TO_KBOT = {
    string: 'string',
    number: 'number',
    integer: 'integer',
    boolean: 'boolean',
    object: 'object',
    array: 'array',
    null: 'null',
};
function pickType(t) {
    if (typeof t === 'string')
        return JSON_TO_KBOT[t] ?? 'string';
    if (Array.isArray(t)) {
        // Pick the first non-null type to keep parity with kbot's single-type shape.
        const first = t.find((x) => x !== 'null');
        return first ? JSON_TO_KBOT[first] ?? 'string' : 'string';
    }
    return 'string';
}
function mapProperty(p, required) {
    const out = {
        type: pickType(p.type),
        description: typeof p.description === 'string' ? p.description : '',
        required,
    };
    if (p.default !== undefined)
        out.default = p.default;
    if (p.items !== undefined)
        out.items = p.items;
    if (p.properties)
        out.properties = p.properties;
    return out;
}
function buildParameters(schema) {
    if (!schema || typeof schema !== 'object')
        return {};
    const required = new Set(schema.required ?? []);
    const out = {};
    for (const [name, prop] of Object.entries(schema.properties ?? {})) {
        out[name] = mapProperty(prop, required.has(name));
    }
    return out;
}
/**
 * Convert a non-executable Agent SDK tool definition into a kbot ToolDefinition.
 * Because the source has no handler, an executor must be supplied via opts.fallbackExecutor
 * — otherwise the resulting tool will return a structured "no handler" error string when invoked.
 */
export function fromAgentSdkTool(tool, opts = {}) {
    const fallback = opts.fallbackExecutor;
    return {
        name: tool.name,
        description: tool.description,
        parameters: buildParameters(tool.input_schema),
        tier: opts.tier ?? 'free',
        timeout: opts.timeout,
        maxResultSize: opts.maxResultSize,
        async execute(args) {
            if (fallback) {
                try {
                    const result = await fallback(tool.name, args);
                    return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                }
                catch (e) {
                    return `Error: ${e.message}`;
                }
            }
            return `Error: tool "${tool.name}" was imported without a handler. Provide opts.fallbackExecutor when calling fromAgentSdkTool().`;
        },
    };
}
/**
 * Convert an executable Agent SDK tool (schema + handler) into a kbot ToolDefinition.
 * Preferred over fromAgentSdkTool() when the caller has the implementation in process.
 */
export function fromAgentSdkExecutableTool(tool, opts = {}) {
    return {
        name: tool.name,
        description: tool.description,
        parameters: buildParameters(tool.input_schema),
        tier: opts.tier ?? 'free',
        timeout: opts.timeout,
        maxResultSize: opts.maxResultSize,
        async execute(args) {
            try {
                const result = await tool.handler(args);
                return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
            }
            catch (e) {
                return `Error: ${e.message}`;
            }
        },
    };
}
export function fromAgentSdkTools(tools, opts = {}) {
    return tools.map((t) => fromAgentSdkTool(t, opts));
}
//# sourceMappingURL=from-agent-sdk.js.map