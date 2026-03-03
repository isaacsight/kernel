// ─── Architecture Panel ─────────────────────────────────────
//
// Bottom-sheet panel for system design and architecture analysis.
// Tabs: Design (diagrams + components), Dependencies, Code Gen.
// Uses framer-motion drag-to-dismiss bottom-sheet pattern.

import { useState, useCallback } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { SPRING } from '../constants/motion'
import { IconClose, IconCode, IconZap, IconGitBranch, IconPackage, IconGlobe } from './KernelIcons'
import type { SystemDesign, Dependency, CodeGenResult, InfrastructurePlan } from '../engine/architecture/types'
import {
  analyzeCodebase,
  designSystem,
  generateCode,
  planInfrastructure,
} from '../engine/ArchitectureEngine'

// ─── Types ──────────────────────────────────────────────────

interface ArchitecturePanelProps {
  onClose: () => void
  onToast: (msg: string) => void
}

type ActiveTab = 'design' | 'dependencies' | 'codegen' | 'infra'

const COMPONENT_TYPE_COLORS: Record<string, string> = {
  service: '#6B5B95',
  database: '#5B8BA0',
  api: '#6B8E6B',
  frontend: '#B8875C',
  worker: '#A0768C',
  queue: '#8B7355',
  cache: '#6B9E6B',
  storage: '#7B6B95',
}

// ─── Component ──────────────────────────────────────────────

export function ArchitecturePanel({ onClose, onToast }: ArchitecturePanelProps) {
  const dragControls = useDragControls()
  const [activeTab, setActiveTab] = useState<ActiveTab>('design')

  // Design state
  const [designInput, setDesignInput] = useState('')
  const [systemDesign, setSystemDesign] = useState<SystemDesign | null>(null)
  const [designing, setDesigning] = useState(false)
  const [designMode, setDesignMode] = useState<'analyze' | 'design'>('design')

  // Code gen state
  const [codeSpec, setCodeSpec] = useState('')
  const [codeLang, setCodeLang] = useState('typescript')
  const [codeResult, setCodeResult] = useState<CodeGenResult | null>(null)
  const [generating, setGenerating] = useState(false)

  // Infra state
  const [infraPlan, setInfraPlan] = useState<InfrastructurePlan | null>(null)
  const [planningInfra, setPlanningInfra] = useState(false)

  // ─── Handlers ─────────────────────────────────────────────

  const handleDesign = useCallback(async () => {
    if (!designInput.trim()) return
    setDesigning(true)
    try {
      const result = designMode === 'analyze'
        ? await analyzeCodebase(designInput)
        : await designSystem(designInput)
      setSystemDesign(result)
      onToast(`System design generated: ${result.name}`)
    } catch (err) {
      onToast(`Design failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDesigning(false)
    }
  }, [designInput, designMode, onToast])

  const handleGenerateCode = useCallback(async () => {
    if (!codeSpec.trim()) return
    setGenerating(true)
    try {
      const result = await generateCode(codeSpec, codeLang)
      setCodeResult(result)
      onToast(`Generated ${result.files.length} file${result.files.length === 1 ? '' : 's'}`)
    } catch (err) {
      onToast(`Code generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setGenerating(false)
    }
  }, [codeSpec, codeLang, onToast])

  const handlePlanInfra = useCallback(async () => {
    if (!systemDesign) {
      onToast('Generate a system design first')
      return
    }
    setPlanningInfra(true)
    try {
      const plan = await planInfrastructure(systemDesign)
      setInfraPlan(plan)
      onToast(`Infrastructure plan ready: ${plan.provider}`)
    } catch (err) {
      onToast(`Planning failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setPlanningInfra(false)
    }
  }, [systemDesign, onToast])

  // ─── Render ───────────────────────────────────────────────

  return (
    <motion.div
      className="ka-arch-panel"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={SPRING.DEFAULT}
      drag="y"
      dragControls={dragControls}
      dragConstraints={{ top: 0 }}
      dragElastic={0.1}
      onDragEnd={(_, info) => {
        if (info.offset.y > 100) onClose()
      }}
    >
      {/* Drag handle */}
      <div className="ka-arch-handle" onPointerDown={(e) => dragControls.start(e)}>
        <div className="ka-arch-handle-bar" />
      </div>

      {/* Header */}
      <div className="ka-arch-header">
        <div className="ka-arch-header-left">
          <IconGitBranch size={18} />
          <h3 className="ka-arch-title">Architecture</h3>
        </div>
        <button className="ka-arch-close" onClick={onClose}>
          <IconClose size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="ka-arch-tabs">
        {([
          { id: 'design' as const, label: 'Design' },
          { id: 'dependencies' as const, label: 'Dependencies' },
          { id: 'codegen' as const, label: 'Code Gen' },
          { id: 'infra' as const, label: 'Infrastructure' },
        ]).map(tab => (
          <button
            key={tab.id}
            className={`ka-arch-tab ${activeTab === tab.id ? 'ka-arch-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="ka-arch-content">

        {/* Design Tab */}
        {activeTab === 'design' && (
          <div className="ka-arch-design">
            {/* Input area */}
            <div className="ka-arch-input-group">
              <div className="ka-arch-mode-toggle">
                <button
                  className={`ka-arch-mode-btn ${designMode === 'design' ? 'ka-arch-mode-btn--active' : ''}`}
                  onClick={() => setDesignMode('design')}
                >
                  <IconZap size={14} /> Design New
                </button>
                <button
                  className={`ka-arch-mode-btn ${designMode === 'analyze' ? 'ka-arch-mode-btn--active' : ''}`}
                  onClick={() => setDesignMode('analyze')}
                >
                  <IconPackage size={14} /> Analyze Existing
                </button>
              </div>
              <textarea
                className="ka-arch-textarea"
                value={designInput}
                onChange={(e) => setDesignInput(e.target.value)}
                placeholder={designMode === 'design'
                  ? 'Describe the system you want to design...\n\ne.g. "A real-time collaborative document editor with version history, user authentication, and real-time cursors"'
                  : 'Describe the existing codebase or system to analyze...\n\ne.g. "React frontend with Express API, PostgreSQL database, Redis cache, and WebSocket server for notifications"'
                }
                rows={4}
              />
              <button
                className="ka-arch-btn ka-arch-btn--primary"
                onClick={handleDesign}
                disabled={designing || !designInput.trim()}
              >
                {designing ? 'Analyzing...' : designMode === 'design' ? 'Design System' : 'Analyze Codebase'}
              </button>
            </div>

            {/* Results */}
            {systemDesign && (
              <div className="ka-arch-results">
                {/* System overview */}
                <div className="ka-arch-section">
                  <h4 className="ka-arch-section-title">{systemDesign.name}</h4>
                  <p className="ka-arch-section-desc">{systemDesign.description}</p>
                </div>

                {/* Diagrams */}
                {systemDesign.diagrams.length > 0 && (
                  <div className="ka-arch-section">
                    <h4 className="ka-arch-section-title">Diagrams</h4>
                    {systemDesign.diagrams.map((diagram, i) => (
                      <div key={i} className="ka-arch-diagram">
                        <div className="ka-arch-diagram-label">
                          {diagram.type.replace('_', ' ')}
                        </div>
                        <pre className="ka-arch-diagram-code">
                          <code>{diagram.mermaid}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                )}

                {/* Components */}
                <div className="ka-arch-section">
                  <h4 className="ka-arch-section-title">
                    Components ({systemDesign.components.length})
                  </h4>
                  <div className="ka-arch-components">
                    {systemDesign.components.map(comp => (
                      <ComponentCard key={comp.id} component={comp} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dependencies Tab */}
        {activeTab === 'dependencies' && (
          <div className="ka-arch-dependencies">
            {!systemDesign ? (
              <div className="ka-arch-empty">
                Generate a system design first to see dependencies.
              </div>
            ) : systemDesign.dependencies.length === 0 ? (
              <div className="ka-arch-empty">No dependencies found.</div>
            ) : (
              <div className="ka-arch-dep-list">
                {systemDesign.dependencies.map((dep, i) => (
                  <DependencyRow key={i} dep={dep} components={systemDesign.components} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Code Gen Tab */}
        {activeTab === 'codegen' && (
          <div className="ka-arch-codegen">
            <div className="ka-arch-input-group">
              <div className="ka-arch-codegen-toolbar">
                <select
                  className="ka-arch-lang-select"
                  value={codeLang}
                  onChange={(e) => setCodeLang(e.target.value)}
                >
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="go">Go</option>
                  <option value="rust">Rust</option>
                  <option value="java">Java</option>
                </select>
              </div>
              <textarea
                className="ka-arch-textarea"
                value={codeSpec}
                onChange={(e) => setCodeSpec(e.target.value)}
                placeholder="Describe the code to generate...\n\ne.g. 'A REST API with CRUD endpoints for a blog platform with posts, comments, and user authentication'"
                rows={4}
              />
              <button
                className="ka-arch-btn ka-arch-btn--primary"
                onClick={handleGenerateCode}
                disabled={generating || !codeSpec.trim()}
              >
                {generating ? 'Generating...' : 'Generate Code'}
              </button>
            </div>

            {codeResult && (
              <div className="ka-arch-results">
                <div className="ka-arch-section">
                  <h4 className="ka-arch-section-title">Summary</h4>
                  <p className="ka-arch-section-desc">{codeResult.summary}</p>
                </div>
                <div className="ka-arch-section">
                  <h4 className="ka-arch-section-title">
                    Files ({codeResult.files.length})
                  </h4>
                  {codeResult.files.map((file, i) => (
                    <div key={i} className="ka-arch-file">
                      <div className="ka-arch-file-header">
                        <IconCode size={14} />
                        <span className="ka-arch-file-path">{file.path}</span>
                        <span className="ka-arch-file-lang">{file.language}</span>
                      </div>
                      <pre className="ka-arch-file-content">
                        <code>{file.content}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Infrastructure Tab */}
        {activeTab === 'infra' && (
          <div className="ka-arch-infra">
            {!systemDesign ? (
              <div className="ka-arch-empty">
                Generate a system design first to plan infrastructure.
              </div>
            ) : (
              <>
                {!infraPlan && (
                  <button
                    className="ka-arch-btn ka-arch-btn--primary"
                    onClick={handlePlanInfra}
                    disabled={planningInfra}
                  >
                    <IconGlobe size={14} />
                    {planningInfra ? 'Planning...' : 'Plan Infrastructure'}
                  </button>
                )}

                {infraPlan && (
                  <div className="ka-arch-results">
                    {/* Provider */}
                    <div className="ka-arch-section">
                      <h4 className="ka-arch-section-title">
                        Provider: {infraPlan.provider}
                      </h4>
                    </div>

                    {/* Services */}
                    <div className="ka-arch-section">
                      <h4 className="ka-arch-section-title">Services</h4>
                      <div className="ka-arch-services">
                        {infraPlan.services.map((svc, i) => (
                          <div key={i} className="ka-arch-service">
                            <div className="ka-arch-service-header">
                              <span className="ka-arch-service-name">{svc.name}</span>
                              <span className="ka-arch-service-cost">{svc.estimated_cost}</span>
                            </div>
                            <div className="ka-arch-service-purpose">{svc.purpose}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Deployment steps */}
                    <div className="ka-arch-section">
                      <h4 className="ka-arch-section-title">Deployment Steps</h4>
                      <ol className="ka-arch-steps">
                        {infraPlan.deployment_steps.map((step, i) => (
                          <li key={i} className="ka-arch-step">{step}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Sub-components ─────────────────────────────────────────

function ComponentCard({ component }: { component: import('../engine/architecture/types').ArchComponent }) {
  const color = COMPONENT_TYPE_COLORS[component.type] || '#6B5B95'

  return (
    <div className="ka-arch-component">
      <div className="ka-arch-component-header">
        <span className="ka-arch-component-dot" style={{ backgroundColor: color }} />
        <span className="ka-arch-component-name">{component.name}</span>
        <span className="ka-arch-component-type" style={{ color }}>{component.type}</span>
      </div>
      <div className="ka-arch-component-desc">{component.description}</div>
      {component.technologies.length > 0 && (
        <div className="ka-arch-component-tech">
          {component.technologies.map((tech, i) => (
            <span key={i} className="ka-arch-tech-pill">{tech}</span>
          ))}
        </div>
      )}
      {component.interfaces.length > 0 && (
        <div className="ka-arch-component-interfaces">
          {component.interfaces.map((iface, i) => (
            <span key={i} className="ka-arch-iface">{iface}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function DependencyRow({
  dep,
  components,
}: {
  dep: Dependency
  components: import('../engine/architecture/types').ArchComponent[]
}) {
  const fromName = components.find(c => c.id === dep.from)?.name || dep.from
  const toName = components.find(c => c.id === dep.to)?.name || dep.to

  const typeColors: Record<string, string> = {
    sync: '#6B5B95',
    async: '#5B8BA0',
    data: '#6B8E6B',
    event: '#B8875C',
  }

  return (
    <div className="ka-arch-dep">
      <div className="ka-arch-dep-flow">
        <span className="ka-arch-dep-from">{fromName}</span>
        <span className="ka-arch-dep-arrow" style={{ color: typeColors[dep.type] || '#888' }}>
          {dep.type === 'async' || dep.type === 'event' ? '- - ->' : '-->'}
        </span>
        <span className="ka-arch-dep-to">{toName}</span>
      </div>
      <div className="ka-arch-dep-meta">
        <span className="ka-arch-dep-type" style={{ color: typeColors[dep.type] || '#888' }}>
          {dep.type}
        </span>
        <span className="ka-arch-dep-desc">{dep.description}</span>
      </div>
    </div>
  )
}
