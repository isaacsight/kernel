// Sovereign Swarm Pricing Engine
// Auto-quotes projects based on complexity and deliverables

import { evaluationEngine, type Tier } from './EvaluationEngine';

export interface ProjectQuote {
  id: string;
  type: ProjectType;
  description: string;
  complexity: Complexity;
  deliverables: string[];
  estimatedHours: number;
  breakdown: {
    design: number;
    development: number;
    testing: number;
    deployment: number;
    aiCosts: number;
  };
  subtotal: number;
  margin: number;
  total: number;
  currency: 'usd';
  evaluationId?: string;
  evaluationScore?: number;
  evaluationTier?: Tier;
  evaluationMultiplier?: number;
}

export type ProjectType =
  | 'landing_page'
  | 'web_app'
  | 'mobile_app'
  | 'api_backend'
  | 'design_system'
  | 'automation'
  | 'chatbot'
  | 'data_pipeline'
  | 'custom';

export type Complexity = 'simple' | 'moderate' | 'complex' | 'enterprise';

const BASE_RATES: Record<ProjectType, { min: number; max: number; baseHours: number }> = {
  landing_page: { min: 75, max: 300, baseHours: 4 },
  web_app: { min: 300, max: 3000, baseHours: 20 },
  mobile_app: { min: 800, max: 8000, baseHours: 40 },
  api_backend: { min: 200, max: 1500, baseHours: 12 },
  design_system: { min: 150, max: 800, baseHours: 8 },
  automation: { min: 100, max: 500, baseHours: 6 },
  chatbot: { min: 200, max: 1000, baseHours: 10 },
  data_pipeline: { min: 300, max: 2000, baseHours: 15 },
  custom: { min: 100, max: 10000, baseHours: 10 }
};

const COMPLEXITY_MULTIPLIERS: Record<Complexity, number> = {
  simple: 1.0,
  moderate: 1.8,
  complex: 3.0,
  enterprise: 5.0
};

const HOURLY_RATE = 50; // Base hourly rate
const AI_COST_PER_REQUEST = 0.01; // Estimated AI API cost per request
const MARGIN = 0.35; // 35% profit margin

export function analyzeProjectComplexity(description: string): Complexity {
  const lowerDesc = description.toLowerCase();

  // Enterprise indicators
  if (
    lowerDesc.includes('enterprise') ||
    lowerDesc.includes('scale') ||
    lowerDesc.includes('million users') ||
    lowerDesc.includes('compliance') ||
    lowerDesc.includes('hipaa') ||
    lowerDesc.includes('sox')
  ) {
    return 'enterprise';
  }

  // Complex indicators
  if (
    lowerDesc.includes('real-time') ||
    lowerDesc.includes('machine learning') ||
    lowerDesc.includes('ai model') ||
    lowerDesc.includes('microservices') ||
    lowerDesc.includes('distributed') ||
    lowerDesc.includes('blockchain')
  ) {
    return 'complex';
  }

  // Moderate indicators
  if (
    lowerDesc.includes('database') ||
    lowerDesc.includes('authentication') ||
    lowerDesc.includes('api') ||
    lowerDesc.includes('integration') ||
    lowerDesc.includes('dashboard') ||
    lowerDesc.includes('admin')
  ) {
    return 'moderate';
  }

  return 'simple';
}

export function detectProjectType(description: string): ProjectType {
  const lowerDesc = description.toLowerCase();

  if (lowerDesc.includes('landing') || lowerDesc.includes('homepage') || lowerDesc.includes('single page')) {
    return 'landing_page';
  }
  if (lowerDesc.includes('mobile') || lowerDesc.includes('ios') || lowerDesc.includes('android') || lowerDesc.includes('app store')) {
    return 'mobile_app';
  }
  if (lowerDesc.includes('api') || lowerDesc.includes('backend') || lowerDesc.includes('server') || lowerDesc.includes('endpoint')) {
    return 'api_backend';
  }
  if (lowerDesc.includes('design system') || lowerDesc.includes('component library') || lowerDesc.includes('ui kit')) {
    return 'design_system';
  }
  if (lowerDesc.includes('automat') || lowerDesc.includes('workflow') || lowerDesc.includes('script')) {
    return 'automation';
  }
  if (lowerDesc.includes('chatbot') || lowerDesc.includes('assistant') || lowerDesc.includes('conversational')) {
    return 'chatbot';
  }
  if (lowerDesc.includes('data') || lowerDesc.includes('pipeline') || lowerDesc.includes('etl') || lowerDesc.includes('analytics')) {
    return 'data_pipeline';
  }
  if (lowerDesc.includes('web app') || lowerDesc.includes('webapp') || lowerDesc.includes('saas') || lowerDesc.includes('platform')) {
    return 'web_app';
  }

  return 'web_app'; // Default
}

export function generateQuote(description: string, overrideType?: ProjectType, evaluationScore?: number): ProjectQuote {
  const type = overrideType || detectProjectType(description);
  const complexity = analyzeProjectComplexity(description);
  const rates = BASE_RATES[type];
  const multiplier = COMPLEXITY_MULTIPLIERS[complexity];

  // Calculate hours
  const estimatedHours = Math.ceil(rates.baseHours * multiplier);

  // Calculate breakdown
  const breakdown = {
    design: Math.round(estimatedHours * 0.2 * HOURLY_RATE),
    development: Math.round(estimatedHours * 0.5 * HOURLY_RATE),
    testing: Math.round(estimatedHours * 0.15 * HOURLY_RATE),
    deployment: Math.round(estimatedHours * 0.1 * HOURLY_RATE),
    aiCosts: Math.round(estimatedHours * 10 * AI_COST_PER_REQUEST * 100) / 100 // ~10 AI calls per hour
  };

  const subtotal = breakdown.design + breakdown.development + breakdown.testing + breakdown.deployment + breakdown.aiCosts;

  // Apply evaluation multiplier if score provided
  let evalMultiplier = 1;
  let evalTier: Tier | undefined;
  let evalId: string | undefined;
  if (evaluationScore != null) {
    const evalResult = evaluationEngine.getPricingMultiplier(evaluationScore);
    evalMultiplier = evalResult.multiplier;
    evalTier = evalResult.tier;
  }

  const adjustedSubtotal = Math.round(subtotal * evalMultiplier);
  const margin = Math.round(adjustedSubtotal * MARGIN);
  const total = adjustedSubtotal + margin;

  // Ensure within bounds
  const finalTotal = Math.max(rates.min, Math.min(rates.max, total));

  // Generate deliverables based on type
  const deliverables = generateDeliverables(type, complexity);

  return {
    id: `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    description,
    complexity,
    deliverables,
    estimatedHours,
    breakdown,
    subtotal: adjustedSubtotal,
    margin,
    total: finalTotal,
    currency: 'usd',
    evaluationScore,
    evaluationTier: evalTier,
    evaluationMultiplier: evaluationScore != null ? evalMultiplier : undefined,
  };
}

function generateDeliverables(type: ProjectType, complexity: Complexity): string[] {
  const base: Record<ProjectType, string[]> = {
    landing_page: ['Responsive landing page', 'Mobile-optimized design', 'SEO meta tags', 'Contact form'],
    web_app: ['Full web application', 'User authentication', 'Database setup', 'Admin dashboard', 'API endpoints'],
    mobile_app: ['Cross-platform mobile app', 'Push notifications', 'Offline support', 'App store assets'],
    api_backend: ['RESTful API', 'Database schema', 'Authentication middleware', 'API documentation'],
    design_system: ['Component library', 'Design tokens', 'Documentation', 'Figma/Sketch files'],
    automation: ['Automated workflow', 'Scheduling system', 'Error handling', 'Logging'],
    chatbot: ['Conversational AI bot', 'Intent recognition', 'Multi-platform deployment', 'Analytics'],
    data_pipeline: ['ETL pipeline', 'Data validation', 'Scheduling', 'Monitoring dashboard'],
    custom: ['Custom solution', 'Documentation', 'Deployment']
  };

  const extras: Record<Complexity, string[]> = {
    simple: [],
    moderate: ['Testing suite', 'CI/CD pipeline'],
    complex: ['Testing suite', 'CI/CD pipeline', 'Performance optimization', 'Security audit'],
    enterprise: ['Testing suite', 'CI/CD pipeline', 'Performance optimization', 'Security audit', 'SLA support', 'Compliance documentation']
  };

  return [...base[type], ...extras[complexity]];
}

export function formatQuoteForDisplay(quote: ProjectQuote): string {
  return `
## Project Quote

**Type:** ${quote.type.replace('_', ' ').toUpperCase()}
**Complexity:** ${quote.complexity.charAt(0).toUpperCase() + quote.complexity.slice(1)}
**Estimated Hours:** ${quote.estimatedHours}h

### Deliverables
${quote.deliverables.map(d => `- ${d}`).join('\n')}

### Cost Breakdown
- Design: $${quote.breakdown.design}
- Development: $${quote.breakdown.development}
- Testing: $${quote.breakdown.testing}
- Deployment: $${quote.breakdown.deployment}
- AI Processing: $${quote.breakdown.aiCosts}

**Subtotal:** $${quote.subtotal}
**Service Fee:** $${quote.margin}

## Total: $${quote.total} USD
`;
}
