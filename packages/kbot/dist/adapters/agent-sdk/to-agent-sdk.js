// kbot ToolDefinition → Anthropic Agent SDK tool
//
// One-way schema translation. The Agent SDK delivers tool_use blocks and
// expects the host to route them to a handler — that routing belongs in the
// caller's agent loop, not in the adapter. This file only produces the
// schema half so kbot tools can be advertised to the Agent SDK / Messages
// API without taking a runtime dependency on @anthropic-ai/sdk.
const KBOT_TYPE_TO_JSON = {
    string: 'string',
    number: 'number',
    integer: 'integer',
    boolean: 'boolean',
    object: 'object',
    array: 'array',
    null: 'null',
};
function mapType(t) {
    const lc = t.toLowerCase();
    return KBOT_TYPE_TO_JSON[lc] ?? 'string';
}
function mapParameter(p) {
    const out = {
        type: mapType(p.type),
        description: p.description,
    };
    if (p.default !== undefined)
        out.default = p.default;
    if (p.items)
        out.items = p.items;
    if (p.properties) {
        const nested = {};
        for (const [k, v] of Object.entries(p.properties)) {
            // Best-effort: nested properties in kbot params are loosely typed.
            const vv = v;
            nested[k] = {
                type: vv.type ? mapType(vv.type) : 'string',
                description: vv.description ?? '',
            };
        }
        out.properties = nested;
    }
    return out;
}
export function toAgentSdkTool(tool, opts = {}) {
    const properties = {};
    const required = [];
    for (const [name, param] of Object.entries(tool.parameters)) {
        properties[name] = mapParameter(param);
        if (param.required)
            required.push(name);
    }
    const input_schema = {
        type: 'object',
        properties,
        additionalProperties: opts.strict === false ? true : false,
    };
    if (required.length > 0)
        input_schema.required = required;
    const name = opts.renameTool
        ? opts.renameTool(tool.name)
        : opts.preserveName === false
            ? tool.name.replace(/[^A-Za-z0-9_-]/g, '_')
            : tool.name;
    return {
        name,
        description: tool.description,
        input_schema,
    };
}
export function toAgentSdkTools(tools, opts = {}) {
    return tools.map((t) => toAgentSdkTool(t, opts));
}
//# sourceMappingURL=to-agent-sdk.js.map