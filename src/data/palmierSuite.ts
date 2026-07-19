export type PalmierToolStatus = 'ready' | 'partial' | 'native-required'

export interface PalmierToolDefinition {
  id: string
  name: string
  category: string
  outcome: string
  status: PalmierToolStatus
  inputs: string[]
  operations: string[]
  blockers?: string[]
  approval?: 'generation' | 'delivery'
}

export const PALMIER_CATEGORIES = [
  'Create', 'Edit', 'Review', 'Finish', 'Foundation', 'Agentic', 'Governance', 'Future',
] as const

export const PALMIER_SUITE: PalmierToolDefinition[] = [
  { id: 'director', name: 'Director', category: 'Create', outcome: 'Brief to a protected, structured timeline.', status: 'ready', inputs: ['Brief', 'Optional source timeline', 'Timed beats'], operations: ['Inspect project', 'Duplicate timeline', 'Place beat markers'] },
  { id: 'campaign', name: 'Campaign Studio', category: 'Create', outcome: 'Product input to multi-format campaign timelines.', status: 'ready', inputs: ['Product', 'Audience', 'Objective', 'Formats'], operations: ['Create variants', 'Set aspect ratios', 'Preserve master'] },
  { id: 'shots', name: 'Shot Lab', category: 'Create', outcome: 'Generate timeline-aligned coverage and alternatives.', status: 'ready', inputs: ['Selected clip', 'Motion prompts', 'Approved references'], operations: ['Inspect cut', 'Resolve models', 'Generate alternates'], approval: 'generation' },
  { id: 'continuity', name: 'Continuity Engine', category: 'Review', outcome: 'Detect identity, composition, and color drift.', status: 'ready', inputs: ['Clip selection', 'Approved references'], operations: ['Inspect media', 'Measure color', 'Compare references'] },
  { id: 'productTruth', name: 'Product Truth', category: 'Review', outcome: 'Protect UI, packaging, claims, and brand facts.', status: 'ready', inputs: ['Protected facts', 'Product references'], operations: ['Inspect timeline', 'Read visible text', 'Flag contradictions'] },
  { id: 'recast', name: 'Recast Studio', category: 'Create', outcome: 'Consent-bound sequence-level subject replacement.', status: 'native-required', inputs: ['Source clips', 'Identity reference', 'Consent'], operations: ['Verify references', 'Record consent'], blockers: ['Identity replacement engine', 'Sequence consistency model'] },
  { id: 'style', name: 'Style Director', category: 'Finish', outcome: 'Apply and audit one visual constitution.', status: 'ready', inputs: ['Constitution', 'Clip selection', 'Reference'], operations: ['Measure shots', 'Apply grade', 'Apply effects'] },
  { id: 'transitions', name: 'Transition Designer', category: 'Edit', outcome: 'Inspect a cut and add a purposeful bridge only when needed.', status: 'ready', inputs: ['Adjacent clips', 'Cut frame', 'Optional bridge'], operations: ['Inspect cut', 'Insert bridge', 'Preserve handles'] },
  { id: 'performance', name: 'Performance Editor', category: 'Edit', outcome: 'Transcript-first talking-head and UGC editing.', status: 'ready', inputs: ['Timeline', 'Filler policy', 'Caption style'], operations: ['Remove silence', 'Edit words', 'Denoise', 'Caption'] },
  { id: 'shorts', name: 'Shorts Factory', category: 'Create', outcome: 'Master timeline to protected social derivatives.', status: 'ready', inputs: ['Source timeline', 'Variant definitions'], operations: ['Duplicate timeline', 'Reframe', 'Trim derivatives'] },
  { id: 'critic', name: 'Edit Critic', category: 'Review', outcome: 'Evidence-based pacing, clarity, caption, and audio review.', status: 'ready', inputs: ['Timeline', 'Optional music'], operations: ['Inspect edit', 'Read transcript', 'Detect beats'] },
  { id: 'deliver', name: 'Finish and Deliver', category: 'Finish', outcome: 'Approval-gated export and verification matrix.', status: 'ready', inputs: ['Delivery definitions'], operations: ['Inspect captions', 'Queue exports', 'Report jobs'], approval: 'delivery' },
  { id: 'mediaPipeline', name: 'Media Pipeline', category: 'Foundation', outcome: 'Proxy, relink, consolidate, cache, and RAW workflow.', status: 'partial', inputs: ['Media paths', 'Proxy policy'], operations: ['Inventory', 'Import'], blockers: ['Proxy engine', 'Render cache', 'RAW decoder', 'Relink API'] },
  { id: 'compositor', name: 'Compositor', category: 'Foundation', outcome: 'Masks, tracking, keying, cleanup, and procedural scenes.', status: 'partial', inputs: ['Clips', 'Effect graph'], operations: ['Apply live effects'], blockers: ['Node graph', 'Tracked masks', 'Keyer', 'Rotoscope', '2.5D renderer'] },
  { id: 'colorPipeline', name: 'Color Pipeline', category: 'Foundation', outcome: 'Managed color, matching, HDR, and delivery transforms.', status: 'partial', inputs: ['Clips', 'Reference', 'Grade'], operations: ['Scopes', 'Reference match', 'Apply grade'], blockers: ['OCIO/ACES', 'HDR monitoring', 'Power windows', 'RAW controls'] },
  { id: 'audioPost', name: 'Audio Post', category: 'Foundation', outcome: 'Dialogue, buses, mixing, immersive sound, and stems.', status: 'partial', inputs: ['Dialogue clips', 'Mix specification'], operations: ['Denoise dialogue'], blockers: ['Bus mixer', 'Dynamics', 'Automation', 'Immersive routing', 'Stem export'] },
  { id: 'collaboration', name: 'Multiplayer Timeline', category: 'Foundation', outcome: 'Human and agent presence, permissions, merging, and review.', status: 'native-required', inputs: ['Project', 'Participants', 'Roles'], operations: ['Version timelines'], blockers: ['Realtime sync', 'Presence', 'CRDT merge', 'Review service'] },
  { id: 'generativeExtend', name: 'Generative Extend', category: 'Create', outcome: 'Editable head, tail, ambience, and transition handles.', status: 'partial', inputs: ['Source clip', 'Direction', 'Model'], operations: ['Video-to-video generation'], blockers: ['Native handle replacement', 'Optical continuity validation'], approval: 'generation' },
  { id: 'intelligence', name: 'Media Intelligence', category: 'Agentic', outcome: 'Search and understand footage across image, speech, and meaning.', status: 'ready', inputs: ['Natural-language query'], operations: ['Search media', 'Inspect storyboards', 'Read transcripts'] },
  { id: 'localization', name: 'Localization Studio', category: 'Create', outcome: 'Captions, dubbing, timing, and regional delivery.', status: 'partial', inputs: ['Target languages', 'Approved script'], operations: ['Transcribe', 'Generate dub', 'Create variants'], blockers: ['Caption translation', 'Lip sync', 'Regional text replacement'], approval: 'generation' },
  { id: 'avatar', name: 'Avatar Studio', category: 'Create', outcome: 'Consent-bound synthetic presenters and performances.', status: 'native-required', inputs: ['Identity reference', 'Consent', 'Script'], operations: ['Verify identity reference'], blockers: ['Consent ledger', 'Digital-double model', 'Performance controls'], approval: 'generation' },
  { id: 'motionGraphics', name: 'Motion Graphics', category: 'Create', outcome: 'Reusable procedural typography and brand animation.', status: 'partial', inputs: ['Text entries', 'Brand system'], operations: ['Animated text clips'], blockers: ['Shape layers', 'Expressions', 'Templates', 'Particles'] },
  { id: 'productionMemory', name: 'Production Memory', category: 'Agentic', outcome: 'Durable project facts, rules, references, and decisions.', status: 'native-required', inputs: ['Creative constitution'], operations: ['Inspect project context'], blockers: ['Project memory store', 'Decision graph', 'Rejection ledger'] },
  { id: 'coverage', name: 'Coverage Agent', category: 'Agentic', outcome: 'Find missing story evidence before generating or reshooting.', status: 'ready', inputs: ['Timeline', 'Story intent'], operations: ['Inspect edit', 'Search media', 'Audit transcript'] },
  { id: 'assembly', name: 'Autonomous Assembly Room', category: 'Agentic', outcome: 'Specialist agents propose one reviewable production plan.', status: 'native-required', inputs: ['Brief', 'Budget', 'Constitution'], operations: ['Inspect project'], blockers: ['Specialist runtime', 'Consensus ledger', 'Budget scheduler'] },
  { id: 'compiler', name: 'Timeline Compiler', category: 'Agentic', outcome: 'Compile intent into editable tracks, clips, prompts, and alternates.', status: 'partial', inputs: ['Brief', 'Timeline name'], operations: ['Create timeline', 'Place layers'], blockers: ['Dependency graph', 'Partial recompilation', 'Alternate-track schema'] },
  { id: 'optimizer', name: 'Outcome Optimizer', category: 'Agentic', outcome: 'Connect creative decisions to retention and conversion evidence.', status: 'native-required', inputs: ['Performance data', 'Variant history'], operations: ['Rank observed variants'], blockers: ['Analytics connectors', 'Attribution', 'Experiment registry'] },
  { id: 'provenance', name: 'Rights and Provenance', category: 'Governance', outcome: 'Trace licenses, consent, models, prompts, and exports.', status: 'partial', inputs: ['Asset rights', 'Usage context'], operations: ['Build manifest', 'Evaluate policy'], blockers: ['C2PA signing', 'Rights database', 'Export embedding'] },
  { id: 'router', name: 'Model Router', category: 'Agentic', outcome: 'Choose models by quality, cost, latency, capability, and rights.', status: 'partial', inputs: ['Task', 'Policy'], operations: ['Read live catalog', 'Rank eligible models'], blockers: ['Benchmark history', 'Cost telemetry', 'Enterprise policy store'] },
  { id: 'living', name: 'Living Deliverables', category: 'Create', outcome: 'Governed, refreshable audience and regional variants.', status: 'partial', inputs: ['Master timeline', 'Variant parameters'], operations: ['Create timeline variants'], blockers: ['Parameter binding', 'Schedules', 'Data connectors', 'Publishing policy'] },
  { id: 'spatial', name: 'Spatial Studio', category: 'Future', outcome: 'Depth-aware, immersive, VR, and spatial-audio production.', status: 'native-required', inputs: ['Spatial media', 'Delivery target'], operations: ['Inspect timeline'], blockers: ['Stereo/360 viewer', 'Depth representation', 'Spatial buses', 'Immersive export'] },
  { id: 'recovery', name: 'Recovery and Interchange', category: 'Foundation', outcome: 'Autosave, repair, package, and professional handoff.', status: 'partial', inputs: ['Handoff target'], operations: ['Palmier package', 'XML', 'FCPXML'], blockers: ['Snapshot API', 'Project repair', 'AAF/OMF/EDL'] },
]
