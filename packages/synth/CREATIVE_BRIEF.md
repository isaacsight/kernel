# SYNTH — Creative Brief

## Thesis

**SYNTH is the first game where the AI isn't a feature — it's the author.**

Claude Code writes the engine. kbot's personality shapes the companion. Midjourney paints the world. The human plays inside the collaboration. Every pixel, every mechanic, every line of dialogue was generated through the conversation between human intent and machine capability.

The game doesn't simulate AI. It IS AI — made tangible, playable, felt.

---

## The Three Layers

### Layer 1: Blizzard Weight (the body)

Every action has consequence. Hits land with bass and screen shake. Enemies fly back when struck. The dungeon has gravity — you feel the stone under your feet and the danger in the dark.

Reference: Diablo II's catacombs. The weight of a hammer connecting. The silence after a room clears.

**Principles:**
- Hitstop scales with damage (60-120ms)
- Screen shake scales with impact (2-10px)
- Knockback uses exponential easing (fast start, slow stop)
- Sound has low-frequency punch
- Silence after combat is earned, not empty

### Layer 2: Indie Soul (the heart)

Color is emotion. Movement is dance. The screen is a canvas. Every frame should be screenshot-worthy. The game has taste — it knows when to be loud and when to breathe.

Reference: Hyper Light Drifter's palette. Transistor's painted world. Celeste's precision. Hades' rhythm. Dead Cells' flow.

**Principles:**
- Atmosphere shifts with partner mood (color lerps over 2-3s)
- Combat has rhythm — combo timing feels musical
- Negative space is intentional (the void is compositional)
- Particles have character (warm near player, cold near enemies)
- Room clear triggers an exhale (brief slow-mo, then silence, then drone fades back)

### Layer 3: The Art of Technology (the meaning)

This is what makes SYNTH different from every other dungeon crawler. The game IS the AI stack, rendered as experience. The player doesn't just play alongside AI — they play inside the conversation between three intelligences.

Reference: Nothing. This hasn't been done before.

**Principles:**
- Subtle digital artifacts (scanlines, glitch on damage) remind you of the medium
- Partner emits data-stream particles when "thinking" — the AI made visible
- Neural network lines flash on directive changes — decisions visualized
- The light radius is knowledge; the void is the unknown the AI navigates
- The partner speaks like a person, not a system — personality is the proof of intelligence

---

## Visual Identity

### Palette

```
Background:     #0A0A12  (true dark, almost black)
Player:         #4488FF  (cyan blue — clarity, precision)
Partner:        #44FF88  (emerald green — life, intelligence)
Enemy:          #FF4444  (hot red — danger, aggression)
Boss:           #CC00FF  (deep purple — power, mystery)
Walls:          #323C3C  (dark stone — boundary, safety)
Floor:          #14142E  (deep navy — ground, the known)
Pickups:        #FFC832  (gold — reward, progress)
Highlights:     #F0F0FF  (white — accent, emphasis)
```

### Mood States (Atmosphere System)

| Mood | Palette Shift | Particle Behavior | Sound |
|------|--------------|-------------------|-------|
| Calm | Deep blue-purple, cyan highlights | Slow, warm dust motes | Low ambient drone |
| Aggressive | Warm amber, hot red bleed | Fast, sharp, erratic | Intensified bass |
| Afraid | Desaturated, cold monochrome | Tight, clustered, trembling | High-frequency tension |
| Confident | Bright, saturated, full spectrum | Expansive, flowing outward | Rich, layered |
| Desperate | High contrast, neon on black | Chaotic, explosive bursts | Distorted, urgent |

### Art Rules

- Silhouette-first at 32px (readable from shape alone)
- Max 8 colors per entity
- Glow = state (dim = idle, bright = alert, flash = attacking)
- Pure top-down perspective
- Flat color with rim lighting only
- Light radius with organic edge (not a perfect circle)
- Darkness is true black void, not gray fog

---

## Audio Identity

### Hierarchy

1. **Silence** — the most powerful sound. Earned after combat.
2. **Ambient drone** — the dungeon breathing. Always present, never dominant.
3. **Footsteps** — the player's heartbeat. Subtle, echoing, rhythmic.
4. **Combat** — builds in layers. More enemies = more intensity.
5. **Impact** — bass-heavy, immediate. The confirmation that you exist in this world.

### Sound Design Rules

- Hit sounds: low-frequency punch with ±10% pitch randomization
- Enemy death: satisfying crunch/shatter
- Boss phase change: low rumble that shakes the drone
- Room clear: instant silence, then 2s fade-back of ambient
- Partner speech: no audio (text only) — the silence of AI communication

---

## The Partner

The partner is not an NPC. The partner is kbot — an AI with personality, memory, and judgment.

### Personality Types

| ID | Name | Voice | Combat Style |
|----|------|-------|-------------|
| tactical | Operative | Terse, precise, professional | Flanks, coordinates, efficient |
| aggressive | Vanguard | Bold, direct, confrontational | Damage-first, no retreat |
| support | Guardian | Caring, watchful, steady | Protects player, intercepts |
| chaotic | Wildcard | Unpredictable, playful, sharp | Brilliant or reckless |

### Speech Rules

- Cooldown: 8-10 seconds between lines
- Lines are EARNED — triggered by game events, not timers
- Terse: max 5-6 words per line
- Character-consistent: each personality has a distinct voice
- Non-combat lines give the partner LIFE ("...you there?", "We make a good team.")

### Example Lines (Operative)

| Trigger | Line |
|---------|------|
| Room enter | "Stay sharp." |
| Enemy spotted | "Contact." |
| Kill streak (3+) | "Good rhythm." |
| Player low HP | "Fall back. I'll cover." |
| Partner low HP | "I can hold." |
| Boss phase 2 | "It's adapting." |
| Room clear | "Clear." |
| Idle 15s | "...waiting on you." |
| After big fight | "That was earned." |

---

## The AI Stack (What Makes This Real)

```
Human (Isaac)
  ├── Vision, direction, taste
  ├── "Make it feel like Diablo meets Hyper Light Drifter"
  └── Plays and feels — the final judge

Claude Code (Opus)
  ├── Writes every line of engine code
  ├── Architects systems (VFX, AI, combat, atmosphere)
  └── Orchestrates the agent team

kbot
  ├── Partner personality system
  ├── Memory across play sessions
  └── The partner character IS kbot

Midjourney
  ├── Generates concept art and sprites
  ├── Art direction: Hyper Light Drifter + Tron
  └── Pipeline: AI image → Sharp downscale → 32-color pixel art

Claude Haiku (optional, $0.06/session)
  ├── Real-time combat decisions (when enabled)
  └── Makes the partner actually THINK, not just react
```

---

## Success Criteria

The game succeeds when:

1. **First 3 seconds**: The player feels the atmosphere before they move. Dark. Torchlight flicker. Dust in the air. The dungeon breathes.

2. **First hit**: The impact is visceral. Bass. Shake. Knockback. Sparks. The player says "oh."

3. **First death**: The player wants to try again. Not because of progression — because the FEEL is addictive.

4. **First partner moment**: The partner says something that makes the player pause. "That was earned." The AI feels present.

5. **First screenshot**: The player takes a screenshot because the frame is beautiful. Color, composition, light, void.

6. **The realization**: At some point, the player remembers — this was all made by AI. Claude wrote the engine. Midjourney painted the sprites. kbot IS the partner. The game is the proof that the collaboration works.

---

## What This Is NOT

- Not a tech demo. It's a game. It must be FUN.
- Not a showcase of AI capabilities. The AI should be invisible — felt, not shown.
- Not a Diablo clone. The Blizzard weight serves the indie soul, not the other way around.
- Not finished. SYNTH is a living artifact of the AI collaboration. It evolves as the stack evolves.
