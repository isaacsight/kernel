/** Get the kernel.chat token from config */
export declare function getCloudToken(): string | null;
/** Set the kernel.chat token */
export declare function setCloudToken(token: string): void;
/** Check if cloud sync is configured */
export declare function isCloudSyncEnabled(): boolean;
/** Pull learning data from cloud (if newer than local) */
export declare function pullFromCloud(): Promise<{
    synced: boolean;
    source: 'cloud' | 'local' | 'none';
}>;
/** Push local learning data to cloud */
export declare function pushToCloud(): Promise<boolean>;
/** Sync on startup: pull if cloud has newer data */
export declare function syncOnStartup(): Promise<string | null>;
export declare function schedulePush(): void;
/** Force an immediate push (call on exit) */
export declare function flushCloudSync(): void;
//# sourceMappingURL=cloud-sync.d.ts.map