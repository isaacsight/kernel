# SYNTH Design Bible

> Every decision in this document serves one goal: make the player's hands feel something.

## I. WHAT'S WRONG RIGHT NOW

SYNTH has **systems without soul**. It has:
- Projectiles but no weapon identity
- Enemies but no readable attack patterns
- Rooms but no atmosphere variation between them
- A partner but no personality you can feel
- VFX but no animation states
- A boss but no dramatic pacing
- Sprites but they're concept art, not game-ready assets

The game works mechanically. It doesn't work emotionally.

## II. THE THREE PILLARS

Every feature, every line of code, every art asset must serve at least one:

### Pillar 1: FEEL
The game must feel incredible in the first 2 seconds of touching the controls.
- Movement: acceleration curves with momentum (not instant stop)
- Attacks: the screen responds to every hit (shake, flash, hitstop, particles)
- Feedback: every action has visual + audio confirmation within 50ms
- Death: dramatic, not abrupt. Time slows, particles burst, screen dims.

### Pillar 2: SURPRISE
Every run must surprise the player. Not just random rooms — surprising combinations.
- Weapons that interact with the environment (fire + oil = explosion)
- Partner callouts that are contextually relevant, not canned
- Enemy compositions that create emergent tactics (tank shields ranged)
- Items that synergize in ways the player discovers ("wait, shield + speed =...")

### Pillar 3: BOND
The player must care about their AI partner.
- The partner must have opinions ("I don't like this room")
- The partner must remember ("Last run you rushed that boss. Let me tank this time")
- The partner must surprise ("I found a hidden passage while you were fighting")
- The partner must fail sometimes (makes recovery feel earned)

## III. COMBAT DESIGN (Learning from Hades)

### Weapon Identity
Each weapon should feel like stepping into a different heroic identity.

**Current:** One projectile attack + combo spread.
**Target:** 4 distinct weapon modes, switchable mid-run.

| Weapon | Fantasy | Primary | Secondary |
|--------|---------|---------|-----------|
| **Pulse** | Precise marksman | Single fast projectile | Charged shot (hold to charge) |
| **Nova** | Area controller | Short-range burst (cone) | Ground slam (AoE circle) |
| **Blade** | Melee warrior | 3-hit melee combo | Dash attack (lunge + slash) |
| **Arc** | Chain lightning | Bouncing projectile (hits 3 enemies) | Tesla field (damage area) |

### Attack Rhythm
Combat should have RHYTHM, not spam.
- Attacks have distinct phases: wind-up (50ms) → active (100ms) → recovery (150ms)
- During recovery, player is vulnerable — creates risk/reward
- Dodge cancels recovery — rewards skilled timing
- Perfect dodge (within 50ms of enemy attack) triggers bullet-time for 300ms

### Enemy Design Language
Every enemy must be readable in 0.5 seconds:
- **Shape = behavior:** Circles strafe, triangles rush, squares tank, stars ranged
- **Color = threat:** Red = damage, orange = ranged, cyan = fast, purple = boss
- **Size = HP:** Small = 1-2 hits, medium = 3-5 hits, large = tank
- **Glow intensity = attack state:** Dim = idle, bright = about to attack, flash = attacking

### Damage Feedback Stack
Every hit applies ALL of these simultaneously:
1. Hitstop: 35ms freeze (both attacker and target)
2. Screen shake: 3px intensity, 80ms duration, directional
3. Hit sparks: 6 particles at impact point
4. Damage number: floating text, eased upward
5. Knockback: target pushed 8px in hit direction
6. Sound: impact SFX with ±10% pitch randomization
7. Flash: target sprite flashes white for 1 frame
8. Camera: subtle 2px zoom-in on impact, ease back over 200ms

## IV. ENTITY STATE MACHINES

Every entity needs proper animation states, not just tweens.

```
Player States:
  idle → walk (on input)
  walk → idle (no input for 100ms)
  idle|walk → attack (on click)
  attack → idle (after recovery)
  idle|walk|attack → dodge (on space)
  dodge → idle (after duration)
  any → hurt (on damage)
  hurt → idle (after 300ms)
  any → dead (HP <= 0)

Enemy States:
  idle → alert (player within detection range)
  alert → chase (after 500ms telegraph)
  chase → attack (within attack range)
  attack → recover (after attack animation)
  recover → chase (after cooldown)
  any → hurt (on damage, interrupt current state)
  any → flee (HP below threshold)
  any → dead (HP <= 0)

Partner States:
  follow → combat (enemies detected)
  combat → follow (all enemies dead)
  combat → retreat (HP below 20%)
  any → speak (brain directive includes speech)
  any → hurt (on damage)
```

## V. ART DIRECTION (What Needs to Change)

### Current Problems:
1. Sprites are concept art scaled down — detail is lost, silhouettes are muddy
2. Top-down perspective inconsistent — some sprites are front-view
3. Black backgrounds on sprites (partially fixed with ImageMagick)
4. No animation frames — everything is static with tweens
5. Tiles don't tile seamlessly

### Target Art Style:
- **Silhouette-first:** Every entity must be identifiable from its shape alone at 32px
- **Limited palette:** Max 8 colors per entity (cyan, green, red, orange, purple, white, black, accent)
- **Glow as information:** Glow color = entity state (idle=dim, alert=bright, attacking=flash)
- **Consistent perspective:** Pure top-down, no 3/4 view mixing

### Midjourney Prompt Improvements:
Add to all prompts:
- "pure top-down bird's eye view"
- "simple clean silhouette"
- "flat color with rim lighting only"
- "black background, no ground plane"
- "16-bit pixel art, 4-color per character"

## VI. ROOM DESIGN

### Room Pacing:
Each room should have a dramatic arc:
1. **Enter:** 1 second of peace. Player surveys the room.
2. **Alert:** Enemies wake up with staggered timing (not all at once).
3. **Combat:** 30-60 seconds of intense fighting.
4. **Clear:** Satisfying "all dead" feedback (sound, flash, doors open).
5. **Reward:** Brief moment to collect drops before moving on.

### Room Variety:
Rooms need IDENTITY, not just different wall layouts.
- **Lighting variation:** Some rooms are bright, some are dim
- **Hazards:** Lava tiles, spike traps, moving walls
- **Verticality cues:** Bridges, pits (visual-only depth)
- **Narrative elements:** Computer terminals, dead explorers, messages

## VII. PARTNER DESIGN

### Personality Must Be Felt, Not Told
Don't say "aggressive partner" — show it through:
- Movement patterns (aggressive partner runs ahead of player)
- Target selection (aggressive partner always targets strongest enemy)
- Speech timing (aggressive partner talks more during fights, less between)
- Risk tolerance (aggressive partner ignores own low HP)

### Partner Communication Rules:
1. Max 1 speech bubble per 8 seconds (don't spam)
2. Never repeat the same line twice in a run
3. Contextual lines weighted 3x over generic ones
4. Partner should sometimes be wrong ("I think we should go left" when right is better)
5. Silence is valid — don't always comment

## VIII. SOUND DESIGN PRINCIPLES

### Layers:
1. **Ambience:** Always-on drone, changes per room type
2. **Music:** Adaptive layers (calm exploration → intense combat)
3. **SFX:** Every action has a sound. No silent interactions.
4. **UI:** Subtle clicks, whooshes for menus and HUD changes

### Critical SFX to Implement:
- Player attack (per weapon type)
- Enemy hit (thud for melee, sizzle for energy)
- Player hurt (gasp/grunt)
- Dodge (whoosh)
- Pickup (crystalline chime)
- Level up (triumphant chord)
- Door open (mechanical grinding)
- Boss phase change (dramatic stinger)
- Partner speech (subtle pop/notification sound)

## IX. PERFORMANCE BUDGET

| Metric | Budget |
|--------|--------|
| Frame rate | 60fps constant, no drops below 55 |
| Projectile pool | 50 max (recycle, don't create/destroy) |
| Particle pool | 200 max |
| Draw calls | < 100 per frame |
| Memory | < 128MB total |
| Load time | < 2 seconds |
| Input latency | < 16ms (1 frame) |

## X. IMPLEMENTATION PRIORITY

**Phase A (Make it Feel Right):**
1. Entity state machines (replace tweens with proper states)
2. Input buffering (100ms queue)
3. Animation cancel system
4. Sound effects (even placeholder beeps)
5. Room enter/clear pacing

**Phase B (Make it Interesting):**
1. Weapon variety (4 types)
2. Item synergies
3. Room hazards
4. Enemy compositions (designed encounters, not random)
5. Partner personality through behavior

**Phase C (Make it Beautiful):**
1. New Midjourney sprites with corrected prompts
2. Sprite sheet animations (idle, walk, attack, hurt)
3. Tile seamlessness
4. Background parallax layers
5. Post-processing refinement

**Phase D (Make it Ship):**
1. Sound + music integration
2. Menu screens
3. Save system
4. Steam/itch.io build
5. Trailer

---

*This document is the source of truth. Every code change, every art asset, every design decision must reference a principle from this bible. If it doesn't serve Feel, Surprise, or Bond — it doesn't ship.*
