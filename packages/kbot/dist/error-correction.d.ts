export declare enum ErrorType {
    hallucination = "hallucination",
    wrong_tool = "wrong_tool",
    stale_context = "stale_context",
    incomplete = "incomplete",
    off_topic = "off_topic",
    syntax_error = "syntax_error",
    logic_error = "logic_error"
}
export interface CorrectionStrategy {
    errorType: ErrorType;
    description: string;
    correctionPrompt: string;
    severity: number;
}
export interface ClassificationResult {
    errorType: ErrorType;
    confidence: number;
    evidence: string;
}
export interface CorrectionRecord {
    errorType: ErrorType;
    confidence: number;
    evidence: string;
    correctionApplied: string;
    attempt: number;
}
export interface ErrorCorrectionResult {
    response: string;
    corrections: CorrectionRecord[];
    retries: number;
}
export declare const CORRECTION_STRATEGIES: Record<ErrorType, CorrectionStrategy>;
export declare function classifyError(query: string, response: string, context?: string): Promise<ClassificationResult | null>;
export declare function applyCorrection(query: string, response: string, errorType: ErrorType, evidence: string): string;
export declare function withErrorCorrection(generateFn: (injectedPrompt?: string) => Promise<string>, query: string, context?: string, maxRetries?: number): Promise<ErrorCorrectionResult>;
//# sourceMappingURL=error-correction.d.ts.map