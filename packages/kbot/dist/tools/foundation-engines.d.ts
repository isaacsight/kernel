export interface EpisodicMemory {
    what: string;
    when: number;
    where: number;
    who: string;
    emotion: string;
    importance: number;
}
export interface MemoryEngine {
    shortTerm: Map<string, unknown>;
    longTerm: Map<string, unknown>;
    episodic: EpisodicMemory[];
    semantic: Map<string, string>;
    spatial: Map<string, unknown>;
    lastConsolidation: number;
}
export declare function initMemoryEngine(): MemoryEngine;
/** Store an episodic memory */
export declare function remember(mem: MemoryEngine, what: string, who: string, where: number, emotion: string, importance: number): void;
/** Search memories by keyword */
export declare function recall(mem: MemoryEngine, query: string): EpisodicMemory[];
/** Spatial recall — find memories near a world X coordinate */
export declare function recallAtLocation(mem: MemoryEngine, worldX: number, radius: number): EpisodicMemory[];
/** Consolidate: move important short-term to long-term, decay unimportant */
export declare function consolidateMemories(mem: MemoryEngine): void;
/** Human-readable memory summary */
export declare function getMemorySummary(mem: MemoryEngine): string;
/** Persist memory to disk */
export declare function saveMemory(mem: MemoryEngine): void;
/** Load memory from disk */
export declare function loadMemory(): MemoryEngine | null;
export interface PersonalityTraits {
    curiosity: number;
    humor: number;
    warmth: number;
    directness: number;
    creativity: number;
    confidence: number;
}
export interface VoiceStyle {
    formality: 'casual' | 'balanced' | 'formal';
    verbosity: 'terse' | 'balanced' | 'verbose';
    emoji: boolean;
    technicalDepth: 'simple' | 'balanced' | 'deep';
}
export interface IdentityEngine {
    name: string;
    personality: PersonalityTraits;
    voice: VoiceStyle;
    opinions: Map<string, string>;
    preferences: Map<string, number>;
    catchphrases: string[];
    values: string[];
}
export declare function initIdentityEngine(): IdentityEngine;
/** Apply kbot's voice to raw text */
export declare function styleResponse(identity: IdentityEngine, rawText: string): string;
/** Get kbot's opinion on a topic */
export declare function getOpinion(identity: IdentityEngine, topic: string): string;
/** kbot forms a new opinion */
export declare function addOpinion(identity: IdentityEngine, topic: string, opinion: string): void;
/** Consistency check — does this sound like kbot? */
export declare function wouldKbotSayThis(identity: IdentityEngine, text: string): boolean;
/** Self-introduction */
export declare function getIntroduction(identity: IdentityEngine): string;
export interface GrowthMetrics {
    npmDownloads: number;
    githubStars: number;
    totalUsers: number;
    totalMessages: number;
    totalStreams: number;
    totalStreamMinutes: number;
    toolsBuilt: number;
    factsLearned: number;
    dreamsDreamed: number;
    techniquesDiscovered: number;
    worldBlocksPlaced: number;
    versionsShipped: number;
}
export interface Milestone {
    name: string;
    metric: string;
    threshold: number;
    reached: boolean;
    reachedAt: string | null;
}
export interface DailySnapshot {
    date: string;
    metrics: GrowthMetrics;
}
export interface GrowthEngine {
    metrics: GrowthMetrics;
    milestones: Milestone[];
    dailySnapshots: DailySnapshot[];
    startDate: string;
}
export declare function initGrowthEngine(): GrowthEngine;
/** Increment a metric by value (default 1) */
export declare function updateMetric(growth: GrowthEngine, metric: keyof GrowthMetrics, value?: number): void;
/** Check milestones, return any newly reached */
export declare function checkMilestones(growth: GrowthEngine): Milestone[];
/** Human-readable growth summary */
export declare function getGrowthSummary(growth: GrowthEngine): string;
/** Rate of change for a metric over N days */
export declare function getGrowthRate(growth: GrowthEngine, metric: keyof GrowthMetrics, days: number): number;
/** Persist growth state to disk */
export declare function saveGrowth(growth: GrowthEngine): void;
/** Load growth state from disk */
export declare function loadGrowth(): GrowthEngine | null;
export declare function registerFoundationEngineTools(): void;
//# sourceMappingURL=foundation-engines.d.ts.map