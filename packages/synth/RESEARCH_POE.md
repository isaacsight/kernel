# Path of Exile — Engine & Design Research for SYNTH

## What Makes PoE the Greatest ARPG

### The Gem Socket System (PoE's Crown Jewel)
- Active gems = abilities. Support gems = modifiers. Linked sockets = composition.
- 200 active gems x 150 support gems x 6-link = infinite builds.
- Players feel like **inventors**, not consumers. They discover combinations.
- PoE2 separated gems from gear entirely — dedicated skill interface.
- **SYNTH adaptation**: Weapon Mod Sockets. Each weapon gets 2-3 slots. Mods drop as loot and transform behavior: "Pulse + Split + Pierce + Ignite" = triple-piercing-fire-pulse.

### Itemization (The Addiction Engine)
- Weighted random affix pools with tiers (T1-T10).
- Item level gates higher tiers — deeper floors = better rolls.
- Near-miss psychology: 3 perfect affixes + 1 garbage = "one more run."
- Mod groups prevent duplicate families, forcing diverse stats.
- **SYNTH adaptation**: Replace fixed upgrades with affix-rolled gear drops. 20-30 possible affixes, weighted pools, floor-gated tiers.

### Combat Feel
- Enemy density: 20-50+ per screen in endgame. Walking natural disaster fantasy.
- AoE scaling: skills grow from marble to basketball as you gear up.
- Visual power progression: attacks LOOK bigger/stronger at every stage.
- Sound design: distinct impact sounds per damage type (shatter, explosion, crackle).
- **SYNTH adaptation**: Scale enemy count with floor depth. Floor 1: 5 enemies. Floor 10: 25+. Make AoE upgrades feel necessary.

### Flask System (Kill to Heal)
- Flasks recharge by killing, not at rest.
- Forces aggressive play — stopping means dying.
- 5 flask slots: mix life/mana with utility buffs.
- **SYNTH adaptation**: Kill streak healing. Kill 5 quickly = guaranteed heal drop. Same aggressive-play incentive.

### Endgame Loop
- Atlas of Worlds: 100+ unique map tilesets.
- Map modifiers: +50% enemy HP, +100% loot rarity (risk/reward stacking).
- Leagues: seasonal resets with new mechanics folded into core.
- Chris Wilson's philosophy: "multiple overlapping axes of randomness."
- **SYNTH adaptation**: Endless descent with floor modifiers. Players stack risk for reward.

### Meta Progression
- 1,325 passive tree nodes. Classes share tree but start at different positions.
- Keystones change rules: "1 max life, immune to chaos damage."
- Atlas passive tree: customize your endgame experience.
- **SYNTH adaptation**: 30-50 node persistent tree between runs. Synthesis points per run. Keystones that change game rules.

### Performance (Hundreds of Entities)
- Dynamic particle culling: auto-cull low-priority particles when budget exceeded.
- Dynamic resolution: lower render quality to maintain framerate.
- Object pooling: reuse entities, never create/destroy.
- Fixed camera = rendering shortcut (no close-up geometry needed).
- **SYNTH adaptation**: Hard particle budget (200). Spatial hashing for collisions. Tiered AI updates (nearby = every frame, distant = every 3rd).

### Engine Facts
- Custom C++ engine, Lua scripting.
- 4-person engine team supporting all platforms.
- Vulkan renderer eliminated shader stutter.
- Server-authoritative (client is presentation only).
- PoE2: same engine + PBR + physics + improved animation.

## Deep Design Insights (from GDC talk + system analysis)

### The Gem System Math
- Support gems provide "More" multipliers (multiplicative, not additive)
- 5 support gems: `Base x 1.4 x 1.3 x 1.5 x 1.2 x 1.25 = Base x 4.095`
- This is why build diversity exists — exponential scaling rewards optimization
- **SYNTH adaptation**: Common mods = "Increased" (additive). Rare/Epic = "More" (multiplicative). Rewards informed players.

### Trigger Mechanics (The Real Innovation)
- Same skill can be: self-cast, auto-proc on crit, deployed as trap, fired by totem, triggered when hit
- This is what creates 1000s of builds — not just stat stacking but behavior modification
- **SYNTH adaptation**: "Trigger Circuits" — mods that change WHEN your weapon fires: on dash, on kill, on taking damage, when partner attacks

### Floor Modifier System (Highest Impact Feature)
- PoE maps are items with random affixes: "+40% enemy damage" but "+30% loot quality"
- Players CHOOSE which modifiers to accept — risk/reward self-selection
- This is the #1 feature to add. Before each floor, offer 3-5 optional modifiers.

### Defense Layers (Not Just HP)
- PoE: Evasion → Block → Armor → Resistances → Guard Skills → Leech → Regen
- Each layer handles different damage patterns. No single layer is sufficient.
- **SYNTH adaptation**: Shield Energy (regens after 3s) → Armor (flat reduction) → HP → Dash i-frames

### Chris Wilson's 7 Rules
1. Multiple overlapping axes of randomness (floor + enemies + mods + loot all random independently)
2. Predictable content cadence
3. Deep systems > broad content (one deep system beats ten shallow ones)
4. Currency should be functional (not just "gold")
5. Power should feel earned (massive gap between start and endgame)
6. Reset is content (death = fresh start with meta-progression)
7. The economy of information (when players make snap loot decisions, the game generates choices/second)

## Priority Actions for SYNTH

### Now
1. **Weapon Mod Sockets** — 2-3 slots per weapon, mods as loot drops
2. **Enemy density scaling** — more enemies per floor
3. **Kill streak healing** — aggressive play rewarded
4. **Visual power scaling** — attacks grow with upgrades

### Next
5. **Affix-based gear** — weighted random stats on drops
6. **Floor modifiers** — risk/reward stacking on deeper floors
7. **Meta-progression tree** — persistent unlocks between runs

### Vision
8. **Crafting via Synthesis** — combine items for merged affixes
9. **Endgame boss progression** — pinnacle bosses every 5 floors
10. **Loot filter** — auto-pickup commons, highlight rares
