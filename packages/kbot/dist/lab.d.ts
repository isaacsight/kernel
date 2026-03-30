export type LabDomain = 'physics' | 'chemistry' | 'biology' | 'math' | 'neuro' | 'earth' | 'social' | 'humanities' | 'health' | 'general';
export interface LabEntry {
    id: string;
    type: 'query' | 'result' | 'computation' | 'note' | 'citation' | 'hypothesis' | 'figure';
    content: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}
export interface Citation {
    id: string;
    doi?: string;
    title: string;
    authors: string[];
    year: number;
    source: string;
}
export interface LabSession {
    id: string;
    name: string;
    domain: LabDomain;
    notebook: LabEntry[];
    variables: Record<string, unknown>;
    citations: Citation[];
    startedAt: string;
    lastActiveAt: string;
}
/** List all lab sessions, newest first */
export declare function listLabSessions(): LabSession[];
/** Get a specific lab session by ID */
export declare function getLabSession(id: string): LabSession | null;
/** Export the notebook in the requested format */
export declare function exportNotebook(session: LabSession, format?: 'markdown' | 'latex' | 'json'): string;
/**
 * Start the interactive science lab REPL.
 *
 * @param opts.domain - Initial scientific domain (default: 'general')
 * @param opts.resume - Session ID to resume
 * @param opts.name   - Name for the new session
 */
export declare function startLab(opts?: {
    domain?: LabDomain;
    resume?: string;
    name?: string;
}): Promise<void>;
//# sourceMappingURL=lab.d.ts.map