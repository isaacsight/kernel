export interface ConsultationRequest {
  id: string;
  clientEmail: string;
  subject: string;
  body: string;
  receivedAt: string;
}

export interface ValuationResult {
  requestId: string;
  finalPrice: number;
  tier: 'quick' | 'standard' | 'deep' | 'strategic';
  estimatedHours: number;
  deliverables: string[];
  proposalEmail: string;
}

const TIERS = {
  quick:     { min: 25,  max: 75,  hours: 0.5 },
  standard:  { min: 75,  max: 200, hours: 2 },
  deep:      { min: 200, max: 350, hours: 5 },
  strategic: { min: 350, max: 500, hours: 10 },
} as const;

const HIGH_VALUE_DOMAINS = [
  'fintech','crypto','ai','saas','enterprise','security','healthcare','legal','fundraising','acquisition',
];

const COMPLEXITY_SIGNALS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /architect|system design|scale/i, weight: 2 },
  { pattern: /mvp|prototype|quick/i,           weight: -1 },
  { pattern: /team|organization|process/i,     weight: 1.5 },
  { pattern: /legacy|migration|refactor/i,     weight: 2 },
  { pattern: /audit|security|compliance/i,     weight: 2.5 },
  { pattern: /strategy|roadmap|direction/i,    weight: 1.5 },
];

export function valuateConsultation(req: ConsultationRequest): ValuationResult {
  const text = `${req.subject} ${req.body}`;
  let complexityRaw = 2;
  for (const s of COMPLEXITY_SIGNALS) if (s.pattern.test(text)) complexityRaw += s.weight;
  const complexity = Math.max(1, Math.min(5, Math.round(complexityRaw)));
  const urgency = /urgent|asap|today|tomorrow/i.test(text) ? 2 : /rush|quickly|soon/i.test(text) ? 1.5 : 1;
  const domainPremium = 1 + HIGH_VALUE_DOMAINS.filter(d => text.toLowerCase().includes(d)).length * 0.15;
  const scopeScore = Math.min(5, Math.floor(text.split(/\s+/).length / 80));
  const totalSignal = complexity + scopeScore;
  const tier: keyof typeof TIERS =
    totalSignal <= 3 ? 'quick' : totalSignal <= 5 ? 'standard' : totalSignal <= 8 ? 'deep' : 'strategic';
  const cfg = TIERS[tier];
  const marketRate = cfg.min + (cfg.max - cfg.min) * 0.6;
  const finalPrice = Math.round(Math.min(500, Math.max(25, marketRate * domainPremium * urgency)) / 5) * 5;
  const estimatedHours = cfg.hours * urgency;
  const deliverables = buildDeliverables(tier);
  const proposalEmail = buildProposalEmail(finalPrice, tier, estimatedHours, deliverables);
  return { requestId: req.id, finalPrice, tier, estimatedHours, deliverables, proposalEmail };
}

function buildDeliverables(tier: keyof typeof TIERS): string[] {
  const base = ['Written analysis delivered via email', 'Actionable recommendations with priority order'];
  if (tier === 'quick') return base;
  if (tier === 'standard') return [...base, 'Architecture diagram or decision framework', '1 follow-up Q&A round (48hr window)'];
  if (tier === 'deep') return [...base, 'Full technical audit with findings', 'Phased implementation roadmap', 'Risk assessment', '3 follow-up Q&A rounds'];
  return [...base, 'Executive strategic brief', 'Full architecture review', 'Competitive landscape analysis', 'Go-to-market playbook', '2 weeks async advisory access'];
}

function buildProposalEmail(price: number, tier: string, hours: number, deliverables: string[]): string {
  const timeline = hours <= 1 ? '24 hours' : hours <= 5 ? '48-72 hours' : '5 business days';
  return `Thanks for reaching out. Here is what I can offer:\n\n${tier.toUpperCase()} CONSULTATION — $${price}\n\nDeliverables:\n${deliverables.map(d => `• ${d}`).join('\n')}\n\nTimeline: ${timeline}\n\nTo proceed, complete payment at the link below. I begin immediately upon confirmation.\n\n[Payment Link — $${price}]\n\n— kbot`;
}
