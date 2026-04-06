export interface Highlight {
    timestamp: number;
    absoluteTime: string;
    type: string;
    description: string;
    chatRate: number;
}
export interface RecordingInfo {
    recording: boolean;
    filePath: string | null;
    startedAt: string | null;
    durationSec: number;
    fileSizeMB: number;
    resolution: string;
    highlights: number;
}
export interface RecordingResult {
    filePath: string;
    durationSec: number;
    fileSizeMB: number;
    highlights: Highlight[];
}
export interface TimelineEvent {
    timeSec: number;
    type: 'chat' | 'highlight' | 'viewer_count' | 'marker';
    data: Record<string, unknown>;
}
export interface StreamTimeline {
    date: string;
    durationSec: number;
    events: TimelineEvent[];
    highlights: Highlight[];
    peakChatRate: number;
    totalMessages: number;
}
export declare class StreamVOD {
    private process;
    private state;
    constructor();
    startRecording(inputPipe?: string): void;
    stopRecording(): RecordingResult;
    isRecording(): boolean;
    getRecordingInfo(): RecordingInfo;
    addHighlight(type: string, description: string): void;
    getHighlights(): Highlight[];
    /** Feed chat messages for spike detection */
    onChatMessage(username?: string): void;
    /** Auto-detect highlights from stream events */
    onStreamEvent(event: string, detail?: string): void;
    clip(startSec: number, endSec: number, name?: string): Promise<string>;
    clipHighlight(index: number): Promise<string>;
    generateTimeline(): StreamTimeline;
    uploadToYouTube(filePath: string, title: string, description: string): Promise<string>;
    saveState(): void;
    loadState(): void;
    private _chatRate;
    private _persistHighlights;
}
export declare function registerStreamVODTools(): void;
//# sourceMappingURL=stream-vod.d.ts.map