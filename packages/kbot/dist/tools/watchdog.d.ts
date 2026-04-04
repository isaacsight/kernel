export interface ServiceInfo {
    label: string;
    shortName: string;
    pid: number | null;
    status: 'running' | 'dead' | 'not-loaded';
    cpu: string;
    mem: string;
    uptime: string;
}
export interface SystemHealth {
    loadAvg: string;
    memFree: string;
    memTotal: string;
    memUsed: string;
    diskFree: string;
    diskUsed: string;
    diskTotal: string;
    ollamaStatus: string;
    ollamaModels: string[];
    kbotMemorySize: string;
    dreamCycles: number;
    dreamInsights: number;
    services: ServiceInfo[];
}
export declare function getServiceStatus(): ServiceInfo[];
export declare function restartService(name: string): {
    success: boolean;
    message: string;
};
export declare function getSystemHealth(): SystemHealth;
export declare function registerWatchdogTools(): void;
//# sourceMappingURL=watchdog.d.ts.map