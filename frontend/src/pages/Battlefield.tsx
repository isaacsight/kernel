import { useState, useEffect, useRef, useCallback } from 'react';
import { Skull, Shield, Flame } from 'lucide-react';
import './Battlefield.css';

// ═══════════════════════════════════════════════════════════════════════════
// GHOSTS 'N GOBLINS - Authentic Recreation
// Faithful to original arcade/NES mechanics and visuals
// ═══════════════════════════════════════════════════════════════════════════

// Original GnG runs at 60fps with specific frame-based timings
const FRAME_TIME = 1000 / 60;

// Original resolution scaled up (256x224 NES → 512x448)
const SCALE = 2;
const SCREEN_W = 256 * SCALE;
const SCREEN_H = 224 * SCALE;

// Physics (original values)
const GRAVITY = 0.25 * SCALE;
const ARTHUR_WALK_SPEED = 1.5 * SCALE;
const ARTHUR_JUMP_VELOCITY = -5 * SCALE;
const MAX_FALL_SPEED = 4 * SCALE;

// Original NES Palette (exact hex values from hardware)
const PAL = {
  // Background colors
  black: '#000000',
  darkBlue: '#0000AC',
  blue: '#0058F8',
  skyBlue: '#3CBCFC',

  // Grays
  gray1: '#BCBCBC',
  gray2: '#7C7C7C',
  gray3: '#4C4C4C',

  // Greens (vegetation, zombies)
  darkGreen: '#005800',
  green: '#00A800',
  lightGreen: '#B8F818',

  // Browns (ground, wood)
  darkBrown: '#503000',
  brown: '#AC7C00',
  tan: '#F8B800',

  // Reds (Arthur armor, Red Arremer)
  darkRed: '#A80000',
  red: '#F83800',
  pink: '#F878F8',

  // Skin
  skin: '#FCBCB0',
  skinDark: '#F0A0A0',

  // White
  white: '#FCFCFC',

  // Purple (magic, special)
  purple: '#6844FC',
};

// Types
interface Vector2 { x: number; y: number; }
type Facing = -1 | 1;
type ArmorState = 'armor' | 'underwear' | 'dead';
type WeaponType = 'lance' | 'dagger' | 'torch';
type AgentState = 'stand' | 'walk' | 'jump' | 'crouch' | 'throw' | 'hit' | 'dead' | 'climb';
type EnemyType = 'zombie' | 'redArremer' | 'crow' | 'greenMonster';
type EnemyState = 'spawn' | 'active' | 'attack' | 'dying' | 'dead';

interface Agent {
  id: string;
  name: string;
  faction: 'claude' | 'gemini';
  pos: Vector2;
  vel: Vector2;
  facing: Facing;
  armor: ArmorState;
  weapon: WeaponType;
  state: AgentState;
  grounded: boolean;
  jumpLocked: boolean; // GnG committed jump
  crouching: boolean;
  onLadder: boolean;
  throwing: boolean;
  throwTimer: number;
  invincible: number;
  animFrame: number;
  score: number;
  // AI
  targetX: number;
  attackCooldown: number;
  thinkTimer: number;
}

interface Enemy {
  id: number;
  type: EnemyType;
  pos: Vector2;
  vel: Vector2;
  facing: Facing;
  state: EnemyState;
  hp: number;
  animFrame: number;
  stateTimer: number;
  // Red Arremer specific
  hoverY?: number;
  diveTarget?: Vector2;
}

interface Projectile {
  id: number;
  type: WeaponType;
  pos: Vector2;
  vel: Vector2;
  ownerId: string;
  ttl: number;
}

interface Grave {
  x: number;
  y: number;
  spawnTimer: number;
  spawned: boolean;
}

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'ground' | 'stone' | 'float';
}

interface Ladder {
  x: number;
  topY: number;
  bottomY: number;
}

interface WeaponPot {
  id: number;
  x: number;
  y: number;
  weapon: WeaponType;
  broken: boolean;
}

interface LogEntry {
  id: number;
  agent: string;
  msg: string;
  type: 'info' | 'success' | 'warning' | 'danger';
}

// ═══════════════════════════════════════════════════════════════════════════
// SPRITE DRAWING - Authentic pixel art style
// ═══════════════════════════════════════════════════════════════════════════

// Arthur sprite (standing, 16x24 effective, scaled)
const drawArthur = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  armor: ArmorState,
  state: AgentState,
  facing: Facing,
  frame: number,
  faction: 'claude' | 'gemini'
) => {
  if (armor === 'dead') return;

  ctx.save();
  ctx.translate(x, y);
  if (facing === -1) ctx.scale(-1, 1);

  const s = SCALE; // pixel size
  const armored = armor === 'armor';

  // Colors based on faction and armor state
  const mainColor = armored
    ? (faction === 'claude' ? PAL.blue : PAL.purple)
    : PAL.red;
  const lightColor = armored
    ? (faction === 'claude' ? PAL.skyBlue : PAL.pink)
    : PAL.pink;
  const darkColor = armored
    ? (faction === 'claude' ? PAL.darkBlue : PAL.purple)
    : PAL.darkRed;

  // Animation offset
  const walkBob = state === 'walk' ? Math.floor(Math.sin(frame * 0.5) * 2) * s : 0;
  const crouchOffset = state === 'crouch' ? 8 * s : 0;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-6*s, -s, 12*s, 2*s);

  // Legs
  if (state !== 'crouch') {
    const legAnim = state === 'walk' ? Math.floor(Math.sin(frame * 0.4) * 3) * s : 0;
    ctx.fillStyle = armored ? mainColor : PAL.skin;
    ctx.fillRect(-4*s, -12*s, 3*s, 12*s + legAnim);
    ctx.fillRect(1*s, -12*s, 3*s, 12*s - legAnim);
    // Feet
    ctx.fillStyle = armored ? darkColor : PAL.skinDark;
    ctx.fillRect(-5*s, -2*s + legAnim, 4*s, 2*s);
    ctx.fillRect(1*s, -2*s - legAnim, 4*s, 2*s);
  } else {
    // Crouching legs
    ctx.fillStyle = armored ? mainColor : PAL.skin;
    ctx.fillRect(-4*s, -6*s, 8*s, 6*s);
  }

  // Body
  const bodyY = -24*s + crouchOffset + walkBob;
  if (armored) {
    // Armor body
    ctx.fillStyle = mainColor;
    ctx.fillRect(-6*s, bodyY, 12*s, 12*s);
    // Chest plate highlight
    ctx.fillStyle = lightColor;
    ctx.fillRect(-4*s, bodyY + 2*s, 4*s, 4*s);
    // Armor shadow
    ctx.fillStyle = darkColor;
    ctx.fillRect(0, bodyY + 4*s, 4*s, 6*s);
  } else {
    // Bare chest
    ctx.fillStyle = PAL.skin;
    ctx.fillRect(-5*s, bodyY + 2*s, 10*s, 8*s);
    // Red underwear/shorts
    ctx.fillStyle = PAL.red;
    ctx.fillRect(-5*s, bodyY + 8*s, 10*s, 4*s);
  }

  // Head
  const headY = bodyY - 10*s;
  ctx.fillStyle = PAL.skin;
  ctx.fillRect(-5*s, headY, 10*s, 10*s);

  // Hair/Helmet
  if (armored) {
    ctx.fillStyle = mainColor;
    ctx.fillRect(-6*s, headY - 2*s, 12*s, 6*s);
    // Helmet crest
    ctx.fillStyle = PAL.red;
    ctx.fillRect(-s, headY - 6*s, 2*s, 4*s);
  } else {
    // Brown hair
    ctx.fillStyle = PAL.brown;
    ctx.fillRect(-5*s, headY - 2*s, 10*s, 5*s);
  }

  // Eyes
  ctx.fillStyle = PAL.white;
  ctx.fillRect(-3*s, headY + 3*s, 2*s, 2*s);
  ctx.fillRect(1*s, headY + 3*s, 2*s, 2*s);
  ctx.fillStyle = PAL.black;
  ctx.fillRect(-2*s, headY + 4*s, s, s);
  ctx.fillRect(2*s, headY + 4*s, s, s);

  // Arm (throwing arm)
  const armY = bodyY + 4*s;
  if (state === 'throw') {
    // Extended arm
    ctx.fillStyle = armored ? mainColor : PAL.skin;
    ctx.fillRect(4*s, armY, 12*s, 4*s);
  } else {
    // Normal arm
    ctx.fillStyle = armored ? mainColor : PAL.skin;
    const armSwing = state === 'walk' ? Math.floor(Math.sin(frame * 0.4 + Math.PI) * 2) * s : 0;
    ctx.fillRect(5*s, armY + armSwing, 6*s, 4*s);
  }

  ctx.restore();
};

// Zombie sprite
const drawZombie = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  facing: Facing,
  state: EnemyState,
  frame: number,
  stateTimer: number
) => {
  if (state === 'dead') return;

  ctx.save();
  ctx.translate(x, y);
  if (facing === -1) ctx.scale(-1, 1);

  const s = SCALE;

  // Spawn animation - rising from ground
  let riseOffset = 0;
  let alpha = 1;
  if (state === 'spawn') {
    const progress = Math.min(1, stateTimer / 60);
    riseOffset = (1 - progress) * 20 * s;
    alpha = progress;
  }
  if (state === 'dying') alpha = 0.5;

  ctx.globalAlpha = alpha;

  const bob = Math.floor(Math.sin(frame * 0.15) * 2) * s;
  const yOff = riseOffset + bob;

  // Body (green/brown tattered)
  ctx.fillStyle = PAL.darkGreen;
  ctx.fillRect(-5*s, -24*s + yOff, 10*s, 16*s);

  // Torn clothing patches
  ctx.fillStyle = PAL.brown;
  ctx.fillRect(-3*s, -20*s + yOff, 3*s, 4*s);
  ctx.fillRect(1*s, -16*s + yOff, 3*s, 3*s);

  // Head
  ctx.fillStyle = PAL.green;
  ctx.fillRect(-4*s, -32*s + yOff, 8*s, 8*s);

  // Sunken eyes
  ctx.fillStyle = PAL.black;
  ctx.fillRect(-2*s, -30*s + yOff, 2*s, 2*s);
  ctx.fillRect(1*s, -29*s + yOff, 2*s, 2*s);

  // Reaching arms
  ctx.fillStyle = PAL.darkGreen;
  const armReach = Math.floor(Math.sin(frame * 0.2) * 3) * s;
  ctx.fillRect(4*s, -22*s + yOff + armReach, 8*s, 3*s);
  ctx.fillRect(-12*s, -20*s + yOff - armReach, 8*s, 3*s);

  // Legs (shuffling)
  const legAnim = Math.floor(Math.sin(frame * 0.2) * 2) * s;
  ctx.fillRect(-4*s, -8*s + yOff, 3*s, 8*s + legAnim);
  ctx.fillRect(1*s, -8*s + yOff, 3*s, 8*s - legAnim);

  ctx.globalAlpha = 1;
  ctx.restore();
};

// Red Arremer (flying demon)
const drawRedArremer = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  facing: Facing,
  state: EnemyState,
  frame: number
) => {
  if (state === 'dead') return;

  ctx.save();
  ctx.translate(x, y);
  if (facing === -1) ctx.scale(-1, 1);

  const s = SCALE;
  const wingFlap = Math.sin(frame * 0.4) * 20;

  // Wings
  ctx.fillStyle = PAL.red;
  ctx.save();
  ctx.translate(-6*s, -20*s);
  ctx.rotate((-30 + wingFlap) * Math.PI / 180);
  ctx.fillRect(-14*s, -2*s, 14*s, 8*s);
  ctx.restore();

  ctx.save();
  ctx.translate(6*s, -20*s);
  ctx.rotate((30 - wingFlap) * Math.PI / 180);
  ctx.fillRect(0, -2*s, 14*s, 8*s);
  ctx.restore();

  // Body
  ctx.fillStyle = PAL.red;
  ctx.fillRect(-5*s, -24*s, 10*s, 16*s);

  // Head
  ctx.fillStyle = PAL.red;
  ctx.fillRect(-4*s, -34*s, 8*s, 10*s);

  // Horns
  ctx.fillStyle = PAL.darkRed;
  ctx.beginPath();
  ctx.moveTo(-3*s, -34*s);
  ctx.lineTo(-6*s, -42*s);
  ctx.lineTo(-1*s, -36*s);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(3*s, -34*s);
  ctx.lineTo(6*s, -42*s);
  ctx.lineTo(1*s, -36*s);
  ctx.fill();

  // Yellow eyes
  ctx.fillStyle = PAL.tan;
  ctx.fillRect(-2*s, -32*s, 2*s, 2*s);
  ctx.fillRect(1*s, -32*s, 2*s, 2*s);

  // Legs
  ctx.fillStyle = PAL.darkRed;
  ctx.fillRect(-3*s, -8*s, 2*s, 8*s);
  ctx.fillRect(1*s, -8*s, 2*s, 8*s);

  ctx.restore();
};

// Arthur climbing sprite
const drawArthurClimbing = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  armor: ArmorState,
  frame: number,
  faction: 'claude' | 'gemini'
) => {
  if (armor === 'dead') return;

  ctx.save();
  ctx.translate(x, y);

  const s = SCALE;
  const armored = armor === 'armor';
  const mainColor = armored
    ? (faction === 'claude' ? PAL.blue : PAL.purple)
    : PAL.red;

  // Climbing animation (arms alternating)
  const climbOffset = Math.floor(Math.sin(frame * 0.3) * 3) * s;

  // Body
  ctx.fillStyle = armored ? mainColor : PAL.skin;
  ctx.fillRect(-5*s, -24*s, 10*s, 16*s);

  // Head
  ctx.fillStyle = PAL.skin;
  ctx.fillRect(-4*s, -32*s, 8*s, 8*s);

  // Arms reaching for ladder
  ctx.fillStyle = armored ? mainColor : PAL.skin;
  ctx.fillRect(-8*s, -26*s + climbOffset, 4*s, 6*s);
  ctx.fillRect(4*s, -22*s - climbOffset, 4*s, 6*s);

  // Legs
  ctx.fillRect(-3*s, -8*s + climbOffset, 2*s, 8*s);
  ctx.fillRect(1*s, -8*s - climbOffset, 2*s, 8*s);

  ctx.restore();
};

// Ladder sprite
const drawLadder = (ctx: CanvasRenderingContext2D, ladder: Ladder) => {
  const s = SCALE;
  const height = ladder.bottomY - ladder.topY;

  // Side rails (brown wood)
  ctx.fillStyle = PAL.darkBrown;
  ctx.fillRect(ladder.x - 6*s, ladder.topY, 3*s, height);
  ctx.fillRect(ladder.x + 3*s, ladder.topY, 3*s, height);

  // Rungs
  ctx.fillStyle = PAL.brown;
  for (let y = ladder.topY + 8*s; y < ladder.bottomY; y += 12*s) {
    ctx.fillRect(ladder.x - 5*s, y, 10*s, 3*s);
  }
};

// Weapon pot sprite
const drawWeaponPot = (ctx: CanvasRenderingContext2D, pot: WeaponPot) => {
  if (pot.broken) return;

  const s = SCALE;
  ctx.save();
  ctx.translate(pot.x, pot.y);

  // Pot body (clay colored)
  ctx.fillStyle = PAL.brown;
  ctx.beginPath();
  ctx.moveTo(-6*s, 0);
  ctx.lineTo(-8*s, -12*s);
  ctx.lineTo(-4*s, -16*s);
  ctx.lineTo(4*s, -16*s);
  ctx.lineTo(8*s, -12*s);
  ctx.lineTo(6*s, 0);
  ctx.closePath();
  ctx.fill();

  // Pot rim
  ctx.fillStyle = PAL.tan;
  ctx.fillRect(-5*s, -18*s, 10*s, 3*s);

  // Highlight
  ctx.fillStyle = PAL.tan;
  ctx.fillRect(-5*s, -14*s, 3*s, 6*s);

  ctx.restore();
};

// Lance projectile
const drawLance = (ctx: CanvasRenderingContext2D, x: number, y: number, facing: Facing) => {
  ctx.save();
  ctx.translate(x, y);
  if (facing === -1) ctx.scale(-1, 1);

  const s = SCALE;

  // Lance head (gold)
  ctx.fillStyle = PAL.tan;
  ctx.beginPath();
  ctx.moveTo(10*s, 0);
  ctx.lineTo(0, -3*s);
  ctx.lineTo(0, 3*s);
  ctx.fill();

  // Shaft
  ctx.fillStyle = PAL.brown;
  ctx.fillRect(-8*s, -2*s, 10*s, 4*s);

  ctx.restore();
};

// ═══════════════════════════════════════════════════════════════════════════
// LEVEL - Stage 1: The Graveyard (authentic layout)
// ═══════════════════════════════════════════════════════════════════════════

const createLevel = () => {
  const platforms: Platform[] = [];
  const graves: Grave[] = [];
  const ladders: Ladder[] = [];

  // Main ground (spans entire level)
  platforms.push({ x: 0, y: SCREEN_H - 32*SCALE, w: SCREEN_W, h: 32*SCALE, type: 'ground' });

  // Stone platforms (authentic GnG layout)
  platforms.push({ x: 60*SCALE, y: SCREEN_H - 80*SCALE, w: 48*SCALE, h: 12*SCALE, type: 'stone' });
  platforms.push({ x: 180*SCALE, y: SCREEN_H - 100*SCALE, w: 40*SCALE, h: 12*SCALE, type: 'stone' });
  platforms.push({ x: 300*SCALE, y: SCREEN_H - 70*SCALE, w: 56*SCALE, h: 12*SCALE, type: 'stone' });
  platforms.push({ x: 400*SCALE, y: SCREEN_H - 90*SCALE, w: 48*SCALE, h: 12*SCALE, type: 'stone' });

  // Floating platform over pit
  platforms.push({ x: 240*SCALE, y: SCREEN_H - 56*SCALE, w: 32*SCALE, h: 8*SCALE, type: 'float' });

  // Ladders (authentic GnG - connect ground to platforms)
  ladders.push({ x: 84*SCALE, topY: SCREEN_H - 80*SCALE, bottomY: SCREEN_H - 32*SCALE });
  ladders.push({ x: 196*SCALE, topY: SCREEN_H - 100*SCALE, bottomY: SCREEN_H - 32*SCALE });
  ladders.push({ x: 424*SCALE, topY: SCREEN_H - 90*SCALE, bottomY: SCREEN_H - 32*SCALE });

  // Grave spawn points (zombies rise from these)
  graves.push({ x: 80*SCALE, y: SCREEN_H - 32*SCALE, spawnTimer: 120, spawned: false });
  graves.push({ x: 200*SCALE, y: SCREEN_H - 32*SCALE, spawnTimer: 180, spawned: false });
  graves.push({ x: 320*SCALE, y: SCREEN_H - 32*SCALE, spawnTimer: 90, spawned: false });
  graves.push({ x: 420*SCALE, y: SCREEN_H - 32*SCALE, spawnTimer: 150, spawned: false });

  return { platforms, graves, ladders };
};

// ═══════════════════════════════════════════════════════════════════════════
// BACKGROUND RENDERING - Authentic GnG graveyard
// ═══════════════════════════════════════════════════════════════════════════

const drawBackground = (ctx: CanvasRenderingContext2D, frame: number) => {
  const s = SCALE;

  // Night sky (dark blue gradient)
  const gradient = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
  gradient.addColorStop(0, PAL.black);
  gradient.addColorStop(0.4, PAL.darkBlue);
  gradient.addColorStop(1, '#1a1a3a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Moon (top right)
  ctx.fillStyle = PAL.white;
  ctx.beginPath();
  ctx.arc(SCREEN_W - 50*s, 40*s, 20*s, 0, Math.PI * 2);
  ctx.fill();
  // Moon crater shadow
  ctx.fillStyle = PAL.gray1;
  ctx.beginPath();
  ctx.arc(SCREEN_W - 45*s, 38*s, 15*s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.white;
  ctx.beginPath();
  ctx.arc(SCREEN_W - 50*s, 40*s, 18*s, 0, Math.PI * 2);
  ctx.fill();

  // Stars (twinkling)
  ctx.fillStyle = PAL.white;
  const stars = [[30, 20], [80, 45], [150, 25], [220, 55], [280, 30], [350, 50], [420, 35], [480, 45]];
  for (const [sx, sy] of stars) {
    if (Math.sin(frame * 0.05 + sx * 0.1) > 0) {
      ctx.fillRect(sx*s, sy*s, 2*s, 2*s);
    }
  }

  // Distant hills (silhouette)
  ctx.fillStyle = '#1a1a2a';
  ctx.beginPath();
  ctx.moveTo(0, 120*s);
  ctx.lineTo(60*s, 90*s);
  ctx.lineTo(120*s, 105*s);
  ctx.lineTo(180*s, 80*s);
  ctx.lineTo(260*s, 100*s);
  ctx.lineTo(320*s, 85*s);
  ctx.lineTo(400*s, 95*s);
  ctx.lineTo(460*s, 75*s);
  ctx.lineTo(SCREEN_W, 90*s);
  ctx.lineTo(SCREEN_W, SCREEN_H);
  ctx.lineTo(0, SCREEN_H);
  ctx.fill();

  // Tombstones (background layer)
  ctx.fillStyle = PAL.gray3;
  const tombstones = [40, 120, 160, 260, 340, 380, 460];
  for (const tx of tombstones) {
    // Tombstone body
    ctx.fillRect(tx*s, SCREEN_H - 60*s, 16*s, 28*s);
    // Rounded top
    ctx.beginPath();
    ctx.arc((tx + 8)*s, SCREEN_H - 60*s, 8*s, Math.PI, 0);
    ctx.fill();
  }

  // Crosses
  ctx.fillStyle = PAL.gray2;
  ctx.fillRect(100*s, SCREEN_H - 75*s, 4*s, 43*s);
  ctx.fillRect(92*s, SCREEN_H - 65*s, 20*s, 4*s);
  ctx.fillRect(300*s, SCREEN_H - 70*s, 4*s, 38*s);
  ctx.fillRect(292*s, SCREEN_H - 60*s, 20*s, 4*s);

  // Dead trees
  ctx.fillStyle = PAL.darkBrown;
  // Tree 1
  ctx.fillRect(190*s, SCREEN_H - 100*s, 8*s, 68*s);
  ctx.beginPath();
  ctx.moveTo(194*s, SCREEN_H - 80*s);
  ctx.lineTo(170*s, SCREEN_H - 100*s);
  ctx.lineTo(175*s, SCREEN_H - 95*s);
  ctx.lineTo(192*s, SCREEN_H - 75*s);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(196*s, SCREEN_H - 85*s);
  ctx.lineTo(220*s, SCREEN_H - 110*s);
  ctx.lineTo(215*s, SCREEN_H - 105*s);
  ctx.lineTo(198*s, SCREEN_H - 80*s);
  ctx.fill();

  // Tree 2
  ctx.fillRect(400*s, SCREEN_H - 90*s, 6*s, 58*s);
  ctx.beginPath();
  ctx.moveTo(403*s, SCREEN_H - 70*s);
  ctx.lineTo(385*s, SCREEN_H - 90*s);
  ctx.lineTo(390*s, SCREEN_H - 85*s);
  ctx.lineTo(402*s, SCREEN_H - 68*s);
  ctx.fill();
};

const drawPlatform = (ctx: CanvasRenderingContext2D, p: Platform) => {
  const s = SCALE;

  if (p.type === 'ground') {
    // Grass top
    ctx.fillStyle = PAL.green;
    ctx.fillRect(p.x, p.y, p.w, 4*s);
    // Dirt
    ctx.fillStyle = PAL.brown;
    ctx.fillRect(p.x, p.y + 4*s, p.w, p.h - 4*s);
    // Dirt texture
    ctx.fillStyle = PAL.darkBrown;
    for (let i = p.x; i < p.x + p.w; i += 24*s) {
      ctx.fillRect(i + 8*s, p.y + 12*s, 4*s, 4*s);
      ctx.fillRect(i + 16*s, p.y + 20*s, 4*s, 4*s);
    }
  } else if (p.type === 'stone') {
    // Stone platform
    ctx.fillStyle = PAL.gray2;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    // Highlight
    ctx.fillStyle = PAL.gray1;
    ctx.fillRect(p.x, p.y, p.w, 2*s);
    // Shadow
    ctx.fillStyle = PAL.gray3;
    ctx.fillRect(p.x, p.y + p.h - 2*s, p.w, 2*s);
    // Block lines
    ctx.fillStyle = PAL.gray3;
    for (let i = p.x + 16*s; i < p.x + p.w; i += 16*s) {
      ctx.fillRect(i, p.y, 2*s, p.h);
    }
  } else if (p.type === 'float') {
    // Floating platform (wobbles slightly)
    ctx.fillStyle = PAL.gray2;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = PAL.gray1;
    ctx.fillRect(p.x, p.y, p.w, 2*s);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// COLLISION
// ═══════════════════════════════════════════════════════════════════════════

const checkGround = (x: number, y: number, platforms: Platform[]): Platform | null => {
  for (const p of platforms) {
    if (x > p.x - 8*SCALE && x < p.x + p.w + 8*SCALE && y >= p.y && y <= p.y + 8*SCALE) {
      return p;
    }
  }
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// AGENT INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

const createAgents = (): Agent[] => {
  const base = {
    vel: { x: 0, y: 0 },
    armor: 'armor' as ArmorState,
    weapon: 'lance' as WeaponType,
    state: 'stand' as AgentState,
    grounded: false,
    jumpLocked: false,
    crouching: false,
    onLadder: false,
    throwing: false,
    throwTimer: 0,
    invincible: 0,
    animFrame: 0,
    score: 0,
    attackCooldown: 0,
    thinkTimer: 0,
  };

  return [
    { ...base, id: 'haiku', name: 'Haiku', faction: 'claude' as const, pos: { x: 40*SCALE, y: SCREEN_H - 32*SCALE }, facing: 1 as Facing, targetX: SCREEN_W / 2 },
    { ...base, id: 'sonnet', name: 'Sonnet', faction: 'claude' as const, pos: { x: 80*SCALE, y: SCREEN_H - 32*SCALE }, facing: 1 as Facing, targetX: SCREEN_W / 2, weapon: 'dagger' as WeaponType },
    { ...base, id: 'opus', name: 'Opus', faction: 'claude' as const, pos: { x: 60*SCALE, y: SCREEN_H - 80*SCALE }, facing: 1 as Facing, targetX: SCREEN_W / 2, weapon: 'torch' as WeaponType },
    { ...base, id: 'flash', name: 'Flash', faction: 'gemini' as const, pos: { x: SCREEN_W - 40*SCALE, y: SCREEN_H - 32*SCALE }, facing: -1 as Facing, targetX: SCREEN_W / 2 },
    { ...base, id: 'pro', name: 'Pro', faction: 'gemini' as const, pos: { x: SCREEN_W - 80*SCALE, y: SCREEN_H - 32*SCALE }, facing: -1 as Facing, targetX: SCREEN_W / 2, weapon: 'dagger' as WeaponType },
    { ...base, id: 'ultra', name: 'Ultra', faction: 'gemini' as const, pos: { x: SCREEN_W - 60*SCALE, y: SCREEN_H - 90*SCALE }, facing: -1 as Facing, targetX: SCREEN_W / 2, weapon: 'torch' as WeaponType },
  ];
};

// Create initial weapon pots
const createWeaponPots = (): WeaponPot[] => {
  const weapons: WeaponType[] = ['dagger', 'torch', 'lance'];
  return [
    { id: 1, x: 150*SCALE, y: SCREEN_H - 32*SCALE, weapon: weapons[Math.floor(Math.random() * 3)], broken: false },
    { id: 2, x: 350*SCALE, y: SCREEN_H - 32*SCALE, weapon: weapons[Math.floor(Math.random() * 3)], broken: false },
    { id: 3, x: 220*SCALE, y: SCREEN_H - 100*SCALE, weapon: weapons[Math.floor(Math.random() * 3)], broken: false },
  ];
};

// Check if agent is near a ladder
const checkLadder = (x: number, y: number, ladders: Ladder[]): Ladder | null => {
  for (const l of ladders) {
    if (Math.abs(x - l.x) < 10*SCALE && y >= l.topY && y <= l.bottomY + 8*SCALE) {
      return l;
    }
  }
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function Battlefield() {
  const [level] = useState(createLevel);
  const [agents, setAgents] = useState<Agent[]>(createAgents);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [graves, setGraves] = useState(level.graves);
  const [weaponPots, setWeaponPots] = useState<WeaponPot[]>(createWeaponPots);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const enemyId = useRef(0);
  const projId = useRef(0);
  const logId = useRef(0);
  const redArremerTimer = useRef(300);
  const potRespawnTimer = useRef(400);

  const addLog = useCallback((agent: string, msg: string, type: LogEntry['type'] = 'info') => {
    logId.current++;
    setLogs(prev => [{ id: logId.current, agent, msg, type }, ...prev].slice(0, 20));
  }, []);

  // Game loop
  useEffect(() => {
    if (paused) return;

    const loop = setInterval(() => {
      setFrame(f => f + 1);

      // Spawn zombies from graves
      setGraves(prev => prev.map(g => {
        if (!g.spawned) {
          const newTimer = g.spawnTimer - speed;
          if (newTimer <= 0) {
            enemyId.current++;
            setEnemies(e => [...e, {
              id: enemyId.current,
              type: 'zombie',
              pos: { x: g.x, y: g.y },
              vel: { x: 0, y: 0 },
              facing: Math.random() > 0.5 ? 1 : -1,
              state: 'spawn',
              hp: 1,
              animFrame: 0,
              stateTimer: 0,
            }]);
            addLog('GRAVE', 'Zombie rises!', 'warning');
            return { ...g, spawned: true };
          }
          return { ...g, spawnTimer: newTimer };
        }
        return g;
      }));

      // Spawn Red Arremer periodically
      redArremerTimer.current -= speed;
      if (redArremerTimer.current <= 0 && enemies.filter(e => e.type === 'redArremer' && e.state !== 'dead').length < 2) {
        redArremerTimer.current = 400 + Math.random() * 200;
        enemyId.current++;
        const side = Math.random() > 0.5;
        setEnemies(e => [...e, {
          id: enemyId.current,
          type: 'redArremer',
          pos: { x: side ? 20*SCALE : SCREEN_W - 20*SCALE, y: 80*SCALE },
          vel: { x: 0, y: 0 },
          facing: side ? 1 : -1,
          state: 'active',
          hp: 2,
          animFrame: 0,
          stateTimer: 0,
          hoverY: 80*SCALE,
        }]);
        addLog('SKY', 'Red Arremer appears!', 'danger');
      }

      // Respawn weapon pots periodically
      potRespawnTimer.current -= speed;
      if (potRespawnTimer.current <= 0) {
        potRespawnTimer.current = 500 + Math.random() * 300;
        const brokenPots = weaponPots.filter(p => p.broken);
        if (brokenPots.length > 0) {
          const weapons: WeaponType[] = ['dagger', 'torch', 'lance'];
          const respawnPot = brokenPots[Math.floor(Math.random() * brokenPots.length)];
          setWeaponPots(prev => prev.map(p =>
            p.id === respawnPot.id ? { ...p, broken: false, weapon: weapons[Math.floor(Math.random() * 3)] } : p
          ));
        }
      }

      // Update projectiles
      setProjectiles(prev => prev.map(p => ({
        ...p,
        pos: { x: p.pos.x + p.vel.x * speed, y: p.pos.y + p.vel.y * speed },
        ttl: p.ttl - speed,
      })).filter(p => p.ttl > 0 && p.pos.x > 0 && p.pos.x < SCREEN_W));

      // Projectile-pot collision (break pots to reveal weapons)
      setWeaponPots(prevPots => prevPots.map(pot => {
        if (pot.broken) return pot;

        for (const proj of projectiles) {
          const dx = Math.abs(pot.x - proj.pos.x);
          const dy = Math.abs((pot.y - 8*SCALE) - proj.pos.y);
          if (dx < 12*SCALE && dy < 16*SCALE) {
            setProjectiles(p => p.filter(pr => pr.id !== proj.id));
            const breaker = agents.find(a => a.id === proj.ownerId);
            if (breaker) {
              // Give weapon to the agent who broke the pot
              setAgents(prev => prev.map(a =>
                a.id === breaker.id ? { ...a, weapon: pot.weapon } : a
              ));
              addLog(breaker.name, `found ${pot.weapon}!`, 'success');
            }
            return { ...pot, broken: true };
          }
        }
        return pot;
      }));

      // Projectile-enemy collision
      setEnemies(prevE => prevE.map(enemy => {
        if (enemy.state === 'dead' || enemy.state === 'spawn') return enemy;

        for (const proj of projectiles) {
          const dx = Math.abs(enemy.pos.x - proj.pos.x);
          const dy = Math.abs((enemy.pos.y - 16*SCALE) - proj.pos.y);
          if (dx < 16*SCALE && dy < 20*SCALE) {
            setProjectiles(p => p.filter(pr => pr.id !== proj.id));
            const newHp = enemy.hp - 1;
            if (newHp <= 0) {
              const killer = agents.find(a => a.id === proj.ownerId);
              if (killer) {
                const pts = enemy.type === 'redArremer' ? 500 : 100;
                setAgents(prev => prev.map(a => a.id === killer.id ? { ...a, score: a.score + pts } : a));
                addLog(killer.name, `defeated ${enemy.type}!`, 'success');
              }
              return { ...enemy, state: 'dying' as EnemyState, hp: 0, vel: { x: 0, y: -3*SCALE } };
            }
            return { ...enemy, hp: newHp };
          }
        }
        return enemy;
      }));

      // Update enemies
      setEnemies(prev => prev.map(enemy => {
        if (enemy.state === 'dead') return enemy;

        let e = { ...enemy, animFrame: enemy.animFrame + 1, stateTimer: enemy.stateTimer + speed };

        if (e.state === 'spawn') {
          if (e.stateTimer >= 60) e.state = 'active';
          return e;
        }

        if (e.state === 'dying') {
          e.vel.y += GRAVITY;
          e.pos.y += e.vel.y;
          if (e.pos.y > SCREEN_H + 50) e.state = 'dead';
          return e;
        }

        // Find nearest agent
        let nearest: Agent | null = null;
        let nearDist = Infinity;
        for (const a of agents) {
          if (a.armor === 'dead') continue;
          const d = Math.abs(a.pos.x - e.pos.x) + Math.abs(a.pos.y - e.pos.y);
          if (d < nearDist) { nearDist = d; nearest = a; }
        }

        if (e.type === 'zombie' && nearest) {
          // Zombie AI: walk toward nearest agent
          e.facing = nearest.pos.x > e.pos.x ? 1 : -1;
          e.vel.x = e.facing * 0.5 * SCALE * speed;
          e.vel.y += GRAVITY;
          if (e.vel.y > MAX_FALL_SPEED) e.vel.y = MAX_FALL_SPEED;

          // Ground check
          const ground = checkGround(e.pos.x, e.pos.y, level.platforms);
          if (ground && e.vel.y > 0) {
            e.pos.y = ground.y;
            e.vel.y = 0;
          }
        } else if (e.type === 'redArremer' && nearest) {
          // Red Arremer AI: hover, then dive attack
          e.facing = nearest.pos.x > e.pos.x ? 1 : -1;

          if (e.state === 'active') {
            // Hovering - move toward player horizontally
            const dx = nearest.pos.x - e.pos.x;
            e.vel.x = Math.sign(dx) * 1.5 * SCALE * speed;
            e.vel.y = Math.sin(e.animFrame * 0.1) * 0.5 * SCALE;

            // If close enough and above, start dive
            if (Math.abs(dx) < 80*SCALE && e.pos.y < nearest.pos.y - 20*SCALE) {
              e.state = 'attack';
              e.stateTimer = 0;
              e.diveTarget = { x: nearest.pos.x, y: nearest.pos.y };
            }
          } else if (e.state === 'attack') {
            // Diving at player
            if (e.diveTarget) {
              const dx = e.diveTarget.x - e.pos.x;
              const dy = e.diveTarget.y - e.pos.y;
              const dist = Math.sqrt(dx*dx + dy*dy) || 1;
              e.vel.x = (dx / dist) * 3 * SCALE * speed;
              e.vel.y = (dy / dist) * 3 * SCALE * speed;

              // After diving past target, return to hover
              if (e.stateTimer > 60 || e.pos.y > SCREEN_H - 50*SCALE) {
                e.state = 'active';
                e.vel.y = -2 * SCALE;
              }
            }
          }
        }

        e.pos.x += e.vel.x;
        e.pos.y += e.vel.y;
        e.pos.x = Math.max(10*SCALE, Math.min(SCREEN_W - 10*SCALE, e.pos.x));

        return e;
      }));

      // Update agents (AI)
      setAgents(prevAgents => prevAgents.map(agent => {
        if (agent.armor === 'dead') return agent;

        let a = { ...agent, animFrame: agent.animFrame + 1 };
        if (a.invincible > 0) a.invincible -= speed;
        if (a.attackCooldown > 0) a.attackCooldown -= speed;
        if (a.throwTimer > 0) {
          a.throwTimer -= speed;
          if (a.throwTimer <= 0) a.throwing = false;
        }
        a.thinkTimer -= speed;

        // Find nearest enemy (needed for AI decisions and ladder climbing)
        let nearestEnemy: Enemy | null = null;
        let nearDist = Infinity;
        for (const e of enemies) {
          if (e.state === 'dead' || e.state === 'spawn') continue;
          const d = Math.sqrt(Math.pow(e.pos.x - a.pos.x, 2) + Math.pow(e.pos.y - a.pos.y, 2));
          if (d < nearDist) { nearDist = d; nearestEnemy = e; }
        }

        // AI Decision
        if (a.thinkTimer <= 0) {
          a.thinkTimer = 10 + Math.random() * 20;

          if (nearestEnemy && nearDist < 200*SCALE) {
            // Face enemy
            a.facing = nearestEnemy.pos.x > a.pos.x ? 1 : -1;

            // Attack if in range
            if (nearDist < 150*SCALE && a.attackCooldown <= 0 && !a.throwing) {
              projId.current++;
              const spd = a.weapon === 'dagger' ? 6 : a.weapon === 'torch' ? 4 : 5;
              setProjectiles(p => [...p, {
                id: projId.current,
                type: a.weapon,
                pos: { x: a.pos.x + a.facing * 10*SCALE, y: a.pos.y - 20*SCALE },
                vel: { x: a.facing * spd * SCALE, y: 0 },
                ownerId: a.id,
                ttl: 80,
              }]);
              a.throwing = true;
              a.throwTimer = 20;
              a.attackCooldown = 40;
              a.state = 'throw';
              addLog(a.name, `threw ${a.weapon}!`, 'info');
            }

            // Move toward/away
            if (nearDist < 50*SCALE) {
              a.targetX = a.pos.x + (a.facing === 1 ? -60*SCALE : 60*SCALE);
            } else if (nearDist > 100*SCALE) {
              a.targetX = nearestEnemy.pos.x;
            }

            // Jump to dodge Red Arremer
            if (nearestEnemy.type === 'redArremer' && nearestEnemy.state === 'attack' && a.grounded && Math.random() > 0.5) {
              a.vel.y = ARTHUR_JUMP_VELOCITY;
              a.grounded = false;
              a.jumpLocked = true;
              a.state = 'jump';
            }
          } else {
            // Patrol
            if (Math.random() > 0.95) {
              a.targetX = 50*SCALE + Math.random() * (SCREEN_W - 100*SCALE);
            }
          }
        }

        // Check for ladder
        const nearLadder = checkLadder(a.pos.x, a.pos.y, level.ladders);

        // Ladder climbing AI
        if (nearLadder && !a.onLadder && a.grounded) {
          // Decide whether to climb (to reach enemy or evade)
          const shouldClimb = Math.random() > 0.97 ||
            (nearestEnemy && nearestEnemy.type === 'redArremer' && nearDist < 80*SCALE);
          if (shouldClimb) {
            a.onLadder = true;
            a.pos.x = nearLadder.x;
            a.vel.x = 0;
            a.vel.y = 0;
            a.state = 'climb';
          }
        }

        // Movement (GnG style: committed jumps, ladder climbing)
        if (a.onLadder && nearLadder) {
          // On ladder - can climb up/down
          a.vel.x = 0;
          const climbDir = Math.random() > 0.5 ? -1 : 1;
          a.vel.y = climbDir * 1.5 * SCALE * speed;
          a.state = 'climb';

          // Exit ladder at top or bottom
          if (a.pos.y <= nearLadder.topY) {
            a.pos.y = nearLadder.topY;
            a.onLadder = false;
            a.grounded = true;
            a.state = 'stand';
          } else if (a.pos.y >= nearLadder.bottomY) {
            a.pos.y = nearLadder.bottomY;
            a.onLadder = false;
            a.grounded = true;
            a.state = 'stand';
          }

          // Can jump off ladder
          if (Math.random() > 0.98) {
            a.onLadder = false;
            a.vel.y = ARTHUR_JUMP_VELOCITY * 0.7;
            a.vel.x = a.facing * ARTHUR_WALK_SPEED;
            a.jumpLocked = true;
            a.state = 'jump';
          }
        } else if (a.grounded) {
          a.onLadder = false;
          a.jumpLocked = false;
          const dx = a.targetX - a.pos.x;
          if (Math.abs(dx) > 5*SCALE) {
            a.vel.x = Math.sign(dx) * ARTHUR_WALK_SPEED * speed;
            a.facing = dx > 0 ? 1 : -1;
            if (!a.throwing) a.state = 'walk';
          } else {
            a.vel.x = 0;
            if (!a.throwing) a.state = 'stand';
          }

          // Random jump
          if (Math.random() > 0.99) {
            a.vel.y = ARTHUR_JUMP_VELOCITY;
            a.grounded = false;
            a.jumpLocked = true;
            a.state = 'jump';
          }
        } else if (!a.onLadder) {
          // In air - can't change horizontal direction (GnG committed jump)
          // vel.x stays as it was when jumping
        }

        // Gravity (not on ladder)
        if (!a.onLadder) {
          a.vel.y += GRAVITY * speed;
          if (a.vel.y > MAX_FALL_SPEED) a.vel.y = MAX_FALL_SPEED;
        }

        // Apply movement
        a.pos.x += a.vel.x;
        a.pos.y += a.vel.y;

        // Ground collision
        const ground = checkGround(a.pos.x, a.pos.y, level.platforms);
        if (ground && a.vel.y > 0) {
          a.pos.y = ground.y;
          a.vel.y = 0;
          a.grounded = true;
          if (a.state === 'jump') a.state = 'stand';
        } else if (a.vel.y > 0) {
          a.grounded = false;
        }

        // Screen bounds
        if (a.pos.x < 16*SCALE) { a.pos.x = 16*SCALE; a.targetX = SCREEN_W / 2; }
        if (a.pos.x > SCREEN_W - 16*SCALE) { a.pos.x = SCREEN_W - 16*SCALE; a.targetX = SCREEN_W / 2; }

        // Fall death
        if (a.pos.y > SCREEN_H + 20*SCALE) {
          addLog(a.name, 'fell!', 'warning');
          const respawnX = a.faction === 'claude' ? 60*SCALE : SCREEN_W - 60*SCALE;
          return { ...a, pos: { x: respawnX, y: 50*SCALE }, vel: { x: 0, y: 0 }, invincible: 90, armor: a.armor === 'armor' ? 'underwear' : 'armor' };
        }

        // Enemy collision
        if (a.invincible <= 0) {
          for (const e of enemies) {
            if (e.state !== 'active' && e.state !== 'attack') continue;
            const dx = Math.abs(a.pos.x - e.pos.x);
            const dy = Math.abs((a.pos.y - 16*SCALE) - (e.pos.y - 16*SCALE));
            if (dx < 20*SCALE && dy < 24*SCALE) {
              if (a.armor === 'armor') {
                addLog(a.name, 'lost armor!', 'warning');
                return { ...a, armor: 'underwear' as ArmorState, invincible: 90, vel: { x: (a.pos.x > e.pos.x ? 1 : -1) * 3*SCALE, y: -2*SCALE } };
              } else {
                addLog(a.name, 'died!', 'danger');
                const respawnX = a.faction === 'claude' ? 60*SCALE : SCREEN_W - 60*SCALE;
                return { ...a, pos: { x: respawnX, y: 50*SCALE }, vel: { x: 0, y: 0 }, armor: 'armor' as ArmorState, invincible: 120, score: Math.max(0, a.score - 100) };
              }
            }
          }
        }

        return a;
      }));

    }, FRAME_TIME);

    return () => clearInterval(loop);
  }, [paused, speed, level, enemies, projectiles, agents, graves, weaponPots, addLog]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    let frameId: number;
    const render = () => {
      // Background
      drawBackground(ctx, frame);

      // Ladders (behind everything else)
      level.ladders.forEach(l => drawLadder(ctx, l));

      // Platforms
      level.platforms.forEach(p => drawPlatform(ctx, p));

      // Weapon pots
      weaponPots.forEach(p => drawWeaponPot(ctx, p));

      // Projectiles
      projectiles.forEach(p => {
        if (p.type === 'lance') {
          drawLance(ctx, p.pos.x, p.pos.y, p.vel.x > 0 ? 1 : -1);
        } else if (p.type === 'dagger') {
          // Dagger - small silver blade
          ctx.fillStyle = PAL.white;
          const facing = p.vel.x > 0 ? 1 : -1;
          ctx.save();
          ctx.translate(p.pos.x, p.pos.y);
          if (facing === -1) ctx.scale(-1, 1);
          ctx.fillRect(0, -SCALE, 8*SCALE, 2*SCALE);
          ctx.fillStyle = PAL.gray1;
          ctx.fillRect(-4*SCALE, -2*SCALE, 4*SCALE, 4*SCALE);
          ctx.restore();
        } else {
          // Torch - flaming
          ctx.fillStyle = PAL.brown;
          ctx.fillRect(p.pos.x - 2*SCALE, p.pos.y - SCALE, 6*SCALE, 3*SCALE);
          ctx.fillStyle = PAL.tan;
          ctx.fillRect(p.pos.x + 3*SCALE, p.pos.y - 4*SCALE, 4*SCALE, 6*SCALE);
          ctx.fillStyle = PAL.red;
          ctx.fillRect(p.pos.x + 2*SCALE, p.pos.y - 6*SCALE, 6*SCALE, 4*SCALE);
        }
      });

      // Enemies
      enemies.forEach(e => {
        if (e.type === 'zombie') {
          drawZombie(ctx, e.pos.x, e.pos.y, e.facing, e.state, e.animFrame, e.stateTimer);
        } else if (e.type === 'redArremer') {
          drawRedArremer(ctx, e.pos.x, e.pos.y, e.facing, e.state, e.animFrame);
        }
      });

      // Agents
      agents.forEach(a => {
        if (a.state === 'climb') {
          drawArthurClimbing(ctx, a.pos.x, a.pos.y, a.armor, a.animFrame, a.faction);
        } else {
          drawArthur(ctx, a.pos.x, a.pos.y, a.armor, a.state, a.facing, a.animFrame, a.faction);
        }
      });

      // Scanlines (CRT effect)
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (let i = 0; i < SCREEN_H; i += 4) {
        ctx.fillRect(0, i, SCREEN_W, 2);
      }

      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [agents, enemies, projectiles, level, frame, weaponPots]);

  const reset = () => {
    setAgents(createAgents());
    setEnemies([]);
    setProjectiles([]);
    setGraves(level.graves.map(g => ({ ...g, spawned: false, spawnTimer: g.spawnTimer })));
    setWeaponPots(createWeaponPots());
    setLogs([]);
    redArremerTimer.current = 300;
    potRespawnTimer.current = 400;
    addLog('SYSTEM', 'Battle restarted!', 'info');
  };

  const claudeScore = agents.filter(a => a.faction === 'claude').reduce((s, a) => s + a.score, 0);
  const geminiScore = agents.filter(a => a.faction === 'gemini').reduce((s, a) => s + a.score, 0);

  return (
    <div className="battlefield gng-theme">
      <header className="bf-header">
        <div className="bf-title">
          <Skull className="bf-logo" />
          <div>
            <h1>GHOSTS 'N GOBLINS</h1>
            <span className="bf-subtitle"><Flame size={12} /> Stage 1: The Graveyard</span>
          </div>
        </div>

        <div className="bf-resources">
          <div className="resource" style={{ borderColor: PAL.blue }}>
            <span className="resource-icon"><Shield size={14} /></span>
            <span className="resource-value" style={{ color: PAL.skyBlue }}>Claude: {claudeScore}</span>
          </div>
          <div className="resource" style={{ borderColor: PAL.purple }}>
            <span className="resource-icon"><Shield size={14} /></span>
            <span className="resource-value" style={{ color: PAL.pink }}>Gemini: {geminiScore}</span>
          </div>
        </div>

        <div className="bf-controls">
          <button className={`control-btn ${!paused ? 'active' : ''}`} onClick={() => setPaused(false)}>▶</button>
          <button className={`control-btn ${paused ? 'active' : ''}`} onClick={() => setPaused(true)}>⏸</button>
          <select className="speed-select" value={speed} onChange={e => setSpeed(Number(e.target.value))}>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
          </select>
          <button className="control-btn" onClick={reset}>↺</button>
        </div>
      </header>

      <div className="bf-main">
        <div className="bf-canvas-container">
          <canvas ref={canvasRef} className="bf-canvas" width={SCREEN_W} height={SCREEN_H} />
        </div>

        <div className="bf-sidebar">
          <div className="bf-panel">
            <h3 className="panel-title"><Shield size={16} /> Knights</h3>
            <div className="agent-list">
              {agents.map(a => (
                <div key={a.id} className={`agent-row agent-row--${a.faction}`}>
                  <div className="agent-info">
                    <span className="agent-name">{a.name}</span>
                    <span className="agent-status">{a.armor === 'underwear' ? '🩲' : '🛡️'} {a.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bf-panel bf-panel--log">
            <h3 className="panel-title"><Flame size={16} /> Battle Log</h3>
            <div className="log-list">
              {logs.map(l => (
                <div key={l.id} className={`log-entry log-entry--${l.type}`}>
                  <span className="log-agent">[{l.agent}]</span>
                  <span className="log-action">{l.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer className="bf-footer">
        <div className="footer-left"><span className="status-dot status-dot--online" /> NES Mode</div>
        <div className="footer-center">Frame: {frame}</div>
        <div className="footer-right">GnG Engine v3.0</div>
      </footer>
    </div>
  );
}
