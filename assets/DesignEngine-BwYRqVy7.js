import{claudeJSON as s}from"./ClaudeClient-hQNXv1hq.js";import"./index-DqDyDUAi.js";import"./vendor-i18n-DBJnNzII.js";import"./vendor-react-C1MACuvJ.js";import"./vendor-ui-BpP1nP3I.js";import"./vendor-supabase-yKjPlrCh.js";const a=`You are a design system expert working with the Rubin Design System.

Key tokens:
- Fonts: "EB Garamond" (serif/prose), "Courier Prime" (monospace/meta)
- Colors: Ivory #FAF9F6 (bg), Slate #1F1E1D (text), Amethyst #6B5B95 (primary)
- Spacing: --space-xs (4px), --space-sm (8px), --space-md (16px), --space-lg (24px), --space-xl (32px), --space-2xl (48px)
- Radii: --radius-xs (3px), --radius-sm (6px), --radius-md (10px), --radius-lg (20px), --radius-full (9999px)
- Shadows: subtle box-shadows with rgba(0,0,0,0.08-0.12) values
- Prefix: all CSS classes use "ka-" prefix
- No Tailwind. Vanilla CSS with custom properties.
- iOS-optimized PWA. Touch-first, contemplative, literary-minimalist aesthetic.`;async function m(e){const t=`${a}

Generate a React component based on this description:
"${e}"

Return a JSON object with this exact structure:
{
  "name": "ComponentName",
  "description": "What this component does",
  "html": "<div class='ka-...'> ... </div>",
  "css": ".ka-... { ... }",
  "props": [{ "name": "propName", "type": "string", "description": "What it does" }],
  "variants": ["default", "compact"]
}

Rules:
- Use semantic HTML elements (section, article, nav, button, etc.)
- All class names must use the "ka-" prefix
- CSS must use Rubin design tokens (custom properties) where possible
- Include responsive styles with @media (max-width: 768px) where relevant
- HTML should be self-contained and renderable
- Include at least one variant name`;return s(t,{model:"sonnet",system:"You are a frontend component architect. Return only valid JSON.",max_tokens:4096})}async function c(e){const t=`${a}

Design a responsive layout based on these requirements:
"${e}"

Return a JSON object with this exact structure:
{
  "type": "grid" | "flex" | "stack" | "sidebar" | "dashboard" | "landing",
  "breakpoints": {
    "mobile": "max-width: 480px",
    "tablet": "max-width: 768px",
    "desktop": "min-width: 769px"
  },
  "regions": [
    { "name": "header", "purpose": "Top navigation bar", "gridArea": "header" },
    { "name": "main", "purpose": "Primary content area", "gridArea": "main" }
  ]
}

Rules:
- Choose the most appropriate layout type for the requirements
- Include at least 2 regions
- For grid layouts, include gridArea values
- Breakpoints should cover mobile, tablet, and desktop
- Follow mobile-first, touch-first principles`;return s(t,{model:"sonnet",system:"You are a layout architect. Return only valid JSON.",max_tokens:2048})}async function p(e){const t=`${a}

Audit the following CSS for Rubin design system compliance:

\`\`\`css
${e}
\`\`\`

Check for:
1. Hardcoded colors instead of Rubin custom properties (--rubin-*)
2. Hardcoded font families instead of --font-serif / --font-mono
3. Hardcoded spacing instead of --space-* tokens
4. Hardcoded border-radius instead of --radius-* tokens
5. Missing "ka-" prefix on class names
6. Missing dark mode support via [data-theme="dark"]
7. Non-standard z-index values
8. Hardcoded px values that should use tokens

Return a JSON object:
{
  "violations": ["Hardcoded color #333 on line 3 — use var(--rubin-slate)"],
  "suggestions": ["Add [data-theme='dark'] variant for .ka-card"]
}`;return s(t,{model:"haiku",system:"You are a CSS design system auditor. Return only valid JSON.",max_tokens:2048})}async function u(e){const t=`${a}

Perform a WCAG 2.1 AA accessibility audit on the following HTML:

\`\`\`html
${e}
\`\`\`

Check for:
1. Missing alt text on images
2. Missing ARIA labels on interactive elements
3. Insufficient color contrast
4. Missing heading hierarchy
5. Missing form labels
6. Keyboard navigation issues
7. Focus management problems
8. Missing landmark roles

Return a JSON object:
{
  "score": 85,
  "issues": [
    {
      "severity": "critical" | "major" | "minor",
      "element": "<img src='...' />",
      "issue": "Image missing alt attribute",
      "fix": "Add alt='descriptive text' to the image",
      "wcag": "1.1.1 Non-text Content"
    }
  ],
  "recommendations": ["Add skip-to-content link at the top of the page"]
}

Score guidelines:
- 100: No issues found
- 90-99: Minor issues only
- 70-89: Some major issues
- 50-69: Critical issues present
- Below 50: Severe accessibility problems`;return s(t,{model:"sonnet",system:"You are a WCAG accessibility auditor. Return only valid JSON.",max_tokens:4096})}async function x(e){const t=`${a}

Generate a theme based on this description:
"${e}"

The theme should be compatible with the Rubin design system's existing token structure.

Return a JSON object:
{
  "colors": {
    "primary": "#6B5B95",
    "secondary": "#5B8BA0",
    "background": "#FAF9F6",
    "surface": "#F0EEE6",
    "text": "#1F1E1D",
    "textMuted": "#6B6966",
    "border": "rgba(0, 0, 0, 0.08)",
    "accent": "#8B7355",
    "error": "#DC2626",
    "success": "#22C55E"
  },
  "typography": {
    "fontFamily": "'EB Garamond', serif",
    "sizes": {
      "xs": "0.75rem",
      "sm": "0.875rem",
      "base": "1rem",
      "lg": "1.15rem",
      "xl": "1.35rem",
      "2xl": "1.75rem",
      "3xl": "2.25rem"
    }
  },
  "spacing": {
    "xs": "4px",
    "sm": "8px",
    "md": "16px",
    "lg": "24px",
    "xl": "32px",
    "2xl": "48px"
  },
  "radii": {
    "xs": "3px",
    "sm": "6px",
    "md": "10px",
    "lg": "20px",
    "full": "9999px"
  },
  "shadows": {
    "sm": "0 1px 3px rgba(0,0,0,0.06)",
    "md": "0 2px 8px rgba(0,0,0,0.08)",
    "lg": "0 4px 16px rgba(0,0,0,0.10)",
    "xl": "0 8px 32px rgba(0,0,0,0.12)"
  }
}

Rules:
- Colors must have good contrast ratios (4.5:1 for text, 3:1 for large text)
- Maintain the literary-minimalist aesthetic
- Keep the contemplative, ivory-based feel unless explicitly asked otherwise
- Include at least 8 color entries, 5 size entries, 4 spacing entries`;return s(t,{model:"sonnet",system:"You are a design system theme architect. Return only valid JSON.",max_tokens:2048})}export{u as auditAccessibility,c as designLayout,p as enforceDesignSystem,m as generateComponent,x as generateTheme};
