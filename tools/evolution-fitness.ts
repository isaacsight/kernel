export interface EvolutionProposal {
  id: string;
  title: string;
  description: string;
  targetFile: string;
  code: string;
  rationale: string;
  sourceSignals: string[];
}

export interface FitnessScore {
  proposal: EvolutionProposal;
  total: number;
  breakdown: {
    userImpact: number;
    signalAlignment: number;
    reversibility: number;
    compounding: number;
    novelty: number;
    safety: number;
  };
  recommendation: 'apply' | 'defer' | 'reject';
  reason: string;
}

const WEIGHTS = {
  userImpact: 0.30,
  signalAlignment: 0.25,
  reversibility: 0.15,
  compounding: 0.15,
  novelty: 0.10,
  safety: 0.05,
};

export function scoreFitness(
  proposal: EvolutionProposal,
  priorProposals: EvolutionProposal[]
): FitnessScore {
  const breakdown = {
    userImpact: scoreUserImpact(proposal),
    signalAlignment: scoreSignalAlignment(proposal),
    reversibility: scoreReversibility(proposal),
    compounding: scoreCompounding(proposal),
    novelty: scoreNovelty(proposal, priorProposals),
    safety: scoreSafety(proposal),
  };
  const total = (Object.keys(breakdown) as Array<keyof typeof breakdown>).reduce(
    (sum, key) => sum + breakdown[key] * WEIGHTS[key], 0
  );
  let recommendation: FitnessScore['recommendation'] = 'defer';
  let reason = '';
  if (breakdown.safety < 4) {
    recommendation = 'reject';
    reason = 'Safety score too low — touches critical paths without adequate reversibility';
  } else if (total >= 7.0) {
    recommendation = 'apply';
    reason = `High fitness (${total.toFixed(2)}/10) — strong signal alignment and user impact`;
  } else if (total >= 5.0) {
    recommendation = 'defer';
    reason = `Moderate fitness (${total.toFixed(2)}/10) — revisit after more field signal`;
  } else {
    recommendation = 'reject';
    reason = `Low fitness (${total.toFixed(2)}/10) — insufficient signal or impact`;
  }
  return { proposal, total, breakdown, recommendation, reason };
}

function scoreUserImpact(p: EvolutionProposal): number {
  const kw = ['consultation', 'response', 'accuracy', 'speed', 'memory', 'context', 'pricing', 'onboarding'];
  return Math.min(10, 4 + kw.filter(k => p.description.toLowerCase().includes(k)).length * 1.5);
}

function scoreSignalAlignment(p: EvolutionProposal): number {
  const base = Math.min(8, p.sourceSignals.length * 2);
  const hasField = p.sourceSignals.some(s => s.includes('hn') || s.includes('intel') || s.includes('github'));
  return hasField ? Math.min(10, base + 2) : base;
}

function scoreReversibility(p: EvolutionProposal): number {
  const risky = ['DELETE', 'DROP', 'rm -rf', 'process.exit', 'supabase.auth'];
  if (risky.some(r => p.code.includes(r))) return 2;
  return (!p.targetFile.includes('index') && !p.targetFile.includes('core')) ? 9 : 6;
}

function scoreCompounding(p: EvolutionProposal): number {
  const kw = ['fitness', 'signal', 'memory', 'learn', 'pattern', 'daemon', 'loop', 'feedback'];
  return Math.min(10, 3 + kw.filter(k => p.description.toLowerCase().includes(k)).length * 2);
}

function scoreNovelty(p: EvolutionProposal, priors: EvolutionProposal[]): number {
  if (priors.length === 0) return 8;
  const similar = priors.find(
    pr => pr.targetFile === p.targetFile ||
    pr.title.toLowerCase().split(' ').some(w => p.title.toLowerCase().includes(w))
  );
  return similar ? 3 : 8;
}

function scoreSafety(p: EvolutionProposal): number {
  const dangerous = ['eval(', 'Function(', 'child_process', 'exec(', 'stripe.refund'];
  return Math.max(0, 10 - dangerous.filter(d => p.code.includes(d)).length * 3);
}

export function selectBestProposal(
  proposals: EvolutionProposal[],
  priors: EvolutionProposal[]
): FitnessScore | null {
  return proposals
    .map(p => scoreFitness(p, priors))
    .filter(s => s.recommendation === 'apply')
    .sort((a, b) => b.total - a.total)[0] ?? null;
}
