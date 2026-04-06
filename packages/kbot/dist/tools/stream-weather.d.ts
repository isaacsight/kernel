import type { CanvasRenderingContext2D } from 'canvas';
export type WeatherType = 'clear' | 'cloudy' | 'overcast' | 'light_rain' | 'heavy_rain' | 'thunderstorm' | 'snow' | 'blizzard' | 'fog' | 'aurora' | 'sandstorm' | 'meteor_shower';
export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'evening' | 'night';
export interface WeatherState {
    type: WeatherType;
    intensity: number;
    particles: WeatherParticle[];
    skyTint: string;
    ambientMod: number;
    soundKey: string;
    lightningTimer: number;
    lightningFlash: number;
}
interface WeatherParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    life: number;
    maxLife: number;
    alpha: number;
    color: string;
    type: 'drop' | 'flake' | 'fog' | 'bolt' | 'aurora' | 'meteor' | 'sand' | 'splash';
}
export declare class WeatherSystem {
    private syncRealTime;
    private cycleStart;
    private streamHour;
    private current;
    private target;
    private transitionProgress;
    private targetState;
    private weatherTimer;
    private weatherHistory;
    private chatActivityWindow;
    private chatDrivenWeather;
    private celestialAngle;
    constructor(syncRealTime?: boolean);
    tick(frame: number, chatActivity: number): void;
    render(ctx: CanvasRenderingContext2D, width: number, height: number): void;
    renderSky(ctx: CanvasRenderingContext2D, width: number, height: number): void;
    setWeather(type: WeatherType, immediate?: boolean): void;
    getTimeOfDay(): TimeOfDay;
    getAmbientLight(): number;
    getSkyColors(): {
        top: string;
        bottom: string;
    };
    getWeather(): WeatherState;
    /** Get character mood suggestion based on weather */
    getMoodSuggestion(): string;
    /** Handle chat commands like !weather rain */
    handleCommand(cmd: string, args: string): string;
    private updateTime;
    private getNextPhase;
    /** How far through the current phase we are (0-1) */
    private getPhaseProgress;
    private getStarVisibility;
    private buildWeatherState;
    private getActiveWeatherDef;
    private pickRandomWeather;
    private tickLightning;
    private spawnParticles;
    private createParticle;
    private tickParticles;
    private updateParticleList;
    private renderParticles;
    private drawParticle;
    private renderStars;
    private renderCelestialBodies;
    private renderAuroraBands;
    private renderClouds;
    private renderFogOverlay;
}
export declare function getWeatherSystem(syncRealTime?: boolean): WeatherSystem;
export declare function registerStreamWeatherTools(): void;
export {};
//# sourceMappingURL=stream-weather.d.ts.map