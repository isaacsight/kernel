export interface SimulationScenario {
    description: string;
    targetFiles: string[];
    changeType: 'refactor' | 'add_feature' | 'delete' | 'migrate' | 'upgrade';
    constraints?: string[];
}
export interface BreakingChange {
    file: string;
    line?: number;
    description: string;
    severity: 'warning' | 'error';
    suggestedFix?: string;
}
export interface SimulationResult {
    scenario: SimulationScenario;
    predictedOutcome: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    breakingChanges: BreakingChange[];
    estimatedEffort: string;
    confidence: number;
    recommendations: string[];
}
export interface ComparisonResult {
    scenarios: SimulationResult[];
    recommended: number;
    reasoning: string;
}
export interface FileNode {
    path: string;
    exports: string[];
    imports: string[];
    size: number;
}
export interface DependencyGraph {
    nodes: Map<string, FileNode>;
    edges: Map<string, string[]>;
}
export declare function buildDependencyGraph(rootDir: string): Promise<DependencyGraph>;
export declare function findImpactedFiles(graph: DependencyGraph, changedFiles: string[]): string[];
export declare function simulateChange(scenario: SimulationScenario, graph?: DependencyGraph): Promise<SimulationResult>;
export declare class Simulator {
    private rootDir;
    private graph;
    constructor(rootDir?: string);
    init(): Promise<void>;
    simulate(scenario: SimulationScenario): Promise<SimulationResult>;
    compareScenarios(scenarios: SimulationScenario[]): Promise<ComparisonResult>;
    getGraph(): DependencyGraph | null;
}
//# sourceMappingURL=simulation.d.ts.map