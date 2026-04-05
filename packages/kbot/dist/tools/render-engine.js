// kbot AAA Rendering Engine — Dynamic lighting, bloom, particles, procedural sky, post-processing
//
// Exports rendering functions for the stream-renderer. Does NOT register tools.
// Uses full Canvas 2D API: gradients, compositing, bezier curves, shadows, alpha blending.
/** Parse hex to [r,g,b] */
function hexToRgb(hex) {
    const h = hex.startsWith('#') ? hex.slice(1) : hex;
    return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
    ];
}
/**
 * Render dynamic lighting over the scene.
 * First draws a dark ambient overlay, then additively blends each light source.
 */
export function renderLighting(ctx, lights, width, height, ambientLight) {
    // Dark overlay: the lower the ambient, the darker the scene
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, 1 - ambientLight))})`;
    ctx.fillRect(0, 0, width, height);
    // Additive blending for light sources
    ctx.globalCompositeOperation = 'lighter';
    for (const light of lights) {
        let intensity = light.intensity;
        if (light.flicker) {
            intensity *= 0.85 + Math.random() * 0.15;
        }
        const [r, g, b] = hexToRgb(light.color);
        const grad = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius);
        grad.addColorStop(0, `rgba(${r},${g},${b},${intensity})`);
        grad.addColorStop(0.3, `rgba(${r},${g},${b},${intensity * 0.6})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(light.x - light.radius, light.y - light.radius, light.radius * 2, light.radius * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
}
/**
 * Get ambient light level for a given time of day.
 */
export function getAmbientForTime(timeOfDay) {
    switch (timeOfDay) {
        case 'night': return 0.45;
        case 'day': return 0.8;
        case 'sunset': return 0.6;
        case 'dawn': return 0.5;
        default: return 0.55;
    }
}
/**
 * Build default light sources for the kbot stream character.
 */
export function buildCharacterLights(robotX, robotY, scale, moodColor, frame, hasLightning, worldItems) {
    const lights = [];
    // Antenna ball glow
    const sway = Math.round(Math.sin(frame * 0.5));
    lights.push({
        x: robotX + (15 + sway) * scale,
        y: robotY - 3 * scale,
        radius: 80,
        color: moodColor,
        intensity: 0.6,
        flicker: true,
    });
    // Chest core glow
    lights.push({
        x: robotX + 16 * scale,
        y: robotY + 23 * scale,
        radius: 60,
        color: moodColor,
        intensity: 0.4,
        flicker: true,
    });
    // Lightning flash — massive white light
    if (hasLightning) {
        lights.push({
            x: 640,
            y: 0,
            radius: 2000,
            color: '#ffffff',
            intensity: 1.0,
        });
    }
    // Item-based light emission
    if (worldItems) {
        for (const item of worldItems) {
            const name = item.name.toLowerCase();
            const emoji = item.emoji;
            if (name.includes('fire') || emoji === '🔥') {
                lights.push({ x: item.x, y: item.y, radius: 50, color: '#ff6600', intensity: 0.35, flicker: true });
            }
            else if (name.includes('star') || emoji === '⭐' || emoji === '🌟') {
                lights.push({ x: item.x, y: item.y, radius: 40, color: '#f0c040', intensity: 0.3, flicker: true });
            }
            else if (name.includes('lamp') || emoji === '💡') {
                lights.push({ x: item.x, y: item.y, radius: 55, color: '#ffe4a0', intensity: 0.4, flicker: false });
            }
            else if (name.includes('crystal') || emoji === '💎') {
                lights.push({ x: item.x, y: item.y, radius: 35, color: '#58a6ff', intensity: 0.25, flicker: true });
            }
        }
    }
    return lights;
}
/**
 * Render soft glowing halos around bright elements.
 */
export function renderBloom(ctx, brightSpots) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const spot of brightSpots) {
        const bloomRadius = spot.radius * 2.5;
        const [r, g, b] = hexToRgb(spot.color);
        const grad = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, bloomRadius);
        grad.addColorStop(0, `rgba(${r},${g},${b},0.2)`);
        grad.addColorStop(0.4, `rgba(${r},${g},${b},0.1)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(spot.x - bloomRadius, spot.y - bloomRadius, bloomRadius * 2, bloomRadius * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
}
/**
 * Build default bloom spots for the kbot character.
 */
export function buildCharacterBloom(robotX, robotY, scale, moodColor, frame) {
    const spots = [];
    const sway = Math.round(Math.sin(frame * 0.5));
    // Antenna ball bloom
    spots.push({
        x: robotX + (15 + sway) * scale,
        y: robotY - 3 * scale,
        radius: 12,
        color: moodColor,
    });
    // Eyes bloom (subtle)
    const headX = robotX + 9 * scale;
    const headY = robotY + 5 * scale;
    spots.push({ x: headX + 4 * scale, y: headY + 4 * scale, radius: 6, color: moodColor });
    spots.push({ x: headX + 10 * scale, y: headY + 4 * scale, radius: 6, color: moodColor });
    // Chest core bloom
    spots.push({
        x: robotX + 16 * scale,
        y: robotY + 23 * scale,
        radius: 10,
        color: moodColor,
    });
    return spots;
}
/**
 * Create particles of a given type at a position.
 */
export function createParticleEmitter(type, x, y, count) {
    const particles = [];
    for (let i = 0; i < count; i++) {
        switch (type) {
            case 'spark':
                particles.push({
                    x, y,
                    vx: (Math.random() - 0.5) * 6,
                    vy: -3 - Math.random() * 3,
                    life: 20 + Math.floor(Math.random() * 15),
                    maxLife: 35,
                    size: 2,
                    color: Math.random() > 0.5 ? '#f0c040' : '#ff8800',
                    type: 'spark',
                    trail: [],
                    gravity: 0.3,
                });
                break;
            case 'fire':
                particles.push({
                    x: x + (Math.random() - 0.5) * 10,
                    y,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: -0.5 - Math.random() * 1,
                    life: 30 + Math.floor(Math.random() * 20),
                    maxLife: 50,
                    size: 3 + Math.floor(Math.random() * 2),
                    color: '#f0c040', // starts yellow
                    type: 'fire',
                    gravity: -0.2,
                });
                break;
            case 'magic': {
                const angle = (i / count) * Math.PI * 2;
                const radius = 20 + Math.random() * 10;
                particles.push({
                    x: x + Math.cos(angle) * radius,
                    y: y + Math.sin(angle) * radius,
                    vx: 0, vy: 0,
                    life: 40 + Math.floor(Math.random() * 20),
                    maxLife: 60,
                    size: 2,
                    color: '#bc8cff',
                    type: 'magic',
                    cx: x,
                    cy: y,
                    orbitRadius: radius,
                    orbitPhase: angle,
                });
                break;
            }
            case 'electricity':
                particles.push({
                    x, y,
                    vx: 0, vy: 0,
                    life: 8 + Math.floor(Math.random() * 8),
                    maxLife: 16,
                    size: 2,
                    color: '#88ccff',
                    type: 'electricity',
                    startX: x,
                    startY: y,
                    endX: x + (Math.random() - 0.5) * 40,
                    endY: y + (Math.random() - 0.5) * 40,
                    midpoints: [],
                    lastMidpointFrame: -999,
                });
                break;
            case 'trail':
                particles.push({
                    x, y,
                    vx: 0, vy: 0,
                    life: 12,
                    maxLife: 12,
                    size: 1,
                    color: '#3fb950',
                    type: 'trail',
                    trail: [{ x, y }],
                });
                break;
            case 'smoke':
                particles.push({
                    x: x + (Math.random() - 0.5) * 8,
                    y,
                    vx: (Math.random() - 0.5) * 0.4,
                    vy: -0.8 - Math.random() * 0.5,
                    life: 30 + Math.floor(Math.random() * 20),
                    maxLife: 50,
                    size: 4 + Math.floor(Math.random() * 4),
                    color: '#666666',
                    type: 'smoke',
                    gravity: -0.05,
                });
                break;
            case 'aura':
                particles.push({
                    x, y,
                    vx: 0, vy: 0,
                    life: 60 + Math.floor(Math.random() * 30),
                    maxLife: 90,
                    size: 60,
                    color: '#3fb950',
                    type: 'aura',
                    pulsePhase: Math.random() * Math.PI * 2,
                });
                break;
        }
    }
    return particles;
}
/**
 * Tick all particles: apply physics, age, return survivors.
 */
export function tickParticles(particles) {
    return particles.filter(p => {
        p.life--;
        if (p.life <= 0)
            return false;
        switch (p.type) {
            case 'spark':
                // Store trail
                if (p.trail) {
                    p.trail.push({ x: p.x, y: p.y });
                    if (p.trail.length > 3)
                        p.trail.shift();
                }
                p.vy += p.gravity ?? 0.3;
                p.x += p.vx;
                p.y += p.vy;
                // Bounce once on ground
                if (p.y > 480 && p.vy > 0) {
                    p.vy = -p.vy * 0.3;
                    p.y = 480;
                    if (Math.abs(p.vy) < 0.5)
                        p.vy = 0;
                }
                break;
            case 'fire':
                p.vy += p.gravity ?? -0.2;
                p.vx = Math.sin(p.life * 0.3) * 0.5;
                p.x += p.vx;
                p.y += p.vy;
                p.size = Math.max(1, p.size - 0.05);
                // Color shifts: yellow -> orange -> red -> dark
                {
                    const ratio = p.life / p.maxLife;
                    if (ratio > 0.7)
                        p.color = '#f0c040';
                    else if (ratio > 0.4)
                        p.color = '#ff6600';
                    else if (ratio > 0.2)
                        p.color = '#cc2200';
                    else
                        p.color = '#661100';
                }
                break;
            case 'magic':
                if (p.cx !== undefined && p.cy !== undefined && p.orbitRadius !== undefined && p.orbitPhase !== undefined) {
                    p.orbitPhase += 0.15;
                    p.x = p.cx + Math.cos(p.orbitPhase) * p.orbitRadius;
                    p.y = p.cy + Math.sin(p.orbitPhase) * p.orbitRadius;
                }
                // Rainbow cycle
                {
                    const rainbow = ['#f85149', '#f0c040', '#3fb950', '#58a6ff', '#bc8cff', '#ff6ec7'];
                    p.color = rainbow[Math.floor((p.maxLife - p.life) * 0.3) % rainbow.length];
                }
                break;
            case 'electricity':
                // Regenerate midpoints every 3 frames for crackling
                if (p.startX !== undefined && p.endX !== undefined && p.startY !== undefined && p.endY !== undefined) {
                    if (!p.lastMidpointFrame || (p.maxLife - p.life) - (p.lastMidpointFrame ?? 0) >= 3) {
                        const segCount = 5 + Math.floor(Math.random() * 3);
                        p.midpoints = [];
                        for (let s = 1; s < segCount; s++) {
                            const t = s / segCount;
                            const mx = p.startX + (p.endX - p.startX) * t;
                            const my = p.startY + (p.endY - p.startY) * t;
                            // Perpendicular offset
                            const dx = p.endX - p.startX;
                            const dy = p.endY - p.startY;
                            const len = Math.sqrt(dx * dx + dy * dy) || 1;
                            const nx = -dy / len;
                            const ny = dx / len;
                            const offset = (Math.random() - 0.5) * 10;
                            p.midpoints.push({ x: mx + nx * offset, y: my + ny * offset });
                        }
                        p.lastMidpointFrame = p.maxLife - p.life;
                    }
                }
                break;
            case 'trail':
                // Just fade
                break;
            case 'smoke':
                p.vy += p.gravity ?? -0.05;
                p.vx += (Math.random() - 0.5) * 0.1;
                p.x += p.vx;
                p.y += p.vy;
                p.size += 0.15; // expand over lifetime
                break;
            case 'aura':
                // Pulses on sine wave, doesn't move
                break;
        }
        return true;
    });
}
/**
 * Render all particles to the canvas.
 */
export function renderParticles(ctx, particles) {
    ctx.save();
    for (const p of particles) {
        const alpha = Math.max(0, p.life / p.maxLife);
        switch (p.type) {
            case 'spark': {
                // Trail
                if (p.trail && p.trail.length > 1) {
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = 1;
                    for (let i = 1; i < p.trail.length; i++) {
                        ctx.globalAlpha = alpha * (i / p.trail.length) * 0.5;
                        ctx.beginPath();
                        ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
                        ctx.lineTo(p.trail[i].x, p.trail[i].y);
                        ctx.stroke();
                    }
                }
                // Dot
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, p.size, p.size);
                break;
            }
            case 'fire': {
                ctx.globalAlpha = alpha * 0.8;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'magic': {
                ctx.globalAlpha = alpha * 0.7;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                // Glow around magic particle
                const [r, g, b] = hexToRgb(p.color);
                const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
                glow.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.3})`);
                glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
                ctx.fillStyle = glow;
                ctx.fillRect(p.x - p.size * 3, p.y - p.size * 3, p.size * 6, p.size * 6);
                break;
            }
            case 'electricity': {
                if (!p.midpoints || !p.startX || !p.endX || p.startY === undefined || p.endY === undefined)
                    break;
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = '#88ddff';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#4488ff';
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.moveTo(p.startX, p.startY);
                for (const mp of p.midpoints) {
                    ctx.lineTo(mp.x, mp.y);
                }
                ctx.lineTo(p.endX, p.endY);
                ctx.stroke();
                // Bright white core
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p.startX, p.startY);
                for (const mp of p.midpoints) {
                    ctx.lineTo(mp.x, mp.y);
                }
                ctx.lineTo(p.endX, p.endY);
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
                break;
            }
            case 'trail': {
                if (p.trail) {
                    for (let i = 0; i < p.trail.length; i++) {
                        const trailAlpha = alpha * (0.5 - i * 0.1);
                        if (trailAlpha <= 0)
                            continue;
                        ctx.globalAlpha = trailAlpha;
                        ctx.fillStyle = p.color;
                        ctx.fillRect(p.trail[i].x, p.trail[i].y, 4, 4);
                    }
                }
                break;
            }
            case 'smoke': {
                ctx.globalAlpha = alpha * 0.4;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'aura': {
                const pulseAlpha = 0.08 + Math.sin((p.pulsePhase ?? 0) + (p.maxLife - p.life) * 0.1) * 0.07;
                const [r, g, b] = hexToRgb(p.color);
                const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
                grad.addColorStop(0, `rgba(${r},${g},${b},${pulseAlpha})`);
                grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
                ctx.globalAlpha = 1;
                ctx.fillStyle = grad;
                ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
                break;
            }
        }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}
// ─── 3b. POSITION-BASED PARTICLE DYNAMICS (PBD UPGRADE) ─────────
/**
 * Tick particles using Verlet integration (PBD style) instead of simple velocity.
 * Adds floor constraints with realistic bounce and attractor constraints for orbital particles.
 */
export function tickParticlesPBD(particles, groundLevel = 480, attractorX = 0, attractorY = 0) {
    const dt = 1; // timestep (frame-based)
    return particles.filter(p => {
        p.life--;
        if (p.life <= 0)
            return false;
        // Reconstruct previous position from velocity
        const prevX = p.x - p.vx;
        const prevY = p.y - p.vy;
        switch (p.type) {
            case 'spark': {
                // Store trail
                if (p.trail) {
                    p.trail.push({ x: p.x, y: p.y });
                    if (p.trail.length > 3)
                        p.trail.shift();
                }
                // Apply gravity force (Verlet: position += accel * dt^2)
                p.y += (p.gravity ?? 0.3) * dt * dt;
                p.x += p.vx;
                p.y += p.vy;
                // Constraint: floor collision with bounce
                if (p.y > groundLevel && p.vy > 0) {
                    p.y = groundLevel;
                    const vyFromPos = p.y - prevY;
                    p.vy = -Math.abs(vyFromPos) * 0.4;
                    if (Math.abs(p.vy) < 0.5)
                        p.vy = 0;
                }
                // Derive velocity from position change (PBD)
                p.vx = p.x - prevX;
                p.vy = p.y - prevY;
                break;
            }
            case 'fire': {
                p.vy += p.gravity ?? -0.2;
                p.vx = Math.sin(p.life * 0.3) * 0.5;
                p.x += p.vx;
                p.y += p.vy;
                p.size = Math.max(1, p.size - 0.05);
                const ratio = p.life / p.maxLife;
                if (ratio > 0.7)
                    p.color = '#f0c040';
                else if (ratio > 0.4)
                    p.color = '#ff6600';
                else if (ratio > 0.2)
                    p.color = '#cc2200';
                else
                    p.color = '#661100';
                // Floor constraint for fire (fire rises, but embers fall)
                if (p.y > groundLevel) {
                    p.y = groundLevel;
                    p.vy = -Math.abs(p.vy) * 0.2;
                }
                break;
            }
            case 'magic': {
                if (p.cx !== undefined && p.cy !== undefined && p.orbitRadius !== undefined && p.orbitPhase !== undefined) {
                    p.orbitPhase += 0.15;
                    p.x = p.cx + Math.cos(p.orbitPhase) * p.orbitRadius;
                    p.y = p.cy + Math.sin(p.orbitPhase) * p.orbitRadius;
                }
                // Attractor constraint: robot core pulls nearby magic particles
                const dx = attractorX - p.x;
                const dy = attractorY - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 200 && dist > 0) {
                    p.x += dx * 0.02;
                    p.y += dy * 0.02;
                }
                // Rainbow cycle
                {
                    const rainbow = ['#f85149', '#f0c040', '#3fb950', '#58a6ff', '#bc8cff', '#ff6ec7'];
                    p.color = rainbow[Math.floor((p.maxLife - p.life) * 0.3) % rainbow.length];
                }
                // Derive velocity from position change (PBD)
                p.vx = p.x - prevX;
                p.vy = p.y - prevY;
                break;
            }
            case 'electricity': {
                if (p.startX !== undefined && p.endX !== undefined && p.startY !== undefined && p.endY !== undefined) {
                    if (!p.lastMidpointFrame || (p.maxLife - p.life) - (p.lastMidpointFrame ?? 0) >= 3) {
                        const segCount = 5 + Math.floor(Math.random() * 3);
                        p.midpoints = [];
                        for (let s = 1; s < segCount; s++) {
                            const t = s / segCount;
                            const mx = p.startX + (p.endX - p.startX) * t;
                            const my = p.startY + (p.endY - p.startY) * t;
                            const edx = p.endX - p.startX;
                            const edy = p.endY - p.startY;
                            const len = Math.sqrt(edx * edx + edy * edy) || 1;
                            const nx = -edy / len;
                            const ny = edx / len;
                            const offset = (Math.random() - 0.5) * 10;
                            p.midpoints.push({ x: mx + nx * offset, y: my + ny * offset });
                        }
                        p.lastMidpointFrame = p.maxLife - p.life;
                    }
                }
                break;
            }
            case 'trail':
                break;
            case 'smoke': {
                p.vy += p.gravity ?? -0.05;
                p.vx += (Math.random() - 0.5) * 0.1;
                p.x += p.vx;
                p.y += p.vy;
                p.size += 0.15;
                break;
            }
            case 'aura': {
                // Attractor constraint for aura particles
                const adx = attractorX - p.x;
                const ady = attractorY - p.y;
                const adist = Math.sqrt(adx * adx + ady * ady);
                if (adist < 200 && adist > 0) {
                    p.x += adx * 0.02;
                    p.y += ady * 0.02;
                }
                // Derive velocity from position change (PBD)
                p.vx = p.x - prevX;
                p.vy = p.y - prevY;
                break;
            }
        }
        return true;
    });
}
// ─── 4. PROCEDURAL SKY ──────────────────────────────────────────
// Stable star positions (seeded pseudorandom)
const STAR_POSITIONS = [];
const CONSTELLATION_GROUPS = [];
const CLOUD_POSITIONS = [];
function ensureStarsGenerated(width, height) {
    if (STAR_POSITIONS.length > 0)
        return;
    // Generate 60 stable stars
    for (let i = 0; i < 60; i++) {
        const seed = (i * 97 + 31) % 10000;
        STAR_POSITIONS.push({
            x: (seed * 3.7) % width,
            y: 70 + (seed * 7.3) % (height * 0.55),
            brightness: 0.3 + (seed % 70) / 100,
            size: i < 8 ? 2.5 : i < 20 ? 1.5 : 1,
            phase: (seed * 0.17) % (Math.PI * 2),
        });
    }
    // Generate 4 constellations (groups of 3-4 nearby stars)
    const used = new Set();
    for (let c = 0; c < 4; c++) {
        const group = [];
        const anchor = c * 12 + 5;
        if (anchor < STAR_POSITIONS.length && !used.has(anchor)) {
            group.push(anchor);
            used.add(anchor);
            // Find 2-3 nearby stars
            for (let j = anchor + 1; j < Math.min(anchor + 8, STAR_POSITIONS.length); j++) {
                if (!used.has(j) && group.length < 4) {
                    const dx = STAR_POSITIONS[anchor].x - STAR_POSITIONS[j].x;
                    const dy = STAR_POSITIONS[anchor].y - STAR_POSITIONS[j].y;
                    if (Math.sqrt(dx * dx + dy * dy) < 200) {
                        group.push(j);
                        used.add(j);
                    }
                }
            }
            if (group.length >= 2)
                CONSTELLATION_GROUPS.push(group);
        }
    }
    // Generate 7 clouds
    for (let i = 0; i < 7; i++) {
        CLOUD_POSITIONS.push({
            x: (i * 137 + 50) % width,
            y: 100 + (i * 67) % 150,
            w: 60 + (i * 23) % 60,
            h: 20 + (i * 11) % 15,
            opacity: 0.3 + (i % 4) * 0.1,
        });
    }
}
/**
 * Render a full procedural sky based on time of day, weather, and frame.
 */
export function renderSky(ctx, width, height, timeOfDay, weather, frame, dividerX = 580) {
    ensureStarsGenerated(dividerX, height);
    const skyTop = 60;
    const skyBottom = 490;
    const skyHeight = skyBottom - skyTop;
    switch (timeOfDay) {
        case 'night': {
            // Deep dark gradient
            const grad = ctx.createLinearGradient(0, skyTop, 0, skyBottom);
            grad.addColorStop(0, '#050510');
            grad.addColorStop(1, '#0a1628');
            ctx.fillStyle = grad;
            ctx.fillRect(0, skyTop, dividerX, skyHeight);
            // Stars with individual brightness pulses
            for (const star of STAR_POSITIONS) {
                if (star.x > dividerX)
                    continue;
                const pulse = star.brightness + Math.sin(frame * 0.08 + star.phase) * 0.2;
                const alpha = Math.max(0.1, Math.min(1, pulse));
                ctx.fillStyle = `rgba(255, 255, ${220 + Math.floor(star.phase * 10) % 35}, ${alpha})`;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();
            }
            // Constellation lines
            ctx.strokeStyle = 'rgba(100, 130, 180, 0.15)';
            ctx.lineWidth = 1;
            for (const group of CONSTELLATION_GROUPS) {
                for (let i = 1; i < group.length; i++) {
                    const a = STAR_POSITIONS[group[i - 1]];
                    const b = STAR_POSITIONS[group[i]];
                    if (a && b && a.x < dividerX && b.x < dividerX) {
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
            }
            // Moon with craters and corona
            const moonX = 100;
            const moonY = 150;
            // Corona glow
            const corona = ctx.createRadialGradient(moonX, moonY, 15, moonX, moonY, 40);
            corona.addColorStop(0, 'rgba(200, 210, 240, 0.12)');
            corona.addColorStop(1, 'rgba(200, 210, 240, 0)');
            ctx.fillStyle = corona;
            ctx.fillRect(moonX - 40, moonY - 40, 80, 80);
            // Moon body
            ctx.fillStyle = '#c8d0e0';
            ctx.beginPath();
            ctx.arc(moonX, moonY, 18, 0, Math.PI * 2);
            ctx.fill();
            // Craters
            ctx.fillStyle = '#a0a8b8';
            ctx.beginPath();
            ctx.arc(moonX - 5, moonY - 4, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(moonX + 6, moonY + 5, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(moonX - 2, moonY + 7, 2, 0, Math.PI * 2);
            ctx.fill();
            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.arc(moonX - 4, moonY - 5, 10, 0, Math.PI * 2);
            ctx.fill();
            // Milky Way band — horizontal band of faint dots across middle third
            const bandY = skyTop + skyHeight * 0.3;
            const bandH = skyHeight * 0.25;
            for (let i = 0; i < 80; i++) {
                const seed = (i * 73 + 17) % 10000;
                const mx = (seed * 3) % dividerX;
                const my = bandY + (seed * 7) % bandH;
                const size = (seed % 3 === 0) ? 1.5 : 1;
                ctx.fillStyle = `rgba(180, 190, 220, ${0.04 + (seed % 50) / 1000})`;
                ctx.beginPath();
                ctx.arc(mx, my, size, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        }
        case 'day': {
            // Blue sky gradient
            const grad = ctx.createLinearGradient(0, skyTop, 0, skyBottom);
            grad.addColorStop(0, '#1a3a5c');
            grad.addColorStop(0.5, '#4a8ab5');
            grad.addColorStop(1, '#87ceeb');
            ctx.fillStyle = grad;
            ctx.fillRect(0, skyTop, dividerX, skyHeight);
            // Sun with rotating corona rays
            const sunX = 400;
            const sunY = 130;
            // Corona rays
            ctx.save();
            ctx.translate(sunX, sunY);
            ctx.rotate(frame * 0.02);
            ctx.strokeStyle = 'rgba(255, 220, 100, 0.25)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle) * 18, Math.sin(angle) * 18);
                ctx.lineTo(Math.cos(angle) * 35, Math.sin(angle) * 35);
                ctx.stroke();
            }
            ctx.restore();
            // Sun body
            ctx.fillStyle = '#ffe44d';
            ctx.beginPath();
            ctx.arc(sunX, sunY, 15, 0, Math.PI * 2);
            ctx.fill();
            // Sun glow
            const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 50);
            sunGlow.addColorStop(0, 'rgba(255, 230, 100, 0.2)');
            sunGlow.addColorStop(1, 'rgba(255, 230, 100, 0)');
            ctx.fillStyle = sunGlow;
            ctx.fillRect(sunX - 50, sunY - 50, 100, 100);
            // Drifting clouds
            for (const cloud of CLOUD_POSITIONS) {
                const cx = (cloud.x + frame * 0.2) % (dividerX + cloud.w) - cloud.w / 2;
                drawCloud(ctx, cx, cloud.y, cloud.w, cloud.h, cloud.opacity);
            }
            break;
        }
        case 'sunset': {
            const grad = ctx.createLinearGradient(0, skyTop, 0, skyBottom);
            grad.addColorStop(0, '#1a0a2e');
            grad.addColorStop(0.35, '#6b2f5f');
            grad.addColorStop(0.65, '#e85d3a');
            grad.addColorStop(1, '#f4a460');
            ctx.fillStyle = grad;
            ctx.fillRect(0, skyTop, dividerX, skyHeight);
            // Setting sun near horizon
            const sunX = dividerX / 2;
            const sunY = skyBottom - 30;
            ctx.fillStyle = '#e85d3a';
            ctx.beginPath();
            ctx.arc(sunX, sunY, 25, 0, Math.PI * 2);
            ctx.fill();
            // Sun glow
            const sunGlow = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 80);
            sunGlow.addColorStop(0, 'rgba(232, 93, 58, 0.3)');
            sunGlow.addColorStop(1, 'rgba(232, 93, 58, 0)');
            ctx.fillStyle = sunGlow;
            ctx.fillRect(sunX - 80, sunY - 80, 160, 160);
            // Silhouetted clouds (dark purple)
            for (let i = 0; i < 4; i++) {
                const cx = 50 + i * 140;
                const cy = skyBottom - 80 - i * 15;
                drawCloud(ctx, cx, cy, 70, 18, 0.6, '#2a1040');
            }
            break;
        }
        case 'dawn': {
            const grad = ctx.createLinearGradient(0, skyTop, 0, skyBottom);
            grad.addColorStop(0, '#0a1628');
            grad.addColorStop(0.5, '#3a2a5c');
            grad.addColorStop(1, '#d4926b');
            ctx.fillStyle = grad;
            ctx.fillRect(0, skyTop, dividerX, skyHeight);
            // Fading stars (only brightest ones visible)
            for (let i = 0; i < 15; i++) {
                const star = STAR_POSITIONS[i];
                if (!star || star.x > dividerX)
                    continue;
                const alpha = 0.15 + Math.sin(frame * 0.1 + star.phase) * 0.08;
                ctx.fillStyle = `rgba(255, 255, 240, ${alpha})`;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size * 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
            // Thin pink/orange cloud wisps
            ctx.strokeStyle = 'rgba(220, 160, 130, 0.25)';
            ctx.lineWidth = 3;
            for (let i = 0; i < 3; i++) {
                const cy = skyBottom - 100 + i * 25;
                ctx.beginPath();
                ctx.moveTo(0, cy);
                ctx.bezierCurveTo(dividerX * 0.3, cy - 10 + Math.sin(frame * 0.01 + i) * 5, dividerX * 0.6, cy + 8 - Math.sin(frame * 0.015 + i * 2) * 5, dividerX, cy - 5);
                ctx.stroke();
            }
            break;
        }
        default: {
            // Fallback: dark background
            ctx.fillStyle = '#0d1117';
            ctx.fillRect(0, skyTop, dividerX, skyHeight);
            break;
        }
    }
    // Aurora effect for space biome at night
    if (weather === 'stars' && timeOfDay === 'night') {
        renderAurora(ctx, dividerX, skyTop, skyHeight, frame);
    }
}
/** Draw a soft cloud using overlapping circles */
function drawCloud(ctx, x, y, w, h, opacity, color = '#ffffff') {
    const [r, g, b] = hexToRgb(color);
    ctx.fillStyle = `rgba(${r},${g},${b},${opacity})`;
    // Main body
    ctx.beginPath();
    ctx.arc(x, y, h, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w * 0.3, y - h * 0.3, h * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w * 0.6, y, h * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w * 0.2, y + h * 0.2, h * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + h * 0.1, h * 0.8, 0, Math.PI * 2);
    ctx.fill();
}
/** Aurora borealis effect — flowing curtains of green/purple light */
function renderAurora(ctx, width, skyTop, skyHeight, frame) {
    const auroraColors = [
        [80, 200, 120], // green
        [130, 80, 200], // purple
        [80, 180, 180], // teal
    ];
    ctx.save();
    for (let i = 0; i < 3; i++) {
        const [r, g, b] = auroraColors[i];
        const baseY = skyTop + skyHeight * (0.15 + i * 0.08);
        const amplitude = 30 + Math.sin(frame * 0.005 + i * 2) * 15;
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        // Bezier curves flowing across the sky
        const cp1x = width * 0.25 + Math.sin(frame * 0.008 + i) * 30;
        const cp1y = baseY - amplitude + Math.sin(frame * 0.006 + i * 1.5) * 20;
        const cp2x = width * 0.75 + Math.cos(frame * 0.007 + i * 0.8) * 30;
        const cp2y = baseY + amplitude * 0.5 + Math.cos(frame * 0.009 + i) * 15;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, width, baseY + 10);
        // Close path downward for fill area
        ctx.lineTo(width, baseY + 50);
        const cp3x = width * 0.65 + Math.sin(frame * 0.006 + i + 1) * 20;
        const cp3y = baseY + 50 + amplitude * 0.3;
        const cp4x = width * 0.35 + Math.cos(frame * 0.008 + i + 1) * 20;
        const cp4y = baseY + 40;
        ctx.bezierCurveTo(cp3x, cp3y, cp4x, cp4y, 0, baseY + 30);
        ctx.closePath();
        // Gradient fill
        const auroraGrad = ctx.createLinearGradient(0, baseY - amplitude, 0, baseY + 50);
        auroraGrad.addColorStop(0, `rgba(${r},${g},${b},0)`);
        auroraGrad.addColorStop(0.3, `rgba(${r},${g},${b},0.08)`);
        auroraGrad.addColorStop(0.6, `rgba(${r},${g},${b},0.1)`);
        auroraGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = auroraGrad;
        ctx.fill();
    }
    ctx.restore();
}
/**
 * Build parallax layers for a given biome.
 */
export function buildParallaxLayers(biome, dividerX) {
    const layers = [];
    if (biome === 'grass') {
        // Far: distant mountains
        layers.push({
            type: 'far',
            factor: 0.1,
            draw: (ctx, offsetX, _frame) => {
                ctx.fillStyle = '#0d2d0d';
                ctx.beginPath();
                ctx.moveTo(0, 490);
                for (let x = 0; x <= dividerX; x += 3) {
                    const px = x + offsetX * 0.1;
                    const y = 440 + Math.sin(px * 0.005) * 20 + Math.sin(px * 0.012) * 10;
                    ctx.lineTo(x, y);
                }
                ctx.lineTo(dividerX, 490);
                ctx.closePath();
                ctx.fill();
            },
        });
        // Mid: rolling hills
        layers.push({
            type: 'mid',
            factor: 0.3,
            draw: (ctx, offsetX, _frame) => {
                ctx.fillStyle = '#153a15';
                ctx.beginPath();
                ctx.moveTo(0, 490);
                for (let x = 0; x <= dividerX; x += 2) {
                    const px = x + offsetX * 0.3;
                    const y = 455 + Math.sin(px * 0.008 + 1.2) * 15 + Math.sin(px * 0.015) * 8;
                    ctx.lineTo(x, y);
                }
                ctx.lineTo(dividerX, 490);
                ctx.closePath();
                ctx.fill();
            },
        });
        // Near: foreground vegetation
        layers.push({
            type: 'near',
            factor: 0.6,
            draw: (ctx, offsetX, frame) => {
                ctx.fillStyle = '#1a4d1a';
                ctx.beginPath();
                ctx.moveTo(0, 490);
                for (let x = 0; x <= dividerX; x += 2) {
                    const px = x + offsetX * 0.6;
                    const y = 470 + Math.sin(px * 0.01 + 0.8) * 8 + Math.sin(px * 0.025) * 4;
                    ctx.lineTo(x, y);
                }
                ctx.lineTo(dividerX, 490);
                ctx.closePath();
                ctx.fill();
                // Foreground flowers
                for (let i = 0; i < 10; i++) {
                    const seed = (i * 137 + 42) % 1000;
                    const fx = ((seed * 3 + offsetX * 0.6) % (dividerX + 40)) - 20;
                    const fy = 472 + (seed * 7) % 15;
                    const colors = ['#ff6ec7', '#f0c040', '#f85149', '#58a6ff'];
                    ctx.fillStyle = colors[i % colors.length];
                    ctx.fillRect(fx, fy, 3, 3);
                    ctx.fillStyle = '#3fb950';
                    ctx.fillRect(fx + 1, fy + 3, 1, 2);
                }
            },
        });
    }
    else if (biome === 'city') {
        // Far: distant skyscrapers
        layers.push({
            type: 'far',
            factor: 0.1,
            draw: (ctx, offsetX, _frame) => {
                const buildingsFar = [
                    { x: 30, w: 25, h: 80 }, { x: 80, w: 20, h: 60 }, { x: 130, w: 30, h: 100 },
                    { x: 180, w: 20, h: 70 }, { x: 240, w: 35, h: 90 }, { x: 300, w: 25, h: 110 },
                    { x: 350, w: 20, h: 65 }, { x: 400, w: 30, h: 85 }, { x: 460, w: 25, h: 95 },
                    { x: 510, w: 20, h: 75 },
                ];
                ctx.fillStyle = '#12121e';
                for (const b of buildingsFar) {
                    const bx = ((b.x + offsetX * 0.1) % (dividerX + 60)) - 30;
                    ctx.fillRect(bx, 490 - b.h, b.w, b.h);
                }
            },
        });
        // Mid: mid buildings with windows
        layers.push({
            type: 'mid',
            factor: 0.3,
            draw: (ctx, offsetX, frame) => {
                const buildingsMid = [
                    { x: 20, w: 40, h: 120 }, { x: 110, w: 50, h: 150 },
                    { x: 220, w: 45, h: 130 }, { x: 320, w: 55, h: 170 },
                    { x: 440, w: 50, h: 140 },
                ];
                for (const b of buildingsMid) {
                    const bx = ((b.x + offsetX * 0.3) % (dividerX + 80)) - 40;
                    ctx.fillStyle = '#1a1a25';
                    ctx.fillRect(bx, 490 - b.h, b.w, b.h);
                    // Lit windows
                    const windowSeed = Math.floor(frame / 30);
                    for (let wy = 490 - b.h + 8; wy < 485; wy += 12) {
                        for (let wx = bx + 4; wx < bx + b.w - 4; wx += 8) {
                            const lit = ((Math.floor(wx) * 7 + wy * 13 + windowSeed) % 5) < 2;
                            if (lit) {
                                ctx.fillStyle = '#f0c040';
                                ctx.fillRect(wx, wy, 4, 4);
                            }
                        }
                    }
                }
            },
        });
        // Near: street-level elements
        layers.push({
            type: 'near',
            factor: 0.6,
            draw: (ctx, offsetX, frame) => {
                // Street lamps
                for (let i = 0; i < 6; i++) {
                    const lx = ((i * 100 + offsetX * 0.6) % (dividerX + 100)) - 50;
                    ctx.fillStyle = '#333340';
                    ctx.fillRect(lx, 460, 3, 30);
                    // Lamp glow
                    ctx.fillStyle = 'rgba(255, 220, 100, 0.3)';
                    ctx.beginPath();
                    ctx.arc(lx + 1.5, 458, 8, 0, Math.PI * 2);
                    ctx.fill();
                }
                // Moving car
                const carX = ((frame * 3 + offsetX * 0.6) % (dividerX + 100)) - 50;
                ctx.fillStyle = '#f0c040';
                ctx.fillRect(carX, 482, 6, 3);
                ctx.fillRect(carX + 20, 482, 6, 3);
            },
        });
    }
    return layers;
}
/**
 * Render parallax layers relative to robot position.
 */
export function renderParallaxLayers(ctx, layers, robotX, frame) {
    for (const layer of layers) {
        layer.draw(ctx, robotX * layer.factor, frame);
    }
}
/**
 * Tick and render growing vegetation.
 */
export function tickGrowingPlants(plants) {
    for (const plant of plants) {
        if (plant.growthStage < 1) {
            plant.growthStage = Math.min(1, plant.growthStage + 0.0006); // ~30 seconds at 6fps
        }
    }
}
export function renderGrowingPlants(ctx, plants) {
    for (const plant of plants) {
        const g = plant.growthStage;
        const h = plant.maxHeight * g;
        switch (plant.type) {
            case 'tree': {
                if (g < 0.1) {
                    // Seed: 1px dot
                    ctx.fillStyle = '#553311';
                    ctx.fillRect(plant.x, plant.y, 2, 2);
                }
                else if (g < 0.4) {
                    // Trunk growing
                    const trunkH = h * 0.6;
                    ctx.fillStyle = '#553311';
                    ctx.fillRect(plant.x, plant.y - trunkH, 3, trunkH);
                }
                else {
                    // Full tree: trunk + branches + leaves
                    const trunkH = h * 0.5;
                    ctx.fillStyle = '#553311';
                    ctx.fillRect(plant.x, plant.y - trunkH, 3, trunkH);
                    // Branches
                    ctx.fillStyle = '#443322';
                    ctx.fillRect(plant.x - 4, plant.y - trunkH + 4, 11, 2);
                    // Leaves (crown)
                    const leafSize = h * 0.4 * Math.min(1, (g - 0.4) / 0.3);
                    ctx.fillStyle = plant.color;
                    ctx.beginPath();
                    ctx.arc(plant.x + 1, plant.y - trunkH - leafSize * 0.3, leafSize, 0, Math.PI * 2);
                    ctx.fill();
                    // Highlight
                    ctx.fillStyle = '#4dff7a';
                    ctx.beginPath();
                    ctx.arc(plant.x - 1, plant.y - trunkH - leafSize * 0.5, leafSize * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }
            case 'flower': {
                if (g < 0.15) {
                    ctx.fillStyle = '#2a5a2a';
                    ctx.fillRect(plant.x, plant.y, 1, 1);
                }
                else {
                    // Stem
                    const stemH = Math.min(h * 0.7, h * g);
                    ctx.fillStyle = '#2a7a2a';
                    ctx.fillRect(plant.x, plant.y - stemH, 1, stemH);
                    // Bud/petals
                    if (g > 0.5) {
                        const petalSize = 2 + (g - 0.5) * 4;
                        ctx.fillStyle = plant.color;
                        // 4 petals
                        ctx.beginPath();
                        ctx.arc(plant.x - petalSize * 0.4, plant.y - stemH, petalSize * 0.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.arc(plant.x + petalSize * 0.4, plant.y - stemH, petalSize * 0.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.arc(plant.x, plant.y - stemH - petalSize * 0.4, petalSize * 0.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.arc(plant.x, plant.y - stemH + petalSize * 0.4, petalSize * 0.5, 0, Math.PI * 2);
                        ctx.fill();
                        // Center
                        ctx.fillStyle = '#f0c040';
                        ctx.beginPath();
                        ctx.arc(plant.x, plant.y - stemH, petalSize * 0.25, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                break;
            }
            case 'mushroom': {
                if (g < 0.2) {
                    ctx.fillStyle = '#8b6914';
                    ctx.fillRect(plant.x, plant.y, 2, 1);
                }
                else {
                    const stemH = h * 0.4 * g;
                    ctx.fillStyle = '#d4c4a0';
                    ctx.fillRect(plant.x, plant.y - stemH, 2, stemH);
                    // Cap
                    const capW = 4 + g * 6;
                    ctx.fillStyle = plant.color;
                    ctx.beginPath();
                    ctx.arc(plant.x + 1, plant.y - stemH, capW / 2, Math.PI, 0);
                    ctx.fill();
                    // Spots
                    if (g > 0.6) {
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(plant.x - 1, plant.y - stemH - 1, 1, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.arc(plant.x + 3, plant.y - stemH - 2, 1, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                break;
            }
            case 'crystal': {
                if (g < 0.1) {
                    ctx.fillStyle = plant.color;
                    ctx.fillRect(plant.x, plant.y, 1, 1);
                }
                else {
                    // Crystal shard
                    const crystalH = h * g;
                    ctx.fillStyle = plant.color;
                    ctx.beginPath();
                    ctx.moveTo(plant.x, plant.y);
                    ctx.lineTo(plant.x - 3, plant.y);
                    ctx.lineTo(plant.x - 1, plant.y - crystalH);
                    ctx.lineTo(plant.x + 1, plant.y - crystalH * 0.8);
                    ctx.lineTo(plant.x + 3, plant.y);
                    ctx.closePath();
                    ctx.fill();
                    // Highlight edge
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.beginPath();
                    ctx.moveTo(plant.x - 1, plant.y - crystalH);
                    ctx.lineTo(plant.x, plant.y - crystalH * 0.3);
                    ctx.lineTo(plant.x + 1, plant.y - crystalH * 0.8);
                    ctx.closePath();
                    ctx.fill();
                }
                break;
            }
        }
    }
}
// ─── Animated Water ──────────────────────────────────────────────
/**
 * Render animated water with multiple sine waves, reflections, and foam.
 */
export function renderAnimatedWater(ctx, dividerX, frame) {
    // Multiple wave layers with different frequencies
    const waveLayers = [
        { color: '#0d4a7a', freq1: 0.02, freq2: 0.04, amp1: 8, amp2: 4, speed1: 3, speed2: 5, baseY: 460 },
        { color: '#0a5a8e', freq1: 0.025, freq2: 0.05, amp1: 6, amp2: 3, speed1: 4, speed2: 2, baseY: 470 },
        { color: '#0e6aaa', freq1: 0.03, freq2: 0.06, amp1: 4, amp2: 2, speed1: 2, speed2: 6, baseY: 478 },
    ];
    for (const wave of waveLayers) {
        ctx.fillStyle = wave.color;
        ctx.beginPath();
        ctx.moveTo(0, 490);
        for (let x = 0; x <= dividerX; x += 2) {
            const y = wave.baseY +
                Math.sin((x + frame * wave.speed1) * wave.freq1) * wave.amp1 +
                Math.sin((x + frame * wave.speed2) * wave.freq2 + 2) * wave.amp2;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(dividerX, 490);
        ctx.closePath();
        ctx.fill();
    }
    // Reflective highlights on wave peaks
    for (let x = 0; x < dividerX; x += 15) {
        const waveY = 460 + Math.sin((x + frame * 3) * 0.02) * 8;
        const isHighPoint = Math.sin((x + frame * 3) * 0.02) > 0.6;
        if (isHighPoint) {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + Math.random() * 0.1})`;
            ctx.fillRect(x, waveY, 3, 1);
        }
    }
    // Foam strip at wave tops
    for (let x = 0; x < dividerX; x += 4) {
        const foamY = 458 + Math.sin((x + frame * 3) * 0.02) * 8;
        if (Math.random() > 0.6) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(x, foamY, 2 + Math.floor(Math.random() * 3), 1);
        }
    }
}
// ─── Lava Flow ───────────────────────────────────────────────────
/**
 * Render lava with organic flow patterns and popping bubbles.
 */
export function renderLavaFlow(ctx, dividerX, frame) {
    // Organic lava flow using overlapping sine waves at different scales
    for (let layer = 0; layer < 4; layer++) {
        const layerY = 450 + layer * 10;
        ctx.beginPath();
        ctx.moveTo(0, 490);
        for (let x = 0; x <= dividerX; x += 2) {
            const n1 = Math.sin((x + frame * (4 - layer)) * 0.03 + layer * 1.5);
            const n2 = Math.sin((x * 0.07 + frame * 0.5) * 0.5 + layer);
            const n3 = Math.sin((x * 0.02 + frame * 0.8) * 0.8 + layer * 2.1);
            const y = layerY + (n1 * 4 + n2 * 3 + n3 * 2);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(dividerX, 490);
        ctx.closePath();
        // Color layers: bright yellow core → orange → red → dark
        const layerColors = ['#ff4400', '#ff6600', '#f0a030', '#ffe040'];
        ctx.fillStyle = layerColors[layer];
        ctx.fill();
    }
    // Lava bubbles
    const bubbleCount = 3;
    for (let i = 0; i < bubbleCount; i++) {
        const seed = (i * 137 + 42);
        const bubbleX = (seed * 3 + frame * 0.5) % dividerX;
        const cycleLen = 60 + (seed % 30);
        const bubblePhase = (frame + seed) % cycleLen;
        const bubbleProgress = bubblePhase / cycleLen;
        if (bubbleProgress < 0.8) {
            // Rising bubble
            const bubbleY = 480 - bubbleProgress * 30;
            const radius = 2 + bubbleProgress * 3;
            ctx.fillStyle = '#ffe080';
            ctx.beginPath();
            ctx.arc(bubbleX, bubbleY, radius, 0, Math.PI * 2);
            ctx.fill();
            // Highlight
            ctx.fillStyle = 'rgba(255, 255, 200, 0.5)';
            ctx.beginPath();
            ctx.arc(bubbleX - 1, bubbleY - 1, radius * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        else {
            // Pop: small splash particles
            const popY = 480 - 0.8 * 30;
            const popProgress = (bubbleProgress - 0.8) / 0.2;
            for (let s = 0; s < 4; s++) {
                const angle = (s / 4) * Math.PI * 2 + seed;
                const dist = popProgress * 8;
                const sx = bubbleX + Math.cos(angle) * dist;
                const sy = popY + Math.sin(angle) * dist - popProgress * 4;
                const alpha = 1 - popProgress;
                ctx.fillStyle = `rgba(255, 180, 60, ${alpha})`;
                ctx.fillRect(sx, sy, 2, 2);
            }
        }
    }
}
// ─── 6. CHARACTER EFFECTS ────────────────────────────────────────
/**
 * Draw AAA character effects: eye glow bleed, power-up aura, walk trail, etc.
 */
export function drawCharacterEffects(ctx, x, y, scale, mood, frame, isExecutingTool, walkSpeed, moodColor) {
    const [r, g, b] = hexToRgb(moodColor);
    // Eye glow bleed: radial gradient extending 3px beyond each eye
    const headX = x + 9 * scale;
    const headY = y + 5 * scale;
    const eyeY = headY + 4 * scale;
    const eyeGlowRadius = 5 * scale;
    ctx.save();
    // Left eye glow
    const leftEyeX = headX + 4 * scale;
    const eyeGlow1 = ctx.createRadialGradient(leftEyeX, eyeY, 0, leftEyeX, eyeY, eyeGlowRadius);
    eyeGlow1.addColorStop(0, `rgba(${r},${g},${b},0.2)`);
    eyeGlow1.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = eyeGlow1;
    ctx.fillRect(leftEyeX - eyeGlowRadius, eyeY - eyeGlowRadius, eyeGlowRadius * 2, eyeGlowRadius * 2);
    // Right eye glow
    const rightEyeX = headX + 10 * scale;
    const eyeGlow2 = ctx.createRadialGradient(rightEyeX, eyeY, 0, rightEyeX, eyeY, eyeGlowRadius);
    eyeGlow2.addColorStop(0, `rgba(${r},${g},${b},0.2)`);
    eyeGlow2.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = eyeGlow2;
    ctx.fillRect(rightEyeX - eyeGlowRadius, eyeY - eyeGlowRadius, eyeGlowRadius * 2, eyeGlowRadius * 2);
    ctx.restore();
    // Power-up aura: rotating hexagon during tool execution
    if (isExecutingTool) {
        const cx = x + 16 * scale;
        const cy = y + 22 * scale;
        const baseRadius = 25 * scale / 10;
        const pulseRadius = baseRadius + Math.sin(frame * 0.15) * 5;
        const rotation = frame * 0.05;
        ctx.save();
        ctx.strokeStyle = '#f0c040';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6 + Math.sin(frame * 0.2) * 0.2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = rotation + (i / 6) * Math.PI * 2;
            const px = cx + Math.cos(angle) * pulseRadius;
            const py = cy + Math.sin(angle) * pulseRadius;
            if (i === 0)
                ctx.moveTo(px, py);
            else
                ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
    // Mood aura — persistent subtle glow
    if (mood !== 'idle') {
        const cx = x + 16 * scale;
        const cy = y + 20 * scale;
        const auraRadius = 40 * scale / 10;
        const auraAlpha = 0.08 + Math.sin(frame * 0.08) * 0.04;
        const auraGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraRadius);
        auraGrad.addColorStop(0, `rgba(${r},${g},${b},${auraAlpha})`);
        auraGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = auraGrad;
        ctx.fillRect(cx - auraRadius, cy - auraRadius, auraRadius * 2, auraRadius * 2);
    }
}
// Mood transition state
let _moodTransitionFramesRemaining = 0;
let _moodTransitionColor = '#3fb950';
let _lastMoodForTransition = '';
/**
 * Track mood changes and return chromatic aberration offset if transitioning.
 * Returns {active, framesLeft} — caller draws character 3x with RGB offsets.
 */
export function checkMoodTransition(mood, moodColor) {
    if (mood !== _lastMoodForTransition) {
        _lastMoodForTransition = mood;
        _moodTransitionFramesRemaining = 6;
        _moodTransitionColor = moodColor;
    }
    if (_moodTransitionFramesRemaining > 0) {
        _moodTransitionFramesRemaining--;
        return { active: true, framesLeft: _moodTransitionFramesRemaining };
    }
    return { active: false, framesLeft: 0 };
}
// Damage flash state
let _flashWhiteFrames = 0;
/**
 * Trigger a white damage flash for 2 frames.
 */
export function triggerDamageFlash() {
    _flashWhiteFrames = 2;
}
/**
 * Render damage flash overlay on the character.
 * Returns true if flash is active (caller should skip normal character rendering logic).
 */
export function renderDamageFlash(ctx, x, y, scale) {
    if (_flashWhiteFrames > 0) {
        _flashWhiteFrames--;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(x - 2 * scale, y - 4 * scale, 38 * scale, 52 * scale);
        ctx.restore();
        return true;
    }
    return false;
}
/**
 * Apply screen-space post-processing effects.
 */
export function renderPostProcessing(ctx, width, height, frame, options) {
    ctx.save();
    // Film grain — subtle noise overlay
    if (options.filmGrain) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        for (let i = 0; i < 200; i++) {
            const gx = Math.random() * width;
            const gy = Math.random() * height;
            ctx.fillRect(gx, gy, 1, 1);
        }
        // Occasional darker grain
        ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
        for (let i = 0; i < 80; i++) {
            ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
        }
    }
    // Improved scanlines — very subtle CRT feel
    if (options.scanlines) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        for (let y = 0; y < height; y += 3) {
            ctx.fillRect(0, y, width, 1);
        }
    }
    // Improved vignette — radial darkening at corners
    if (options.vignette) {
        const vignetteGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.3, width / 2, height / 2, width * 0.8);
        vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vignetteGrad.addColorStop(0.7, 'rgba(0,0,0,0.15)');
        vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.fillStyle = vignetteGrad;
        ctx.fillRect(0, 0, width, height);
    }
    // Focus pulse — spotlight effect
    if (options.focusPulse) {
        const fp = options.focusPulse;
        // Darken everything
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, width, height);
        // Clear the spotlight area using a radial gradient that goes from transparent to dark
        const spotGrad = ctx.createRadialGradient(fp.x, fp.y, 0, fp.x, fp.y, fp.radius);
        spotGrad.addColorStop(0, 'rgba(0,0,0,0)');
        spotGrad.addColorStop(0.7, 'rgba(0,0,0,0)');
        spotGrad.addColorStop(1, 'rgba(0,0,0,0.35)');
        // Use destination-out to punch a hole through the darkening
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = spotGrad;
        ctx.beginPath();
        ctx.arc(fp.x, fp.y, fp.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
}
/**
 * Create an empty radiance grid (20x12 cells covering the 1280x720 canvas).
 */
export function createRadianceGrid() {
    return {
        cells: new Float32Array(20 * 12 * 3),
        width: 20,
        height: 12,
    };
}
/**
 * Update radiance grid by propagating light from all sources using inverse-square falloff.
 * Clears grid each frame before re-propagating.
 */
export function updateRadianceGrid(grid, lights) {
    // Clear
    grid.cells.fill(0);
    const cellW = 1280 / grid.width; // 64
    const cellH = 720 / grid.height; // 60
    for (const light of lights) {
        let intensity = light.intensity;
        if (light.flicker) {
            intensity *= 0.85 + Math.random() * 0.15;
        }
        const [lr, lg, lb] = hexToRgb(light.color);
        for (let cy = 0; cy < grid.height; cy++) {
            for (let cx = 0; cx < grid.width; cx++) {
                // Cell center in canvas space
                const cellCenterX = (cx + 0.5) * cellW;
                const cellCenterY = (cy + 0.5) * cellH;
                const dx = cellCenterX - light.x;
                const dy = cellCenterY - light.y;
                const distSq = dx * dx + dy * dy;
                // Inverse-square falloff with a softening factor
                const contribution = intensity / (1 + distSq * 0.001);
                // Skip negligible contributions
                if (contribution < 0.001)
                    continue;
                const idx = (cy * grid.width + cx) * 3;
                grid.cells[idx] += (lr / 255) * contribution;
                grid.cells[idx + 1] += (lg / 255) * contribution;
                grid.cells[idx + 2] += (lb / 255) * contribution;
            }
        }
    }
}
/**
 * Render the radiance grid as an additive overlay.
 * Each grid cell is drawn as a colored rect at low opacity, creating ambient light propagation.
 */
export function renderRadianceOverlay(ctx, grid, width, height) {
    const cellW = width / grid.width;
    const cellH = height / grid.height;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let cy = 0; cy < grid.height; cy++) {
        for (let cx = 0; cx < grid.width; cx++) {
            const idx = (cy * grid.width + cx) * 3;
            const r = grid.cells[idx];
            const g = grid.cells[idx + 1];
            const b = grid.cells[idx + 2];
            // Skip dark cells
            const magnitude = r + g + b;
            if (magnitude < 0.01)
                continue;
            // Map accumulated radiance to color, cap at 1.0
            const cr = Math.min(255, Math.round(Math.min(1, r) * 255));
            const cg = Math.min(255, Math.round(Math.min(1, g) * 255));
            const cb = Math.min(255, Math.round(Math.min(1, b) * 255));
            // Opacity scales with magnitude (0.08-0.15 range)
            const alpha = Math.min(0.15, 0.08 + magnitude * 0.02);
            ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
            ctx.fillRect(cx * cellW, cy * cellH, cellW, cellH);
        }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
}
// ─── 9. SUBSURFACE SCATTERING APPROXIMATION ─────────────────────
/**
 * Shift a hex color's hue toward warm (red-shifted) by a given amount.
 */
function warmShiftColor(hex, shiftDeg = 20) {
    const [r, g, b] = hexToRgb(hex);
    // Convert to HSL
    const rf = r / 255, gf = g / 255, bf = b / 255;
    const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === rf)
            h = ((gf - bf) / d + (gf < bf ? 6 : 0)) * 60;
        else if (max === gf)
            h = ((bf - rf) / d + 2) * 60;
        else
            h = ((rf - gf) / d + 4) * 60;
    }
    // Shift hue toward warm (lower hue = red/orange)
    h = (h + shiftDeg) % 360;
    // HSL to RGB
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r1 = 0, g1 = 0, b1 = 0;
    if (h < 60) {
        r1 = c;
        g1 = x;
        b1 = 0;
    }
    else if (h < 120) {
        r1 = x;
        g1 = c;
        b1 = 0;
    }
    else if (h < 180) {
        r1 = 0;
        g1 = c;
        b1 = x;
    }
    else if (h < 240) {
        r1 = 0;
        g1 = x;
        b1 = c;
    }
    else if (h < 300) {
        r1 = x;
        g1 = 0;
        b1 = c;
    }
    else {
        r1 = c;
        g1 = 0;
        b1 = x;
    }
    return `rgb(${Math.round((r1 + m) * 255)},${Math.round((g1 + m) * 255)},${Math.round((b1 + m) * 255)})`;
}
/**
 * Render subsurface scattering approximation on translucent robot panels.
 * Creates a soft warm glow "leaking through" panel edges using shadowBlur + screen compositing.
 */
export function renderSubsurfaceGlow(ctx, panels) {
    ctx.save();
    for (const panel of panels) {
        // Red-shift the color for subsurface warmth
        const sssColor = warmShiftColor(panel.color, 20);
        ctx.globalCompositeOperation = 'screen';
        ctx.shadowColor = sssColor;
        ctx.shadowBlur = 8 + panel.intensity * 4;
        ctx.strokeStyle = sssColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4 * panel.intensity;
        // Draw just the border (not filled) for edge glow effect
        ctx.strokeRect(panel.x, panel.y, panel.width, panel.height);
    }
    // Reset
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.restore();
}
/**
 * Build SSS panel definitions for the kbot character.
 */
export function buildSubsurfacePanels(robotX, robotY, scale, moodColor) {
    const panels = [];
    // Chest display panel
    panels.push({
        x: robotX + 12 * scale,
        y: robotY + 20 * scale,
        width: 10 * scale,
        height: 8 * scale,
        color: moodColor,
        intensity: 0.7,
    });
    // Left eye socket
    panels.push({
        x: robotX + 12 * scale,
        y: robotY + 8 * scale,
        width: 4 * scale,
        height: 3 * scale,
        color: moodColor,
        intensity: 0.5,
    });
    // Right eye socket
    panels.push({
        x: robotX + 18 * scale,
        y: robotY + 8 * scale,
        width: 4 * scale,
        height: 3 * scale,
        color: moodColor,
        intensity: 0.5,
    });
    // Antenna ball
    panels.push({
        x: robotX + 14 * scale,
        y: robotY - 4 * scale,
        width: 4 * scale,
        height: 4 * scale,
        color: moodColor,
        intensity: 0.8,
    });
    // Jet boot thrusters (left)
    panels.push({
        x: robotX + 10 * scale,
        y: robotY + 46 * scale,
        width: 5 * scale,
        height: 3 * scale,
        color: '#e8820c',
        intensity: 0.6,
    });
    // Jet boot thrusters (right)
    panels.push({
        x: robotX + 19 * scale,
        y: robotY + 46 * scale,
        width: 5 * scale,
        height: 3 * scale,
        color: '#e8820c',
        intensity: 0.6,
    });
    return panels;
}
/**
 * Create an empty frame cache for importance-sampled rendering.
 */
export function createFrameCache() {
    return {
        backgroundLayer: null,
        bodyLayer: null,
        lastBackgroundFrame: -999,
        lastBodyFrame: -999,
    };
}
/**
 * Determine if a layer should be re-rendered this frame.
 * - Background: every 4th frame (cached)
 * - Body: every 2nd frame when idle (cached), always when moving
 * - Effects: every frame
 */
export function shouldRenderLayer(cache, layer, currentFrame, isMoving = false, moodChanged = false, worldChanged = false) {
    // Invalidate cache on mood/world changes
    if (moodChanged || worldChanged)
        return true;
    switch (layer) {
        case 'background':
            if (!cache.backgroundLayer)
                return true;
            return (currentFrame - cache.lastBackgroundFrame) >= 4;
        case 'body':
            if (!cache.bodyLayer)
                return true;
            if (isMoving)
                return true;
            return (currentFrame - cache.lastBodyFrame) >= 2;
        case 'effects':
            return true; // always render effects
    }
}
/**
 * Cache a rendered layer as ImageData.
 */
export function cacheLayer(cache, ctx, layer, x, y, w, h, currentFrame) {
    if (layer === 'background') {
        cache.backgroundLayer = ctx.getImageData(x, y, w, h);
        cache.lastBackgroundFrame = currentFrame;
    }
    else {
        cache.bodyLayer = ctx.getImageData(x, y, w, h);
        cache.lastBodyFrame = currentFrame;
    }
}
/**
 * Draw a cached layer onto the canvas.
 */
export function drawCachedLayer(ctx, cache, layer) {
    if (layer === 'background' && cache.backgroundLayer) {
        ctx.putImageData(cache.backgroundLayer, 0, 0);
    }
    else if (layer === 'body' && cache.bodyLayer) {
        ctx.putImageData(cache.bodyLayer, 0, 0);
    }
}
// ─── 11. VOLUMETRIC FOG ─────────────────────────────────────────
/**
 * Get fog density for a given biome.
 */
function getFogDensityForBiome(biome) {
    switch (biome) {
        case 'ocean': return 0.4;
        case 'lava': return 0.3;
        case 'grass': return 0.1;
        case 'space': return 0.0;
        case 'city': return 0.2;
        default: return 0.15;
    }
}
/**
 * Render volumetric fog with drifting horizontal bands.
 * Fog is thinner near light sources and varies by biome.
 */
export function renderVolumetricFog(ctx, width, height, frame, fogDensity, fogColor, lightSources) {
    if (fogDensity <= 0.01)
        return;
    const [fr, fg, fb] = hexToRgb(fogColor);
    const bandCount = 5;
    const bandYBase = [200, 300, 380, 430, 460]; // vertical positions
    const bandHeight = [60, 80, 70, 50, 40];
    ctx.save();
    for (let i = 0; i < bandCount; i++) {
        const drift = Math.sin(frame * 0.02 + i * 1.7) * 20;
        const bandY = bandYBase[i];
        const bh = bandHeight[i];
        // Create horizontal gradient for this band (denser in middle)
        const grad = ctx.createLinearGradient(0, bandY, 0, bandY + bh);
        // Calculate light reduction at this band's center
        let lightReduction = 0;
        const bandCenterY = bandY + bh / 2;
        for (const light of lightSources) {
            const dx = (width / 2) - light.x;
            const dy = bandCenterY - light.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 200) {
                lightReduction += light.intensity * (1 - dist / 200) * 0.5;
            }
        }
        const effectiveDensity = Math.max(0, fogDensity - lightReduction);
        if (effectiveDensity < 0.01)
            continue;
        const alpha = effectiveDensity * 0.15;
        grad.addColorStop(0, `rgba(${fr},${fg},${fb},0)`);
        grad.addColorStop(0.3, `rgba(${fr},${fg},${fb},${alpha})`);
        grad.addColorStop(0.5, `rgba(${fr},${fg},${fb},${alpha * 1.2})`);
        grad.addColorStop(0.7, `rgba(${fr},${fg},${fb},${alpha})`);
        grad.addColorStop(1, `rgba(${fr},${fg},${fb},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(drift, bandY, width - drift, bh);
        // Wrap-around for drift
        if (drift > 0) {
            ctx.fillRect(0, bandY, drift, bh);
        }
    }
    ctx.restore();
}
/**
 * Get fog parameters for the current world state.
 */
export function getFogParams(biome, timeOfDay) {
    const baseDensity = getFogDensityForBiome(biome);
    // Increase fog at night and dawn
    let timeMod = 1.0;
    if (timeOfDay === 'night')
        timeMod = 1.3;
    else if (timeOfDay === 'dawn')
        timeMod = 1.2;
    else if (timeOfDay === 'day')
        timeMod = 0.7;
    // Fog color varies by biome
    let fogColor = '#8899aa'; // default grey-blue
    if (biome === 'lava')
        fogColor = '#332211'; // smoky brown
    else if (biome === 'ocean')
        fogColor = '#667788'; // sea mist
    else if (biome === 'city')
        fogColor = '#556677'; // smog
    else if (biome === 'space')
        fogColor = '#111122';
    return {
        density: Math.min(1, baseDensity * timeMod),
        color: fogColor,
    };
}
// ─── 12. PALETTE CYCLING (NEURAL TEXTURE COMPRESSION) ───────────
/**
 * Convert hex color to HSL.
 */
function hexToHsl(hex) {
    const [r, g, b] = hexToRgb(hex);
    const rf = r / 255, gf = g / 255, bf = b / 255;
    const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === rf)
            h = ((gf - bf) / d + (gf < bf ? 6 : 0)) * 60;
        else if (max === gf)
            h = ((bf - rf) / d + 2) * 60;
        else
            h = ((rf - gf) / d + 4) * 60;
    }
    return [h, s * 100, l * 100];
}
/**
 * Convert HSL to hex color string.
 */
function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) {
        r = c;
        g = x;
        b = 0;
    }
    else if (h < 120) {
        r = x;
        g = c;
        b = 0;
    }
    else if (h < 180) {
        r = 0;
        g = c;
        b = x;
    }
    else if (h < 240) {
        r = 0;
        g = x;
        b = c;
    }
    else if (h < 300) {
        r = x;
        g = 0;
        b = c;
    }
    else {
        r = c;
        g = 0;
        b = x;
    }
    const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
/**
 * Cycle palette colors subtly based on frame, mood, and time of day.
 * Creates a living, shimmering effect using HSL-based color shifting.
 */
export function cyclePalette(basePalette, frame, mood, timeOfDay) {
    const cycled = {};
    let colorIndex = 0;
    for (const [key, hex] of Object.entries(basePalette)) {
        const [h, s, l] = hexToHsl(hex);
        // Subtle hue shimmer
        let newH = h + Math.sin(frame * 0.01 + colorIndex * 0.5) * 5;
        if (newH < 0)
            newH += 360;
        if (newH >= 360)
            newH -= 360;
        // Saturation boost for excited/dancing moods
        let newS = s;
        if (mood === 'excited' || mood === 'dancing') {
            newS = Math.min(100, s + 10);
        }
        // Lightness modulation by time of day
        let newL = l;
        if (timeOfDay === 'night')
            newL = Math.max(0, l - 10);
        else if (timeOfDay === 'day')
            newL = Math.min(100, l + 5);
        else if (timeOfDay === 'sunset') {
            // Warm hue shift for sunset
            newH = (newH + 15) % 360;
        }
        cycled[key] = hslToHex(newH, Math.max(0, Math.min(100, newS)), Math.max(0, Math.min(100, newL)));
        colorIndex++;
    }
    return cycled;
}
/**
 * Compute animation parameters based on stream context.
 * Higher engagement = faster, more energetic animations.
 */
export function computeAnimationParams(chatRate, // messages per minute
viewerCount, // estimated viewers
mood, timeOfDay, streamDuration) {
    // Base energy from chat rate (0-10 msgs/min maps to 0.2-0.8)
    let energy = Math.min(0.8, 0.2 + chatRate * 0.06);
    // Viewer count boost (subtle)
    energy += Math.min(0.1, viewerCount * 0.005);
    // Mood modifiers
    if (mood === 'excited' || mood === 'dancing')
        energy = Math.min(1, energy + 0.2);
    else if (mood === 'dreaming')
        energy = 0.1;
    else if (mood === 'thinking')
        energy = Math.max(0.3, energy * 0.7);
    else if (mood === 'error')
        energy = Math.min(1, energy + 0.15);
    // Time of day
    if (timeOfDay === 'night')
        energy *= 0.75;
    else if (timeOfDay === 'dawn')
        energy *= 0.85;
    // Stream fatigue — slight decrease over time (max 20% reduction after 3 hours)
    const fatigueFactor = Math.max(0.8, 1 - (streamDuration / 180) * 0.2);
    energy *= fatigueFactor;
    // Clamp
    energy = Math.max(0.05, Math.min(1, energy));
    return {
        blinkRate: 0.1 + energy * 0.3,
        wobbleFreq: 0.02 + energy * 0.08,
        wobbleAmp: 1 + energy * 4,
        glowPulseSpeed: 0.05 + energy * 0.15,
        breathSpeed: 0.03 + energy * 0.07,
        energyLevel: energy,
    };
}
//# sourceMappingURL=render-engine.js.map