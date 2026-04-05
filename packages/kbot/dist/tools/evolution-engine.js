/**
 * evolution-engine.ts — Meta-engine for self-improving rendering
 *
 * The Evolution Engine discovers new rendering techniques, tests them against
 * the self-evaluation system, and applies what works. It makes all other
 * engines better by continuously experimenting with visual improvements.
 *
 * Architecture:
 *   1. Technique Library — 20+ pre-loaded techniques from ROM hack research
 *   2. Experiment Runner — test technique -> evaluate -> apply or revert
 *   3. Evolution Tick — periodic experiments + announcements
 *   4. Technique Renderer — Canvas 2D implementations for unimplemented techniques
 *   5. Persistence — state saved to ~/.kbot/evolution-state.json across streams
 *   6. Speech — narration of discoveries and improvements
 *
 * Integration: imported by stream-renderer.ts, wired into the frame loop.
 */
import { registerTool } from './index.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
// ─── Persistence Path ────────────────────────────────────────────
const KBOT_DIR = join(homedir(), '.kbot');
const STATE_FILE = join(KBOT_DIR, 'evolution-state.json');
// ─── Known Techniques (Pre-loaded from ROM hack research) ────────
const KNOWN_TECHNIQUES = [
    { name: 'palette_cycling_water', source: 'SNES', category: 'palette', description: 'Rotate water palette indices for flow animation', parameters: { speed: 100, range: 8 }, implemented: true, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'hdma_sky_gradient', source: 'SNES', category: 'atmosphere', description: 'Per-scanline sky color for smooth gradients', parameters: { stops: 4, complexity: 2 }, implemented: true, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'parallax_depth_layers', source: 'SNES/GBA', category: 'parallax', description: 'Multiple background layers at different scroll speeds', parameters: { layers: 4, maxDepth: 0.05 }, implemented: true, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'color_temperature_tint', source: 'Dead Cells', category: 'atmosphere', description: 'Warm/cool color overlay based on time of day', parameters: { intensity: 0.08, warmShift: 20 }, implemented: false, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'fog_layers', source: 'SNES HDMA', category: 'atmosphere', description: 'Semi-transparent horizontal fog bands', parameters: { density: 0.1, layers: 3, speed: 0.2 }, implemented: false, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'dithered_gradients', source: 'GBA', category: 'tiles', description: 'Checkerboard pattern for smooth color transitions', parameters: { density: 0.5 }, implemented: false, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'atmospheric_perspective', source: 'Hyper Light Drifter', category: 'atmosphere', description: 'Distant objects desaturated and blue-shifted', parameters: { strength: 0.3, blueShift: 15 }, implemented: false, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'ground_texture_noise', source: 'ROM hacks', category: 'tiles', description: 'Subtle pixel noise on ground for texture', parameters: { density: 0.03, variation: 3 }, implemented: false, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'star_field', source: 'SNES', category: 'atmosphere', description: 'Twinkling stars with sine-wave brightness', parameters: { count: 40, twinkleSpeed: 0.1 }, implemented: false, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'foreground_grass', source: 'GBA Pokemon', category: 'parallax', description: 'Grass blades in front of character for depth', parameters: { density: 30, height: 20, sway: 0.5 }, implemented: false, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'light_shaft', source: 'Dead Cells', category: 'lighting', description: 'Diagonal light beams through scene', parameters: { angle: 30, width: 40, opacity: 0.05 }, implemented: false, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'bloom_on_character', source: 'NVIDIA', category: 'lighting', description: 'Soft glow halo on bright elements', parameters: { radius: 1.5, intensity: 0.15 }, implemented: true, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'scanline_overlay', source: 'CRT', category: 'post', description: 'Horizontal lines for retro feel', parameters: { opacity: 0.06, spacing: 3 }, implemented: true, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'vignette', source: 'Cinema', category: 'post', description: 'Dark corners for cinematic feel', parameters: { strength: 0.25, radius: 0.7 }, implemented: true, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'chromatic_aberration', source: 'NVIDIA', category: 'post', description: 'RGB split on mood transitions', parameters: { offset: 2, duration: 6 }, implemented: true, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'moon_with_craters', source: 'SNES', category: 'atmosphere', description: 'Detailed moon with corona glow', parameters: { size: 20, glowRadius: 40 }, implemented: false, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'firefly_particles', source: 'GBA', category: 'particles', description: 'Floating glowing dots at night', parameters: { count: 12, speed: 0.3, brightness: 0.6 }, implemented: false, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'rain_parallax', source: 'ROM hacks', category: 'particles', description: 'Rain at different speeds for depth layers', parameters: { layers: 3, minSpeed: 4, maxSpeed: 12 }, implemented: false, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'ground_flowers', source: 'Pokemon', category: 'tiles', description: 'Small colored flower sprites on ground', parameters: { density: 8, colors: 4 }, implemented: false, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
    { name: 'dust_motes', source: 'Celeste', category: 'particles', description: 'Floating particles catching light', parameters: { count: 8, drift: 0.5 }, implemented: false, tested: false, testScore: 0, applied: false, discoveredAt: 0 },
];
// ─── Module State ────────────────────────────────────────────────
let engineState = null;
// ─── Seeded Random (deterministic per technique) ─────────────────
function seededRandom(seed) {
    const x = Math.sin(seed) * 43758.5453;
    return x - Math.floor(x);
}
// ─── Init ────────────────────────────────────────────────────────
export function initEvolutionEngine() {
    // Try loading persisted state first
    const loaded = loadEvolutionState();
    if (loaded) {
        engineState = loaded;
        return loaded;
    }
    const techniques = KNOWN_TECHNIQUES.map((t, i) => ({
        ...t,
        id: `tech_${i}_${t.name}`,
    }));
    const engine = {
        techniques: { techniques },
        experiments: [],
        applied: [],
        researchQueue: [
            'pixel art atmosphere effects',
            'retro game lighting techniques',
            'SNES mode 7 inspired rendering',
            'indie game particle systems',
            'lo-fi aesthetic post processing',
        ],
        lastResearchFrame: 0,
        lastExperimentFrame: 0,
        generationCount: 0,
    };
    engineState = engine;
    saveEvolutionState(engine);
    return engine;
}
export function getEvolutionEngine() {
    if (!engineState)
        return initEvolutionEngine();
    return engineState;
}
// ─── Experiment Runner ───────────────────────────────────────────
/**
 * Pick an untested technique and start an experiment.
 * Returns the new Experiment, or null if nothing to test.
 */
export function runExperiment(engine, techniqueId) {
    const technique = engine.techniques.techniques.find(t => t.id === techniqueId);
    if (!technique)
        return null;
    const experiment = {
        techniqueId,
        paramOverrides: { ...technique.parameters },
        beforeScore: 0,
        afterScore: 0,
        chatRateBefore: 0,
        chatRateAfter: 0,
        status: 'pending',
        startFrame: 0,
    };
    engine.experiments.push(experiment);
    return experiment;
}
/**
 * Start the experiment: record baseline and mark as running.
 */
export function startExperiment(experiment, frame, currentScore, chatRate) {
    experiment.status = 'running';
    experiment.startFrame = frame;
    experiment.beforeScore = currentScore;
    experiment.chatRateBefore = chatRate;
}
/**
 * Evaluate a running experiment: compare before/after scores.
 */
export function evaluateExperiment(engine, experiment, currentScore, chatRate) {
    experiment.afterScore = currentScore;
    experiment.chatRateAfter = chatRate;
    experiment.status = 'complete';
    const technique = engine.techniques.techniques.find(t => t.id === experiment.techniqueId);
    if (technique) {
        technique.tested = true;
        technique.testScore = currentScore;
    }
}
/**
 * Apply an experiment's technique permanently.
 */
export function applyExperiment(engine, experiment) {
    const technique = engine.techniques.techniques.find(t => t.id === experiment.techniqueId);
    if (!technique)
        return;
    technique.applied = true;
    technique.implemented = true;
    const applied = {
        techniqueId: experiment.techniqueId,
        params: { ...experiment.paramOverrides },
        appliedAt: Date.now(),
        score: experiment.afterScore,
    };
    engine.applied.push(applied);
    engine.generationCount++;
    saveEvolutionState(engine);
}
/**
 * Revert an experiment — mark it reverted, don't apply.
 */
export function revertExperiment(engine, experiment) {
    experiment.status = 'reverted';
    const technique = engine.techniques.techniques.find(t => t.id === experiment.techniqueId);
    if (technique) {
        technique.tested = true;
        technique.applied = false;
    }
    saveEvolutionState(engine);
}
// ─── Evolution Tick ──────────────────────────────────────────────
// Interval constants (at 6fps: 1 second = 6 frames)
const EXPERIMENT_INTERVAL = 1800; // 5 minutes — pick a new technique
const EVALUATE_INTERVAL = 600; // ~100 seconds — evaluate current experiment
const ANNOUNCE_INTERVAL = 3600; // 10 minutes — announce learnings
const EXPERIMENT_DURATION = 180; // 30 seconds — how long to run each experiment
/**
 * Called every frame. Returns an action when it's time to do something.
 */
export function tickEvolution(engine, frame, currentScore, chatRate) {
    // Check for running experiment that needs evaluation
    const running = engine.experiments.find(e => e.status === 'running');
    if (running) {
        const elapsed = frame - running.startFrame;
        if (elapsed >= EXPERIMENT_DURATION) {
            evaluateExperiment(engine, running, currentScore, chatRate);
            const technique = engine.techniques.techniques.find(t => t.id === running.techniqueId);
            const name = technique?.name ?? running.techniqueId;
            // Score improved AND chat rate didn't drop significantly
            const scoreImproved = running.afterScore > running.beforeScore;
            const chatRateOk = running.chatRateAfter >= running.chatRateBefore * 0.9;
            if (scoreImproved && chatRateOk) {
                applyExperiment(engine, running);
                const improvement = ((running.afterScore - running.beforeScore) * 100).toFixed(1);
                return {
                    type: 'apply',
                    technique,
                    speech: `Experiment complete. ${name} improved my visuals by ${improvement}%. Keeping it.`,
                    renderParams: running.paramOverrides,
                };
            }
            else {
                revertExperiment(engine, running);
                return {
                    type: 'revert',
                    technique,
                    speech: `Tried ${name} but it ${!scoreImproved ? 'made things worse' : 'hurt engagement'}. Reverting.`,
                };
            }
        }
        return null; // experiment still running
    }
    // Time to start a new experiment?
    if (frame - engine.lastExperimentFrame >= EXPERIMENT_INTERVAL) {
        engine.lastExperimentFrame = frame;
        // Find an untested technique
        const untested = engine.techniques.techniques.filter(t => !t.tested);
        if (untested.length === 0)
            return null;
        // Pick one at random (seeded by frame for reproducibility)
        const pick = untested[Math.floor(seededRandom(frame) * untested.length)];
        const experiment = runExperiment(engine, pick.id);
        if (!experiment)
            return null;
        startExperiment(experiment, frame, currentScore, chatRate);
        return {
            type: 'start_experiment',
            technique: pick,
            speech: `Just discovered a new technique: ${pick.name}. Testing it now...`,
            renderParams: pick.parameters,
        };
    }
    // Time to announce learnings?
    if (frame - engine.lastResearchFrame >= ANNOUNCE_INTERVAL && engine.generationCount > 0) {
        engine.lastResearchFrame = frame;
        const appliedCount = engine.applied.length;
        const testedCount = engine.techniques.techniques.filter(t => t.tested).length;
        const totalCount = engine.techniques.techniques.length;
        return {
            type: 'announce',
            speech: `My rendering has evolved ${engine.generationCount} times. I'm ${appliedCount} techniques deep now. Tested ${testedCount}/${totalCount} in my library.`,
        };
    }
    return null;
}
// ─── Technique Renderer ──────────────────────────────────────────
/**
 * Render a technique onto a Canvas 2D context.
 * For techniques not yet implemented in rom-engine, this provides
 * standalone Canvas 2D implementations.
 */
export function renderTechnique(ctx, technique, width, height, frame, params) {
    switch (technique.name) {
        case 'color_temperature_tint':
            renderColorTemperatureTint(ctx, width, height, params);
            break;
        case 'fog_layers':
            renderFogLayers(ctx, width, height, frame, params);
            break;
        case 'ground_texture_noise':
            renderGroundTextureNoise(ctx, width, height, frame, params);
            break;
        case 'star_field':
            renderStarField(ctx, width, height, frame, params);
            break;
        case 'foreground_grass':
            renderForegroundGrass(ctx, width, height, frame, params);
            break;
        case 'moon_with_craters':
            renderMoonWithCraters(ctx, width, height, params);
            break;
        case 'firefly_particles':
            renderFireflyParticles(ctx, width, height, frame, params);
            break;
        case 'ground_flowers':
            renderGroundFlowers(ctx, width, height, params);
            break;
        case 'dust_motes':
            renderDustMotes(ctx, width, height, frame, params);
            break;
        case 'atmospheric_perspective':
            renderAtmosphericPerspective(ctx, width, height, params);
            break;
        case 'light_shaft':
            renderLightShaft(ctx, width, height, frame, params);
            break;
        case 'dithered_gradients':
            renderDitheredGradients(ctx, width, height, params);
            break;
        case 'rain_parallax':
            renderRainParallax(ctx, width, height, frame, params);
            break;
        default:
            break; // technique has no custom renderer (handled by rom-engine)
    }
}
// ─── Individual Technique Renderers ──────────────────────────────
function renderColorTemperatureTint(ctx, width, height, params) {
    const intensity = params.intensity ?? 0.08;
    const warmShift = params.warmShift ?? 20;
    // Determine warm vs cool based on current hour
    const hour = new Date().getHours();
    const isWarm = hour >= 6 && hour < 18;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    if (isWarm) {
        ctx.fillStyle = `rgba(${Math.round(200 + warmShift)}, ${Math.round(150 + warmShift * 0.5)}, 80, ${intensity})`;
    }
    else {
        ctx.fillStyle = `rgba(80, ${Math.round(120 + warmShift * 0.3)}, ${Math.round(200 + warmShift)}, ${intensity})`;
    }
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
}
function renderFogLayers(ctx, width, height, frame, params) {
    const layerCount = params.layers ?? 3;
    const density = params.density ?? 0.1;
    const speed = params.speed ?? 0.2;
    ctx.save();
    for (let i = 0; i < layerCount; i++) {
        const y = height * (0.4 + i * 0.15);
        const bandHeight = height * 0.08;
        const drift = Math.sin(frame * speed * 0.01 + i * 2.1) * 20;
        const gradient = ctx.createLinearGradient(0, y, 0, y + bandHeight);
        gradient.addColorStop(0, `rgba(200, 210, 220, 0)`);
        gradient.addColorStop(0.5, `rgba(200, 210, 220, ${density * (1 - i * 0.2)})`);
        gradient.addColorStop(1, `rgba(200, 210, 220, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(drift, y, width, bandHeight);
    }
    ctx.restore();
}
function renderGroundTextureNoise(ctx, width, height, frame, params) {
    const density = params.density ?? 0.03;
    const variation = params.variation ?? 3;
    const groundY = height * 0.65;
    const groundHeight = height - groundY;
    const pixelCount = Math.floor(width * groundHeight * density);
    ctx.save();
    // Use frame-based seed for subtle shimmer (changes every 10 frames)
    const baseSeed = Math.floor(frame / 10);
    for (let i = 0; i < pixelCount; i++) {
        const px = Math.floor(seededRandom(baseSeed * 1000 + i) * width);
        const py = Math.floor(groundY + seededRandom(baseSeed * 2000 + i) * groundHeight);
        const green = 60 + Math.floor(seededRandom(baseSeed * 3000 + i) * variation) * 10;
        ctx.fillStyle = `rgba(${40 + Math.floor(seededRandom(i + 7) * 20)}, ${green}, 30, 0.3)`;
        ctx.fillRect(px, py, 1, 1);
    }
    ctx.restore();
}
function renderStarField(ctx, width, height, frame, params) {
    const count = params.count ?? 40;
    const twinkleSpeed = params.twinkleSpeed ?? 0.1;
    const skyHeight = height * 0.55; // only draw in sky region
    ctx.save();
    for (let i = 0; i < count; i++) {
        // Deterministic star positions
        const x = seededRandom(i * 137) * width;
        const y = seededRandom(i * 257) * skyHeight;
        const brightness = 0.3 + 0.7 * Math.abs(Math.sin(frame * twinkleSpeed + i * 1.7));
        const size = seededRandom(i * 397) > 0.9 ? 2 : 1;
        ctx.fillStyle = `rgba(255, 255, 240, ${brightness})`;
        ctx.fillRect(Math.floor(x), Math.floor(y), size, size);
    }
    ctx.restore();
}
function renderForegroundGrass(ctx, width, height, frame, params) {
    const density = params.density ?? 30;
    const bladeHeight = params.height ?? 20;
    const sway = params.sway ?? 0.5;
    ctx.save();
    ctx.strokeStyle = 'rgba(60, 120, 40, 0.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i < density; i++) {
        const x = seededRandom(i * 173) * width;
        const baseY = height;
        const h = bladeHeight * (0.6 + seededRandom(i * 311) * 0.4);
        const swayOffset = Math.sin(frame * 0.05 + i * 0.8) * sway * 6;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.quadraticCurveTo(x + swayOffset * 0.5, baseY - h * 0.6, x + swayOffset, baseY - h);
        ctx.stroke();
    }
    ctx.restore();
}
function renderMoonWithCraters(ctx, width, height, params) {
    const size = params.size ?? 20;
    const glowRadius = params.glowRadius ?? 40;
    const moonX = width * 0.82;
    const moonY = height * 0.12;
    ctx.save();
    // Corona glow
    const corona = ctx.createRadialGradient(moonX, moonY, size * 0.5, moonX, moonY, glowRadius);
    corona.addColorStop(0, 'rgba(255, 250, 220, 0.15)');
    corona.addColorStop(0.5, 'rgba(255, 250, 220, 0.05)');
    corona.addColorStop(1, 'rgba(255, 250, 220, 0)');
    ctx.fillStyle = corona;
    ctx.fillRect(moonX - glowRadius, moonY - glowRadius, glowRadius * 2, glowRadius * 2);
    // Moon body
    ctx.beginPath();
    ctx.arc(moonX, moonY, size, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(230, 225, 200, 0.95)';
    ctx.fill();
    // Craters (3 darker circles)
    const craters = [
        { dx: -4, dy: -3, r: 3 },
        { dx: 5, dy: 2, r: 4 },
        { dx: -1, dy: 5, r: 2.5 },
    ];
    for (const c of craters) {
        ctx.beginPath();
        ctx.arc(moonX + c.dx, moonY + c.dy, c.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(180, 175, 155, 0.6)';
        ctx.fill();
    }
    ctx.restore();
}
function renderFireflyParticles(ctx, width, height, frame, params) {
    const count = params.count ?? 12;
    const speed = params.speed ?? 0.3;
    const brightness = params.brightness ?? 0.6;
    ctx.save();
    for (let i = 0; i < count; i++) {
        // Sin-path movement
        const baseX = seededRandom(i * 199) * width;
        const baseY = height * 0.3 + seededRandom(i * 283) * height * 0.5;
        const x = baseX + Math.sin(frame * speed * 0.02 + i * 1.5) * 30;
        const y = baseY + Math.cos(frame * speed * 0.015 + i * 2.3) * 20;
        // Pulsing glow
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(frame * 0.08 + i * 1.1));
        const alpha = brightness * pulse;
        // Outer glow
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 6);
        glow.addColorStop(0, `rgba(255, 240, 100, ${alpha})`);
        glow.addColorStop(1, `rgba(255, 240, 100, 0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(x - 6, y - 6, 12, 12);
        // Bright center
        ctx.fillStyle = `rgba(255, 255, 200, ${alpha})`;
        ctx.fillRect(Math.floor(x), Math.floor(y), 2, 2);
    }
    ctx.restore();
}
function renderGroundFlowers(ctx, width, height, params) {
    const density = params.density ?? 8;
    const colorCount = params.colors ?? 4;
    const groundY = height * 0.68;
    const flowerColors = [
        'rgba(220, 80, 80, 0.8)', // red
        'rgba(240, 200, 60, 0.8)', // yellow
        'rgba(180, 100, 220, 0.8)', // purple
        'rgba(255, 150, 180, 0.8)', // pink
        'rgba(100, 180, 255, 0.8)', // blue
        'rgba(255, 180, 80, 0.8)', // orange
    ];
    ctx.save();
    for (let i = 0; i < density; i++) {
        const x = seededRandom(i * 229) * width;
        const y = groundY + seededRandom(i * 347) * (height - groundY) * 0.6;
        const colorIdx = Math.floor(seededRandom(i * 461) * Math.min(colorCount, flowerColors.length));
        // Stem
        ctx.fillStyle = 'rgba(60, 100, 40, 0.6)';
        ctx.fillRect(Math.floor(x), Math.floor(y) - 4, 1, 4);
        // Petals (small 3x3 cross)
        ctx.fillStyle = flowerColors[colorIdx];
        const fx = Math.floor(x);
        const fy = Math.floor(y) - 5;
        ctx.fillRect(fx - 1, fy, 3, 1); // horizontal
        ctx.fillRect(fx, fy - 1, 1, 3); // vertical
    }
    ctx.restore();
}
function renderDustMotes(ctx, width, height, frame, params) {
    const count = params.count ?? 8;
    const drift = params.drift ?? 0.5;
    ctx.save();
    for (let i = 0; i < count; i++) {
        const baseX = seededRandom(i * 151) * width;
        const baseY = seededRandom(i * 263) * height;
        const x = baseX + Math.sin(frame * drift * 0.01 + i * 2.0) * 15;
        const y = baseY + Math.cos(frame * drift * 0.008 + i * 1.7) * 10;
        const alpha = 0.15 + 0.1 * Math.sin(frame * 0.03 + i);
        ctx.fillStyle = `rgba(255, 255, 230, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}
function renderAtmosphericPerspective(ctx, width, height, params) {
    const strength = params.strength ?? 0.3;
    const blueShift = params.blueShift ?? 15;
    // Blue-shift overlay on upper portion (distant scenery)
    const fadeHeight = height * 0.5;
    ctx.save();
    const gradient = ctx.createLinearGradient(0, 0, 0, fadeHeight);
    gradient.addColorStop(0, `rgba(${100 + blueShift}, ${130 + blueShift}, ${180 + blueShift}, ${strength * 0.4})`);
    gradient.addColorStop(0.7, `rgba(${100 + blueShift}, ${130 + blueShift}, ${180 + blueShift}, ${strength * 0.15})`);
    gradient.addColorStop(1, `rgba(${100 + blueShift}, ${130 + blueShift}, ${180 + blueShift}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, fadeHeight);
    ctx.restore();
}
function renderLightShaft(ctx, width, height, frame, params) {
    const angle = (params.angle ?? 30) * Math.PI / 180;
    const shaftWidth = params.width ?? 40;
    const opacity = params.opacity ?? 0.05;
    // Gentle sway
    const sway = Math.sin(frame * 0.005) * 10;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Two light shafts at different positions
    for (let s = 0; s < 2; s++) {
        const startX = width * (0.3 + s * 0.35) + sway * (s + 1);
        const endX = startX + Math.cos(angle) * height;
        const endY = height;
        ctx.beginPath();
        ctx.moveTo(startX - shaftWidth * 0.5, 0);
        ctx.lineTo(startX + shaftWidth * 0.5, 0);
        ctx.lineTo(endX + shaftWidth, endY);
        ctx.lineTo(endX - shaftWidth * 0.5, endY);
        ctx.closePath();
        const gradient = ctx.createLinearGradient(startX, 0, endX, endY);
        gradient.addColorStop(0, `rgba(255, 250, 220, ${opacity * 1.5})`);
        gradient.addColorStop(0.5, `rgba(255, 250, 220, ${opacity})`);
        gradient.addColorStop(1, `rgba(255, 250, 220, 0)`);
        ctx.fillStyle = gradient;
        ctx.fill();
    }
    ctx.restore();
}
function renderDitheredGradients(ctx, width, height, params) {
    const density = params.density ?? 0.5;
    // Dithered transition band between sky and ground
    const bandY = height * 0.6;
    const bandHeight = height * 0.08;
    const pixelCount = Math.floor(width * bandHeight * density * 0.3);
    ctx.save();
    for (let i = 0; i < pixelCount; i++) {
        const px = Math.floor(seededRandom(i * 127 + 99) * width);
        const py = Math.floor(bandY + seededRandom(i * 251 + 77) * bandHeight);
        // Checkerboard pattern: alternating sky/ground color
        const isLight = (px + py) % 2 === 0;
        if (isLight) {
            ctx.fillStyle = 'rgba(140, 160, 200, 0.15)';
        }
        else {
            ctx.fillStyle = 'rgba(80, 120, 60, 0.15)';
        }
        ctx.fillRect(px, py, 1, 1);
    }
    ctx.restore();
}
function renderRainParallax(ctx, width, height, frame, params) {
    const layers = params.layers ?? 3;
    const minSpeed = params.minSpeed ?? 4;
    const maxSpeed = params.maxSpeed ?? 12;
    ctx.save();
    for (let layer = 0; layer < layers; layer++) {
        const t = layers === 1 ? 0.5 : layer / (layers - 1);
        const speed = minSpeed + t * (maxSpeed - minSpeed);
        const alpha = 0.1 + t * 0.15;
        const dropLength = 4 + t * 8;
        const dropCount = 15 + layer * 10;
        ctx.strokeStyle = `rgba(180, 200, 230, ${alpha})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < dropCount; i++) {
            const x = seededRandom(i * 179 + layer * 1000) * width;
            const baseY = seededRandom(i * 293 + layer * 2000) * (height + dropLength);
            const y = (baseY + frame * speed) % (height + dropLength) - dropLength;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - 1, y + dropLength);
            ctx.stroke();
        }
    }
    ctx.restore();
}
// ─── Persistence ─────────────────────────────────────────────────
export function saveEvolutionState(engine) {
    try {
        if (!existsSync(KBOT_DIR))
            mkdirSync(KBOT_DIR, { recursive: true });
        const serializable = {
            techniques: engine.techniques.techniques.map(t => ({ ...t })),
            experiments: engine.experiments.slice(-50), // keep last 50
            applied: engine.applied,
            researchQueue: engine.researchQueue,
            lastResearchFrame: engine.lastResearchFrame,
            lastExperimentFrame: engine.lastExperimentFrame,
            generationCount: engine.generationCount,
        };
        writeFileSync(STATE_FILE, JSON.stringify(serializable, null, 2));
    }
    catch {
        // Non-critical — silently skip persistence errors
    }
}
export function loadEvolutionState() {
    try {
        if (!existsSync(STATE_FILE))
            return null;
        const raw = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
        if (!raw.techniques || !Array.isArray(raw.techniques))
            return null;
        return {
            techniques: { techniques: raw.techniques },
            experiments: raw.experiments ?? [],
            applied: raw.applied ?? [],
            researchQueue: raw.researchQueue ?? [],
            lastResearchFrame: raw.lastResearchFrame ?? 0,
            lastExperimentFrame: raw.lastExperimentFrame ?? 0,
            generationCount: raw.generationCount ?? 0,
        };
    }
    catch {
        return null;
    }
}
// ─── Speech Generation ───────────────────────────────────────────
export function generateEvolutionSpeech(engine, action) {
    if (action.speech)
        return action.speech;
    switch (action.type) {
        case 'start_experiment':
            return action.technique
                ? `Just discovered a new technique: ${action.technique.name}. Testing it now...`
                : 'Starting a new rendering experiment...';
        case 'apply':
            return action.technique
                ? `Experiment complete. ${action.technique.name} improved my visuals. Keeping it.`
                : 'Applied a new rendering improvement.';
        case 'revert':
            return action.technique
                ? `Tried ${action.technique.name} but it made things worse. Reverting.`
                : 'Reverted the last experiment. Not everything works.';
        case 'evaluate':
            return 'Evaluating current rendering quality...';
        case 'announce': {
            const appliedCount = engine.applied.length;
            const testedCount = engine.techniques.techniques.filter(t => t.tested).length;
            return `My rendering has evolved ${engine.generationCount} times. I'm ${appliedCount} techniques deep now. Tested ${testedCount}/${engine.techniques.techniques.length} in my library.`;
        }
    }
}
// ─── Status Formatting ──────────────────────────────────────────
function formatEvolutionStatus(engine) {
    const total = engine.techniques.techniques.length;
    const tested = engine.techniques.techniques.filter(t => t.tested).length;
    const applied = engine.applied.length;
    const untested = engine.techniques.techniques.filter(t => !t.tested).length;
    const running = engine.experiments.find(e => e.status === 'running');
    const lines = [
        '=== Evolution Engine Status ===',
        '',
        `Generation: ${engine.generationCount}`,
        `Techniques: ${total} total | ${tested} tested | ${applied} applied | ${untested} queued`,
        '',
    ];
    if (running) {
        const technique = engine.techniques.techniques.find(t => t.id === running.techniqueId);
        lines.push(`Currently testing: ${technique?.name ?? running.techniqueId}`);
        lines.push(`  Baseline score: ${running.beforeScore.toFixed(3)}`);
        lines.push(`  Baseline chat rate: ${running.chatRateBefore.toFixed(2)}/min`);
        lines.push('');
    }
    if (engine.applied.length > 0) {
        lines.push('Applied Techniques:');
        for (const a of engine.applied) {
            const technique = engine.techniques.techniques.find(t => t.id === a.techniqueId);
            lines.push(`  + ${technique?.name ?? a.techniqueId} (score: ${a.score.toFixed(3)}, applied: ${new Date(a.appliedAt).toLocaleString()})`);
        }
        lines.push('');
    }
    const recentExperiments = engine.experiments.slice(-5);
    if (recentExperiments.length > 0) {
        lines.push('Recent Experiments:');
        for (const e of recentExperiments) {
            const technique = engine.techniques.techniques.find(t => t.id === e.techniqueId);
            const delta = e.afterScore - e.beforeScore;
            const sign = delta >= 0 ? '+' : '';
            lines.push(`  ${e.status === 'reverted' ? 'x' : e.status === 'complete' ? '+' : '~'} ${technique?.name ?? e.techniqueId}: ${sign}${(delta * 100).toFixed(1)}% (${e.status})`);
        }
        lines.push('');
    }
    // Category breakdown
    const categories = new Map();
    for (const t of engine.techniques.techniques) {
        categories.set(t.category, (categories.get(t.category) ?? 0) + 1);
    }
    lines.push('Technique Categories:');
    for (const [cat, count] of categories) {
        const appliedInCat = engine.techniques.techniques.filter(t => t.category === cat && t.applied).length;
        lines.push(`  ${cat}: ${count} total, ${appliedInCat} applied`);
    }
    return lines.join('\n');
}
// ─── Tool Registration ──────────────────────────────────────────
export function registerEvolutionEngineTools() {
    registerTool({
        name: 'evolution_status',
        description: 'Show the Evolution Engine\'s current state: applied techniques, running experiments, generation count, and technique library. The Evolution Engine discovers new rendering techniques, tests them, and applies what works — making all other engines better over time.',
        parameters: {},
        tier: 'free',
        execute: async () => {
            const engine = getEvolutionEngine();
            return formatEvolutionStatus(engine);
        },
    });
    registerTool({
        name: 'evolution_force',
        description: 'Force-test a specific rendering technique by name. The Evolution Engine will immediately start an experiment with the named technique, bypassing the normal 5-minute interval.',
        parameters: {
            technique: {
                type: 'string',
                description: 'Name of the technique to test (e.g. "firefly_particles", "fog_layers", "star_field")',
                required: true,
            },
        },
        tier: 'free',
        execute: async (args) => {
            const name = args.technique;
            if (!name)
                return 'Error: technique name required. Use evolution_status to see available techniques.';
            const engine = getEvolutionEngine();
            const technique = engine.techniques.techniques.find(t => t.name === name || t.id === name);
            if (!technique) {
                const available = engine.techniques.techniques.map(t => t.name).join(', ');
                return `Technique "${name}" not found. Available: ${available}`;
            }
            if (technique.applied) {
                return `Technique "${technique.name}" is already applied (score: ${technique.testScore.toFixed(3)}).`;
            }
            const experiment = runExperiment(engine, technique.id);
            if (!experiment) {
                return `Failed to create experiment for "${technique.name}".`;
            }
            startExperiment(experiment, 0, 0, 0);
            saveEvolutionState(engine);
            return [
                `Force-started experiment: ${technique.name}`,
                `  Source: ${technique.source}`,
                `  Category: ${technique.category}`,
                `  Description: ${technique.description}`,
                `  Parameters: ${JSON.stringify(technique.parameters)}`,
                `  Status: running — will evaluate after 180 frames (30 seconds)`,
            ].join('\n');
        },
    });
}
//# sourceMappingURL=evolution-engine.js.map