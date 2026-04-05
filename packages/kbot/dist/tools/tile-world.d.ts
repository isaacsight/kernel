import type { CanvasRenderingContext2D } from 'canvas';
export declare const TILE_SIZE = 16;
export declare const CHUNK_WIDTH = 36;
export declare const CHUNK_HEIGHT = 26;
export declare const WORLD_HEIGHT = 40;
export type BlockType = 'air' | 'grass' | 'dirt' | 'stone' | 'sand' | 'water' | 'wood' | 'leaves' | 'ore_iron' | 'ore_gold' | 'ore_diamond' | 'lava' | 'snow' | 'ice' | 'brick' | 'glass';
export interface Chunk {
    x: number;
    tiles: BlockType[][];
    generated: boolean;
    modified: boolean;
}
export interface TileWorld {
    chunks: Map<number, Chunk>;
    cameraX: number;
    surfaceLevel: number;
    seed: number;
    timeOfDay: 'day' | 'night' | 'sunset' | 'dawn';
    weather: string;
}
/** Generate a chunk at the given chunk X index */
export declare function generateChunk(world: TileWorld, chunkX: number): Chunk;
/** Initialize a fresh tile world */
export declare function initTileWorld(seed?: number): TileWorld;
/** Save world to disk (only modified chunks to keep file small) */
export declare function saveWorld(world: TileWorld): void;
/** Load world from disk, returns null if no save exists */
export declare function loadWorld(): TileWorld | null;
/** Update camera to follow the robot with smooth lerp */
export declare function updateCamera(world: TileWorld, robotWorldX: number, panelWidth?: number): void;
/** Convert world pixel X to tile X (absolute) */
export declare function worldXToTile(worldPixelX: number): number;
/** Convert tile X to world pixel X */
export declare function tileToWorldX(tileX: number): number;
/** Render the visible tile world */
export declare function renderTileWorld(ctx: CanvasRenderingContext2D, world: TileWorld, panelX: number, panelY: number, panelWidth: number, panelHeight: number, robotWorldX: number, frame: number): void;
/** Parse and handle tile world chat commands. Returns response string or null if not a tile command. */
export declare function handleTileCommand(text: string, username: string, world: TileWorld, robotWorldPixelX: number): string | null;
export declare function registerTileWorldTools(): void;
//# sourceMappingURL=tile-world.d.ts.map