export interface ToolDef {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    handler: (args: Record<string, unknown>) => Promise<unknown> | unknown;
}
export declare const computerCoordinatorRegister: ToolDef;
export declare const computerCoordinatorClaim: ToolDef;
export declare const computerCoordinatorRelease: ToolDef;
export declare const computerCoordinatorStatus: ToolDef;
export declare const computerCoordinatorUnregister: ToolDef;
export declare const computerCoordinatorTools: ToolDef[];
//# sourceMappingURL=computer-coordinator-tools.d.ts.map