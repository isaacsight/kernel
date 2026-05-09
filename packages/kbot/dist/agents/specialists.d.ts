export interface SpecialistDef {
    name: string;
    icon: string;
    color: string;
    prompt: string;
    /**
     * Optional whitelist of tool names this specialist is allowed to call.
     * When omitted (or empty), the specialist inherits the global tool set.
     * Used by the workspace agent runtime to gate tool execution per-specialist.
     */
    allowedTools?: string[];
}
export declare const SPECIALISTS: Record<string, SpecialistDef>;
//# sourceMappingURL=specialists.d.ts.map