# Kernel Mini Phone Layout — Spec for Gemini

## Goal

Create a compact mobile layout optimized for small screens (iPhone SE, iPhone Mini, Galaxy S mini — **under 390px wide**). The current mobile layout works at 768px but gets cramped on mini phones. This spec defines a dedicated mini experience.

---

## Current State

### Breakpoints
- `768px` — primary mobile breakpoint (sidebar → bottom sheet, tab bar appears)
- `390px` — minimal tweaks today (tighter header padding, smaller tab icons)

### Layout Stack (mobile)
```
┌─────────────────────────┐
│ Header (logo, badges,   │  ~48px
│ dark mode, kebab menu)  │
├─────────────────────────┤
│                         │
│   Chat Messages         │  flex: 1, scroll
│   (32px side padding)   │
│                         │
├─────────────────────────┤
│ Input (textarea + btns) │  ~56px
├─────────────────────────┤
│ Bottom Tab Bar (5 tabs) │  56px + safe-area
└─────────────────────────┘
```

### Key Files
| File | What it does |
|------|-------------|
| `src/index.css` | All styles, design tokens, media queries (~92KB) |
| `src/pages/EnginePage.tsx` | Main page layout, all panel/overlay orchestration |
| `src/components/BottomTabBar.tsx` | 5-tab mobile nav (Home, Chats, Goals, Briefings, More) |
| `src/components/kernel-agent/ChatControls.tsx` | Input form (textarea, file attach, voice, send) |
| `src/components/MoreMenu.tsx` | Kebab menu with feature discovery dots |

### Design System (Rubin)
- **Fonts**: EB Garamond (serif, prose), Courier Prime (mono, meta)
- **Colors**: Ivory `#FAF9F6` bg, Slate `#1F1E1D` text, Vignette blue accents
- **Tokens**: `--rubin-*`, `--shadow-*`, `--radius-*`, `--ease-out`
- **Philosophy**: Literary-minimalist, contemplative, iOS-optimized PWA

---

## Spec: Mini Phone Mode (`max-width: 389px`)

### 1. Header — Collapse to Essential

**Current (390px)**: Logo + title + badges + dark mode + kebab = too crowded.

**Mini**: Strip to icon-only header.

```
┌───────────────────────┐
│ ☰  K  ···············●│  32px tall
└───────────────────────┘
  menu  logo       kebab+notification dot
```

- Remove text title ("Kernel") — just the K logo mark
- Remove badge pills (token count, model indicator) — move to More menu
- Remove dark mode toggle from header — already in More menu
- Notification dot overlays on kebab icon when unread
- Height: `32px` (down from 48px)

### 2. Chat Area — Maximize Reading Space

**Current**: `padding: 32px 24px` — wastes ~48px of a 375px screen.

**Mini**:
- Side padding: `12px`
- Message bubbles: full-width (no max-width constraint)
- Font size: `15px` (down from 16.5px) for message text
- Timestamps: hide by default, tap message to reveal
- Agent avatar: `20px` inline (down from 28px), or hide entirely and use colored left-border instead
- Code blocks: horizontal scroll, no wrapping, `font-size: 12px`
- Artifact cards: collapse to single-line filename + download icon

### 3. Input Area — Slim Single-Line

**Current**: Auto-expanding textarea + file button + voice button + send.

**Mini**:
- Single row: `[+] [input field............] [>]`
- `[+]` opens attachment/voice popover on tap
- Input field: single line, expands to multi-line only when typing wraps
- Height: `40px` (down from 56px)
- Remove voice toggle from inline — move to `[+]` popover

### 4. Bottom Tab Bar — 3 Tabs + More

**Current**: 5 tabs (Home, Chats, Goals, Briefings, More) — too many for <390px.

**Mini**: Collapse to 3 primary tabs:

```
┌─────────┬─────────┬─────────┐
│  Chat   │  Chats  │  More   │  40px + safe-area
└─────────┴─────────┴─────────┘
```

- **Chat**: Current conversation (home)
- **Chats**: Conversation history drawer
- **More**: Everything else (Goals, Briefings, Workflows, Stats, Insights, Settings)
- Tab bar height: `40px` (down from 56px)
- Labels: hide, icon-only
- Icons: `18px`

### 5. Panels & Overlays — Full-Screen Takeover

**Current**: Bottom sheets at `85vh` with rounded top.

**Mini**: Panels go full-screen (`100vh`, `100vw`), no border-radius. Back button in top-left instead of drag-to-dismiss (drag still works but full-screen gives more content room).

### 6. Conversation Drawer — Full-Screen List

**Current**: Bottom sheet at `85vh`.

**Mini**: Full-screen takeover with:
- Search bar at top
- Conversation list with larger tap targets (`52px` row height)
- Swipe-right on conversation to delete
- Back arrow to return to chat

---

## Implementation Approach

### CSS-Only Where Possible

Most changes should be achievable with a `@media (max-width: 389px)` block in `src/index.css`. No new components needed — just responsive overrides:

```css
@media (max-width: 389px) {
  /* Header */
  .ka-header { height: 32px; padding: 4px 8px; }
  .ka-header-title { display: none; }
  .ka-badge { display: none; }
  .ka-dark-toggle { display: none; }

  /* Chat */
  .ka-chat { padding: 8px 12px; }
  .ka-msg-text { font-size: 15px; }
  .ka-msg-avatar { width: 20px; height: 20px; }
  .ka-msg-time { display: none; }  /* show on tap via JS */

  /* Input */
  .ka-input { height: 40px; }
  .ka-input-voice { display: none; }  /* move to popover */

  /* Tab bar */
  .ka-tab-bar { height: 40px; }
  .ka-tab-label { display: none; }

  /* Panels */
  .ka-bottom-sheet {
    height: 100vh !important;
    border-radius: 0;
  }
}
```

### JS Changes (Minimal)

1. **BottomTabBar.tsx** — Conditionally render 3 tabs instead of 5 below 390px. Use `window.matchMedia('(max-width: 389px)')` or a shared hook.
2. **Message timestamp** — Add tap handler to toggle `.ka-msg-time` visibility on mini screens.
3. **Input popover** — Move file attach + voice into a `[+]` popover menu (only on mini).

### Testing Checklist

- [ ] iPhone SE (375x667) — primary target
- [ ] iPhone 13 Mini (375x812)
- [ ] Galaxy S10e (360x740)
- [ ] iPhone 12/13 Mini in landscape (812x375 — should NOT trigger mini mode)
- [ ] Verify no horizontal scroll on any screen
- [ ] All panels accessible via More tab
- [ ] Tap-to-reveal timestamps work
- [ ] Input expands when typing multiline
- [ ] Safe area insets still respected (notch, home indicator)

---

## Non-Goals

- No new routes or pages
- No changes to desktop or tablet layout
- No changes to the AI engine, agents, or backend
- No new design tokens — reuse existing Rubin system
- No dark mode changes (should inherit existing dark mode overrides)

## Priority

Low-to-medium. The current 390px tweaks are functional. This is a polish pass for the smallest phones.
