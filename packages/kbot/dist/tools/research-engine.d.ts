/**
 * research-engine.ts — Autonomous Web Research Pipeline
 *
 * kbot discovers new techniques, knowledge, and information from the internet
 * using its own built-in browser. No Chrome, no Playwright — pure HTML.
 *
 * Architecture:
 *   1. Research Queue — tasks from evolution, brain, narrative, user, or autonomous
 *   2. Web Search — kbot_search via DuckDuckGo (built-in browser)
 *   3. Page Reading — kbot_browse for full content extraction
 *   4. Summarization — local Ollama (kernel:latest) for zero-cost summaries
 *   5. Result Storage — ~/.kbot/research-results.json (persists across sessions)
 *   6. Engine Integration — results tagged by applicable engine for routing
 *
 * Tools: research_queue, research_results, research_now
 *
 * Tick-based: tickResearch() called from the frame loop processes one task
 * per interval (default 3600 frames = ~10 min at 6 fps).
 */
export interface ResearchEngine {
    queue: ResearchTask[];
    completed: ResearchResult[];
    activeTask: ResearchTask | null;
    lastResearchFrame: number;
    researchInterval: number;
    topicsOfInterest: string[];
}
export interface ResearchTask {
    id: string;
    query: string;
    purpose: string;
    source: 'evolution' | 'brain' | 'narrative' | 'user' | 'autonomous';
    status: 'queued' | 'searching' | 'reading' | 'summarizing' | 'complete' | 'failed';
    startedAt: number;
}
export interface ResearchResult {
    taskId: string;
    query: string;
    summary: string;
    sources: string[];
    keyFindings: string[];
    applicableTo: string[];
    timestamp: number;
}
export interface ResearchAction {
    type: 'start_research' | 'search_complete' | 'read_complete' | 'summarize_complete' | 'failed';
    task: ResearchTask;
    result?: ResearchResult;
    speech?: string;
}
export declare function autonomousResearchTopics(): string[];
export declare function initResearchEngine(): ResearchEngine;
export declare function getResearchEngine(): ResearchEngine;
export declare function queueResearch(engine: ResearchEngine, query: string, purpose: string, source: ResearchTask['source']): ResearchTask;
export declare function getResearchForEngine(engine: ResearchEngine, engineName: string): ResearchResult[];
export declare function tickResearch(engine: ResearchEngine, frame: number): Promise<ResearchAction | null>;
export declare function registerResearchEngineTools(): void;
//# sourceMappingURL=research-engine.d.ts.map