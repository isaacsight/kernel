/**
 * Directing Room — planning-only creative production blueprint.
 *
 * The room turns an unformed idea into an inspectable greenlight packet.
 * It deliberately contains no image or video nodes: approval of the plan
 * and approval of paid execution are separate human decisions.
 */

export type DirectingRoomNodeKind = 'prompt' | 'agent' | 'output'

export interface DirectingRoomNode {
  id: string
  kind: DirectingRoomNodeKind
  x: number
  y: number
  title: string
  content: string
  model: string
  status: 'idle'
}

export interface DirectingRoomEdge {
  id: string
  from: string
  to: string
}

export interface DirectingRoomBlueprint {
  projectName: string
  nodes: DirectingRoomNode[]
  edges: DirectingRoomEdge[]
  view: { x: number; y: number; zoom: number }
}

export const DIRECTING_ROOM_ROLES = [
  'Creative Director',
  'Director',
  'VFX Supervisor',
  'Editor',
] as const

const FALLBACK_IDEA = 'Describe the idea, audience, intended feeling, format, constraints, references, and what must remain true.'

export function createDirectingRoomBlueprint(idea = ''): DirectingRoomBlueprint {
  const brief = idea.trim() || FALLBACK_IDEA
  const nodes: DirectingRoomNode[] = [
    {
      id: 'idea-intake', kind: 'prompt', x: 80, y: 260, title: 'The idea',
      content: brief, model: 'Claude 4.5', status: 'idle',
    },
    {
      id: 'creative-director', kind: 'agent', x: 430, y: 95, title: 'Creative Director',
      content: 'Turn the idea into a project constitution. Define intent, audience, emotional arc, visual world, palette, typography, materials, camera and lighting rules, continuity anchors, ALWAYS / AVOID / NEVER constraints, and open creative questions. Protect coherence without inventing production claims. End with what requires human approval.',
      model: 'Creative Director', status: 'idle',
    },
    {
      id: 'director', kind: 'agent', x: 800, y: 95, title: 'Director',
      content: 'Work inside the approved creative constitution. Produce a treatment, beat map, coverage strategy, and numbered shot plan. For every shot specify dramatic purpose, framing, lens, camera movement, action or performance, duration, continuity, protected elements, and success criteria. File any proposed exception to the constitution with a reason.',
      model: 'Director', status: 'idle',
    },
    {
      id: 'vfx-supervisor', kind: 'agent', x: 1170, y: 20, title: 'VFX Supervisor',
      content: 'Break down only the shots that need effects. Propose reversible plates, tracks, mattes, masks, clean plates, depth, compositing, 2.5D or 3D passes, generative operations, local-versus-paid routing, draft strategy, risks, and validation criteria. Do not execute or imply an effect is shipped. Mark uncertainty frame ranges and dependencies.',
      model: 'VFX Supervisor', status: 'idle',
    },
    {
      id: 'editor', kind: 'agent', x: 1170, y: 400, title: 'Editor',
      content: 'Review the treatment as a sequence. Propose rhythm, transitions, sound and dialogue structure, cut logic, coverage gaps, continuity warnings, and the minimum footage needed. Identify shots to cut before production and explain why. Preserve the creative constitution while protecting clarity and pace.',
      model: 'Editor', status: 'idle',
    },
    {
      id: 'greenlight-packet', kind: 'output', x: 1540, y: 210, title: 'Human greenlight packet',
      content: 'Compile the idea, creative constitution, treatment, shot plan, VFX breakdown, edit review, disagreements, exceptions, unresolved questions, local-versus-paid work, and estimated approval gates. Finish with separate APPROVE PLAN, REVISE, REFUSE, and APPROVE PAID EXECUTION decisions. Paid execution must remain unapproved by default.',
      model: 'Compiled result', status: 'idle',
    },
  ]

  const edges: DirectingRoomEdge[] = [
    { id: 'idea-creative', from: 'idea-intake', to: 'creative-director' },
    { id: 'creative-director', from: 'creative-director', to: 'director' },
    { id: 'director-vfx', from: 'director', to: 'vfx-supervisor' },
    { id: 'director-editor', from: 'director', to: 'editor' },
    { id: 'creative-greenlight', from: 'creative-director', to: 'greenlight-packet' },
    { id: 'director-greenlight', from: 'director', to: 'greenlight-packet' },
    { id: 'vfx-greenlight', from: 'vfx-supervisor', to: 'greenlight-packet' },
    { id: 'editor-greenlight', from: 'editor', to: 'greenlight-packet' },
  ]

  return { projectName: 'Untitled directing room', nodes, edges, view: { x: 12, y: 150, zoom: 0.48 } }
}
