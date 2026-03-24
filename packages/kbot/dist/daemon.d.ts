export interface DaemonState {
    pid: number;
    startedAt: string;
    lastHeartbeat: string;
    cycles: number;
    subsystems: Record<string, {
        lastRun: string;
        nextRun: string;
        status: 'ok' | 'error' | 'running' | 'idle';
        lastError?: string;
        runCount: number;
    }>;
    notifications: number;
    alerts: string[];
}
/** Start the daemon — runs all subsystems on their intervals */
export declare function startDaemon(): Promise<void>;
/** Stop the daemon */
export declare function stopDaemon(): boolean;
/** Get daemon status */
export declare function getDaemonStatus(): DaemonState & {
    running: boolean;
};
/** Get recent daemon log lines */
export declare function getDaemonLog(lines?: number): string[];
//# sourceMappingURL=daemon.d.ts.map