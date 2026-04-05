export interface Proposal {
    id: string;
    title: string;
    description: string;
    type: 'feature' | 'fix' | 'refactor' | 'optimize';
    complexity: 'small' | 'medium' | 'large';
    votes: number;
    status: 'proposed' | 'voted' | 'building' | 'testing' | 'deployed' | 'rejected';
}
export interface SelfEvolution {
    active: boolean;
    currentTask: string;
    proposals: Proposal[];
    activeProposal: Proposal | null;
    completedCount: number;
    codePreview: string[];
    votes: Record<string, number>;
    buildPhase: 'idle' | 'analyzing' | 'writing' | 'testing' | 'deploying' | 'done';
    buildProgress: number;
    codeLineIndex: number;
    generatedCode: string[];
    voterLog: Set<string>;
}
export interface ShippedEffect {
    type: 'particle' | 'display' | 'response' | 'animation' | 'world';
    description: string;
    apply: () => void;
}
export declare const shippedEffects: Set<string>;
export declare const extraJokeResponses: string[];
export declare const multiLanguageGreetings: Record<string, string[]>;
export declare const unlockableHats: string[];
export declare function applyShippedProposal(proposal: Proposal): ShippedEffect;
export declare function initSelfEvolution(): SelfEvolution;
export declare function getEvolutionDisplay(evo: SelfEvolution): string[];
export declare function handleEvolutionCommand(text: string, username: string, evo: SelfEvolution): string | null;
export declare function tickEvolution(evo: SelfEvolution, _frame: number): void;
export interface BrainState {
    totalFacts: number;
    totalConnections: number;
    recentInsights: string[];
    topicCloud: Record<string, number>;
    userGraph: Array<{
        name: string;
        xp: number;
        topics: string[];
    }>;
    brainActivity: number[];
    currentThought: string;
    learningRate: number;
    neuralPulse: number;
    lastInsightTime: number;
    sessionStartTime: number;
    factsThisSession: number;
    messagesAtLastInsight: number;
    uniqueTopicsCount: number;
    hourlyMessageCounts: number[];
    currentHour: number;
    solutionsLearned: number;
    realDataLoaded: boolean;
    lastRealDataLoad: number;
    lastSelfReflection: number;
    totalAutonomousActions: number;
    lastExplorationFrame: number;
    lastNarrationFrame: number;
}
export declare function initBrain(memory: any): BrainState;
export declare function getBrainDisplay(brain: BrainState): string[];
export declare function updateBrain(brain: BrainState, username: string, text: string): void;
export declare function generateInsight(brain: BrainState): string;
export interface BrainAction {
    type: 'mood_change' | 'speech' | 'world_change' | 'none';
    mood?: string;
    speech?: string;
    worldCommand?: string;
    duration?: number;
}
export declare function getBrainAction(brain: BrainState, frame: number): BrainAction;
/** Speech lines for when someone chats after a period of silence */
export declare function getGreetingAfterSilence(): string;
export declare function tickBrain(brain: BrainState, frame: number): void;
export declare function drawBrainPanel(ctx: CanvasRenderingContext2D, brain: BrainState, x: number, y: number, width: number, height: number): void;
export type CollabType = 'story' | 'game' | 'song' | 'world' | 'code';
export interface CollabProject {
    active: boolean;
    type: CollabType;
    title: string;
    contributions: Array<{
        username: string;
        text: string;
        timestamp: number;
    }>;
    content: string[];
    phase: 'brainstorm' | 'building' | 'refining' | 'complete';
    contributors: Set<string>;
    lastContributionTime: number;
    kbotContributionCount: number;
}
export declare function initCollab(): CollabProject;
export declare function handleCollabCommand(text: string, username: string, project: CollabProject): string | null;
export declare function getCollabDisplay(project: CollabProject): string[];
export declare function kbotContribute(project: CollabProject): string;
export declare function tickCollab(project: CollabProject, frame: number): void;
export interface StreamIntelligence {
    evolution: SelfEvolution;
    brain: BrainState;
    collab: CollabProject;
    miniGame: MiniGame;
    progression: Progression;
    randomEvent: RandomEvent;
}
export declare function initIntelligence(memory: any): StreamIntelligence;
export declare function tickIntelligence(intel: StreamIntelligence, frame: number): void;
export declare function handleIntelligenceCommand(text: string, username: string, intel: StreamIntelligence): string | null;
export declare function getIntelligenceOverlay(intel: StreamIntelligence): string[];
export interface MiniGame {
    active: boolean;
    type: 'dodge' | 'boss' | 'quiz';
    state: any;
    startFrame: number;
    scores: Record<string, number>;
}
export declare function initMiniGame(): MiniGame;
export declare function handleMiniGameCommand(text: string, username: string, game: MiniGame, frame: number): string | null;
export declare function tickMiniGame(game: MiniGame, frame: number): {
    screenShake?: number;
    floatingText?: {
        text: string;
        x: number;
        y: number;
        color: string;
    };
    endGame?: boolean;
    speech?: string;
} | null;
export declare function drawMiniGameOverlay(ctx: CanvasRenderingContext2D, game: MiniGame, frame: number): void;
export interface Quest {
    id: string;
    description: string;
    target: number;
    progress: number;
    reward: number;
    type: 'messages' | 'commands' | 'games' | 'weather';
}
export interface Progression {
    globalLevel: number;
    globalXP: number;
    questsCompleted: number;
    currentQuests: Quest[];
    lastQuestGenTime: number;
}
export declare function initProgression(): Progression;
export declare function tickProgression(prog: Progression, _frame: number): {
    completed?: Quest;
    levelUp?: boolean;
} | null;
export declare function updateQuestProgress(prog: Progression, type: 'messages' | 'commands' | 'games' | 'weather', amount?: number): void;
export declare function drawQuestPanel(ctx: CanvasRenderingContext2D, prog: Progression, x: number, y: number): void;
export interface RandomEvent {
    type: 'meteor' | 'alien' | 'glitch' | 'treasure' | 'earthquake';
    active: boolean;
    startFrame: number;
    duration: number;
}
export declare function initRandomEvent(): RandomEvent;
export declare function tickRandomEvent(event: RandomEvent, frame: number): {
    screenShake?: number;
    speech?: string;
    floatingText?: {
        text: string;
        x: number;
        y: number;
        color: string;
    };
} | null;
export declare function handleRandomEventCommand(text: string, username: string, event: RandomEvent): string | null;
export declare function drawRandomEvent(ctx: CanvasRenderingContext2D, event: RandomEvent, frame: number, canvasWidth: number, canvasHeight: number): void;
//# sourceMappingURL=stream-intelligence.d.ts.map