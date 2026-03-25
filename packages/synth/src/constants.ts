// SYNTH — Game Constants

// Tile & Room — ARPG-scale (bigger rooms, more enemies, wide view)
export const TILE_SIZE = 32
export const ROOM_WIDTH = 28   // tiles — wider for ARPG feel
export const ROOM_HEIGHT = 22  // tiles — taller for ARPG feel

// Entity speeds (px/s)
export const PLAYER_SPEED = 200
export const PARTNER_SPEED = 180
export const ENEMY_SPEED = 120
export const PROJECTILE_SPEED = 400

// HP
export const PLAYER_HP = 120
export const PARTNER_HP = 100
export const ENEMY_HP = 25

// Damage
export const PLAYER_DAMAGE = 18
export const PARTNER_DAMAGE = 14
export const ENEMY_DAMAGE = 8

// Timing (ms)
export const ATTACK_COOLDOWN = 400
export const PROJECTILE_LIFETIME = 1000
export const INVINCIBILITY_MS = 500
export const DODGE_DURATION = 150
export const DODGE_SPEED = 500
export const DODGE_COOLDOWN = 800

// Movement feel
export const MOVE_LERP_FACTOR = 0.15          // acceleration/deceleration smoothing
export const CAMERA_LERP = 0.08               // camera follow smoothness
export const CAMERA_LOOKAHEAD = 40             // px offset toward movement direction

// Combo system
export const COMBO_WINDOW_MS = 500             // time to chain next attack
export const COMBO_RESET_MS = 800              // reset combo after inactivity
export const COMBO_SPREAD_ANGLE = 0.25         // radians for 2nd-hit spread
export const COMBO_DAMAGE_MULTIPLIERS = [1.0, 1.25, 1.6] as const  // hit 1, 2, 3 damage scaling

// Projectile trails
export const TRAIL_INTERVAL_MS = 30            // ms between afterimages
export const TRAIL_FADE_MS = 200               // afterimage fade duration

// Enemy telegraph
export const TELEGRAPH_DURATION_MS = 400       // flash warning before attack

// Knockback — Diablo-style dramatic displacement
export const KNOCKBACK_DISTANCE = 48           // max px displacement (enemies FLY back)
export const KNOCKBACK_DURATION_MS = 250       // tween duration (longer slide)
export const KNOCKBACK_EASE = 'Expo.easeOut'   // fast start, slow stop (exponential out)

// Critical hits
export const CRIT_CHANCE = 0.15                // 15% chance per hit
export const CRIT_MULTIPLIER = 2.0             // 2x damage
export const CRIT_HITSTOP_MS = 120             // extra-long freeze on crit
export const CRIT_SHAKE_INTENSITY = 8          // bigger shake

// Screen shake scaling — damage-proportional
export const SHAKE_SMALL = 2                   // light hits
export const SHAKE_MEDIUM = 6                  // heavy hits
export const SHAKE_BOSS = 10                   // boss hits
export const SHAKE_CRIT = 8                    // critical hits

// Camera zoom punch on kill
export const KILL_ZOOM = 1.02                  // zoom scale on kill
export const KILL_ZOOM_DURATION = 100          // ms before returning to 1.0

// Operative Camera system — MOBA/ARPG hybrid
export const CAMERA_DEADZONE_W = 0.30          // deadzone width as fraction of viewport
export const CAMERA_DEADZONE_H = 0.30          // deadzone height as fraction of viewport
export const CAMERA_ZOOM_EXPLORE = 1.0         // intimate exploration zoom
export const CAMERA_ZOOM_LIGHT = 0.95          // light combat (3-5 enemies)
export const CAMERA_ZOOM_HEAVY = 0.88          // heavy combat (6+ enemies, MOBA-width)
export const CAMERA_ZOOM_BOSS = 0.85           // maximum tactical visibility
export const CAMERA_ZOOM_LERP = 0.015          // zoom lerp speed per frame
export const CAMERA_SCOUT_SNAP_MS = 300        // ms to pan back after scout release
export const CAMERA_LOOKAHEAD_EXPLORE = 50     // px lookahead in exploration
export const CAMERA_LOOKAHEAD_COMBAT = 25      // px lookahead in combat
export const CAMERA_ROOM_ZOOM_START = 0.75     // establishing shot start zoom
export const CAMERA_ROOM_ZOOM_DURATION = 800   // ms for establishing shot zoom-in

// Footsteps
export const FOOTSTEP_INTERVAL_MS = 220        // ms between footstep sounds at full speed
export const FOOTSTEP_SPEED_THRESHOLD = 40     // min speed (px/s) to trigger footsteps

// Partner speech — Diablo companion: earned, not spammy
export const SPEECH_COOLDOWN_MS = 9000         // min ms between partner speech lines (8-10s range)
export const SPEECH_KILL_STREAK_THRESHOLD = 3  // kills within window to trigger streak line

// Partner AI
export const PARTNER_LEASH_DISTANCE = 80
export const PARTNER_ATTACK_RANGE = 200
export const BRAIN_TICK_INTERVAL = 5000

// Enemy AI
export const ENEMY_CHASE_RANGE = 200
export const ENEMY_ATTACK_RANGE = 30
export const ENEMY_FLEE_THRESHOLD = 0.2

// Shielded enemy
export const SHIELDED_HP = 50
export const SHIELDED_SPEED = 72              // 60% of base ENEMY_SPEED
export const SHIELDED_DAMAGE = 12
export const SHIELDED_SHIELD_ARC = 120        // degrees — front-facing shield arc
export const SHIELDED_ATTACK_RANGE = 35
export const SHIELDED_CHASE_RANGE = 200

// Exploder enemy
export const EXPLODER_HP = 18
export const EXPLODER_SPEED = 180             // 150% of base ENEMY_SPEED
export const EXPLODER_DAMAGE = 8              // contact damage
export const EXPLODER_EXPLOSION_DAMAGE = 15
export const EXPLODER_EXPLOSION_RADIUS = 64   // px
export const EXPLODER_DETONATE_RANGE = 32     // px — starts countdown when this close
export const EXPLODER_FUSE_MS = 1000          // ms countdown before detonation
export const EXPLODER_CHASE_RANGE = 300

// Healer enemy
export const HEALER_HP = 20
export const HEALER_SPEED = 100
export const HEALER_DAMAGE = 4
export const HEALER_HEAL_AMOUNT = 10
export const HEALER_HEAL_COOLDOWN = 3000      // ms between heals
export const HEALER_HEAL_RANGE = 120          // px — max distance to heal target
export const HEALER_FLEE_RANGE = 160          // px — starts fleeing when player is this close
export const HEALER_CHASE_RANGE = 250

// Summoner enemy
export const SUMMONER_HP = 40
export const SUMMONER_SPEED = 0               // stationary
export const SUMMONER_DAMAGE = 6
export const SUMMONER_SPAWN_COOLDOWN = 8000   // ms between summons
export const SUMMONER_SPAWN_COUNT_MIN = 1
export const SUMMONER_SPAWN_COUNT_MAX = 2
export const SUMMONER_MAX_SUMMONS = 4         // max alive summons at a time
export const SUMMONER_CHASE_RANGE = 300       // detection range (doesn't move, but activates)
export const SUMMONER_ROTATE_SPEED = 0.5      // radians/s — slow menacing rotation

// Colors — Latent Dissolution palette
// Entity colors are signal in the noise; wall/floor are the substrate of latent space
export const PLAYER_COLOR = 0x4488ff
export const PARTNER_COLOR = 0x44ff88
export const ENEMY_COLOR = 0xff4444
export const WALL_COLOR = 0x2a2535      // dark purple-gray (latent space boundary)
export const FLOOR_COLOR = 0x0d0d1a     // deep dark blue (the substrate)
export const PROJECTILE_COLOR = 0xffff44
export const HUD_BG = 0x000000

// Boss
export const BOSS_HP = 300
export const BOSS_SPEED = 80
export const BOSS_DAMAGE = 20
export const BOSS_SHIELD_SEGMENTS = 4
export const BOSS_SUMMON_INTERVAL = 15000
export const BOSS_ORBIT_INTERVAL = 4000
export const BOSS_ORBIT_PROJECTILE_COUNT = 8
export const BOSS_ENRAGE_THRESHOLD = 0.33
export const BOSS_SUMMON_THRESHOLD = 0.66
export const BOSS_ENRAGE_SHAKE_INTERVAL = 3000
export const BOSS_COLOR = 0xcc00ff

// New enemy colors
export const SHIELDED_COLOR = 0x4488aa
export const EXPLODER_COLOR = 0xff8800
export const HEALER_COLOR = 0x88ff44
export const SUMMONER_COLOR = 0x8844cc

// Texture keys
export const TEX = {
  PLAYER: 'player',
  PARTNER: 'partner',
  ENEMY: 'enemy',
  ENEMY_RANGED: 'enemy-ranged',
  ENEMY_FAST_TANK: 'enemy-fast-tank',
  ENEMY_SHIELDED: 'enemy-shielded',
  ENEMY_EXPLODER: 'enemy-exploder',
  ENEMY_HEALER: 'enemy-healer',
  ENEMY_SUMMONER: 'enemy-summoner',
  ENEMY_BOSS: 'enemy-boss',
  WALL: 'wall',
  FLOOR: 'floor',
  PROJECTILE: 'projectile',
} as const
