export interface Task {
    id: string;
    subject: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'blocked';
    /** Present continuous form for progress display (e.g., "Running tests") */
    activeForm?: string;
    blockedBy: string[];
    blocks: string[];
    created: string;
    updated: string;
}
export declare function registerTaskTools(): void;
//# sourceMappingURL=tasks.d.ts.map