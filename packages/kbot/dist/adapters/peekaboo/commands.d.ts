import type { PeekabooAgentResult, PeekabooClickResult, PeekabooOutcome, PeekabooPerformActionResult, PeekabooSeeResult, PeekabooSetValueResult, PeekabooTypeResult } from './types.js';
export interface SeeOptions {
    app?: string;
    mode?: 'screen' | 'window';
    retina?: boolean;
}
export declare function see(opts?: SeeOptions): Promise<PeekabooOutcome<PeekabooSeeResult>>;
export interface ClickOptions {
    snapshot: string;
    on?: string;
    coords?: [number, number];
    wait?: number;
}
export declare function click(opts: ClickOptions): Promise<PeekabooOutcome<PeekabooClickResult>>;
export interface TypeOptions {
    text: string;
    clear?: boolean;
    delayMs?: number;
}
export declare function type_(opts: TypeOptions): Promise<PeekabooOutcome<PeekabooTypeResult>>;
export interface SetValueOptions {
    snapshot: string;
    on: string;
    value: string;
}
export declare function setValue(_opts: SetValueOptions): Promise<PeekabooOutcome<PeekabooSetValueResult>>;
export interface PerformActionOptions {
    snapshot: string;
    on: string;
    action: string;
}
export declare function performAction(_opts: PerformActionOptions): Promise<PeekabooOutcome<PeekabooPerformActionResult>>;
export interface AgentOptions {
    prompt: string;
}
/**
 * Runs `peekaboo agent "$prompt"` and returns the final stdout. Unlike the
 * structured commands the agent subcommand may emit free-form text, so we
 * surface stdout verbatim under `output`.
 */
export declare function agent(opts: AgentOptions): Promise<PeekabooOutcome<PeekabooAgentResult>>;
//# sourceMappingURL=commands.d.ts.map