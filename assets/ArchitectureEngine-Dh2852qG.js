import{claudeJSON as a}from"./ClaudeClient-BPOpLH2k.js";import"./index-B1_JPBCC.js";import"./vendor-i18n-CwQ6O4IN.js";import"./vendor-react-C1MACuvJ.js";import"./vendor-ui-BvJVCMFR.js";import"./vendor-supabase-B9q_TACa.js";const o=`You are a senior software architect. You analyze systems, design architectures, generate code, and plan infrastructure.

Your responses must be precise, production-ready, and follow modern best practices.

When generating Mermaid diagrams, use valid Mermaid.js syntax.
When generating code, use clean, typed, well-documented patterns.
When planning infrastructure, provide realistic cost estimates and clear deployment steps.

Always respond with valid JSON matching the requested schema.`;function r(){return`arch_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}async function g(e){const t=`Analyze the following codebase/system description and produce a complete system design.

DESCRIPTION:
${e}

Respond with a JSON object matching this exact schema:
{
  "name": "string — system name",
  "description": "string — one-paragraph summary",
  "components": [
    {
      "id": "string — unique component id (e.g. 'svc_auth')",
      "name": "string — human-readable name",
      "type": "service | database | api | frontend | worker | queue | cache | storage",
      "description": "string — what this component does",
      "technologies": ["string — tech used (e.g. 'React', 'PostgreSQL')"],
      "interfaces": ["string — exposed interfaces (e.g. 'REST /api/users', 'WebSocket')"]
    }
  ],
  "dependencies": [
    {
      "from": "string — source component id",
      "to": "string — target component id",
      "type": "sync | async | data | event",
      "description": "string — what flows between them"
    }
  ],
  "diagrams": [
    {
      "type": "system | sequence | data_flow | deployment",
      "mermaid": "string — valid Mermaid.js diagram code"
    }
  ]
}

Include at least one system diagram and one data_flow diagram.`,n=await a(t,{system:o,model:"sonnet",max_tokens:8192});return{id:r(),created_at:new Date().toISOString(),...n}}async function u(e){const t=`Design a complete software system architecture from the following requirements.

REQUIREMENTS:
${e}

You must design the full architecture including:
1. All necessary components (services, databases, APIs, frontends, workers, caches, etc.)
2. Dependencies and data flows between components
3. Technology recommendations for each component
4. Mermaid diagrams showing the system architecture

Respond with a JSON object matching this exact schema:
{
  "name": "string — system name",
  "description": "string — one-paragraph summary of the architecture",
  "components": [
    {
      "id": "string — unique component id",
      "name": "string — human-readable name",
      "type": "service | database | api | frontend | worker | queue | cache | storage",
      "description": "string — component purpose and responsibilities",
      "technologies": ["string — recommended technologies"],
      "interfaces": ["string — exposed interfaces"]
    }
  ],
  "dependencies": [
    {
      "from": "string — source component id",
      "to": "string — target component id",
      "type": "sync | async | data | event",
      "description": "string — what data/control flows between them"
    }
  ],
  "diagrams": [
    {
      "type": "system | sequence | data_flow | deployment",
      "mermaid": "string — valid Mermaid.js diagram code"
    }
  ]
}

Include at least: one system overview diagram, one data_flow diagram, and one deployment diagram.`,n=await a(t,{system:o,model:"sonnet",max_tokens:8192});return{id:r(),created_at:new Date().toISOString(),...n}}async function h(e,t){const n=`Generate production-ready code from the following specification.

SPECIFICATION:
${e}

TARGET LANGUAGE: ${t}

Generate clean, well-documented, typed code. Split into logical files.

Respond with a JSON object matching this schema:
{
  "files": [
    {
      "path": "string — relative file path (e.g. 'src/services/auth.ts')",
      "content": "string — full file content",
      "language": "string — file language (e.g. 'typescript', 'python')"
    }
  ],
  "summary": "string — brief summary of what was generated and how the files relate"
}`;return await a(n,{system:o,model:"sonnet",max_tokens:8192})}async function y(e){const t=e.components.map(s=>`- ${s.name} (${s.type}): ${s.description} [${s.technologies.join(", ")}]`).join(`
`),n=`Plan the infrastructure for the following system design.

SYSTEM: ${e.name}
DESCRIPTION: ${e.description}

COMPONENTS:
${t}

Recommend the best cloud provider and services to deploy this system.
Include realistic cost estimates (monthly) and concrete deployment steps.

Respond with a JSON object matching this schema:
{
  "provider": "supabase | vercel | aws | gcp | cloudflare",
  "services": [
    {
      "name": "string — service name (e.g. 'Supabase PostgreSQL', 'Vercel Edge Functions')",
      "purpose": "string — what this service handles in the architecture",
      "estimated_cost": "string — monthly cost estimate (e.g. '$25/mo', 'Free tier')"
    }
  ],
  "deployment_steps": [
    "string — ordered deployment step (e.g. '1. Provision PostgreSQL database')"
  ]
}`;return await a(n,{system:o,model:"sonnet",max_tokens:4096})}export{g as analyzeCodebase,u as designSystem,h as generateCode,y as planInfrastructure};
