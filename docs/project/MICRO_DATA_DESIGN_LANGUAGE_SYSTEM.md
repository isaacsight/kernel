# Micro Data Design Language System (MDLS)
## Sovereign Laboratory OS — Unified Design Architecture

**Version**: 1.0
**Status**: Reference Specification
**Philosophy**: "Does This Feel Right?" — The Zen Architect

---

```
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║   ███╗   ███╗██████╗ ██╗     ███████╗                                   ║
║   ████╗ ████║██╔══██╗██║     ██╔════╝                                   ║
║   ██╔████╔██║██║  ██║██║     ███████╗                                   ║
║   ██║╚██╔╝██║██║  ██║██║     ╚════██║                                   ║
║   ██║ ╚═╝ ██║██████╔╝███████╗███████║                                   ║
║   ╚═╝     ╚═╝╚═════╝ ╚══════╝╚══════╝                                   ║
║                                                                          ║
║   MICRO DATA DESIGN LANGUAGE SYSTEM                                      ║
║   The Architecture of Look, Feel, and Structure                          ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## I. EXECUTIVE SUMMARY

The Micro Data Design Language System (MDLS) is a comprehensive specification that defines how the Sovereign Laboratory webapp looks, feels, and behaves structurally. It unifies:

1. **Design Tokens** — The atomic values (colors, typography, spacing)
2. **Component Architecture** — How UI elements are built and composed
3. **Semantic Structure** — How content is organized for machines and humans
4. **Interaction Patterns** — How the interface responds to users
5. **Dual-Mode Aesthetics** — Rubin (contemplative) + Arcade (energetic)

This document serves as the **single source of truth** for all design decisions.

---

## II. DESIGN PHILOSOPHY

### The Dual Persona

The Sovereign Laboratory operates on two aesthetic axes:

| Mode | Philosophy | Use Case |
|------|------------|----------|
| **Rubin Mode** | Literary minimalism, contemplation, timelessness | Essays, philosophy, long-form content |
| **Arcade Mode** | Neo Geo/CPS energy, precision, craft | Dashboards, tools, interactive systems |

### Core Principles

1. **"Does This Feel Right?"** — Every decision passes this test
2. **Ma (間)** — Intentional negative space creates breathing room
3. **Zen Precision** — Minimalist yet high-resolution information
4. **Opinionated OS** — Specific taste, not generic frameworks
5. **Garage Door Open** — Transparency in process and progress

---

## III. DESIGN TOKEN SPECIFICATION

### Token Architecture (Three-Tier Model)

```
┌─────────────────────────────────────────────────────────────┐
│  TIER 1: PRIMITIVE TOKENS (Raw Values)                       │
│  Platform-agnostic, no semantic meaning                      │
│  Example: --color-green-500: #66B56E                        │
├─────────────────────────────────────────────────────────────┤
│  TIER 2: SEMANTIC TOKENS (Purpose-Driven)                    │
│  Map primitives to UI roles, enable theming                  │
│  Example: --color-primary: var(--color-green-500)           │
├─────────────────────────────────────────────────────────────┤
│  TIER 3: COMPONENT TOKENS (Specific Application)             │
│  Apply to specific UI components                             │
│  Example: --button-bg: var(--color-primary)                 │
└─────────────────────────────────────────────────────────────┘
```

### Token File Format (W3C DTCG Standard)

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "primitive": {
      "green": {
        "500": { "$value": "#66B56E", "$type": "color" },
        "600": { "$value": "#7BC583", "$type": "color" }
      },
      "slate": {
        "900": { "$value": "#020202", "$type": "color" },
        "800": { "$value": "#050505", "$type": "color" }
      },
      "ivory": {
        "100": { "$value": "#FAF9F6", "$type": "color" },
        "200": { "$value": "#F0EEE6", "$type": "color" }
      }
    },
    "semantic": {
      "primary": { "$value": "{color.primitive.green.500}", "$type": "color" },
      "background": { "$value": "{color.primitive.slate.900}", "$type": "color" }
    }
  }
}
```

---

## IV. COLOR SYSTEM

### Arcade Mode Palette (Default)

The "Deep Space Slate" foundation with "Studio Green" accents.

```css
:root {
  /* === BACKGROUNDS === */
  --bg-primary: #020202;           /* Limitless void */
  --bg-secondary: #050505;         /* Sidebar, cards */
  --bg-tertiary: #0A0A0A;          /* Inputs, active states */

  /* === TYPOGRAPHY === */
  --text-primary: #66B56E;         /* Headings (Studio Green) */
  --text-secondary: #C9CEC9;       /* Body text */
  --text-tertiary: #8A908C;        /* Metadata, timestamps */
  --text-pure: #FFFFFF;            /* Critical contrast */

  /* === ACCENTS === */
  --accent-primary: #66B56E;       /* Links, buttons */
  --accent-hover: #7BC583;         /* Interactive states */
  --accent-subtle: rgba(102, 181, 110, 0.08);  /* Highlights */

  /* === FACTION COLORS (Neo Geo/CPS Inspired) === */
  --faction-claude: #5080F8;       /* CPS Blue - Human agents */
  --faction-gemini: #9060C8;       /* Neo Geo Purple - AI agents */
  --faction-metal: #789858;        /* Metal Slug Green - Systems */

  /* === ENERGY/EFFECTS === */
  --energy-white: #F8F8F8;
  --energy-yellow: #F8E850;
  --energy-orange: #F8A030;
  --energy-red: #D05020;
}
```

### Rubin Mode Palette (Content)

Literary minimalism with warm earth tones.

```css
:root[data-mode="rubin"] {
  /* === BACKGROUNDS === */
  --bg-primary: #FAF9F6;           /* Warm ivory paper */
  --bg-secondary: #F0EEE6;         /* Subtle backgrounds */
  --bg-tertiary: #E8E6DC;          /* Borders, dividers */

  /* === TYPOGRAPHY === */
  --text-primary: #1F1E1D;         /* Slate - headings */
  --text-secondary: rgba(0, 0, 0, 0.85);  /* Body text */
  --text-tertiary: #5E5D59;        /* Secondary text */
  --text-muted: #87867F;           /* Captions */

  /* === ACCENTS === */
  --accent-primary: #44A6E4;       /* Cyan - links */
  --accent-warm: #D97757;          /* Clay - CTAs */
  --accent-cool: #5E7EDF;          /* Riso - highlights */
}
```

### Color Symbolic Meaning

| Color | Meaning | Use |
|-------|---------|-----|
| Studio Green (#66B56E) | Growth, signal, clarity | Primary actions |
| Deep Slate (#020202) | Infinite depth, void | Backgrounds |
| Warm Ivory (#FAF9F6) | Paper, timelessness | Reading surfaces |
| Cyan (#44A6E4) | Wisdom, links, clarity | Interactive text |
| Clay (#D97757) | Warmth, humanity, craft | Accent CTAs |
| Neo Geo Purple (#9060C8) | Mystery, AI, undead | Gemini faction |
| CPS Blue (#5080F8) | Precision, human, tech | Claude faction |

---

## V. TYPOGRAPHY SYSTEM

### Font Stack

```css
:root {
  /* === ARCADE MODE (Default) === */
  --font-display: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* === RUBIN MODE (Content) === */
  --font-display-rubin: 'EB Garamond', 'Crimson Pro', Georgia, serif;
  --font-body-rubin: 'EB Garamond', 'Crimson Pro', Georgia, serif;
  --font-mono-rubin: 'Courier Prime', 'JetBrains Mono', monospace;
}
```

### Type Scale

| Token | Arcade | Rubin | Use |
|-------|--------|-------|-----|
| `--text-6xl` | 72px | 72px | Display titles |
| `--text-5xl` | 60px | 60px | h1 |
| `--text-4xl` | 48px | 48px | h2 |
| `--text-3xl` | 36px | 36px | h3 |
| `--text-2xl` | 30px | 32.4px | h4 |
| `--text-xl` | 24px | 28px | Large body |
| `--text-lg` | 20px | 22px | Body |
| `--text-base` | 16px | 22px | Default |
| `--text-sm` | 14px | 18px | Small |
| `--text-xs` | 12px | 14px | Micro |

### Letter Spacing

```css
:root {
  --tracking-tight: -0.02em;
  --tracking-normal: 0;
  --tracking-wide: 0.02em;
  --tracking-wider: 0.05em;
  --tracking-ultra: 0.4em;    /* Rubin display headings */
}
```

### Rubin Signature: Ultra-Tracked Headings

```css
.rubin-title {
  font-size: 72px;
  letter-spacing: 0.4em;      /* 28.8px at 72px */
  text-transform: uppercase;
  font-weight: 400;
}
```

This creates the **monumental, contemplative** effect signature to the Way of Code aesthetic.

---

## VI. SPACING SYSTEM

### Base Scale (Geometric Progression)

```css
:root {
  --space-0: 0px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;
  --space-32: 128px;

  /* === RUBIN SIGNATURE SPACING === */
  --space-prose: 100px;       /* Horizontal prose padding */
  --space-section: 140px;     /* Large vertical margins */
}
```

### Layout Tokens

```css
:root {
  /* === CONTAINER WIDTHS === */
  --max-width-sm: 640px;
  --max-width-md: 800px;
  --max-width-lg: 1024px;
  --max-width-xl: 1400px;
  --max-width-prose: 1440px;
  --max-width-narrow: 720px;

  /* === ARCADE LAYOUT === */
  --sidebar-width: 72px;
  --mobile-nav-height: 48px;

  /* === RUBIN LAYOUT === */
  --prose-padding: 100px;
  --chapter-nav-width: 40px;
}
```

---

## VII. COMPONENT ARCHITECTURE

### Shape & Form Tokens

```css
:root {
  /* === BORDER RADIUS === */
  --radius-sm: 8px;           /* Buttons, items */
  --radius-md: 16px;          /* Cards */
  --radius-lg: 24px;          /* Modals */
  --radius-full: 9999px;      /* Pills, avatars */

  /* === BORDERS === */
  --border-subtle: 1px solid rgba(255, 255, 255, 0.1);
  --border-strong: 2px solid var(--accent-primary);

  /* === SHADOWS === */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.1);
  --shadow-glow: 0 0 10px rgba(102, 181, 110, 0.3);
}
```

### Component Token Mapping

```css
/* === BUTTON TOKENS === */
--button-bg: var(--accent-primary);
--button-text: var(--bg-primary);
--button-hover-bg: var(--accent-hover);
--button-radius: var(--radius-sm);
--button-padding: var(--space-4) var(--space-8);

/* === CARD TOKENS === */
--card-bg: var(--bg-secondary);
--card-border: var(--border-subtle);
--card-radius: var(--radius-md);
--card-padding: var(--space-6);
--card-shadow: var(--shadow-md);

/* === INPUT TOKENS === */
--input-bg: var(--bg-tertiary);
--input-border: var(--border-subtle);
--input-focus-border: var(--accent-primary);
--input-radius: var(--radius-sm);
--input-padding: var(--space-3) var(--space-4);
```

---

## VIII. MOTION & INTERACTION SYSTEM

### Timing Functions

```css
:root {
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --duration-slower: 600ms;
}
```

### Animation Patterns

```css
/* === FADE UP (Entry) === */
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* === FLOAT (Idle) === */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

/* === PULSE GLOW (Attention) === */
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 5px var(--accent-primary); }
  50% { box-shadow: 0 0 20px var(--accent-primary); }
}

/* === STAGGER DELAY === */
.stagger-item { animation-delay: calc(var(--stagger-index) * 50ms); }
```

### Hover State Standards

| Element | Effect |
|---------|--------|
| Links | Color transition + bottom border fade-in |
| Buttons | Scale (1.05x) + glow shadow |
| Sidebar Icons | Scale (1.15x) |
| Cards | Lift + shadow increase |
| Images | Subtle zoom (1.02x) |

---

## IX. SEMANTIC DATA STRUCTURE

### JSON-LD Schema (Recommended)

Implement structured data for SEO and machine readability:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Sovereign Laboratory",
  "description": "Agentic Systems Engineering studio",
  "url": "https://sovereignlaboratory.com",
  "logo": "https://sovereignlaboratory.com/logo.png",
  "sameAs": [
    "https://github.com/sovereign-laboratory",
    "https://twitter.com/sovereign_lab"
  ]
}
</script>
```

### Content Schema Types

| Content Type | Schema.org Type | Required Properties |
|--------------|-----------------|---------------------|
| Essays | `Article` | headline, author, datePublished |
| Projects | `SoftwareApplication` | name, description, applicationCategory |
| Team | `Person` | name, jobTitle, image |
| Events | `Event` | name, startDate, location |

### Microdata Implementation

```html
<article itemscope itemtype="https://schema.org/Article">
  <h1 itemprop="headline">The Way of Code</h1>
  <span itemprop="author" itemscope itemtype="https://schema.org/Person">
    <span itemprop="name">Isaac Hernandez</span>
  </span>
  <time itemprop="datePublished" datetime="2025-01-23">January 23, 2025</time>
  <div itemprop="articleBody">
    <!-- Content -->
  </div>
</article>
```

---

## X. RESPONSIVE BREAKPOINTS

### Breakpoint Scale

```css
:root {
  --bp-mobile: 480px;
  --bp-tablet: 768px;
  --bp-desktop: 1024px;
  --bp-wide: 1440px;
  --bp-ultrawide: 1920px;
}
```

### Media Query Pattern

```css
/* Mobile-first approach */
.component { /* Mobile styles */ }

@media (min-width: 768px) {
  .component { /* Tablet styles */ }
}

@media (min-width: 1024px) {
  .component { /* Desktop styles */ }
}

@media (min-width: 1440px) {
  .component { /* Wide styles */ }
}
```

### Responsive Token Overrides

```css
/* === RUBIN PROSE PADDING === */
.prose-container {
  padding: 0 var(--space-8);  /* 32px mobile */
}

@media (min-width: 768px) {
  .prose-container {
    padding: 0 var(--space-12);  /* 48px tablet */
  }
}

@media (min-width: 1024px) {
  .prose-container {
    padding: 0 var(--space-prose);  /* 100px desktop */
  }
}
```

---

## XI. ARCADE MODE: NEO GEO/CPS INFLUENCE

### Pixel Art Rendering

```css
.pixel-art {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
```

### CRT Monitor Effect

```css
.crt-screen {
  background: var(--bg-primary);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
  position: relative;
}

.crt-screen::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.15),
    rgba(0, 0, 0, 0.15) 1px,
    transparent 1px,
    transparent 2px
  );
  pointer-events: none;
}
```

### Faction Color Application

| Element | Claude (Human) | Gemini (AI) | System |
|---------|---------------|-------------|--------|
| Badges | CPS Blue | Neo Geo Purple | Metal Slug Green |
| Borders | #3060D0 | #6840A0 | #587040 |
| Glow | Blue glow | Purple glow | Green glow |

---

## XII. RUBIN MODE: LITERARY AESTHETIC

### Prose Container

```css
.prose-layout {
  background: var(--rubin-ivory);
  min-height: 100vh;
}

.prose-container {
  max-width: var(--max-width-prose);
  padding: 0 var(--space-prose);
  margin: 0 auto;
}

.prose-content {
  font-family: var(--font-body-rubin);
  font-size: var(--text-lg);
  line-height: 1.5;
  letter-spacing: 0.02em;
}

.prose-content p {
  max-width: 65ch;  /* Optimal line length */
  margin-bottom: var(--space-8);
}
```

### Chapter Navigation Pattern

```css
.chapter-nav {
  position: fixed;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: var(--chapter-nav-width);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.chapter-link {
  font-family: var(--font-mono-rubin);
  font-size: var(--text-xs);
  color: var(--rubin-gray);
  text-decoration: none;
}

.chapter-link:hover,
.chapter-link.active {
  color: var(--rubin-cyan);
}
```

### Artwork Interludes

```css
.artwork-container {
  width: 100%;
  max-width: 450px;
  margin: var(--space-16) auto;
  aspect-ratio: 1;
}
```

---

## XIII. ACCESSIBILITY STANDARDS

### Color Contrast Requirements

| Element | Minimum Ratio | Target |
|---------|---------------|--------|
| Body text | 4.5:1 (AA) | 7:1 (AAA) |
| Large text (18px+) | 3:1 (AA) | 4.5:1 (AAA) |
| UI components | 3:1 | 4.5:1 |

### Focus States

```css
:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

/* High contrast mode */
@media (prefers-contrast: high) {
  :focus-visible {
    outline-width: 3px;
  }
}
```

### Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## XIV. IMPLEMENTATION CHECKLIST

### Phase 1: Foundation
- [ ] Create design token files (CSS custom properties)
- [ ] Set up W3C DTCG format for token interchange
- [ ] Configure Style Dictionary for multi-platform output
- [ ] Import Google Fonts (EB Garamond, Courier Prime)

### Phase 2: Core Components
- [ ] Build ProseContainer component
- [ ] Build ArticleLayout component
- [ ] Build Button variants (Arcade + Rubin)
- [ ] Build Card component
- [ ] Build Navigation component

### Phase 3: Mode Switching
- [ ] Implement DesignSystemContext
- [ ] Create route-based mode switching
- [ ] Add body class toggling
- [ ] Test mode transitions

### Phase 4: Structured Data
- [ ] Add JSON-LD to all page templates
- [ ] Implement Microdata on content elements
- [ ] Validate with Google Rich Results Test
- [ ] Test with Schema.org validator

### Phase 5: Testing
- [ ] Visual regression testing (Percy)
- [ ] Accessibility audit (Lighthouse, axe)
- [ ] Performance metrics (Core Web Vitals)
- [ ] Cross-browser testing

---

## XV. TOKEN FILE LOCATIONS

```
/frontend/src/
├── tokens/                         # W3C DTCG JSON source files
│   ├── colors.tokens.json          # Color primitives + semantic mappings
│   ├── typography.tokens.json      # Font families, sizes, text styles
│   ├── spacing.tokens.json         # Spacing scale + breakpoints
│   ├── effects.tokens.json         # Borders, shadows, opacity, z-index
│   └── motion.tokens.json          # Duration, easing, animations
├── styles/                         # Existing CSS implementations
│   ├── rts-tokens.css              # Arcade mode (RTS = Real-Time Strategy)
│   ├── rubin-tokens.css            # Rubin mode tokens
│   ├── rts-components.css          # Component styles
│   ├── motion.css                  # Animation keyframes
│   ├── mdls-generated.css          # Auto-generated from JSON tokens
│   └── theme-context.tsx           # React theme switching context
└── components/
    ├── layout/
    │   ├── ProseContainer.tsx
    │   ├── ArticleLayout.tsx
    │   └── DashboardLayout.tsx
    └── ui/
        ├── Button.tsx
        ├── Card.tsx
        └── Input.tsx
```

### Using the Token Files

**For Style Dictionary transformation:**
```bash
npx style-dictionary build --config style-dictionary.config.js
```

**For Tokens Studio (Figma):**
Import the JSON files directly into Tokens Studio plugin.

---

## XVI. QUICK REFERENCE

### Token Naming Convention

```
--{category}-{property}-{variant}-{state}

Examples:
--color-primary
--color-primary-hover
--text-body-lg
--space-section-lg
--button-bg-disabled
```

### CSS Class Naming (BEM)

```css
/* Block */
.card { }

/* Element */
.card__header { }
.card__body { }
.card__footer { }

/* Modifier */
.card--featured { }
.card--compact { }
```

### Mode Data Attributes

```html
<!-- Arcade Mode (Default) -->
<body data-mode="arcade">

<!-- Rubin Mode (Content) -->
<body data-mode="rubin">

<!-- Component-level override -->
<section data-mode="rubin" class="prose-container">
```

---

## XVII. SOURCES & REFERENCES

### Design Systems
- [W3C Design Tokens Community Group](https://www.w3.org/community/design-tokens/)
- [Style Dictionary](https://styledictionary.com/)
- [Tokens Studio](https://tokens.studio/)

### Typography
- [The Way of Code](https://www.thewayofcode.com/) — Rubin aesthetic reference
- [EB Garamond on Google Fonts](https://fonts.google.com/specimen/EB+Garamond)

### Arcade Art
- [Metal Slug Sprite Tutorial](https://6th-divisions-den.com/ms_tutorial.html)
- [Street Fighter II Paper Trails](https://fabiensanglard.net/sf2_sheets/)
- [Neo Geo Wikipedia](https://en.wikipedia.org/wiki/Neo_Geo)

### Structured Data
- [Schema.org](https://schema.org/)
- [Google Structured Data Guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [JSON-LD Specification](https://json-ld.org/)

---

```
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║   "The best design is like water: it flows naturally, adapts to its      ║
║    container, and nourishes what it touches."                            ║
║                                                                          ║
║                                        — The Way of Code (paraphrased)   ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

**MDLS v1.0 | Sovereign Laboratory OS**
*Micro Data Design Language System — The Architecture of Look, Feel, and Structure*
