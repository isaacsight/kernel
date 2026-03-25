// SYNTH — Shared Types

export interface Vec2 {
  x: number
  y: number
}

export type TileType = 'wall' | 'floor' | 'door' | 'spawn_player' | 'spawn_partner' | 'spawn_enemy'

export interface RoomData {
  width: number
  height: number
  grid: TileType[][]
  playerSpawn: Vec2
  partnerSpawn: Vec2
  enemySpawns: Vec2[]
  doors: DoorData[]
  roomType?: RoomType
  chestSpawn?: Vec2
}

export interface EntityStats {
  maxHp: number
  hp: number
  speed: number
  attackDamage: number
  attackRange: number
  attackCooldown: number
  invincibilityMs: number
}

export type DirectiveType = 'attack' | 'defend' | 'retreat' | 'heal' | 'follow' | 'flank' | 'hold_position'

export interface BrainDirective {
  type: DirectiveType
  target?: string
  position?: Vec2
  speech?: string
  confidence: number
  reasoning?: string
}

export interface BrainContext {
  room: {
    width: number
    height: number
  }
  player: {
    position: Vec2
    hp: number
    maxHp: number
    facing: number
    isAttacking: boolean
  }
  partner: {
    position: Vec2
    hp: number
    maxHp: number
    currentDirective: DirectiveType
  }
  enemies: Array<{
    id: string
    position: Vec2
    hp: number
    maxHp: number
    state: string
    distanceToPlayer: number
    distanceToPartner: number
  }>
  meta: {
    elapsedSeconds: number
    enemiesKilled: number
    damageDealt: number
    damageTaken: number
  }
}

export interface Personality {
  id: string
  name: string
  promptModifier: string
  behaviorWeights: {
    aggressiveness: number
    selfPreservation: number
    playerProximity: number
    initiativeRate: number
  }
}

export type EnemyState = 'idle' | 'chase' | 'attack' | 'flee' | 'strafe' | 'charge' | 'detonate' | 'heal' | 'summon'

export type EnemyType = 'melee' | 'ranged' | 'fast' | 'tank' | 'shielded' | 'exploder' | 'healer' | 'summoner'

export type ProjectileOwner = 'player' | 'partner' | 'enemy' | 'boss'

export type BossPhase = 1 | 2 | 3

export interface BossState {
  phase: BossPhase
  shieldSegments: number
  maxShieldSegments: number
  lastSummon: number
  lastOrbit: number
  lastShake: number
  enraged: boolean
}

// ── Dungeon Generation ──

export type RoomType = 'arena' | 'treasure' | 'boss' | 'corridor'

export interface FloorData {
  rooms: RoomData[]
  connections: { from: number; to: number }[]
  startRoom: number
  bossRoom: number
}

export interface DoorData {
  position: Vec2
  /** Index of the room this door leads to */
  leadsTo: number
  /** Cardinal direction of the door relative to this room */
  direction: 'north' | 'south' | 'east' | 'west'
}

export interface MinimapRoomInfo {
  index: number
  x: number
  y: number
  width: number
  height: number
  type: RoomType
  explored: boolean
  current: boolean
}
