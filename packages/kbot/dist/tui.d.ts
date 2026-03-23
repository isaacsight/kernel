export declare function getTermSize(): {
    cols: number;
    rows: number;
};
export declare function clearScreen(): void;
export declare function hideCursor(): void;
export declare function showCursor(): void;
/** Draw a bordered panel with title */
export declare function panel(title: string, content: string, opts?: {
    width?: number;
    color?: (text: string) => string;
    padding?: number;
}): string;
/** Horizontal divider with optional label */
export declare function dividerLine(label?: string, width?: number): string;
export declare function progressBar(current: number, total: number, opts?: {
    width?: number;
    label?: string;
    color?: (text: string) => string;
    showPercent?: boolean;
    showCount?: boolean;
}): string;
export interface StepProgress {
    steps: Array<{
        label: string;
        status: 'pending' | 'running' | 'done' | 'failed';
    }>;
    currentStep: number;
}
export declare function renderStepProgress(progress: StepProgress): string;
export declare function splitPane(left: {
    title: string;
    content: string;
    color?: (text: string) => string;
}, right: {
    title: string;
    content: string;
    color?: (text: string) => string;
}): string;
export declare function table(headers: string[], rows: string[][], opts?: {
    color?: (text: string) => string;
    padding?: number;
}): string;
export interface DashboardState {
    agent: string;
    model: string;
    provider: string;
    toolsUsed: number;
    tokensUsed: number;
    cost: number;
    sessionTurns: number;
    activeSubagents: Array<{
        id: string;
        agent: string;
        status: string;
    }>;
    recentTools: Array<{
        name: string;
        duration: number;
        success: boolean;
    }>;
}
export declare function renderDashboard(state: DashboardState): string;
export declare function brailleSparkline(data: number[], width?: number): string;
export declare function sparkline(data: number[], opts?: {
    color?: (text: string) => string;
    label?: string;
}): string;
export declare function toast(message: string, type?: 'info' | 'success' | 'warn' | 'error'): void;
/** Truncate string with ellipsis */
export declare function truncate(str: string, maxWidth: number): string;
/** Word-wrap text to width */
export declare function wordWrap(text: string, width: number): string[];
//# sourceMappingURL=tui.d.ts.map