import type { CanvasRenderingContext2D } from 'canvas';
export declare function drawRobot(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, mood: string, frame: number, moodColor?: [number, number, number], weather?: 'clear' | 'rain' | 'snow' | 'storm' | 'stars', isWalking?: boolean, walkPhase?: number): void;
/**
 * Draw a stocky gorilla/monkey pixel art character (32x32 grid).
 * Drop-in replacement for drawRobot() with the same signature.
 *
 * @param ctx       - Canvas 2D rendering context
 * @param x         - Top-left X position in canvas pixels
 * @param y         - Top-left Y position in canvas pixels
 * @param scale     - Pixel scale multiplier (4-10 recommended)
 * @param mood      - Current mood: idle, talking, thinking, excited, dancing, walking
 * @param frame     - Animation frame counter (incrementing integer)
 * @param moodColor - Optional RGB override for mood accent color
 */
export declare function drawGorilla(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, mood: string, frame: number, moodColor?: [number, number, number]): void;
/**
 * Draw animated mood particles around the gorilla.
 * Same interface as drawMoodParticles but tuned for gorilla position/shape.
 */
export declare function drawGorillaParticles(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, mood: string, frame: number): void;
/**
 * Draw animated mood particles around the robot.
 *
 * @param ctx   - Canvas 2D rendering context
 * @param x     - Robot top-left X (same as drawRobot)
 * @param y     - Robot top-left Y (same as drawRobot)
 * @param scale - Pixel scale (same as drawRobot)
 * @param mood  - Current mood
 * @param frame - Animation frame counter
 */
export declare function drawMoodParticles(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, mood: string, frame: number): void;
export type HatType = 'none' | 'crown' | 'antenna' | 'sunglasses' | 'tophat' | 'hardhat' | 'party';
/**
 * Draw a hat on top of the robot's head.
 * Call AFTER drawRobot() so it layers on top.
 */
export declare function drawHat(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, hat: HatType, frame: number): void;
export type PetType = 'drone' | 'cat' | 'ghost' | 'orb';
export interface PetState {
    type: PetType;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    frame: number;
    mood: string;
}
/**
 * Draw a pet companion sprite (8x8 pixel art).
 * Call AFTER drawRobot() and drawHat().
 */
export declare function drawPet(ctx: CanvasRenderingContext2D, pet: PetState, scale: number, frame: number): void;
export type BuddySpeciesType = 'fox' | 'owl' | 'cat' | 'robot' | 'ghost' | 'mushroom' | 'octopus' | 'dragon';
/**
 * Draw a buddy companion sprite (12x12 pixel art, scaled).
 * Called AFTER drawPet() in the render loop.
 */
export declare function drawBuddyCompanion(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, species: string, mood: string, frame: number): void;
//# sourceMappingURL=sprite-engine.d.ts.map