import type { CanvasRenderingContext2D } from 'canvas';
export interface Light {
    x: number;
    y: number;
    radius: number;
    color: string;
    intensity: number;
    flicker?: boolean;
}
/**
 * Render dynamic lighting over the scene.
 * First draws a dark ambient overlay, then additively blends each light source.
 */
export declare function renderLighting(ctx: CanvasRenderingContext2D, lights: Light[], width: number, height: number, ambientLight: number): void;
/**
 * Get ambient light level for a given time of day.
 */
export declare function getAmbientForTime(timeOfDay: string): number;
/**
 * Build default light sources for the kbot stream character.
 */
export declare function buildCharacterLights(robotX: number, robotY: number, scale: number, moodColor: string, frame: number, hasLightning: boolean, worldItems?: Array<{
    x: number;
    y: number;
    emoji: string;
    name: string;
}>): Light[];
export interface BloomSpot {
    x: number;
    y: number;
    radius: number;
    color: string;
}
/**
 * Render soft glowing halos around bright elements.
 */
export declare function renderBloom(ctx: CanvasRenderingContext2D, brightSpots: BloomSpot[]): void;
/**
 * Build default bloom spots for the kbot character.
 */
export declare function buildCharacterBloom(robotX: number, robotY: number, scale: number, moodColor: string, frame: number): BloomSpot[];
export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    color: string;
    type: 'spark' | 'fire' | 'magic' | 'electricity' | 'trail' | 'smoke' | 'aura';
    trail?: Array<{
        x: number;
        y: number;
    }>;
    gravity?: number;
    cx?: number;
    cy?: number;
    orbitRadius?: number;
    orbitPhase?: number;
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    midpoints?: Array<{
        x: number;
        y: number;
    }>;
    lastMidpointFrame?: number;
    pulsePhase?: number;
}
/**
 * Create particles of a given type at a position.
 */
export declare function createParticleEmitter(type: Particle['type'], x: number, y: number, count: number): Particle[];
/**
 * Tick all particles: apply physics, age, return survivors.
 */
export declare function tickParticles(particles: Particle[]): Particle[];
/**
 * Render all particles to the canvas.
 */
export declare function renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void;
/**
 * Render a full procedural sky based on time of day, weather, and frame.
 */
export declare function renderSky(ctx: CanvasRenderingContext2D, width: number, height: number, timeOfDay: string, weather: string, frame: number, dividerX?: number): void;
export interface ParallaxLayer {
    type: 'far' | 'mid' | 'near';
    factor: number;
    draw: (ctx: CanvasRenderingContext2D, offsetX: number, frame: number) => void;
}
/**
 * Build parallax layers for a given biome.
 */
export declare function buildParallaxLayers(biome: string, dividerX: number): ParallaxLayer[];
/**
 * Render parallax layers relative to robot position.
 */
export declare function renderParallaxLayers(ctx: CanvasRenderingContext2D, layers: ParallaxLayer[], robotX: number, frame: number): void;
export interface GrowingPlant {
    x: number;
    y: number;
    type: 'tree' | 'flower' | 'mushroom' | 'crystal';
    growthStage: number;
    maxHeight: number;
    color: string;
}
/**
 * Tick and render growing vegetation.
 */
export declare function tickGrowingPlants(plants: GrowingPlant[]): void;
export declare function renderGrowingPlants(ctx: CanvasRenderingContext2D, plants: GrowingPlant[]): void;
/**
 * Render animated water with multiple sine waves, reflections, and foam.
 */
export declare function renderAnimatedWater(ctx: CanvasRenderingContext2D, dividerX: number, frame: number): void;
/**
 * Render lava with organic flow patterns and popping bubbles.
 */
export declare function renderLavaFlow(ctx: CanvasRenderingContext2D, dividerX: number, frame: number): void;
/**
 * Draw AAA character effects: eye glow bleed, power-up aura, walk trail, etc.
 */
export declare function drawCharacterEffects(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, mood: string, frame: number, isExecutingTool: boolean, walkSpeed: number, moodColor: string): void;
/**
 * Track mood changes and return chromatic aberration offset if transitioning.
 * Returns {active, framesLeft} — caller draws character 3x with RGB offsets.
 */
export declare function checkMoodTransition(mood: string, moodColor: string): {
    active: boolean;
    framesLeft: number;
};
/**
 * Trigger a white damage flash for 2 frames.
 */
export declare function triggerDamageFlash(): void;
/**
 * Render damage flash overlay on the character.
 * Returns true if flash is active (caller should skip normal character rendering logic).
 */
export declare function renderDamageFlash(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): boolean;
export interface PostProcessOptions {
    bloom: boolean;
    filmGrain: boolean;
    vignette: boolean;
    scanlines: boolean;
    focusPulse?: {
        x: number;
        y: number;
        radius: number;
    };
}
/**
 * Apply screen-space post-processing effects.
 */
export declare function renderPostProcessing(ctx: CanvasRenderingContext2D, width: number, height: number, frame: number, options: PostProcessOptions): void;
//# sourceMappingURL=render-engine.d.ts.map