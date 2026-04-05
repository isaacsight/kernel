/**
 * rom-engine.ts — ROM-hack-inspired rendering engine
 *
 * Core rendering engine that brings SNES/GBA-era visual techniques to Canvas 2D:
 *   1. Indexed color palette system (256 entries, packed RGBA uint32)
 *   2. Palette cycling (Mark Ferrari technique — loop & pingpong modes)
 *   3. HDMA-style per-scanline sky gradient (night/day/sunset/dawn)
 *   4. Parallax layer system (4-5 layers per biome)
 *   5. Frame budget tracking with adaptive quality
 *
 * References:
 *   - SNES PPU: H-Blank DMA (HDMA) for per-scanline register writes
 *   - Mark Ferrari / CanvasCycle: palette rotation as animation primitive
 *   - GBA ROM hacks: HBlank parallax, hardware blending, 15-bit palettes
 */
export declare function packRGBA(r: number, g: number, b: number, a?: number): number;
export declare function unpackRGBA(packed: number): [number, number, number, number];
export interface RomPalette {
    colors: Uint32Array;
    base: Uint32Array;
}
export declare function createPalette(): RomPalette;
/** Reset palette to base colors */
export declare function resetPalette(palette: RomPalette): void;
export interface PaletteCycle {
    start: number;
    end: number;
    speed: number;
    direction: 1 | -1;
    mode: 'loop' | 'pingpong';
    accumulator: number;
    pingpongDir: 1 | -1;
}
export declare function createDefaultCycles(): PaletteCycle[];
export declare function tickPaletteCycles(palette: RomPalette, cycles: PaletteCycle[], deltaMs: number): boolean;
export interface HdmaEntry {
    r: number;
    g: number;
    b: number;
    fogDensity: number;
    scrollOffset: number;
}
export declare function buildHdmaTable(timeOfDay: string, _weather: string, height: number): HdmaEntry[];
export declare function renderHdmaSky(ctx: CanvasRenderingContext2D, hdma: HdmaEntry[], width: number): void;
export interface ParallaxLayer {
    canvas: OffscreenCanvas | null;
    imageData: ImageData | null;
    scrollFactor: number;
    yOffset: number;
    opacity: number;
    width: number;
    height: number;
    renderFn: ((ctx: CanvasRenderingContext2D, w: number, h: number) => void) | null;
}
export interface BiomeParallax {
    layers: ParallaxLayer[];
    biome: string;
}
export declare function buildBiomeParallax(biome: string, width: number, height: number): BiomeParallax;
export declare function renderParallax(ctx: CanvasRenderingContext2D, parallax: BiomeParallax, cameraX: number, _frame: number): void;
export interface FrameBudget {
    timings: number[];
    budget: number;
    overBudget: boolean;
    dropLevel: number;
}
export declare function createFrameBudget(budgetMs?: number): FrameBudget;
export declare function startFrameTiming(): number;
export declare function endFrameTiming(budget: FrameBudget, startTime: number): void;
export declare function shouldDropQuality(budget: FrameBudget): number;
export interface RomEngineState {
    palette: RomPalette;
    cycles: PaletteCycle[];
    hdmaTable: HdmaEntry[];
    parallax: BiomeParallax | null;
    frameBudget: FrameBudget;
    currentBiome: string;
    currentTimeOfDay: string;
}
export declare function initRomEngine(biome?: string, timeOfDay?: string): RomEngineState;
export declare function tickRomEngine(state: RomEngineState, deltaMs: number): void;
export declare function renderRomBackground(ctx: CanvasRenderingContext2D, state: RomEngineState, cameraX: number, frame: number, width: number, height: number): void;
/**
 * renderWaterSurface — Draws an animated water body using palette cycling colors.
 *
 * Draws horizontal strips where each strip uses a different palette index from
 * the water range (32-47). As tickPaletteCycles rotates indices 32-39 and 40-47,
 * the strips shift color — creating flowing water animation with ZERO new frames.
 *
 * The water surface includes sine-wave distortion for a ripple effect and
 * highlight bands at the top for specular reflection.
 */
export declare function renderWaterSurface(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, palette: RomPalette, frame: number): void;
/**
 * renderLavaPool — Draws animated lava using palette cycling + dithering.
 *
 * Uses palette range 64-79 (lava). The dithered checkerboard pattern makes
 * adjacent pixels use offset palette indices, so when the palette cycles in
 * pingpong mode the lava appears to bubble and pulse.
 */
export declare function renderLavaPool(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, palette: RomPalette, frame: number): void;
/**
 * renderCycledSky — Draws animated sky using palette range 112-127 during
 * sunset/dawn for color shifting. During day/night, renders a subtle gradient
 * overlay using the sky palette.
 *
 * The sky palette has 16 entries from deep blue to light horizon. During
 * sunset/dawn the cycling rotates these entries, creating a smooth color shift
 * across the sky height.
 */
export declare function renderCycledSky(ctx: CanvasRenderingContext2D, width: number, skyHeight: number, palette: RomPalette, timeOfDay: string): void;
/**
 * renderFireColumn — Draws animated fire using palette range 144-159.
 * Each column of the fire has a randomized height offset seeded by position,
 * and the palette cycling creates the flickering animation.
 */
export declare function renderFireColumn(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, palette: RomPalette, frame: number): void;
/**
 * renderPaletteCycledElement — Master dispatcher. Draws a named element type
 * at the given position using the palette-cycled colors.
 *
 * Element types: 'water', 'lava', 'fire', 'sky'
 */
export declare function renderPaletteCycledElement(ctx: CanvasRenderingContext2D, element: 'water' | 'lava' | 'fire' | 'sky', x: number, y: number, width: number, height: number, palette: RomPalette, frame: number, timeOfDay?: string): void;
/**
 * Render 6 test frames showing palette cycling for water, lava, fire, and sky.
 * Each frame advances the palette cycles by 100ms, demonstrating the animation.
 */
export declare function renderCycleTestFrames(outDir: string, prefix: string): Promise<string>;
//# sourceMappingURL=rom-engine.d.ts.map