export interface CpuInfo {
    model: string;
    chip?: string;
    cores: number;
    performanceCores?: number;
    efficiencyCores?: number;
    arch: string;
}
export interface GpuInfo {
    model: string;
    cores?: number;
    vram?: string;
    metal?: string;
    cuda?: boolean;
    driver?: string;
}
export interface MemoryInfo {
    total: string;
    totalBytes: number;
    free: string;
    freeBytes: number;
    used: string;
    usedBytes: number;
    pressure: 'low' | 'moderate' | 'high';
}
export interface DiskInfo {
    total: string;
    available: string;
    used: string;
    usedPercent: number;
    filesystem: string;
}
export interface DisplayInfo {
    name: string;
    resolution: string;
    type?: string;
    main: boolean;
}
export interface BatteryInfo {
    present: boolean;
    percent?: number;
    charging?: boolean;
    timeRemaining?: string;
}
export interface NetworkInfo {
    hostname: string;
    wifi?: string;
    localIp?: string;
}
export interface DevTool {
    name: string;
    version: string;
}
export interface MachineProfile {
    model?: string;
    modelId?: string;
    cpu: CpuInfo;
    gpu: GpuInfo[];
    memory: MemoryInfo;
    disk: DiskInfo;
    os: string;
    osVersion: string;
    kernel: string;
    platform: string;
    uptime: string;
    displays: DisplayInfo[];
    battery: BatteryInfo;
    network: NetworkInfo;
    shell: string;
    user: string;
    home: string;
    devTools: DevTool[];
    canRunLocalModels: boolean;
    gpuAcceleration: 'metal' | 'cuda' | 'vulkan' | 'cpu-only';
    recommendedModelSize: string;
    probedAt: string;
}
export declare function probeMachine(): Promise<MachineProfile>;
/** Get the cached profile (null if probeMachine hasn't been called) */
export declare function getMachineProfile(): MachineProfile | null;
/** Force a fresh probe (clears cache) */
export declare function reprobeMachine(): Promise<MachineProfile>;
export declare function formatMachineProfile(p: MachineProfile): string;
export declare function formatMachineForPrompt(p: MachineProfile): string;
//# sourceMappingURL=machine.d.ts.map