export type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';
export interface JsonSchemaProperty {
    type?: JsonSchemaType | JsonSchemaType[];
    description?: string;
    enum?: unknown[];
    items?: JsonSchemaProperty | Record<string, unknown>;
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
    default?: unknown;
    [k: string]: unknown;
}
export interface AgentSdkInputSchema {
    type: 'object';
    properties: Record<string, JsonSchemaProperty>;
    required?: string[];
    additionalProperties?: boolean;
}
/**
 * The on-the-wire tool definition the Agent SDK and the Messages API both
 * accept. Names are snake_case by convention; the SDK does not enforce.
 */
export interface AgentSdkTool {
    name: string;
    description: string;
    input_schema: AgentSdkInputSchema;
}
/**
 * Optional executable companion. The SDK delivers `tool_use` blocks; the
 * caller is responsible for routing them to a handler. `AgentSdkExecutableTool`
 * couples the schema with a handler so the from-adapter can hand back something
 * the kbot registry can run.
 */
export interface AgentSdkExecutableTool extends AgentSdkTool {
    /**
     * Handler may return a string (passed through) or arbitrary JSON-serializable
     * value (stringified by the adapter). Mirrors what real Agent SDK handlers
     * return in practice.
     */
    handler: (input: Record<string, unknown>) => Promise<unknown> | unknown;
}
//# sourceMappingURL=types.d.ts.map