import { useState, useEffect, useRef, useCallback } from 'react';
import { Fish, Anchor, Waves } from 'lucide-react';
import './FishingGame.css';

// ═══════════════════════════════════════════════════════════════════════════
// FISHING AGENT - Retro Pixel Art Fishing Game
// Simple cast & catch mechanics with collection system
// ═══════════════════════════════════════════════════════════════════════════

const FRAME_TIME = 1000 / 60;
const SCALE = 2;
const SCREEN_W = 320 * SCALE;
const SCREEN_H = 240 * SCALE;

// Water line position
const WATER_LINE = 100 * SCALE;
const DOCK_Y = WATER_LINE - 16 * SCALE;

// Neo Geo palette - rich, vibrant colors with that classic arcade feel
const PAL = {
  // Sky (sunset gradient like Metal Slug)
  skyTop: '#1a0a2e',
  skyMid: '#4a1942',
  skyLow: '#ff6b35',
  skyHorizon: '#ffb347',

  // Water (rich blues like Neo Geo water stages)
  waterLight: '#00d4ff',
  waterMedium: '#0099cc',
  waterDark: '#006699',
  waterDeep: '#003366',
  waterFoam: '#80ffff',

  // Wood (dock) - warm browns
  woodLight: '#d4a574',
  woodMedium: '#a0522d',
  woodDark: '#5c3317',
  woodHighlight: '#f4c490',

  // Fishing line
  lineColor: '#ffffff',
  lineShadow: '#808080',

  // Character (bright, saturated like SNK fighters)
  skinTone: '#ffcc99',
  skinShadow: '#cc9966',
  skinHighlight: '#ffe6cc',
  shirt: '#ff3333',
  shirtShadow: '#cc0000',
  shirtHighlight: '#ff6666',
  pants: '#3366ff',
  pantsShadow: '#0033cc',
  pantsHighlight: '#6699ff',
  hat: '#ffcc00',
  hatShadow: '#cc9900',
  hatHighlight: '#ffff66',

  // UI
  white: '#ffffff',
  black: '#000000',
  gold: '#ffd700',
  silver: '#c0c0c0',

  // Neo Geo signature colors
  outline: '#000000',
  neoRed: '#ff0040',
  neoBlue: '#0080ff',
  neoYellow: '#ffcc00',
  neoGreen: '#00cc66',
  neoPurple: '#cc00ff',
};

// Fish types with properties
interface FishType {
  name: string;
  color: string;
  accentColor: string;
  size: number;
  speed: number;
  points: number;
  rarity: number; // 0-1, higher = rarer
  minDepth: number;
  maxDepth: number;
}

const FISH_TYPES: FishType[] = [
  { name: 'Minnow', color: '#90CAF9', accentColor: '#42A5F5', size: 0.5, speed: 3, points: 10, rarity: 0.1, minDepth: 0.1, maxDepth: 0.4 },
  { name: 'Trout', color: '#81C784', accentColor: '#4CAF50', size: 0.8, speed: 2, points: 25, rarity: 0.25, minDepth: 0.2, maxDepth: 0.6 },
  { name: 'Bass', color: '#A5D6A7', accentColor: '#388E3C', size: 1, speed: 1.5, points: 50, rarity: 0.35, minDepth: 0.3, maxDepth: 0.7 },
  { name: 'Salmon', color: '#FFAB91', accentColor: '#FF7043', size: 1.2, speed: 2.5, points: 75, rarity: 0.5, minDepth: 0.4, maxDepth: 0.8 },
  { name: 'Tuna', color: '#90A4AE', accentColor: '#546E7A', size: 1.5, speed: 3.5, points: 100, rarity: 0.65, minDepth: 0.5, maxDepth: 0.9 },
  { name: 'Swordfish', color: '#7986CB', accentColor: '#3F51B5', size: 2, speed: 4, points: 200, rarity: 0.8, minDepth: 0.6, maxDepth: 1 },
  { name: 'Golden Koi', color: '#FFD54F', accentColor: '#FF6F00', size: 1, speed: 1, points: 500, rarity: 0.95, minDepth: 0.2, maxDepth: 0.5 },
];

// Game state types
type GameState = 'idle' | 'casting' | 'waiting' | 'bite' | 'reeling' | 'caught' | 'escaped';

interface FishEntity {
  id: number;
  type: FishType;
  x: number;
  y: number;
  vx: number;
  facing: -1 | 1;
  animFrame: number;
  interested: boolean;
  hooked: boolean;
}

interface CaughtFish {
  type: FishType;
  count: number;
}

interface BubbleEntity {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// SPRITE DRAWING
// ═══════════════════════════════════════════════════════════════════════════

// Neo Geo style helper - draw with thick black outline
const drawNeoRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, outline = true) => {
  if (outline) {
    ctx.fillStyle = PAL.outline;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  }
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
};

const drawNeoCircle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, outline = true) => {
  if (outline) {
    ctx.fillStyle = PAL.outline;
    ctx.beginPath();
    ctx.arc(x, y, r + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

const drawFisher = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: GameState,
  frame: number
) => {
  ctx.save();
  ctx.translate(x, y);

  const s = SCALE;
  const castBob = state === 'casting' ? Math.sin(frame * 0.3) * 2 * s : 0;
  const reelingBob = state === 'reeling' ? Math.sin(frame * 0.5) * 3 * s : 0;
  const bob = castBob + reelingBob;

  // Drop shadow (Neo Geo style - offset dark ellipse)
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(0, 4 * s, 12 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // === LEGS (with outline and shading) ===
  // Left leg outline
  drawNeoRect(ctx, -5 * s, -18 * s, 5 * s, 18 * s, PAL.pantsShadow);
  drawNeoRect(ctx, -4 * s, -17 * s, 3 * s, 16 * s, PAL.pants, false);
  ctx.fillStyle = PAL.pantsHighlight;
  ctx.fillRect(-4 * s, -17 * s, 1 * s, 14 * s);

  // Right leg
  drawNeoRect(ctx, 0 * s, -18 * s, 5 * s, 18 * s, PAL.pantsShadow);
  drawNeoRect(ctx, 1 * s, -17 * s, 3 * s, 16 * s, PAL.pants, false);
  ctx.fillStyle = PAL.pantsHighlight;
  ctx.fillRect(1 * s, -17 * s, 1 * s, 14 * s);

  // === BODY (layered shading) ===
  drawNeoRect(ctx, -7 * s, -36 * s + bob, 14 * s, 20 * s, PAL.shirtShadow);
  drawNeoRect(ctx, -6 * s, -35 * s + bob, 12 * s, 18 * s, PAL.shirt, false);
  // Highlight
  ctx.fillStyle = PAL.shirtHighlight;
  ctx.fillRect(-5 * s, -34 * s + bob, 4 * s, 12 * s);
  // Belt
  ctx.fillStyle = PAL.woodDark;
  ctx.fillRect(-6 * s, -18 * s + bob, 12 * s, 3 * s);
  ctx.fillStyle = PAL.gold;
  ctx.fillRect(-2 * s, -18 * s + bob, 4 * s, 3 * s);

  // === HEAD (Neo Geo style with detail) ===
  // Neck
  drawNeoRect(ctx, -2 * s, -40 * s + bob, 4 * s, 6 * s, PAL.skinShadow);

  // Head shape
  drawNeoCircle(ctx, 0, -48 * s + bob, 8 * s, PAL.skinShadow);
  ctx.fillStyle = PAL.skinTone;
  ctx.beginPath();
  ctx.arc(0, -48 * s + bob, 7 * s, 0, Math.PI * 2);
  ctx.fill();
  // Highlight
  ctx.fillStyle = PAL.skinHighlight;
  ctx.beginPath();
  ctx.arc(-2 * s, -50 * s + bob, 3 * s, 0, Math.PI * 2);
  ctx.fill();

  // === HAT (fishing cap with detail) ===
  // Hat brim
  drawNeoRect(ctx, -10 * s, -54 * s + bob, 20 * s, 4 * s, PAL.hatShadow);
  ctx.fillStyle = PAL.hat;
  ctx.fillRect(-9 * s, -53 * s + bob, 18 * s, 2 * s);

  // Hat crown
  drawNeoRect(ctx, -6 * s, -62 * s + bob, 12 * s, 10 * s, PAL.hatShadow);
  ctx.fillStyle = PAL.hat;
  ctx.fillRect(-5 * s, -61 * s + bob, 10 * s, 8 * s);
  ctx.fillStyle = PAL.hatHighlight;
  ctx.fillRect(-4 * s, -60 * s + bob, 3 * s, 6 * s);

  // Hat band
  ctx.fillStyle = PAL.neoRed;
  ctx.fillRect(-5 * s, -55 * s + bob, 10 * s, 2 * s);

  // === FACE DETAILS ===
  // Eyes (Neo Geo expressive style)
  ctx.fillStyle = PAL.white;
  ctx.fillRect(-4 * s, -50 * s + bob, 3 * s, 3 * s);
  ctx.fillRect(1 * s, -50 * s + bob, 3 * s, 3 * s);
  ctx.fillStyle = PAL.black;
  ctx.fillRect(-3 * s, -49 * s + bob, 2 * s, 2 * s);
  ctx.fillRect(2 * s, -49 * s + bob, 2 * s, 2 * s);
  // Eye shine
  ctx.fillStyle = PAL.white;
  ctx.fillRect(-3 * s, -50 * s + bob, 1 * s, 1 * s);
  ctx.fillRect(2 * s, -50 * s + bob, 1 * s, 1 * s);

  // Nose
  ctx.fillStyle = PAL.skinShadow;
  ctx.fillRect(-1 * s, -47 * s + bob, 2 * s, 2 * s);

  // Mouth (slight smile)
  ctx.fillStyle = PAL.outline;
  ctx.fillRect(-2 * s, -44 * s + bob, 4 * s, 1 * s);

  // === FISHING ROD ===
  const rodAngle = state === 'casting' ? -30 + Math.sin(frame * 0.2) * 10 :
    state === 'reeling' ? -20 + Math.sin(frame * 0.4) * 5 :
      state === 'bite' ? -15 + Math.sin(frame * 0.8) * 15 : -25;

  ctx.save();
  ctx.translate(6 * s, -32 * s + bob);
  ctx.rotate(rodAngle * Math.PI / 180);

  // Rod handle (cork grip)
  ctx.fillStyle = PAL.outline;
  ctx.fillRect(-1, -3 * s, 10 * s, 6 * s);
  ctx.fillStyle = PAL.woodLight;
  ctx.fillRect(0, -2 * s, 8 * s, 4 * s);
  ctx.fillStyle = PAL.woodHighlight;
  ctx.fillRect(1 * s, -1 * s, 2 * s, 2 * s);

  // Rod shaft (tapered)
  ctx.fillStyle = PAL.outline;
  ctx.fillRect(7 * s, -2 * s, 44 * s, 4 * s);
  ctx.fillStyle = PAL.woodMedium;
  ctx.fillRect(8 * s, -1 * s, 42 * s, 2 * s);
  // Gradient effect on rod
  ctx.fillStyle = PAL.woodDark;
  ctx.fillRect(8 * s, 0, 42 * s, 1 * s);
  ctx.fillStyle = PAL.woodHighlight;
  ctx.fillRect(8 * s, -1 * s, 42 * s, 1 * s);

  // Rod guides (rings)
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = PAL.silver;
    ctx.fillRect(15 * s + i * 10 * s, -2 * s, 2 * s, 4 * s);
  }

  // Rod tip
  ctx.fillStyle = PAL.neoRed;
  ctx.fillRect(48 * s, -1 * s, 4 * s, 2 * s);

  ctx.restore();

  // === ARM (holding rod) ===
  drawNeoRect(ctx, 4 * s, -34 * s + bob, 8 * s, 6 * s, PAL.skinShadow);
  ctx.fillStyle = PAL.skinTone;
  ctx.fillRect(5 * s, -33 * s + bob, 6 * s, 4 * s);
  ctx.fillStyle = PAL.skinHighlight;
  ctx.fillRect(5 * s, -33 * s + bob, 2 * s, 3 * s);

  ctx.restore();
};

const drawFish = (
  ctx: CanvasRenderingContext2D,
  fish: FishEntity,
  frame: number
) => {
  ctx.save();
  ctx.translate(fish.x, fish.y);
  if (fish.facing === -1) ctx.scale(-1, 1);

  const s = SCALE * fish.type.size;
  const swimWave = Math.sin(frame * 0.15 + fish.id) * 2;
  const tailWag = Math.sin(frame * 0.3 + fish.id) * 8;

  // === NEO GEO STYLE FISH ===

  // Outline layer (thick black border)
  ctx.fillStyle = PAL.outline;
  ctx.beginPath();
  ctx.ellipse(0, swimWave, 14 * s, 8 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail outline
  ctx.beginPath();
  ctx.moveTo(-12 * s, swimWave);
  ctx.lineTo(-22 * s, -8 * s + swimWave + tailWag);
  ctx.lineTo(-22 * s, 8 * s + swimWave - tailWag);
  ctx.closePath();
  ctx.fill();

  // Dorsal fin outline
  ctx.beginPath();
  ctx.moveTo(-4 * s, -6 * s + swimWave);
  ctx.lineTo(4 * s, -14 * s + swimWave);
  ctx.lineTo(10 * s, -6 * s + swimWave);
  ctx.closePath();
  ctx.fill();

  // Main body (with gradient simulation)
  ctx.fillStyle = fish.type.color;
  ctx.beginPath();
  ctx.ellipse(0, swimWave, 12 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body highlight (top)
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, -2 * s + swimWave, 10 * s, 3 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body shadow (bottom)
  ctx.fillStyle = fish.type.accentColor;
  ctx.beginPath();
  ctx.ellipse(0, 2 * s + swimWave, 10 * s, 3 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Scales pattern (Neo Geo detail)
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  for (let i = -2; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(i * 4 * s, swimWave, 2 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tail (with shading)
  ctx.fillStyle = fish.type.accentColor;
  ctx.beginPath();
  ctx.moveTo(-12 * s, swimWave);
  ctx.lineTo(-20 * s, -6 * s + swimWave + tailWag);
  ctx.lineTo(-20 * s, 6 * s + swimWave - tailWag);
  ctx.closePath();
  ctx.fill();
  // Tail highlight
  ctx.fillStyle = fish.type.color;
  ctx.beginPath();
  ctx.moveTo(-12 * s, swimWave);
  ctx.lineTo(-18 * s, -4 * s + swimWave + tailWag);
  ctx.lineTo(-16 * s, swimWave);
  ctx.closePath();
  ctx.fill();

  // Dorsal fin (with detail)
  ctx.fillStyle = fish.type.accentColor;
  ctx.beginPath();
  ctx.moveTo(-2 * s, -5 * s + swimWave);
  ctx.lineTo(4 * s, -12 * s + swimWave);
  ctx.lineTo(8 * s, -5 * s + swimWave);
  ctx.closePath();
  ctx.fill();
  // Fin rays
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -5 * s + swimWave);
  ctx.lineTo(3 * s, -10 * s + swimWave);
  ctx.moveTo(4 * s, -5 * s + swimWave);
  ctx.lineTo(5 * s, -10 * s + swimWave);
  ctx.stroke();

  // Pectoral fin
  ctx.fillStyle = fish.type.accentColor;
  ctx.beginPath();
  ctx.ellipse(4 * s, 3 * s + swimWave, 4 * s, 2 * s, Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();

  // Eye (Neo Geo expressive style)
  // Eye white
  ctx.fillStyle = PAL.white;
  ctx.beginPath();
  ctx.arc(7 * s, -1 * s + swimWave, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  // Iris
  ctx.fillStyle = PAL.black;
  ctx.beginPath();
  ctx.arc(8 * s, -1 * s + swimWave, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  // Eye shine (signature Neo Geo look)
  ctx.fillStyle = PAL.white;
  ctx.fillRect(7 * s, -2 * s + swimWave, 1 * s, 1 * s);

  // Mouth
  ctx.strokeStyle = PAL.outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(11 * s, swimWave, 2 * s, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  // Shimmer effect if interested (pulsing glow)
  if (fish.interested) {
    const pulse = Math.sin(frame * 0.2) * 0.3 + 0.5;
    ctx.fillStyle = `rgba(255,255,255,${pulse})`;
    ctx.beginPath();
    ctx.ellipse(0, swimWave, 16 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Exclamation mark (Neo Geo alert style!)
    ctx.fillStyle = PAL.neoYellow;
    ctx.fillRect(-2 * s, -22 * s + swimWave, 4 * s, 8 * s);
    ctx.fillRect(-2 * s, -12 * s + swimWave, 4 * s, 3 * s);
    ctx.fillStyle = PAL.outline;
    ctx.fillRect(-3 * s, -23 * s + swimWave, 6 * s, 10 * s);
    ctx.fillRect(-3 * s, -13 * s + swimWave, 6 * s, 5 * s);
    ctx.fillStyle = PAL.neoYellow;
    ctx.fillRect(-2 * s, -22 * s + swimWave, 4 * s, 8 * s);
    ctx.fillRect(-2 * s, -11 * s + swimWave, 4 * s, 3 * s);
  }

  ctx.restore();
};

const drawBubble = (ctx: CanvasRenderingContext2D, bubble: BubbleEntity) => {
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(bubble.x, bubble.y, bubble.size * SCALE, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(bubble.x - bubble.size * SCALE * 0.3, bubble.y - bubble.size * SCALE * 0.3, bubble.size * SCALE * 0.3, 0, Math.PI * 2);
  ctx.fill();
};

// ═══════════════════════════════════════════════════════════════════════════
// BACKGROUND RENDERING
// ═══════════════════════════════════════════════════════════════════════════

const drawBackground = (ctx: CanvasRenderingContext2D, frame: number) => {
  const s = SCALE;

  // === NEO GEO SUNSET SKY (Metal Slug inspired) ===
  const skyGradient = ctx.createLinearGradient(0, 0, 0, WATER_LINE);
  skyGradient.addColorStop(0, PAL.skyTop);
  skyGradient.addColorStop(0.4, PAL.skyMid);
  skyGradient.addColorStop(0.7, PAL.skyLow);
  skyGradient.addColorStop(1, PAL.skyHorizon);
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, SCREEN_W, WATER_LINE);

  // Dithering effect (Neo Geo signature)
  for (let y = 0; y < WATER_LINE; y += 4) {
    if (y % 8 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(0, y, SCREEN_W, 2);
    }
  }

  // === SUN (large, dramatic Neo Geo style) ===
  const sunX = SCREEN_W - 80 * s;
  const sunY = 50 * s;

  // Sun glow (outer)
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 60 * s);
  sunGlow.addColorStop(0, 'rgba(255,200,100,0.6)');
  sunGlow.addColorStop(0.5, 'rgba(255,150,50,0.3)');
  sunGlow.addColorStop(1, 'rgba(255,100,0,0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 60 * s, 0, Math.PI * 2);
  ctx.fill();

  // Sun outline
  ctx.fillStyle = PAL.outline;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 32 * s, 0, Math.PI * 2);
  ctx.fill();

  // Sun body
  ctx.fillStyle = '#ffdd44';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 30 * s, 0, Math.PI * 2);
  ctx.fill();

  // Sun highlight
  ctx.fillStyle = '#ffff88';
  ctx.beginPath();
  ctx.arc(sunX - 8 * s, sunY - 8 * s, 15 * s, 0, Math.PI * 2);
  ctx.fill();

  // Sun core
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(sunX - 5 * s, sunY - 5 * s, 8 * s, 0, Math.PI * 2);
  ctx.fill();

  // === CLOUDS (layered parallax, Neo Geo style) ===
  const cloudOffset1 = (frame * 0.3) % (SCREEN_W + 300);
  const cloudOffset2 = (frame * 0.2) % (SCREEN_W + 300);
  const cloudOffset3 = (frame * 0.15) % (SCREEN_W + 300);

  // Back clouds (darker)
  ctx.fillStyle = 'rgba(80,40,60,0.6)';
  drawNeoCloud(ctx, cloudOffset3 - 150, 25 * s, 1.5);
  drawNeoCloud(ctx, (cloudOffset3 + 350) % (SCREEN_W + 300) - 150, 40 * s, 1.2);

  // Mid clouds
  ctx.fillStyle = 'rgba(150,100,80,0.5)';
  drawNeoCloud(ctx, cloudOffset2 - 100, 35 * s, 1.0);
  drawNeoCloud(ctx, (cloudOffset2 + 250) % (SCREEN_W + 300) - 100, 55 * s, 0.8);

  // Front clouds (bright)
  ctx.fillStyle = 'rgba(255,180,120,0.7)';
  drawNeoCloud(ctx, cloudOffset1 - 80, 45 * s, 0.7);

  // === DISTANT MOUNTAINS (silhouette) ===
  ctx.fillStyle = '#2a1a2e';
  ctx.beginPath();
  ctx.moveTo(0, WATER_LINE);
  ctx.lineTo(0, WATER_LINE - 30 * s);
  ctx.lineTo(40 * s, WATER_LINE - 50 * s);
  ctx.lineTo(80 * s, WATER_LINE - 35 * s);
  ctx.lineTo(120 * s, WATER_LINE - 60 * s);
  ctx.lineTo(180 * s, WATER_LINE - 40 * s);
  ctx.lineTo(220 * s, WATER_LINE - 55 * s);
  ctx.lineTo(280 * s, WATER_LINE - 30 * s);
  ctx.lineTo(320 * s, WATER_LINE - 45 * s);
  ctx.lineTo(SCREEN_W, WATER_LINE - 25 * s);
  ctx.lineTo(SCREEN_W, WATER_LINE);
  ctx.closePath();
  ctx.fill();

  // === WATER (rich Neo Geo blues) ===
  const waterGradient = ctx.createLinearGradient(0, WATER_LINE, 0, SCREEN_H);
  waterGradient.addColorStop(0, PAL.waterLight);
  waterGradient.addColorStop(0.2, PAL.waterMedium);
  waterGradient.addColorStop(0.5, PAL.waterDark);
  waterGradient.addColorStop(1, PAL.waterDeep);
  ctx.fillStyle = waterGradient;
  ctx.fillRect(0, WATER_LINE, SCREEN_W, SCREEN_H - WATER_LINE);

  // Water reflection of sun
  const reflectGradient = ctx.createLinearGradient(sunX - 40 * s, WATER_LINE, sunX + 40 * s, WATER_LINE + 80 * s);
  reflectGradient.addColorStop(0, 'rgba(255,200,100,0.4)');
  reflectGradient.addColorStop(1, 'rgba(255,150,50,0)');
  ctx.fillStyle = reflectGradient;
  ctx.fillRect(sunX - 50 * s, WATER_LINE, 100 * s, 80 * s);

  // === ANIMATED WAVES (Neo Geo style with highlights) ===
  for (let i = 0; i < 8; i++) {
    const waveY = WATER_LINE + 3 * s + i * 6 * s;
    const waveAlpha = 0.5 - i * 0.05;

    // Wave shadow
    ctx.strokeStyle = `rgba(0,50,100,${waveAlpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x < SCREEN_W; x += 2) {
      const phase = (x + frame * 2 + i * 40) * 0.015;
      const y = waveY + Math.sin(phase) * (3 - i * 0.3) * s + 2;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Wave highlight
    ctx.strokeStyle = `rgba(128,255,255,${waveAlpha * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < SCREEN_W; x += 2) {
      const phase = (x + frame * 2 + i * 40) * 0.015;
      const y = waveY + Math.sin(phase) * (3 - i * 0.3) * s;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Foam at water line
  ctx.fillStyle = PAL.waterFoam;
  for (let x = 0; x < SCREEN_W; x += 8 * s) {
    const foamY = WATER_LINE + Math.sin((x + frame) * 0.05) * 2 * s;
    ctx.fillRect(x, foamY, 6 * s, 2 * s);
  }

  // Dock
  drawDock(ctx);
};

// Neo Geo style cloud with outline
const drawNeoCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
  const s = SCALE * scale;
  const color = ctx.fillStyle;

  // Outline
  ctx.fillStyle = PAL.outline;
  ctx.beginPath();
  ctx.arc(x, y, 18 * s, 0, Math.PI * 2);
  ctx.arc(x + 25 * s, y - 8 * s, 24 * s, 0, Math.PI * 2);
  ctx.arc(x + 55 * s, y, 20 * s, 0, Math.PI * 2);
  ctx.arc(x + 30 * s, y + 8 * s, 15 * s, 0, Math.PI * 2);
  ctx.fill();

  // Fill
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 15 * s, 0, Math.PI * 2);
  ctx.arc(x + 25 * s, y - 8 * s, 20 * s, 0, Math.PI * 2);
  ctx.arc(x + 55 * s, y, 18 * s, 0, Math.PI * 2);
  ctx.arc(x + 30 * s, y + 8 * s, 12 * s, 0, Math.PI * 2);
  ctx.fill();
};

const drawDock = (ctx: CanvasRenderingContext2D) => {
  const s = SCALE;
  const dockX = 15 * s;
  const dockWidth = 110 * s;

  // === NEO GEO STYLE DOCK ===

  // Dock supports (vertical posts with detail)
  // Left post
  ctx.fillStyle = PAL.outline;
  ctx.fillRect(dockX + 8 * s, DOCK_Y - 2 * s, 12 * s, 70 * s);
  ctx.fillStyle = PAL.woodDark;
  ctx.fillRect(dockX + 10 * s, DOCK_Y, 8 * s, 66 * s);
  ctx.fillStyle = PAL.woodMedium;
  ctx.fillRect(dockX + 10 * s, DOCK_Y, 3 * s, 66 * s);
  // Post rings
  ctx.fillStyle = PAL.outline;
  ctx.fillRect(dockX + 8 * s, DOCK_Y + 20 * s, 12 * s, 4 * s);
  ctx.fillRect(dockX + 8 * s, DOCK_Y + 45 * s, 12 * s, 4 * s);

  // Right post
  ctx.fillStyle = PAL.outline;
  ctx.fillRect(dockX + dockWidth - 22 * s, DOCK_Y - 2 * s, 12 * s, 70 * s);
  ctx.fillStyle = PAL.woodDark;
  ctx.fillRect(dockX + dockWidth - 20 * s, DOCK_Y, 8 * s, 66 * s);
  ctx.fillStyle = PAL.woodMedium;
  ctx.fillRect(dockX + dockWidth - 20 * s, DOCK_Y, 3 * s, 66 * s);
  // Post rings
  ctx.fillStyle = PAL.outline;
  ctx.fillRect(dockX + dockWidth - 22 * s, DOCK_Y + 20 * s, 12 * s, 4 * s);
  ctx.fillRect(dockX + dockWidth - 22 * s, DOCK_Y + 45 * s, 12 * s, 4 * s);

  // Dock platform outline
  ctx.fillStyle = PAL.outline;
  ctx.fillRect(dockX - 2 * s, DOCK_Y - 12 * s, dockWidth + 4 * s, 18 * s);

  // Dock platform base
  ctx.fillStyle = PAL.woodDark;
  ctx.fillRect(dockX, DOCK_Y - 10 * s, dockWidth, 14 * s);

  // Individual planks with Neo Geo shading
  for (let i = 0; i < dockWidth - 4 * s; i += 14 * s) {
    // Plank shadow (gap)
    ctx.fillStyle = PAL.outline;
    ctx.fillRect(dockX + i, DOCK_Y - 10 * s, 2 * s, 14 * s);

    // Plank body
    ctx.fillStyle = PAL.woodMedium;
    ctx.fillRect(dockX + i + 2 * s, DOCK_Y - 9 * s, 11 * s, 12 * s);

    // Plank highlight (top edge)
    ctx.fillStyle = PAL.woodHighlight;
    ctx.fillRect(dockX + i + 2 * s, DOCK_Y - 9 * s, 11 * s, 2 * s);

    // Plank shadow (bottom edge)
    ctx.fillStyle = PAL.woodDark;
    ctx.fillRect(dockX + i + 2 * s, DOCK_Y + 1 * s, 11 * s, 2 * s);

    // Wood grain detail
    ctx.fillStyle = PAL.woodLight;
    ctx.fillRect(dockX + i + 4 * s, DOCK_Y - 6 * s, 1 * s, 6 * s);
    ctx.fillRect(dockX + i + 8 * s, DOCK_Y - 4 * s, 1 * s, 4 * s);
  }

  // Dock side edge (depth)
  ctx.fillStyle = PAL.woodDark;
  ctx.fillRect(dockX, DOCK_Y + 4 * s, dockWidth, 4 * s);
  ctx.fillStyle = PAL.outline;
  ctx.fillRect(dockX - 2 * s, DOCK_Y + 4 * s, 2 * s, 4 * s);
  ctx.fillRect(dockX + dockWidth, DOCK_Y + 4 * s, 2 * s, 4 * s);

  // Bucket detail (Neo Geo loves small details!)
  ctx.fillStyle = PAL.outline;
  ctx.fillRect(dockX + 75 * s, DOCK_Y - 16 * s, 14 * s, 12 * s);
  ctx.fillStyle = '#666688';
  ctx.fillRect(dockX + 76 * s, DOCK_Y - 15 * s, 12 * s, 10 * s);
  ctx.fillStyle = '#8888aa';
  ctx.fillRect(dockX + 76 * s, DOCK_Y - 15 * s, 4 * s, 8 * s);
  // Bucket handle
  ctx.strokeStyle = PAL.outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(dockX + 82 * s, DOCK_Y - 18 * s, 5 * s, Math.PI, 0);
  ctx.stroke();
};

const drawFishingLine = (
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  state: GameState,
  frame: number
) => {
  if (state === 'idle') return;

  const s = SCALE;

  // Line
  ctx.strokeStyle = PAL.lineColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(startX, startY);

  // Add curve to the line
  const midX = (startX + endX) / 2;
  const sag = state === 'bite' || state === 'reeling' ? 20 * s + Math.sin(frame * 0.3) * 10 * s : 30 * s;
  ctx.quadraticCurveTo(midX, Math.min(startY, endY) + sag, endX, endY);
  ctx.stroke();

  // Bobber
  if (state !== 'casting') {
    const bobberY = endY + (state === 'bite' ? Math.sin(frame * 0.5) * 8 * s : 0);

    // Bobber body (red top)
    ctx.fillStyle = '#E53935';
    ctx.beginPath();
    ctx.ellipse(endX, bobberY - 4 * s, 4 * s, 6 * s, 0, 0, Math.PI);
    ctx.fill();

    // Bobber body (white bottom)
    ctx.fillStyle = PAL.white;
    ctx.beginPath();
    ctx.ellipse(endX, bobberY - 4 * s, 4 * s, 6 * s, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Bobber highlight
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(endX - 2 * s, bobberY - 6 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hook (below water line when waiting/bite)
  if (state === 'waiting' || state === 'bite' || state === 'reeling') {
    const hookY = endY + 20 * s;
    ctx.strokeStyle = PAL.silver;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(endX, endY + 10 * s);
    ctx.lineTo(endX, hookY);
    ctx.arc(endX + 3 * s, hookY, 3 * s, Math.PI, 0, true);
    ctx.stroke();
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function FishingGame() {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [fish, setFish] = useState<FishEntity[]>([]);
  const [bubbles, setBubbles] = useState<BubbleEntity[]>([]);
  const [castPosition, setCastPosition] = useState({ x: SCREEN_W / 2, y: WATER_LINE + 30 * SCALE });
  const [score, setScore] = useState(0);
  const [collection, setCollection] = useState<CaughtFish[]>([]);
  const [frame, setFrame] = useState(0);
  const [lastCatch, setLastCatch] = useState<FishType | null>(null);
  const [biteTimer, setBiteTimer] = useState(0);
  const [hookedFish, setHookedFish] = useState<FishEntity | null>(null);
  const [reelingProgress, setReelingProgress] = useState(0);
  const [message, setMessage] = useState('Click anywhere in the water to cast!');

  // Tension mechanic state
  const [tension, setTension] = useState(50); // 0-100, starts at middle
  const [tensionFullTimer, setTensionFullTimer] = useState(0); // ms at full tension
  const [tensionEmptyTimer, setTensionEmptyTimer] = useState(0); // ms at empty tension
  const [isReeling, setIsReeling] = useState(false); // track if player is actively reeling

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fishId = useRef(0);
  const bubbleId = useRef(0);
  const gameStateRef = useRef<GameState>(gameState); // Ref for current state (avoids stale closures)
  const reelingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Track reeling timeout to avoid overlaps
  const hookedFishRef = useRef<FishEntity | null>(null); // Ref to avoid stale hookedFish in callbacks
  const fishRef = useRef<FishEntity[]>(fish);
  const castPositionRef = useRef(castPosition);

  // Keep refs in sync with state
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    hookedFishRef.current = hookedFish;
  }, [hookedFish]);

  useEffect(() => {
    fishRef.current = fish;
  }, [fish]);

  useEffect(() => {
    castPositionRef.current = castPosition;
  }, [castPosition]);

  // Audio context for tension sounds
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Initialize audio context
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Play tension warning sound
  const playTensionSound = useCallback((tensionLevel: number) => {
    const ctx = initAudio();
    if (!ctx) return;

    // Only play when tension is high (>80)
    if (tensionLevel < 80) {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current = null;
      }
      return;
    }

    // Create oscillator if not exists
    if (!oscillatorRef.current) {
      oscillatorRef.current = ctx.createOscillator();
      gainNodeRef.current = ctx.createGain();

      oscillatorRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(ctx.destination);

      oscillatorRef.current.type = 'square';
      oscillatorRef.current.start();
    }

    // Frequency increases with tension (400Hz at 80% to 800Hz at 100%)
    const freq = 400 + ((tensionLevel - 80) / 20) * 400;
    oscillatorRef.current.frequency.setValueAtTime(freq, ctx.currentTime);

    // Volume pulses - faster at higher tension
    const pulseRate = 2 + ((tensionLevel - 80) / 20) * 8; // 2-10 pulses per second
    const time = ctx.currentTime;
    const pulseDuration = 1 / pulseRate;

    if (gainNodeRef.current) {
      // Create pulsing effect
      const intensity = (tensionLevel - 80) / 20; // 0 to 1
      gainNodeRef.current.gain.setValueAtTime(0.1 * intensity, time);
      gainNodeRef.current.gain.linearRampToValueAtTime(0.3 * intensity, time + pulseDuration * 0.5);
      gainNodeRef.current.gain.linearRampToValueAtTime(0.1 * intensity, time + pulseDuration);
    }
  }, [initAudio]);

  // Stop tension sound
  const stopTensionSound = useCallback(() => {
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current = null;
    }
  }, []);

  // Fisher position (on dock)
  const fisherX = 90 * SCALE;
  const fisherY = DOCK_Y;
  const rodTipX = fisherX + 52 * SCALE;
  const rodTipY = fisherY - 28 * SCALE;

  // Spawn fish periodically
  useEffect(() => {
    const spawnInterval = setInterval(() => {
      if (fish.length < 8) {
        const roll = Math.random();
        let selectedType = FISH_TYPES[0];
        for (const ft of FISH_TYPES) {
          if (roll > ft.rarity) selectedType = ft;
        }

        fishId.current++;
        const facing = Math.random() > 0.5 ? 1 : -1;
        const depth = selectedType.minDepth + Math.random() * (selectedType.maxDepth - selectedType.minDepth);

        setFish(prev => [...prev, {
          id: fishId.current,
          type: selectedType,
          x: facing === 1 ? -30 * SCALE : SCREEN_W + 30 * SCALE,
          y: WATER_LINE + depth * (SCREEN_H - WATER_LINE),
          vx: facing * selectedType.speed * SCALE * 0.5,
          facing,
          animFrame: 0,
          interested: false,
          hooked: false,
        }]);
      }
    }, 2000);

    return () => clearInterval(spawnInterval);
  }, [fish.length]);

  // Spawn bubbles
  useEffect(() => {
    const bubbleInterval = setInterval(() => {
      if (bubbles.length < 15) {
        bubbleId.current++;
        setBubbles(prev => [...prev, {
          id: bubbleId.current,
          x: Math.random() * SCREEN_W,
          y: SCREEN_H + 10,
          size: 1 + Math.random() * 3,
          speed: 0.5 + Math.random() * 1.5,
        }]);
      }
    }, 500);

    return () => clearInterval(bubbleInterval);
  }, [bubbles.length]);

  // Handle bite timing
  useEffect(() => {
    if (gameState === 'waiting') {
      const biteCheck = setInterval(() => {
        // Use refs to get current data without triggering effect re-runs
        const currentFish = fishRef.current;
        const currentCastPos = castPositionRef.current;

        // Check if any fish is near the hook (exclude already interested or hooked fish)
        const nearbyFish = currentFish.filter(f => {
          const dx = Math.abs(f.x - currentCastPos.x);
          const dy = Math.abs(f.y - (currentCastPos.y + 20 * SCALE));
          return dx < 40 * SCALE && dy < 30 * SCALE && !f.hooked && !f.interested;
        });

        if (nearbyFish.length > 0 && Math.random() > 0.7) {
          const bitingFish = nearbyFish[Math.floor(Math.random() * nearbyFish.length)];
          setFish(prev => prev.map(f =>
            f.id === bitingFish.id ? { ...f, interested: true } : f
          ));

          // After showing interest, fish bites
          setTimeout(() => {
            // Use ref to check current state (avoids stale closure)
            if (gameStateRef.current === 'waiting') {
              setGameState('bite');
              setHookedFish(bitingFish);
              setMessage('BITE! Click rapidly to reel in!');
              setBiteTimer(180); // 3 seconds to react
            }
          }, 500 + Math.random() * 1000);
        }
      }, 1000);

      return () => clearInterval(biteCheck);
    }
  }, [gameState]); // Only depend on gameState transition to 'waiting'

  // Bite timer countdown
  useEffect(() => {
    if (gameState === 'bite' && biteTimer > 0) {
      const timer = setInterval(() => {
        // Check current state via ref to avoid race condition
        if (gameStateRef.current !== 'bite') {
          return; // Player already clicked to reel, don't trigger escape
        }
        setBiteTimer(prev => {
          if (prev <= 1) {
            setGameState('escaped');
            setMessage('The fish got away! Click to try again.');
            setHookedFish(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000 / 60);

      return () => clearInterval(timer);
    }
  }, [gameState, biteTimer]);

  // Reeling progress and tension mechanics
  useEffect(() => {
    if (gameState === 'reeling') {
      const TICK_RATE = 60; // 60fps
      const TICK_MS = 1000 / TICK_RATE;

      const gameLoop = setInterval(() => {
        // Reeling progress decay (fish pulls back)
        setReelingProgress(prev => {
          const decay = hookedFish ? 0.3 + (hookedFish.type.size * 0.2) : 0.3; // Bigger fish fight harder
          return Math.max(0, prev - decay);
        });

        // Tension mechanics - single setTension call that handles everything
        setTension(prev => {
          let newTension = prev;

          if (isReeling) {
            // Reeling increases tension
            newTension = Math.min(100, prev + 2);
          } else {
            // Not reeling decreases tension
            newTension = Math.max(0, prev - 1.5);
          }

          // Play tension sound based on level
          playTensionSound(newTension);

          // Handle tension timers based on NEW tension value
          // Full tension timer (line about to break)
          if (newTension >= 100) {
            setTensionFullTimer(prevTimer => {
              // Timer increases faster if still reeling (more strain)
              const increment = isReeling ? TICK_MS * 1.5 : TICK_MS;
              const newTimer = prevTimer + increment;

              // Base break time is 1250ms, reduced to 750ms if actively reeling
              const breakTime = isReeling ? 750 : 1250;

              if (newTimer >= breakTime) {
                // LINE BREAKS!
                setGameState('escaped');
                setMessage('LINE SNAPPED! Too much tension!');
                setHookedFish(null);
                setFish(fishList => fishList.map(f => ({ ...f, hooked: false })));
                stopTensionSound();
                return 0;
              }
              return newTimer;
            });
          } else {
            setTensionFullTimer(0);
          }

          // Empty tension timer (fish shakes hook)
          if (newTension <= 0) {
            setTensionEmptyTimer(prevTimer => {
              const newTimer = prevTimer + TICK_MS;

              if (newTimer >= 2000) { // 2 seconds at zero tension
                // FISH ESCAPES!
                setGameState('escaped');
                setMessage('Fish shook the hook! Keep some tension!');
                setHookedFish(null);
                setFish(fishList => fishList.map(f => ({ ...f, hooked: false })));
                stopTensionSound();
                return 0;
              }
              return newTimer;
            });
          } else {
            setTensionEmptyTimer(0);
          }

          return newTension;
        });

      }, TICK_MS);

      return () => {
        clearInterval(gameLoop);
        stopTensionSound();
      };
    } else {
      // Reset tension when not reeling
      setTension(50);
      setTensionFullTimer(0);
      setTensionEmptyTimer(0);
      setIsReeling(false);
      stopTensionSound();
    }
  }, [gameState, isReeling, hookedFish, playTensionSound, stopTensionSound]);

  // Main game loop
  useEffect(() => {
    const loop = setInterval(() => {
      setFrame(f => f + 1);

      // Update fish positions
      setFish(prev => prev.map(f => {
        if (f.hooked) {
          // Move toward fisher when reeling
          const dx = rodTipX - f.x;
          const dy = rodTipY - f.y;
          return {
            ...f,
            x: f.x + dx * 0.02,
            y: f.y + dy * 0.02,
            animFrame: f.animFrame + 1,
          };
        }
        return {
          ...f,
          x: f.x + f.vx,
          animFrame: f.animFrame + 1,
        };
      }).filter(f => {
        // Remove fish that swim off screen (unless hooked)
        if (f.hooked) return true;
        return f.x > -50 * SCALE && f.x < SCREEN_W + 50 * SCALE;
      }));

      // Update bubbles
      setBubbles(prev => prev.map(b => ({
        ...b,
        y: b.y - b.speed * SCALE,
        x: b.x + Math.sin(b.y * 0.02) * 0.5,
      })).filter(b => b.y > WATER_LINE - 10));

    }, FRAME_TIME);

    return () => clearInterval(loop);
  }, [rodTipX, rodTipY]);

  // Handle canvas click
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = SCREEN_W / rect.width;
    const scaleY = SCREEN_H / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    if (gameState === 'idle' || gameState === 'escaped' || gameState === 'caught') {
      // Cast if clicking in water
      if (clickY > WATER_LINE) {
        setGameState('casting');
        setCastPosition({ x: clickX, y: clickY });
        setLastCatch(null);
        setMessage('Casting...');

        setTimeout(() => {
          setGameState('waiting');
          setMessage('Waiting for a bite...');
        }, 500);
      }
    } else if (gameState === 'bite') {
      // Start reeling - initialize audio on first interaction
      initAudio();
      setGameState('reeling');
      setReelingProgress(50);
      setTension(50);
      setTensionFullTimer(0);
      setTensionEmptyTimer(0);
      if (hookedFish) {
        setFish(prev => prev.map(f =>
          f.id === hookedFish.id ? { ...f, hooked: true, interested: false } : f
        ));
      }
      setMessage('Balance the tension! Don\'t let it max out or empty!');
    } else if (gameState === 'reeling') {
      // Mark as actively reeling
      setIsReeling(true);

      // Clear previous timeout to avoid overlapping resets (Bug 6 fix)
      if (reelingTimeoutRef.current) {
        clearTimeout(reelingTimeoutRef.current);
      }
      // Brief reeling action - will be reset after a short delay
      reelingTimeoutRef.current = setTimeout(() => setIsReeling(false), 150);

      // Increase reeling progress (tension penalty handled by game loop's isReeling check)
      setReelingProgress(prev => {
        // Bug 9 fix: Check current state before processing catch
        if (gameStateRef.current !== 'reeling') {
          return prev; // State changed (line broke/fish escaped), don't process
        }

        const currentFish = hookedFishRef.current; // Use ref for current value
        const newProg = Math.min(100, prev + 5);

        if (newProg >= 100 && currentFish) {
          // Caught the fish!
          setGameState('caught');
          setScore(s => s + currentFish.type.points);
          setLastCatch(currentFish.type);
          setMessage(`Caught a ${currentFish.type.name}! +${currentFish.type.points} points!`);
          stopTensionSound();

          // Add to collection
          setCollection(prevColl => {
            const existing = prevColl.find(c => c.type.name === currentFish.type.name);
            if (existing) {
              return prevColl.map(c =>
                c.type.name === currentFish.type.name
                  ? { ...c, count: c.count + 1 }
                  : c
              );
            }
            return [...prevColl, { type: currentFish.type, count: 1 }];
          });

          // Remove the caught fish
          setFish(prevFish => prevFish.filter(f => f.id !== currentFish.id));
          setHookedFish(null);
        }
        return newProg;
      });

      // Bug 3 fix: Removed duplicate setTension here - game loop already handles tension via isReeling
    }
  }, [gameState, hookedFish, initAudio, stopTensionSound]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // Background
    drawBackground(ctx, frame);

    // Bubbles (behind fish)
    bubbles.forEach(b => drawBubble(ctx, b));

    // Fish
    fish.forEach(f => drawFish(ctx, f, frame));

    // Fishing line
    drawFishingLine(ctx, rodTipX, rodTipY, castPosition.x, castPosition.y, gameState, frame);

    // Fisher
    drawFisher(ctx, fisherX, fisherY, gameState, frame);

    // Catch celebration effect (Neo Geo style burst)
    if (gameState === 'caught' && lastCatch) {
      // Radial burst lines
      ctx.strokeStyle = PAL.neoYellow;
      ctx.lineWidth = 3;
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + frame * 0.1;
        const innerR = 30 * SCALE;
        const outerR = (50 + Math.sin(frame * 0.3 + i) * 10) * SCALE;
        ctx.beginPath();
        ctx.moveTo(
          fisherX + Math.cos(angle) * innerR,
          fisherY - 30 * SCALE + Math.sin(angle) * innerR
        );
        ctx.lineTo(
          fisherX + Math.cos(angle) * outerR,
          fisherY - 30 * SCALE + Math.sin(angle) * outerR
        );
        ctx.stroke();
      }

      // "CATCH!" text (Neo Geo style)
      ctx.fillStyle = PAL.outline;
      ctx.font = `bold ${24 * SCALE}px "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('CATCH!', fisherX + 2, fisherY - 60 * SCALE + 2);
      ctx.fillStyle = PAL.neoYellow;
      ctx.fillText('CATCH!', fisherX, fisherY - 60 * SCALE);
    }

    // === NEO GEO CRT SCANLINES ===
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for (let y = 0; y < SCREEN_H; y += 4) {
      ctx.fillRect(0, y, SCREEN_W, 2);
    }

    // Slight vignette (darker corners)
    const vignette = ctx.createRadialGradient(
      SCREEN_W / 2, SCREEN_H / 2, SCREEN_H * 0.4,
      SCREEN_W / 2, SCREEN_H / 2, SCREEN_H * 0.8
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  }, [fish, bubbles, frame, gameState, castPosition, lastCatch, fisherX, fisherY, rodTipX, rodTipY]);

  const totalCaught = collection.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="fishing-game">
      <header className="fg-header">
        <div className="fg-title">
          <Fish className="fg-logo" />
          <div>
            <h1>FISHING AGENT</h1>
            <span className="fg-subtitle"><Waves size={12} /> Relaxing Fishing Simulator</span>
          </div>
        </div>

        <div className="fg-stats">
          <div className="stat-box">
            <span className="stat-icon"><Anchor size={14} /></span>
            <span className="stat-value">{score}</span>
            <span className="stat-label">Points</span>
          </div>
          <div className="stat-box">
            <span className="stat-icon"><Fish size={14} /></span>
            <span className="stat-value">{totalCaught}</span>
            <span className="stat-label">Caught</span>
          </div>
          <div className="stat-box">
            <span className="stat-icon">📚</span>
            <span className="stat-value">{collection.length}/{FISH_TYPES.length}</span>
            <span className="stat-label">Species</span>
          </div>
        </div>
      </header>

      <div className="fg-main">
        <div className="fg-canvas-container">
          <canvas
            ref={canvasRef}
            className="fg-canvas"
            width={SCREEN_W}
            height={SCREEN_H}
            onClick={handleClick}
          />

          {/* Message overlay */}
          <div className="fg-message">{message}</div>

          {/* Reeling HUD with tension meter */}
          {gameState === 'reeling' && (
            <div className="fg-fishing-hud">
              {/* Catch progress bar */}
              <div className="fg-reel-bar">
                <div className="reel-label">CATCH PROGRESS</div>
                <div className="reel-track">
                  <div className="reel-fill" style={{ width: `${reelingProgress}%` }} />
                </div>
              </div>

              {/* Tension meter */}
              <div className={`fg-tension-meter ${tension >= 80 ? 'danger' : tension <= 20 ? 'low' : ''}`}>
                <div className="tension-label">
                  {tension >= 100 ? '⚠️ LINE BREAKING!' :
                    tension >= 80 ? '⚠️ HIGH TENSION!' :
                      tension <= 0 ? '⚠️ HOOK LOOSENING!' :
                        tension <= 20 ? '⚠️ LOW TENSION!' :
                          'TENSION'}
                </div>
                <div className="tension-track">
                  <div className="tension-zone tension-zone--low" />
                  <div className="tension-zone tension-zone--safe" />
                  <div className="tension-zone tension-zone--high" />
                  <div
                    className="tension-indicator"
                    style={{ left: `${tension}%` }}
                  />
                  {/* Danger threshold markers */}
                  <div className="tension-marker tension-marker--low" style={{ left: '20%' }} />
                  <div className="tension-marker tension-marker--high" style={{ left: '80%' }} />
                </div>
                {/* Timer warnings */}
                {tensionFullTimer > 0 && (
                  <div className="tension-warning tension-warning--break">
                    LINE SNAP IN: {((tension >= 100 && isReeling ? 750 : 1250) - tensionFullTimer).toFixed(0)}ms
                  </div>
                )}
                {tensionEmptyTimer > 0 && (
                  <div className="tension-warning tension-warning--loose">
                    HOOK SHAKE IN: {(2000 - tensionEmptyTimer).toFixed(0)}ms
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="fg-reel-instructions">
                <span>CLICK = Reel (↑ tension)</span>
                <span>WAIT = Release (↓ tension)</span>
              </div>
            </div>
          )}

          {/* Bite indicator */}
          {gameState === 'bite' && (
            <div className="fg-bite-alert">
              <span className="bite-text">BITE!</span>
              <span className="bite-timer">{Math.ceil(biteTimer / 60)}s</span>
            </div>
          )}
        </div>

        <div className="fg-sidebar">
          <div className="fg-panel">
            <h3 className="panel-title"><Fish size={16} /> Collection</h3>
            <div className="fish-collection">
              {FISH_TYPES.map(ft => {
                const caught = collection.find(c => c.type.name === ft.name);
                return (
                  <div
                    key={ft.name}
                    className={`collection-item ${caught ? 'collected' : 'locked'}`}
                    style={{ borderColor: caught ? ft.color : undefined }}
                  >
                    <div className="fish-icon" style={{ background: caught ? ft.color : '#333' }}>
                      {caught ? <Fish size={20} /> : '?'}
                    </div>
                    <div className="fish-info">
                      <span className="fish-name">{caught ? ft.name : '???'}</span>
                      <span className="fish-count">{caught ? `x${caught.count}` : ''}</span>
                    </div>
                    <span className="fish-points">{caught ? `${ft.points}pts` : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="fg-panel fg-panel--tips">
            <h3 className="panel-title"><Anchor size={16} /> Tips</h3>
            <ul className="tips-list">
              <li>Click in the water to cast your line</li>
              <li>Wait for a fish to bite (watch for the bobber!)</li>
              <li>Click rapidly when you get a bite to reel in</li>
              <li>Rare fish are found in deeper water</li>
              <li>The Golden Koi is legendary...</li>
            </ul>
          </div>
        </div>
      </div>

      <footer className="fg-footer">
        <div className="footer-left"><span className="status-dot status-dot--online" /> Lake Mode</div>
        <div className="footer-center">Frame: {frame}</div>
        <div className="footer-right">Fishing Agent v1.0</div>
      </footer>
    </div>
  );
}
