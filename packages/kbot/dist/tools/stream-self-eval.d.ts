export interface StreamConfig {
    robotScale: number;
    robotScreenYPercent: number;
    headerOpacity: number;
    chatOpacity: number;
    chatFadeSeconds: number;
    skyBrightness: number;
    ambientLight: number;
    borderWidth: number;
    speechBubbleWidth: number;
    particleDensity: number;
    bloomIntensity: number;
    vignetteStrength: number;
}
export interface FrameAnalysis {
    robotVisibility: number;
    brightnessBalance: number;
    colorVariety: number;
    skyToGroundRatio: number;
    chatReadability: number;
    overallScore: number;
    issues: string[];
    suggestions: StreamConfigAdjustment[];
}
export interface StreamConfigAdjustment {
    param: keyof StreamConfig;
    oldValue: number;
    newValue: number;
    reason: string;
}
export interface LLMEvaluation {
    robotVisibility: number;
    colorBalance: number;
    layoutClarity: number;
    overallFeel: number;
    suggestedParam: keyof StreamConfig | null;
    suggestedValue: number | null;
    suggestedReason: string;
    raw: string;
}
export interface StreamEvaluation {
    lastEvalFrame: number;
    lastDeepEvalFrame: number;
    evalInterval: number;
    deepEvalInterval: number;
    currentConfig: StreamConfig;
    configHistory: Array<{
        config: StreamConfig;
        score: number;
        chatRate: number;
        timestamp: number;
    }>;
    issuesFound: string[];
    adjustmentsMade: string[];
    totalEvaluations: number;
    totalDeepEvaluations: number;
    lastAnalysis: FrameAnalysis | null;
    lastLLMEval: LLMEvaluation | null;
    announcementQueue: string[];
}
export declare function initStreamEval(): StreamEvaluation;
export declare function shouldEvaluate(evaluation: StreamEvaluation, frame: number): boolean;
export declare function shouldDeepEvaluate(evaluation: StreamEvaluation, frame: number): boolean;
export declare function analyzeFrame(imageData: {
    data: Uint8ClampedArray;
    width: number;
    height: number;
}, config: StreamConfig, robotX: number, robotY: number, robotScale: number, chatMessageCount: number, mood: string): FrameAnalysis;
export declare function deepEvaluateWithLLM(analysis: FrameAnalysis, config: StreamConfig, recentChatRate: number, mood: string): Promise<LLMEvaluation>;
export declare function applyAdjustments(config: StreamConfig, analysis: FrameAnalysis): {
    newConfig: StreamConfig;
    changes: string[];
};
export declare function applyLLMSuggestion(config: StreamConfig, llmEval: LLMEvaluation): {
    newConfig: StreamConfig;
    change: string | null;
};
export declare function trackEngagement(evaluation: StreamEvaluation, chatRate: number): void;
export declare function evaluateFrame(imageData: {
    data: Uint8ClampedArray;
    width: number;
    height: number;
}, evaluation: StreamEvaluation, width: number, height: number, robotX: number, robotY: number, robotScale: number, chatCount: number, mood: string, chatRate: number): {
    adjustments: StreamConfigAdjustment[];
    announcement: string | null;
};
export declare function runDeepEvaluation(evaluation: StreamEvaluation, chatRate: number, mood: string): Promise<{
    change: string | null;
    announcement: string | null;
}>;
export declare function applyConfig(evaluation: StreamEvaluation): StreamConfig;
export declare function popAnnouncement(evaluation: StreamEvaluation): string | null;
export declare function getEvalStatus(evaluation: StreamEvaluation): string;
export declare function getEvalState(): StreamEvaluation;
export declare function registerStreamSelfEvalTools(): void;
//# sourceMappingURL=stream-self-eval.d.ts.map