import { useState, useRef, useEffect, MouseEvent } from 'react'
import { CanvasNode, NodeType, NodeData } from './CanvasNode'
import { CanvasEdge } from './CanvasEdge'
import { registerTool, removeTool, getTool, getToolSchemas } from '../engine/tools'

interface NodeState {
  id: string
  type: NodeType
  x: number
  y: number
  data: NodeData
  isActive: boolean
}

interface EdgeState {
  id: string
  fromNode: string
  toNode: string
}

interface DraggedEdgeState {
  fromNode: string
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface ChatMessage {
  id: string
  role: 'user' | 'agent' | 'system'
  content: string
}

interface CanvasWorkflowBuilderProps {
  onProgress?: (msg: string) => void
  simulationMode: boolean
  setSimulationMode: (val: boolean) => void
}

type CanvasAgentAction =
  | { type: 'add'; tempId?: string; id?: string; nodeType: NodeType; x?: number; y?: number; data?: NodeData }
  | { type: 'update'; id: string; data?: Partial<NodeData>; x?: number; y?: number }
  | { type: 'connect'; from: string; to: string }
  | { type: 'delete'; id: string }
  | { type: 'clear' }

// Fixed sizing for port placement calculations
const NODE_WIDTH = 260
const NODE_HEIGHT = 140

const AVAILABLE_AGENTS = [
  { id: 'researcher', label: 'Researcher Agent' },
  { id: 'coder', label: 'Coder Agent' },
  { id: 'writer', label: 'Writer Agent' },
  { id: 'analyst', label: 'Analyst Agent' },
]

const AVAILABLE_MODELS = [
  { id: 'claude-3-5', label: 'Claude 3.5 Sonnet' },
  { id: 'gemini-2-flash', label: 'Gemini 2.0 Flash' },
  { id: 'flux-pro', label: 'Flux 2.0 Pro' },
  { id: 'kling-video', label: 'Kling Video' },
  { id: 'locate-anything-3b', label: 'LocateAnything-3B (NVIDIA)' },
  { id: 'eagle2-9b', label: 'Eagle2-9B Multimodal (NVIDIA)' },
]

// Mock databases for simulated agent runs
const MOCK_OUTPUTS: Record<string, string> = {
  researcher: `[RESEARCH REPORT · LOCAL DISPATCH]
Found 3 key papers on agentic execution vulnerability:
1. Bainbridge (1983) "Ironies of Automation" - human attention fatigue under highly competent automation.
2. Parasuraman (1997) "Use, Misuse, Disuse, Abuse" - taxonomy of operator reliance failures.
3. Skitka (1999) "Does automation bias decision-making?" - default trust in machine solutions in high-stress.

Recommendation: Always design human-in-the-loop gates at state-fork junctions.`,
  coder: `[CODE SYNTHESIS · 墨版]
Created verification harness in:
- \`src/engine/agent/SecurityAgent.ts\`
Added edge-gate validation matching rule-6 receipts doctrine.
All Playwright regression tests passed (12/12).
No memory leak signatures detected on heap dump.`,
  writer: `[EDITORIAL MANUSCRIPT · cream]
"The machine will run your day beautifully without you; but the look is the only currency you have left."
Drafted folio section for Issue 419. Stated the case for node-graphs over chat areas: spatial layouts mapping data pipelines match the real topology of multi-agent delegation.`,
  analyst: `[ANALYTICAL MEMORANDUM · graphite]
Computed risk metrics for the canvas flow:
- Human attention friction: 88.4% LIFT.
- Average check rate: 1.2 checks/min.
- Decision override frequency: 14% (healthy).
Verdict: Canvas workflows successfully externalize the hidden seams of agent cooperation.`,
}

const normalizeNodes = (rawNodes: any[]): NodeState[] => {
  return (rawNodes || []).map((node) => {
    let type = node.type || node.kind || 'input'
    if (type === 'prompt') type = 'input'
    if (type === 'agent') type = 'specialist'
    
    const data = node.data || {
      value: node.content || node.value || '',
      agentId: node.agent || node.agentId || 'researcher',
      modelId: node.model || node.modelId || 'claude-3-5',
      output: node.output || '',
    }

    return {
      id: node.id || `n-${type}-${Date.now()}`,
      type: type as NodeType,
      x: Number.isFinite(node.x) ? node.x : 100,
      y: Number.isFinite(node.y) ? node.y : 100,
      data,
      isActive: !!node.isActive,
    }
  })
}

const normalizeEdges = (rawEdges: any[]): EdgeState[] => {
  return (rawEdges || []).map((edge) => {
    return {
      id: edge.id || `e-${edge.from || edge.fromNode}-${edge.to || edge.toNode}`,
      fromNode: edge.from || edge.fromNode || '',
      toNode: edge.to || edge.toNode || '',
    }
  })
}

export function CanvasWorkflowBuilder({
  onProgress,
  simulationMode,
  setSimulationMode,
}: CanvasWorkflowBuilderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef<NodeState[]>([])
  const edgesRef = useRef<EdgeState[]>([])
  const runWorkflowRef = useRef<() => Promise<void>>(async () => {})
  
  // Canvas Viewport Pan & Zoom
  const [pan, setPan] = useState({ x: 100, y: 100 })
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0 })

  // Node & Edge States
  const [nodes, setNodes] = useState<NodeState[]>([])
  const [edges, setEdges] = useState<EdgeState[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  // Synchronize state to refs to prevent async stale closure bugs
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])
  
  // Dragging connection state
  const [draggedEdge, setDraggedEdge] = useState<DraggedEdgeState | null>(null)
  
  // Workflow runner state
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [logs, setLogs] = useState<string>('')
  const [remoteRunRequest, setRemoteRunRequest] = useState('')
  const lastExecutedRunRef = useRef('')

  // Chat Sidebar States
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'log'>('chat')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'agent',
      content: 'I am your Canvas Architect agent. I can build, connect, and run workflows for you. Tell me what you want to create.'
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isChatStreaming, setIsChatStreaming] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (sidebarTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, sidebarTab])

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = chatInput.trim()
    if (!trimmed || isChatStreaming) return

    setChatInput('')
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed
    }
    const updatedMessages = [...chatMessages, userMsg]
    setChatMessages(updatedMessages)
    setIsChatStreaming(true)

    // Setup agent reply placeholder
    const agentMsgId = `agent-${Date.now()}`
    setChatMessages(prev => [...prev, {
      id: agentMsgId,
      role: 'agent',
      content: ''
    }])

    let currentAgentMsgId = agentMsgId

    try {
      const { claudeStreamChat } = await import('../engine/ClaudeClient')
      const { getTool, getToolSchemas } = await import('../engine/tools')

      // Prepare conversation history in Anthropic role/content format
      let claudeMessages = updatedMessages.map(m => ({
        role: m.role === 'agent' ? 'assistant' : 'user',
        content: m.content
      }))

      let toolCallsProcessed = 0
      const maxToolCalls = 6

      while (toolCallsProcessed < maxToolCalls) {
        const currentNodes = nodesRef.current
        const currentEdges = edgesRef.current
        const activeTools = getToolSchemas()

        const systemPrompt = `You are a Visual Canvas Designer Agent for the kernel.chat visual workflow editor.
Your goal is to help the user design, build, and run visual node-based workflows in real-time.
You have direct control over the canvas layout through your tools.

CURRENT CANVAS STATE:
- Nodes count: ${currentNodes.length}
- Edges count: ${currentEdges.length}
- Nodes list: ${JSON.stringify(currentNodes.map(n => ({ id: n.id, type: n.type, prompt: n.data.value, output: n.data.output })))}
- Edges list: ${JSON.stringify(currentEdges.map(e => ({ from: e.fromNode, to: e.toNode })))}

AVAILABLE AGENTS FOR SPECIALISTS:
- researcher (Find key automation papers)
- coder (Write verification rules)
- writer (Draft editorial issues)
- analyst (Scoring and optimization)

AVAILABLE MODELS:
- gemini-2.5-pro
- gemini-2.5-flash
- claude-3-5

AVAILABLE ACTIONS:
Use creative_canvas_control to add nodes, move nodes, connect nodes, clear the canvas, or delete nodes.
Use creative_canvas_run to execute the graph simulation and compile outputs.
Use creative_canvas_inspect to query detailed state.

When you modify the canvas or run the graph, explain what you did. Always make sure to connect nodes from input/specialist/model to downstream nodes. Ensure input nodes have actual prompt values.
If you run the graph, report the final compiled results from the output node(s).`

        // Capture local reference for callback closure
        const targetId = currentAgentMsgId
        const streamResult = await claudeStreamChat(
          claudeMessages as any,
          (text: string) => {
            setChatMessages(prev =>
              prev.map(m => m.id === targetId ? { ...m, content: text } : m)
            );
          },
          {
            system: systemPrompt,
            model: 'sonnet',
            max_tokens: 2048,
            tools: activeTools,
            feature: 'canvas_agent'
          }
        )

        // Append Claude's streamed text to history for the next iteration
        claudeMessages.push({
          role: 'assistant',
          content: streamResult.text
        })

        const toolCalls = streamResult.tool_uses
        if (!toolCalls || toolCalls.length === 0) {
          break
        }

        // Process tool calls
        for (const toolCall of toolCalls) {
          const tool = getTool(toolCall.name)
          if (!tool) {
            console.warn(`[CanvasAgent] Tool not found: ${toolCall.name}`)
            continue
          }

          // Add a user-facing system message
          const toolActivity = `Executed: ${toolCall.name}`
          setChatMessages(prev => [
            ...prev,
            {
              id: `sys-${Date.now()}-${Math.random()}`,
              role: 'system',
              content: `⚙️ ${toolActivity}`
            }
          ])

          try {
            const toolResult = await tool.execute(toolCall.input)
            const outputStr = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult)

            claudeMessages.push({
              role: 'user',
              content: `[Tool result for ${toolCall.name}]: ${outputStr.slice(0, 2000)}`
            })
          } catch (err: any) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error'
            claudeMessages.push({
              role: 'user',
              content: `[Tool error for ${toolCall.name}]: ${errMsg}`
            })
          }
          toolCallsProcessed++
        }

        // Setup a new agent reply placeholder ONLY if we are going to loop again
        currentAgentMsgId = `agent-${Date.now()}-${toolCallsProcessed}`
        setChatMessages(prev => [...prev, {
          id: currentAgentMsgId,
          role: 'agent',
          content: ''
        }])
      }
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : 'Failed to reach proxy.'
      setChatMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'agent' && last.content === '') {
          return prev.map(m => m.id === last.id ? { ...m, content: `⚠️ *Error: ${errMsg}*` } : m);
        }
        return [...prev, {
          id: `err-${Date.now()}`,
          role: 'agent',
          content: `⚠️ *Error: ${errMsg}*`
        }];
      });
    } finally {
      setIsChatStreaming(false)
      // Prune trailing empty placeholders
      setChatMessages(prev => prev.filter(m => m.content !== '' || m.role === 'system'));
    }
  }

  // Keep track of the last synced workspace state timestamp to avoid repeated updates
  const lastSyncRef = useRef<string>('')

  // 1. Load from workspace / localStorage on mount (ONLY ONCE)
  useEffect(() => {
    const initialLoad = async () => {
      let workspaceLoaded = false
      try {
        const res = await fetch(`/canvas-state.json?t=${Date.now()}`)
        if (res.ok) {
          const workspaceState = await res.json()
          if (workspaceState.nodes && workspaceState.edges) {
            const normalizedNodes = normalizeNodes(workspaceState.nodes)
            const normalizedEdges = normalizeEdges(workspaceState.edges)
            setNodes(normalizedNodes)
            setEdges(normalizedEdges)
            nodesRef.current = normalizedNodes
            edgesRef.current = normalizedEdges
            lastSyncRef.current = workspaceState.updatedAt || ''
            lastExecutedRunRef.current = workspaceState.runRequestedAt || ''
            workspaceLoaded = true
            // Sync local storage
            localStorage.setItem('ka-canvas-nodes', JSON.stringify(workspaceState.nodes))
            localStorage.setItem('ka-canvas-edges', JSON.stringify(workspaceState.edges))
          }
        }
      } catch (err) {
        console.warn('Workspace canvas-state.json not available, falling back to localStorage.')
      }

      if (!workspaceLoaded) {
        try {
          const savedNodes = localStorage.getItem('ka-canvas-nodes')
          const savedEdges = localStorage.getItem('ka-canvas-edges')
          if (savedNodes) {
            const parsedNodes = JSON.parse(savedNodes)
            setNodes(parsedNodes)
            nodesRef.current = parsedNodes
          } else {
            // Starter template nodes
            const defaultNodes: NodeState[] = [
              {
                id: 'n-input',
                type: 'input',
                x: 50,
                y: 100,
                data: { value: 'Research the history of risk in agentic systems' },
                isActive: false,
              },
              {
                id: 'n-agent',
                type: 'specialist',
                x: 400,
                y: 50,
                data: { agentId: 'researcher', value: 'Find 3 key papers' },
                isActive: false,
              },
              {
                id: 'n-output',
                type: 'output',
                x: 750,
                y: 150,
                data: { output: '' },
                isActive: false,
              },
            ]
            setNodes(defaultNodes)
            nodesRef.current = defaultNodes
          }
          if (savedEdges) {
            const parsedEdges = JSON.parse(savedEdges)
            setEdges(parsedEdges)
            edgesRef.current = parsedEdges
          } else {
            const defaultEdges: EdgeState[] = [
              { id: 'e-1', fromNode: 'n-input', toNode: 'n-agent' },
              { id: 'e-2', fromNode: 'n-agent', toNode: 'n-output' },
            ]
            setEdges(defaultEdges)
            edgesRef.current = defaultEdges
          }
        } catch (e) {
          console.error('Failed to load canvas state:', e)
        }
      }
    }

    initialLoad()
  }, [])

  // 2. Setup Polling Loop (every 2.5s) to allow local agents to drive/control the canvas
  useEffect(() => {
    const interval = setInterval(async () => {
      // Skip updates if user is actively interacting to prevent cursor jump/clobber
      if (isRunning || draggedEdge || selectedNodeId) return

      try {
        const res = await fetch(`/canvas-state.json?t=${Date.now()}`)
        if (res.ok) {
          const workspaceState = await res.json()
          console.log(`[CANVAS POLL] fetched. File updatedAt:`, workspaceState.updatedAt, `lastSyncRef.current:`, lastSyncRef.current)
          if (
            workspaceState.nodes &&
            workspaceState.edges &&
            workspaceState.updatedAt !== lastSyncRef.current
          ) {
            console.log(`[CANVAS POLL] Workspace updated! Reloading state...`)
            const normalizedNodes = normalizeNodes(workspaceState.nodes)
            const normalizedEdges = normalizeEdges(workspaceState.edges)
            setNodes(normalizedNodes)
            setEdges(normalizedEdges)
            nodesRef.current = normalizedNodes
            edgesRef.current = normalizedEdges
            lastSyncRef.current = workspaceState.updatedAt || ''
            if (workspaceState.runRequestedAt && workspaceState.runRequestedAt !== lastExecutedRunRef.current) {
              setRemoteRunRequest(workspaceState.runRequestedAt)
            }
            
            // Sync local storage
            localStorage.setItem('ka-canvas-nodes', JSON.stringify(workspaceState.nodes))
            localStorage.setItem('ka-canvas-edges', JSON.stringify(workspaceState.edges))
          }
        }
      } catch {
        // Silent catch — file might not exist or dev server offline
      }
    }, 2500)

    return () => clearInterval(interval)
  }, [isRunning, draggedEdge, selectedNodeId])

  // Save to localStorage whenever state changes
  const saveState = (newNodes: NodeState[], newEdges: EdgeState[]) => {
    nodesRef.current = newNodes
    edgesRef.current = newEdges
    try {
      localStorage.setItem('ka-canvas-nodes', JSON.stringify(newNodes))
      localStorage.setItem('ka-canvas-edges', JSON.stringify(newEdges))
    } catch (e) {
      console.error('Failed to save canvas state:', e)
    }
  }

  // ─── Node Actions ───────────────────────────────────────
  const addNode = (type: NodeType) => {
    const id = `n-${type}-${Date.now()}`
    
    // Spawn near the center of the viewport
    const viewportCenterX = -pan.x + (containerRef.current?.clientWidth || 800) / 2 - NODE_WIDTH / 2
    const viewportCenterY = -pan.y + (containerRef.current?.clientHeight || 500) / 2 - NODE_HEIGHT / 2
    
    const newNode: NodeState = {
      id,
      type,
      x: viewportCenterX + (Math.random() * 40 - 20),
      y: viewportCenterY + (Math.random() * 40 - 20),
      data: {
        value: type === 'input' ? 'Starting task prompt...' : '',
        agentId: type === 'specialist' ? 'researcher' : undefined,
        modelId: type === 'model' ? 'claude-3-5' : undefined,
        output: '',
      },
      isActive: false,
    }

    const updated = [...nodes, newNode]
    setNodes(updated)
    saveState(updated, edges)
    setSelectedNodeId(id)
  }

  const removeNode = (nodeId: string) => {
    const updatedNodes = nodes.filter((n) => n.id !== nodeId)
    const updatedEdges = edges.filter((e) => e.fromNode !== nodeId && e.toNode !== nodeId)
    setNodes(updatedNodes)
    setEdges(updatedEdges)
    saveState(updatedNodes, updatedEdges)
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null)
    }
  }

  const updateNodeData = (nodeId: string, updates: Partial<NodeData>) => {
    console.log(`[CANVAS STATE] updateNodeData for node ${nodeId} with:`, updates)
    setNodes((prev) => {
      const updated = prev.map((n) => {
        if (n.id === nodeId) {
          const res = { ...n, data: { ...n.data, ...updates } }
          console.log(`[CANVAS STATE] Updated node target:`, res)
          return res
        }
        return n
      })
      saveState(updated, edgesRef.current)
      return updated
    })
  }

  const handleNodeDrag = (nodeId: string, dx: number, dy: number) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          return { ...n, x: n.x + dx / zoom, y: n.y + dy / zoom }
        }
        return n
      })
    )
  }

  // Save positions when drag ends
  const handleDragEnd = () => {
    saveState(nodes, edges)
  }

  // ─── Panning & Zooming ──────────────────────────────────
  const handleCanvasPointerDown = (e: MouseEvent<HTMLDivElement>) => {
    // Only drag pan if clicking background grid
    const target = e.target as HTMLElement
    if (target.classList.contains('ka-canvas-grid') || target.classList.contains('ka-canvas-container')) {
      setIsPanning(true)
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    }
  }

  const handleCanvasPointerMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      })
    } else if (draggedEdge) {
      // Calculate current position relative to grid
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (containerRect) {
        const clientX = e.clientX - containerRect.left
        const clientY = e.clientY - containerRect.top
        
        // Translate client position to viewport/grid space
        const gridX = (clientX - pan.x) / zoom
        const gridY = (clientY - pan.y) / zoom
        
        setDraggedEdge((prev) => {
          if (!prev) return null
          return { ...prev, currentX: gridX, currentY: gridY }
        })
      }
    }
  }

  const handleCanvasPointerUp = (e: MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false)
    } else if (draggedEdge) {
      // Check if dropped on a port handle
      const target = e.target as HTMLElement
      const portId = target.getAttribute('data-port-id')
      
      if (portId && portId.endsWith('-input')) {
        const targetNodeId = portId.split('-input')[0]
        const fromNodeId = draggedEdge.fromNode
        
        // Prevent loops and duplicate edges
        if (targetNodeId !== fromNodeId && !edges.some((e) => e.fromNode === fromNodeId && e.toNode === targetNodeId)) {
          const newEdge: EdgeState = {
            id: `e-${fromNodeId}-${targetNodeId}-${Date.now()}`,
            fromNode: fromNodeId,
            toNode: targetNodeId,
          }
          const updatedEdges = [...edges, newEdge]
          setEdges(updatedEdges)
          saveState(nodes, updatedEdges)
        }
      }
      setDraggedEdge(null)
    }
  }

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (direction === 'in') {
      setZoom((z) => Math.min(z + 0.1, 1.5))
    } else if (direction === 'out') {
      setZoom((z) => Math.max(z - 0.1, 0.6))
    } else {
      setZoom(1)
      setPan({ x: 100, y: 100 })
    }
  }

  // ─── Port Connection PointerDown ───────────────────────
  const handlePortPointerDown = (e: MouseEvent<HTMLDivElement>, nodeId: string) => {
    e.stopPropagation() // Stop node drag
    
    // Output port position in grid space
    const startX = nodes.find((n) => n.id === nodeId)!.x + NODE_WIDTH
    const startY = nodes.find((n) => n.id === nodeId)!.y + NODE_HEIGHT / 2
    
    setDraggedEdge({
      fromNode: nodeId,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
    })
  }

  // ─── Workflow Runner / Topological Solver ──────────────
  const runWorkflow = async () => {
    if (isRunning) return
    const graphNodes = nodesRef.current
    const graphEdges = edgesRef.current
    setIsRunning(true)
    setLogs('Initializing topological canvas solver...\n')
    if (onProgress) onProgress('Workflow active')

    // Reset output node text and active flags
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        isActive: false,
        data: n.type === 'output' ? { ...n.data, output: '' } : n.data,
      }))
    )

    // Build adjacency list & indegrees
    const adjList: Record<string, string[]> = {}
    const inDegree: Record<string, number> = {}
    
    graphNodes.forEach((n) => {
      adjList[n.id] = []
      inDegree[n.id] = 0
    })

    graphEdges.forEach((e) => {
      if (adjList[e.fromNode]) {
        adjList[e.fromNode].push(e.toNode)
        inDegree[e.toNode] = (inDegree[e.toNode] || 0) + 1
      }
    })

    // Queue of nodes with in-degree 0 (starter nodes)
    const queue: string[] = graphNodes.filter((n) => (inDegree[n.id] || 0) === 0).map((n) => n.id)
    
    // Track execution values passed along connections
    const nodeInputs: Record<string, string[]> = {}
    graphNodes.forEach((n) => {
      nodeInputs[n.id] = []
    })

    // Populate initial inputs for starter nodes
    graphNodes.forEach((n) => {
      if (n.type === 'input' && n.data.value) {
        nodeInputs[n.id].push(n.data.value)
      }
    })

    // Topological execution sequence
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    while (queue.length > 0) {
      const currentId = queue.shift()!
      const currentNode = nodesRef.current.find((n) => n.id === currentId)!
      
      // Flash node border as processing
      setNodes((prev) =>
        prev.map((n) => (n.id === currentId ? { ...n, isActive: true } : n))
      )
      setActiveStepId(currentId)

      const accumulatedInput = nodeInputs[currentId].join('\n\n')
      
      let stepOutput = accumulatedInput
      
      setLogs((prev) => prev + `[RUNNING] Executing ${currentNode.type} node (${currentId})...\n`)
      await delay(1200)

      if (currentNode.type === 'specialist') {
        const agent = currentNode.data.agentId || 'researcher'
        const baseOutput = MOCK_OUTPUTS[agent] || 'Action completed successfully.'
        stepOutput = `[Agent override: ${currentNode.data.value || 'None'}]\n\n${baseOutput}`
        setLogs((prev) => prev + `[COMPLETE] ${agent} agent executed. Output generated.\n`)
      } else if (currentNode.type === 'model') {
        const model = currentNode.data.modelId || 'claude-3-5'
        if (model === 'locate-anything-3b') {
          stepOutput = `[Model: LocateAnything-3B]\n[Visual Grounding Input: ${currentNode.data.value || 'GUI / Target element request'}]\n\n[LOCATEANYTHING-3B · NVIDIA AI]\nParallel Box Decoding (PBD) Pass:\n- Target objects successfully localized in 1 parallel decoding step.\n- Bounding Box coordinates generated: [x_min: 0.12, y_min: 0.35, x_max: 0.48, y_max: 0.88]\n- OCR read: Targets parsed and boundaries matched in 14ms (2.5x speed lift).\nGrounding complete.`
        } else if (model === 'eagle2-9b') {
          stepOutput = `[Model: Eagle2-9B Multimodal]\n[Analysis instruction: ${currentNode.data.value || 'Document / Video parsing request'}]\n\n[EAGLE2-9B · NVIDIA AI]\nImage Area Preservation (IAP) Tiling:\n- Dynamic resolution preserving fine detail (ChartQA/DocVQA-compliant parsing).\n- Structured extraction: Document fields parsed with context-length optimization.\n- Verdict: High-fidelity reasoning successfully completed.`
        } else {
          stepOutput = `[Model: ${model}]\n[Context modifier: ${currentNode.data.value || 'None'}]\n\nRefined output with foundation parameters.`
        }
        setLogs((prev) => prev + `[COMPLETE] Foundation model (${model}) executed.\n`)
      } else if (currentNode.type === 'output') {
        // Output node compiles all inputs
        stepOutput = accumulatedInput
        console.log(`[CANVAS RUN] Output Node reached! accumulatedInput:`, accumulatedInput)
        setLogs((prev) => prev + `[FINISHING] Compiled pipeline output.\n`)
      }

      // De-activate node, and save output atomically if output node
      setNodes((prev) => {
        const updated = prev.map((n) => {
          if (n.id === currentId) {
            const dataUpdates = n.type === 'output' ? { output: stepOutput } : {}
            const res = {
              ...n,
              isActive: false,
              data: { ...n.data, ...dataUpdates },
            }
            console.log(`[CANVAS RUN] Deactivating node ${currentId} and writing output updates:`, JSON.stringify(res))
            return res
          }
          return n
        })
        saveState(updated, edgesRef.current)
        return updated
      })

      // Forward output to child nodes
      const children = adjList[currentId] || []
      for (const childId of children) {
        nodeInputs[childId].push(stepOutput)
        
        // Flash edge active
        const edge = graphEdges.find((e) => e.fromNode === currentId && e.toNode === childId)
        if (edge) {
          setActiveEdgeId(edge.id)
          await delay(600)
          setActiveEdgeId(null)
        }
        
        inDegree[childId]--
        if (inDegree[childId] === 0) {
          queue.push(childId)
        }
      }
    }

    setLogs((prev) => prev + `[RESOLVED] Visual pipeline execution complete.\n`)
    setIsRunning(false)
    setActiveStepId(null)
    if (onProgress) onProgress('Idle')
  }

  runWorkflowRef.current = runWorkflow

  useEffect(() => {
    if (!remoteRunRequest || remoteRunRequest === lastExecutedRunRef.current) return
    lastExecutedRunRef.current = remoteRunRequest
    setLogs((prev) => `${prev}${prev ? '\n' : ''}[REMOTE] Agent requested graph execution.\n`)
    void runWorkflowRef.current()
  }, [remoteRunRequest])

  useEffect(() => {
    registerTool({
      name: 'creative_canvas_inspect',
      description: 'Inspect the live editorial workflow canvas, including nodes, connections, selection, viewport, execution state, logs, available agents, and available models.',
      parameters: {},
      category: 'external',
      keywords: ['canvas', 'workflow', 'graph', 'agent nodes', 'pipeline'],
      execute: async () => ({
        success: true,
        data: {
          nodes: nodesRef.current,
          edges: edgesRef.current,
          selectedNodeId,
          viewport: { pan, zoom },
          isRunning,
          simulationMode,
          logs,
          availableAgents: AVAILABLE_AGENTS,
          availableModels: AVAILABLE_MODELS,
        },
      }),
    })

    registerTool({
      name: 'creative_canvas_control',
      description: 'Deterministically control the live editorial workflow canvas. Add, update, connect, move, delete, or clear nodes. New nodes can use tempId values that later actions reference in the same call.',
      parameters: {
        actions: {
          type: 'array',
          description: 'Ordered actions: add {tempId?,id?,nodeType,input|specialist|model|output,x?,y?,data?}; update {id,data?,x?,y?}; connect {from,to}; delete {id}; clear.',
        },
        summary: { type: 'string', description: 'Short explanation of the graph changes.' },
      },
      category: 'external',
      keywords: ['canvas', 'workflow', 'graph', 'add agent', 'connect nodes', 'pipeline'],
      execute: async (args) => {
        const actions = Array.isArray(args.actions) ? args.actions as CanvasAgentAction[] : []
        if (actions.length === 0) return { success: false, data: null, error: 'actions must contain at least one command' }

        let nextNodes = [...nodesRef.current]
        let nextEdges = [...edgesRef.current]
        const idMap = new Map<string, string>()
        const changedIds: string[] = []
        const resolveId = (id: string) => idMap.get(id) ?? id

        for (const action of actions.slice(0, 40)) {
          if (action.type === 'clear') {
            nextNodes = []
            nextEdges = []
          } else if (action.type === 'add' && ['input', 'specialist', 'model', 'output'].includes(action.nodeType)) {
            const id = action.id || `n-${action.nodeType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            if (action.tempId) idMap.set(action.tempId, id)
            const defaultData: NodeData = {
              value: action.nodeType === 'input' ? 'Starting task prompt…' : '',
              agentId: action.nodeType === 'specialist' ? 'researcher' : undefined,
              modelId: action.nodeType === 'model' ? 'claude-3-5' : undefined,
              output: '',
            }
            nextNodes.push({
              id,
              type: action.nodeType,
              x: Number.isFinite(action.x) ? action.x! : 120 + nextNodes.length * 70,
              y: Number.isFinite(action.y) ? action.y! : 120 + (nextNodes.length % 3) * 180,
              data: { ...defaultData, ...(action.data || {}) },
              isActive: false,
            })
            changedIds.push(id)
          } else if (action.type === 'update') {
            const id = resolveId(action.id)
            nextNodes = nextNodes.map(node => node.id === id ? {
              ...node,
              ...(Number.isFinite(action.x) ? { x: action.x! } : {}),
              ...(Number.isFinite(action.y) ? { y: action.y! } : {}),
              data: { ...node.data, ...(action.data || {}) },
            } : node)
            changedIds.push(id)
          } else if (action.type === 'connect') {
            const from = resolveId(action.from)
            const to = resolveId(action.to)
            if (from !== to && nextNodes.some(node => node.id === from) && nextNodes.some(node => node.id === to) && !nextEdges.some(edge => edge.fromNode === from && edge.toNode === to)) {
              nextEdges.push({ id: `e-${from}-${to}-${Date.now()}`, fromNode: from, toNode: to })
              changedIds.push(from, to)
            }
          } else if (action.type === 'delete') {
            const id = resolveId(action.id)
            nextNodes = nextNodes.filter(node => node.id !== id)
            nextEdges = nextEdges.filter(edge => edge.fromNode !== id && edge.toNode !== id)
            changedIds.push(id)
          }
        }

        nodesRef.current = nextNodes
        edgesRef.current = nextEdges
        setNodes(nextNodes)
        setEdges(nextEdges)
        saveState(nextNodes, nextEdges)
        setSelectedNodeId(changedIds.at(-1) ?? null)
        const summary = typeof args.summary === 'string' ? args.summary : `Applied ${actions.length} agent canvas actions.`
        setLogs(prev => `${prev}${prev ? '\n' : ''}[AGENT] ${summary}\n`)

        return {
          success: true,
          data: {
            summary,
            changedIds: [...new Set(changedIds)],
            resolvedIds: Object.fromEntries(idMap),
            nodeCount: nextNodes.length,
            edgeCount: nextEdges.length,
          },
        }
      },
    })

    registerTool({
      name: 'creative_canvas_run',
      description: 'Execute the current live editorial workflow graph in topological order and stream progress into the canvas pipeline log.',
      parameters: {},
      category: 'external',
      keywords: ['run canvas', 'execute workflow', 'run graph', 'pipeline'],
      execute: async () => {
        if (isRunning) return { success: false, data: null, error: 'Canvas workflow is already running' }
        await runWorkflowRef.current()
        return { success: true, data: { status: 'complete', nodeCount: nodesRef.current.length, edgeCount: edgesRef.current.length } }
      },
    })

    return () => {
      removeTool('creative_canvas_inspect')
      removeTool('creative_canvas_control')
      removeTool('creative_canvas_run')
    }
  }, [isRunning, logs, pan, selectedNodeId, simulationMode, zoom])

  const clearCanvas = () => {
    if (isRunning) return
    setNodes([])
    setEdges([])
    saveState([], [])
    setSelectedNodeId(null)
    setLogs('')
  }

  return (
    <div 
      className="ka-canvas-page"
      onPointerUp={handleDragEnd} // Save state on drag release anywhere
    >
      {/* ─── Canvas Header Controls ──────────────────────── */}
      <div className="ka-canvas-controls">
        <button className="ka-canvas-btn" onClick={() => addNode('input')}>
          + Input
        </button>
        <button className="ka-canvas-btn" onClick={() => addNode('specialist')}>
          + Agent
        </button>
        <button className="ka-canvas-btn" onClick={() => addNode('model')}>
          + Model
        </button>
        <button className="ka-canvas-btn" onClick={() => addNode('output')}>
          + Output
        </button>
        <button
          className="ka-canvas-btn ka-canvas-btn--tomato"
          onClick={runWorkflow}
          disabled={isRunning || nodes.length === 0}
        >
          Run Graph
        </button>
        <button className="ka-canvas-btn" onClick={() => handleZoom('in')}>
          Zoom In
        </button>
        <button className="ka-canvas-btn" onClick={() => handleZoom('out')}>
          Zoom Out
        </button>
        <button className="ka-canvas-btn" onClick={() => handleZoom('reset')}>
          Reset View
        </button>
        <button
          className="ka-canvas-btn"
          onClick={clearCanvas}
          disabled={isRunning || nodes.length === 0}
        >
          Clear
        </button>

        {/* Simulation Mode Toggle */}
        <div className="ka-canvas-sim-toggle">
          <span>Simulation</span>
          <label className="ka-canvas-switch">
            <input
              type="checkbox"
              checked={simulationMode}
              onChange={(e) => setSimulationMode(e.target.checked)}
            />
            <span className="ka-canvas-slider" />
          </label>
        </div>
      </div>

      {/* ─── Floating Sidebar Info & Agent Chat ─────────── */}
      <aside className="ka-canvas-sidebar" aria-label="Agent Chat & Pipeline Logs">
        <div className="ka-canvas-sidebar-tabs">
          <button 
            type="button"
            className={`ka-canvas-sidebar-tab ${sidebarTab === 'chat' ? 'ka-canvas-sidebar-tab--active' : ''}`}
            onClick={() => setSidebarTab('chat')}
          >
            Agent Chat
          </button>
          <button 
            type="button"
            className={`ka-canvas-sidebar-tab ${sidebarTab === 'log' ? 'ka-canvas-sidebar-tab--active' : ''}`}
            onClick={() => setSidebarTab('log')}
          >
            Pipeline Log
          </button>
        </div>

        {sidebarTab === 'chat' ? (
          <div className="ka-canvas-chat-container">
            <div className="ka-canvas-chat-feed">
              {chatMessages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`ka-canvas-chat-msg ka-canvas-chat-msg--${msg.role}`}
                >
                  <div className="ka-canvas-chat-msg-author">
                    {msg.role === 'user' ? 'USER' : msg.role === 'system' ? 'SYSTEM' : 'KERNEL AGENT'}
                  </div>
                  <div className="ka-canvas-chat-msg-body">
                    {msg.content || (
                      <span className="ka-canvas-chat-typing">
                        <span></span><span></span><span></span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendChatMessage} className="ka-canvas-chat-input-form">
              <input 
                type="text"
                className="ka-canvas-chat-input"
                placeholder={isChatStreaming ? "Agent thinking..." : "Ask the agent to build/run..."}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isChatStreaming}
              />
              <button 
                type="submit" 
                className="ka-canvas-chat-send-btn"
                disabled={isChatStreaming || !chatInput.trim()}
              >
                &rarr;
              </button>
            </form>
          </div>
        ) : (
          <div className="ka-canvas-log-container">
            <h3 className="ka-canvas-sidebar-title">Pipeline Log</h3>
            <p className="ka-canvas-sidebar-desc">
              Topological execution log of active nodes.
            </p>
            <div className="ka-canvas-sidebar-output">
              <span className="ka-canvas-sidebar-output-title">Console Output</span>
              <div className="ka-canvas-sidebar-output-box">
                {logs || '*Solvers idle. Add nodes and draw connections.*'}
              </div>
            </div>
            
            {isRunning && (
              <div className="ka-canvas-sidebar-steps">
                <span className="ka-canvas-sidebar-output-title">Active Steps</span>
                {nodes.map((n) => {
                  const active = n.id === activeStepId ? ' ka-canvas-sidebar-step--active' : ''
                  return (
                    <div key={n.id} className={`ka-canvas-sidebar-step${active}`}>
                      {(n.type || '').toUpperCase()}: {n.id}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ─── Canvas Workspace ────────────────────────────── */}
      <div
        ref={containerRef}
        className="ka-canvas-container"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
      >
        <div
          className="ka-canvas-viewport"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <div className="ka-canvas-grid" />

          {/* Nodes Layer */}
          {nodes.map((node) => (
            <CanvasNode
              key={node.id}
              id={node.id}
              type={node.type}
              x={node.x}
              y={node.y}
              data={node.data}
              isSelected={selectedNodeId === node.id}
              isActive={node.isActive}
              onDrag={handleNodeDrag}
              onSelect={setSelectedNodeId}
              onRemove={removeNode}
              onUpdateData={updateNodeData}
              availableAgents={AVAILABLE_AGENTS}
              availableModels={AVAILABLE_MODELS}
            />
          ))}

          {/* SVG Edges Layer */}
          <svg className="ka-canvas-svg-layer">
            {/* Render Saved Connections */}
            {edges.map((edge) => {
              const fromNode = nodes.find((n) => n.id === edge.fromNode)
              const toNode = nodes.find((n) => n.id === edge.toNode)
              
              if (!fromNode || !toNode) return null

              // Calculate start/end centered on output/input handles
              const startX = fromNode.x + NODE_WIDTH
              const startY = fromNode.y + NODE_HEIGHT / 2
              const endX = toNode.x
              const endY = toNode.y + NODE_HEIGHT / 2

              return (
                <CanvasEdge
                  key={edge.id}
                  id={edge.id}
                  startX={startX}
                  startY={startY}
                  endX={endX}
                  endY={endY}
                  isActive={edge.id === activeEdgeId || fromNode.isActive}
                />
              )
            })}

            {/* Render Dragged Draft Connection */}
            {draggedEdge && (
              <CanvasEdge
                id="draft-edge"
                startX={draggedEdge.startX}
                startY={draggedEdge.startY}
                endX={draggedEdge.currentX}
                endY={draggedEdge.currentY}
                isDrafting={true}
              />
            )}
          </svg>
        </div>
      </div>
      
      {/* Node Handle Drag Attachment Hook */}
      <div style={{ display: 'none' }}>
        {nodes.map((node) => {
          if (node.type === 'output') return null
          return (
            <div
              key={`hook-${node.id}`}
              className="port-hook"
              onPointerDown={(e) => handlePortPointerDown(e, node.id)}
              style={{
                position: 'absolute',
                left: pan.x + (node.x + NODE_WIDTH) * zoom - 10,
                top: pan.y + (node.y + NODE_HEIGHT / 2) * zoom - 10,
                width: 20,
                height: 20,
                cursor: 'crosshair',
                zIndex: 30,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
