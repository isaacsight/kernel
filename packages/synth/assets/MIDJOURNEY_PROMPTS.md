# SYNTH — Midjourney Prompts

Paste these into Midjourney. Save the results into `assets/raw/`.
Then run `npx tsx tools/sprite-pipeline.ts` to process them.

## Art Direction

**Style**: Top-down view, dark sci-fi dungeon, neon-lit geometric aesthetic.
Think Hyper Light Drifter meets Tron. Limited palette: deep navy/charcoal backgrounds,
cyan/blue for player, green for ally, red/orange for enemies, gold for pickups.

**Important**: Every prompt uses `--style raw` for consistency and `--ar 1:1` for square output.

---

## PLAYER CHARACTER (Diamond/Crystal Guardian)

### Standing pose (front-facing, top-down)
```
top-down game sprite, crystal guardian character, diamond-shaped armored figure, glowing cyan blue energy core, dark navy background, sci-fi dungeon crawler aesthetic, clean silhouette, neon rim lighting, 32-bit pixel art style, no shadow, centered, single character --style raw --ar 1:1 --v 6.1
```

### Attack animation (4 poses in grid)
```
sprite sheet, 2x2 grid, top-down crystal guardian character attacking, cyan energy slash, diamond-shaped figure, each frame showing different attack phase, dark background, sci-fi neon aesthetic, consistent character design across all frames, pixel art style --style raw --ar 1:1 --v 6.1
```

### Dash/dodge (motion blur)
```
top-down game sprite, crystal guardian dashing, motion trail effect, cyan energy streak, diamond figure stretched horizontally, dark background, speed lines, neon glow, pixel art style --style raw --ar 1:1 --v 6.1
```

---

## PARTNER (Hexagonal Synth Companion)

### Standing pose
```
top-down game sprite, hexagonal robotic companion, glowing green energy core, floating geometric AI entity, emerald neon lights, dark navy background, sci-fi dungeon aesthetic, clean silhouette, 32-bit pixel art style, no shadow, centered --style raw --ar 1:1 --v 6.1
```

### Attack pose
```
top-down game sprite, hexagonal companion firing green energy beam, geometric robot, emerald pulse weapon, dark background, sci-fi neon aesthetic, pixel art style --style raw --ar 1:1 --v 6.1
```

---

## ENEMIES

### Melee enemy (Spiked Drone)
```
top-down game sprite, spiked red drone enemy, organic-mechanical hybrid, glowing red core, sharp angular spikes, menacing silhouette, dark background, sci-fi dungeon crawler, pixel art style --style raw --ar 1:1 --v 6.1
```

### Ranged enemy (Turret Eye)
```
top-down game sprite, floating eye turret enemy, single glowing orange eye, metallic ring body, energy weapon charging, dark background, sci-fi horror aesthetic, pixel art style --style raw --ar 1:1 --v 6.1
```

### Fast enemy (Swarm Fragment)
```
top-down game sprite, small fast triangular enemy, sharp minimal design, bright red glow, swarm creature, dark background, geometric sci-fi aesthetic, pixel art style --style raw --ar 1:1 --v 6.1
```

### Tank enemy (Heavy Cube)
```
top-down game sprite, large armored cube enemy, heavy plating, dim red energy veins, imposing geometric figure, dark background, industrial sci-fi aesthetic, pixel art style --style raw --ar 1:1 --v 6.1
```

### Boss (The Core)
```
top-down game sprite, large boss entity, central glowing eye surrounded by orbiting geometric shields, crimson and black color scheme, intricate mechanical detail, menacing presence, dark void background, sci-fi dungeon boss, pixel art style --style raw --ar 1:1 --v 6.1
```

---

## ENVIRONMENT

### Dungeon floor tileset
```
seamless tileable texture, dark sci-fi dungeon floor, subtle grid pattern, worn metal panels, faint cyan circuit lines, top-down view, dark navy and charcoal colors, game tileset, pixel art style --style raw --ar 1:1 --v 6.1
```

### Wall tileset
```
seamless tileable texture, sci-fi dungeon wall, heavy stone and metal hybrid, glowing runes, top-down perspective showing wall top surface, dark grey with subtle blue highlights, game tileset, pixel art style --style raw --ar 1:1 --v 6.1
```

### Pillar/obstacle
```
top-down game sprite, sci-fi crystal pillar obstacle, glowing teal energy, dark metallic base, dungeon environment prop, dark background, pixel art style --style raw --ar 1:1 --v 6.1
```

---

## EFFECTS & PICKUPS

### Health pickup
```
top-down game sprite, glowing green health crystal, small diamond shape, healing energy aura, dark background, sci-fi aesthetic, pixel art style, simple clean design --style raw --ar 1:1 --v 6.1
```

### Damage powerup
```
top-down game sprite, glowing red-orange attack crystal, sharp angular design, power energy aura, dark background, sci-fi aesthetic, pixel art style --style raw --ar 1:1 --v 6.1
```

### Projectile (player)
```
top-down game sprite, small cyan energy bolt, elongated teardrop shape, bright glowing core, dark background, minimal sci-fi design, pixel art style --style raw --ar 1:1 --v 6.1
```

---

## NAMING CONVENTION

Save files as:
- `player-stand.png`
- `player-attack.png`
- `player-dash.png`
- `partner-stand.png`
- `partner-attack.png`
- `enemy-melee.png`
- `enemy-ranged.png`
- `enemy-fast.png`
- `enemy-tank.png`
- `enemy-boss.png`
- `tile-floor.png`
- `tile-wall.png`
- `tile-pillar.png`
- `pickup-health.png`
- `pickup-damage.png`
- `projectile-player.png`
