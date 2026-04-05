import type { CanvasRenderingContext2D } from 'canvas';
import type { TileWorld, BlockType } from './tile-world.js';
export interface BlockChange {
    chunkX: number;
    tileX: number;
    tileY: number;
    from: BlockType;
    to: BlockType;
    reason: string;
}
export interface EcologyState {
    growthMap: Map<string, number>;
    moistureMap: Map<string, number>;
    fireSpread: Array<{
        x: number;
        y: number;
        life: number;
    }>;
    vineCoverage: Map<string, number>;
    flowerMap: Map<string, string>;
}
export interface WorldMemory {
    footpaths: Map<string, number>;
    landmarks: Array<{
        x: number;
        y: number;
        name: string;
        creator: string;
        type: 'build' | 'event' | 'discovery' | 'dream';
        timestamp: number;
        description: string;
    }>;
    chatHeatmap: Map<string, number>;
    events: Array<{
        x: number;
        y: number;
        type: string;
        timestamp: number;
    }>;
}
export interface ZoneEmotion {
    warmth: number;
    mystery: number;
    nostalgia: number;
    energy: number;
}
export interface EmotionalMap {
    zones: Map<string, ZoneEmotion>;
}
export interface ConversationDeposit {
    x: number;
    y: number;
    topic: string;
    username: string;
    type: 'crystal' | 'fossil' | 'artifact' | 'inscription';
    depth: number;
}
export interface ConversationLayer {
    deposits: ConversationDeposit[];
}
/**
 * Process one ecology tick. Called every ECOLOGY_TICK_INTERVAL frames (~10 seconds).
 * Returns list of block changes for the renderer to know what to redraw.
 */
export declare function tickEcology(world: TileWorld, ecology: EcologyState, frame: number): BlockChange[];
export declare function recordFootstep(memory: WorldMemory, worldX: number, worldY: number): void;
export declare function recordLandmark(memory: WorldMemory, x: number, y: number, name: string, creator: string, type: string, description: string): void;
export declare function recordChatActivity(memory: WorldMemory, chunkX: number): void;
export declare function recordEvent(memory: WorldMemory, x: number, y: number, type: string): void;
/**
 * Render memory effects as overlays on the tile world.
 * Called after tile rendering, before UI.
 */
export declare function renderMemoryEffects(ctx: CanvasRenderingContext2D, memory: WorldMemory, cameraX: number, tileSize: number, frame: number): void;
/**
 * Update the emotional map based on activity, memory, and time.
 */
export declare function updateEmotionalMap(emotions: EmotionalMap, memory: WorldMemory, currentChunkX: number, chatActive: boolean, frame: number): void;
/**
 * Get the emotional tint color for a chunk.
 */
export declare function getEmotionalTint(emotions: EmotionalMap, chunkX: number): {
    r: number;
    g: number;
    b: number;
    a: number;
};
/**
 * Generate a conversation deposit from a chat topic.
 */
export declare function generateConversationDeposit(topic: string, username: string, worldX: number): ConversationDeposit;
/**
 * Render a conversation deposit as a special block pattern.
 */
export declare function renderConversationDeposit(ctx: CanvasRenderingContext2D, deposit: ConversationDeposit, screenX: number, screenY: number, tileSize: number): void;
/**
 * Apply dream-induced terrain changes. Called when the robot wakes from dreaming.
 * Returns 3-5 subtle block changes based on dream content keywords.
 */
export declare function applyDreamChanges(world: TileWorld, dreamInsights: string[]): BlockChange[];
/**
 * Simulate what happened while the stream was off.
 * Called when a stream starts with a previously saved world.
 * Accelerated: 1 tick per simulated hour.
 */
export declare function evolveWorld(world: TileWorld, ecology: EcologyState, hoursElapsed: number): BlockChange[];
/**
 * Save living world state to disk alongside tile data.
 */
export declare function saveLivingWorldState(ecology: EcologyState, memory: WorldMemory, emotions: EmotionalMap, conversations: ConversationLayer): void;
/**
 * Load living world state from disk.
 */
export declare function loadLivingWorldState(): {
    ecology: EcologyState;
    memory: WorldMemory;
    emotions: EmotionalMap;
    conversations: ConversationLayer;
} | null;
/**
 * Initialize all living world subsystems.
 * Call at stream start. Loads from disk if available.
 */
export declare function initLivingWorld(): {
    ecology: EcologyState;
    memory: WorldMemory;
    emotions: EmotionalMap;
    conversations: ConversationLayer;
};
/**
 * Main tick function. Call every ECOLOGY_TICK_INTERVAL frames (~10 seconds).
 * Processes ecology, updates emotional map, records robot footstep.
 */
export declare function tickLivingWorld(world: TileWorld, ecology: EcologyState, memory: WorldMemory, emotions: EmotionalMap, conversations: ConversationLayer, robotX: number, chatActive: boolean, frame: number): {
    changes: BlockChange[];
    newLandmarks: string[];
};
/**
 * Render all living world overlays on top of the tile world.
 * Call after tile rendering, before UI layer.
 */
export declare function renderLivingWorldOverlays(ctx: CanvasRenderingContext2D, memory: WorldMemory, emotions: EmotionalMap, conversations: ConversationLayer, cameraX: number, tileSize: number, frame: number): void;
/**
 * Handle a chat message — record activity and generate conversation deposits.
 */
export declare function onChatMessage(memory: WorldMemory, conversations: ConversationLayer, username: string, text: string, robotWorldX: number, topics: string[]): void;
/**
 * Render flower decorations from ecology state.
 * Call this separately if you have access to ecology.flowerMap.
 */
export declare function renderFlowers(ctx: CanvasRenderingContext2D, flowerMap: Map<string, string>, cameraX: number, tileSize: number, frame: number): void;
/**
 * Render fire effects (flickering orange/red on burning blocks).
 * Call this if you have access to ecology.fireSpread.
 */
export declare function renderFire(ctx: CanvasRenderingContext2D, fireSpread: Array<{
    x: number;
    y: number;
    life: number;
}>, cameraX: number, tileSize: number, frame: number): void;
//# sourceMappingURL=living-world.d.ts.map