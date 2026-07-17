import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { ISSUE } from '../content/issue'
import { MagazineFrame } from '../components/MagazineFrame'
import './PrototypePage.css'

interface CanvasNode {
  id: string
  kind: 'kicker' | 'headline' | 'deck' | 'body'
  title: string
  content: string
  x: number
  y: number
}

interface CanvasEdge {
  id: string
  from: string
  to: string
}

interface SynthesisState {
  selectedAgent?: string
  nodes?: CanvasNode[]
  edges?: CanvasEdge[]
  asymmetry?: number
  stock?: 'ivory' | 'cream' | 'ledger' | 'ink'
  spotRatio?: number
  serifBias?: number
  lastUpdated?: number
}

const INITIAL_NODES: CanvasNode[] = [
  {
    id: 'kicker',
    kind: 'kicker',
    title: 'Kicker · 目次',
    content: 'ISSUE SPEC · 創刊号仕様',
    x: 40,
    y: 50
  },
  {
    id: 'headline',
    kind: 'headline',
    title: 'Headline · 見出し',
    content: 'Aesthetics of Stillness.',
    x: 40,
    y: 200
  },
  {
    id: 'deck',
    kind: 'deck',
    title: 'Deck · 小見出し',
    content: 'Exploring the boundary between structural rigor and visual composure.',
    x: 270,
    y: 200
  },
  {
    id: 'body',
    kind: 'body',
    title: 'Body · 段落',
    content: 'The paper stock must absorb the ink cleanly. We avoid the neon flashes of high-frequency layouts. The spot color is a tomato block, designed to anchor the reader\'s eye before they begin to read.',
    x: 270,
    y: 350
  }
]

const INITIAL_EDGES: CanvasEdge[] = [
  { id: 'e1', from: 'kicker', to: 'headline' },
  { id: 'e2', from: 'headline', to: 'deck' },
  { id: 'e3', from: 'deck', to: 'body' }
]

export function PrototypePage() {
  // Canvas State
  const [nodes, setNodes] = useState<CanvasNode[]>(INITIAL_NODES)
  const [edges, setEdges] = useState<CanvasEdge[]>(INITIAL_EDGES)
  const [selectedNodeId, setSelectedNodeId] = useState<string>('headline')

  // Global Design Dials
  const [asymmetry, setAsymmetry] = useState<number>(30)
  const [stock, setStock] = useState<'ivory' | 'cream' | 'ledger' | 'ink'>('ivory')
  const [spotRatio, setSpotRatio] = useState<number>(75)
  const [serifBias, setSerifBias] = useState<number>(85)

  // Dragging states
  const dragRef = useRef<{ active: boolean; nodeRef: string | null; startX: number; startY: number }>({
    active: false,
    nodeRef: null,
    startX: 0,
    startY: 0
  })

  // File poll tracking
  const lastUpdatedRef = useRef<number>(0)

  // Polling loop for agent control
  useEffect(() => {
    const pollState = async () => {
      try {
        const res = await fetch(`/synthesis-state.json?t=${Date.now()}`)
        if (!res.ok) return
        const data = await res.json() as SynthesisState
        
        if (data.lastUpdated && data.lastUpdated > lastUpdatedRef.current) {
          lastUpdatedRef.current = data.lastUpdated
          
          if (data.nodes) setNodes(data.nodes)
          if (data.edges) setEdges(data.edges)
          if (data.asymmetry !== undefined) setAsymmetry(data.asymmetry)
          if (data.stock) setStock(data.stock)
          if (data.spotRatio !== undefined) setSpotRatio(data.spotRatio)
          if (data.serifBias !== undefined) setSerifBias(data.serifBias)
        }
      } catch (err) {
        // Ignore fetch errors during local dev/HMR transitions
      }
    }

    const interval = setInterval(pollState, 2500)
    return () => clearInterval(interval)
  }, [])

  // Draggable Node logic
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, nodeId: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    // Pointer offset inside node
    dragRef.current = {
      active: true,
      nodeRef: nodeId,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top
    }
    setSelectedNodeId(nodeId)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || !dragRef.current.nodeRef) return
    
    const container = e.currentTarget.parentElement?.getBoundingClientRect()
    if (!container) return

    // Calculate position relative to container
    const x = Math.max(10, Math.min(container.width - 190, e.clientX - container.left - dragRef.current.startX))
    const y = Math.max(10, Math.min(container.height - 95, e.clientY - container.top - dragRef.current.startY))

    setNodes(prev => prev.map(node => {
      if (node.id === dragRef.current.nodeRef) {
        return { ...node, x: Math.round(x), y: Math.round(y) }
      }
      return node
    }))
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false
    dragRef.current.nodeRef = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const resetCanvas = () => {
    setNodes(INITIAL_NODES)
    setEdges(INITIAL_EDGES)
    setSelectedNodeId('headline')
    setAsymmetry(30)
    setStock('ivory')
    setSpotRatio(75)
    setSerifBias(85)
  }

  // Calculate coordinates for connection lines
  // Nodes are 180px wide and 85px tall (approx center is x + 90, y + 42.5)
  const drawPaths = useMemo(() => {
    return edges.map(edge => {
      const fromNode = nodes.find(n => n.id === edge.from)
      const toNode = nodes.find(n => n.id === edge.to)
      if (!fromNode || !toNode) return null

      const x1 = fromNode.x + 90
      const y1 = fromNode.y + 42.5
      const x2 = toNode.x + 90
      const y2 = toNode.y + 42.5

      // Smooth bezier curves
      const dx = Math.abs(x2 - x1) * 0.5
      const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
      const isActive = selectedNodeId === edge.from || selectedNodeId === edge.to

      return (
        <path
          key={edge.id}
          d={pathD}
          className={`pop-proto-canvas-edge ${isActive ? 'is-active' : ''}`}
        />
      )
    })
  }, [edges, nodes, selectedNodeId])

  // Extract selected node content
  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) ?? nodes[0], [nodes, selectedNodeId])

  const updateSelectedNodeContent = (content: string) => {
    setNodes(prev => prev.map(node => {
      if (node.id === selectedNodeId) {
        return { ...node, content }
      }
      return node
    }))
  }

  // Pre-compiled styles for layout preview
  const previewStyles = {
    '--preview-spot-color': `rgba(226, 78, 27, ${spotRatio / 100})`,
    '--preview-font-family': serifBias > 50 ? 'var(--font-serif)' : 'var(--font-mono)'
  } as React.CSSProperties

  const activeKicker = nodes.find(n => n.id === 'kicker')?.content ?? ''
  const activeHeadline = nodes.find(n => n.id === 'headline')?.content ?? ''
  const activeDeck = nodes.find(n => n.id === 'deck')?.content ?? ''
  const activeBody = nodes.find(n => n.id === 'body')?.content ?? ''

  return (
    <MagazineFrame
      kicker="PROTOTYPE · 試作"
      title="UI Drafting Press Canvas"
      titleJp="UI製図機と印刷プレスのキャンバス"
      deck="Configure layout composition flows visually with node grids while calibrating design stocks, typographic weight, and spot color ratio dials."
      stock="ivory"
    >
      <div className="pop-section-inner">
        <div className="pop-proto-workspace-canvas">
          
          {/* Left Column: Visual Drafting Canvas */}
          <div className="pop-proto-canvas-pane">
            <div className="pop-proto-section-title">
              <span>Drafting Table Canvas</span>
              <span className="jp">製図台キャンバス</span>
            </div>

            <div className="pop-proto-canvas-container">
              <svg className="pop-proto-canvas-svg">
                {drawPaths}
              </svg>

              {nodes.map(node => {
                const isSelected = selectedNodeId === node.id
                return (
                  <div
                    key={node.id}
                    className={`pop-proto-node-card ${isSelected ? 'is-selected' : ''}`}
                    style={{ left: `${node.x}px`, top: `${node.y}px` }}
                    onPointerDown={(e) => handlePointerDown(e, node.id)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  >
                    <div className="pop-proto-node-kicker">{node.kind}</div>
                    <div className="pop-proto-node-title">{node.title}</div>
                    <div className="pop-proto-node-meta">
                      <span>X: {node.x}</span>
                      <span>Y: {node.y}</span>
                    </div>
                  </div>
                )}
              )}
            </div>

            <div className="pop-proto-canvas-controls">
              <button onClick={resetCanvas} className="pop-proto-btn-secondary">
                RESET DESIGN · リセット
              </button>
            </div>
          </div>

          {/* Right Column: Live Preview & Inspector */}
          <div className="pop-proto-inspector-pane">
            <div className="pop-proto-section-title">
              <span>Live Specimen Preview</span>
              <span className="jp">印刷見本プレビュー</span>
            </div>

            {/* Live Render Output */}
            <div
              className={`pop-proto-preview-stage stock-${stock}`}
              style={previewStyles}
            >
              <div className={`pop-proto-preview-element ${asymmetry > 50 ? 'align-left' : 'align-center'}`}>
                {activeKicker && <span className="pop-proto-preview-kicker">{activeKicker}</span>}
                {activeHeadline && <h2 className="pop-proto-preview-title">{activeHeadline}</h2>}
                {activeDeck && <p className="pop-proto-preview-deck">{activeDeck}</p>}
                {activeBody && <p className="pop-proto-preview-body">{activeBody}</p>}
              </div>

              <div className="pop-proto-preview-stamp">
                STILLNESS CONTRACT ★ {ISSUE.month} {ISSUE.year}
              </div>
            </div>

            {/* Inspector Details */}
            <div className="pop-proto-inspector-card">
              <span className="pop-proto-inspector-meta">
                DIALS INSPECTOR · ダイヤル調整: {selectedNode.kind.toUpperCase()} Node
              </span>

              <div className="pop-proto-inspector-dials">
                {/* Node-specific content editor */}
                <div className="pop-proto-dial-row">
                  <div className="pop-proto-dial-meta">
                    <span className="label">Node Content <span className="label-jp">ノード内容</span></span>
                  </div>
                  <textarea
                    rows={3}
                    className="pop-proto-input"
                    value={selectedNode.content}
                    onChange={(e) => updateSelectedNodeContent(e.target.value)}
                  />
                </div>

                <hr className="pop-rule pop-rule--soft" />

                {/* Global Variables */}
                <div className="pop-proto-dial-row">
                  <div className="pop-proto-dial-meta">
                    <span className="label">Paper Stock <span className="label-jp">用紙の選択</span></span>
                    <span className="value" style={{ textTransform: 'uppercase' }}>{stock}</span>
                  </div>
                  <div className="pop-proto-radio-group">
                    {(['ivory', 'cream', 'ledger', 'ink'] as const).map(opt => (
                      <button
                        key={opt}
                        onClick={() => setStock(opt)}
                        className={`pop-proto-radio-btn ${stock === opt ? 'is-active' : ''}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pop-proto-dial-row">
                  <div className="pop-proto-dial-meta">
                    <span className="label">Asymmetry Shift <span className="label-jp">非対称グリッド</span></span>
                    <span className="value">{asymmetry > 50 ? 'Left' : 'Centered'} ({asymmetry}%)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={asymmetry}
                    onChange={(e) => setAsymmetry(parseInt(e.target.value))}
                    className="pop-proto-slider"
                  />
                </div>

                <div className="pop-proto-dial-row">
                  <div className="pop-proto-dial-meta">
                    <span className="label">Typographic Bias <span className="label-jp">書体の選択</span></span>
                    <span className="value">{serifBias > 50 ? 'Serif (Garamond)' : 'Mono (Courier)'} ({serifBias}%)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={serifBias}
                    onChange={(e) => setSerifBias(parseInt(e.target.value))}
                    className="pop-proto-slider"
                  />
                </div>

                <div className="pop-proto-dial-row">
                  <div className="pop-proto-dial-meta">
                    <span className="label">Spot Density <span className="label-jp">色彩の強度</span></span>
                    <span className="value">{spotRatio}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={spotRatio}
                    onChange={(e) => setSpotRatio(parseInt(e.target.value))}
                    className="pop-proto-slider"
                  />
                </div>

              </div>
            </div>

          </div>

        </div>
      </div>
    </MagazineFrame>
  )
}
