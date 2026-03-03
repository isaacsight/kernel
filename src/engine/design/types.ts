// ─── Design Engine Types ─────────────────────────────────────
//
// Type definitions for the Design Engine — AI-powered component
// generation, layout design, accessibility auditing, and theme creation.

export interface DesignSpec {
  id: string
  name: string
  components: ComponentSpec[]
  layout: Layout
  theme: Theme
  accessibility: AccessibilityReport
}

export interface ComponentSpec {
  name: string
  description: string
  html: string
  css: string
  props: { name: string; type: string; description: string }[]
  variants: string[]
}

export interface Layout {
  type: 'grid' | 'flex' | 'stack' | 'sidebar' | 'dashboard' | 'landing'
  breakpoints: { mobile: string; tablet: string; desktop: string }
  regions: { name: string; purpose: string; gridArea?: string }[]
}

export interface Theme {
  colors: Record<string, string>
  typography: { fontFamily: string; sizes: Record<string, string> }
  spacing: Record<string, string>
  radii: Record<string, string>
  shadows: Record<string, string>
}

export interface AccessibilityReport {
  score: number  // 0-100
  issues: AccessibilityIssue[]
  recommendations: string[]
}

export interface AccessibilityIssue {
  severity: 'critical' | 'major' | 'minor'
  element: string
  issue: string
  fix: string
  wcag: string  // WCAG guideline reference
}
