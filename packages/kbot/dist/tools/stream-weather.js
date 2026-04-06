// kbot Stream Weather & Day/Night Cycle — Dynamic environment for the livestream
//
// Controls sky colors, weather particles, ambient lighting, and mood coupling.
// Imported by stream-renderer.ts. Canvas 2D rendering at 6fps.
//
// Tools: weather_set, weather_status, weather_forecast
import { registerTool } from './index.js';
// ─── Constants ────────────────────────────────────────────────────
const CYCLE_MINUTES = 24; // 24 real minutes = 24 stream hours
const MS_PER_STREAM_HOUR = (CYCLE_MINUTES * 60 * 1000) / 24;
const TRANSITION_FRAMES = 180; // 30 seconds at 6fps
const MIN_WEATHER_INTERVAL = 3600; // 10 min * 6fps
const MAX_WEATHER_INTERVAL = 10800; // 30 min * 6fps
const MAX_PARTICLES = 400;
/** Sky gradient per time-of-day phase */
const SKY_GRADIENTS = {
    dawn: { top: '#1a1040', bottom: '#c85a30' },
    morning: { top: '#2a4a7a', bottom: '#87b8d8' },
    noon: { top: '#1a6ab0', bottom: '#a0d4f0' },
    afternoon: { top: '#2a5a90', bottom: '#90c8e0' },
    dusk: { top: '#2a1848', bottom: '#d06838' },
    evening: { top: '#0e0e2a', bottom: '#30284a' },
    night: { top: '#050510', bottom: '#0a1628' },
};
/** Ambient light base level per phase (0-1) */
const AMBIENT_LEVELS = {
    dawn: 0.35,
    morning: 0.65,
    noon: 0.85,
    afternoon: 0.75,
    dusk: 0.45,
    evening: 0.25,
    night: 0.15,
};
/** Weather definitions */
const WEATHER_DEFS = {
    clear: { skyTint: '#00000000', ambientMod: 1.0, soundKey: 'ambient_calm', particleRate: 0, particleType: 'drop' },
    cloudy: { skyTint: '#40506080', ambientMod: 0.85, soundKey: 'ambient_wind', particleRate: 0, particleType: 'drop' },
    overcast: { skyTint: '#506070a0', ambientMod: 0.65, soundKey: 'ambient_wind', particleRate: 0, particleType: 'drop' },
    light_rain: { skyTint: '#30405060', ambientMod: 0.7, soundKey: 'rain_light', particleRate: 6, particleType: 'drop' },
    heavy_rain: { skyTint: '#20304080', ambientMod: 0.5, soundKey: 'rain_heavy', particleRate: 18, particleType: 'drop' },
    thunderstorm: { skyTint: '#101828c0', ambientMod: 0.3, soundKey: 'storm_thunder', particleRate: 22, particleType: 'drop' },
    snow: { skyTint: '#c0d0e040', ambientMod: 0.75, soundKey: 'ambient_snow', particleRate: 8, particleType: 'flake' },
    blizzard: { skyTint: '#a0b0c080', ambientMod: 0.4, soundKey: 'blizzard', particleRate: 25, particleType: 'flake' },
    fog: { skyTint: '#808880a0', ambientMod: 0.55, soundKey: 'ambient_fog', particleRate: 3, particleType: 'fog' },
    aurora: { skyTint: '#10203020', ambientMod: 0.2, soundKey: 'ambient_aurora', particleRate: 2, particleType: 'aurora' },
    sandstorm: { skyTint: '#80602080', ambientMod: 0.45, soundKey: 'sandstorm', particleRate: 20, particleType: 'sand' },
    meteor_shower: { skyTint: '#08081020', ambientMod: 0.18, soundKey: 'ambient_night', particleRate: 1, particleType: 'meteor' },
};
/** Chat activity thresholds for mood-weather coupling */
const ACTIVITY_STORM_THRESHOLD = 15; // messages per minute
const ACTIVITY_CALM_THRESHOLD = 2;
/** Star field (generated once) */
const STARS = [];
let starsGenerated = false;
function ensureStars(maxX, maxY) {
    if (starsGenerated)
        return;
    starsGenerated = true;
    for (let i = 0; i < 120; i++) {
        STARS.push({
            x: (((i * 97 + 31) * 7919) % 10000) / 10000 * maxX,
            y: (((i * 53 + 71) * 6271) % 10000) / 10000 * maxY,
            size: ((i * 13) % 3) + 1,
            brightness: 0.4 + ((i * 37) % 60) / 100,
            phase: (i * 0.73) % (Math.PI * 2),
        });
    }
}
// ─── Utility ──────────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
    const h = hex.startsWith('#') ? hex.slice(1) : hex;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
function lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
}
function lerpColor(a, b, t) {
    const ha = a.startsWith('#') ? a.slice(1) : a;
    const hb = b.startsWith('#') ? b.slice(1) : b;
    const ra = parseInt(ha.slice(0, 2), 16), ga = parseInt(ha.slice(2, 4), 16), ba = parseInt(ha.slice(4, 6), 16);
    const rb = parseInt(hb.slice(0, 2), 16), gb = parseInt(hb.slice(2, 4), 16), bb = parseInt(hb.slice(4, 6), 16);
    const r = Math.round(lerp(ra, rb, t));
    const g = Math.round(lerp(ga, gb, t));
    const bl = Math.round(lerp(ba, bb, t));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}
function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}
// ─── WeatherSystem Class ──────────────────────────────────────────
export class WeatherSystem {
    syncRealTime;
    cycleStart; // epoch ms when cycle began
    streamHour; // 0-23.999
    // Current weather
    current;
    // Transition target
    target = null;
    transitionProgress = 0;
    targetState = null;
    // Auto weather change timer
    weatherTimer;
    weatherHistory = [];
    // Chat activity tracking
    chatActivityWindow = []; // timestamps of recent messages
    chatDrivenWeather = false;
    // Sun/moon angle (0-360)
    celestialAngle = 0;
    constructor(syncRealTime = false) {
        this.syncRealTime = syncRealTime;
        this.cycleStart = Date.now();
        this.streamHour = syncRealTime ? new Date().getHours() + new Date().getMinutes() / 60 : 0;
        this.current = this.buildWeatherState('clear');
        this.weatherTimer = Math.floor(randomBetween(MIN_WEATHER_INTERVAL, MAX_WEATHER_INTERVAL));
    }
    // ── Tick ─────────────────────────────────────────────────────
    tick(frame, chatActivity) {
        // Advance time
        this.updateTime();
        // Track chat activity
        const now = Date.now();
        this.chatActivityWindow.push(now);
        // Keep only last 60 seconds
        this.chatActivityWindow = this.chatActivityWindow.filter(t => now - t < 60_000);
        // Chat-driven weather influence
        const msgsPerMin = this.chatActivityWindow.length;
        if (!this.chatDrivenWeather) {
            if (msgsPerMin >= ACTIVITY_STORM_THRESHOLD && this.current.type === 'clear') {
                this.setWeather('thunderstorm');
                this.chatDrivenWeather = true;
                setTimeout(() => { this.chatDrivenWeather = false; }, 120_000);
            }
            else if (msgsPerMin <= ACTIVITY_CALM_THRESHOLD && this.current.type === 'thunderstorm') {
                this.setWeather('clear');
                this.chatDrivenWeather = true;
                setTimeout(() => { this.chatDrivenWeather = false; }, 120_000);
            }
        }
        // Weather transition blending
        if (this.target && this.targetState) {
            this.transitionProgress += 1 / TRANSITION_FRAMES;
            if (this.transitionProgress >= 1) {
                this.current = this.targetState;
                this.current.intensity = 1;
                this.target = null;
                this.targetState = null;
                this.transitionProgress = 0;
            }
            else {
                this.current.intensity = 1 - this.transitionProgress;
            }
        }
        // Auto weather change
        this.weatherTimer--;
        if (this.weatherTimer <= 0) {
            this.pickRandomWeather();
            this.weatherTimer = Math.floor(randomBetween(MIN_WEATHER_INTERVAL, MAX_WEATHER_INTERVAL));
        }
        // Update particles
        this.tickParticles(frame);
        // Spawn new particles
        this.spawnParticles(frame);
        // Lightning logic for thunderstorms
        if (this.current.type === 'thunderstorm' || (this.targetState?.type === 'thunderstorm')) {
            this.tickLightning();
        }
        // Celestial body angle
        this.celestialAngle = (this.streamHour / 24) * 360;
    }
    // ── Render ───────────────────────────────────────────────────
    render(ctx, width, height) {
        // Render particles on top of the scene
        this.renderParticles(ctx, width, height);
        // Lightning flash overlay
        if (this.current.lightningFlash > 0 || (this.targetState && this.targetState.lightningFlash > 0)) {
            const flashAlpha = Math.max(this.current.lightningFlash > 0 ? this.current.lightningFlash / 4 : 0, this.targetState?.lightningFlash ? this.targetState.lightningFlash / 4 : 0);
            ctx.save();
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.8, flashAlpha * 0.6)})`;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
        }
        // Fog overlay
        if (this.current.type === 'fog' || this.target === 'fog') {
            this.renderFogOverlay(ctx, width, height);
        }
        // Sandstorm tint overlay
        if (this.current.type === 'sandstorm' || this.target === 'sandstorm') {
            const alpha = this.current.type === 'sandstorm'
                ? 0.15 * this.current.intensity
                : 0.15 * this.transitionProgress;
            ctx.save();
            ctx.fillStyle = `rgba(160, 120, 60, ${alpha})`;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
        }
    }
    renderSky(ctx, width, height) {
        const tod = this.getTimeOfDay(), nextTod = this.getNextPhase(tod), pp = this.getPhaseProgress();
        const topColor = lerpColor(SKY_GRADIENTS[tod].top, SKY_GRADIENTS[nextTod].top, pp);
        const botColor = lerpColor(SKY_GRADIENTS[tod].bottom, SKY_GRADIENTS[nextTod].bottom, pp);
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, topColor);
        grad.addColorStop(1, botColor);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        // Weather sky tint
        const def = this.getActiveWeatherDef();
        if (def.skyTint !== '#00000000') {
            const tHex = def.skyTint.slice(0, 7);
            const tA = parseInt(def.skyTint.slice(7, 9) || 'ff', 16) / 255;
            const blA = this.target ? lerp(tA, parseInt(WEATHER_DEFS[this.target].skyTint.slice(7, 9) || 'ff', 16) / 255, this.transitionProgress) : tA;
            ctx.save();
            ctx.fillStyle = hexToRgba(tHex, blA * 0.6);
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
        }
        const sv = this.getStarVisibility();
        if (sv > 0) {
            ensureStars(width, height * 0.7);
            this.renderStars(ctx, width, height, sv);
        }
        this.renderCelestialBodies(ctx, width, height);
        if (this.current.type === 'aurora' || this.target === 'aurora')
            this.renderAuroraBands(ctx, width, height);
        const cw = this.current.type, tw = this.target;
        if (cw === 'cloudy' || cw === 'overcast' || tw === 'cloudy' || tw === 'overcast')
            this.renderClouds(ctx, width, height);
    }
    // ── Public Getters ───────────────────────────────────────────
    setWeather(type, immediate = false) {
        if (immediate) {
            this.current = this.buildWeatherState(type);
            this.current.intensity = 1;
            this.target = null;
            this.targetState = null;
            this.transitionProgress = 0;
        }
        else {
            this.target = type;
            this.targetState = this.buildWeatherState(type);
            this.transitionProgress = 0;
        }
        this.weatherHistory.push({ type, at: Date.now() });
    }
    getTimeOfDay() {
        const h = this.streamHour;
        if (h >= 5 && h < 7)
            return 'dawn';
        if (h >= 7 && h < 11)
            return 'morning';
        if (h >= 11 && h < 13)
            return 'noon';
        if (h >= 13 && h < 17)
            return 'afternoon';
        if (h >= 17 && h < 19)
            return 'dusk';
        if (h >= 19 && h < 22)
            return 'evening';
        return 'night';
    }
    getAmbientLight() {
        const tod = this.getTimeOfDay();
        const nextTod = this.getNextPhase(tod);
        const progress = this.getPhaseProgress();
        const baseAmbient = lerp(AMBIENT_LEVELS[tod], AMBIENT_LEVELS[nextTod], progress);
        // Weather modifier
        const def = this.getActiveWeatherDef();
        return Math.max(0, Math.min(1, baseAmbient * def.ambientMod));
    }
    getSkyColors() {
        const tod = this.getTimeOfDay();
        const nextTod = this.getNextPhase(tod);
        const progress = this.getPhaseProgress();
        return {
            top: lerpColor(SKY_GRADIENTS[tod].top, SKY_GRADIENTS[nextTod].top, progress),
            bottom: lerpColor(SKY_GRADIENTS[tod].bottom, SKY_GRADIENTS[nextTod].bottom, progress),
        };
    }
    getWeather() {
        return { ...this.current };
    }
    /** Get character mood suggestion based on weather */
    getMoodSuggestion() {
        switch (this.current.type) {
            case 'clear': return 'happy';
            case 'cloudy':
            case 'overcast': return 'idle';
            case 'light_rain': return 'thinking';
            case 'heavy_rain': return 'thinking';
            case 'thunderstorm': return 'excited';
            case 'snow': return 'happy';
            case 'blizzard': return 'error';
            case 'fog': return 'dreaming';
            case 'aurora': return 'dreaming';
            case 'sandstorm': return 'error';
            case 'meteor_shower': return 'excited';
            default: return 'idle';
        }
    }
    /** Handle chat commands like !weather rain */
    handleCommand(cmd, args) {
        const c = cmd.toLowerCase().trim();
        const a = args.toLowerCase().trim();
        if (c === '!weather' || c === 'weather') {
            if (!a || a === 'status') {
                const tod = this.getTimeOfDay();
                const h = Math.floor(this.streamHour);
                const m = Math.floor((this.streamHour % 1) * 60);
                return `Weather: ${this.current.type} | Time: ${tod} (${h}:${m.toString().padStart(2, '0')}) | Ambient: ${(this.getAmbientLight() * 100).toFixed(0)}% | Sound: ${this.current.soundKey}`;
            }
            const requested = a.replace(/\s+/g, '_');
            if (WEATHER_DEFS[requested]) {
                this.setWeather(requested);
                return `Weather changing to ${requested}... (30s transition)`;
            }
            // Fuzzy match
            const types = Object.keys(WEATHER_DEFS);
            const match = types.find(t => t.includes(a) || a.includes(t.replace('_', ' ')));
            if (match) {
                this.setWeather(match);
                return `Weather changing to ${match}... (30s transition)`;
            }
            return `Unknown weather type "${a}". Available: ${types.join(', ')}`;
        }
        if (c === '!time') {
            if (a === 'real' || a === 'sync') {
                this.syncRealTime = true;
                return 'Time synced to real local clock.';
            }
            if (a === 'fast' || a === 'cycle') {
                this.syncRealTime = false;
                this.cycleStart = Date.now();
                return 'Time set to 24-minute cycle mode.';
            }
            const hour = parseInt(a, 10);
            if (!isNaN(hour) && hour >= 0 && hour < 24) {
                this.syncRealTime = false;
                this.streamHour = hour;
                this.cycleStart = Date.now() - (hour * MS_PER_STREAM_HOUR);
                return `Time set to ${hour}:00.`;
            }
            return `Usage: !time <0-23|real|fast>`;
        }
        return '';
    }
    // ── Private: Time ────────────────────────────────────────────
    updateTime() {
        if (this.syncRealTime) {
            const now = new Date();
            this.streamHour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
        }
        else {
            const elapsed = Date.now() - this.cycleStart;
            this.streamHour = (elapsed / MS_PER_STREAM_HOUR) % 24;
        }
    }
    getNextPhase(current) {
        const order = ['dawn', 'morning', 'noon', 'afternoon', 'dusk', 'evening', 'night'];
        const idx = order.indexOf(current);
        return order[(idx + 1) % order.length];
    }
    /** How far through the current phase we are (0-1) */
    getPhaseProgress() {
        const h = this.streamHour;
        const ranges = [
            ['dawn', 5, 7], ['morning', 7, 11], ['noon', 11, 13],
            ['afternoon', 13, 17], ['dusk', 17, 19], ['evening', 19, 22], ['night', 22, 29],
        ];
        for (const [, start, end] of ranges) {
            const adjustedH = h < 5 ? h + 24 : h; // wrap night past midnight
            if (adjustedH >= start && adjustedH < end) {
                return (adjustedH - start) / (end - start);
            }
        }
        return 0;
    }
    getStarVisibility() {
        const h = this.streamHour;
        if (h >= 22 || h < 5)
            return 1.0;
        if (h >= 19 && h < 22)
            return (h - 19) / 3;
        if (h >= 5 && h < 7)
            return 1 - (h - 5) / 2;
        return 0;
    }
    // ── Private: Weather Logic ───────────────────────────────────
    buildWeatherState(type) {
        const def = WEATHER_DEFS[type];
        return {
            type,
            intensity: 1,
            particles: [],
            skyTint: def.skyTint,
            ambientMod: def.ambientMod,
            soundKey: def.soundKey,
            lightningTimer: type === 'thunderstorm' ? Math.floor(randomBetween(30, 90)) : -1,
            lightningFlash: 0,
        };
    }
    getActiveWeatherDef() {
        if (this.target && this.targetState) {
            const cur = WEATHER_DEFS[this.current.type];
            const tgt = WEATHER_DEFS[this.target];
            return {
                skyTint: tgt.skyTint,
                ambientMod: lerp(cur.ambientMod, tgt.ambientMod, this.transitionProgress),
                soundKey: this.transitionProgress > 0.5 ? tgt.soundKey : cur.soundKey,
                particleRate: Math.round(lerp(cur.particleRate, tgt.particleRate, this.transitionProgress)),
                particleType: this.transitionProgress > 0.5 ? tgt.particleType : cur.particleType,
            };
        }
        return WEATHER_DEFS[this.current.type];
    }
    pickRandomWeather() {
        const candidates = ['clear', 'cloudy', 'overcast', 'light_rain', 'heavy_rain',
            'thunderstorm', 'snow', 'fog', 'aurora', 'meteor_shower'];
        // Weight towards calmer weather, avoid repeating
        const recent = this.weatherHistory.slice(-3).map(h => h.type);
        const filtered = candidates.filter(c => !recent.includes(c));
        const pool = filtered.length > 0 ? filtered : candidates;
        // Calm bias: first 5 types are more likely
        const weighted = [];
        for (const w of pool) {
            const calmTypes = ['clear', 'cloudy', 'light_rain', 'snow', 'fog'];
            weighted.push(w);
            if (calmTypes.includes(w))
                weighted.push(w); // double weight for calm
        }
        const pick = weighted[Math.floor(Math.random() * weighted.length)];
        this.setWeather(pick);
    }
    // ── Private: Lightning ───────────────────────────────────────
    tickLightning() {
        // Tick active flash
        if (this.current.lightningFlash > 0) {
            this.current.lightningFlash--;
        }
        // Countdown to next strike
        if (this.current.lightningTimer > 0) {
            this.current.lightningTimer--;
        }
        else if (this.current.lightningTimer === 0) {
            this.current.lightningFlash = 3; // 0.5s flash at 6fps
            this.current.lightningTimer = Math.floor(randomBetween(18, 72)); // 3-12 seconds
        }
    }
    // ── Private: Particles ───────────────────────────────────────
    spawnParticles(frame) {
        const def = this.getActiveWeatherDef();
        const rate = def.particleRate;
        for (let i = 0; i < rate; i++) {
            if (this.current.particles.length >= MAX_PARTICLES)
                break;
            this.current.particles.push(this.createParticle(def.particleType, frame));
        }
        // Also spawn into target if transitioning
        if (this.targetState) {
            const tgtDef = WEATHER_DEFS[this.target];
            const tgtRate = Math.round(tgtDef.particleRate * this.transitionProgress);
            for (let i = 0; i < tgtRate; i++) {
                if (this.targetState.particles.length >= MAX_PARTICLES)
                    break;
                this.targetState.particles.push(this.createParticle(tgtDef.particleType, frame));
            }
        }
    }
    createParticle(type, _frame) {
        // Data-driven particle templates: [x, y, vx, vy, size, life, alpha, color]
        const W = 1280;
        const tpl = {
            drop: () => ({ x: Math.random() * W, y: -10, vx: randomBetween(-1, 1), vy: randomBetween(8, 16), size: randomBetween(1, 3), life: 200, maxLife: 200, alpha: randomBetween(0.3, 0.7), color: '#6688cc', type: 'drop' }),
            flake: () => ({ x: Math.random() * W, y: -10, vx: randomBetween(-2, 2), vy: randomBetween(1, 4), size: randomBetween(2, 5), life: 400, maxLife: 400, alpha: randomBetween(0.5, 0.9), color: '#e8e8f0', type: 'flake' }),
            fog: () => ({ x: Math.random() * W, y: randomBetween(200, 600), vx: randomBetween(0.2, 1), vy: randomBetween(-0.3, 0.3), size: randomBetween(80, 200), life: 300, maxLife: 300, alpha: randomBetween(0.03, 0.08), color: '#c0c8d0', type: 'fog' }),
            aurora: () => ({ x: randomBetween(50, 1230), y: randomBetween(40, 180), vx: randomBetween(-0.5, 0.5), vy: 0, size: randomBetween(100, 300), life: 600, maxLife: 600, alpha: randomBetween(0.05, 0.15), color: ['#40ff80', '#4080ff', '#a040ff', '#40ffc0'][Math.floor(Math.random() * 4)], type: 'aurora' }),
            meteor: () => ({ x: randomBetween(0, W), y: randomBetween(-20, 100), vx: randomBetween(6, 14), vy: randomBetween(4, 10), size: randomBetween(2, 4), life: 30, maxLife: 30, alpha: 1.0, color: '#ffe0a0', type: 'meteor' }),
            sand: () => ({ x: -10, y: randomBetween(100, 700), vx: randomBetween(8, 18), vy: randomBetween(-2, 2), size: randomBetween(1, 3), life: 150, maxLife: 150, alpha: randomBetween(0.3, 0.6), color: '#c09050', type: 'sand' }),
            splash: () => ({ x: Math.random() * W, y: 680, vx: randomBetween(-2, 2), vy: randomBetween(-3, -1), size: 2, life: 8, maxLife: 8, alpha: 0.5, color: '#6688cc', type: 'splash' }),
        };
        return (tpl[type] || tpl.drop)();
    }
    tickParticles(_frame) {
        // Update current particles
        this.current.particles = this.updateParticleList(this.current.particles);
        // Rain splash spawning at ground level
        if (this.current.type === 'heavy_rain' || this.current.type === 'thunderstorm') {
            const splashCount = this.current.type === 'thunderstorm' ? 3 : 1;
            for (let i = 0; i < splashCount; i++) {
                if (this.current.particles.length < MAX_PARTICLES && Math.random() < 0.3) {
                    this.current.particles.push(this.createParticle('splash', _frame));
                }
            }
        }
        // Update target particles during transition
        if (this.targetState) {
            this.targetState.particles = this.updateParticleList(this.targetState.particles);
        }
    }
    updateParticleList(particles) {
        const alive = [];
        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            // Snow drift
            if (p.type === 'flake') {
                p.vx += randomBetween(-0.3, 0.3);
                p.vx = Math.max(-3, Math.min(3, p.vx));
            }
            // Fog slow drift
            if (p.type === 'fog') {
                p.alpha = (p.life / p.maxLife) * 0.06;
            }
            // Aurora wave
            if (p.type === 'aurora') {
                p.y += Math.sin(p.life * 0.05) * 0.5;
            }
            if (p.life > 0 && p.x < 1400 && p.x > -220 && p.y < 750) {
                alive.push(p);
            }
        }
        return alive;
    }
    // ── Private: Rendering ───────────────────────────────────────
    renderParticles(ctx, width, height) {
        ctx.save();
        // Render current weather particles
        for (const p of this.current.particles) {
            this.drawParticle(ctx, p, this.current.intensity);
        }
        // Render target weather particles (during transition)
        if (this.targetState) {
            for (const p of this.targetState.particles) {
                this.drawParticle(ctx, p, this.transitionProgress);
            }
        }
        ctx.restore();
    }
    drawParticle(ctx, p, intensity) {
        const a = p.alpha * intensity;
        if (a <= 0)
            return;
        switch (p.type) {
            case 'drop':
                ctx.strokeStyle = `rgba(100,136,204,${a})`;
                ctx.lineWidth = p.size * 0.5;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - 1, p.y + p.size * 4);
                ctx.stroke();
                break;
            case 'flake':
                ctx.fillStyle = `rgba(232,232,240,${a})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'fog': {
                const fg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
                fg.addColorStop(0, `rgba(192,200,208,${a})`);
                fg.addColorStop(1, 'rgba(192,200,208,0)');
                ctx.fillStyle = fg;
                ctx.fillRect(p.x - p.size, p.y - p.size * 0.5, p.size * 2, p.size);
                break;
            }
            case 'aurora': {
                const [r, g, b] = [p.color.slice(1, 3), p.color.slice(3, 5), p.color.slice(5, 7)].map(h => parseInt(h, 16));
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const ag = ctx.createLinearGradient(p.x - p.size / 2, p.y, p.x + p.size / 2, p.y);
                ag.addColorStop(0, `rgba(${r},${g},${b},0)`);
                ag.addColorStop(0.3, `rgba(${r},${g},${b},${a})`);
                ag.addColorStop(0.7, `rgba(${r},${g},${b},${a})`);
                ag.addColorStop(1, `rgba(${r},${g},${b},0)`);
                ctx.fillStyle = ag;
                ctx.beginPath();
                const bH = 20 + Math.sin(p.life * 0.03) * 10;
                ctx.moveTo(p.x - p.size / 2, p.y);
                for (let i = 0; i <= 20; i++)
                    ctx.lineTo(p.x - p.size / 2 + (p.size / 20) * i, p.y + Math.sin(i * 0.5 + p.life * 0.04) * bH * 0.3);
                for (let i = 20; i >= 0; i--)
                    ctx.lineTo(p.x - p.size / 2 + (p.size / 20) * i, p.y + bH + Math.sin(i * 0.5 + p.life * 0.04 + 1) * bH * 0.3);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
                break;
            }
            case 'meteor': {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const mg = ctx.createLinearGradient(p.x, p.y, p.x - p.vx * 2, p.y - 20);
                mg.addColorStop(0, `rgba(255,224,160,${a})`);
                mg.addColorStop(1, 'rgba(255,200,100,0)');
                ctx.strokeStyle = mg;
                ctx.lineWidth = p.size;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2);
                ctx.stroke();
                ctx.fillStyle = `rgba(255,250,230,${a})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                break;
            }
            case 'sand':
                ctx.fillStyle = `rgba(192,144,80,${a})`;
                ctx.fillRect(p.x, p.y, p.size * 2, p.size);
                break;
            case 'splash': {
                const lr = p.life / p.maxLife;
                ctx.fillStyle = `rgba(100,136,204,${a * lr})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * (1 + (1 - lr) * 2), 0, Math.PI * 2);
                ctx.fill();
                break;
            }
        }
    }
    renderStars(ctx, width, height, visibility) {
        for (const star of STARS) {
            if (star.x > width || star.y > height * 0.7)
                continue;
            const pulse = star.brightness + Math.sin(Date.now() * 0.001 + star.phase) * 0.15;
            const alpha = Math.max(0.1, Math.min(1, pulse)) * visibility;
            ctx.fillStyle = `rgba(255, 255, ${220 + Math.floor(star.phase * 10) % 35}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    renderCelestialBodies(ctx, width, height) {
        const h = this.streamHour;
        const arcR = Math.min(width, height) * 0.4, cx = width * 0.4, cy = height * 0.6;
        // Sun (visible ~5:30-18:30)
        if (h >= 5.5 && h <= 18.5) {
            const angle = ((h - 6) / 12) * Math.PI;
            const sx = cx + Math.cos(angle - Math.PI) * arcR * 1.2;
            const sy = cy - Math.sin(angle) * arcR;
            const sa = h < 6 ? (h - 5.5) * 2 : h > 18 ? (18.5 - h) * 2 : 1;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 50);
            sg.addColorStop(0, `rgba(255,220,100,${0.4 * sa})`);
            sg.addColorStop(0.5, `rgba(255,180,60,${0.15 * sa})`);
            sg.addColorStop(1, 'rgba(255,160,40,0)');
            ctx.fillStyle = sg;
            ctx.fillRect(sx - 50, sy - 50, 100, 100);
            ctx.fillStyle = `rgba(255,230,140,${sa})`;
            ctx.beginPath();
            ctx.arc(sx, sy, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        // Moon (visible ~18:30-6:00)
        if (h >= 18.5 || h <= 6) {
            const angle = ((h - 18 + 24) % 24 / 12) * Math.PI;
            const mx = cx + Math.cos(angle - Math.PI) * arcR * 1.05;
            const my = cy - Math.sin(angle) * arcR * 0.88;
            const ma = h > 18.5 ? Math.min(1, (h - 18.5) * 2) : h < 5.5 ? 1 : Math.min(1, (6 - h) * 2);
            ctx.save();
            const corona = ctx.createRadialGradient(mx, my, 12, mx, my, 40);
            corona.addColorStop(0, `rgba(200,210,240,${0.12 * ma})`);
            corona.addColorStop(1, 'rgba(200,210,240,0)');
            ctx.fillStyle = corona;
            ctx.fillRect(mx - 40, my - 40, 80, 80);
            ctx.fillStyle = `rgba(200,208,224,${ma})`;
            ctx.beginPath();
            ctx.arc(mx, my, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(160,168,184,${ma * 0.7})`;
            for (const [dx, dy, r] of [[-4, -3, 3.5], [5, 4, 2.5], [-1, 6, 2]]) {
                ctx.beginPath();
                ctx.arc(mx + dx, my + dy, r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }
    renderAuroraBands(ctx, w, _h) {
        const i = this.current.type === 'aurora' ? this.current.intensity : this.transitionProgress;
        if (i <= 0)
            return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const ag = ctx.createLinearGradient(0, 40, 0, 200);
        ag.addColorStop(0, `rgba(64,255,128,${0.02 * i})`);
        ag.addColorStop(0.5, `rgba(64,128,255,${0.03 * i})`);
        ag.addColorStop(1, 'rgba(160,64,255,0)');
        ctx.fillStyle = ag;
        ctx.fillRect(0, 40, w, 160);
        ctx.restore();
    }
    renderClouds(ctx, width, _height) {
        const isOC = this.current.type === 'overcast' || this.target === 'overcast';
        const baseA = isOC ? 0.4 : 0.2;
        const int = (this.target === 'cloudy' || this.target === 'overcast') ? this.transitionProgress : this.current.intensity;
        const alpha = baseA * int;
        const drift = (Date.now() * 0.005) % (width + 200);
        ctx.save();
        for (const [off, y, rx, ry] of [[0, 80, 80, 25], [300, 110, 100, 30], [600, 70, 70, 20], [150, 140, 90, 28]]) {
            const cx = (drift + off) % (width + 200) - 100;
            const cg = ctx.createRadialGradient(cx, y, 0, cx, y, rx);
            cg.addColorStop(0, `rgba(180,190,200,${alpha})`);
            cg.addColorStop(1, 'rgba(180,190,200,0)');
            ctx.fillStyle = cg;
            ctx.beginPath();
            ctx.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
    renderFogOverlay(ctx, width, height) {
        const i = this.current.type === 'fog' ? this.current.intensity : this.transitionProgress;
        ctx.save();
        const fg = ctx.createLinearGradient(0, height * 0.3, 0, height);
        fg.addColorStop(0, 'rgba(160,170,180,0)');
        fg.addColorStop(0.5, `rgba(160,170,180,${0.08 * i})`);
        fg.addColorStop(1, `rgba(160,170,180,${0.2 * i})`);
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }
}
// ─── Singleton for tool access ────────────────────────────────────
let _instance = null;
export function getWeatherSystem(syncRealTime) {
    if (!_instance) {
        _instance = new WeatherSystem(syncRealTime);
    }
    return _instance;
}
// ─── Tool Registration ────────────────────────────────────────────
export function registerStreamWeatherTools() {
    registerTool({
        name: 'weather_set',
        description: 'Set the stream weather type. Transitions smoothly over 30 seconds unless immediate=true. Types: clear, cloudy, overcast, light_rain, heavy_rain, thunderstorm, snow, blizzard, fog, aurora, sandstorm, meteor_shower.',
        parameters: {
            type: { type: 'string', description: 'Weather type to set', required: true },
            immediate: { type: 'boolean', description: 'Skip transition and apply instantly (default: false)' },
        },
        tier: 'free',
        execute: async (args) => {
            const type = String(args.type || '').replace(/\s+/g, '_');
            if (!WEATHER_DEFS[type]) {
                return `Unknown weather type "${type}". Available: ${Object.keys(WEATHER_DEFS).join(', ')}`;
            }
            const ws = getWeatherSystem();
            ws.setWeather(type, args.immediate === true);
            return `Weather ${args.immediate ? 'set to' : 'transitioning to'} ${type}.`;
        },
    });
    registerTool({
        name: 'weather_status',
        description: 'Get current stream weather, time of day, ambient light level, and sky colors.',
        parameters: {},
        tier: 'free',
        execute: async () => {
            const ws = getWeatherSystem();
            const weather = ws.getWeather();
            const tod = ws.getTimeOfDay();
            const ambient = ws.getAmbientLight();
            const sky = ws.getSkyColors();
            const mood = ws.getMoodSuggestion();
            return [
                `Weather: ${weather.type} (intensity: ${weather.intensity.toFixed(2)})`,
                `Time of day: ${tod}`,
                `Ambient light: ${(ambient * 100).toFixed(0)}%`,
                `Sky: top=${sky.top}, bottom=${sky.bottom}`,
                `Sound: ${weather.soundKey}`,
                `Mood suggestion: ${mood}`,
                `Active particles: ${weather.particles.length}`,
            ].join('\n');
        },
    });
    registerTool({
        name: 'weather_forecast',
        description: 'Get the weather forecast — shows current weather history and upcoming phase transitions.',
        parameters: {},
        tier: 'free',
        execute: async () => {
            const ws = getWeatherSystem();
            const tod = ws.getTimeOfDay();
            const weather = ws.getWeather();
            const phases = ['dawn', 'morning', 'noon', 'afternoon', 'dusk', 'evening', 'night'];
            const currentIdx = phases.indexOf(tod);
            const upcoming = [];
            for (let i = 1; i <= 3; i++) {
                const next = phases[(currentIdx + i) % phases.length];
                upcoming.push(`  ${next}: ambient ${(AMBIENT_LEVELS[next] * 100).toFixed(0)}%`);
            }
            return [
                `=== Stream Weather Forecast ===`,
                `Current: ${weather.type} during ${tod}`,
                `Ambient: ${(ws.getAmbientLight() * 100).toFixed(0)}%`,
                ``,
                `Upcoming phases:`,
                ...upcoming,
                ``,
                `Weather changes automatically every 10-30 minutes.`,
                `Chat can vote: !weather <type>`,
            ].join('\n');
        },
    });
}
//# sourceMappingURL=stream-weather.js.map