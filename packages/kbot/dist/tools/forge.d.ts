/** Validate forged tool code for dangerous patterns */
export declare function validateCode(code: string): {
    safe: boolean;
    reason?: string;
};
/** List all locally forged tools with metadata */
export declare function listForgedTools(): Array<{
    name: string;
    description: string;
    createdAt: string;
    path: string;
}>;
/** Register the forge_tool itself */
export declare function registerForgeTools(): void;
//# sourceMappingURL=forge.d.ts.map