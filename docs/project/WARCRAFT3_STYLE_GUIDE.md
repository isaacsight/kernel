# WARCRAFT 3 VISUAL STYLE GUIDE
### Design Reference for Sovereign Laboratory RTS Aesthetic

---

## I. THE SAMWISE DOCTRINE

The visual identity of Warcraft 3 was shaped by **Samwise Didier**, Blizzard's legendary art director (1991-2023). His philosophy:

> "Always draw big shoulder pads."

### Core Principles

1. **Exaggerated Heroic Proportions**
   - Big heads, hands, and feet
   - Massive shoulder pads and pauldrons
   - Wide, heroic stances
   - Everything feels "huge and mighty"

2. **Readability Over Realism**
   - Units must be recognizable from a top-down RTS camera
   - Silhouettes are instantly identifiable
   - Team colors prominently visible on every unit

3. **Simplified, Flat Shading**
   - Matte textures with no reflections or specular highlights
   - Hand-painted textures where the artist controls every detail
   - If the artist paints a metal glow, it stays — the engine doesn't interfere

4. **Vibrant, Saturated Colors**
   - Avoid desaturation and muddy palettes
   - Warm, readable lighting
   - Bright accent colors (gold trim, team colors)

---

## II. FACTION COLOR PALETTES

### Human Alliance

```
Primary:    Royal Blue     #1E3A8A
Secondary:  Silver/White   #C0C0C0
Accent:     Gold           #D4AF37
Trim:       Stone Gray     #6B7280
```

**Visual Theme**: Medieval European knights, castles, cathedrals
**Materials**: Polished steel, blue cloth, white banners, stone masonry
**Mood**: Noble, orderly, righteous

---

### Orcish Horde

```
Primary:    Blood Red      #991B1B
Secondary:  Black          #1F2937
Accent:     Bone/Ivory     #F5F5DC
Trim:       Rust Brown     #78350F
```

**Visual Theme**: Tribal shamanism, brutal pragmatism
**Materials**: Rough iron, leather, bone, wood spikes
**Mood**: Savage, proud, honorable

---

### Undead Scourge

```
Primary:    Necrotic Purple  #581C87
Secondary:  Sickly Green     #84CC16
Accent:     Bone White       #FAFAF9
Trim:       Rusted Metal     #44403C
```

**Visual Theme**: Death, decay, necromancy, cold
**Materials**: Rotting flesh, corroded metal, spider silk, ice
**Mood**: Sinister, relentless, corrupted

---

### Night Elf Sentinels

```
Primary:    Deep Violet     #4C1D95
Secondary:  Forest Teal     #0F766E
Accent:     Moonlight Silver #E5E7EB
Trim:       Ancient Wood    #78716C
```

**Visual Theme**: Ancient forests, lunar worship, nature magic
**Materials**: Living wood, mooncloth, leaves, glowing wisps
**Mood**: Mysterious, ancient, fierce protectors

---

## III. UI DESIGN ELEMENTS

### Frame Anatomy (The "WC3 Look")

```
┌─────────────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════════════╗  │
│  ║  OUTER BEVEL (dark shadow, ~3px)                      ║  │
│  ║  ┌─────────────────────────────────────────────────┐  ║  │
│  ║  │  GOLD/BRONZE TRIM (ornate border, ~4-6px)      │  ║  │
│  ║  │  ┌───────────────────────────────────────────┐  │  ║  │
│  ║  │  │  INNER BEVEL (light highlight, ~2px)     │  │  ║  │
│  ║  │  │  ┌─────────────────────────────────────┐  │  │  ║  │
│  ║  │  │  │                                     │  │  │  ║  │
│  ║  │  │  │     CONTENT AREA                    │  │  │  ║  │
│  ║  │  │  │     (parchment/dark texture)        │  │  │  ║  │
│  ║  │  │  │                                     │  │  │  ║  │
│  ║  │  │  └─────────────────────────────────────┘  │  │  ║  │
│  ║  │  └───────────────────────────────────────────┘  │  ║  │
│  ║  └─────────────────────────────────────────────────┘  ║  │
│  ╚═══════════════════════════════════════════════════════╝  │
│           Corner ornaments (shields, skulls, leaves)        │
└─────────────────────────────────────────────────────────────┘
```

### Key UI Characteristics

| Element | WC3 Style | Modern Equivalent |
|---------|-----------|-------------------|
| **Borders** | 3D beveled gold/bronze trim | `border: 4px ridge #D4AF37` |
| **Buttons** | Raised stone/metal with highlight | `box-shadow: inset 2px 2px #fff` |
| **Backgrounds** | Parchment or dark leather texture | Subtle noise overlay on solid |
| **Icons** | Thick 3D rim, square with rounded inner | 64x64 with 4px border |
| **Tooltips** | Dark box with gold border, drop shadow | Semi-transparent dark bg |
| **Text** | Yellow/gold on dark, drop shadow | `text-shadow: 2px 2px #000` |

### Icon Button Style

```
┌──────────────────┐
│ ╔══════════════╗ │  <- Outer dark rim (black/dark gray)
│ ║ ┌──────────┐ ║ │  <- Gold/bronze border
│ ║ │          │ ║ │  <- Inner highlight (lighter)
│ ║ │  [ICON]  │ ║ │  <- 64x64 artwork
│ ║ │          │ ║ │
│ ║ └──────────┘ ║ │
│ ╚══════════════╝ │
└──────────────────┘

Pressed state: Invert the bevel (dark on top, light on bottom)
Hover state: Subtle gold glow or brightness increase
Disabled: Desaturate + reduce opacity
```

---

## IV. TYPOGRAPHY

### Primary Font Stack

**Warcraft/Fantasy Headers:**
- Custom Warcraft font (proprietary)
- Alternatives: `"Cinzel"`, `"Almendra"`, `"MedievalSharp"`, `"Uncial Antiqua"`

**Body Text:**
- `"Palatino Linotype"`, `"Book Antiqua"`, `Georgia`, serif

**UI Labels:**
- `"Friz Quadrata"` (classic Blizzard choice)
- Alternatives: `"Trajan Pro"`, `"Cinzel"`, `"Forum"`

### Text Styling

```css
/* WC3-style heading */
.wc3-heading {
  font-family: "Cinzel", "Trajan Pro", serif;
  color: #FFD700;
  text-shadow:
    2px 2px 0 #000,
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* WC3-style body text */
.wc3-body {
  font-family: "Palatino Linotype", "Book Antiqua", Georgia, serif;
  color: #F5F5DC;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
  line-height: 1.6;
}

/* Tooltip text */
.wc3-tooltip {
  font-family: "Friz Quadrata", "Cinzel", serif;
  color: #FFFFFF;
  font-size: 14px;
}

/* Gold highlight text */
.wc3-gold {
  color: #FFD700;
}

/* Mana/resource text */
.wc3-mana {
  color: #60A5FA;
}

/* Health/damage text */
.wc3-damage {
  color: #EF4444;
}
```

---

## V. TEXTURE PATTERNS

### Background Textures

**Parchment (Light UI)**
- Aged paper texture
- Subtle coffee stains and creases
- Warm beige base (#F5F5DC to #D4C89A)

**Dark Leather (Dark UI)**
- Deep brown/black base (#1C1917)
- Subtle grain pattern
- Worn edges and scratches

**Stone (Neutral panels)**
- Cool gray base (#4B5563)
- Rough, hand-carved appearance
- Subtle cracks and variations

**Metal (Buttons, frames)**
- Bronze/gold for ornate elements
- Steel gray for functional elements
- Always matte, never shiny

### CSS Texture Examples

```css
/* Parchment background */
.parchment {
  background:
    linear-gradient(to bottom,
      rgba(245,245,220,0.9),
      rgba(212,200,154,0.9)),
    url('noise.png');
  background-blend-mode: overlay;
}

/* Dark leather */
.dark-leather {
  background:
    linear-gradient(135deg,
      #1C1917 0%,
      #292524 50%,
      #1C1917 100%);
  box-shadow: inset 0 0 50px rgba(0,0,0,0.5);
}

/* Stone texture */
.stone {
  background: #4B5563;
  background-image:
    repeating-radial-gradient(
      circle at 50% 50%,
      transparent 0,
      #4B5563 10px
    ),
    repeating-linear-gradient(
      #3F4653,
      #565F6D
    );
}
```

---

## VI. WARCRAFT 3 COLOR TOKENS

### Complete Design Token System

```css
:root {
  /* === FACTION: HUMAN === */
  --human-primary: #1E3A8A;
  --human-secondary: #C0C0C0;
  --human-accent: #D4AF37;
  --human-trim: #6B7280;

  /* === FACTION: ORC === */
  --orc-primary: #991B1B;
  --orc-secondary: #1F2937;
  --orc-accent: #F5F5DC;
  --orc-trim: #78350F;

  /* === FACTION: UNDEAD === */
  --undead-primary: #581C87;
  --undead-secondary: #84CC16;
  --undead-accent: #FAFAF9;
  --undead-trim: #44403C;

  /* === FACTION: NIGHT ELF === */
  --nightelf-primary: #4C1D95;
  --nightelf-secondary: #0F766E;
  --nightelf-accent: #E5E7EB;
  --nightelf-trim: #78716C;

  /* === UI CHROME === */
  --gold-light: #FFD700;
  --gold-medium: #D4AF37;
  --gold-dark: #B8860B;
  --bronze: #CD7F32;
  --steel: #71797E;
  --iron: #48494B;

  /* === BACKGROUNDS === */
  --bg-parchment: #F5F5DC;
  --bg-parchment-dark: #D4C89A;
  --bg-leather: #1C1917;
  --bg-stone: #4B5563;
  --bg-void: #0F0F0F;

  /* === TEXT === */
  --text-gold: #FFD700;
  --text-light: #F5F5DC;
  --text-body: #D4D4D4;
  --text-muted: #9CA3AF;
  --text-mana: #60A5FA;
  --text-health: #EF4444;
  --text-nature: #84CC16;

  /* === BORDERS === */
  --border-gold: 4px ridge var(--gold-medium);
  --border-dark: 2px solid #1F2937;
  --border-glow: 0 0 10px var(--gold-light);

  /* === SHADOWS === */
  --shadow-text: 2px 2px 0 #000;
  --shadow-box: 4px 4px 8px rgba(0,0,0,0.6);
  --shadow-inset: inset 0 0 20px rgba(0,0,0,0.4);
}
```

---

## VII. COMPONENT EXAMPLES

### WC3-Style Button

```css
.wc3-button {
  /* Base */
  background: linear-gradient(180deg, #4B5563 0%, #374151 50%, #1F2937 100%);
  border: 4px ridge var(--gold-medium);
  border-radius: 4px;
  padding: 12px 24px;

  /* Text */
  font-family: "Cinzel", serif;
  font-size: 14px;
  color: var(--text-gold);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-shadow: var(--shadow-text);

  /* Effects */
  box-shadow:
    inset 2px 2px 4px rgba(255,255,255,0.1),
    inset -2px -2px 4px rgba(0,0,0,0.3),
    var(--shadow-box);

  cursor: pointer;
  transition: all 0.15s ease;
}

.wc3-button:hover {
  background: linear-gradient(180deg, #6B7280 0%, #4B5563 50%, #374151 100%);
  box-shadow:
    inset 2px 2px 4px rgba(255,255,255,0.2),
    var(--shadow-box),
    var(--border-glow);
}

.wc3-button:active {
  background: linear-gradient(180deg, #1F2937 0%, #374151 50%, #4B5563 100%);
  box-shadow:
    inset -2px -2px 4px rgba(255,255,255,0.1),
    inset 2px 2px 4px rgba(0,0,0,0.4);
}
```

### WC3-Style Panel

```css
.wc3-panel {
  /* Frame */
  background: var(--bg-leather);
  border: 6px ridge var(--gold-medium);
  border-radius: 8px;

  /* Inner glow */
  box-shadow:
    inset 0 0 30px rgba(0,0,0,0.5),
    0 0 20px rgba(0,0,0,0.8);

  /* Padding */
  padding: 24px;

  /* Corner decorations would be pseudo-elements */
  position: relative;
}

.wc3-panel::before,
.wc3-panel::after {
  content: "◆";
  position: absolute;
  color: var(--gold-medium);
  font-size: 20px;
  text-shadow: 0 0 5px var(--gold-light);
}

.wc3-panel::before { top: -10px; left: -10px; }
.wc3-panel::after { bottom: -10px; right: -10px; }
```

### WC3-Style Tooltip

```css
.wc3-tooltip {
  /* Container */
  background: rgba(15, 15, 15, 0.95);
  border: 2px solid var(--gold-dark);
  border-radius: 4px;
  padding: 12px 16px;
  max-width: 300px;

  /* Shadow */
  box-shadow:
    0 4px 12px rgba(0,0,0,0.8),
    inset 0 1px 0 rgba(255,215,0,0.1);
}

.wc3-tooltip-title {
  color: var(--text-gold);
  font-family: "Cinzel", serif;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 8px;
  text-shadow: var(--shadow-text);
}

.wc3-tooltip-body {
  color: var(--text-body);
  font-family: "Palatino", serif;
  font-size: 13px;
  line-height: 1.5;
}

.wc3-tooltip-stat {
  color: var(--text-mana);
}

.wc3-tooltip-cost {
  color: var(--text-gold);
  font-weight: bold;
}
```

---

## VIII. APPLYING TO SOVEREIGN LABORATORY

### Faction Mapping

| SL-OS Faction | WC3 Equivalent | Theme Adaptation |
|---------------|----------------|------------------|
| **Anthropic Dominion** (Claude) | Human Alliance | Blue/gold, noble, precise |
| **DeepMind Collective** (Gemini) | Night Elf | Purple/teal, vast, mystical |
| **Kernel Commander** (You) | Neutral/Mercenary | Gold/black, sovereign |

### Recommended Implementation

1. **Use the dark leather background** as your base
2. **Gold trim on all panels and frames** for that iconic WC3 chrome
3. **Faction colors for units/agents** in the game manual
4. **Parchment texture for documentation** sections
5. **3D beveled icons** for tools and abilities

### File Structure for Assets

```
/static/wc3-theme/
├── tokens.css           # Color and design tokens
├── components.css       # Button, panel, tooltip styles
├── textures/
│   ├── parchment.png
│   ├── leather.png
│   ├── stone.png
│   └── noise.png
├── borders/
│   ├── gold-frame.svg
│   ├── corner-ornament.svg
│   └── divider.svg
└── fonts/
    ├── cinzel.woff2
    └── palatino.woff2
```

---

## IX. REFERENCE RESOURCES

### Official & Community

- [HIVE Workshop](https://www.hiveworkshop.com/) — WC3 modding community with UI resources
- [Wowpedia Concept Art](https://wowpedia.fandom.com/wiki/Category:Warcraft_III_concept_art)
- [Internet Archive - WC3 Box Art](https://archive.org/details/WarcraftNostalgia.WarcraftRTS.BoxCoverArt)
- [Samwise Didier DeviantArt](https://www.deviantart.com/samwisedidier)
- [Game Informer - WC3 Concept Art Gallery](https://gameinformer.com/2018/11/14/explore-warcraft-iiis-origins-in-this-rare-concept-art-gallery)

### Asset Packs (Similar Style)

- [Fab.com - Medieval Fantasy UI](https://www.fab.com/listings/7b4a8db4-1427-464c-8c4a-6bfae31e632e)
- [iStock - Medieval UI Elements](https://www.istockphoto.com/illustrations/medieval-ui)
- [Freepik - Fantasy Borders](https://www.freepik.com/free-vector/medieval-game-frame-ui-metal-fantasy-border_38539781.htm)

---

```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║  "The first thing everyone wanted to do was make it more       ║
║   realistic. Then we saw it in game and we were like           ║
║   'Everything looks dumb.' So we started making things         ║
║   bigger and bulkier... Everything felt heroic."               ║
║                                                                ║
║                              — Samwise Didier, Blizzard        ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

---

*Style Guide v1.0 | Sovereign Laboratory OS | Based on Warcraft III (2002)*
