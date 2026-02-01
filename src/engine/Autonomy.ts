// Autonomy Engine - Self-managing AI swarm
// Creates accounts, manages credentials, operates independently

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export interface ServiceAccount {
  id: string;
  service: string;
  type: 'trading' | 'payment' | 'social' | 'infrastructure' | 'ai';
  status: 'pending' | 'active' | 'suspended';
  createdAt: Date;
  metadata: Record<string, any>;
}

export interface SwarmIdentity {
  name: string;
  email: string;
  domain: string;
  accounts: ServiceAccount[];
  capabilities: string[];
}

// Services the swarm needs to operate
const REQUIRED_SERVICES = [
  { name: 'Stripe', type: 'payment', purpose: 'Collect payments from clients' },
  { name: 'Alpaca', type: 'trading', purpose: 'Stock/ETF trading' },
  { name: 'Coinbase', type: 'trading', purpose: 'Crypto trading' },
  { name: 'Twitter/X', type: 'social', purpose: 'Find opportunities, outreach' },
  { name: 'GitHub', type: 'infrastructure', purpose: 'Deliver code to clients' },
  { name: 'Vercel', type: 'infrastructure', purpose: 'Deploy projects' },
  { name: 'Supabase', type: 'infrastructure', purpose: 'Backend for projects' },
  { name: 'OpenAI', type: 'ai', purpose: 'Backup LLM' },
  { name: 'Resend', type: 'infrastructure', purpose: 'Send emails to clients' },
];

class AutonomyManager {
  private identity: SwarmIdentity = {
    name: 'Sovereign Swarm',
    email: '',
    domain: 'doesthisfeelright.com',
    accounts: [],
    capabilities: []
  };

  constructor() {
    this.loadState();
  }

  private loadState() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('swarm_autonomy');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.identity = {
          ...parsed,
          accounts: parsed.accounts.map((a: any) => ({
            ...a,
            createdAt: new Date(a.createdAt)
          }))
        };
      }
    }
  }

  private saveState() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('swarm_autonomy', JSON.stringify(this.identity));
    }
  }

  getIdentity(): SwarmIdentity {
    return { ...this.identity };
  }

  setEmail(email: string) {
    this.identity.email = email;
    this.saveState();
  }

  // Register a new account
  registerAccount(service: string, type: ServiceAccount['type'], metadata: Record<string, any> = {}): ServiceAccount {
    const account: ServiceAccount = {
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      service,
      type,
      status: 'active',
      createdAt: new Date(),
      metadata
    };

    this.identity.accounts.push(account);
    this.updateCapabilities();
    this.saveState();

    return account;
  }

  // Check which services are missing
  getMissingServices(): typeof REQUIRED_SERVICES {
    const activeServices = this.identity.accounts
      .filter(a => a.status === 'active')
      .map(a => a.service.toLowerCase());

    return REQUIRED_SERVICES.filter(
      s => !activeServices.includes(s.name.toLowerCase())
    );
  }

  // Update capabilities based on active accounts
  private updateCapabilities() {
    const capabilities: string[] = [];
    const active = this.identity.accounts.filter(a => a.status === 'active');

    if (active.some(a => a.type === 'payment')) {
      capabilities.push('accept_payments');
    }
    if (active.some(a => a.type === 'trading')) {
      capabilities.push('trade_assets');
    }
    if (active.some(a => a.type === 'social')) {
      capabilities.push('social_outreach');
    }
    if (active.some(a => a.service.toLowerCase() === 'github')) {
      capabilities.push('deliver_code');
    }
    if (active.some(a => a.service.toLowerCase() === 'vercel')) {
      capabilities.push('deploy_projects');
    }

    this.identity.capabilities = capabilities;
  }

  // Generate setup instructions for a service
  async generateSetupInstructions(service: string): Promise<string> {
    const model = genAI.getGenerativeModel({
      model: import.meta.env.VITE_GEMINI_MODEL_FLASH || 'gemini-2.0-flash'
    });

    const prompt = `You are helping set up a ${service} account for an autonomous AI swarm called "Sovereign Swarm".

The swarm needs this account to operate independently and make money.

Provide step-by-step instructions for:
1. Creating the account
2. Getting API keys/credentials
3. What permissions/scopes are needed
4. Any verification steps required

Be specific and actionable. The human operator will follow these instructions.`;

    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      return `Error generating instructions for ${service}`;
    }
  }

  // Get autonomy status report
  getStatusReport(): string {
    const { name, email, domain, accounts, capabilities } = this.identity;
    const missing = this.getMissingServices();

    return `
## Swarm Autonomy Status

**Identity:** ${name}
**Email:** ${email || '_Not set_'}
**Domain:** ${domain}

### Active Accounts (${accounts.filter(a => a.status === 'active').length})
${accounts.filter(a => a.status === 'active').map(a => `- ✅ ${a.service} (${a.type})`).join('\n') || '_None_'}

### Missing Services (${missing.length})
${missing.map(s => `- ❌ ${s.name} - ${s.purpose}`).join('\n') || '_All services configured!_'}

### Capabilities
${capabilities.length > 0 ? capabilities.map(c => `- ${c.replace('_', ' ')}`).join('\n') : '_Limited - need more accounts_'}

### Autonomy Level
${this.calculateAutonomyLevel()}
`;
  }

  private calculateAutonomyLevel(): string {
    const total = REQUIRED_SERVICES.length;
    const active = this.identity.accounts.filter(a => a.status === 'active').length;
    const percent = Math.round((active / total) * 100);

    if (percent >= 90) return '🟢 FULLY AUTONOMOUS';
    if (percent >= 60) return '🟡 SEMI-AUTONOMOUS';
    if (percent >= 30) return '🟠 LIMITED AUTONOMY';
    return '🔴 HUMAN DEPENDENT';
  }
}

export const autonomy = new AutonomyManager();

// Revenue loop orchestration
export interface RevenueLoopState {
  isRunning: boolean;
  lastCycle: Date | null;
  cycleCount: number;
  totalRevenue: number;
  totalTradingProfit: number;
}

let revenueLoopState: RevenueLoopState = {
  isRunning: false,
  lastCycle: null,
  cycleCount: 0,
  totalRevenue: 0,
  totalTradingProfit: 0
};

export function getRevenueLoopState(): RevenueLoopState {
  return { ...revenueLoopState };
}

// The main autonomous revenue loop
export async function runRevenueCycle(): Promise<string> {
  const report: string[] = ['## Revenue Cycle Report\n'];

  // 1. Check for new opportunities (Scout)
  report.push('### 1. Opportunity Scan');
  report.push('Scanning for new opportunities...');

  // 2. Process pending projects (Builder)
  report.push('\n### 2. Project Processing');
  report.push('Checking pending projects...');

  // 3. Trading operations (Trader)
  report.push('\n### 3. Trading Operations');
  report.push('Analyzing markets...');

  // 4. Treasury reconciliation
  report.push('\n### 4. Treasury Update');
  report.push('Reconciling finances...');

  revenueLoopState.lastCycle = new Date();
  revenueLoopState.cycleCount++;

  return report.join('\n');
}
