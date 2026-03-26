export interface SyncUploadResult {
    uploaded_bytes: number;
    patterns_synced: number;
    last_sync: string;
}
export interface SyncPullResult {
    downloaded_bytes: number;
    new_patterns: number;
    conflicts_resolved: number;
}
export interface SyncStatus {
    last_push: string | null;
    last_pull: string | null;
    local_patterns: number;
    cloud_patterns: number;
    in_sync: boolean;
}
interface RunOptions {
    /** Override sync URL */
    url?: string;
    /** Auth token (kernel.chat JWT or kn_live_* key) */
    token?: string;
    /** Force push even if no changes detected */
    force?: boolean;
}
/** Collect all learning data, compress, and upload to sync endpoint.
 *  Returns upload stats. */
export declare function runCrossDeviceSync(options?: RunOptions): Promise<SyncUploadResult>;
/** Download latest snapshot from cloud and merge with local data.
 *  Merge strategy: prefer newer timestamps, higher confidence.
 *  Returns download stats. */
export declare function pullFromCloud(options?: RunOptions): Promise<SyncPullResult>;
/** Get current sync status across local and cloud. */
export declare function getSyncStatus(options?: RunOptions): Promise<SyncStatus>;
export {};
//# sourceMappingURL=cross-device-sync.d.ts.map