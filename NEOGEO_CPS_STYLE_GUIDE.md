# NEO GEO & CPS PIXEL ART STYLE GUIDE
### The Golden Age of 2D Arcade Rendering (1990-2000)

---

```
╔══════════════════════════════════════════════════════════════════════════╗
║  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ║
║  ░░███╗░░░███╗███████╗░█████╗░░░░░░██████╗░███████╗░█████╗░░░░░░░░░░░░░░  ║
║  ░░████╗░████║██╔════╝██╔══██╗░░░░██╔════╝░██╔════╝██╔══██╗░░░░░░░░░░░░░  ║
║  ░░██╔████╔██║█████╗░░██║░░██║░░░░██║░░██╗░█████╗░░██║░░██║░░░░░░░░░░░░░  ║
║  ░░██║╚██╔╝██║██╔══╝░░██║░░██║░░░░██║░░╚██╗██╔══╝░░██║░░██║░░░░░░░░░░░░░  ║
║  ░░██║░╚═╝░██║███████╗╚█████╔╝░░░░╚██████╔╝███████╗╚█████╔╝░░░░░░░░░░░░░  ║
║  ░░╚═╝░░░░░╚═╝╚══════╝░╚════╝░░░░░░╚═════╝░╚══════╝░╚════╝░░░░░░░░░░░░░░  ║
║  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ║
║                    THE ARCADE PIXEL RENAISSANCE                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## I. THE TWO TITANS

### SNK Neo Geo (MVS/AES) — 1990

**Philosophy**: Sheer artistic effort over raw power. Limited hardware pushed to extremes through meticulous hand-crafted sprites.

**Landmark Titles**:
- Metal Slug series (1996-2000) — Peak background art
- Garou: Mark of the Wolves (1999) — Peak animation fluidity
- The Last Blade 2 (1998) — Peak character design
- Art of Fighting 3 (1996) — Peak facial expressions
- King of Fighters series (1994-2003) — Iconic roster

---

### Capcom CPS-1/CPS-2 — 1988/1993

**Philosophy**: Elegant tile systems with clever memory optimization. Hand-drawn keyframes translated to pixel-perfect sprites.

**Landmark Titles**:
- Street Fighter II (1991) — Defined the genre
- Darkstalkers/Vampire series (1994-1997) — Peak expressiveness
- Street Fighter III (1997-1999) — Peak rotoscoped animation
- Marvel vs. Capcom series (1998-2000) — Peak spectacle
- JoJo's Bizarre Adventure (1998) — Peak stylization

---

## II. TECHNICAL SPECIFICATIONS

### Hardware Comparison

| Specification | Neo Geo MVS | Capcom CPS-2 |
|---------------|-------------|--------------|
| **Resolution** | 320×224 | 384×224 |
| **Color Depth** | 12-bit (4,096 colors) | 12-bit (4,096 colors) |
| **Colors On-Screen** | 4,096 (256 typical) | 4,096 |
| **Sprite Tiles** | 380 sprites, 96/scanline | ~256 tiles/frame |
| **Tile Size** | 16×16 pixels | 16×16 pixels |
| **Colors Per Tile** | 15 + transparency | 16 indexed |
| **Palettes** | 256 simultaneous | Variable |
| **ROM Capacity** | Up to 716 MB (cart) | 32 MB max |
| **Sprite Scaling** | Shrink only | None |
| **CPU** | Motorola 68000 | Motorola 68000 |

### The 15-Color Rule

Both systems enforced strict color limits per sprite:

```
┌─────────────────────────────────────────────────────────────┐
│  TYPICAL CHARACTER PALETTE (15 colors + transparency)       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SKIN TONES (4-5 colors)                                    │
│  ████ ████ ████ ████ ████                                   │
│  #FFD5B8  #E8B89D  #C99A7B  #A67B5B  #7D5A3C               │
│                                                             │
│  PRIMARY CLOTHING (4-5 colors)                              │
│  ████ ████ ████ ████ ████                                   │
│  #4A90D9  #2E6AB8  #1E4A8A  #0F2D5C  #061838               │
│                                                             │
│  SECONDARY/ACCENT (3-4 colors)                              │
│  ████ ████ ████ ████                                        │
│  #FFD700  #D4A500  #AA8400  #806300                         │
│                                                             │
│  OUTLINE/SHADOW (1-2 colors)                                │
│  ████ ████                                                  │
│  #1A1A1A  #000000                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## III. THE THREE PILLARS OF SPRITE ART

### 1. SHAPING (Silhouette & Form)

**The Readability Doctrine**:
Every character must be instantly recognizable from silhouette alone.

```
Good Silhouette:          Bad Silhouette:

    ▄▄████▄▄                  ████████
   ████████████              ██████████
  ██▀▀████▀▀██              ██████████
     ██████                  ██████████
    ████████                ████████████
   ██████████               ████████████
  ██▀▀▀██▀▀▀██             ████████████
 ██    ██    ██            ██████████████

 (Distinct features)      (Generic blob)
```

**Key Principles**:
- Exaggerated proportions for clarity (larger heads, hands, feet)
- Strong action lines even in idle poses
- Asymmetry adds interest and directionality
- Negative space defines form as much as positive

---

### 2. COLORING (Palette & Harmony)

**Color Group Organization**:

Metal Slug / SNK style organizes colors into **functional groups**:

```css
/* METAL SLUG REBEL SOLDIER PALETTE */
:root {
  /* Group 1: Military Uniform (5 shades) */
  --uniform-1: #5B7744;  /* Highlight */
  --uniform-2: #4A6038;  /* Light */
  --uniform-3: #3A4A2C;  /* Mid */
  --uniform-4: #2A3620;  /* Shadow */
  --uniform-5: #1A2214;  /* Deep shadow */

  /* Group 2: Skin Tones (4 shades) */
  --skin-1: #F0C8A0;     /* Highlight */
  --skin-2: #D4A878;     /* Light */
  --skin-3: #B08850;     /* Mid */
  --skin-4: #8C6830;     /* Shadow */

  /* Group 3: Equipment (3 shades) */
  --metal-1: #A0A0A0;    /* Steel highlight */
  --metal-2: #707070;    /* Steel mid */
  --metal-3: #404040;    /* Steel shadow */

  /* Group 4: Accent/Details (2-3 colors) */
  --accent-1: #E8D038;   /* Gold/brass */
  --accent-2: #B8A028;   /* Gold shadow */
  --outline: #181818;    /* Near-black outline */
}
```

**Capcom Street Fighter Palette Philosophy**:

```css
/* STREET FIGHTER CHARACTER PALETTE */
:root {
  /* 5 skin colors typical */
  --sf-skin-highlight: #FFF0D8;
  --sf-skin-light: #F0D0A8;
  --sf-skin-mid: #D8B088;
  --sf-skin-shadow: #B08860;
  --sf-skin-deep: #886040;

  /* 1 main color + shadows for smoothing lines */
  --sf-gi-light: #F8F8F8;
  --sf-gi-mid: #D0D0D0;
  --sf-gi-shadow: #989898;
  --sf-gi-deep: #606060;

  /* Colored outlines - darker versions of adjacent color */
  --sf-outline-skin: #704830;
  --sf-outline-cloth: #404040;
}
```

---

### 3. SHADING & DETAILS

**Single Light Source Rule**:

Always shade from ONE consistent direction. This creates:
- Clear form definition
- Predictable shadow placement
- Professional, unified look

```
Light from top-left (most common):

         ☀️
          ╲
           ╲
    ┌───────────┐
    │░░▓▓▓▓████│
    │░░▓▓▓█████│
    │░▓▓▓██████│
    │▓▓▓███████│
    │▓▓████████│
    └───────────┘

Legend:
░ = Highlight (lightest)
▓ = Midtone
█ = Shadow (darkest)
```

**Shading Techniques for Curves**:

| Technique | Use Case | Example |
|-----------|----------|---------|
| **Stroking** | Smooth curved surfaces | Skin, cloth folds |
| **Dithering** | Seamless color transitions | Gradients, metals |
| **Mixed** | Gritty mechanical surfaces | Tanks, machinery |

```
STROKING (clean bands):     DITHERING (checkered):

████████████████            ██░░██░░██░░██░░
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓            ░░██░░██░░██░░██
░░░░░░░░░░░░░░░░            ██░░██░░██░░██░░
                            ░░██░░██░░██░░██
```

---

## IV. OUTLINE TECHNIQUES

### Black Outline (Classic Arcade)

The default approach — strong, readable, iconic:

```
████████████████████
██░░░░░░░░░░░░░░░░██
██░░████████████░░██
██░░██        ██░░██
██░░██  SPRITE██░░██
██░░██        ██░░██
██░░████████████░░██
██░░░░░░░░░░░░░░░░██
████████████████████

Benefits:
✓ Maximum readability
✓ Works on any background
✓ Easier to animate
✓ Iconic "video game" look
```

### Selective Outlining (Sel-out)

Replace black with colors for naturalism:

```
Before (black outline):     After (selective outline):

████████████████████        ▓▓▓▓▓▓▓▓████████
██░░░░░░░░░░░░░░░░██        ▓░░░░░░░░░░░░░░▓▓
██░░░░░░░░░░░░░░░░██        ░░░░░░░░░░░░░░░░▓
██░░░░░░░░░░░░░░░░██        ░░░░░░░░░░░░░░░░█
██░░░░░░░░░░░░░░░░██        ░░░░░░░░░░░░░░░░█
████████████████████        ████████████████

- Light source side: lighter outline (▓)
- Shadow side: darker outline (█)
- Adds dimensionality
```

### The 0.5 Pixel Rule (Metal Slug)

Use 2-3 outline colors to add/remove visual density:

```
Standard outline:           0.5 Pixel technique:

██████████                  ██▓▓▓▓▓▓██
██      ██                  ▓░      ░▓
██      ██                  ▓░      ░▓
██      ██                  ▓░      ░▓
██████████                  ██▓▓▓▓▓▓██

Use sparingly — best for:
- Static/portrait sprites
- High-detail close-ups
- Highlighting specific features
```

---

## V. ANTI-ALIASING (AA)

### Internal AA

Smooth jagged edges INSIDE the sprite:

```
WITHOUT AA:                 WITH AA:

██████                      ░▓████
    ██████                  ░░▓▓████
        ██████              ░░░░▓▓████
            ██████          ░░░░░░▓▓████

The stair-step effect      Intermediate colors
(aliasing)                  soften the edge
```

### AA Rules

1. **Never AA outer edges** — causes halo artifacts on backgrounds
2. **Avoid banding** — parallel lines of equal length
3. **Use sparingly** — over-AA looks blurry
4. **Match pixel density** — AA pixels should feel intentional

```
BANDING (bad):              PROPER AA (good):

████████                    ░░██████
  ██████████                ░░░░████████
    ████████████            ░░░░░░██████████
      ██████████████        ░░░░░░░░████████████

(Reinforces the grid)       (Breaks up the grid)
```

---

## VI. ANIMATION PRINCIPLES

### The Capcom Method (Hand-Drawn to Pixel)

```
1. KEYFRAME DRAWING          2. SCAN/DIGITIZE
   ┌──────────────┐            ┌──────────────┐
   │   ╱    ╲     │            │  [SCANNED]   │
   │  ╱ ◉  ◉ ╲    │    ───►    │   ROUGH      │
   │ ╱   ▽    ╲   │            │   OUTLINE    │
   │╱  ╲____╱  ╲  │            │              │
   └──────────────┘            └──────────────┘

3. PIXEL TRACE               4. DETAIL PASS
   ┌──────────────┐            ┌──────────────┐
   │ ████████████ │            │ ░░████████░░ │
   │██░░░░░░░░░░██│    ───►    │██▓▓░░░░▓▓░░██│
   │██░░██░░██░░██│            │██▓▓██░░██▓▓██│
   │██░░░░▼▼░░░░██│            │██░░░░▼▼░░░░██│
   └──────────────┘            └──────────────┘

5. CLEANUP (pixel-perfect lines, AA, polish)
```

### The SNK Method (Pixel-Native)

```
1. CREATE BASE SPRITE        2. DUPLICATE & MODIFY
   ┌──────────────┐            ┌─────┐ ┌─────┐ ┌─────┐
   │    ████      │            │Frame│ │Frame│ │Frame│
   │   ██░░██     │    ───►    │  1  │ │  2  │ │  3  │
   │  ██░░░░██    │            │(base)│(edit)│(edit)│
   │   ██████     │            └─────┘ └─────┘ └─────┘
   └──────────────┘

Key: Edit existing pixels to create new frames
     rather than drawing each from scratch
```

### Split Animation System (Metal Slug)

Character divided into independent parts:

```
┌─────────────────────────────────────┐
│           TOP HALF                  │
│    (aiming, shooting, reloading)    │
│         ┌───────────┐               │
│         │   ◉   ◉   │               │
│         │     ▽     │               │
│         │ ═══════►  │  ← Gun arm    │
├─────────┴───────────┴───────────────┤
│          BOTTOM HALF                │
│    (running, jumping, crouching)    │
│         │  ╲   ╱  │                 │
│         │   ╲ ╱   │                 │
│         │   ╱ ╲   │                 │
└─────────────────────────────────────┘

Benefits:
- Halves animation workload
- Top can shoot while bottom runs
- More responsive gameplay feel
```

### Idle Animation Philosophy

```
WRONG: Large, distracting movements

Frame 1    Frame 2    Frame 3
████████   ████████   ████████
██    ██   ██    ██   ██    ██
██ ◉◉ ██   ██ ◉◉ ██   ██ ◉◉ ██
██    ██   ██    ██   ██    ██
████████     ████████       ████████
              ↑               ↑
        (bouncing all over the place)

RIGHT: Subtle internal movement

Frame 1    Frame 2    Frame 3
████████   ████████   ████████
██    ██   ██    ██   ██    ██
██ ◉◉ ██   ██ ◉◉ ██   ██ ◉◉ ██
██ ▽  ██   ██  ▽ ██   ██ ▽  ██
████████   ████████   ████████
     ↑          ↑          ↑
   (breathing motion - subtle pixel shifts)
```

---

## VII. BACKGROUND ART

### Metal Slug Background Philosophy

```
LAYER COMPOSITION:

┌────────────────────────────────────────────────┐
│ SKY LAYER (simple gradient, minimal detail)    │
├────────────────────────────────────────────────┤
│ FAR BACKGROUND (mountains, buildings - hazy)   │
├────────────────────────────────────────────────┤
│ MID BACKGROUND (trees, structures - detailed)  │
├────────────────────────────────────────────────┤
│ NEAR BACKGROUND (almost painting quality)      │
├────────────────────────────────────────────────┤
│ GAMEPLAY LAYER (sprites interact here)         │
├────────────────────────────────────────────────┤
│ FOREGROUND (overlays, creates depth)           │
└────────────────────────────────────────────────┘
```

**The "Almost Painting" Quality**:

Neo Geo backgrounds achieved near-painterly quality through:
- Rich color gradients via dithering
- Hand-placed detail pixels
- Environmental storytelling
- Atmospheric perspective (hazier = farther)

---

## VIII. MECHA & VEHICLE DESIGN

### The Metal Slug Mecha Aesthetic

```
DESIGN PRINCIPLES:

1. CURVED SILHOUETTES
   ╭──────────╮
   │  TURRET  │    ← Oval/circular shapes
   ╰────┬─────╯
   ╭────┴─────╮
   │ CHASSIS  │    ← Rounded rectangles
   ╰──────────╯
   ◯◯◯◯◯◯◯◯◯◯      ← Circular treads

2. CHUNKY PROPORTIONS
   - Oversized turrets
   - Stubby legs/treads
   - Exaggerated weapons

3. FUNCTIONAL DETAILS
   - Rivets and panels
   - Exhaust vents
   - Wear marks and dents
   - Antenna and sensors
```

### Shading Mechanical Surfaces

```
CURVED METAL (tank hull):

████████████████████████
▓▓▓▓████████████████▓▓▓▓
░░▓▓▓▓████████████▓▓▓▓░░
░░░░▓▓▓▓████████▓▓▓▓░░░░
░░░░░░▓▓▓▓████▓▓▓▓░░░░░░

- Strong highlight on light-facing curve
- Gradual falloff to shadow
- Reflected light on shadow edge (optional)

FLAT METAL (panel):

████████████████████████
████████████████████████
████████████████████████
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
░░░░░░░░░░░░░░░░░░░░░░░░

- Minimal gradation
- Sharp edge between lit/shadow
- Panel lines create visual interest
```

---

## IX. SNK VS CAPCOM STYLE COMPARISON

| Aspect | SNK (Neo Geo) | Capcom (CPS) |
|--------|---------------|--------------|
| **Proportions** | More realistic, dramatic | Exaggerated, cartoony |
| **Animation** | Fluid, many frames | Snappy, impactful keyframes |
| **Outlines** | Often colored/selective | Strong black outlines |
| **Color Use** | Rich gradients, dithering | Bold, flat color areas |
| **Detail Level** | Maximum pixel density | Clarity over detail |
| **Backgrounds** | Painterly, atmospheric | Clean, readable |
| **Character Feel** | Martial arts drama | Anime action |
| **Shading** | Smooth, realistic | Stylized, cel-shaded feel |

### Visual DNA

```
SNK CHARACTER:                 CAPCOM CHARACTER:

   Realistic proportions          Exaggerated features
   Dramatic lighting              Bold color blocking
   Subtle expressions             Extreme expressions
   Flowing animation              Punchy keyframes

       ╭────╮                        ╭──────╮
       │◉  ◉│                        │ ◉  ◉ │
       │  ▽ │                        │  ▽▽  │
       │╲__╱│                        │╲____╱│
       ╰────╯                        ╰──────╯
         │                              │
        ╱│╲                           ╱ │ ╲
       ╱ │ ╲                         ╱  │  ╲
      ╱  │  ╲                       ╱   │   ╲
     ▕   │   ▏                     ▕    │    ▏
```

---

## X. COLOR PALETTES BY GAME

### Metal Slug Palette

```css
:root {
  /* Player Character (Marco) */
  --ms-skin-1: #F8D8B0;
  --ms-skin-2: #E0B888;
  --ms-skin-3: #C09060;
  --ms-skin-4: #906838;

  --ms-uniform-1: #587048;
  --ms-uniform-2: #405830;
  --ms-uniform-3: #304020;
  --ms-uniform-4: #182810;

  --ms-headband: #C83020;
  --ms-metal: #B0B0B0;
  --ms-metal-shadow: #707070;

  /* Rebel Soldier */
  --ms-rebel-1: #789058;
  --ms-rebel-2: #607840;
  --ms-rebel-3: #486028;
  --ms-rebel-4: #304818;

  /* Explosion */
  --ms-fire-1: #F8F8F8;
  --ms-fire-2: #F8E850;
  --ms-fire-3: #F8A030;
  --ms-fire-4: #D05020;
  --ms-fire-5: #801810;

  /* Environment */
  --ms-sky: #88C0E8;
  --ms-sand: #E8D8A0;
  --ms-jungle: #305828;
}
```

### Street Fighter II Palette

```css
:root {
  /* Ryu */
  --sf-ryu-gi-1: #F8F8F8;
  --sf-ryu-gi-2: #D0D0D0;
  --sf-ryu-gi-3: #A0A0A0;
  --sf-ryu-gi-4: #707070;
  --sf-ryu-belt: #A02020;
  --sf-ryu-hair: #382818;

  /* Ken (same base, palette swap) */
  --sf-ken-gi-1: #F83030;
  --sf-ken-gi-2: #C82020;
  --sf-ken-gi-3: #981818;
  --sf-ken-gi-4: #681010;
  --sf-ken-hair: #F8D038;

  /* Chun-Li */
  --sf-chun-dress-1: #5080F8;
  --sf-chun-dress-2: #3860C8;
  --sf-chun-dress-3: #2848A0;
  --sf-chun-gold: #F8D038;
  --sf-chun-buns: #382010;

  /* Guile */
  --sf-guile-pants-1: #48A048;
  --sf-guile-pants-2: #308030;
  --sf-guile-pants-3: #206020;
  --sf-guile-hair: #F8E880;

  /* Universal */
  --sf-skin-highlight: #F8E0C8;
  --sf-skin-light: #E8C8A0;
  --sf-skin-mid: #D0A878;
  --sf-skin-shadow: #A88050;
  --sf-skin-deep: #806030;
}
```

### King of Fighters Palette

```css
:root {
  /* Kyo Kusanagi */
  --kof-kyo-jacket: #F8F8F8;
  --kof-kyo-shirt: #181818;
  --kof-kyo-flame-1: #F8F8D0;
  --kof-kyo-flame-2: #F8C830;
  --kof-kyo-flame-3: #E87820;
  --kof-kyo-flame-4: #C03010;

  /* Iori Yagami */
  --kof-iori-coat: #580818;
  --kof-iori-pants: #181018;
  --kof-iori-flame-1: #D080F8;
  --kof-iori-flame-2: #9040C8;
  --kof-iori-flame-3: #602090;

  /* Terry Bogard */
  --kof-terry-jacket: #C82020;
  --kof-terry-jeans: #3050A8;
  --kof-terry-cap: #C82020;
  --kof-terry-star: #F8F8F8;
}
```

### Garou: Mark of the Wolves Palette

```css
:root {
  /* More muted, realistic than KOF */
  --garou-bg-evening: #D89860;
  --garou-bg-night: #283048;

  /* Rock Howard */
  --garou-rock-jacket-1: #484040;
  --garou-rock-jacket-2: #302828;
  --garou-rock-jacket-3: #201818;
  --garou-rock-shirt: #C8B8A8;
  --garou-rock-energy: #80F8F8;

  /* Hotaru */
  --garou-hotaru-dress-1: #F8F0E8;
  --garou-hotaru-dress-2: #E0D0C0;
  --garou-hotaru-hair: #4080C8;
  --garou-hotaru-ribbon: #F84040;
}
```

---

## XI. APPLYING TO SOVEREIGN LABORATORY

### Faction Style Mapping

| SL-OS Element | Neo Geo/CPS Inspiration | Application |
|---------------|-------------------------|-------------|
| **Claude Agents** | Street Fighter (Capcom) | Bold outlines, punchy animation |
| **Gemini Agents** | Garou/Last Blade (SNK) | Fluid, dramatic, realistic |
| **UI Chrome** | Metal Slug HUD | Military-tech aesthetic |
| **Backgrounds** | Metal Slug environments | Painterly, detailed |
| **Icons** | CPS-2 character select | 64×64 portraits with rim |

### Recommended Implementation

```css
/* NEO GEO / CPS INSPIRED DESIGN TOKENS */
:root {
  /* Arcade CRT glow effect */
  --crt-glow: 0 0 10px rgba(255, 255, 255, 0.3);
  --crt-scanline: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.15),
    rgba(0, 0, 0, 0.15) 1px,
    transparent 1px,
    transparent 2px
  );

  /* Pixel-perfect borders */
  --pixel-border: 2px solid #000;
  --pixel-border-highlight: 2px solid #fff;

  /* Neo Geo purple (Undead/Gemini faction) */
  --neogeo-purple-1: #9060C8;
  --neogeo-purple-2: #6840A0;
  --neogeo-purple-3: #482878;

  /* CPS blue (Human/Claude faction) */
  --cps-blue-1: #5080F8;
  --cps-blue-2: #3060D0;
  --cps-blue-3: #2040A8;

  /* Metal Slug military green */
  --ms-green-1: #789858;
  --ms-green-2: #587040;
  --ms-green-3: #384828;

  /* Explosion/energy palette */
  --energy-white: #F8F8F8;
  --energy-yellow: #F8E850;
  --energy-orange: #F8A030;
  --energy-red: #D05020;
}

/* Pixel art scaling (no blur) */
.pixel-art {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

/* CRT monitor effect */
.crt-screen {
  background: #000;
  box-shadow: var(--crt-glow);
  position: relative;
}

.crt-screen::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--crt-scanline);
  pointer-events: none;
}
```

---

## XII. REFERENCE RESOURCES

### Sprite Databases
- [The Spriters Resource - Neo Geo](https://www.spriters-resource.com/neo_geo_ngcd/)
- [Sprite Database - Neo Geo](https://spritedatabase.net/system/neogeo)
- [CPSS: Capcom Sheets Explorer](https://fabiensanglard.net/cpss/)

### Tutorials & Analysis
- [Metal Slug Spriting Tutorial](https://6th-divisions-den.com/ms_tutorial.html)
- [Street Fighter II Paper Trails](https://fabiensanglard.net/sf2_sheets/)
- [Derek Yu's Pixel Art Tutorial](https://www.derekyu.com/makegames/pixelart.html)
- [2D Will Never Die - Tutorials](https://2dwillneverdie.com/tutorial/)

### Books
- [NEOGEO: A Visual History (Bitmap Books)](https://www.bitmapbooks.com/products/neogeo-a-visual-history)

### Community
- [HIVE Workshop - Neo Geo Modding](https://www.hiveworkshop.com/)
- [NeoGAF Pixel Art Threads](https://www.neogaf.com/)

---

```
╔════════════════════════════════════════════════════════════════════════╗
║                                                                        ║
║  "These classic SNK/Capcom games were being developed by a team        ║
║   of artists who had honed their pixel-art craft over years of         ║
║   working on increasingly powerful arcade hardware as their            ║
║   full-time jobs."                                                     ║
║                                                                        ║
║   The raw talent of each artist is on full display.                    ║
║                                                                        ║
║                                            — NeoGAF Community          ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
```

---

*Style Guide v1.0 | Sovereign Laboratory OS*
*Inspired by the Golden Age of 2D Arcade Art (1990-2000)*

**Sources:**
- [Neo Geo Wikipedia](https://en.wikipedia.org/wiki/Neo_Geo)
- [Street Fighter II Paper Trails](https://fabiensanglard.net/sf2_sheets/)
- [Metal Slug Sprite Tutorial](https://6th-divisions-den.com/ms_tutorial.html)
- [Samwise Didier Interview](https://www.shacknews.com/article/111727/samwise-didier-discusses-the-history-of-warcrafts-art)
- [GamesRadar - Garou Review](https://www.gamesradar.com/gorgeous-sprites-perfect-fights-you-should-be-playing-garou-mark-of-the-wolves/)
- [HIVE Workshop](https://www.hiveworkshop.com/)
