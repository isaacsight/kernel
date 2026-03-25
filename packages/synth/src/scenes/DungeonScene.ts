import Phaser from 'phaser'
import {
  TILE_SIZE, PLAYER_SPEED, PLAYER_HP, PLAYER_DAMAGE,
  PARTNER_HP, PARTNER_SPEED, PARTNER_DAMAGE,
  ATTACK_COOLDOWN, INVINCIBILITY_MS, DODGE_SPEED, DODGE_DURATION, DODGE_COOLDOWN,
  MOVE_LERP_FACTOR, CAMERA_LERP, CAMERA_LOOKAHEAD,
  COMBO_WINDOW_MS, COMBO_RESET_MS, COMBO_DAMAGE_MULTIPLIERS,
  TELEGRAPH_DURATION_MS,
  KNOCKBACK_DISTANCE, KNOCKBACK_DURATION_MS, KNOCKBACK_EASE,
  FOOTSTEP_INTERVAL_MS, FOOTSTEP_SPEED_THRESHOLD,
  TEX,
  CRIT_CHANCE, CRIT_MULTIPLIER, CRIT_HITSTOP_MS, CRIT_SHAKE_INTENSITY,
  SHAKE_SMALL, SHAKE_MEDIUM, SHAKE_BOSS,
  KILL_ZOOM, KILL_ZOOM_DURATION,
  PROJECTILE_SPEED,
} from '../constants'
import type { Vec2, EnemyState, DirectiveType, EnemyType, FloorData, RoomData, ProjectileOwner } from '../types'
import { renderRoom } from '../dungeon/Room'
import { generateFloor } from '../dungeon/DungeonGenerator'
import { RoomManager } from '../systems/RoomManager'
import { eventBus } from '../systems/EventBus'
import { Minimap } from '../dungeon/Minimap'
import { InputManager } from '../systems/InputManager'
import { HUD } from '../ui/HUD'
import { HealthBar } from '../combat/HealthBar'
import { Projectile } from '../combat/Projectile'
import { SpeechBubble } from '../systems/SpeechBubble'
import { updateEnemyBehavior } from '../ai/EnemyBehavior'
import { updatePartnerBehavior } from '../ai/PartnerBehavior'
import {
  screenShake, hitstop, killSlowmo, flashWhite,
  hitSparks, deathExplosion, dashTrail, muzzleFlash,
  damageNumber, createVignette, startAmbientParticles,
  enemyTelegraph, knockbackTween,
  killZoomPunch, critSparks,
  dashStretch, landingSquash, depthScale,
  createEntityGlow, updateEntityGlow,
  type EntityGlow,
  createEntityShadow, updateEntityShadow,
  updateEnemyVisibility,
  createScanlineOverlay, glitchEffect, createChromaticAberration,
  type ScanlineOverlay, type ChromaticAberration,
  flashRedDamage, flashCritWhite, flashRoomClear, impactFlash,
} from '../systems/VFX'
import { getSpriteScale, getEnemyScale, regenerateTextures } from '../ui/TextureFactory'
import { Atmosphere } from '../systems/Atmosphere'
import { PartnerSpeechController } from '../systems/PartnerSpeech'
import { PLAYER_COLOR, PARTNER_COLOR, ENEMY_COLOR } from '../constants'
import { ENEMY_TYPES, randomEnemyType } from '../entities/EnemyTypes'
import { Boss } from '../entities/Boss'
import { sound } from '../systems/SoundEngine'
import { spawnPickup, collectPickup, type Pickup, type ItemId, ITEM_DEFS } from '../systems/Items'
import {
  createDefaultWeapon, addMod, applyMods, fireModOnHit, hasMod,
  getFireRateMultiplier, rollModDrop, createDefaultProjectileData,
  spawnModPickup, collectModPickup, destroyModPickup, showModPickupFlash,
  type PlayerWeapon, type ModPickup, type ModContext, type DebuffType,
} from '../combat/WeaponMods'
import {
  applySplit, applyHoming,
  addDebuff, tickDebuffs,
  type ActiveDebuff,
} from '../combat/ModEffects'
import { WeaponSystem, type AttackEffect } from '../combat/WeaponSystem'
import { WEAPON_IDS } from '../combat/Weapons'
import { RoomEffects } from '../systems/RoomEffects'
import { TileAnimator } from '../systems/TileAnimator'
import { BrainBridge } from '../brain/BrainBridge'
import type { BrainContext } from '../types'
import { debugAPI } from '../systems/DebugAPI'
import { director, type DirectorState, type DirectorInput } from '../ai/Director'
import { evaluatePartnerAction, type UtilityContext } from '../ai/PartnerUtilityAI'
import { coordinateEnemies, type CoordinationEnemy } from '../ai/EnemyCoordination'
import { difficulty } from '../ai/AdaptiveDifficulty'
import { evaluateMood, resetMood, type MoodContext } from '../ai/MoodEngine'
import { createProgressionState, getXPForKill, checkLevelUp, applyLevelUps, getUpgradeChoices, xpForNextLevel, type ProgressionState, type Upgrade } from '../systems/Progression'
import { LevelUpScreen } from '../ui/LevelUpScreen'
import { nemesisSystem } from '../ai/NemesisSystem'
import { computeMetaBonuses, type MetaBonuses } from '../systems/MetaProgression'
import { noise } from '../systems/NoiseField'
import {
  NodeGraph,
  createEnemyAggressionGraph,
  createAtmosphereGraph,
  createPartnerConfidenceGraph,
  type GameContext,
} from '../systems/NodeGraph'
import { CombatHeatMap } from '../systems/CombatHeatMap'
import { OperativeCamera, type CameraContext } from '../systems/OperativeCamera'
import {
  ProceduralParticles,
  RECIPE_DEATH_BURST,
  RECIPE_HIT_SPARKS,
  RECIPE_AMBIENT_DUST,
  RECIPE_DASH_TRAIL,
  createDeathRecipe,
  createHitRecipe,
} from '../systems/ProceduralParticles'
import { floorModifiers, type FloorModifierDef } from '../systems/FloorModifiers'
import { FloorModifierScreen } from '../ui/FloorModifierScreen'

interface GameEntity {
  sprite: Phaser.Physics.Arcade.Sprite
  hp: number
  maxHp: number
  speed: number
  damage: number
  healthBar: HealthBar
  lastAttack: number
  invincibleUntil: number
  id: string
  baseScale: number
  glow?: EntityGlow
  shadow?: Phaser.GameObjects.Ellipse
}

interface EnemyEntity extends GameEntity {
  state: EnemyState
  telegraphing: boolean
  enemyType: EnemyType
  color: number
  /** Ranged enemies: last shot timestamp */
  lastShot: number
}

export class DungeonScene extends Phaser.Scene {
  private inputMgr!: InputManager
  private hud!: HUD
  private walls!: Phaser.Physics.Arcade.StaticGroup
  private player!: GameEntity
  private partner!: GameEntity & { directive: DirectiveType; bubble?: SpeechBubble }
  private enemies: EnemyEntity[] = []
  private projectiles: Projectile[] = []
  private pickups: Pickup[] = []
  private gameOver = false
  private dodgeCooldownUntil = 0
  private atmosphere!: Atmosphere
  private boss: Boss | null = null
  private elapsedMs = 0
  private tileAnimator!: TileAnimator
  private roomCleared = false
  private brain!: BrainBridge
  private killCount = 0
  private totalDamageDealt = 0
  private totalDamageTaken = 0

  // AI Systems state
  private lastDirectorState: DirectorState | null = null
  private lastKillTime = 0
  private lastDamageTime = 0
  private prevPlayerPos: Vec2 = { x: 0, y: 0 }
  private directorSpawnCounter = 0

  // Acceleration/deceleration — current velocity (lerped toward target)
  private currentVelX = 0
  private currentVelY = 0

  // Camera lookahead target point
  private cameraTarget!: Phaser.GameObjects.Container
  private operativeCamera: OperativeCamera | null = null

  // Kill cam: track rapid kills for multi-kill detection
  private recentKillTimestamps: number[] = []

  // Combo system state
  private comboCount = 0
  private lastComboAttack = 0

  // Room dimensions for depth scaling
  private roomHeightPx = 0

  // Footstep tracking
  private lastFootstepTime = 0
  private footstepIndex = 0

  // Partner speech
  private speechController = new PartnerSpeechController()
  private lastPartnerHpRatio = 1
  private lastPlayerHpRatio = 1

  // Digital / AI aesthetic overlays
  private scanlines: ScanlineOverlay | null = null
  private chromatic: ChromaticAberration | null = null

  // Environmental lighting (subtle, never obscures)
  private playerLight: Phaser.GameObjects.Arc | null = null
  private bossLight: Phaser.GameObjects.Arc | null = null

  // Spawn grace period — enemies don't attack for the first few seconds
  private spawnGraceUntil = 0
  private readonly SPAWN_GRACE_MS = 3000

  // Last partner directive for neural line flash
  private lastPartnerDirective: DirectiveType = 'follow'

  // Boss phase tracker (for debug API — updated via onPhaseChange callback)
  private bossPhase: number = 1

  // ── Weapon System + Mod System ──
  private weaponSystem = new WeaponSystem()
  private playerWeapon: PlayerWeapon = createDefaultWeapon()
  private modPickups: ModPickup[] = []
  private activeDebuffs: ActiveDebuff[] = []

  // XP & Leveling
  private progression: ProgressionState = createProgressionState()
  private levelUpScreen!: LevelUpScreen
  private lastKillerEnemyType: string = 'melee'

  // Floor Modifier System
  private floorModifierScreen!: FloorModifierScreen

  // ── Procedural Systems ──
  private combatHeatMap!: CombatHeatMap
  private proceduralParticles!: ProceduralParticles
  private enemyAggressionGraph!: NodeGraph
  private atmosphereGraph!: NodeGraph
  private partnerConfidenceGraph!: NodeGraph
  private lastGraphEvalTime = 0
  private graphEvalInterval = 1000  // evaluate node graphs once per second
  private lastAggressionScores: Map<string, number> = new Map()
  private partnerConfidence = 0.5

  // ── Meta-Progression Bonuses (persistent between runs) ──
  private metaBonuses: MetaBonuses | null = null

  // ── Multi-Room Dungeon State ──
  private floorNumber = 1
  private floorData: FloorData | null = null
  private roomManager: RoomManager | null = null
  private minimap: Minimap | null = null
  private currentRoomIndex = 0
  /** Floor-level tile/sprite refs that need clearing between rooms */
  private roomTileSprites: Phaser.GameObjects.GameObject[] = []

  constructor() {
    super({ key: 'DungeonScene' })
  }

  create(): void {
    this.gameOver = false
    this.enemies = []
    this.projectiles = []
    this.pickups = []
    this.dodgeCooldownUntil = 0
    this.currentVelX = 0
    this.currentVelY = 0
    this.comboCount = 0
    this.lastComboAttack = 0
    this.boss = null
    this.elapsedMs = 0
    this.roomCleared = false
    this.lastFootstepTime = 0
    this.footstepIndex = 0
    this.speechController = new PartnerSpeechController()
    this.lastPartnerHpRatio = 1
    this.lastPlayerHpRatio = 1
    this.roomTileSprites = []

    // ── Weapon System + Mod System reset ──
    this.weaponSystem = new WeaponSystem()
    this.playerWeapon = createDefaultWeapon()
    this.modPickups = []
    this.activeDebuffs = []

    // ── Generate Floor ──
    this.floorNumber = 1
    this.floorData = generateFloor(this.floorNumber)
    this.currentRoomIndex = this.floorData.startRoom
    const room = this.floorData.rooms[this.currentRoomIndex]

    // Render the start room
    this.walls = renderRoom(this, room)

    // Set physics world bounds to match room dimensions
    this.physics.world.setBounds(0, 0, room.width * TILE_SIZE, room.height * TILE_SIZE)
    this.roomHeightPx = room.height * TILE_SIZE

    // Player — scale computed from actual sprite dimensions
    const px = room.playerSpawn.x * TILE_SIZE + TILE_SIZE / 2
    const py = room.playerSpawn.y * TILE_SIZE + TILE_SIZE / 2
    const playerScale = getSpriteScale(this, TEX.PLAYER)
    this.player = this.createEntity('player', px, py, PLAYER_HP, PLAYER_SPEED, PLAYER_DAMAGE, TEX.PLAYER, playerScale)
    this.player.glow = createEntityGlow(this, px, py, PLAYER_COLOR, 20, 0.15)
    this.player.shadow = createEntityShadow(this, px, py, 22, 8)

    // Partner — scale computed from actual sprite dimensions
    const ppx = room.partnerSpawn.x * TILE_SIZE + TILE_SIZE / 2
    const ppy = room.partnerSpawn.y * TILE_SIZE + TILE_SIZE / 2
    const partnerScale = getSpriteScale(this, TEX.PARTNER)
    const partnerBase = this.createEntity('partner', ppx, ppy, PARTNER_HP, PARTNER_SPEED, PARTNER_DAMAGE, TEX.PARTNER, partnerScale)
    partnerBase.glow = createEntityGlow(this, ppx, ppy, PARTNER_COLOR, 20, 0.15)
    partnerBase.shadow = createEntityShadow(this, ppx, ppy, 22, 8)
    this.partner = { ...partnerBase, directive: 'follow' as DirectiveType }

    // ── Apply Meta-Progression Bonuses ──
    this.metaBonuses = computeMetaBonuses()
    const mb = this.metaBonuses

    // Player combat bonuses
    this.player.damage = Math.round(this.player.damage * mb.damageMult)
    this.player.maxHp = Math.max(1, this.player.maxHp + mb.maxHp)
    this.player.hp = this.player.maxHp
    this.player.speed = Math.round(this.player.speed * mb.moveSpeedMult)

    // Partner bonuses
    this.partner.maxHp += mb.partnerMaxHp
    this.partner.hp = this.partner.maxHp
    this.partner.damage = Math.round(this.partner.damage * mb.partnerDamageMult)

    // Lone Wolf keystone: remove partner, boost player damage
    if (mb.loneWolf) {
      this.partner.sprite.setActive(false).setVisible(false)
      if (this.partner.sprite.body) this.partner.sprite.body.enable = false
      this.partner.hp = 0
    }

    // Say hello — use speech controller for room entry
    const enterLine = this.speechController.forceSpeak('room_enter')
    this.partner.bubble = new SpeechBubble(this, ppx, ppy, enterLine)

    // Spawn enemies for the start room (no boss in start room)
    this.spawnRoomEnemies(room)

    // Collisions
    this.physics.add.collider(this.player.sprite, this.walls)
    this.physics.add.collider(this.partner.sprite, this.walls)
    for (const e of this.enemies) {
      this.physics.add.collider(e.sprite, this.walls)
    }

    // Input & HUD
    this.inputMgr = new InputManager(this)
    this.hud = new HUD(this, this.floorNumber)

    // ── Camera: ARPG-style wide battlefield view ──
    // Diablo/PoE/Dota show a WIDE view. Player is small in a big dangerous space.
    // Many enemies visible at once. Screen-filling effects. NOT a Zelda close-follow.
    this.cameras.main.setBounds(0, 0, room.width * TILE_SIZE, room.height * TILE_SIZE)
    this.cameraTarget = this.add.container(px, py)
    this.cameras.main.startFollow(this.cameraTarget, true, CAMERA_LERP * 0.7, CAMERA_LERP * 0.7)
    this.cameras.main.setZoom(1.0) // No zoom — show the full battlefield like an ARPG

    // ── Operative Camera: MOBA/ARPG hybrid with deadzone, zoom, scout ──
    this.operativeCamera = new OperativeCamera(this, this.cameraTarget)
    this.operativeCamera.onRoomEnter() // establishing shot for first room

    // Middle mouse: tactical scout mode (Dota grip)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown() && this.operativeCamera) {
        this.operativeCamera.startScout()
      }
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown() && this.operativeCamera?.isScoutMode()) {
        this.operativeCamera.updateScout(pointer.velocity.x * 0.5, pointer.velocity.y * 0.5)
      }
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonReleased() && this.operativeCamera?.isScoutMode()) {
        this.operativeCamera.endScout()
      }
    })

    // Visual atmosphere — VISIBILITY FIRST, atmosphere second
    this.atmosphere = new Atmosphere(this)
    createVignette(this, 0.04) // Barely there — just softens the corners
    startAmbientParticles(this, 0xaa8844, 4) // Light dust motes

    // Subtle radial player glow (teal/blue, 0.03 alpha, 200px radius) — hint of light
    this.playerLight = this.add.circle(px, py, 100, 0x4488cc, 0.03)
      .setDepth(2).setBlendMode(Phaser.BlendModes.ADD)
    // Gentle pulse
    this.tweens.add({
      targets: this.playerLight,
      alpha: { from: 0.02, to: 0.04 },
      scale: { from: 0.95, to: 1.05 },
      duration: 2000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })

    // Digital overlays — very subtle, never obscure gameplay
    this.scanlines = createScanlineOverlay(this, 0.015)
    this.chromatic = createChromaticAberration(this, 1, 0.04)
    this.lastPartnerDirective = 'follow'

    // Room visual theme
    RoomEffects.applyTheme(this, room.roomType ?? 'arena')

    // Tile ambient animations (floor sparks, wall glow pulse, parallax)
    this.tileAnimator = new TileAnimator(this, this.walls)
    this.tileAnimator.animate()

    // Scatter wall torches (warm point lights near walls)
    const wallPositions: Array<{ x: number; y: number }> = []
    const wallChildren = this.walls.getChildren() as Phaser.Physics.Arcade.Sprite[]
    for (const w of wallChildren) {
      wallPositions.push({ x: w.x, y: w.y })
    }
    // Place torches on ~10% of wall tiles
    const torchPositions = wallPositions.filter(() => Math.random() < 0.1)
    this.atmosphere.spawnWallTorches(torchPositions)

    // Embers floating upward near walls
    this.atmosphere.spawnEmbers(wallPositions)

    // Start ambient sound — the dungeon breathes
    sound.startAmbience()
    sound.startRoomAmbient(room.roomType ?? 'arena')

    // ── Spawn grace: enemies won't attack for 3 seconds so the player can orient ──
    this.spawnGraceUntil = Date.now() + this.SPAWN_GRACE_MS
    this.player.invincibleUntil = Date.now() + this.SPAWN_GRACE_MS

    // ── AI Brain: connect partner to Claude (web) or kbot (local) ──
    this.killCount = 0
    this.totalDamageDealt = 0
    this.totalDamageTaken = 0
    this.brain = new BrainBridge()
    this.brain.setContextProvider(() => this.buildBrainContext())
    this.brain.start()
    this.brain.onFloorReached(this.floorNumber)

    // Wire personality + memory into speech controller
    const adaptiveP = this.brain.getAdaptivePersonality()
    this.speechController.setPersonalityMood(adaptiveP.getMoodLabel() as 'reckless' | 'cautious' | 'protective' | 'bold' | 'balanced')
    this.speechController.setPartnerMemory(this.brain.getMemory().getPartnerMemory())

    // Run-start speech (references past runs via memory)
    const runStartLine = this.speechController.trySpeak('run_start', Date.now())
    if (runStartLine && this.partner.sprite?.active) {
      this.time.delayedCall(1500, () => {
        if (this.partner.sprite?.active) {
          this.partner.bubble?.destroy()
          this.partner.bubble = new SpeechBubble(this, this.partner.sprite.x, this.partner.sprite.y, runStartLine)
          sound.partnerSpeak()
        }
      })
    }

    // ── XP & Level Up ──
    this.progression = createProgressionState()
    this.levelUpScreen = new LevelUpScreen(this, (upgrade: Upgrade) => {
      this.applyUpgrade(upgrade)
    })

    // ── Floor Modifiers: reset state and create selection screen ──
    floorModifiers.clear()
    this.floorModifierScreen = new FloorModifierScreen(this, (accepted: FloorModifierDef[]) => {
      this.applyFloorModifiers(accepted)
    })

    // ── Procedural Systems: Noise, Node Graphs, Heat Map, Particles ──
    noise.reseed(Date.now())
    this.combatHeatMap = new CombatHeatMap(room.width, room.height, TILE_SIZE)
    this.proceduralParticles = new ProceduralParticles(this, 200)
    this.enemyAggressionGraph = createEnemyAggressionGraph()
    this.atmosphereGraph = createAtmosphereGraph()
    this.partnerConfidenceGraph = createPartnerConfidenceGraph()
    this.lastGraphEvalTime = 0
    this.lastAggressionScores = new Map()
    this.partnerConfidence = 0.5

    // ── AI Systems: Director, Adaptive Difficulty, Mood Engine ──
    director.reset()
    difficulty.startRun()
    resetMood()
    this.lastKillTime = 0
    this.lastDamageTime = 0
    this.prevPlayerPos = { x: px, y: py }
    this.directorSpawnCounter = 0
    this.bossPhase = 1

    // ── Room Manager: manages room lifecycle and door transitions ──
    this.roomManager = new RoomManager(this, this.floorData)
    this.roomManager.enterRoom(this.currentRoomIndex)

    // Listen for room:load events from RoomManager (triggered during fade transitions)
    eventBus.on('room:load', (roomIndex: unknown) => {
      this.loadRoom(roomIndex as number)
    })

    // ── Minimap: show floor layout in top-right corner ──
    this.minimap = new Minimap(this, this.floorData)
    this.minimap.setCurrentRoom(this.currentRoomIndex)

    // ── Debug API: mark dungeon scene active ──
    debugAPI.update({ scene: 'dungeon', gameOver: false, won: null })
  }

  update(_time: number, delta: number): void {
    if (this.gameOver) return
    if (this.floorModifierScreen?.isActive()) return

    const now = Date.now()
    this.elapsedMs += delta

    // ── Room Manager: tick room pacing state machine ──
    if (this.roomManager) {
      this.roomManager.update(delta)

      // Feed alive enemy count so RoomManager knows when combat is over
      const rmAlive = this.enemies.filter(e => e.hp > 0).length + (this.boss && !this.boss.isDead ? 1 : 0)
      this.roomManager.setAliveEnemyCount(rmAlive)

      // Check door overlap when room is cleared
      const playerWorldPos = this.player?.sprite ? { x: this.player.sprite.x, y: this.player.sprite.y } : null
      if (playerWorldPos) {
        const door = this.roomManager.checkDoorOverlap(playerWorldPos)
        if (door) {
          this.roomManager.onDoorReached(door)
        }
      }
    }

    // ── Player movement with acceleration/deceleration ──
    const move = this.inputMgr.getMovement()
    const targetVelX = move.x * PLAYER_SPEED
    const targetVelY = move.y * PLAYER_SPEED

    // Lerp current velocity toward target (smooth accel/decel)
    this.currentVelX = this.currentVelX + (targetVelX - this.currentVelX) * MOVE_LERP_FACTOR
    this.currentVelY = this.currentVelY + (targetVelY - this.currentVelY) * MOVE_LERP_FACTOR

    // Snap to zero when close enough (prevents infinite creep)
    if (Math.abs(this.currentVelX) < 0.5) this.currentVelX = 0
    if (Math.abs(this.currentVelY) < 0.5) this.currentVelY = 0

    this.player.sprite.setVelocity(this.currentVelX, this.currentVelY)

    // ── Footstep sounds tied to movement speed ──
    const moveSpeed = Math.sqrt(this.currentVelX * this.currentVelX + this.currentVelY * this.currentVelY)
    if (moveSpeed > FOOTSTEP_SPEED_THRESHOLD) {
      // Scale interval inversely with speed: faster movement = faster footsteps
      const speedRatio = Math.min(moveSpeed / PLAYER_SPEED, 1.5)
      const interval = FOOTSTEP_INTERVAL_MS / speedRatio
      if (now - this.lastFootstepTime > interval) {
        sound.footstep(this.footstepIndex)
        this.footstepIndex++
        this.lastFootstepTime = now
      }
    }

    // ── Operative Camera: context-sensitive zoom, adaptive lookahead, scout ──
    if (this.operativeCamera) {
      const aliveEnemies = this.enemies.filter(e => e.hp > 0)
      const enemyCount = aliveEnemies.length + (this.boss && !this.boss.isDead ? 1 : 0)
      const bossPresent = !!(this.boss && !this.boss.isDead)
      const bossEnraged = !!(this.boss && !this.boss.isDead && this.boss.isEnraged)
      const inCombat = enemyCount > 0 && aliveEnemies.some(e =>
        Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, this.player.sprite.x, this.player.sprite.y) < 200
      )
      const room = this.floorData?.rooms[this.currentRoomIndex]
      const camCtx: CameraContext = {
        enemyCount,
        bossPresent,
        bossEnraged,
        inCombat,
        playerVelocity: { x: this.currentVelX, y: this.currentVelY },
        roomWidth: (room?.width ?? 20) * TILE_SIZE,
        roomHeight: (room?.height ?? 15) * TILE_SIZE,
      }
      this.operativeCamera.setTargetPosition(this.player.sprite.x, this.player.sprite.y)
      this.operativeCamera.update(delta, camCtx)
    } else {
      // Fallback: legacy lookahead
      const speed = moveSpeed
      let lookaheadX = 0
      let lookaheadY = 0
      if (speed > 10) {
        lookaheadX = (this.currentVelX / speed) * CAMERA_LOOKAHEAD
        lookaheadY = (this.currentVelY / speed) * CAMERA_LOOKAHEAD
      }
      this.cameraTarget.setPosition(
        this.player.sprite.x + lookaheadX,
        this.player.sprite.y + lookaheadY,
      )
    }

    // ── Dodge ──
    if (this.inputMgr.isDodging() && now > this.dodgeCooldownUntil) {
      if (move.x !== 0 || move.y !== 0) {
        // Override lerp: instant dodge velocity
        this.currentVelX = move.x * DODGE_SPEED
        this.currentVelY = move.y * DODGE_SPEED
        this.player.sprite.setVelocity(this.currentVelX, this.currentVelY)
        this.player.invincibleUntil = now + DODGE_DURATION
        this.dodgeCooldownUntil = now + DODGE_COOLDOWN
        dashTrail(this, this.player.sprite.x, this.player.sprite.y, PLAYER_COLOR)
        // Procedural dash trail particles (noise-driven for organic feel)
        this.proceduralParticles.emit(this.player.sprite.x, this.player.sprite.y, RECIPE_DASH_TRAIL)
        // Squash & stretch: stretch on dash start
        dashStretch(this, this.player.sprite, this.player.baseScale, this.player.baseScale)
        sound.dodge()
        // Track dodge for adaptive difficulty (count as successful if enemies nearby)
        const nearbyForDodge = this.enemies.some(e => e.hp > 0 && Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, this.player.sprite.x, this.player.sprite.y) < 100)
        difficulty.recordDodgeAttempt(nearbyForDodge)
        // Partner reacts to player dodges
        const dodgeLine = this.speechController.trySpeak('player_dodged', now)
        if (dodgeLine && this.partner.sprite?.active) {
          this.partner.bubble?.destroy()
          this.partner.bubble = new SpeechBubble(this, this.partner.sprite.x, this.partner.sprite.y, dodgeLine)
          sound.partnerSpeak()
        }
        this.player.sprite.setAlpha(0.5)
        this.time.delayedCall(DODGE_DURATION, () => {
          if (this.player.sprite?.active) {
            this.player.sprite.setAlpha(1)
            // Squash on landing (dodge end)
            landingSquash(this, this.player.sprite, this.player.baseScale, this.player.baseScale)
          }
        })
      }
    }

    // ── Partner contextual speech: low HP warnings + personality events ──
    const playerHpRatio = this.player.hp / this.player.maxHp
    const partnerHpRatio = this.partner.hp / this.partner.maxHp
    if (playerHpRatio < 0.3 && this.lastPlayerHpRatio >= 0.3) {
      this.brain.onPlayerLowHp(playerHpRatio)
      const line = this.speechController.trySpeak('low_hp_player', now)
      if (line && this.partner.sprite?.active) {
        this.partner.bubble?.destroy()
        this.partner.bubble = new SpeechBubble(this, this.partner.sprite.x, this.partner.sprite.y, line)
        sound.partnerSpeak()
      }
    }
    if (partnerHpRatio < 0.3 && this.lastPartnerHpRatio >= 0.3) {
      this.brain.onPartnerLowHp()
      const line = this.speechController.trySpeak('low_hp_self', now)
      if (line && this.partner.sprite?.active) {
        this.partner.bubble?.destroy()
        this.partner.bubble = new SpeechBubble(this, this.partner.sprite.x, this.partner.sprite.y, line)
        sound.partnerSpeak()
      }
    }
    this.lastPlayerHpRatio = playerHpRatio
    this.lastPartnerHpRatio = partnerHpRatio

    // ── Idle chatter (between rooms / calm moments) ──
    const aliveEnemyCount = this.enemies.filter(e => e.hp > 0).length + (this.boss && !this.boss.isDead ? 1 : 0)
    const idleLine = this.speechController.tryIdleChat(now, aliveEnemyCount)
    if (idleLine && this.partner.sprite?.active) {
      this.partner.bubble?.destroy()
      this.partner.bubble = new SpeechBubble(this, this.partner.sprite.x, this.partner.sprite.y, idleLine)
      sound.partnerSpeak()
    }

    // ── Sync personality mood into speech controller periodically ──
    if (Math.random() < 0.01) {
      const mood = this.brain.getAdaptivePersonality().getMoodLabel()
      this.speechController.setPersonalityMood(mood as 'reckless' | 'cautious' | 'protective' | 'bold' | 'balanced')
    }

    // ── Combo reset check ──
    if (this.comboCount > 0 && now - this.lastComboAttack > COMBO_RESET_MS) {
      this.comboCount = 0
    }

    // ── Weapon switching: Q key or scroll wheel ──
    if (this.inputMgr.isSwitchingWeapon()) {
      this.weaponSystem.cycleWeapon()
      this.hud.setWeapon(this.weaponSystem.current.name, this.weaponSystem.current.color)
      sound.playerAttack(this.weaponSystem.weaponId) // weapon-specific switch sound
    }
    const scrollDir = this.inputMgr.consumeScrollCycle()
    if (scrollDir !== 0) {
      if (scrollDir > 0) {
        this.weaponSystem.cycleWeapon()
      } else {
        // Cycle backwards
        const ids = WEAPON_IDS
        const idx = ids.indexOf(this.weaponSystem.weaponId)
        this.weaponSystem.switchWeapon(ids[(idx - 1 + ids.length) % ids.length])
      }
      this.hud.setWeapon(this.weaponSystem.current.name, this.weaponSystem.current.color)
      sound.playerAttack(this.weaponSystem.weaponId)
    }

    // ── Secondary attack: E key (charge for Pulse, instant for others) ──
    if (this.inputMgr.isSecondaryJustDown()) {
      this.weaponSystem.beginCharge()
    }
    if (this.inputMgr.isSecondaryJustUp() || (this.inputMgr.isSecondaryDown() && this.weaponSystem.weaponId !== 'pulse')) {
      // For Pulse: release-to-fire charged shot. For others: fire on press.
      if (this.weaponSystem.weaponId === 'pulse' && this.inputMgr.isSecondaryJustUp()) {
        const pointer = this.inputMgr.getPointerWorld()
        const secAngle = Math.atan2(pointer.y - this.player.sprite.y, pointer.x - this.player.sprite.x)
        const secEffect = this.weaponSystem.secondaryAttack(this, this.player.sprite.x, this.player.sprite.y, secAngle)
        if (secEffect) {
          sound.playerAttack(this.weaponSystem.weaponId)
          this.registerWeaponEffect(secEffect)
        }
      }
    }
    if (this.inputMgr.isSecondaryJustDown() && this.weaponSystem.weaponId !== 'pulse') {
      const pointer = this.inputMgr.getPointerWorld()
      const secAngle = Math.atan2(pointer.y - this.player.sprite.y, pointer.x - this.player.sprite.x)
      const secEffect = this.weaponSystem.secondaryAttack(this, this.player.sprite.x, this.player.sprite.y, secAngle)
      if (secEffect) {
        sound.playerAttack(this.weaponSystem.weaponId)
        this.registerWeaponEffect(secEffect)
        // Blade dash: teleport player to dash endpoint
        if (secEffect.type === 'dash' && secEffect.x != null && secEffect.y != null) {
          this.player.sprite.setPosition(secEffect.x, secEffect.y)
        }
      }
    }

    // ── Player primary attack via WeaponSystem + Weapon Mod Sockets ──
    const modCooldownMult = getFireRateMultiplier(this.playerWeapon)

    // Mobile auto-aim: find nearest enemy and auto-fire when in range
    let mobileAutoFire = false
    let mobileAimAngle = 0
    if (this.inputMgr.mobile) {
      const AUTO_AIM_RANGE = 250
      const nearest = this.enemies
        .filter(e => e.hp > 0 && e.sprite.active)
        .map(e => ({
          enemy: e,
          dist: Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, this.player.sprite.x, this.player.sprite.y),
        }))
        .filter(e => e.dist < AUTO_AIM_RANGE)
        .sort((a, b) => a.dist - b.dist)[0]
      if (nearest) {
        mobileAutoFire = true
        mobileAimAngle = Math.atan2(
          nearest.enemy.sprite.y - this.player.sprite.y,
          nearest.enemy.sprite.x - this.player.sprite.x,
        )
      }
    }

    const shouldAttack = this.inputMgr.isAttacking() || mobileAutoFire
    if (shouldAttack) {
      // On mobile use auto-aim angle; on desktop use pointer direction
      let angle: number
      if (mobileAutoFire) {
        angle = mobileAimAngle
      } else {
        const pointer = this.inputMgr.getPointerWorld()
        angle = Math.atan2(pointer.y - this.player.sprite.y, pointer.x - this.player.sprite.x)
      }

      // Fire primary through WeaponSystem (handles its own cooldown)
      const effect = this.weaponSystem.primaryAttack(this, this.player.sprite.x, this.player.sprite.y, angle)
      if (effect) {
        this.player.lastAttack = now
        sound.playerAttack(this.weaponSystem.weaponId)

        // Track combo for damage purposes
        if (now - this.lastComboAttack <= COMBO_WINDOW_MS && this.comboCount > 0) {
          this.comboCount = Math.min(this.comboCount + 1, 3)
        } else {
          this.comboCount = 1
        }
        this.lastComboAttack = now
        if (this.comboCount > 1) sound.comboHit(this.comboCount)

        // Apply mod damage scaling to the effect
        const comboIndex = Math.min(this.comboCount - 1, COMBO_DAMAGE_MULTIPLIERS.length - 1)
        const comboMult = COMBO_DAMAGE_MULTIPLIERS[comboIndex]
        effect.damage = Math.round(effect.damage * comboMult * (1 / modCooldownMult))

        // Register effect for collision detection
        this.registerWeaponEffect(effect)

        // Split mod: spawn extra projectiles for projectile/bounce types
        if (effect.type === 'projectile' || effect.type === 'bounce') {
          applySplit(this.playerWeapon, this, this.player.sprite.x, this.player.sprite.y, angle, effect.damage, 'player',
            (sx, sy, sa, sd, so) => {
              const projData = createDefaultProjectileData(sd, PROJECTILE_SPEED)
              const modCtx = this.buildModContext(sx, sy, sa, so)
              applyMods(this.playerWeapon, projData, modCtx)
              const proj = new Projectile(this, sx, sy, sa, projData.damage, so)
              proj.sprite.setTint(projData.tint)
              proj.sprite.setScale(proj.sprite.scaleX * projData.scale, proj.sprite.scaleY * projData.scale)
              const speed = projData.speed
              proj.sprite.setVelocity(Math.cos(sa) * speed, Math.sin(sa) * speed)
              proj.sprite.setData('pierceCount', projData.pierceCount)
              proj.sprite.setData('homingStrength', projData.homingStrength)
              proj.sprite.setData('modSpeed', speed)
              this.projectiles.push(proj)
              this.physics.add.collider(proj.sprite, this.walls, () => {
                impactFlash(this, proj.sprite.x, proj.sprite.y, 0x88ccff)
                proj.destroy()
              })
            })
        }
      }
    }

    // ── WeaponSystem: check area effects (cone, melee_arc, aoe, dash, field) vs enemies ──
    this.processWeaponEffects(now)

    // ── WeaponSystem: cleanup expired effects ──
    this.weaponSystem.cleanup()

    // ── AI Director: pacing and tension ──
    const playerPos: Vec2 = { x: this.player.sprite.x, y: this.player.sprite.y }
    const partnerPos: Vec2 = { x: this.partner.sprite.x, y: this.partner.sprite.y }
    const aliveEnemiesForDirector = this.enemies.filter(e => e.hp > 0)
    const dirInput: DirectorInput = {
      enemyCount: aliveEnemiesForDirector.length + (this.boss && !this.boss.isDead ? 1 : 0),
      maxExpectedEnemies: 8,
      playerHp: this.player.hp,
      playerMaxHp: this.player.maxHp,
      partnerHp: this.partner.hp,
      partnerMaxHp: this.partner.maxHp,
      timeSinceLastKillMs: this.lastKillTime > 0 ? this.elapsedMs - this.lastKillTime : this.elapsedMs,
      timeSinceLastDamageTakenMs: this.lastDamageTime > 0 ? this.elapsedMs - this.lastDamageTime : this.elapsedMs,
      playerPosition: playerPos,
      elapsedMs: this.elapsedMs,
    }
    this.lastDirectorState = director.update(dirInput, delta)

    // Feed Director tension to adaptive sound system
    sound.setPlayerPosition(playerPos.x, playerPos.y, this.cameras.main.width)
    sound.setBattleIntensity(this.lastDirectorState.tension)

    // Director-driven spawning
    if (this.lastDirectorState.shouldSpawnEnemies && this.lastDirectorState.spawnCount > 0) {
      const diffAdj = difficulty.getMultipliers().spawnCountAdj
      const adjCount = Math.max(0, this.lastDirectorState.spawnCount + diffAdj)
      for (let i = 0; i < adjCount; i++) {
        this.directorSpawnCounter++
        const type = randomEnemyType()
        const sa = Math.random() * Math.PI * 2
        const sx = playerPos.x + Math.cos(sa) * 250
        const sy = playerPos.y + Math.sin(sa) * 250
        this.spawnEnemy(`dir_${this.directorSpawnCounter}`, sx, sy, type)
      }
    }

    // Director-driven health drops (blocked by Cursed Ground modifier)
    if (this.lastDirectorState.shouldDropHealth && this.lastDirectorState.healthDropPosition && !floorModifiers.getEffects().noHealthDrops) {
      const hPos = this.lastDirectorState.healthDropPosition
      const hPickup = spawnPickup(this, hPos.x, hPos.y, 'health_crystal')
      this.pickups.push(hPickup)
    }

    // ── Enemy Coordination: make enemies fight smart ──
    const coordEnemies: CoordinationEnemy[] = aliveEnemiesForDirector.map(e => ({
      id: e.id,
      position: { x: e.sprite.x, y: e.sprite.y },
      hp: e.hp,
      maxHp: e.maxHp,
      enemyType: e.enemyType,
      state: e.state,
      distanceToPlayer: Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, playerPos.x, playerPos.y),
      distanceToPartner: Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, partnerPos.x, partnerPos.y),
    }))
    const coordDirectives = coordinateEnemies(
      coordEnemies, playerPos, partnerPos,
      this.player.hp / this.player.maxHp, this.elapsedMs,
    )
    const coordMap = new Map(coordDirectives.map(cd => [cd.enemyId, cd]))

    // ── Adaptive Difficulty multipliers ──
    const diffMults = difficulty.getMultipliers()

    // ── Enemy AI (with coordination + Director aggression) ──
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue
      const ePos: Vec2 = { x: enemy.sprite.x, y: enemy.sprite.y }

      // Coordination may override target
      const coord = coordMap.get(enemy.id)
      let effPlayerPos = playerPos
      let effPartnerPos = partnerPos
      if (coord?.preferredTarget === 'player') {
        effPartnerPos = { x: playerPos.x + 9999, y: playerPos.y + 9999 }
      } else if (coord?.preferredTarget === 'partner') {
        effPlayerPos = { x: partnerPos.x + 9999, y: partnerPos.y + 9999 }
      }
      if (coord?.positionOffset) {
        effPlayerPos = { x: effPlayerPos.x + coord.positionOffset.x, y: effPlayerPos.y + coord.positionOffset.y }
      }

      const result = updateEnemyBehavior(ePos, enemy.hp, enemy.maxHp, enemy.state, effPlayerPos, effPartnerPos, enemy.enemyType, this.elapsedMs)
      enemy.state = result.newState

      // Heat map: enemies avoid stacking in hot zones (gentle push away from heat)
      const enemyHeat = this.combatHeatMap.getHeat(enemy.sprite.x, enemy.sprite.y)
      if (enemyHeat > 1.0 && result.newState === 'chase') {
        const hGrad = this.combatHeatMap.getHeatGradient(enemy.sprite.x, enemy.sprite.y)
        // Nudge perpendicular to heat gradient to spread out
        result.velocity.x -= hGrad.y * 15
        result.velocity.y += hGrad.x * 15
      }

      // Apply Director aggression + adaptive difficulty speed + coordination speed + node graph aggression
      const aggrMod = this.lastDirectorState?.enemyAggressionMod ?? 1.0
      const cSpeedMod = coord?.speedMod ?? 1.0
      const holdBack = coord?.holdBack ?? false
      // Node graph aggression: 0.5 = normal, >0.5 = faster, <0.5 = slower
      const graphAggr = this.lastAggressionScores.get(enemy.id) ?? 0.5
      const graphSpeedMod = 0.7 + graphAggr * 0.6  // range: 0.7x to 1.3x
      const totalSpeedMod = aggrMod * diffMults.enemySpeedMult * cSpeedMod * graphSpeedMod * (holdBack ? 0.3 : 1.0)
      enemy.sprite.setVelocity(result.velocity.x * totalSpeedMod, result.velocity.y * totalSpeedMod)

      const cfg = ENEMY_TYPES[enemy.enemyType]

      // Ranged enemies shoot projectiles (not during spawn grace, damage scaled)
      if (result.shouldShoot && enemy.enemyType === 'ranged' && now > this.spawnGraceUntil) {
        const shootCooldown = cfg.shootCooldown ?? 1500
        if (now - enemy.lastShot > shootCooldown) {
          enemy.lastShot = now
          const scaledDmg = Math.round(cfg.damage * diffMults.enemyDamageMult)
          const proj = new Projectile(this, enemy.sprite.x, enemy.sprite.y, result.targetAngle, scaledDmg, 'enemy')
          this.projectiles.push(proj)
          this.physics.add.collider(proj.sprite, this.walls, () => {
            impactFlash(this, proj.sprite.x, proj.sprite.y, 0xff6644)
            proj.destroy()
          })
          muzzleFlash(this, enemy.sprite.x, enemy.sprite.y, result.targetAngle, cfg.color)
        }
      }

      // Contact damage with telegraph warning (melee, fast, tank)
      // Skip attacks during spawn grace period
      if (result.shouldAttack && now - enemy.lastAttack > ATTACK_COOLDOWN && now > this.spawnGraceUntil) {
        // Check proximity to player
        const dPlayer = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.player.sprite.x, this.player.sprite.y)
        if (dPlayer < cfg.attackRange) {
          // Telegraph: flash white before dealing damage
          if (!enemy.telegraphing) {
            enemy.telegraphing = true
            enemyTelegraph(this, enemy.sprite, TELEGRAPH_DURATION_MS)
            const capturedDamage = cfg.damage
            this.time.delayedCall(TELEGRAPH_DURATION_MS, () => {
              if (enemy.hp <= 0 || !enemy.sprite?.active) {
                enemy.telegraphing = false
                return
              }
              // Re-check proximity after telegraph delay
              const d2 = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.player.sprite.x, this.player.sprite.y)
              if (d2 < cfg.attackRange + 10) {
                this.dealDamage(enemy, this.player, capturedDamage, Date.now())
              }
              enemy.lastAttack = Date.now()
              enemy.telegraphing = false
            })
          }
        }
        // Check proximity to partner
        const dPartner = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.partner.sprite.x, this.partner.sprite.y)
        if (dPartner < cfg.attackRange) {
          if (!enemy.telegraphing) {
            enemy.telegraphing = true
            enemyTelegraph(this, enemy.sprite, TELEGRAPH_DURATION_MS)
            const capturedDamage = cfg.damage
            this.time.delayedCall(TELEGRAPH_DURATION_MS, () => {
              if (enemy.hp <= 0 || !enemy.sprite?.active) {
                enemy.telegraphing = false
                return
              }
              const d2 = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.partner.sprite.x, this.partner.sprite.y)
              if (d2 < cfg.attackRange + 10) {
                this.dealDamage(enemy, this.partner, capturedDamage, Date.now())
              }
              enemy.lastAttack = Date.now()
              enemy.telegraphing = false
            })
          }
        }
      }
    }

    // ── Boss AI ──
    if (this.boss && !this.boss.isDead) {
      this.boss.update(playerPos, partnerPos, now, this.elapsedMs)

      // Boss contact damage
      const bDist = Phaser.Math.Distance.Between(this.boss.sprite.x, this.boss.sprite.y, this.player.sprite.x, this.player.sprite.y)
      if (bDist < this.boss.getContactRange()) {
        this.dealDamage(null, this.player, this.boss.getContactDamage(), now)
      }

      // Boss orbit projectiles vs player/partner
      for (const proj of this.boss.bossProjectiles) {
        if (!proj.sprite?.active) continue
        const dpPlayer = Phaser.Math.Distance.Between(proj.sprite.x, proj.sprite.y, this.player.sprite.x, this.player.sprite.y)
        if (dpPlayer < 14) {
          this.dealDamage(null, this.player, proj.damage, now)
          proj.sprite.destroy()
          continue
        }
        const dpPartner = Phaser.Math.Distance.Between(proj.sprite.x, proj.sprite.y, this.partner.sprite.x, this.partner.sprite.y)
        if (dpPartner < 14) {
          this.dealDamage(null, this.partner, proj.damage, now)
          proj.sprite.destroy()
        }
      }
    }

    // ── Partner AI: Utility AI decides directive, then FSM executes it ──
    const brainDirective = this.brain.getLastDirective()
    if (brainDirective) {
      this.partner.directive = brainDirective.type
    }
    const brainSpeech = this.brain.getLastSpeech()
    if (brainSpeech && this.partner.sprite.active) {
      this.partner.bubble?.destroy()
      this.partner.bubble = new SpeechBubble(this, this.partner.sprite.x, this.partner.sprite.y, brainSpeech)
    }

    // Utility AI: score-based decision making for partner directive
    const utilityEnemies = this.enemies.filter(e => e.hp > 0).map(e => ({
      id: e.id,
      position: { x: e.sprite.x, y: e.sprite.y },
      hp: e.hp,
      maxHp: e.maxHp,
      distanceToPartner: Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, partnerPos.x, partnerPos.y),
      distanceToPlayer: Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, playerPos.x, playerPos.y),
    }))
    if (this.boss && !this.boss.isDead) {
      utilityEnemies.push({
        id: this.boss.id,
        position: { x: this.boss.sprite.x, y: this.boss.sprite.y },
        hp: this.boss.hp,
        maxHp: this.boss.maxHp,
        distanceToPartner: Phaser.Math.Distance.Between(this.boss.sprite.x, this.boss.sprite.y, partnerPos.x, partnerPos.y),
        distanceToPlayer: Phaser.Math.Distance.Between(this.boss.sprite.x, this.boss.sprite.y, playerPos.x, playerPos.y),
      })
    }
    const utilityCtx: UtilityContext = {
      partnerPos,
      partnerHp: this.partner.hp,
      partnerMaxHp: this.partner.maxHp,
      playerPos,
      playerHp: this.player.hp,
      playerMaxHp: this.player.maxHp,
      enemies: utilityEnemies,
      directorTension: this.lastDirectorState?.tension ?? 0.5,
      personality: this.brain.getCurrentPersonality(),
      currentAction: this.partner.directive,
    }
    const utilityResult = evaluatePartnerAction(utilityCtx)

    // Apply Utility AI directive (only if no brain override from Claude/kbot)
    if (!brainDirective) {
      this.partner.directive = utilityResult.action
    }

    // Director posture override: high tension forces conservative, low forces aggressive
    if (this.lastDirectorState?.partnerPosture === 'conservative' && this.partner.directive === 'attack') {
      this.partner.directive = 'defend'
    } else if (this.lastDirectorState?.partnerPosture === 'aggressive' && this.partner.directive === 'follow') {
      this.partner.directive = 'attack'
    }

    // Partner confidence from node graph: low confidence -> retreat, high confidence -> attack
    if (this.partnerConfidence < 0.25 && this.partner.directive === 'attack') {
      this.partner.directive = 'defend'
    } else if (this.partnerConfidence > 0.75 && this.partner.directive === 'follow') {
      this.partner.directive = 'flank'
    }

    const enemyInfos = this.enemies.filter(e => e.hp > 0).map(e => ({
      id: e.id,
      position: { x: e.sprite.x, y: e.sprite.y },
      hp: e.hp,
    }))
    if (this.boss && !this.boss.isDead) {
      enemyInfos.push({
        id: this.boss.id,
        position: { x: this.boss.sprite.x, y: this.boss.sprite.y },
        hp: this.boss.hp,
      })
    }
    const partnerResult = updatePartnerBehavior(partnerPos, this.partner.hp, this.partner.maxHp, playerPos, enemyInfos, this.partner.directive)

    // Heat map influence: when retreating/defending, nudge partner toward cold (safe) zones
    let heatNudgeX = 0
    let heatNudgeY = 0
    if (this.partner.directive === 'retreat' || this.partner.directive === 'defend') {
      const gradient = this.combatHeatMap.getHeatGradient(partnerPos.x, partnerPos.y)
      // Move AGAINST the gradient (away from heat)
      const heatInfluence = 30
      heatNudgeX = -gradient.x * heatInfluence
      heatNudgeY = -gradient.y * heatInfluence
    }
    this.partner.sprite.setVelocity(
      partnerResult.velocity.x + heatNudgeX,
      partnerResult.velocity.y + heatNudgeY,
    )

    // Partner attack
    if (partnerResult.shouldAttack && partnerResult.targetId && now - this.partner.lastAttack > ATTACK_COOLDOWN) {
      // Could be targeting boss or an enemy
      let targetSprite: { x: number; y: number } | null = null
      if (partnerResult.targetId === 'boss' && this.boss && !this.boss.isDead) {
        targetSprite = { x: this.boss.sprite.x, y: this.boss.sprite.y }
      } else {
        const target = this.enemies.find(e => e.id === partnerResult.targetId && e.hp > 0)
        if (target) {
          targetSprite = { x: target.sprite.x, y: target.sprite.y }
        }
      }

      if (targetSprite) {
        const angle = Math.atan2(targetSprite.y - this.partner.sprite.y, targetSprite.x - this.partner.sprite.x)
        const proj = new Projectile(this, this.partner.sprite.x, this.partner.sprite.y, angle, PARTNER_DAMAGE, 'partner')
        this.projectiles.push(proj)
        this.physics.add.collider(proj.sprite, this.walls, () => proj.destroy())
        this.partner.lastAttack = now
      }
    }

    // ── Projectile vs enemy/boss collisions ──
    for (const proj of this.projectiles) {
      if (!proj.sprite?.active) continue

      // Enemy projectiles damage player/partner
      if (proj.owner === 'enemy') {
        const dpPlayer = Phaser.Math.Distance.Between(proj.sprite.x, proj.sprite.y, this.player.sprite.x, this.player.sprite.y)
        if (dpPlayer < 14) {
          this.dealDamage(null, this.player, proj.damage, now)
          proj.destroy()
          continue
        }
        const dpPartner = Phaser.Math.Distance.Between(proj.sprite.x, proj.sprite.y, this.partner.sprite.x, this.partner.sprite.y)
        if (dpPartner < 14) {
          this.dealDamage(null, this.partner, proj.damage, now)
          proj.destroy()
          continue
        }
        continue // Don't check enemy projectiles against enemies
      }

      // Player/partner projectiles hit enemies (with mod support: pierce, onHit)
      let hitSomething = false
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0 || !enemy.sprite?.active) continue
        const d = Phaser.Math.Distance.Between(proj.sprite.x, proj.sprite.y, enemy.sprite.x, enemy.sprite.y)
        if (d < 16) {
          this.dealDamage(null, enemy, proj.damage, now)

          // Fire mod onHit callbacks (only for player projectiles with mods)
          if (proj.owner === 'player') {
            const modCtx = this.buildModContext(proj.sprite.x, proj.sprite.y, 0, proj.owner)
            fireModOnHit(this.playerWeapon, enemy.id, enemy.sprite.x, enemy.sprite.y, proj.damage, modCtx)
          }

          // Pierce: if projectile has pierce count, don't destroy it
          const pierceCount = (proj.sprite.getData('pierceCount') as number) ?? 0
          if (pierceCount > 0) {
            proj.sprite.setData('pierceCount', pierceCount - 1)
            // Continue without destroying — projectile passes through
          } else {
            // Check for Arc weapon bounce: redirect projectile to next enemy
            const matchingEffect = this.weaponSystem.effects.find(e => e.sprite === proj.sprite && e.type === 'bounce')
            if (matchingEffect && matchingEffect.bouncesLeft && matchingEffect.bouncesLeft > 0) {
              const bounceTargets = this.enemies
                .filter(e => e.hp > 0 && e.sprite.active)
                .map(e => ({ x: e.sprite.x, y: e.sprite.y, id: e.id }))
              const didBounce = this.weaponSystem.handleBounce(
                this, matchingEffect,
                proj.sprite.x, proj.sprite.y,
                bounceTargets, enemy.id,
              )
              if (!didBounce) {
                proj.destroy()
              }
              // If it bounced, the projectile continues — don't destroy
            } else {
              proj.destroy()
            }
          }
          hitSomething = true
          break
        }
      }

      // Player/partner projectiles hit boss (with mod onHit support)
      if (!hitSomething && proj.sprite?.active && this.boss && !this.boss.isDead && (proj.owner === 'player' || proj.owner === 'partner')) {
        const bDist = Phaser.Math.Distance.Between(proj.sprite.x, proj.sprite.y, this.boss.sprite.x, this.boss.sprite.y)
        if (bDist < 24) {
          this.boss.takeDamage(proj.damage, now)

          // Fire mod onHit callbacks on boss hit
          if (proj.owner === 'player') {
            const modCtx = this.buildModContext(proj.sprite.x, proj.sprite.y, 0, proj.owner)
            fireModOnHit(this.playerWeapon, 'boss', this.boss.sprite.x, this.boss.sprite.y, proj.damage, modCtx)
          }

          const pierceCount = (proj.sprite.getData('pierceCount') as number) ?? 0
          if (pierceCount > 0) {
            proj.sprite.setData('pierceCount', pierceCount - 1)
          } else {
            proj.destroy()
          }
        }
      }
    }

    // ── Homing: update projectile tracking per frame ──
    for (const proj of this.projectiles) {
      if (!proj.sprite?.active || proj.owner !== 'player') continue
      const homingStr = (proj.sprite.getData('homingStrength') as number) ?? 0
      if (homingStr > 0) {
        const enemyPositions = this.enemies
          .filter(e => e.hp > 0 && e.sprite.active)
          .map(e => ({ x: e.sprite.x, y: e.sprite.y, hp: e.hp }))
        // Also include boss
        if (this.boss && !this.boss.isDead) {
          enemyPositions.push({ x: this.boss.sprite.x, y: this.boss.sprite.y, hp: this.boss.hp })
        }
        const modSpeed = (proj.sprite.getData('modSpeed') as number) ?? PROJECTILE_SPEED
        applyHoming(proj.sprite, homingStr, enemyPositions, modSpeed)
      }
    }

    // ── Clean up dead projectiles ──
    this.projectiles = this.projectiles.filter(p => p.sprite?.active)

    // ── Update health bars (pass delta for damage ghost effect) ──
    this.player.healthBar.update(this.player.sprite.x, this.player.sprite.y, this.player.hp, this.player.maxHp, delta)
    this.partner.healthBar.update(this.partner.sprite.x, this.partner.sprite.y, this.partner.hp, this.partner.maxHp, delta)
    for (const e of this.enemies) {
      if (e.hp > 0) {
        e.healthBar.update(e.sprite.x, e.sprite.y, e.hp, e.maxHp, delta)
      }
    }

    // ── Depth scaling: entities larger when lower on screen ──
    if (this.roomHeightPx > 0) {
      const playerDepth = depthScale(this.player.baseScale, this.player.sprite.y, this.roomHeightPx)
      this.player.sprite.setScale(playerDepth)

      const partnerDepth = depthScale(this.partner.baseScale, this.partner.sprite.y, this.roomHeightPx)
      this.partner.sprite.setScale(partnerDepth)

      for (const e of this.enemies) {
        if (e.hp > 0 && e.sprite.active) {
          const eDepth = depthScale(e.baseScale, e.sprite.y, this.roomHeightPx)
          e.sprite.setScale(eDepth)
        }
      }
    }

    // ── Update entity glows ──
    if (this.player.glow) updateEntityGlow(this.player.glow, this.player.sprite.x, this.player.sprite.y)
    if (this.partner.glow) updateEntityGlow(this.partner.glow, this.partner.sprite.x, this.partner.sprite.y)
    for (const e of this.enemies) {
      if (e.hp > 0 && e.glow) updateEntityGlow(e.glow, e.sprite.x, e.sprite.y)
    }

    // ── Update environmental lights ──
    if (this.playerLight?.active) {
      this.playerLight.setPosition(this.player.sprite.x, this.player.sprite.y)
    }
    if (this.bossLight?.active && this.boss && !this.boss.isDead) {
      this.bossLight.setPosition(this.boss.sprite.x, this.boss.sprite.y)
    }

    // ── Update partner bubble position ──
    if (this.partner.bubble) {
      this.partner.bubble.updatePosition(this.partner.sprite.x, this.partner.sprite.y)
    }

    // ── HUD ──
    const aliveEnemies = this.enemies.filter(e => e.hp > 0).length
    const bossAlive = this.boss && !this.boss.isDead ? 1 : 0
    const xpToNext = xpForNextLevel(this.progression.level)
    const xpRatio = xpToNext > 0 ? Math.min(1, this.progression.xp / xpToNext) : 0
    this.hud.update(this.player.hp, this.player.maxHp, this.partner.hp, this.partner.maxHp, aliveEnemies + bossAlive, xpRatio)

    // ── Mood Engine: AI-driven atmosphere ──
    this.atmosphere.setPlayerPosition(this.player.sprite.x, this.player.sprite.y)
    this.atmosphere.setPartnerPosition(this.partner.sprite.x, this.partner.sprite.y)
    this.atmosphere.setEnemyPositions(
      this.enemies.filter(e => e.hp > 0).map(e => ({ x: e.sprite.x, y: e.sprite.y })),
    )
    this.atmosphere.setBrainThinking(this.brain.getLastDirective() !== null)

    // Evaluate mood through the MoodEngine instead of simple derivation
    const moodCtx: MoodContext = {
      enemyCount: aliveEnemies + bossAlive,
      enemiesInRange: this.enemies.filter(e => e.hp > 0 && Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, playerPos.x, playerPos.y) < 100).length,
      playerHpRatio: this.player.hp / this.player.maxHp,
      partnerHpRatio: this.partner.hp / this.partner.maxHp,
      partnerDirective: this.partner.directive,
      directorTension: this.lastDirectorState?.tension ?? 0.5,
      directorPhase: this.lastDirectorState?.phase ?? 'build',
      timeSinceLastKillMs: this.lastKillTime > 0 ? this.elapsedMs - this.lastKillTime : this.elapsedMs,
      timeSinceLastDamageTakenMs: this.lastDamageTime > 0 ? this.elapsedMs - this.lastDamageTime : this.elapsedMs,
      totalKills: this.killCount,
      nearDoor: false,
      roomCleared: this.roomCleared,
      bossDefeated: this.boss?.isDead ?? false,
      roomTimeMs: this.elapsedMs,
      playerPos,
      prevPlayerPos: this.prevPlayerPos,
    }
    const moodState = evaluateMood(moodCtx, delta)
    this.atmosphere.setMood(moodState.primaryMood)
    this.prevPlayerPos = { x: playerPos.x, y: playerPos.y }

    // ── Neural network flash: when partner changes directive ──
    if (this.partner.directive !== this.lastPartnerDirective) {
      this.lastPartnerDirective = this.partner.directive
      // Flash neural lines toward nearest enemy or player
      const nearestEnemy = this.enemies
        .filter(e => e.hp > 0)
        .sort((a, b) => {
          const da = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, this.partner.sprite.x, this.partner.sprite.y)
          const db = Phaser.Math.Distance.Between(b.sprite.x, b.sprite.y, this.partner.sprite.x, this.partner.sprite.y)
          return da - db
        })[0]
      if (nearestEnemy) {
        this.atmosphere.flashNeuralLines(nearestEnemy.sprite.x, nearestEnemy.sprite.y)
      } else {
        this.atmosphere.flashNeuralLines(this.player.sprite.x, this.player.sprite.y)
      }
    }

    // ── Procedural Systems Update ──
    // Combat Heat Map: decay all heat every frame
    this.combatHeatMap.update(delta)

    // Procedural Particles: update all active particles every frame
    this.proceduralParticles.update(delta)

    // Ambient dust particles: emit occasionally from noise-driven positions
    if (Math.random() < 0.02 && aliveEnemies > 0) {
      const dustX = playerPos.x + (Math.random() - 0.5) * 200
      const dustY = playerPos.y + (Math.random() - 0.5) * 200
      this.proceduralParticles.emit(dustX, dustY, RECIPE_AMBIENT_DUST)
    }

    // Node Graphs: evaluate once per second (not every frame)
    if (this.elapsedMs - this.lastGraphEvalTime > this.graphEvalInterval) {
      this.lastGraphEvalTime = this.elapsedMs

      const graphContext: GameContext = {
        time: this.elapsedMs / 1000,
        deltaMs: delta,
        playerPos,
        partnerPos,
        playerHp: this.player.hp,
        playerMaxHp: this.player.maxHp,
        partnerHp: this.partner.hp,
        partnerMaxHp: this.partner.maxHp,
        enemyCount: aliveEnemies + bossAlive,
        directorTension: this.lastDirectorState?.tension ?? 0.5,
        currentMood: moodState.primaryMood,
        killStreak: this.speechController.hasKillStreak() ? 3 : 0,
        combatHeat: this.combatHeatMap.getNormalizedHeat(),
      }

      // Evaluate atmosphere graph (mood vector)
      this.atmosphereGraph.evaluate(graphContext)

      // Evaluate partner confidence graph
      const confResult = this.partnerConfidenceGraph.evaluate(graphContext)
      this.partnerConfidence = confResult['confidence.out'] ?? confResult['out'] ?? 0.5

      // Evaluate enemy aggression graph for each living enemy
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0) continue
        const enemyContext: GameContext = {
          ...graphContext,
          entityHp: enemy.hp,
          entityMaxHp: enemy.maxHp,
          entityX: enemy.sprite.x,
          entityY: enemy.sprite.y,
          packSize: aliveEnemies,
        }
        const aggrResult = this.enemyAggressionGraph.evaluate(enemyContext)
        const aggrScore = aggrResult['aggression.out'] ?? aggrResult['out'] ?? 0.5
        this.lastAggressionScores.set(enemy.id, aggrScore)
      }
    }

    // ── Pickup collection ──
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i]
      if (!pickup.sprite?.active) {
        this.pickups.splice(i, 1)
        continue
      }
      const result = collectPickup(this, this.player.sprite.x, this.player.sprite.y, pickup)
      if (result.collected) {
        sound.pickup()
        if (result.healAmount) {
          this.player.hp = Math.min(this.player.hp + result.healAmount, this.player.maxHp)
        }
        this.pickups.splice(i, 1)
      }
    }

    // ── Weapon Mod pickup collection ──
    for (let i = this.modPickups.length - 1; i >= 0; i--) {
      const modPickup = this.modPickups[i]
      if (!modPickup.sprite?.active) {
        this.modPickups.splice(i, 1)
        continue
      }
      const result = collectModPickup(this.player.sprite.x, this.player.sprite.y, modPickup)
      if (result.collected && result.mod) {
        sound.pickup()
        addMod(this.playerWeapon, result.mod)
        destroyModPickup(this, modPickup)
        // Flash mod name on screen
        const cam = this.cameras.main
        showModPickupFlash(this, result.mod, cam.width / 2, cam.height * 0.3)
        this.modPickups.splice(i, 1)
        // Partner comments on rare/interesting mods
        const modLine = this.speechController.trySpeak('rare_mod_found', Date.now())
        if (modLine && this.partner.sprite?.active) {
          this.partner.bubble?.destroy()
          this.partner.bubble = new SpeechBubble(this, this.partner.sprite.x, this.partner.sprite.y, modLine)
          sound.partnerSpeak()
        }
      }
    }

    // ── Debuff ticking (burn/slow) ──
    const debuffEnemies = this.enemies
      .filter(e => e.hp > 0 && e.sprite.active)
      .map(e => ({
        id: e.id,
        hp: e.hp,
        speed: e.speed,
        baseSpeed: ENEMY_TYPES[e.enemyType]?.speed ?? e.speed,
        sprite: { x: e.sprite.x, y: e.sprite.y, active: e.sprite.active },
      }))
    this.activeDebuffs = tickDebuffs(
      this.activeDebuffs,
      debuffEnemies,
      (enemyId, damage) => {
        const enemy = this.enemies.find(e => e.id === enemyId)
        if (enemy && enemy.hp > 0) {
          this.dealDamage(null, enemy, damage, now)
        }
      },
      this,
    )
    // Sync debuff-modified speeds back to enemy entities
    for (const de of debuffEnemies) {
      const enemy = this.enemies.find(e => e.id === de.id)
      if (enemy) enemy.speed = de.speed
    }

    // ── Room clear celebration ──
    if (aliveEnemies === 0 && (!this.boss || this.boss.isDead) && !this.roomCleared) {
      this.roomCleared = true
      // Golden screen flash on room clear + victory fanfare
      flashRoomClear(this)
      sound.roomClear()
      // Notify RoomManager so it can unlock doors
      if (this.roomManager) {
        this.roomManager.onRoomCleared()
      }
      // Notify brain for personality adaptation + memory
      this.brain.onRoomCleared()
      // Partner celebrates
      const clearLine = this.speechController.forceSpeak('room_cleared')
      if (this.partner.sprite?.active) {
        this.partner.bubble?.destroy()
        this.partner.bubble = new SpeechBubble(this, this.partner.sprite.x, this.partner.sprite.y, clearLine)
        sound.partnerSpeak()
      }
    }

    // ── Debug API: push full game state snapshot every frame ──
    debugAPI.update({
      scene: 'dungeon',
      elapsed: this.elapsedMs / 1000,
      player: {
        x: this.player.sprite.x,
        y: this.player.sprite.y,
        hp: this.player.hp,
        maxHp: this.player.maxHp,
        alive: this.player.hp > 0 && this.player.sprite.active,
      },
      partner: {
        x: this.partner.sprite.x,
        y: this.partner.sprite.y,
        hp: this.partner.hp,
        maxHp: this.partner.maxHp,
        alive: this.partner.hp > 0 && this.partner.sprite.active,
        directive: this.partner.directive,
      },
      enemies: this.enemies
        .filter(e => e.sprite?.active)
        .map(e => ({
          id: e.id,
          x: e.sprite.x,
          y: e.sprite.y,
          hp: e.hp,
          maxHp: e.maxHp,
          state: e.state,
          alive: e.hp > 0,
        })),
      boss: this.boss ? {
        hp: this.boss.hp,
        maxHp: this.boss.maxHp,
        alive: !this.boss.isDead,
        phase: this.bossPhase,
      } : null,
      stats: {
        kills: this.killCount,
        damageDealt: this.totalDamageDealt,
        damageTaken: this.totalDamageTaken,
      },
      gameOver: this.gameOver,
      won: null,
    })

    // ── Lose: player death ends the run ──
    if (this.player.hp <= 0) {
      this.gameOver = true
      sound.playerDeath()

      // ── Death cam: dramatic zoom + desaturate ──
      if (this.operativeCamera) {
        this.operativeCamera.triggerKillCam('death')
      }

      this.brain.stop(this.buildBrainContext() ?? undefined)
      difficulty.endRun(this.elapsedMs / 1000, true)

      // Nemesis: the enemy that killed you might become a named elite
      const nearestEnemy = this.enemies.filter(e => e.hp > 0 && e.sprite.active)
        .sort((a, b) => {
          const da = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, this.player.sprite.x, this.player.sprite.y)
          const db = Phaser.Math.Distance.Between(b.sprite.x, b.sprite.y, this.player.sprite.x, this.player.sprite.y)
          return da - db
        })[0]
      if (nearestEnemy) {
        nemesisSystem.createFromKill(nearestEnemy.enemyType)
      }

      // ── Partner death memory: remember what killed us ──
      const killerType = nearestEnemy?.enemyType ?? (this.boss && !this.boss.isDead ? 'boss' as const : 'unknown' as const)
      this.brain.onRunDeath(killerType, this.floorNumber)

      // Partner's dying words
      const deathLine = this.speechController.forceSpeak('death')
      if (this.partner.sprite?.active) {
        this.partner.bubble?.destroy()
        this.partner.bubble = new SpeechBubble(this, this.partner.sprite.x, this.partner.sprite.y, deathLine)
      }

      eventBus.clear()
      this.time.delayedCall(500, () => this.scene.start('GameOverScene', {
        won: false,
        bossDefeated: false,
        floorNumber: this.floorNumber,
        roomIndex: this.currentRoomIndex,
      }))
    }
  }

  // ── Multi-Room: Clear current room contents ─────────────────────

  private clearRoom(): void {
    for (const e of this.enemies) {
      if (e.sprite?.active) {
        e.sprite.setActive(false).setVisible(false)
        if (e.sprite.body) e.sprite.body.enable = false
        e.sprite.destroy()
      }
      e.healthBar.destroy()
      if (e.glow) e.glow.destroy()
      if (e.shadow) e.shadow.destroy()
    }
    this.enemies = []

    for (const p of this.projectiles) {
      if (p.sprite?.active) p.destroy()
    }
    this.projectiles = []

    for (const pickup of this.pickups) {
      if (pickup.sprite?.active) pickup.sprite.destroy()
    }
    this.pickups = []

    // Clean up mod pickups
    for (const mp of this.modPickups) {
      mp.bobTween.destroy()
      mp.glow.destroy()
      mp.label.destroy()
      mp.sprite.destroy()
    }
    this.modPickups = []
    this.activeDebuffs = []

    // Clean up weapon system effects (tesla fields, etc.)
    for (const eff of this.weaponSystem.effects) {
      eff.destroy()
    }
    this.weaponSystem.effects.length = 0

    if (this.boss) {
      this.boss.destroy()
      this.boss = null
    }

    if (this.walls) {
      this.walls.clear(true, true)
    }

    RoomEffects.clearTheme(this)
  }

  // ── Multi-Room: Load a specific room by index ───────────────────

  private loadRoom(roomIndex: number): void {
    if (!this.floorData) return
    const room = this.floorData.rooms[roomIndex]
    if (!room) return

    this.clearRoom()
    this.currentRoomIndex = roomIndex
    this.roomCleared = false

    this.walls = renderRoom(this, room)
    this.physics.world.setBounds(0, 0, room.width * TILE_SIZE, room.height * TILE_SIZE)
    this.roomHeightPx = room.height * TILE_SIZE

    // Reposition player
    const px = room.playerSpawn.x * TILE_SIZE + TILE_SIZE / 2
    const py = room.playerSpawn.y * TILE_SIZE + TILE_SIZE / 2
    this.player.sprite.setPosition(px, py)
    this.player.sprite.setVelocity(0, 0)
    this.currentVelX = 0
    this.currentVelY = 0

    // Reposition partner
    const ppx = room.partnerSpawn.x * TILE_SIZE + TILE_SIZE / 2
    const ppy = room.partnerSpawn.y * TILE_SIZE + TILE_SIZE / 2
    this.partner.sprite.setPosition(ppx, ppy)
    this.partner.sprite.setVelocity(0, 0)

    this.physics.add.collider(this.player.sprite, this.walls)
    this.physics.add.collider(this.partner.sprite, this.walls)
    this.cameras.main.setBounds(0, 0, room.width * TILE_SIZE, room.height * TILE_SIZE)
    this.cameraTarget.setPosition(px, py)

    // ── Operative Camera: establishing shot on room enter ──
    if (this.operativeCamera) {
      this.operativeCamera.onRoomEnter()
    }

    // Spawn enemies based on room type
    if (room.roomType === 'boss') {
      const bossSpawn = room.enemySpawns[0] ?? { x: Math.floor(room.width / 2), y: Math.floor(room.height / 2) }
      const bossX = bossSpawn.x * TILE_SIZE + TILE_SIZE / 2
      const bossY = bossSpawn.y * TILE_SIZE + TILE_SIZE / 2
      const floorMult = 1 + (this.floorNumber - 1) * 0.25

      this.boss = new Boss(this, bossX, bossY, {
        onSpawnMinions: (count, bossPos) => this.spawnBossMinions(count, bossPos),
        onBossDeath: () => this.handleBossVictory(),
        onPhaseChange: (phase) => {
          this.bossPhase = phase
          sound.bossPhaseTransition()
          screenShake(this, SHAKE_BOSS, 200)
          flashWhite(this, 0.25, 100)
          if (phase === 2) {
            const line = this.speechController.forceSpeak('boss_phase_2')
            this.partner.bubble?.destroy()
            this.partner.bubble = new SpeechBubble(this, this.partner.sprite.x, this.partner.sprite.y, line)
            sound.partnerSpeak()
          } else if (phase === 3) {
            const line = this.speechController.forceSpeak('boss_phase_3')
            this.partner.bubble?.destroy()
            this.partner.bubble = new SpeechBubble(this, this.partner.sprite.x, this.partner.sprite.y, line)
            sound.partnerSpeak()
          }
        },
      })
      this.boss.hp = Math.round(this.boss.hp * floorMult)

      // Boss environmental glow (faint purple, larger, dimmer — separate from entity glow)
      this.bossLight = this.add.circle(bossX, bossY, 80, 0xcc00ff, 0.05)
        .setDepth(2).setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({
        targets: this.bossLight,
        alpha: { from: 0.03, to: 0.07 },
        scale: { from: 0.9, to: 1.1 },
        duration: 1500,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      })
      this.boss.maxHp = Math.round(this.boss.maxHp * floorMult)
      this.physics.add.collider(this.boss.sprite, this.walls)
    } else {
      this.spawnRoomEnemies(room)
    }

    RoomEffects.applyTheme(this, room.roomType ?? 'arena')
    this.tileAnimator = new TileAnimator(this, this.walls)
    this.tileAnimator.animate()

    const wallPositions: Array<{ x: number; y: number }> = []
    const wallChildren = this.walls.getChildren() as Phaser.Physics.Arcade.Sprite[]
    for (const wc of wallChildren) {
      wallPositions.push({ x: wc.x, y: wc.y })
    }
    this.atmosphere.spawnWallTorches(wallPositions.filter(() => Math.random() < 0.1))
    this.atmosphere.spawnEmbers(wallPositions)

    // Room-specific ambient sounds (drips, wind, chimes, etc.)
    sound.startRoomAmbient(room.roomType ?? 'arena')
    sound.doorOpen()

    // Reset combat heat map for the new room
    this.combatHeatMap = new CombatHeatMap(room.width, room.height, TILE_SIZE)

    this.spawnGraceUntil = Date.now() + this.SPAWN_GRACE_MS
    this.player.invincibleUntil = Date.now() + this.SPAWN_GRACE_MS
    resetMood()
    this.bossPhase = 1

    if (this.minimap) {
      this.minimap.setCurrentRoom(roomIndex)
    }

    // Notify brain of room entry
    this.brain.onRoomEnter()

    // Boss room gets special speech + personality event
    const isBossRoom = room.roomType === 'boss'
    if (isBossRoom) {
      this.brain.onBossEncounter()
    }

    const enterLine = this.speechController.forceSpeak(isBossRoom ? 'room_enter_boss' : 'room_enter')
    if (this.partner.sprite?.active) {
      this.partner.bubble?.destroy()
      this.partner.bubble = new SpeechBubble(this, this.partner.sprite.x, this.partner.sprite.y, enterLine)
      sound.partnerSpeak()
    }
  }

  // ── Multi-Room: Spawn enemies for a room (non-boss) ─────────────

  private spawnRoomEnemies(room: RoomData): void {
    for (let i = 0; i < room.enemySpawns.length; i++) {
      const sp = room.enemySpawns[i]
      const ex = sp.x * TILE_SIZE + TILE_SIZE / 2
      const ey = sp.y * TILE_SIZE + TILE_SIZE / 2
      const type = randomEnemyType()
      this.spawnEnemy(`enemy_${this.currentRoomIndex}_${i}`, ex, ey, type)
    }

    // Swarm modifier: spawn extra enemies at random positions in the room
    const extraCount = floorModifiers.getEffects().extraEnemiesPerRoom
    if (extraCount > 0) {
      for (let i = 0; i < extraCount; i++) {
        // Pick a random floor tile position — approximate using room center area
        const margin = 3
        const rx = (margin + Math.floor(Math.random() * (room.width - margin * 2))) * TILE_SIZE + TILE_SIZE / 2
        const ry = (margin + Math.floor(Math.random() * (room.height - margin * 2))) * TILE_SIZE + TILE_SIZE / 2
        const type = randomEnemyType()
        this.spawnEnemy(`swarm_${this.currentRoomIndex}_${i}`, rx, ry, type)
      }
    }
  }

  // ── Multi-Room: Start a new floor ───────────────────────────────

  private startNextFloor(): void {
    this.floorNumber++

    // Record floor reached in partner memory
    this.brain.onFloorReached(this.floorNumber)
    this.brain.onRunSurvived(this.floorNumber - 1)

    // Use contextual floor-start speech instead of generic message
    const floorLine = this.speechController.forceSpeak('floor_start')
    if (this.partner.sprite?.active) {
      this.partner.bubble?.destroy()
      this.partner.bubble = new SpeechBubble(this, this.partner.sprite.x, this.partner.sprite.y, floorLine)
      sound.partnerSpeak()
    }

    // Show floor modifier selection screen before generating the new floor
    const choices = floorModifiers.rollChoices()
    this.floorModifierScreen.show(this.floorNumber, choices)
  }

  /**
   * Called after the player confirms their floor modifier selections.
   * Actually generates and loads the new floor.
   */
  private applyFloorModifiers(accepted: FloorModifierDef[]): void {
    floorModifiers.setActiveModifiers(accepted)

    // Partner comments on active floor modifiers
    if (accepted.length > 0 && this.partner.sprite?.active) {
      this.time.delayedCall(500, () => {
        const modLine = this.speechController.trySpeak('floor_modifier_active', Date.now())
        if (modLine && this.partner.sprite?.active) {
          this.partner.bubble?.destroy()
          this.partner.bubble = new SpeechBubble(this, this.partner.sprite.x, this.partner.sprite.y, modLine)
          sound.partnerSpeak()
        }
      })
    }

    // Regenerate all textures with new dissolution level for deeper floor
    regenerateTextures(this, this.floorNumber)

    this.floorData = generateFloor(this.floorNumber)
    this.currentRoomIndex = this.floorData.startRoom

    if (this.roomManager) {
      this.roomManager.destroy()
    }
    this.roomManager = new RoomManager(this, this.floorData)

    if (this.minimap) {
      this.minimap.destroy()
    }
    this.minimap = new Minimap(this, this.floorData)
    this.minimap.setCurrentRoom(this.currentRoomIndex)

    this.hud.setFloor(this.floorNumber)
    this.loadRoom(this.currentRoomIndex)
    this.roomManager.enterRoom(this.currentRoomIndex)

    // Apply visibility reduction if darkness modifier is active
    const fx = floorModifiers.getEffects()
    if (fx.visibilityReduction > 0 && this.playerLight) {
      // Shrink the player light to simulate reduced visibility
      const reducedRadius = Math.max(40, 100 - fx.visibilityReduction)
      this.playerLight.setRadius(reducedRadius)
    } else if (this.playerLight) {
      this.playerLight.setRadius(100) // Reset to default
    }
  }

  // ── Spawn Enemy (typed) ─────────────────────────────────────────

  private spawnEnemy(id: string, x: number, y: number, type: EnemyType): EnemyEntity {
    const cfg = ENEMY_TYPES[type]
    const sprite = this.physics.add.sprite(x, y, cfg.sprite)
    sprite.setCollideWorldBounds(true)
    sprite.setTint(cfg.color)

    // Size differentiation — computed from actual sprite dimensions
    const enemyScale = getEnemyScale(this, cfg.sprite, type)
    sprite.setScale(enemyScale)

    // Enemy glow — subtle red under-light
    const glow = createEntityGlow(this, x, y, ENEMY_COLOR, 10, 0.08)
    // Entity shadow (dark ellipse under feet)
    const shadow = createEntityShadow(this, x, y, 14, 5)

    // Scale enemy stats by adaptive difficulty + floor modifiers
    const modFx = floorModifiers.getEffects()
    const adaptiveHp = Math.round(cfg.hp * difficulty.getMultipliers().enemyHpMult * modFx.enemyHpMult)
    const modifiedSpeed = cfg.speed * modFx.enemySpeedMult
    const modifiedDamage = Math.round(cfg.damage * modFx.enemyDamageMult)
    const enemy: EnemyEntity = {
      sprite,
      hp: adaptiveHp,
      maxHp: adaptiveHp,
      speed: modifiedSpeed,
      damage: modifiedDamage,
      id,
      healthBar: new HealthBar(this),
      lastAttack: 0,
      invincibleUntil: 0,
      state: 'idle',
      telegraphing: false,
      enemyType: type,
      color: cfg.color,
      lastShot: 0,
      baseScale: enemyScale,
      glow,
      shadow,
    }
    this.enemies.push(enemy)

    // Add collision with walls
    this.physics.add.collider(enemy.sprite, this.walls)

    return enemy
  }

  // ── Boss Minion Spawning ────────────────────────────────────────

  private spawnBossMinions(count: number, bossPos: Vec2): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const spawnDist = 50
      const sx = bossPos.x + Math.cos(angle) * spawnDist
      const sy = bossPos.y + Math.sin(angle) * spawnDist
      const minionId = `minion_${Date.now()}_${i}`
      this.spawnEnemy(minionId, sx, sy, 'fast')
    }
  }

  // ── Boss Victory Handler ────────────────────────────────────────

  private handleBossVictory(): void {
    sound.bossDeath()

    // ── Boss kill cam: cinematic slow-mo zoom ──
    if (this.operativeCamera) {
      this.operativeCamera.triggerKillCam('boss')
    }

    // Record boss kill in partner memory
    this.brain.onBossKill()

    // Brief victory moment — then advance to next floor
    this.roomCleared = true
    if (this.roomManager) {
      this.roomManager.onRoomCleared()
    }

    // Show floor-clear message, then generate next floor after delay
    this.time.delayedCall(1500, () => {
      this.startNextFloor()
    })
  }

  private createEntity(id: string, x: number, y: number, hp: number, speed: number, damage: number, texture: string, scale = 1): GameEntity {
    const sprite = this.physics.add.sprite(x, y, texture)
    sprite.setCollideWorldBounds(true)
    sprite.setScale(scale)

    // NOTE: Idle tweens removed — they fought with physics.
    // EntityAnimator handles idle bob/breathing correctly via body offset.

    return {
      sprite, hp, maxHp: hp, speed, damage, id,
      healthBar: new HealthBar(this, false),
      lastAttack: 0,
      invincibleUntil: 0,
      baseScale: scale,
    }
  }

  /** Build a ModContext for the weapon mod system. */
  private buildModContext(originX: number, originY: number, angle: number, owner: ProjectileOwner): ModContext {
    const aliveEnemies = this.enemies
      .filter(e => e.hp > 0 && e.sprite.active)
      .map(e => ({
        x: e.sprite.x,
        y: e.sprite.y,
        id: e.id,
        hp: e.hp,
        speed: e.speed,
      }))
    // Include boss as a target
    if (this.boss && !this.boss.isDead) {
      aliveEnemies.push({
        x: this.boss.sprite.x,
        y: this.boss.sprite.y,
        id: 'boss',
        hp: this.boss.hp,
        speed: 80,
      })
    }

    return {
      scene: this,
      originX,
      originY,
      angle,
      owner,
      spawnProjectile: (sx, sy, sa, sd, so, _mods) => {
        // Spawn a plain chain/lightning projectile (no further mods to prevent infinite loops)
        const proj = new Projectile(this, sx, sy, sa, sd, so)
        this.projectiles.push(proj)
        this.physics.add.collider(proj.sprite, this.walls, () => proj.destroy())
      },
      enemies: aliveEnemies,
      playerHp: this.player.hp,
      playerMaxHp: this.player.maxHp,
      healPlayer: (amount: number) => {
        this.player.hp = Math.min(this.player.hp + amount, this.player.maxHp)
      },
      dealAoeDamage: (x: number, y: number, radius: number, damage: number) => {
        const now = Date.now()
        for (const enemy of this.enemies) {
          if (enemy.hp <= 0 || !enemy.sprite.active) continue
          const dist = Phaser.Math.Distance.Between(x, y, enemy.sprite.x, enemy.sprite.y)
          if (dist <= radius) {
            this.dealDamage(null, enemy, damage, now)
          }
        }
        // Also check boss
        if (this.boss && !this.boss.isDead) {
          const bDist = Phaser.Math.Distance.Between(x, y, this.boss.sprite.x, this.boss.sprite.y)
          if (bDist <= radius) {
            this.boss.takeDamage(damage, now)
          }
        }
      },
      applyDebuff: (enemyId: string, type: DebuffType, duration: number, magnitude: number) => {
        addDebuff(this.activeDebuffs, enemyId, type, duration, magnitude)
      },
      floorNumber: this.floorNumber,
    }
  }

  /**
   * Register a WeaponSystem attack effect:
   * - For projectile/bounce effects, also track as a Projectile for existing collision code
   * - For area effects, they are handled in processWeaponEffects
   */
  private registerWeaponEffect(effect: AttackEffect): void {
    if (effect.sprite) {
      // Projectile-based effects: also add wall collision
      this.physics.add.collider(effect.sprite, this.walls, () => {
        impactFlash(this, effect.sprite!.x, effect.sprite!.y, 0x88ccff)
        effect.destroy()
      })
      // Create a compatible Projectile wrapper for existing collision code
      const projRef = effect.sprite.getData('projectile') as Projectile | undefined
      if (projRef) {
        // Store mod metadata on the sprite for hit callbacks
        const projData = createDefaultProjectileData(effect.damage, PROJECTILE_SPEED)
        const modCtx = this.buildModContext(effect.sprite.x, effect.sprite.y, 0, 'player')
        applyMods(this.playerWeapon, projData, modCtx)
        effect.sprite.setData('pierceCount', projData.pierceCount)
        effect.sprite.setData('homingStrength', projData.homingStrength)
        effect.sprite.setData('modSpeed', projData.speed)
        projRef.damage = effect.damage
        this.projectiles.push(projRef)
      }
    }
  }

  /**
   * Process area-of-effect weapon attacks against enemies and boss.
   * Called every frame to check cone, melee_arc, aoe, dash, and field effects.
   */
  private processWeaponEffects(now: number): void {
    for (const effect of this.weaponSystem.effects) {
      // Only process non-projectile effects (projectiles handled by existing collision code)
      if (effect.sprite) continue
      if (effect.type === 'projectile' || effect.type === 'bounce') continue

      const ex = effect.x ?? this.player.sprite.x
      const ey = effect.y ?? this.player.sprite.y
      const effectRadius = effect.radius ?? 40

      // Check each alive enemy
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0 || !enemy.sprite?.active) continue

        let hit = false

        if (effect.type === 'cone') {
          // Nova cone: 60 degree arc check
          hit = WeaponSystem.isInCone(
            ex, ey,
            this.getLastAimAngle(),
            Math.PI / 6,  // 30 degree half-angle = 60 degree total
            effectRadius,
            enemy.sprite.x, enemy.sprite.y,
          )
        } else if (effect.type === 'melee_arc') {
          // Blade melee arc: wider arc based on combo
          hit = WeaponSystem.isInCone(
            ex, ey,
            this.getLastAimAngle(),
            Math.PI / 3,  // 60 degree half-angle = 120 degree total
            effectRadius,
            enemy.sprite.x, enemy.sprite.y,
          )
        } else if (effect.type === 'aoe' || effect.type === 'dash') {
          // Circular area check
          const dist = Phaser.Math.Distance.Between(ex, ey, enemy.sprite.x, enemy.sprite.y)
          hit = dist <= effectRadius
        } else if (effect.type === 'field') {
          // Tesla field: continuous damage (handled by field timer ticks)
          const dist = Phaser.Math.Distance.Between(ex, ey, enemy.sprite.x, enemy.sprite.y)
          hit = dist <= effectRadius
        }

        if (hit) {
          this.dealDamage(null, enemy, effect.damage, now)

          // Fire mod onHit callbacks for area weapons too
          const modCtx = this.buildModContext(ex, ey, 0, 'player')
          fireModOnHit(this.playerWeapon, enemy.id, enemy.sprite.x, enemy.sprite.y, effect.damage, modCtx)
        }
      }

      // Check boss
      if (this.boss && !this.boss.isDead) {
        let hitBoss = false
        if (effect.type === 'cone' || effect.type === 'melee_arc') {
          hitBoss = WeaponSystem.isInCone(
            ex, ey,
            this.getLastAimAngle(),
            effect.type === 'cone' ? Math.PI / 6 : Math.PI / 3,
            effectRadius,
            this.boss.sprite.x, this.boss.sprite.y,
          )
        } else {
          const bDist = Phaser.Math.Distance.Between(ex, ey, this.boss.sprite.x, this.boss.sprite.y)
          hitBoss = bDist <= effectRadius
        }

        if (hitBoss) {
          this.boss.takeDamage(effect.damage, now)
          const modCtx = this.buildModContext(ex, ey, 0, 'player')
          fireModOnHit(this.playerWeapon, 'boss', this.boss.sprite.x, this.boss.sprite.y, effect.damage, modCtx)
        }
      }
    }
  }

  /** Get the last aim angle (from pointer to player). Used for cone hit checks. */
  private getLastAimAngle(): number {
    const pointer = this.input.activePointer
    const cam = this.cameras.main
    const worldX = pointer.x + cam.scrollX
    const worldY = pointer.y + cam.scrollY
    return Math.atan2(worldY - this.player.sprite.y, worldX - this.player.sprite.x)
  }

  private dealDamage(_source: GameEntity | null, target: GameEntity, amount: number, now: number): void {
    if (now < target.invincibleUntil) return

    // ── Critical hit system — Diablo: 15% chance, 2x damage ──
    const isPlayerOrPartnerAttacking = !!_source && (target.id !== 'player' && target.id !== 'partner')
    const isCrit = isPlayerOrPartnerAttacking && Math.random() < CRIT_CHANCE
    let finalDamage = isCrit ? Math.round(amount * CRIT_MULTIPLIER) : amount

    // ── Floor modifier: scale damage dealt/taken ──
    const fmEffects = floorModifiers.getEffects()
    if (isPlayerOrPartnerAttacking) {
      // Player/partner dealing damage to enemies — apply playerDamageMult (e.g., Berserker 2x)
      finalDamage = Math.round(finalDamage * fmEffects.playerDamageMult)
    } else if (target.id === 'player' || target.id === 'partner') {
      // Player/partner taking damage — apply playerDamageTakenMult (e.g., Berserker 2x)
      finalDamage = Math.round(finalDamage * fmEffects.playerDamageTakenMult)
    }

    target.hp -= finalDamage
    target.invincibleUntil = now + INVINCIBILITY_MS

    // Track damage stats for brain context + adaptive difficulty
    const isEnemy = this.enemies.some(e => e.id === target.id)
    const isBoss = this.boss && target.id === 'boss'
    if (isEnemy || isBoss) {
      this.totalDamageDealt += finalDamage
      difficulty.recordDamageDealt(finalDamage)
    } else if (target.id === 'player') {
      this.totalDamageTaken += finalDamage
      this.lastDamageTime = this.elapsedMs
      difficulty.recordDamageTaken(finalDamage)
    }

    // ── Combat Heat Map: record hit location ──
    this.combatHeatMap.recordHit(target.sprite.x, target.sprite.y, finalDamage)
    if (target.id === 'player') {
      this.combatHeatMap.recordPlayerDamage(target.sprite.x, target.sprite.y, finalDamage)
    }

    // ── VFX: Make every hit feel impactful ──
    const enemyEntity = isEnemy ? this.enemies.find(e => e.id === target.id) : null
    const color = enemyEntity ? enemyEntity.color : (isEnemy ? ENEMY_COLOR : (target.id === 'player' ? PLAYER_COLOR : PARTNER_COLOR))

    // ── Sound: audio confirmation within 50ms ──
    if (isEnemy) {
      const eType = enemyEntity?.enemyType
      const eX = target.sprite.x
      if (isCrit) { sound.criticalHit(eX) } else { sound.enemyHit(eType, eX) }
    } else if (target.id === 'player') {
      sound.playerHurt()
    } else if (target.id === 'partner') {
      // Partner got hit — notify brain for personality adaptation
      this.brain.onPartnerDamaged(finalDamage, this.partner.maxHp)
      // Vocalize
      const hitLine = this.speechController.trySpeak('partner_hit', now)
      if (hitLine && this.partner.sprite?.active) {
        this.partner.bubble?.destroy()
        this.partner.bubble = new SpeechBubble(this, this.partner.sprite.x, this.partner.sprite.y, hitLine)
      }
    }

    // ── Hit sparks — procedural noise-driven particles + legacy VFX ──
    if (isCrit) {
      critSparks(this, target.sprite.x, target.sprite.y, color)
    } else {
      // Noise-driven hit sparks (organic swirling motion)
      this.proceduralParticles.emit(target.sprite.x, target.sprite.y, createHitRecipe(color))
    }

    // ── Damage number — crits shown in yellow, with isCrit flag for larger font ──
    damageNumber(this, target.sprite.x, target.sprite.y, finalDamage, isCrit ? '#ffff44' : (isEnemy ? '#ffaa44' : '#ff4444'), isCrit)

    // ── Hitstop — Diablo weight: 70ms normal, 120ms crits ──
    hitstop(this, isCrit ? CRIT_HITSTOP_MS : 70)

    // ── Screen shake — scales with damage (Diablo-proportional) ──
    if (target.id === 'player') {
      const shakeIntensity = isBoss ? SHAKE_BOSS : Math.min(SHAKE_MEDIUM, SHAKE_SMALL + finalDamage * 0.3)
      screenShake(this, shakeIntensity, 120)
      flashWhite(this, 0.2, 60)
      glitchEffect(this, 2)
      // Big hit: red screen flash when >20% HP damage
      const hpPercent = finalDamage / this.player.maxHp
      if (hpPercent > 0.2) {
        flashRedDamage(this, 0.1, 100)
      }
    } else if (isCrit) {
      screenShake(this, CRIT_SHAKE_INTENSITY, 140)
      flashWhite(this, 0.1, 40)
      // Crit: brief white flash
      flashCritWhite(this)
    } else if (finalDamage >= 20) {
      screenShake(this, SHAKE_MEDIUM, 100)
    } else {
      screenShake(this, SHAKE_SMALL, 60)
    }

    // ── Knockback — Diablo DRAMATIC: exponential out, scaled with damage ──
    const kbMultiplier = isCrit ? 1.8 : Math.min(1.5, 0.8 + finalDamage * 0.04)
    const kbDist = KNOCKBACK_DISTANCE * kbMultiplier
    if (_source && _source.sprite?.active && target.sprite?.active) {
      const kbAngle = Math.atan2(target.sprite.y - _source.sprite.y, target.sprite.x - _source.sprite.x)
      knockbackTween(this, target.sprite, kbAngle, kbDist, KNOCKBACK_DURATION_MS, KNOCKBACK_EASE)
    } else if (target.sprite?.active) {
      const fallbackAngle = Math.random() * Math.PI * 2
      knockbackTween(this, target.sprite, fallbackAngle, kbDist * 0.7, KNOCKBACK_DURATION_MS, KNOCKBACK_EASE)
    }

    // Flash sprite + squash on impact
    target.sprite.setAlpha(0.3)
    landingSquash(this, target.sprite, target.baseScale, target.baseScale)
    this.time.delayedCall(80, () => {
      if (target.sprite?.active) target.sprite.setAlpha(1)
    })

    // Die
    if (target.hp <= 0) {
      // Death explosion — legacy VFX + procedural noise-driven burst
      deathExplosion(this, target.sprite.x, target.sprite.y, color, 14)
      // Procedural death burst: curl noise spirals with entity colors
      const deathPalette = enemyEntity
        ? [enemyEntity.color, 0xff6644, 0xdd2222, 0xff8844, 0xffaa22]
        : (target.id === 'player' ? [0x4488ff, 0x66aaff, 0x2266dd, 0xffffff] : [0x44ff88, 0x66ffaa, 0x22dd66, 0xffffff])
      this.proceduralParticles.emit(target.sprite.x, target.sprite.y, createDeathRecipe(deathPalette))

      if (isEnemy) {
        this.killCount++
        this.lastKillTime = this.elapsedMs
        difficulty.recordKill()
        // Record kill in combat heat map
        this.combatHeatMap.recordKill(target.sprite.x, target.sprite.y)
        sound.enemyDeath(enemyEntity?.enemyType, target.sprite.x)

        // ── Enhanced Kill Cam (OperativeCamera) ──
        // Track rapid kills for multi-kill detection
        const killNow = Date.now()
        this.recentKillTimestamps.push(killNow)
        this.recentKillTimestamps = this.recentKillTimestamps.filter(t => killNow - t < 1000)
        if (this.recentKillTimestamps.length >= 3 && this.operativeCamera) {
          // Multi-kill: 3+ kills within 1 second
          this.operativeCamera.triggerKillCam('multi')
        } else {
          // Normal kill: subtle zoom punch (original behavior)
          killSlowmo(this)
          killZoomPunch(this, KILL_ZOOM, KILL_ZOOM_DURATION)
        }

        // ── Kill streak speech + personality event ──
        this.speechController.registerKill()
        this.brain.onPartnerKill()
        // Track successful flanks (partner was flanking when kill happened)
        if (this.partner.directive === 'flank') {
          this.brain.onSuccessfulFlank()
        }
        if (this.speechController.hasKillStreak()) {
          this.brain.onKillStreak()
          const line = this.speechController.trySpeak('kill_streak', Date.now())
          if (line && this.partner.sprite?.active) {
            this.partner.bubble?.destroy()
            this.partner.bubble = new SpeechBubble(this, this.partner.sprite.x, this.partner.sprite.y, line)
            sound.partnerSpeak()
          }
        }

        // ── XP Award (scaled by floor modifiers) ──
        const floorFx = floorModifiers.getEffects()
        const xpGain = Math.round(getXPForKill('basic') * floorFx.xpMult)
        this.progression.xp += xpGain
        this.progression.totalKills++
        const pendingLevels = checkLevelUp(this.progression.xp, this.progression.level)
        if (pendingLevels > 0) {
          this.progression = applyLevelUps(this.progression, pendingLevels)
          // Show level up screen after a brief delay (let the kill feel land first)
          this.time.delayedCall(300, () => {
            if (!this.gameOver) {
              this.levelUpScreen.show(this.progression.level, getUpgradeChoices())
            }
          })
        }

        // ── Volatile modifier: enemies explode on death, dealing area damage ──
        if (floorFx.enemiesExplodeOnDeath) {
          const explX = target.sprite.x
          const explY = target.sprite.y
          const explRadius = 60
          const explDamage = 15
          deathExplosion(this, explX, explY, 0xff6600, 20)
          screenShake(this, SHAKE_SMALL, 100)
          if (this.player.sprite.active) {
            const pdx = this.player.sprite.x - explX
            const pdy = this.player.sprite.y - explY
            if (Math.sqrt(pdx * pdx + pdy * pdy) < explRadius) {
              this.player.hp -= explDamage
              flashRedDamage(this)
            }
          }
          if (this.partner.sprite.active) {
            const ptdx = this.partner.sprite.x - explX
            const ptdy = this.partner.sprite.y - explY
            if (Math.sqrt(ptdx * ptdx + ptdy * ptdy) < explRadius) {
              this.partner.hp -= explDamage
            }
          }
        }

        // ── Item drop: 20% base chance, scaled by floor loot modifier ──
        if (Math.random() < 0.2 * floorFx.lootDropMult) {
          const itemIds: ItemId[] = Object.keys(ITEM_DEFS) as ItemId[]
          let randomItem = itemIds[Math.floor(Math.random() * itemIds.length)]
          // Cursed Ground: reroll health drops into other items
          if (floorFx.noHealthDrops && randomItem === 'health_crystal') {
            const nonHealth = itemIds.filter(id => id !== 'health_crystal')
            randomItem = nonHealth[Math.floor(Math.random() * nonHealth.length)]
          }
          const pickup = spawnPickup(this, target.sprite.x, target.sprite.y, randomItem)
          this.pickups.push(pickup)
        }

        // ── Weapon Mod drop: 10% base chance, scaled by floor mod modifier ──
        if (Math.random() < 0.1 * floorFx.modDropMult) {
          const mod = rollModDrop(this.floorNumber)
          // Offset slightly from item drop position to avoid overlap
          const modPickup = spawnModPickup(this, target.sprite.x + 12, target.sprite.y - 8, mod)
          this.modPickups.push(modPickup)
        }
      }

      target.sprite.setActive(false).setVisible(false)
      target.healthBar.destroy()
      if (target.glow) target.glow.destroy()
      if (target.shadow) target.shadow.destroy()
      if (target.sprite.body) target.sprite.body.enable = false
    }
  }

  // ── Brain: build game state snapshot for the AI ──

  private buildBrainContext(): BrainContext | null {
    if (!this.player?.sprite?.active || !this.partner?.sprite?.active) return null

    const enemies = this.enemies
      .filter(e => e.hp > 0 && e.sprite.active)
      .map(e => {
        const dx = e.sprite.x - this.player.sprite.x
        const dy = e.sprite.y - this.player.sprite.y
        const pdx = e.sprite.x - this.partner.sprite.x
        const pdy = e.sprite.y - this.partner.sprite.y
        return {
          id: e.id,
          position: { x: e.sprite.x, y: e.sprite.y },
          hp: e.hp,
          maxHp: e.maxHp,
          state: e.state,
          distanceToPlayer: Math.sqrt(dx * dx + dy * dy),
          distanceToPartner: Math.sqrt(pdx * pdx + pdy * pdy),
        }
      })

    // Include boss as an enemy if alive
    if (this.boss && !this.boss.isDead) {
      const bdx = this.boss.sprite.x - this.player.sprite.x
      const bdy = this.boss.sprite.y - this.player.sprite.y
      const bpdx = this.boss.sprite.x - this.partner.sprite.x
      const bpdy = this.boss.sprite.y - this.partner.sprite.y
      enemies.push({
        id: 'boss',
        position: { x: this.boss.sprite.x, y: this.boss.sprite.y },
        hp: this.boss.hp,
        maxHp: this.boss.maxHp,
        state: 'chase' as const,
        distanceToPlayer: Math.sqrt(bdx * bdx + bdy * bdy),
        distanceToPartner: Math.sqrt(bpdx * bpdx + bpdy * bpdy),
      })
    }

    return {
      room: {
        width: this.floorData?.rooms[this.currentRoomIndex]?.width ?? 20,
        height: this.floorData?.rooms[this.currentRoomIndex]?.height ?? 15,
      },
      player: {
        position: { x: this.player.sprite.x, y: this.player.sprite.y },
        hp: this.player.hp,
        maxHp: this.player.maxHp,
        facing: 0,
        isAttacking: Date.now() - this.player.lastAttack < 200,
      },
      partner: {
        position: { x: this.partner.sprite.x, y: this.partner.sprite.y },
        hp: this.partner.hp,
        maxHp: this.partner.maxHp,
        currentDirective: this.partner.directive,
      },
      enemies,
      meta: {
        elapsedSeconds: this.elapsedMs / 1000,
        enemiesKilled: this.killCount,
        damageDealt: this.totalDamageDealt,
        damageTaken: this.totalDamageTaken,
      },
    }
  }

  // ── Upgrade Application ──

  private applyUpgrade(upgrade: Upgrade): void {
    switch (upgrade.id) {
      case 'max_hp':
        this.player.maxHp += 10
        this.player.hp = Math.min(this.player.hp + 10, this.player.maxHp)
        break
      case 'damage':
        this.player.damage += 5
        break
      case 'speed':
        this.player.speed *= 1.15
        break
      case 'attack_speed':
        // Reduce attack cooldown (handled via constant, store multiplier)
        break
      case 'partner_damage':
        this.partner.damage += 5
        break
      case 'partner_hp':
        this.partner.maxHp += 15
        this.partner.hp = Math.min(this.partner.hp + 15, this.partner.maxHp)
        break
    }

    // Partner reacts to upgrade with personality-flavored opinion
    if (this.partner.sprite?.active) {
      const opinionLine = this.speechController.trySpeak('partner_opinion', Date.now())
      const fallback = upgrade.id.startsWith('partner') ? 'Appreciated.' : 'Good choice.'
      this.partner.bubble?.destroy()
      this.partner.bubble = new SpeechBubble(
        this, this.partner.sprite.x, this.partner.sprite.y,
        opinionLine ?? fallback,
      )
    }
  }
}
