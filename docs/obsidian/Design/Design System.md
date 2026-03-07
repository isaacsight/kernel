---
tags: [kernel, design, rubin]
updated: "2026-03-06"
---

# Rubin Design System

Kernel's design language. Literary-minimalist, iOS-optimized, touch-first.

## Typography

| Use | Font | Weight |
|-----|------|--------|
| Prose / body | EB Garamond | 400-800 (serif) |
| Meta / code / UI | Courier Prime | 400 (monospace) |

## Color Palette

| Token | Value | Use |
|-------|-------|-----|
| Ivory | `#FAF9F6` | Background |
| Slate | `#1F1E1D` | Primary text |
| Amethyst | `#6B5B95` | Primary accent |
| Vignette blue | `rgba(100,149,237, ...)` | Subtle highlights |

### Dark Mode (warm brown undertones — "lamplight reading")

| Token | Value |
|-------|-------|
| `--dark-bg` | Deep warm brown |
| `--dark-bg-elevated` | Slightly lighter |
| `--dark-bg-surface` | Card surfaces |
| `--dark-text` | Warm off-white |
| `--dark-border` | Subtle warm edge |

**Principle:** Never cool gray. Always warm brown undertones.

## Spacing & Layout

| Token | Value |
|-------|-------|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 16px |
| `--space-lg` | 24px |
| `--space-xl` | 32px |
| `--space-2xl` | 48px |
| `--space-4xl` | 64px |

## Radii

| Token | Value |
|-------|-------|
| `--radius-xs` | 3px |
| `--radius-sm` | 6px |
| `--radius-md` | 10px |
| `--radius-lg` | 20px |
| `--radius-full` | 9999px |

## Principles

1. **iOS-optimized PWA** — Touch-first, contemplative feel
2. **Generous whitespace** — Let the content breathe
3. **Literary-minimalist** — Never corporate
4. **Zero Tailwind** — All vanilla CSS with `ka-` prefix
5. **Brand buttons** (Apple/Twitter) keep hardcoded #000 intentionally
6. **Bottom-sheet pattern** for all panels
7. **Mobile:** bottom tab bar at <768px (sidebar becomes horizontal)

## Agent Colors

| Agent | Color |
|-------|-------|
| kernel | `#6B5B95` (amethyst) |
| researcher | `#5B8BA0` (slate blue) |
| coder | `#6B8E6B` (sage green) |
| writer | `#B8875C` (warm brown) |
| analyst | `#A0768C` (mauve) |
