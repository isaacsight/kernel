import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './WarcraftEngine.css';

// ═══════════════════════════════════════════════════════════════════════════
// WARCRAFT-STYLE RTS ENGINE
// Faithful recreation of classic RTS mechanics with Claude vs Gemini factions
// ═══════════════════════════════════════════════════════════════════════════

// === CONSTANTS ===
const TILE_SIZE = 32;
const MAP_WIDTH = 40;
const MAP_HEIGHT = 30;
const VIEWPORT_TILES_X = 20;
const VIEWPORT_TILES_Y = 15;

// Game tick rate
const TICK_RATE = 60;
const TICK_MS = 1000 / TICK_RATE;

// === TYPES ===
type Faction = 'claude' | 'gemini' | 'neutral' | 'creep';
type TerrainType = 'grass' | 'dirt' | 'water' | 'trees' | 'gold' | 'stone';
type UnitType = 'worker' | 'footman' | 'archer' | 'knight' | 'mage' | 'hero';
type BuildingType = 'townhall' | 'barracks' | 'farm' | 'tower' | 'altar';
type UnitState = 'idle' | 'moving' | 'attacking' | 'gathering' | 'building' | 'dead';
type BuildingState = 'constructing' | 'ready' | 'producing' | 'destroyed';

interface Position {
  x: number;
  y: number;
}

interface Tile {
  terrain: TerrainType;
  resourceAmount: number;
  buildingId: number | null;
  fogState: 'hidden' | 'explored' | 'visible';
  walkable: boolean;
}

interface Unit {
  id: number;
  type: UnitType;
  faction: Faction;
  name: string;
  pos: Position;
  targetPos: Position | null;
  attackTarget: number | null;
  gatherTarget: Position | null; // For workers gathering resources
  returnTarget: number | null; // Building ID to return resources to
  state: UnitState;
  hp: number;
  maxHp: number;
  damage: number;
  armor: number;
  speed: number;
  range: number;
  vision: number; // Vision range for fog of war
  attackCooldown: number;
  attackTimer: number;
  carryingResource: { type: 'gold' | 'lumber'; amount: number } | null;
  selected: boolean;
  animFrame: number;
}

interface Building {
  id: number;
  type: BuildingType;
  faction: Faction;
  pos: Position;
  size: { w: number; h: number };
  state: BuildingState;
  hp: number;
  maxHp: number;
  buildProgress: number;
  productionQueue: UnitType[];
  productionProgress: number;
  rallyPoint: Position | null;
}

interface Player {
  faction: Faction;
  gold: number;
  lumber: number;
  supply: number;
  maxSupply: number;
}

interface GameState {
  tick: number;
  players: Player[];
  units: Unit[];
  buildings: Building[];
  map: Tile[][];
  selectedUnits: number[];
  selectedBuilding: number | null;
  camera: Position;
  isPlacing: BuildingType | null;
}

// === UNIT DEFINITIONS ===
const UNIT_DEFS: Record<UnitType, {
  hp: number;
  damage: number;
  armor: number;
  speed: number;
  range: number;
  vision: number;
  attackSpeed: number;
  cost: { gold: number; lumber: number };
  supply: number;
  buildTime: number;
}> = {
  worker: { hp: 220, damage: 5, armor: 0, speed: 2.2, range: 1, vision: 5, attackSpeed: 60, cost: { gold: 75, lumber: 0 }, supply: 1, buildTime: 120 },
  footman: { hp: 420, damage: 13, armor: 2, speed: 2.7, range: 1, vision: 6, attackSpeed: 45, cost: { gold: 135, lumber: 0 }, supply: 2, buildTime: 150 },
  archer: { hp: 260, damage: 16, armor: 0, speed: 2.7, range: 6, vision: 8, attackSpeed: 50, cost: { gold: 130, lumber: 10 }, supply: 2, buildTime: 130 },
  knight: { hp: 800, damage: 25, armor: 4, speed: 3.5, range: 1, vision: 6, attackSpeed: 40, cost: { gold: 245, lumber: 60 }, supply: 4, buildTime: 200 },
  mage: { hp: 350, damage: 20, armor: 0, speed: 2.5, range: 5, vision: 7, attackSpeed: 55, cost: { gold: 200, lumber: 100 }, supply: 3, buildTime: 180 },
  hero: { hp: 700, damage: 30, armor: 3, speed: 3.0, range: 1, vision: 8, attackSpeed: 35, cost: { gold: 500, lumber: 100 }, supply: 5, buildTime: 300 },
};

// === BUILDING DEFINITIONS ===
const BUILDING_DEFS: Record<BuildingType, {
  hp: number;
  size: { w: number; h: number };
  cost: { gold: number; lumber: number };
  buildTime: number;
  supplyProvided: number;
  canProduce: UnitType[];
}> = {
  townhall: { hp: 1500, size: { w: 4, h: 4 }, cost: { gold: 450, lumber: 150 }, buildTime: 300, supplyProvided: 10, canProduce: ['worker'] },
  barracks: { hp: 1000, size: { w: 3, h: 3 }, cost: { gold: 200, lumber: 50 }, buildTime: 180, supplyProvided: 0, canProduce: ['footman', 'archer', 'knight'] },
  farm: { hp: 500, size: { w: 2, h: 2 }, cost: { gold: 80, lumber: 20 }, buildTime: 90, supplyProvided: 6, canProduce: [] },
  tower: { hp: 800, size: { w: 2, h: 2 }, cost: { gold: 150, lumber: 80 }, buildTime: 150, supplyProvided: 0, canProduce: [] },
  altar: { hp: 900, size: { w: 3, h: 3 }, cost: { gold: 300, lumber: 100 }, buildTime: 240, supplyProvided: 0, canProduce: ['hero', 'mage'] },
};

// === FACTION NAMES ===
const FACTION_UNIT_NAMES: Record<Faction, Record<UnitType, string>> = {
  claude: {
    worker: 'Peon',
    footman: 'Sonnet Knight',
    archer: 'Haiku Archer',
    knight: 'Opus Champion',
    mage: 'Context Weaver',
    hero: 'Kernel Commander',
  },
  gemini: {
    worker: 'Drone',
    footman: 'Flash Scout',
    archer: 'Pro Marksman',
    knight: 'Ultra Centurion',
    mage: 'Deep Think Oracle',
    hero: 'Infinite Horizon',
  },
  neutral: {
    worker: 'Peasant',
    footman: 'Militia',
    archer: 'Ranger',
    knight: 'Paladin',
    mage: 'Wizard',
    hero: 'Champion',
  },
  creep: {
    worker: 'Goblin',
    footman: 'Ogre',
    archer: 'Troll',
    knight: 'Golem',
    mage: 'Warlock',
    hero: 'Dragon',
  },
};

// === MAP GENERATION ===
const generateMap = (): Tile[][] => {
  const map: Tile[][] = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      let terrain: TerrainType = 'grass';
      let walkable = true;
      let resourceAmount = 0;

      // Create some terrain features
      const noise = Math.sin(x * 0.3) * Math.cos(y * 0.3);

      // Water (river down the middle)
      if (x >= 18 && x <= 21 && y > 5 && y < MAP_HEIGHT - 5) {
        terrain = 'water';
        walkable = false;
      }

      // Gold mines (strategic positions)
      if ((x === 5 && y === 5) || (x === 34 && y === 5) ||
          (x === 5 && y === 24) || (x === 34 && y === 24) ||
          (x === 20 && y === 14)) {
        terrain = 'gold';
        resourceAmount = 10000;
        walkable = false;
      }

      // Trees (forests)
      if (noise > 0.6 && terrain === 'grass' && Math.random() > 0.5) {
        terrain = 'trees';
        resourceAmount = 50;
        walkable = false;
      }

      // Starting area clearings
      if ((x < 10 && y < 10) || (x > MAP_WIDTH - 10 && y < 10)) {
        terrain = 'grass';
        walkable = true;
        resourceAmount = 0;
      }

      row.push({
        terrain,
        resourceAmount,
        buildingId: null,
        fogState: 'hidden',
        walkable,
      });
    }
    map.push(row);
  }

  return map;
};

// === INITIAL GAME STATE ===
const createInitialState = (): GameState => {
  const map = generateMap();

  // Create starting units
  const units: Unit[] = [
    // Claude faction (top-left)
    ...Array(4).fill(null).map((_, i) => createUnit(i + 1, 'worker', 'claude', { x: 3 + i, y: 5 })),
    createUnit(5, 'hero', 'claude', { x: 5, y: 3 }),

    // Gemini faction (top-right)
    ...Array(4).fill(null).map((_, i) => createUnit(i + 6, 'worker', 'gemini', { x: MAP_WIDTH - 4 - i, y: 5 })),
    createUnit(10, 'hero', 'gemini', { x: MAP_WIDTH - 6, y: 3 }),

    // Neutral creeps (center)
    createUnit(11, 'footman', 'creep', { x: 20, y: 12 }),
    createUnit(12, 'footman', 'creep', { x: 21, y: 13 }),
    createUnit(13, 'archer', 'creep', { x: 19, y: 13 }),
  ];

  // Create starting buildings
  const buildings: Building[] = [
    createBuilding(1, 'townhall', 'claude', { x: 2, y: 2 }),
    createBuilding(2, 'townhall', 'gemini', { x: MAP_WIDTH - 6, y: 2 }),
  ];

  // Mark building positions on map
  buildings.forEach(b => {
    for (let dy = 0; dy < b.size.h; dy++) {
      for (let dx = 0; dx < b.size.w; dx++) {
        const tx = b.pos.x + dx;
        const ty = b.pos.y + dy;
        if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
          map[ty][tx].buildingId = b.id;
          map[ty][tx].walkable = false;
        }
      }
    }
  });

  return {
    tick: 0,
    players: [
      { faction: 'claude', gold: 500, lumber: 150, supply: 5, maxSupply: 10 },
      { faction: 'gemini', gold: 500, lumber: 150, supply: 5, maxSupply: 10 },
    ],
    units,
    buildings,
    map,
    selectedUnits: [],
    selectedBuilding: null,
    camera: { x: 0, y: 0 },
    isPlacing: null,
  };
};

const createUnit = (id: number, type: UnitType, faction: Faction, pos: Position): Unit => {
  const def = UNIT_DEFS[type];
  return {
    id,
    type,
    faction,
    name: FACTION_UNIT_NAMES[faction][type],
    pos: { ...pos },
    targetPos: null,
    attackTarget: null,
    gatherTarget: null,
    returnTarget: null,
    state: 'idle',
    hp: def.hp,
    maxHp: def.hp,
    damage: def.damage,
    armor: def.armor,
    speed: def.speed,
    range: def.range,
    vision: def.vision,
    attackCooldown: def.attackSpeed,
    attackTimer: 0,
    carryingResource: null,
    selected: false,
    animFrame: 0,
  };
};

const createBuilding = (id: number, type: BuildingType, faction: Faction, pos: Position): Building => {
  const def = BUILDING_DEFS[type];
  return {
    id,
    type,
    faction,
    pos: { ...pos },
    size: { ...def.size },
    state: 'ready',
    hp: def.hp,
    maxHp: def.hp,
    buildProgress: 100,
    productionQueue: [],
    productionProgress: 0,
    rallyPoint: { x: pos.x + def.size.w, y: pos.y + def.size.h },
  };
};

// Pathfinding function available for future use
// TODO: Implement A* pathfinding for unit movement

// === DRAWING FUNCTIONS ===
const COLORS = {
  grass: '#2D5016',
  grassLight: '#3A6620',
  dirt: '#8B7355',
  water: '#1E4D7B',
  waterLight: '#2E6D9B',
  trees: '#1A3D0C',
  gold: '#FFD700',
  stone: '#6B6B6B',
  fog: '#1a1a2e',
  fogExplored: 'rgba(26, 26, 46, 0.6)',
  claude: '#3B82F6',
  claudeLight: '#60A5FA',
  gemini: '#A855F7',
  geminiLight: '#C084FC',
  neutral: '#FFD700',
  creep: '#EF4444',
  selection: '#00FF00',
  health: '#22C55E',
  healthLow: '#EF4444',
  mana: '#3B82F6',
};

const drawTerrain = (
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  x: number,
  y: number,
  tick: number
) => {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;

  // Base terrain
  switch (tile.terrain) {
    case 'grass':
      ctx.fillStyle = ((x + y) % 2 === 0) ? COLORS.grass : COLORS.grassLight;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      break;

    case 'dirt':
      ctx.fillStyle = COLORS.dirt;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      break;

    case 'water':
      ctx.fillStyle = COLORS.water;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Animated wave
      const wave = Math.sin(tick * 0.05 + x * 0.5) * 2;
      ctx.fillStyle = COLORS.waterLight;
      ctx.fillRect(px + 4, py + 8 + wave, TILE_SIZE - 8, 4);
      break;

    case 'trees':
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Tree trunk
      ctx.fillStyle = '#4A3728';
      ctx.fillRect(px + 12, py + 16, 8, 16);
      // Tree foliage
      ctx.fillStyle = COLORS.trees;
      ctx.beginPath();
      ctx.arc(px + 16, py + 12, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2A5D1C';
      ctx.beginPath();
      ctx.arc(px + 14, py + 10, 8, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'gold':
      ctx.fillStyle = COLORS.dirt;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Gold pile
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.arc(px + 16, py + 20, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#B8860B';
      ctx.beginPath();
      ctx.arc(px + 14, py + 18, 6, 0, Math.PI * 2);
      ctx.fill();
      // Sparkle
      if (Math.sin(tick * 0.1 + x) > 0.8) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(px + 10, py + 12, 3, 3);
      }
      break;

    case 'stone':
      ctx.fillStyle = COLORS.stone;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      break;
  }
};

const drawUnit = (
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  cameraX: number,
  cameraY: number,
  tick: number
) => {
  const px = (unit.pos.x - cameraX) * TILE_SIZE + TILE_SIZE / 2;
  const py = (unit.pos.y - cameraY) * TILE_SIZE + TILE_SIZE / 2;

  // Skip if off-screen
  if (px < -TILE_SIZE || px > VIEWPORT_TILES_X * TILE_SIZE + TILE_SIZE ||
      py < -TILE_SIZE || py > VIEWPORT_TILES_Y * TILE_SIZE + TILE_SIZE) {
    return;
  }

  // Animation
  const bob = unit.state === 'moving' ? Math.sin(tick * 0.3) * 2 : 0;

  // Selection circle
  if (unit.selected) {
    ctx.strokeStyle = COLORS.selection;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(px, py + 8, 14, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(px, py + 10, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Unit body (faction colored)
  const factionColor = unit.faction === 'claude' ? COLORS.claude :
                       unit.faction === 'gemini' ? COLORS.gemini :
                       unit.faction === 'creep' ? COLORS.creep : COLORS.neutral;
  const factionLight = unit.faction === 'claude' ? COLORS.claudeLight :
                       unit.faction === 'gemini' ? COLORS.geminiLight :
                       COLORS.neutral;

  // Different shapes for different unit types
  switch (unit.type) {
    case 'worker':
      // Small circular body
      ctx.fillStyle = factionColor;
      ctx.beginPath();
      ctx.arc(px, py - 4 + bob, 8, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.fillStyle = '#FFDBB5';
      ctx.beginPath();
      ctx.arc(px, py - 12 + bob, 5, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'footman':
      // Shield shape
      ctx.fillStyle = factionColor;
      ctx.fillRect(px - 8, py - 16 + bob, 16, 20);
      // Helmet
      ctx.fillStyle = '#888888';
      ctx.beginPath();
      ctx.arc(px, py - 18 + bob, 6, Math.PI, 0);
      ctx.fill();
      // Shield highlight
      ctx.fillStyle = factionLight;
      ctx.fillRect(px - 6, py - 14 + bob, 4, 8);
      break;

    case 'archer':
      // Slender body
      ctx.fillStyle = factionColor;
      ctx.fillRect(px - 5, py - 16 + bob, 10, 18);
      // Hood
      ctx.fillStyle = factionLight;
      ctx.beginPath();
      ctx.moveTo(px, py - 22 + bob);
      ctx.lineTo(px - 7, py - 12 + bob);
      ctx.lineTo(px + 7, py - 12 + bob);
      ctx.fill();
      // Bow
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px + 10, py - 8 + bob, 10, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      break;

    case 'knight':
      // Large armored body
      ctx.fillStyle = factionColor;
      ctx.fillRect(px - 10, py - 18 + bob, 20, 22);
      // Helmet
      ctx.fillStyle = '#C0C0C0';
      ctx.beginPath();
      ctx.arc(px, py - 22 + bob, 8, 0, Math.PI * 2);
      ctx.fill();
      // Plume
      ctx.fillStyle = factionLight;
      ctx.fillRect(px - 2, py - 32 + bob, 4, 10);
      break;

    case 'mage':
      // Robed body
      ctx.fillStyle = factionColor;
      ctx.beginPath();
      ctx.moveTo(px, py - 20 + bob);
      ctx.lineTo(px - 10, py + 4 + bob);
      ctx.lineTo(px + 10, py + 4 + bob);
      ctx.fill();
      // Staff
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + 8, py - 24 + bob);
      ctx.lineTo(px + 8, py + 4 + bob);
      ctx.stroke();
      // Orb
      ctx.fillStyle = factionLight;
      ctx.beginPath();
      ctx.arc(px + 8, py - 26 + bob, 4, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'hero':
      // Large heroic body
      ctx.fillStyle = factionColor;
      ctx.fillRect(px - 12, py - 20 + bob, 24, 24);
      // Shoulder pads (WC3 style!)
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.arc(px - 12, py - 14 + bob, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + 12, py - 14 + bob, 6, 0, Math.PI * 2);
      ctx.fill();
      // Crown
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(px - 6, py - 30 + bob, 12, 4);
      ctx.fillRect(px - 8, py - 34 + bob, 4, 8);
      ctx.fillRect(px - 2, py - 36 + bob, 4, 10);
      ctx.fillRect(px + 4, py - 34 + bob, 4, 8);
      break;
  }

  // Health bar (if damaged)
  if (unit.hp < unit.maxHp) {
    const barWidth = 24;
    const barHeight = 4;
    const hpPercent = unit.hp / unit.maxHp;

    ctx.fillStyle = '#000000';
    ctx.fillRect(px - barWidth / 2 - 1, py - 28 + bob - 1, barWidth + 2, barHeight + 2);
    ctx.fillStyle = hpPercent > 0.3 ? COLORS.health : COLORS.healthLow;
    ctx.fillRect(px - barWidth / 2, py - 28 + bob, barWidth * hpPercent, barHeight);
  }

  // Carrying resource indicator
  if (unit.carryingResource) {
    ctx.fillStyle = unit.carryingResource.type === 'gold' ? COLORS.gold : '#8B4513';
    ctx.beginPath();
    ctx.arc(px + 8, py - 4 + bob, 4, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawBuilding = (
  ctx: CanvasRenderingContext2D,
  building: Building,
  cameraX: number,
  cameraY: number,
  tick: number,
  isSelected: boolean
) => {
  const px = (building.pos.x - cameraX) * TILE_SIZE;
  const py = (building.pos.y - cameraY) * TILE_SIZE;
  const width = building.size.w * TILE_SIZE;
  const height = building.size.h * TILE_SIZE;

  // Skip if off-screen
  if (px + width < 0 || px > VIEWPORT_TILES_X * TILE_SIZE ||
      py + height < 0 || py > VIEWPORT_TILES_Y * TILE_SIZE) {
    return;
  }

  const factionColor = building.faction === 'claude' ? COLORS.claude :
                       building.faction === 'gemini' ? COLORS.gemini : COLORS.neutral;

  // Selection outline
  if (isSelected) {
    ctx.strokeStyle = COLORS.selection;
    ctx.lineWidth = 2;
    ctx.strokeRect(px - 2, py - 2, width + 4, height + 4);
  }

  // Building base
  ctx.fillStyle = '#4A3728';
  ctx.fillRect(px, py, width, height);

  // Building structure (varies by type)
  switch (building.type) {
    case 'townhall':
      // Main structure
      ctx.fillStyle = factionColor;
      ctx.fillRect(px + 8, py + 8, width - 16, height - 24);
      // Roof
      ctx.fillStyle = '#8B4513';
      ctx.beginPath();
      ctx.moveTo(px + width / 2, py);
      ctx.lineTo(px, py + height / 3);
      ctx.lineTo(px + width, py + height / 3);
      ctx.fill();
      // Gold trim
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(px + width / 2 - 8, py + 4, 16, 8);
      // Door
      ctx.fillStyle = '#2D1810';
      ctx.fillRect(px + width / 2 - 12, py + height - 32, 24, 24);
      break;

    case 'barracks':
      // Main structure
      ctx.fillStyle = factionColor;
      ctx.fillRect(px + 4, py + 4, width - 8, height - 8);
      // Weapons rack
      ctx.fillStyle = '#888888';
      ctx.fillRect(px + 8, py + 8, 8, 32);
      ctx.fillRect(px + width - 16, py + 8, 8, 32);
      // Flag
      ctx.fillStyle = factionColor;
      ctx.fillRect(px + width - 8, py, 4, 20);
      ctx.fillRect(px + width - 4, py + 4, 12, 8);
      break;

    case 'farm':
      // Barn
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(px + 4, py + 8, width - 8, height - 8);
      // Roof
      ctx.fillStyle = '#CD853F';
      ctx.beginPath();
      ctx.moveTo(px + width / 2, py);
      ctx.lineTo(px, py + 16);
      ctx.lineTo(px + width, py + 16);
      ctx.fill();
      // Hay
      ctx.fillStyle = '#DAA520';
      ctx.fillRect(px + 8, py + height - 16, width - 16, 8);
      break;

    case 'tower':
      // Tower structure
      ctx.fillStyle = '#888888';
      ctx.fillRect(px + 8, py + 16, width - 16, height - 16);
      // Top
      ctx.fillStyle = factionColor;
      ctx.fillRect(px + 4, py + 4, width - 8, 20);
      // Crenellations
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#888888';
        ctx.fillRect(px + 8 + i * 16, py, 8, 8);
      }
      break;

    case 'altar':
      // Base
      ctx.fillStyle = '#4A4A4A';
      ctx.fillRect(px + 8, py + height - 16, width - 16, 16);
      // Pillars
      ctx.fillStyle = factionColor;
      ctx.fillRect(px + 8, py + 8, 12, height - 24);
      ctx.fillRect(px + width - 20, py + 8, 12, height - 24);
      // Altar top
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(px + 16, py + 16, width - 32, 8);
      // Glow
      if (Math.sin(tick * 0.05) > 0) {
        ctx.fillStyle = `rgba(${building.faction === 'claude' ? '59, 130, 246' : '168, 85, 247'}, 0.3)`;
        ctx.beginPath();
        ctx.arc(px + width / 2, py + height / 2, 20, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
  }

  // Construction progress
  if (building.state === 'constructing') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(px, py, width, height * (1 - building.buildProgress / 100));

    // Progress bar
    ctx.fillStyle = '#000000';
    ctx.fillRect(px, py + height + 4, width, 6);
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(px + 1, py + height + 5, (width - 2) * (building.buildProgress / 100), 4);
  }

  // Production indicator
  if (building.productionQueue.length > 0 && building.state === 'producing') {
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(px, py - 8, width * (building.productionProgress / 100), 4);
  }

  // Damaged smoke
  if (building.hp < building.maxHp * 0.5) {
    ctx.fillStyle = 'rgba(64, 64, 64, 0.5)';
    const smokeY = py - 10 - (tick % 60);
    ctx.beginPath();
    ctx.arc(px + width / 2, smokeY, 8 + (tick % 30) / 5, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawMinimap = (
  ctx: CanvasRenderingContext2D,
  gameState: GameState,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x, y, width, height);

  const scaleX = width / MAP_WIDTH;
  const scaleY = height / MAP_HEIGHT;

  // Draw terrain
  for (let ty = 0; ty < MAP_HEIGHT; ty++) {
    for (let tx = 0; tx < MAP_WIDTH; tx++) {
      const tile = gameState.map[ty][tx];
      let color = '#2D5016';

      switch (tile.terrain) {
        case 'water': color = '#1E4D7B'; break;
        case 'trees': color = '#1A3D0C'; break;
        case 'gold': color = '#FFD700'; break;
        case 'dirt': color = '#8B7355'; break;
      }

      ctx.fillStyle = color;
      ctx.fillRect(x + tx * scaleX, y + ty * scaleY, scaleX + 1, scaleY + 1);
    }
  }

  // Draw buildings
  gameState.buildings.forEach(b => {
    ctx.fillStyle = b.faction === 'claude' ? COLORS.claude :
                    b.faction === 'gemini' ? COLORS.gemini : COLORS.neutral;
    ctx.fillRect(
      x + b.pos.x * scaleX,
      y + b.pos.y * scaleY,
      b.size.w * scaleX,
      b.size.h * scaleY
    );
  });

  // Draw units
  gameState.units.forEach(u => {
    if (u.state === 'dead') return;
    ctx.fillStyle = u.faction === 'claude' ? COLORS.claude :
                    u.faction === 'gemini' ? COLORS.gemini :
                    u.faction === 'creep' ? COLORS.creep : COLORS.neutral;
    ctx.fillRect(x + u.pos.x * scaleX - 1, y + u.pos.y * scaleY - 1, 3, 3);
  });

  // Camera viewport
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    x + gameState.camera.x * scaleX,
    y + gameState.camera.y * scaleY,
    VIEWPORT_TILES_X * scaleX,
    VIEWPORT_TILES_Y * scaleY
  );

  // Border
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
};

// === MAIN COMPONENT ===
export default function WarcraftEngine() {
  const [gameState, setGameState] = useState<GameState>(() => createInitialState());
  const [paused, setPaused] = useState(false);
  const [logs, setLogs] = useState<{ id: number; msg: string; type: string }[]>([]);
  const logId = useRef(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const lastTickRef = useRef<number>(0);
  const nextUnitId = useRef(20);

  // Add log message
  const addLog = useCallback((msg: string, type = 'info') => {
    logId.current++;
    setLogs(prev => [{ id: logId.current, msg, type }, ...prev].slice(0, 50));
  }, []);

  // Game tick update
  const gameTick = useCallback(() => {
    setGameState(prev => {
      const state = { ...prev, tick: prev.tick + 1 };

      // Update units
      state.units = state.units.map(unit => {
        if (unit.state === 'dead') return unit;

        let u = { ...unit, animFrame: unit.animFrame + 1 };

        // Movement
        if (u.targetPos && u.state === 'moving') {
          const dx = u.targetPos.x - u.pos.x;
          const dy = u.targetPos.y - u.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 0.1) {
            u.pos = { ...u.targetPos };
            u.targetPos = null;
            u.state = 'idle';
          } else {
            const moveSpeed = u.speed / TICK_RATE;
            u.pos = {
              x: u.pos.x + (dx / dist) * moveSpeed,
              y: u.pos.y + (dy / dist) * moveSpeed,
            };
          }
        }

        // Combat
        if (u.attackTimer > 0) u.attackTimer--;

        if (u.attackTarget !== null) {
          const target = state.units.find(t => t.id === u.attackTarget);
          if (target && target.state !== 'dead') {
            const dx = target.pos.x - u.pos.x;
            const dy = target.pos.y - u.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= u.range) {
              u.state = 'attacking';
              if (u.attackTimer <= 0) {
                // Deal damage
                const damageDealt = Math.max(1, u.damage - target.armor);
                state.units = state.units.map(t =>
                  t.id === target.id ? { ...t, hp: t.hp - damageDealt } : t
                );
                u.attackTimer = u.attackCooldown;

                // Check for kill
                if (target.hp - damageDealt <= 0) {
                  state.units = state.units.map(t =>
                    t.id === target.id ? { ...t, state: 'dead' as UnitState, hp: 0 } : t
                  );
                  u.attackTarget = null;
                  u.state = 'idle';
                }
              }
            } else {
              // Move toward target
              u.targetPos = { x: target.pos.x, y: target.pos.y };
              u.state = 'moving';
            }
          } else {
            u.attackTarget = null;
            u.state = 'idle';
          }
        }

        return u;
      });

      // Update buildings
      state.buildings = state.buildings.map(building => {
        let b = { ...building };

        // Construction
        if (b.state === 'constructing') {
          b.buildProgress += 100 / (BUILDING_DEFS[b.type].buildTime * TICK_RATE / 60);
          if (b.buildProgress >= 100) {
            b.buildProgress = 100;
            b.state = 'ready';
            // Update player supply
            const playerIdx = state.players.findIndex(p => p.faction === b.faction);
            if (playerIdx >= 0) {
              state.players = state.players.map((p, i) =>
                i === playerIdx ? { ...p, maxSupply: p.maxSupply + BUILDING_DEFS[b.type].supplyProvided } : p
              );
            }
          }
        }

        // Production
        if (b.state === 'producing' && b.productionQueue.length > 0) {
          const unitType = b.productionQueue[0];
          b.productionProgress += 100 / (UNIT_DEFS[unitType].buildTime * TICK_RATE / 60);

          if (b.productionProgress >= 100) {
            // Spawn unit
            nextUnitId.current++;
            const newUnit = createUnit(
              nextUnitId.current,
              unitType,
              b.faction,
              b.rallyPoint || { x: b.pos.x + b.size.w, y: b.pos.y + b.size.h }
            );
            state.units = [...state.units, newUnit];

            // Update supply
            const playerIdx = state.players.findIndex(p => p.faction === b.faction);
            if (playerIdx >= 0) {
              state.players = state.players.map((p, i) =>
                i === playerIdx ? { ...p, supply: p.supply + UNIT_DEFS[unitType].supply } : p
              );
            }

            // Remove from queue
            b.productionQueue = b.productionQueue.slice(1);
            b.productionProgress = 0;
            if (b.productionQueue.length === 0) {
              b.state = 'ready';
            }
          }
        }

        return b;
      });

      // Simple AI for creeps - attack nearby enemies
      state.units = state.units.map(u => {
        if (u.faction !== 'creep' || u.state === 'dead' || u.attackTarget) return u;

        // Find nearest enemy
        let nearest: Unit | null = null;
        let nearestDist = Infinity;
        state.units.forEach(other => {
          if (other.faction === 'creep' || other.state === 'dead') return;
          const dx = other.pos.x - u.pos.x;
          const dy = other.pos.y - u.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 8 && dist < nearestDist) {
            nearest = other;
            nearestDist = dist;
          }
        });

        if (nearest !== null) {
          return { ...u, attackTarget: (nearest as Unit).id };
        }
        return u;
      });

      // === FOG OF WAR UPDATE ===
      // First, demote all 'visible' to 'explored'
      const newMap: Tile[][] = state.map.map(row =>
        row.map(tile => ({
          ...tile,
          fogState: tile.fogState === 'visible' ? 'explored' : tile.fogState,
        }))
      );

      // Then reveal tiles around player units (Claude faction for player 1)
      state.units.forEach(u => {
        if (u.faction !== 'claude' || u.state === 'dead') return;
        const vision = u.vision;
        const ux = Math.floor(u.pos.x);
        const uy = Math.floor(u.pos.y);

        for (let dy = -vision; dy <= vision; dy++) {
          for (let dx = -vision; dx <= vision; dx++) {
            const tx = ux + dx;
            const ty = uy + dy;
            if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= vision) {
                newMap[ty][tx].fogState = 'visible';
              }
            }
          }
        }
      });

      // Also reveal around buildings
      state.buildings.forEach(b => {
        if (b.faction !== 'claude') return;
        const vision = 6; // Buildings have 6 tile vision
        for (let by = 0; by < b.size.h; by++) {
          for (let bx = 0; bx < b.size.w; bx++) {
            const cx = b.pos.x + bx;
            const cy = b.pos.y + by;
            for (let dy = -vision; dy <= vision; dy++) {
              for (let dx = -vision; dx <= vision; dx++) {
                const tx = cx + dx;
                const ty = cy + dy;
                if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  if (dist <= vision) {
                    newMap[ty][tx].fogState = 'visible';
                  }
                }
              }
            }
          }
        }
      });

      state.map = newMap;

      // === WORKER RESOURCE GATHERING ===
      state.units = state.units.map(u => {
        if (u.type !== 'worker' || u.state === 'dead') return u;
        if (u.faction !== 'claude' && u.faction !== 'gemini') return u;

        // If gathering and at resource
        if (u.state === 'gathering' && u.gatherTarget) {
          const dx = u.gatherTarget.x - u.pos.x;
          const dy = u.gatherTarget.y - u.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 1.5) {
            // At resource - gather
            const tx = Math.floor(u.gatherTarget.x);
            const ty = Math.floor(u.gatherTarget.y);
            if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
              const tile = state.map[ty][tx];
              if (tile.terrain === 'gold' && tile.resourceAmount > 0 && !u.carryingResource) {
                // Harvest gold (takes time, simplified to instant)
                const harvestAmount = Math.min(10, tile.resourceAmount);
                state.map[ty][tx] = { ...tile, resourceAmount: tile.resourceAmount - harvestAmount };
                return {
                  ...u,
                  carryingResource: { type: 'gold' as const, amount: harvestAmount },
                  state: 'moving' as UnitState,
                  gatherTarget: null,
                };
              } else if (tile.terrain === 'trees' && tile.resourceAmount > 0 && !u.carryingResource) {
                // Harvest lumber
                const harvestAmount = Math.min(10, tile.resourceAmount);
                state.map[ty][tx] = {
                  ...tile,
                  resourceAmount: tile.resourceAmount - harvestAmount,
                  terrain: tile.resourceAmount - harvestAmount <= 0 ? 'grass' : 'trees',
                  walkable: tile.resourceAmount - harvestAmount <= 0 ? true : false,
                };
                return {
                  ...u,
                  carryingResource: { type: 'lumber' as const, amount: harvestAmount },
                  state: 'moving' as UnitState,
                  gatherTarget: null,
                };
              }
            }
          } else {
            // Move toward resource
            const moveSpeed = u.speed / TICK_RATE;
            return {
              ...u,
              pos: {
                x: u.pos.x + (dx / dist) * moveSpeed,
                y: u.pos.y + (dy / dist) * moveSpeed,
              },
            };
          }
        }

        // If carrying resources, find nearest townhall to return
        if (u.carryingResource && u.state !== 'gathering') {
          const townhall = state.buildings.find(b => b.type === 'townhall' && b.faction === u.faction);
          if (townhall) {
            const targetX = townhall.pos.x + townhall.size.w / 2;
            const targetY = townhall.pos.y + townhall.size.h / 2;
            const dx = targetX - u.pos.x;
            const dy = targetY - u.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 2) {
              // At townhall - deposit resources
              const playerIdx = state.players.findIndex(p => p.faction === u.faction);
              if (playerIdx >= 0) {
                state.players = state.players.map((p, i) =>
                  i === playerIdx
                    ? {
                        ...p,
                        gold: p.gold + (u.carryingResource?.type === 'gold' ? u.carryingResource.amount : 0),
                        lumber: p.lumber + (u.carryingResource?.type === 'lumber' ? u.carryingResource.amount : 0),
                      }
                    : p
                );
              }
              return { ...u, carryingResource: null, state: 'idle' as UnitState };
            } else {
              // Move toward townhall
              const moveSpeed = u.speed / TICK_RATE;
              return {
                ...u,
                state: 'moving' as UnitState,
                pos: {
                  x: u.pos.x + (dx / dist) * moveSpeed,
                  y: u.pos.y + (dy / dist) * moveSpeed,
                },
              };
            }
          }
        }

        return u;
      });

      return state;
    });
  }, []);

  // Main game loop
  useEffect(() => {
    if (paused) return;

    const loop = (timestamp: number) => {
      if (timestamp - lastTickRef.current >= TICK_MS) {
        gameTick();
        lastTickRef.current = timestamp;
      }
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [paused, gameTick]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.imageSmoothingEnabled = false;

      // Clear
      ctx.fillStyle = COLORS.fog;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw visible map tiles
      for (let y = 0; y < VIEWPORT_TILES_Y + 1; y++) {
        for (let x = 0; x < VIEWPORT_TILES_X + 1; x++) {
          const mapX = Math.floor(gameState.camera.x) + x;
          const mapY = Math.floor(gameState.camera.y) + y;

          if (mapX >= 0 && mapX < MAP_WIDTH && mapY >= 0 && mapY < MAP_HEIGHT) {
            const tile = gameState.map[mapY][mapX];
            drawTerrain(ctx, tile, x, y, gameState.tick);
          }
        }
      }

      // Draw buildings
      gameState.buildings.forEach(b => {
        drawBuilding(ctx, b, gameState.camera.x, gameState.camera.y, gameState.tick,
          gameState.selectedBuilding === b.id);
      });

      // Draw units
      gameState.units.forEach(u => {
        if (u.state !== 'dead') {
          drawUnit(ctx, u, gameState.camera.x, gameState.camera.y, gameState.tick);
        }
      });

      requestAnimationFrame(render);
    };

    render();
  }, [gameState]);

  // Mouse handlers
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const tileX = Math.floor(x / TILE_SIZE) + gameState.camera.x;
    const tileY = Math.floor(y / TILE_SIZE) + gameState.camera.y;

    if (e.button === 2 || e.ctrlKey) {
      // Right click - command selected units
      if (gameState.selectedUnits.length > 0) {
        // Check if clicking on enemy
        const targetUnit = gameState.units.find(u =>
          u.state !== 'dead' &&
          Math.abs(u.pos.x - tileX) < 1 &&
          Math.abs(u.pos.y - tileY) < 1 &&
          u.faction !== 'claude' // For now, player is always claude
        );

        setGameState(prev => ({
          ...prev,
          units: prev.units.map(u => {
            if (prev.selectedUnits.includes(u.id)) {
              if (targetUnit) {
                return { ...u, attackTarget: targetUnit.id, state: 'attacking' as UnitState };
              } else {
                return { ...u, targetPos: { x: tileX, y: tileY }, state: 'moving' as UnitState, attackTarget: null };
              }
            }
            return u;
          }),
        }));

        addLog(targetUnit ? `Attacking ${targetUnit.name}` : `Moving to (${Math.floor(tileX)}, ${Math.floor(tileY)})`, 'action');
      }
    } else {
      // Left click - select
      // Check for unit selection
      const clickedUnit = gameState.units.find(u =>
        u.state !== 'dead' &&
        Math.abs(u.pos.x - tileX) < 0.8 &&
        Math.abs(u.pos.y - tileY) < 0.8
      );

      // Check for building selection
      const clickedBuilding = gameState.buildings.find(b =>
        tileX >= b.pos.x && tileX < b.pos.x + b.size.w &&
        tileY >= b.pos.y && tileY < b.pos.y + b.size.h
      );

      setGameState(prev => {
        const newSelected = clickedUnit ? [clickedUnit.id] :
                          e.shiftKey ? prev.selectedUnits : [];

        return {
          ...prev,
          selectedUnits: newSelected,
          selectedBuilding: clickedBuilding ? clickedBuilding.id : null,
          units: prev.units.map(u => ({
            ...u,
            selected: newSelected.includes(u.id),
          })),
        };
      });

      if (clickedUnit) {
        addLog(`Selected ${clickedUnit.name}`, 'info');
      } else if (clickedBuilding) {
        addLog(`Selected ${clickedBuilding.type}`, 'info');
      }
    }
  }, [gameState.camera, gameState.units, gameState.buildings, gameState.selectedUnits, addLog]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const scrollSpeed = 2;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          setGameState(prev => ({
            ...prev,
            camera: { ...prev.camera, y: Math.max(0, prev.camera.y - scrollSpeed) },
          }));
          break;
        case 'ArrowDown':
        case 's':
          setGameState(prev => ({
            ...prev,
            camera: { ...prev.camera, y: Math.min(MAP_HEIGHT - VIEWPORT_TILES_Y, prev.camera.y + scrollSpeed) },
          }));
          break;
        case 'ArrowLeft':
        case 'a':
          setGameState(prev => ({
            ...prev,
            camera: { ...prev.camera, x: Math.max(0, prev.camera.x - scrollSpeed) },
          }));
          break;
        case 'ArrowRight':
        case 'd':
          setGameState(prev => ({
            ...prev,
            camera: { ...prev.camera, x: Math.min(MAP_WIDTH - VIEWPORT_TILES_X, prev.camera.x + scrollSpeed) },
          }));
          break;
        case ' ':
          setPaused(p => !p);
          break;
        case 'Escape':
          setGameState(prev => ({
            ...prev,
            selectedUnits: [],
            selectedBuilding: null,
            units: prev.units.map(u => ({ ...u, selected: false })),
          }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Train unit handler
  const trainUnit = useCallback((unitType: UnitType) => {
    setGameState(prev => {
      const building = prev.buildings.find(b => b.id === prev.selectedBuilding);
      if (!building) return prev;

      const def = UNIT_DEFS[unitType];
      const buildingDef = BUILDING_DEFS[building.type];

      if (!buildingDef.canProduce.includes(unitType)) {
        addLog(`Cannot train ${unitType} at ${building.type}`, 'warning');
        return prev;
      }

      const player = prev.players.find(p => p.faction === building.faction);
      if (!player) return prev;

      if (player.gold < def.cost.gold || player.lumber < def.cost.lumber) {
        addLog('Not enough resources!', 'warning');
        return prev;
      }

      if (player.supply + def.supply > player.maxSupply) {
        addLog('Not enough supply!', 'warning');
        return prev;
      }

      addLog(`Training ${FACTION_UNIT_NAMES[building.faction][unitType]}`, 'success');

      return {
        ...prev,
        players: prev.players.map(p =>
          p.faction === building.faction
            ? { ...p, gold: p.gold - def.cost.gold, lumber: p.lumber - def.cost.lumber }
            : p
        ),
        buildings: prev.buildings.map(b =>
          b.id === building.id
            ? { ...b, productionQueue: [...b.productionQueue, unitType], state: 'producing' as BuildingState }
            : b
        ),
      };
    });
  }, [addLog]);

  // Get selected unit/building info
  const selectedUnit = useMemo(() =>
    gameState.units.find(u => gameState.selectedUnits.includes(u.id)),
    [gameState.units, gameState.selectedUnits]
  );

  const selectedBuilding = useMemo(() =>
    gameState.buildings.find(b => b.id === gameState.selectedBuilding),
    [gameState.buildings, gameState.selectedBuilding]
  );

  const player = gameState.players[0]; // Claude faction

  return (
    <div className="warcraft-engine">
      {/* Top HUD - Resources */}
      <header className="wc-header">
        <div className="wc-title">
          <span className="wc-logo">⚔</span>
          <div>
            <h1>CODEX WARS</h1>
            <span className="wc-subtitle">Sovereign Laboratory RTS</span>
          </div>
        </div>

        <div className="wc-resources">
          <div className="wc-resource wc-resource--gold">
            <span className="wc-resource-icon">🪙</span>
            <span className="wc-resource-value">{player.gold}</span>
            <span className="wc-resource-label">Gold</span>
          </div>
          <div className="wc-resource wc-resource--lumber">
            <span className="wc-resource-icon">🪵</span>
            <span className="wc-resource-value">{player.lumber}</span>
            <span className="wc-resource-label">Lumber</span>
          </div>
          <div className="wc-resource wc-resource--supply">
            <span className="wc-resource-icon">🏠</span>
            <span className="wc-resource-value">{player.supply}/{player.maxSupply}</span>
            <span className="wc-resource-label">Supply</span>
          </div>
        </div>

        <div className="wc-controls">
          <button className={`wc-btn ${!paused ? 'active' : ''}`} onClick={() => setPaused(false)}>▶</button>
          <button className={`wc-btn ${paused ? 'active' : ''}`} onClick={() => setPaused(true)}>⏸</button>
          <button className="wc-btn" onClick={() => setGameState(createInitialState())}>↺</button>
        </div>
      </header>

      {/* Main Game Area */}
      <div className="wc-main">
        {/* Game Canvas */}
        <div className="wc-viewport">
          <canvas
            ref={canvasRef}
            width={VIEWPORT_TILES_X * TILE_SIZE}
            height={VIEWPORT_TILES_Y * TILE_SIZE}
            onClick={handleCanvasClick}
            onContextMenu={(e) => {
              e.preventDefault();
              handleCanvasClick(e);
            }}
          />

          {paused && (
            <div className="wc-paused-overlay">
              <span>PAUSED</span>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="wc-sidebar">
          {/* Minimap */}
          <div className="wc-panel wc-minimap-panel">
            <canvas
              width={180}
              height={140}
              ref={(canvas) => {
                if (canvas) {
                  const ctx = canvas.getContext('2d');
                  if (ctx) drawMinimap(ctx, gameState, 0, 0, 180, 140);
                }
              }}
            />
          </div>

          {/* Selection Info */}
          <div className="wc-panel wc-selection-panel">
            <h3 className="wc-panel-title">Selection</h3>
            {selectedUnit ? (
              <div className="wc-unit-info">
                <div className="wc-unit-portrait">
                  <div className="wc-portrait-icon" data-faction={selectedUnit.faction}>
                    {selectedUnit.type.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="wc-unit-details">
                  <div className="wc-unit-name">{selectedUnit.name}</div>
                  <div className="wc-unit-stats">
                    <span>❤️ {selectedUnit.hp}/{selectedUnit.maxHp}</span>
                    <span>⚔️ {selectedUnit.damage}</span>
                    <span>🛡️ {selectedUnit.armor}</span>
                  </div>
                  <div className="wc-unit-state">State: {selectedUnit.state}</div>
                </div>
              </div>
            ) : selectedBuilding ? (
              <div className="wc-building-info">
                <div className="wc-building-name">{selectedBuilding.type.toUpperCase()}</div>
                <div className="wc-building-hp">
                  HP: {selectedBuilding.hp}/{selectedBuilding.maxHp}
                </div>
                {selectedBuilding.state === 'constructing' && (
                  <div className="wc-building-progress">
                    Building: {Math.floor(selectedBuilding.buildProgress)}%
                  </div>
                )}
                {selectedBuilding.productionQueue.length > 0 && (
                  <div className="wc-building-queue">
                    Queue: {selectedBuilding.productionQueue.join(', ')}
                  </div>
                )}
              </div>
            ) : (
              <div className="wc-no-selection">No selection</div>
            )}
          </div>

          {/* Action Panel */}
          <div className="wc-panel wc-action-panel">
            <h3 className="wc-panel-title">Actions</h3>
            <div className="wc-action-grid">
              {selectedBuilding && BUILDING_DEFS[selectedBuilding.type].canProduce.map(unitType => (
                <button
                  key={unitType}
                  className="wc-action-btn"
                  onClick={() => trainUnit(unitType)}
                  title={`Train ${FACTION_UNIT_NAMES[selectedBuilding.faction][unitType]} (${UNIT_DEFS[unitType].cost.gold}g ${UNIT_DEFS[unitType].cost.lumber}l)`}
                >
                  <span className="wc-action-icon">{unitType.charAt(0).toUpperCase()}</span>
                  <span className="wc-action-label">{unitType}</span>
                </button>
              ))}
              {!selectedBuilding && !selectedUnit && (
                <div className="wc-no-actions">Select a unit or building</div>
              )}
            </div>
          </div>

          {/* Event Log */}
          <div className="wc-panel wc-log-panel">
            <h3 className="wc-panel-title">Battle Log</h3>
            <div className="wc-log-list">
              {logs.map(log => (
                <div key={log.id} className={`wc-log-entry wc-log-${log.type}`}>
                  {log.msg}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Status */}
      <footer className="wc-footer">
        <div className="wc-footer-left">
          <span className="wc-status-dot" />
          <span>Tick: {gameState.tick}</span>
        </div>
        <div className="wc-footer-center">
          WASD/Arrows: Camera | Click: Select | Right-Click: Command | Space: Pause
        </div>
        <div className="wc-footer-right">
          Warcraft Engine v1.0
        </div>
      </footer>
    </div>
  );
}
