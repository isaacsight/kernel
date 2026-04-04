import { type ConversationTurn } from './memory.js';
export type MemorySignalKind = 'correction' | 'preference' | 'project_fact' | 'emotional';
export interface DetectedMemory {
    /** What kind of signal was detected */
    kind: MemorySignalKind;
    /** The extracted memory content to save */
    content: string;
    /** The key to use for memory_save */
    key: string;
    /** Category for memory_save (fact | preference | pattern | solution) */
    category: 'fact' | 'preference' | 'pattern' | 'solution';
    /** Confidence score (0-1) */
    confidence: number;
    /** Which turn triggered the detection */
    turnIndex: number;
    /** Timestamp of detection */
    detectedAt: string;
}
export interface ScannerStats {
    /** Whether the scanner is currently active */
    enabled: boolean;
    /** Total turns observed this session */
    turnsObserved: number;
    /** Total scans performed */
    scansPerformed: number;
    /** Total moments detected */
    momentsDetected: number;
    /** Total memories saved */
    memoriesSaved: number;
    /** Breakdown by kind */
    byKind: Record<MemorySignalKind, number>;
    /** Recent detections (last 10) */
    recentDetections: DetectedMemory[];
    /** Session start time */
    sessionStart: string;
}
interface ScannerState {
    /** Cumulative stats across sessions */
    totalScans: number;
    totalDetections: number;
    totalSaved: number;
    /** Last scan timestamp */
    lastScan: string | null;
    /** Per-kind cumulative counts */
    cumulativeByKind: Record<MemorySignalKind, number>;
}
/** Notify the scanner that a turn was added. Call after addTurn(). */
export declare function notifyTurn(turn: ConversationTurn, sessionId?: string): void;
/** Start the memory scanner for the current session */
export declare function startMemoryScanner(): void;
/** Stop the memory scanner and persist stats */
export declare function stopMemoryScanner(): void;
/** Get current scanner stats */
export declare function getMemoryScannerStats(): ScannerStats;
/** Check if the scanner is currently enabled */
export declare function isScannerEnabled(): boolean;
/** Get cumulative stats from disk (across all sessions) */
export declare function getCumulativeScannerStats(): ScannerState;
export {};
//# sourceMappingURL=memory-scanner.d.ts.map