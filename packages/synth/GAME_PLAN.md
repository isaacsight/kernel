# SYNTH — Game Development Plan

> A co-op roguelike where your AI partner actually thinks.
> Powered by kbot's cognitive architecture.

## Vision

The first game where the AI companion isn't scripted — it reasons, remembers, adapts.
Built by Claude Code + kbot + Midjourney. Open source.

---

## Phase 1: Core Feel (CURRENT — Week 1)

**Goal: One room feels incredible to play.**

### 1.1 Movement & Controls (Priority: CRITICAL)
- [ ] Acceleration/deceleration curves (not instant velocity)
- [ ] Input buffering (100ms queue before inputs are valid)
- [ ] Coyote time on dodge (80ms grace window)
- [ ] Animation cancel system (attack cancels movement, dodge cancels attack)
- [ ] Camera lerp with lookahead (camera leads in movement direction)
- [ ] Controller support (gamepad API)

### 1.2 Combat Feel (Priority: CRITICAL)
- [ ] Hitstop already implemented — tune to 35-50ms
- [ ] Knockback with easing (not linear push)
- [ ] Attack chains (3-hit combo with timing windows)
- [ ] Hitbox vs hurtbox separation (hitboxes smaller than sprites)
- [ ] Enemy telegraph system (flash/glow 400ms before attack)
- [ ] I-frame budget per action (dodge: 150ms, hit: 80ms)
- [ ] Projectile trail effect (fading afterimages)

### 1.3 Visual Polish (Priority: HIGH)
- [ ] Integrate Midjourney sprites (replace procedural — DONE)
- [ ] Sprite scaling for depth (entities slightly larger when lower on screen)
- [ ] Squash and stretch on entities (compress on land, stretch on dash)
- [ ] Death dissolve effect (pixels scatter outward)
- [ ] Dynamic lighting per-entity (glow radiates from energy cores)
- [ ] Post-processing: bloom on bright elements, subtle vignette (DONE)
- [ ] Floor tile variation (random rotation/flip for organic feel)

### 1.4 Audio (Priority: HIGH)
- [ ] Hit SFX with ±10% pitch randomization
- [ ] Ambient dungeon drone (low, continuous)
- [ ] Footstep sounds tied to movement
- [ ] UI feedback sounds (menu, pickup, level up)
- [ ] Silence before boss encounter
- [ ] Use Kenney free audio or generate with AI

### 1.5 Partner Personality (Priority: MEDIUM)
- [ ] Hardcoded speech lines per game state (entering room, low HP, kill streak, victory)
- [ ] Speech bubble timing (don't overlap, cooldown between lines)
- [ ] Partner emotes (sprite flash/pulse to show emotion)
- [ ] Different voice lines per personality type

---

## Phase 2: Roguelike Loop (Week 2-3)

**Goal: Run-based progression. Every run is different.**

### 2.1 Procedural Dungeon Generation
- [ ] BSP tree room generator (5-8 rooms per floor)
- [ ] Room templates: arena, corridor, treasure, boss, shop
- [ ] Guaranteed path from start to boss
- [ ] Door transitions with fade effect
- [ ] Minimap showing explored rooms
- [ ] Room clear gates (doors lock until all enemies dead)

### 2.2 Enemy Variety
- [ ] Melee Drone (chase + contact damage) — DONE
- [ ] Ranged Turret (stationary, shoots projectiles)
- [ ] Fast Swarm (low HP, high speed, comes in groups of 3-5)
- [ ] Heavy Cube (high HP, slow, area attack)
- [ ] Shielded enemy (must attack from behind)
- [ ] Boss: The Core (3 phases, unique attack patterns)

### 2.3 Items & Progression
- [ ] Pickup system: health crystal, damage boost, speed boost, shield
- [ ] Gold drops from enemies
- [ ] Shop room (spend gold on items between floors)
- [ ] XP per kill → level up → choose 1 of 3 upgrades
- [ ] Upgrade categories: attack, defense, speed, partner buff
- [ ] Relic system (passive items that modify gameplay)

### 2.4 Player Abilities (QWER)
- [ ] Q: Primary attack (projectile, already done)
- [ ] W: Secondary attack (melee sweep, close range, high damage)
- [ ] E: Utility (shield burst, pushes enemies back)
- [ ] R: Ultimate (charged by kills, devastating area attack)
- [ ] Ability cooldown UI (circular timer on HUD)

### 2.5 Meta Progression (between runs)
- [ ] Persistent currency (crystals) earned per run
- [ ] Unlock new partner personalities
- [ ] Unlock new player abilities
- [ ] Unlock harder difficulty modifiers
- [ ] Run history log (floor reached, time, cause of death)

---

## Phase 3: kbot Brain (Week 3-4)

**Goal: The AI partner actually thinks. This is the differentiator.**

### 3.1 Brain Architecture
- [ ] BrainBridge: adapter between game state and kbot SDK
- [ ] BrainPrompt: serialize game state → compact text for LLM
- [ ] Strategic reasoning every 5-10 seconds via `kbot --pipe --agent strategist`
- [ ] Parse response into BrainDirective (attack/defend/retreat/flank/hold)
- [ ] Fallback: pure local FSM if no API key configured

### 3.2 Partner Communication
- [ ] Brain speech output → speech bubbles in-game
- [ ] Contextual callouts: "I'll draw aggro", "Heal up, I'll cover", "Boss is vulnerable"
- [ ] Emotional state reflected in atmosphere system (DONE)
- [ ] Partner warns about dangers it notices (enemies flanking, low HP)

### 3.3 Memory System
- [ ] Per-run observations: "player rushed into groups", "player prefers ranged"
- [ ] Cross-run profile: synthesized player style
- [ ] Partner adapts strategy based on accumulated knowledge
- [ ] Memory stored at `~/.kbot/synth/` (not kbot's own memory)
- [ ] Show partner insights on game over screen

### 3.4 Personality System
- [ ] Aggressive: prioritizes damage, initiates fights, taunts enemies
- [ ] Support: stays close, heals (if available), shields player
- [ ] Tactical: flanks, uses terrain, coordinates pincer attacks
- [ ] Chaotic: unpredictable, sometimes brilliant, sometimes reckless
- [ ] Each personality modifies system prompt + behavior weights

---

## Phase 4: Polish & Ship (Week 4-6)

**Goal: Ready for itch.io and Steam.**

### 4.1 Menus & UI
- [ ] Title screen with SYNTH logo + particle effects
- [ ] Partner selection screen (personality + visual preview)
- [ ] Settings (volume, controls, accessibility)
- [ ] Pause menu
- [ ] Run summary screen (stats, partner observations)
- [ ] Credits

### 4.2 Art Iteration
- [ ] Generate attack animation sprites via Midjourney Animate
- [ ] Generate idle animations for all entities
- [ ] Background parallax layers (distant dungeon walls)
- [ ] UI elements (buttons, panels, icons) via Midjourney
- [ ] Logo and key art for store page

### 4.3 Sound & Music
- [ ] Layered music system (add/remove tracks based on combat state)
- [ ] Unique boss music
- [ ] Menu music
- [ ] Sound effects for all abilities, pickups, UI

### 4.4 Distribution
- [ ] itch.io page (web build, free)
- [ ] Electron wrapper for Steam
- [ ] Steamworks SDK integration
- [ ] Steam store page (screenshots, trailer, description)
- [ ] Open source release on GitHub

### 4.5 Accessibility
- [ ] Colorblind mode (entity outlines instead of color-only differentiation)
- [ ] Screen reader support for menus
- [ ] Remappable controls
- [ ] Difficulty options (enemy HP/damage multipliers)
- [ ] Reduced motion option (disable screen shake, particles)

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Engine | Phaser 3.87+ (TypeScript) |
| Build | Vite 6 |
| AI Brain | kbot SDK (`@kernel.chat/kbot`) |
| Art Pipeline | Midjourney → Sharp → Phaser sprites |
| Animation | Midjourney V1 video → frame extraction |
| Audio | Kenney free audio / AI-generated |
| Distribution | Web (itch.io) + Electron (Steam) |
| Source | Open source (MIT) |

## Art Direction

**Style:** Dark sci-fi dungeon, neon-lit geometric aesthetic
**Palette:** Deep navy backgrounds, cyan (player), emerald (partner), crimson (enemies), gold (pickups)
**Reference:** Hyper Light Drifter meets Tron meets Dead Cells
**Pipeline:** Midjourney `/imagine` → Sharp downscale (nearest neighbor) → 28-32px pixel art

## Key Metrics

| Metric | Target |
|--------|--------|
| Time to first fun | < 2 seconds (movement must feel perfect instantly) |
| Average run length | 8-15 minutes |
| Room clear time | 30-60 seconds |
| Partner response time | < 3 seconds (brain tick) |
| Frame rate | 60fps constant |
| Bundle size | < 5MB (web build) |
| Steam price | $9.99 |
| itch.io | Free (pay what you want) |

---

*Built by Isaac + Claude Code + kbot + Midjourney. The game that builds itself.*
