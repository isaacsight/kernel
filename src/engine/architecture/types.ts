// ─── Architecture Engine Types ──────────────────────────────
//
// Type definitions for the Architecture Engine — AI-powered
// system design, codebase analysis, code generation, and
// infrastructure planning.

export interface SystemDesign {
  id: string
  name: string
  description: string
  components: ArchComponent[]
  dependencies: Dependency[]
  diagrams: DiagramSpec[]
  created_at: string
}

export interface ArchComponent {
  id: string
  name: string
  type: 'service' | 'database' | 'api' | 'frontend' | 'worker' | 'queue' | 'cache' | 'storage'
  description: string
  technologies: string[]
  interfaces: string[]
}

export interface Dependency {
  from: string  // component id
  to: string    // component id
  type: 'sync' | 'async' | 'data' | 'event'
  description: string
}

export interface DiagramSpec {
  type: 'system' | 'sequence' | 'data_flow' | 'deployment'
  mermaid: string  // Mermaid.js diagram code
}

export interface InfrastructurePlan {
  provider: 'supabase' | 'vercel' | 'aws' | 'gcp' | 'cloudflare'
  services: { name: string; purpose: string; estimated_cost: string }[]
  deployment_steps: string[]
}

export interface CodeGenResult {
  files: { path: string; content: string; language: string }[]
  summary: string
}
