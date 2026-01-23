# Sovereign Laboratory Design System

A production-ready design system built with semantic design tokens and modular components.

## Quick Start

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="stylesheet" href="design-tokens.css">
  <link rel="stylesheet" href="components.css">
</head>
<body>
  <button class="button button--primary">Primary Action</button>
</body>
</html>
```

## Design Tokens

Design tokens are the foundational design decisions expressed as CSS custom properties. They provide consistency and make theming straightforward.

### Color System

**Primitives:**
```css
--color-gray-50 through --color-gray-950
--color-primary-50 through --color-primary-950 (Blue)
--color-success-50 through --color-success-950 (Green)
--color-warning-50 through --color-warning-950 (Amber)
--color-error-50 through --color-error-950 (Red)
```

**Semantic Tokens:**
```css
--bg-primary         /* Main background */
--bg-secondary       /* Card/panel backgrounds */
--bg-tertiary        /* Subtle backgrounds */
--text-primary       /* Main text */
--text-secondary     /* Muted text */
--interactive-default /* Links, primary buttons */
--feedback-success   /* Success states */
--feedback-error     /* Error states */
```

### Spacing

Based on 4px base unit:
```css
--space-1: 0.25rem  /* 4px */
--space-2: 0.5rem   /* 8px */
--space-4: 1rem     /* 16px */
--space-8: 2rem     /* 32px */
/* ... up to --space-32 (8rem) */
```

### Typography

**Font Families:**
```css
--font-sans: system-ui, -apple-system, sans-serif
--font-serif: Georgia, Times, serif
--font-mono: 'SF Mono', Monaco, monospace
```

**Type Scale:**
```css
--text-xs: 0.75rem   /* 12px */
--text-sm: 0.875rem  /* 14px */
--text-base: 1rem    /* 16px */
--text-lg: 1.125rem  /* 18px */
--text-xl: 1.25rem   /* 20px */
--text-2xl: 1.5rem   /* 24px */
--text-5xl: 3rem     /* 48px */
```

## Components

### Typography

```html
<h1 class="heading-1">Primary Heading</h1>
<h2 class="heading-2">Secondary Heading</h2>
<p class="body-large">Large body text for emphasis</p>
<p class="body-base">Standard body text</p>
<span class="caption">Caption or metadata text</span>
<code class="code">inline code</code>
<a href="#" class="link">Text link</a>
```

### Buttons

**Variants:**
```html
<button class="button button--primary">Primary</button>
<button class="button button--secondary">Secondary</button>
<button class="button button--outline">Outline</button>
<button class="button button--ghost">Ghost</button>
<button class="button button--danger">Danger</button>
```

**Sizes:**
```html
<button class="button button--primary button--sm">Small</button>
<button class="button button--primary">Medium (default)</button>
<button class="button button--primary button--lg">Large</button>
```

**With Icons:**
```html
<button class="button button--primary">
  <span class="button__icon">→</span>
  Next
</button>

<button class="button button--icon-only">
  <span class="button__icon">×</span>
</button>
```

**States:**
```html
<button class="button button--primary" disabled>Disabled</button>
```

### Forms

**Input Field:**
```html
<div class="input-group">
  <label class="label" for="email">Email Address</label>
  <input type="email" id="email" class="input" placeholder="you@example.com">
  <span class="input-help">We'll never share your email</span>
</div>
```

**Error State:**
```html
<div class="input-group">
  <label class="label" for="password">Password</label>
  <input type="password" id="password" class="input input--error">
  <span class="input-error">Password must be at least 8 characters</span>
</div>
```

**Success State:**
```html
<input type="text" class="input input--success" value="Valid input">
```

**Sizes:**
```html
<input type="text" class="input input--sm" placeholder="Small">
<input type="text" class="input" placeholder="Medium (default)">
<input type="text" class="input input--lg" placeholder="Large">
```

**Textarea:**
```html
<textarea class="input textarea" placeholder="Enter your message..."></textarea>
```

**Checkbox:**
```html
<label class="checkbox">
  <input type="checkbox" class="checkbox__input">
  Accept terms and conditions
</label>
```

**Radio:**
```html
<label class="radio">
  <input type="radio" name="option" class="radio__input">
  Option 1
</label>
```

### Cards

**Basic Card:**
```html
<div class="card">
  <h3 class="card__title">Card Title</h3>
  <p>Card content goes here.</p>
</div>
```

**Card with Header:**
```html
<div class="card">
  <div class="card__header">
    <h3 class="card__title">Project Alpha</h3>
    <p class="card__subtitle">Last updated 2 hours ago</p>
  </div>
  <p>Project details and description...</p>
</div>
```

**Card with Footer:**
```html
<div class="card">
  <p>Card content...</p>
  <div class="card__footer">
    <button class="button button--primary">View Details</button>
  </div>
</div>
```

**Elevated Card:**
```html
<div class="card card--elevated">
  <p>This card has a permanent elevation shadow.</p>
</div>
```

### Badges

```html
<span class="badge badge--primary">Primary</span>
<span class="badge badge--success">Success</span>
<span class="badge badge--warning">Warning</span>
<span class="badge badge--error">Error</span>
<span class="badge badge--neutral">Neutral</span>
```

### Alerts

```html
<div class="alert alert--success">
  <h4 class="alert__title">Success!</h4>
  Your changes have been saved.
</div>

<div class="alert alert--warning">
  <h4 class="alert__title">Warning</h4>
  This action cannot be undone.
</div>

<div class="alert alert--error">
  <h4 class="alert__title">Error</h4>
  Failed to process request.
</div>

<div class="alert alert--info">
  <h4 class="alert__title">Information</h4>
  New features are now available.
</div>
```

### Loading States

**Spinner:**
```html
<span class="spinner"></span>
<span class="spinner spinner--sm"></span>
<span class="spinner spinner--lg"></span>
```

**Progress Bar:**
```html
<div class="progress">
  <div class="progress__bar" style="width: 60%;"></div>
</div>
```

### Navigation

```html
<nav class="nav">
  <a href="#" class="nav__brand">Brand</a>
  <ul class="nav__menu">
    <li class="nav__item">
      <a href="#" class="nav__link nav__link--active">Dashboard</a>
    </li>
    <li class="nav__item">
      <a href="#" class="nav__link">Projects</a>
    </li>
    <li class="nav__item">
      <a href="#" class="nav__link">Settings</a>
    </li>
  </ul>
</nav>
```

### Containers

```html
<div class="container">
  Standard width content (max 1280px)
</div>

<div class="container container--narrow">
  Narrow content (max 768px) - ideal for prose
</div>

<div class="container container--wide">
  Wide content (max 1536px) - ideal for dashboards
</div>
```

## Utility Classes

```html
<!-- Layout -->
<div class="flex items-center justify-between gap-4">
  <span>Left</span>
  <span>Right</span>
</div>

<div class="flex flex-col gap-2">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

<!-- Spacing -->
<div class="mt-4 mb-4">Margin top and bottom</div>
<div class="p-4">Padding all sides</div>

<!-- Text -->
<p class="text-center">Centered text</p>
<p class="font-bold">Bold text</p>
<p class="text-secondary">Secondary color text</p>

<!-- Borders -->
<div class="rounded">Rounded corners</div>

<!-- Shadows -->
<div class="shadow">Drop shadow</div>
```

## Dark Mode

The design system supports both automatic and manual dark mode.

**Automatic (respects system preference):**
```html
<!-- Works out of the box -->
<body>
  <p>Text automatically adjusts to dark mode</p>
</body>
```

**Manual (explicit theme):**
```html
<body data-theme="dark">
  <p>Force dark mode</p>
</body>

<body data-theme="light">
  <p>Force light mode</p>
</body>
```

## Customization

Override tokens in your own CSS:

```css
:root {
  /* Change primary color */
  --color-primary-500: #8b5cf6; /* Purple instead of blue */

  /* Adjust spacing scale */
  --space-base: 8px; /* 8px base instead of 4px */

  /* Custom font */
  --font-sans: 'Inter', system-ui, sans-serif;
}
```

## Component Composition

Build complex interfaces by composing primitives:

```html
<!-- Dashboard Card -->
<div class="card">
  <div class="card__header">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="card__title">Active Missions</h3>
        <p class="card__subtitle">12 in progress</p>
      </div>
      <span class="badge badge--success">Live</span>
    </div>
  </div>

  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <span>Mission Alpha</span>
      <div class="progress" style="width: 200px;">
        <div class="progress__bar" style="width: 75%;"></div>
      </div>
    </div>

    <div class="flex items-center justify-between">
      <span>Mission Beta</span>
      <div class="progress" style="width: 200px;">
        <div class="progress__bar" style="width: 40%;"></div>
      </div>
    </div>
  </div>

  <div class="card__footer">
    <button class="button button--outline button--sm">View All</button>
  </div>
</div>
```

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+

Requires support for CSS custom properties and modern CSS features.

## File Structure

```
static/design-system/
├── design-tokens.css    # Design tokens (colors, spacing, etc.)
├── components.css       # Component library
├── README.md           # This file
└── examples.html       # Live examples (coming next)
```

## Best Practices

1. **Use semantic tokens** - Prefer `--text-primary` over `--color-gray-900`
2. **Compose, don't customize** - Build with existing components before creating new ones
3. **Mobile-first** - All components are responsive by default
4. **Accessibility** - Use semantic HTML, proper labels, and ARIA when needed
5. **Token-based spacing** - Use spacing tokens (`--space-4`) instead of arbitrary values

## Integration with Sovereign Laboratory OS

This design system is built to integrate seamlessly with the SL-OS frontend:

```jsx
// React component example
export function MissionCard({ mission }) {
  return (
    <div className="card">
      <div className="card__header">
        <h3 className="card__title">{mission.name}</h3>
        <span className={`badge badge--${mission.status}`}>
          {mission.status}
        </span>
      </div>
      <p className="body-base">{mission.description}</p>
      <div className="card__footer">
        <button className="button button--primary">
          Launch Mission
        </button>
      </div>
    </div>
  );
}
```

## Next Steps

- [ ] Create `examples.html` with live component demonstrations
- [ ] Build theme switcher component
- [ ] Add animation utilities
- [ ] Create data visualization components (charts, graphs)
- [ ] Add form validation styling patterns
- [ ] Build complex layout templates

---

**Version:** 1.0.0
**Last Updated:** 2026-01-07
**Maintainer:** Sovereign Laboratory OS Team
