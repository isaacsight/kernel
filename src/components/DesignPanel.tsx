// ─── DesignPanel ─────────────────────────────────────────────
//
// Bottom-sheet panel for the Design Engine. Provides AI-powered
// component generation, layout design, accessibility auditing,
// design system enforcement, and theme editing.

import { useState } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { SPRING } from '../constants/motion'
import {
  IconClose,
  IconCode,
  IconEye,
  IconShield,
  IconSparkles,
} from './KernelIcons'
import type {
  ComponentSpec,
  Layout,
  AccessibilityReport,
  Theme,
} from '../engine/design/types'

interface DesignPanelProps {
  onClose: () => void
  onGenerateComponent: (description: string) => Promise<ComponentSpec>
  onDesignLayout: (requirements: string) => Promise<Layout>
  onAuditAccessibility: (html: string) => Promise<AccessibilityReport>
  onEnforceDesignSystem: (css: string) => Promise<{ violations: string[]; suggestions: string[] }>
  onGenerateTheme: (description: string) => Promise<Theme>
}

type Tab = 'component' | 'layout' | 'accessibility' | 'theme'

export function DesignPanel({
  onClose,
  onGenerateComponent,
  onDesignLayout,
  onAuditAccessibility,
  onEnforceDesignSystem,
  onGenerateTheme,
}: DesignPanelProps) {
  const dragControls = useDragControls()
  const [activeTab, setActiveTab] = useState<Tab>('component')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Component tab state
  const [componentInput, setComponentInput] = useState('')
  const [componentResult, setComponentResult] = useState<ComponentSpec | null>(null)

  // Layout tab state
  const [layoutInput, setLayoutInput] = useState('')
  const [layoutResult, setLayoutResult] = useState<Layout | null>(null)

  // Accessibility tab state
  const [a11yInput, setA11yInput] = useState('')
  const [a11yResult, setA11yResult] = useState<AccessibilityReport | null>(null)
  const [cssInput, setCssInput] = useState('')
  const [cssResult, setCssResult] = useState<{ violations: string[]; suggestions: string[] } | null>(null)

  // Theme tab state
  const [themeInput, setThemeInput] = useState('')
  const [themeResult, setThemeResult] = useState<Theme | null>(null)

  const handleAction = async (action: () => Promise<void>) => {
    setLoading(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      className="ka-design-panel"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={SPRING}
      drag="y"
      dragControls={dragControls}
      dragConstraints={{ top: 0 }}
      dragElastic={0.1}
      onDragEnd={(_, info) => {
        if (info.offset.y > 100) onClose()
      }}
    >
      {/* Drag handle */}
      <div className="ka-design-handle" onPointerDown={(e) => dragControls.start(e)}>
        <div className="ka-design-handle-bar" />
      </div>

      {/* Header */}
      <div className="ka-design-header">
        <h3 className="ka-design-title">
          <IconSparkles size={16} aria-hidden="true" />
          Design Engine
        </h3>
        <button className="ka-panel-close" onClick={onClose} aria-label="Close design panel">
          <IconClose size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="ka-design-tabs">
        {([
          { id: 'component' as Tab, label: 'Components', icon: <IconCode size={14} aria-hidden="true" /> },
          { id: 'layout' as Tab, label: 'Layout', icon: <IconEye size={14} aria-hidden="true" /> },
          { id: 'accessibility' as Tab, label: 'Accessibility', icon: <IconShield size={14} aria-hidden="true" /> },
          { id: 'theme' as Tab, label: 'Theme', icon: <IconSparkles size={14} aria-hidden="true" /> },
        ]).map(tab => (
          <button
            key={tab.id}
            className={`ka-design-tab${activeTab === tab.id ? ' ka-design-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="ka-design-error">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="ka-design-content">
        {activeTab === 'component' && (
          <ComponentTab
            input={componentInput}
            onInputChange={setComponentInput}
            result={componentResult}
            loading={loading}
            onGenerate={() => handleAction(async () => {
              const result = await onGenerateComponent(componentInput)
              setComponentResult(result)
            })}
          />
        )}

        {activeTab === 'layout' && (
          <LayoutTab
            input={layoutInput}
            onInputChange={setLayoutInput}
            result={layoutResult}
            loading={loading}
            onGenerate={() => handleAction(async () => {
              const result = await onDesignLayout(layoutInput)
              setLayoutResult(result)
            })}
          />
        )}

        {activeTab === 'accessibility' && (
          <AccessibilityTab
            htmlInput={a11yInput}
            onHtmlInputChange={setA11yInput}
            a11yResult={a11yResult}
            cssInput={cssInput}
            onCssInputChange={setCssInput}
            cssResult={cssResult}
            loading={loading}
            onAudit={() => handleAction(async () => {
              const result = await onAuditAccessibility(a11yInput)
              setA11yResult(result)
            })}
            onEnforce={() => handleAction(async () => {
              const result = await onEnforceDesignSystem(cssInput)
              setCssResult(result)
            })}
          />
        )}

        {activeTab === 'theme' && (
          <ThemeTab
            input={themeInput}
            onInputChange={setThemeInput}
            result={themeResult}
            loading={loading}
            onGenerate={() => handleAction(async () => {
              const result = await onGenerateTheme(themeInput)
              setThemeResult(result)
            })}
          />
        )}
      </div>
    </motion.div>
  )
}

// ─── Component Tab ───────────────────────────────────────

function ComponentTab({
  input,
  onInputChange,
  result,
  loading,
  onGenerate,
}: {
  input: string
  onInputChange: (v: string) => void
  result: ComponentSpec | null
  loading: boolean
  onGenerate: () => void
}) {
  return (
    <div className="ka-design-section">
      <label className="ka-design-label" htmlFor="design-component-input">
        Describe the component you want to generate
      </label>
      <textarea
        id="design-component-input"
        className="ka-design-textarea"
        value={input}
        onChange={e => onInputChange(e.target.value)}
        placeholder="e.g., A card component with an image, title, description, and action button..."
        rows={3}
      />
      <button
        className="ka-design-btn"
        onClick={onGenerate}
        disabled={loading || !input.trim()}
      >
        {loading ? 'Generating...' : 'Generate Component'}
      </button>

      {result && (
        <div className="ka-design-result">
          <div className="ka-design-result-header">
            <h4 className="ka-design-result-name">{result.name}</h4>
            <span className="ka-design-result-desc">{result.description}</span>
          </div>

          {result.props.length > 0 && (
            <div className="ka-design-props">
              <h5 className="ka-design-sub-heading">Props</h5>
              {result.props.map((prop, i) => (
                <div key={i} className="ka-design-prop">
                  <code className="ka-design-prop-name">{prop.name}</code>
                  <span className="ka-design-prop-type">{prop.type}</span>
                  <span className="ka-design-prop-desc">{prop.description}</span>
                </div>
              ))}
            </div>
          )}

          {result.variants.length > 0 && (
            <div className="ka-design-variants">
              <h5 className="ka-design-sub-heading">Variants</h5>
              <div className="ka-design-variant-list">
                {result.variants.map((v, i) => (
                  <span key={i} className="ka-design-variant-pill">{v}</span>
                ))}
              </div>
            </div>
          )}

          <div className="ka-design-code-block">
            <h5 className="ka-design-sub-heading">HTML</h5>
            <pre className="ka-design-code"><code>{result.html}</code></pre>
          </div>

          <div className="ka-design-code-block">
            <h5 className="ka-design-sub-heading">CSS</h5>
            <pre className="ka-design-code"><code>{result.css}</code></pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Layout Tab ──────────────────────────────────────────

function LayoutTab({
  input,
  onInputChange,
  result,
  loading,
  onGenerate,
}: {
  input: string
  onInputChange: (v: string) => void
  result: Layout | null
  loading: boolean
  onGenerate: () => void
}) {
  return (
    <div className="ka-design-section">
      <label className="ka-design-label" htmlFor="design-layout-input">
        Describe the layout you need
      </label>
      <textarea
        id="design-layout-input"
        className="ka-design-textarea"
        value={input}
        onChange={e => onInputChange(e.target.value)}
        placeholder="e.g., A dashboard with a sidebar, header, main content area, and footer..."
        rows={3}
      />
      <button
        className="ka-design-btn"
        onClick={onGenerate}
        disabled={loading || !input.trim()}
      >
        {loading ? 'Designing...' : 'Design Layout'}
      </button>

      {result && (
        <div className="ka-design-result">
          <div className="ka-design-result-header">
            <h4 className="ka-design-result-name">
              {result.type.charAt(0).toUpperCase() + result.type.slice(1)} Layout
            </h4>
          </div>

          <div className="ka-design-layout-breakpoints">
            <h5 className="ka-design-sub-heading">Breakpoints</h5>
            <div className="ka-design-breakpoint-list">
              <div className="ka-design-breakpoint">
                <span className="ka-design-breakpoint-label">Mobile</span>
                <code className="ka-design-breakpoint-value">{result.breakpoints.mobile}</code>
              </div>
              <div className="ka-design-breakpoint">
                <span className="ka-design-breakpoint-label">Tablet</span>
                <code className="ka-design-breakpoint-value">{result.breakpoints.tablet}</code>
              </div>
              <div className="ka-design-breakpoint">
                <span className="ka-design-breakpoint-label">Desktop</span>
                <code className="ka-design-breakpoint-value">{result.breakpoints.desktop}</code>
              </div>
            </div>
          </div>

          <div className="ka-design-regions">
            <h5 className="ka-design-sub-heading">Regions</h5>
            <div className="ka-design-region-grid">
              {result.regions.map((region, i) => (
                <div key={i} className="ka-design-region">
                  <div className="ka-design-region-name">{region.name}</div>
                  <div className="ka-design-region-purpose">{region.purpose}</div>
                  {region.gridArea && (
                    <code className="ka-design-region-area">{region.gridArea}</code>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Accessibility Tab ───────────────────────────────────

function AccessibilityTab({
  htmlInput,
  onHtmlInputChange,
  a11yResult,
  cssInput,
  onCssInputChange,
  cssResult,
  loading,
  onAudit,
  onEnforce,
}: {
  htmlInput: string
  onHtmlInputChange: (v: string) => void
  a11yResult: AccessibilityReport | null
  cssInput: string
  onCssInputChange: (v: string) => void
  cssResult: { violations: string[]; suggestions: string[] } | null
  loading: boolean
  onAudit: () => void
  onEnforce: () => void
}) {
  return (
    <div className="ka-design-section">
      {/* WCAG Audit */}
      <label className="ka-design-label" htmlFor="design-a11y-input">
        Paste HTML to audit for WCAG compliance
      </label>
      <textarea
        id="design-a11y-input"
        className="ka-design-textarea ka-design-textarea--code"
        value={htmlInput}
        onChange={e => onHtmlInputChange(e.target.value)}
        placeholder='<div class="ka-card">...</div>'
        rows={4}
      />
      <button
        className="ka-design-btn"
        onClick={onAudit}
        disabled={loading || !htmlInput.trim()}
      >
        {loading ? 'Auditing...' : 'Audit Accessibility'}
      </button>

      {a11yResult && (
        <div className="ka-design-result">
          <div className="ka-design-a11y-score">
            <div
              className={`ka-design-score-badge ${
                a11yResult.score >= 90 ? 'ka-design-score-badge--pass' :
                a11yResult.score >= 70 ? 'ka-design-score-badge--warn' :
                'ka-design-score-badge--fail'
              }`}
            >
              {a11yResult.score}
            </div>
            <span className="ka-design-score-label">Accessibility Score</span>
          </div>

          {a11yResult.issues.length > 0 && (
            <div className="ka-design-issues">
              <h5 className="ka-design-sub-heading">
                Issues ({a11yResult.issues.length})
              </h5>
              {a11yResult.issues.map((issue, i) => (
                <div key={i} className={`ka-design-issue ka-design-issue--${issue.severity}`}>
                  <div className="ka-design-issue-header">
                    <span className="ka-design-issue-severity">{issue.severity}</span>
                    <code className="ka-design-issue-wcag">{issue.wcag}</code>
                  </div>
                  <p className="ka-design-issue-text">{issue.issue}</p>
                  <p className="ka-design-issue-fix">{issue.fix}</p>
                  <code className="ka-design-issue-element">{issue.element}</code>
                </div>
              ))}
            </div>
          )}

          {a11yResult.recommendations.length > 0 && (
            <div className="ka-design-recommendations">
              <h5 className="ka-design-sub-heading">Recommendations</h5>
              <ul className="ka-design-rec-list">
                {a11yResult.recommendations.map((rec, i) => (
                  <li key={i} className="ka-design-rec-item">{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Design system enforcement */}
      <div className="ka-design-divider" />

      <label className="ka-design-label" htmlFor="design-css-input">
        Paste CSS to check against Rubin design tokens
      </label>
      <textarea
        id="design-css-input"
        className="ka-design-textarea ka-design-textarea--code"
        value={cssInput}
        onChange={e => onCssInputChange(e.target.value)}
        placeholder=".my-card { color: #333; font-family: Arial; }"
        rows={4}
      />
      <button
        className="ka-design-btn ka-design-btn--secondary"
        onClick={onEnforce}
        disabled={loading || !cssInput.trim()}
      >
        {loading ? 'Checking...' : 'Enforce Design System'}
      </button>

      {cssResult && (
        <div className="ka-design-result">
          {cssResult.violations.length > 0 && (
            <div className="ka-design-violations">
              <h5 className="ka-design-sub-heading">
                Violations ({cssResult.violations.length})
              </h5>
              {cssResult.violations.map((v, i) => (
                <div key={i} className="ka-design-violation">{v}</div>
              ))}
            </div>
          )}

          {cssResult.suggestions.length > 0 && (
            <div className="ka-design-suggestions">
              <h5 className="ka-design-sub-heading">Suggestions</h5>
              {cssResult.suggestions.map((s, i) => (
                <div key={i} className="ka-design-suggestion">{s}</div>
              ))}
            </div>
          )}

          {cssResult.violations.length === 0 && cssResult.suggestions.length === 0 && (
            <p className="ka-design-pass">All clear — CSS follows Rubin design tokens.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Theme Tab ───────────────────────────────────────────

function ThemeTab({
  input,
  onInputChange,
  result,
  loading,
  onGenerate,
}: {
  input: string
  onInputChange: (v: string) => void
  result: Theme | null
  loading: boolean
  onGenerate: () => void
}) {
  return (
    <div className="ka-design-section">
      <label className="ka-design-label" htmlFor="design-theme-input">
        Describe the theme you want
      </label>
      <textarea
        id="design-theme-input"
        className="ka-design-textarea"
        value={input}
        onChange={e => onInputChange(e.target.value)}
        placeholder="e.g., A warm, earthy theme with terracotta accents and cream backgrounds..."
        rows={3}
      />
      <button
        className="ka-design-btn"
        onClick={onGenerate}
        disabled={loading || !input.trim()}
      >
        {loading ? 'Generating...' : 'Generate Theme'}
      </button>

      {result && (
        <div className="ka-design-result">
          {/* Color swatches */}
          <div className="ka-design-theme-section">
            <h5 className="ka-design-sub-heading">Colors</h5>
            <div className="ka-design-swatch-grid">
              {Object.entries(result.colors).map(([name, value]) => (
                <div key={name} className="ka-design-swatch">
                  <div
                    className="ka-design-swatch-color"
                    style={{ background: value }}
                  />
                  <span className="ka-design-swatch-name">{name}</span>
                  <code className="ka-design-swatch-value">{value}</code>
                </div>
              ))}
            </div>
          </div>

          {/* Typography */}
          <div className="ka-design-theme-section">
            <h5 className="ka-design-sub-heading">Typography</h5>
            <div className="ka-design-type-family">
              <span className="ka-design-type-label">Font Family</span>
              <code className="ka-design-type-value">{result.typography.fontFamily}</code>
            </div>
            <div className="ka-design-type-sizes">
              {Object.entries(result.typography.sizes).map(([name, size]) => (
                <div key={name} className="ka-design-type-size">
                  <span className="ka-design-type-label">{name}</span>
                  <span className="ka-design-type-preview" style={{ fontSize: size }}>
                    The quick brown fox
                  </span>
                  <code className="ka-design-type-value">{size}</code>
                </div>
              ))}
            </div>
          </div>

          {/* Spacing */}
          <div className="ka-design-theme-section">
            <h5 className="ka-design-sub-heading">Spacing</h5>
            <div className="ka-design-token-list">
              {Object.entries(result.spacing).map(([name, value]) => (
                <div key={name} className="ka-design-token">
                  <span className="ka-design-token-name">{name}</span>
                  <div className="ka-design-token-visual">
                    <div className="ka-design-token-bar" style={{ width: value }} />
                  </div>
                  <code className="ka-design-token-value">{value}</code>
                </div>
              ))}
            </div>
          </div>

          {/* Radii */}
          <div className="ka-design-theme-section">
            <h5 className="ka-design-sub-heading">Border Radii</h5>
            <div className="ka-design-radii-grid">
              {Object.entries(result.radii).map(([name, value]) => (
                <div key={name} className="ka-design-radius">
                  <div className="ka-design-radius-preview" style={{ borderRadius: value }} />
                  <span className="ka-design-radius-name">{name}</span>
                  <code className="ka-design-radius-value">{value}</code>
                </div>
              ))}
            </div>
          </div>

          {/* Shadows */}
          <div className="ka-design-theme-section">
            <h5 className="ka-design-sub-heading">Shadows</h5>
            <div className="ka-design-shadow-grid">
              {Object.entries(result.shadows).map(([name, value]) => (
                <div key={name} className="ka-design-shadow">
                  <div className="ka-design-shadow-preview" style={{ boxShadow: value }} />
                  <span className="ka-design-shadow-name">{name}</span>
                  <code className="ka-design-shadow-value">{value}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
