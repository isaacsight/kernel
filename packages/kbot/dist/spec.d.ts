import { type AgentOptions, type AgentResponse } from './agent.js';
export interface SpecOptions {
    /** Override the default architect agent */
    agent?: string;
    /** Custom output path for the spec file */
    output?: string;
    /** After generating the spec, pass it to the coder agent for implementation */
    implement?: boolean;
    /** Base agent options (model, stream, etc.) */
    agentOpts?: AgentOptions;
}
export interface SpecResult {
    /** The generated spec markdown content */
    spec: string;
    /** Path where the spec was saved */
    path: string;
    /** The agent that generated the spec */
    agent: string;
    /** If --implement was used, the implementation response */
    implementation?: AgentResponse;
}
export declare function generateSpec(description: string, options?: SpecOptions): Promise<SpecResult>;
//# sourceMappingURL=spec.d.ts.map