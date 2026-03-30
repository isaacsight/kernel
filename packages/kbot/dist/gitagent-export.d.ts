export interface GitAgentManifest {
    version: '1.0';
    agent: GitAgentDefinition;
    metadata: GitAgentMetadata;
}
export interface GitAgentDefinition {
    name: string;
    description: string;
    instructions: string;
    model?: string;
    tools: GitAgentTool[];
    capabilities: string[];
    input_modes: string[];
    output_modes: string[];
}
export interface GitAgentTool {
    name: string;
    description: string;
    parameters: Record<string, {
        type: string;
        description: string;
        required?: boolean;
    }>;
}
export interface GitAgentMetadata {
    source: 'kbot';
    source_version: string;
    exported_at: string;
    agent_id: string;
    compatibility: string[];
}
export declare function exportAgent(agentId: string): GitAgentManifest | null;
export declare function exportAllAgents(): GitAgentManifest[];
export declare function writeGitAgentFile(agentId: string, outputDir?: string): string;
export declare function writeAllGitAgentFiles(outputDir?: string): string[];
export declare function listExportableAgents(): Array<{
    id: string;
    name: string;
    description: string;
}>;
export declare function formatExportableAgentList(): string;
//# sourceMappingURL=gitagent-export.d.ts.map