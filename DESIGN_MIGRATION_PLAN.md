# Design System Migration Plan
## From Carbon Design System → The Way of Code (Rubin Aesthetic)

**Status**: Planning Phase
**Timeline**: Phased rollout recommended
**Philosophy**: Literary minimalism over corporate dashboards

---

## EXECUTIVE SUMMARY

### Current State
- **Carbon Design System** (IBM) for React components
- **Glassmorphism** UI with blue accent (#3b82f6)
- **Sans-serif** typography (Inter, IBM Plex Sans)
- **Dashboard-oriented** layouts with cards and grids

### Target State
- **The Way of Code** aesthetic (Rick Rubin / Lao Tzu)
- **Literary minimalism** with warm earth tones
- **Serif typography** (EB Garamond, Crimson Pro)
- **Prose-focused** layouts with generous spacing

### Migration Strategy
**Hybrid Approach**: Keep Carbon for "app" sections (dashboards, tools), apply Rubin aesthetic to content/reading experiences.

---

## PHASE 1: FOUNDATION (Week 1)

### 1.1 Design Token Creation
**File**: `/static/css/rubin-tokens.css`

```css
:root {
  /* ============================================
     THE WAY OF CODE - DESIGN TOKENS
     Based on Rick Rubin's adaptation of Lao Tzu
     ============================================ */

  /* === COLOR PALETTE === */

  /* Backgrounds (Warm Ivory) */
  --rubin-ivory: #FAF9F6;           /* Primary background - paper white */
  --rubin-ivory-med: #F0EEE6;       /* Subtle backgrounds */
  --rubin-ivory-dark: #E8E6DC;      /* Borders, dividers */
  --rubin-tone: #F5F2EC;            /* Alternative background */

  /* Text Colors (Slate & Grays) */
  --rubin-slate: #1F1E1D;           /* Headings - near black */
  --rubin-text: rgba(0, 0, 0, 0.85);/* Body text */
  --rubin-dark-gray: #5E5D59;       /* Secondary text */
  --rubin-gray: #87867F;            /* Tertiary text, captions */

  /* Accent Colors */
  --rubin-cyan: #44A6E4;            /* Interactive elements, links */
  --rubin-clay: #D97757;            /* Warm accent, CTAs */
  --rubin-riso: #5E7EDF;            /* Cool accent, highlights */

  /* === TYPOGRAPHY === */

  /* Font Families */
  --font-display: 'EB Garamond', 'Crimson Pro', Georgia, serif;
  --font-body: 'EB Garamond', 'Crimson Pro', Georgia, serif;
  --font-code: 'Courier Prime', 'JetBrains Mono', 'Courier New', monospace;

  /* Font Sizes (Larger for readability) */
  --font-size-xs: 14px;
  --font-size-sm: 18px;
  --font-size-base: 22px;           /* Body text - larger than typical */
  --font-size-lg: 28px;
  --font-size-xl: 32.4px;           /* h2 */
  --font-size-2xl: 48px;
  --font-size-3xl: 72px;            /* h1 - display */

  /* Line Heights (Generous for readability) */
  --line-height-tight: 1.2;
  --line-height-base: 1.5;
  --line-height-relaxed: 1.8;

  /* Letter Spacing */
  --letter-spacing-tight: -0.02em;
  --letter-spacing-base: 0.02em;
  --letter-spacing-wide: 0.05em;
  --letter-spacing-ultra: 0.4em;    /* For display headings */

  /* Font Weights */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;

  /* === SPACING === */

  /* Base spacing scale (generous) */
  --space-xs: 8px;
  --space-sm: 16px;
  --space-md: 32px;
  --space-lg: 48px;
  --space-xl: 64px;
  --space-2xl: 100px;               /* Signature horizontal padding */
  --space-3xl: 140px;               /* Large margins */

  /* === LAYOUT === */

  /* Max Widths */
  --max-width-prose: 1440px;        /* Wide prose container */
  --max-width-content: 1000px;      /* Standard content */
  --max-width-narrow: 720px;        /* Narrow reading column */

  /* Border Radius (Minimal) */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 8px;

  /* Shadows (Subtle) */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.1);

  /* === TRANSITIONS === */

  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 400ms ease;

  /* === BREAKPOINTS === */

  --breakpoint-mobile: 480px;
  --breakpoint-tablet: 768px;
  --breakpoint-desktop: 1024px;
  --breakpoint-wide: 1440px;
}
```

### 1.2 Typography Setup
**Import Google Fonts** in `/frontend/index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Courier+Prime:wght@400;700&display=swap" rel="stylesheet">
```

### 1.3 Base Typography Styles
**File**: `/static/css/rubin-typography.css`

```css
/* Import Rubin tokens */
@import './rubin-tokens.css';

/* === TYPOGRAPHY RESET === */

body {
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--rubin-text);
  background-color: var(--rubin-ivory);
  letter-spacing: var(--letter-spacing-base);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* === HEADINGS === */

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display);
  color: var(--rubin-slate);
  font-weight: var(--font-weight-normal);
  margin: 0;
}

h1 {
  font-size: var(--font-size-3xl);        /* 72px */
  line-height: 1.2;
  letter-spacing: var(--letter-spacing-ultra); /* 0.4em = 28.8px at 72px */
  margin-bottom: var(--space-xl);
  text-transform: uppercase;
}

h2 {
  font-size: var(--font-size-xl);         /* 32.4px */
  line-height: 1.3;
  letter-spacing: 0.025em;
  margin-bottom: var(--space-md);
}

h3 {
  font-size: var(--font-size-base);       /* 22px */
  font-weight: var(--font-weight-medium); /* 500 */
  line-height: 1.5;
  margin-bottom: var(--space-sm);
}

h4, h5, h6 {
  font-size: var(--font-size-sm);         /* 18px */
  font-weight: var(--font-weight-medium);
  line-height: 1.5;
  margin-bottom: var(--space-sm);
}

/* === BODY TEXT === */

p {
  margin-bottom: var(--space-md);
  max-width: 65ch; /* Optimal line length for readability */
}

a {
  color: var(--rubin-cyan);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color var(--transition-fast);
}

a:hover {
  border-bottom-color: var(--rubin-cyan);
}

/* === CODE === */

code, pre {
  font-family: var(--font-code);
}

code {
  font-size: 0.9em;
  padding: 0.2em 0.4em;
  background-color: var(--rubin-ivory-dark);
  border-radius: var(--radius-sm);
}

pre {
  padding: var(--space-md);
  background-color: var(--rubin-ivory-med);
  border-radius: var(--radius-md);
  overflow-x: auto;
  line-height: 1.6;
}

pre code {
  padding: 0;
  background-color: transparent;
}

/* === LISTS === */

ul, ol {
  margin-bottom: var(--space-md);
  padding-left: var(--space-lg);
}

li {
  margin-bottom: var(--space-sm);
}

/* === BLOCKQUOTES === */

blockquote {
  margin: var(--space-lg) 0;
  padding-left: var(--space-lg);
  border-left: 3px solid var(--rubin-clay);
  font-style: italic;
  color: var(--rubin-dark-gray);
}

/* === MOBILE ADJUSTMENTS === */

@media (max-width: 768px) {
  body {
    font-size: 18px; /* Slightly smaller on mobile */
  }

  h1 {
    font-size: 48px;
    letter-spacing: 0.2em; /* Less tracking on mobile */
  }

  h2 {
    font-size: 28px;
  }

  p {
    max-width: none; /* Full width on mobile */
  }
}
```

---

## PHASE 2: LAYOUT COMPONENTS (Week 2)

### 2.1 Prose Container Component
**File**: `/frontend/src/components/layout/ProseContainer.tsx`

```typescript
import React from 'react';
import './ProseContainer.css';

interface ProseContainerProps {
  children: React.ReactNode;
  maxWidth?: 'narrow' | 'content' | 'prose';
  className?: string;
}

export const ProseContainer: React.FC<ProseContainerProps> = ({
  children,
  maxWidth = 'prose',
  className = '',
}) => {
  return (
    <div className={`prose-container prose-container--${maxWidth} ${className}`}>
      {children}
    </div>
  );
};
```

**File**: `/frontend/src/components/layout/ProseContainer.css`

```css
.prose-container {
  padding: 0 var(--space-2xl); /* 100px horizontal padding */
  margin: 0 auto;
}

.prose-container--narrow {
  max-width: var(--max-width-narrow);
}

.prose-container--content {
  max-width: var(--max-width-content);
}

.prose-container--prose {
  max-width: var(--max-width-prose);
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .prose-container {
    padding: 0 var(--space-md); /* 32px on mobile */
  }
}
```

### 2.2 Article Layout Component
**File**: `/frontend/src/components/layout/ArticleLayout.tsx`

```typescript
import React from 'react';
import { ProseContainer } from './ProseContainer';
import './ArticleLayout.css';

interface ArticleLayoutProps {
  title?: string;
  subtitle?: string;
  publishDate?: string;
  children: React.ReactNode;
}

export const ArticleLayout: React.FC<ArticleLayoutProps> = ({
  title,
  subtitle,
  publishDate,
  children,
}) => {
  return (
    <article className="article-layout">
      {title && (
        <header className="article-header">
          <ProseContainer maxWidth="content">
            <h1 className="article-title">{title}</h1>
            {subtitle && <p className="article-subtitle">{subtitle}</p>}
            {publishDate && (
              <time className="article-date" dateTime={publishDate}>
                {new Date(publishDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
            )}
          </ProseContainer>
        </header>
      )}

      <ProseContainer maxWidth="prose">
        <div className="article-content">{children}</div>
      </ProseContainer>
    </article>
  );
};
```

**File**: `/frontend/src/components/layout/ArticleLayout.css`

```css
.article-layout {
  background-color: var(--rubin-ivory);
  min-height: 100vh;
}

.article-header {
  padding-top: var(--space-3xl);
  padding-bottom: var(--space-xl);
  border-bottom: 1px solid var(--rubin-ivory-dark);
  margin-bottom: var(--space-xl);
}

.article-title {
  margin-bottom: var(--space-md);
}

.article-subtitle {
  font-size: var(--font-size-lg);
  color: var(--rubin-dark-gray);
  font-style: italic;
  margin-bottom: var(--space-sm);
}

.article-date {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--rubin-gray);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
}

.article-content {
  padding-bottom: var(--space-3xl);
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .article-header {
    padding-top: var(--space-xl);
    padding-bottom: var(--space-lg);
  }
}
```

---

## PHASE 3: CARBON → RUBIN COEXISTENCE (Week 3)

### 3.1 Context-Based Design System
Create a design system switcher based on route context.

**File**: `/frontend/src/contexts/DesignSystemContext.tsx`

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

type DesignSystem = 'carbon' | 'rubin';

interface DesignSystemContextType {
  activeSystem: DesignSystem;
  setDesignSystem: (system: DesignSystem) => void;
}

const DesignSystemContext = createContext<DesignSystemContextType | undefined>(
  undefined
);

export const useDesignSystem = () => {
  const context = useContext(DesignSystemContext);
  if (!context) {
    throw new Error('useDesignSystem must be used within DesignSystemProvider');
  }
  return context;
};

// Routes that should use Rubin aesthetic
const RUBIN_ROUTES = ['/essays', '/writing', '/philosophy', '/about'];

export const DesignSystemProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const location = useLocation();
  const [activeSystem, setActiveSystem] = useState<DesignSystem>('carbon');

  useEffect(() => {
    // Auto-switch based on route
    const shouldUseRubin = RUBIN_ROUTES.some((route) =>
      location.pathname.startsWith(route)
    );
    setActiveSystem(shouldUseRubin ? 'rubin' : 'carbon');

    // Add class to body for scoped styling
    document.body.classList.toggle('design-system--rubin', shouldUseRubin);
    document.body.classList.toggle('design-system--carbon', !shouldUseRubin);
  }, [location.pathname]);

  return (
    <DesignSystemContext.Provider value={{ activeSystem, setDesignSystem: setActiveSystem }}>
      {children}
    </DesignSystemContext.Provider>
  );
};
```

### 3.2 Scoped CSS Loading
**File**: `/frontend/src/App.tsx` (update)

```typescript
import { DesignSystemProvider } from './contexts/DesignSystemContext';
import './styles/rubin-tokens.css';
import './styles/rubin-typography.css';

function App() {
  return (
    <DesignSystemProvider>
      {/* Your routes */}
    </DesignSystemProvider>
  );
}
```

---

## PHASE 4: COMPONENT MIGRATION (Week 4-5)

### 4.1 Migration Priority Matrix

| Component | Priority | Strategy |
|-----------|----------|----------|
| Blog posts / Essays | **High** | Full Rubin conversion |
| About page | **High** | Full Rubin conversion |
| Navigation | **Medium** | Hybrid (Rubin styling, Carbon structure) |
| Dashboard | **Low** | Keep Carbon |
| Admin panel | **Low** | Keep Carbon |
| Forms | **Medium** | Custom Rubin components |

### 4.2 Custom Rubin Components to Build

**Button** (Minimal link-style):
```typescript
// /frontend/src/components/rubin/Button.tsx
import './Button.css';

interface ButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'text';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  href,
  onClick,
  variant = 'primary',
}) => {
  const className = `rubin-button rubin-button--${variant}`;

  if (href) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  );
};
```

```css
/* /frontend/src/components/rubin/Button.css */
.rubin-button {
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  padding: var(--space-sm) var(--space-lg);
  border: none;
  background: none;
  cursor: pointer;
  transition: all var(--transition-base);
  display: inline-block;
}

.rubin-button--primary {
  color: var(--rubin-slate);
  border-bottom: 2px solid var(--rubin-cyan);
}

.rubin-button--primary:hover {
  color: var(--rubin-cyan);
}

.rubin-button--secondary {
  color: var(--rubin-dark-gray);
  border-bottom: 1px solid var(--rubin-gray);
}

.rubin-button--text {
  color: var(--rubin-cyan);
  padding: 0;
}

.rubin-button--text:hover {
  border-bottom: 1px solid var(--rubin-cyan);
}
```

---

## PHASE 5: TESTING & REFINEMENT (Week 6)

### 5.1 Visual Regression Testing
```bash
# Install Percy for visual diffs
npm install --save-dev @percy/cli @percy/playwright

# Create Percy config
# .percy.yml
version: 2
static:
  files: '**/*.html'
snapshot:
  widths: [375, 768, 1280, 1920]
```

### 5.2 Accessibility Audit
- Run Lighthouse on Rubin-styled pages
- Ensure contrast ratios meet WCAG AA (4.5:1 for body text)
- Test with screen readers (VoiceOver, NVDA)
- Verify keyboard navigation

### 5.3 Performance Metrics
- Measure font loading impact (EB Garamond vs. system fonts)
- Use `font-display: swap` to prevent FOIT (Flash of Invisible Text)
- Lazy load Carbon components only when needed

---

## ROLLOUT STRATEGY

### Option A: Gradual Migration (Recommended)
```
Week 1-2: Blog posts → Rubin
Week 3-4: About/Philosophy pages → Rubin
Week 5-6: Homepage hero → Rubin
Week 7+: Dashboard → Keep Carbon
```

**Pros**: Low risk, iterative feedback, easy rollback
**Cons**: Longer timeline

### Option B: Big Bang Redesign
```
Week 1-3: Build all Rubin components
Week 4: Switch entire site at once
Week 5-6: Bug fixes and refinement
```

**Pros**: Faster, cohesive launch
**Cons**: Higher risk, harder to revert

### Recommendation
**Option A** with a feature flag system:

```typescript
// /frontend/src/config.ts
export const FEATURE_FLAGS = {
  RUBIN_DESIGN: import.meta.env.VITE_RUBIN_DESIGN === 'true',
};

// Enable via .env.local
// VITE_RUBIN_DESIGN=true
```

---

## SUCCESS METRICS

### User Experience
- [ ] **Reading time**: Increase average time on blog posts by 25%+
- [ ] **Bounce rate**: Decrease bounce rate on content pages by 15%+
- [ ] **Scroll depth**: 75%+ of users scroll past 50% of article

### Technical
- [ ] **Lighthouse score**: 90+ on Performance, Accessibility, Best Practices
- [ ] **Contrast ratio**: All text meets WCAG AA (4.5:1 minimum)
- [ ] **Font loading**: < 300ms for first contentful paint

### Design Quality
- [ ] **Typography**: Serif fonts render correctly on all browsers
- [ ] **Spacing**: Consistent 100px horizontal padding on desktop
- [ ] **Mobile**: Responsive breakpoints at 768px and below

---

## RISK MITIGATION

### Risk: Serif fonts may not load properly
**Mitigation**: Define robust font stack with fallbacks
```css
--font-body: 'EB Garamond', 'Crimson Pro', Georgia, 'Times New Roman', serif;
```

### Risk: Large horizontal padding wastes space on small screens
**Mitigation**: Use responsive padding
```css
padding: 0 clamp(16px, 5vw, 100px);
```

### Risk: Users expect Carbon components in app sections
**Mitigation**: Keep Carbon for dashboards, use context-based switching

### Risk: Increased font file size impacts performance
**Mitigation**: Use `font-display: swap` and subset fonts
```html
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500&display=swap&text=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" rel="stylesheet">
```

---

## MAINTENANCE PLAN

### Documentation
- [ ] Create component library in Storybook for Rubin components
- [ ] Document design token usage in `/static/design-system/README.md`
- [ ] Add code examples to `DESIGN_AESTHETIC.md`

### Developer Handoff
- [ ] Write migration guide for new developers
- [ ] Create ESLint rules to enforce Rubin token usage
- [ ] Add Prettier config for consistent formatting

### Long-Term
- [ ] Monitor Google Analytics for user behavior changes
- [ ] Collect user feedback via surveys
- [ ] Iterate on typography scale based on readability studies

---

## NEXT STEPS

1. **User Approval**: Get sign-off on this migration plan
2. **Phase 1 Execution**: Create design tokens and typography files
3. **Prototype**: Build 1-2 sample pages with Rubin aesthetic
4. **User Testing**: Share with 5-10 users for feedback
5. **Iterate**: Refine based on feedback
6. **Launch**: Roll out to production incrementally

---

## APPENDIX: CODE SNIPPETS

### A. Import Rubin Tokens in Vite Config
```typescript
// /frontend/vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "./src/styles/rubin-tokens.css";`,
      },
    },
  },
});
```

### B. Playwright Test for Design Tokens
```typescript
// /tests/design-tokens.spec.ts
import { test, expect } from '@playwright/test';

test('Rubin design tokens are applied', async ({ page }) => {
  await page.goto('/essays/sample-post');

  // Check background color
  const bgColor = await page.evaluate(() => {
    return getComputedStyle(document.body).backgroundColor;
  });
  expect(bgColor).toBe('rgb(250, 249, 246)'); // --rubin-ivory

  // Check heading font
  const headingFont = await page.locator('h1').evaluate((el) => {
    return getComputedStyle(el).fontFamily;
  });
  expect(headingFont).toContain('EB Garamond');
});
```

---

**Signed by Antigravity Kernel**
*The best design is like water: it flows naturally, adapts to its container, and nourishes what it touches.*
