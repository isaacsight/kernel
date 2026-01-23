# Micro-Information Design System
## "Dense, Quiet, Intentional"

---

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│   M I C R O - I N F O R M A T I O N                                   │
│                                                                        │
│   Design for people who read the footnotes.                           │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## I. CORE PHILOSOPHY

Micro-information design compresses meaning. It rewards attention instead of demanding it. Every element earns its position through purpose, not decoration.

**The Feeling:**
- Reading a library card, not a billboard
- Museum placards over marketing posters
- Old manuals, airline safety cards, scientific journals
- Design that whispers: *"If you notice this, you belong here."*

**Anti-Patterns:**
- Nothing loud
- Nothing centered unless it must be
- Nothing floats randomly
- Nothing decorative without function

---

## II. TYPOGRAPHY SYSTEM

### Type Philosophy

Small type used confidently—not as an afterthought. The goal is high legibility at small sizes with a slightly academic, never trendy feel.

### Font Stack

```css
:root {
  /* Primary: Dense information */
  --micro-font-primary: 'EB Garamond', Georgia, serif;

  /* Secondary: Labels, metadata */
  --micro-font-secondary: 'Inter', -apple-system, sans-serif;

  /* Mono: Technical, data */
  --micro-font-mono: 'JetBrains Mono', 'Courier Prime', monospace;
}
```

### Size Scale (Compressed)

| Token | Size | Use Case |
|-------|------|----------|
| `--micro-text-xxs` | 9px | Footnotes, legal, timestamps |
| `--micro-text-xs` | 10px | Metadata, captions |
| `--micro-text-sm` | 11px | Labels, secondary info |
| `--micro-text-base` | 12px | Body text (dense layouts) |
| `--micro-text-md` | 14px | Primary content |
| `--micro-text-lg` | 16px | Subheadings |
| `--micro-text-xl` | 18px | Section titles |
| `--micro-text-2xl` | 24px | Page titles (rare) |

### Line Height Rules

```css
:root {
  /* Tighter for small text */
  --micro-leading-tight: 1.3;
  --micro-leading-normal: 1.5;
  --micro-leading-relaxed: 1.65;

  /* Rule: Smaller text = more line height */
  /* 9-11px → 1.5-1.65 */
  /* 12-14px → 1.4-1.5 */
  /* 16px+ → 1.3-1.4 */
}
```

### Letter Spacing (Tracking)

```css
:root {
  --micro-tracking-tight: -0.01em;    /* Headlines */
  --micro-tracking-normal: 0.005em;   /* Body */
  --micro-tracking-wide: 0.02em;      /* Small caps, labels */
  --micro-tracking-ultra: 0.15em;     /* Spaced headings */
}
```

### Hierarchy Through Weight, Not Size

```css
/* WRONG: Size jumps for hierarchy */
h1 { font-size: 48px; }
h2 { font-size: 36px; }
p  { font-size: 16px; }

/* RIGHT: Weight + subtle size */
.title    { font-size: 14px; font-weight: 600; }
.subtitle { font-size: 12px; font-weight: 500; }
.body     { font-size: 12px; font-weight: 400; }
.meta     { font-size: 10px; font-weight: 400; opacity: 0.7; }
```

---

## III. COLOR SYSTEM

### Philosophy

Color = semantic meaning, not decoration. If it looks good in grayscale, it passes.

### Palette

```css
:root {
  /* === PAPER & INK === */
  --micro-paper: #FAF9F6;           /* Warm cream */
  --micro-paper-cool: #F5F5F5;      /* Cool white */
  --micro-ink: #1A1A1A;             /* Soft black */
  --micro-ink-light: #4A4A4A;       /* Graphite */
  --micro-ink-muted: #8A8A8A;       /* Tertiary text */

  /* === SEMANTIC ACCENTS (use sparingly) === */
  --micro-accent-sage: #7D8B75;     /* Calm, natural */
  --micro-accent-rust: #A65D47;     /* Warm attention */
  --micro-accent-slate: #5A6570;    /* Technical */
  --micro-accent-oxblood: #6B2D2D;  /* Emphasis */

  /* === FUNCTIONAL === */
  --micro-border: rgba(0, 0, 0, 0.08);
  --micro-border-strong: rgba(0, 0, 0, 0.15);
  --micro-highlight: rgba(0, 0, 0, 0.03);
}
```

### Color Usage Rules

1. **One accent per view** — maximum restraint
2. **Accents for meaning** — links, status, warnings
3. **Never decorative color** — if it doesn't inform, remove it
4. **Test in grayscale** — hierarchy must survive without color

---

## IV. SPACING SYSTEM

### Compressed Scale

```css
:root {
  --micro-space-0: 0;
  --micro-space-1: 2px;     /* Hairline */
  --micro-space-2: 4px;     /* Tight */
  --micro-space-3: 6px;     /* Compact */
  --micro-space-4: 8px;     /* Base unit */
  --micro-space-5: 12px;    /* Comfortable */
  --micro-space-6: 16px;    /* Breathing room */
  --micro-space-8: 24px;    /* Section gap */
  --micro-space-10: 32px;   /* Major section */
  --micro-space-12: 48px;   /* Page section */
}
```

### Information Density Patterns

```css
/* Dense metadata block */
.meta-block {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: var(--micro-space-3);
  font-size: var(--micro-text-xs);
}

/* Tight label-value pairs */
.label-value {
  display: flex;
  justify-content: space-between;
  padding: var(--micro-space-2) 0;
  border-bottom: 1px solid var(--micro-border);
}

/* Footnote spacing */
.footnotes {
  margin-top: var(--micro-space-8);
  padding-top: var(--micro-space-4);
  border-top: 1px solid var(--micro-border);
  font-size: var(--micro-text-xxs);
  line-height: var(--micro-leading-relaxed);
}
```

---

## V. LAYOUT & GRID

### Grid Philosophy

Modular grids with narrow columns and consistent margins. Nothing floats randomly—everything earns its position.

### Column System

```css
:root {
  --micro-col-narrow: 280px;    /* Sidebar, metadata */
  --micro-col-medium: 480px;    /* Content column */
  --micro-col-wide: 640px;      /* Full content */
  --micro-gutter: 24px;         /* Column gap */
  --micro-margin: 48px;         /* Page margin */
}

/* Classic editorial layout */
.editorial-layout {
  display: grid;
  grid-template-columns:
    var(--micro-col-narrow)
    var(--micro-col-medium);
  gap: var(--micro-gutter);
  max-width: 960px;
  margin: 0 auto;
  padding: var(--micro-margin);
}
```

### Information Tactics

```css
/* Footnotes > Headlines */
.footnote-ref {
  font-size: 9px;
  vertical-align: super;
  color: var(--micro-accent-slate);
}

/* Callouts smaller than body */
.callout {
  font-size: var(--micro-text-xs);
  padding: var(--micro-space-3);
  background: var(--micro-highlight);
  border-left: 2px solid var(--micro-border-strong);
}

/* Metadata as first-class content */
.article-meta {
  font-size: var(--micro-text-xxs);
  letter-spacing: var(--micro-tracking-wide);
  text-transform: uppercase;
  color: var(--micro-ink-muted);
  margin-bottom: var(--micro-space-6);
}
```

---

## VI. ICONOGRAPHY

### Style Guidelines

- Hairline strokes (1px or thinner)
- Almost invisible until needed
- Technical, not cute
- Monochrome only

### Icon Sizing

```css
:root {
  --micro-icon-xs: 10px;
  --micro-icon-sm: 12px;
  --micro-icon-md: 14px;
  --micro-icon-lg: 16px;
}

.icon {
  width: var(--micro-icon-sm);
  height: var(--micro-icon-sm);
  stroke-width: 1;
  stroke: currentColor;
  fill: none;
}
```

### Icon Use Cases

| Purpose | Size | Opacity |
|---------|------|---------|
| Directional cues | xs-sm | 0.5 |
| Status indicators | sm | 0.7-1.0 |
| Structural rhythm | xs | 0.3 |
| Interactive elements | md | 0.8 |

---

## VII. TEXTURE & MATERIAL

### Subtle Only

Feels archival, not distressed. Light paper grain and micro noise to avoid digital flatness.

```css
/* Paper texture overlay */
.paper-texture {
  position: relative;
}

.paper-texture::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.015;
  pointer-events: none;
  mix-blend-mode: multiply;
}

/* Ink inconsistency (text rendering) */
.archival-text {
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
```

---

## VIII. MOTION

### Motion Rules

- Slow fades (200-400ms)
- Short distances (4-8px max)
- Never playful
- Feels like breathing, not bouncing

```css
:root {
  --micro-duration-fast: 150ms;
  --micro-duration-normal: 250ms;
  --micro-duration-slow: 400ms;

  --micro-ease: cubic-bezier(0.4, 0, 0.2, 1);
  --micro-ease-out: cubic-bezier(0, 0, 0.2, 1);
}

/* Subtle fade-in */
.micro-fade {
  animation: microFade var(--micro-duration-slow) var(--micro-ease-out);
}

@keyframes microFade {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Hover: minimal */
.micro-hover {
  transition: opacity var(--micro-duration-fast) var(--micro-ease);
}

.micro-hover:hover {
  opacity: 0.7;
}
```

---

## IX. COMPONENTS

### Dense Data Table

```css
.micro-table {
  width: 100%;
  font-size: var(--micro-text-xs);
  border-collapse: collapse;
}

.micro-table th {
  font-size: var(--micro-text-xxs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: var(--micro-tracking-wide);
  color: var(--micro-ink-muted);
  text-align: left;
  padding: var(--micro-space-2) var(--micro-space-3);
  border-bottom: 1px solid var(--micro-border-strong);
}

.micro-table td {
  padding: var(--micro-space-2) var(--micro-space-3);
  border-bottom: 1px solid var(--micro-border);
}
```

### Metadata Badge

```css
.micro-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--micro-space-1);
  font-size: var(--micro-text-xxs);
  font-weight: 500;
  letter-spacing: var(--micro-tracking-wide);
  text-transform: uppercase;
  padding: var(--micro-space-1) var(--micro-space-2);
  background: var(--micro-highlight);
  border: 1px solid var(--micro-border);
  border-radius: 2px;
}
```

### Footnote System

```css
.footnote-container {
  counter-reset: footnote;
}

.footnote-ref {
  counter-increment: footnote;
}

.footnote-ref::after {
  content: counter(footnote);
  font-size: 8px;
  vertical-align: super;
  margin-left: 1px;
  color: var(--micro-accent-slate);
}

.footnote-list {
  font-size: var(--micro-text-xxs);
  line-height: var(--micro-leading-relaxed);
  color: var(--micro-ink-light);
}

.footnote-list li {
  margin-bottom: var(--micro-space-2);
}
```

---

## X. EMOTIONAL TONE

What the design communicates without saying it:

| Signal | Meaning |
|--------|---------|
| Dense information | "This wasn't rushed." |
| Hidden details | "There's more here if you look." |
| Quiet restraint | "We value attention." |
| No decoration | "Substance over style." |

**This is anti-algorithmic design. It filters for people who notice.**

---

## XI. APPLICATION CONTEXTS

### Where This Shines

- High-end brands (quiet luxury)
- Coffee, fashion, architecture, publishing
- Apps with power users
- Editorial sites
- Cultural institutions
- Anything that wants credibility without ego

### Integration with MDLS

| MDLS Mode | Micro-Info Application |
|-----------|------------------------|
| **Rubin Mode** | Natural fit—literary + dense metadata |
| **Arcade Mode** | HUD elements, stats, system info |

---

## XII. CHECKLIST

Before shipping micro-information design:

- [ ] Does it pass the grayscale test?
- [ ] Is there only one accent color per view?
- [ ] Is small type readable (line-height check)?
- [ ] Does every element earn its position?
- [ ] Would a librarian approve?
- [ ] Does it reward attention, not demand it?

---

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│   "The details are not the details.                                   │
│    They make the design."                                             │
│                                                                        │
│                                              — Charles Eames          │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

**Micro-Information Design System v1.0**
*For people who read the footnotes.*
