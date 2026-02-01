// Bootstrap Engine - Start from $0 and grow
// Tracks the swarm's journey from nothing to autonomous wealth

export interface BootstrapState {
  startedAt: Date;
  currentPhase: 'infrastructure' | 'first_client' | 'reinvestment' | 'scaling' | 'autonomous';
  totalEarned: number;
  totalSpent: number;
  netProfit: number;
  projectsCompleted: number;
  tradingPnL: number;
  milestones: Milestone[];
  accounts: AccountStatus[];
}

export interface Milestone {
  id: string;
  name: string;
  target: number;
  achieved: boolean;
  achievedAt?: Date;
}

export interface AccountStatus {
  service: string;
  status: 'not_started' | 'pending' | 'active' | 'error';
  tier: 'free' | 'paid';
  monthlyCost: number;
  setupUrl: string;
}

const INITIAL_MILESTONES: Milestone[] = [
  { id: 'first_dollar', name: 'First Dollar', target: 1, achieved: false },
  { id: 'first_hundred', name: '$100 Revenue', target: 100, achieved: false },
  { id: 'first_thousand', name: '$1,000 Revenue', target: 1000, achieved: false },
  { id: 'first_trade', name: 'First Trade', target: 1, achieved: false },
  { id: 'profitable_trading', name: 'Profitable Trading', target: 100, achieved: false },
  { id: 'ten_thousand', name: '$10,000 Revenue', target: 10000, achieved: false },
  { id: 'fully_autonomous', name: 'Fully Autonomous', target: 1, achieved: false },
];

const REQUIRED_ACCOUNTS: AccountStatus[] = [
  {
    service: 'Vercel',
    status: 'not_started',
    tier: 'free',
    monthlyCost: 0,
    setupUrl: 'https://vercel.com/signup'
  },
  {
    service: 'Stripe',
    status: 'not_started',
    tier: 'free',
    monthlyCost: 0,
    setupUrl: 'https://dashboard.stripe.com/register'
  },
  {
    service: 'Supabase',
    status: 'not_started',
    tier: 'free',
    monthlyCost: 0,
    setupUrl: 'https://supabase.com/dashboard'
  },
  {
    service: 'Resend',
    status: 'not_started',
    tier: 'free',
    monthlyCost: 0,
    setupUrl: 'https://resend.com/signup'
  },
  {
    service: 'Alpaca',
    status: 'not_started',
    tier: 'free',
    monthlyCost: 0,
    setupUrl: 'https://app.alpaca.markets/signup'
  },
  {
    service: 'GitHub',
    status: 'active',
    tier: 'free',
    monthlyCost: 0,
    setupUrl: 'https://github.com'
  },
];

class BootstrapManager {
  private state: BootstrapState;

  constructor() {
    this.state = this.loadState() || {
      startedAt: new Date(),
      currentPhase: 'infrastructure',
      totalEarned: 0,
      totalSpent: 0,
      netProfit: 0,
      projectsCompleted: 0,
      tradingPnL: 0,
      milestones: [...INITIAL_MILESTONES],
      accounts: [...REQUIRED_ACCOUNTS]
    };
  }

  private loadState(): BootstrapState | null {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('swarm_bootstrap');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          startedAt: new Date(parsed.startedAt),
          milestones: parsed.milestones.map((m: any) => ({
            ...m,
            achievedAt: m.achievedAt ? new Date(m.achievedAt) : undefined
          }))
        };
      }
    }
    return null;
  }

  private saveState() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('swarm_bootstrap', JSON.stringify(this.state));
    }
  }

  getState(): BootstrapState {
    return { ...this.state };
  }

  // Record revenue
  recordRevenue(amount: number) {
    this.state.totalEarned += amount;
    this.state.netProfit = this.state.totalEarned - this.state.totalSpent;
    this.checkMilestones();
    this.updatePhase();
    this.saveState();
  }

  // Record expense
  recordExpense(amount: number) {
    this.state.totalSpent += amount;
    this.state.netProfit = this.state.totalEarned - this.state.totalSpent;
    this.saveState();
  }

  // Record trading P&L
  recordTradingPnL(pnl: number) {
    this.state.tradingPnL += pnl;
    if (pnl > 0) {
      this.state.totalEarned += pnl;
    } else {
      this.state.totalSpent += Math.abs(pnl);
    }
    this.state.netProfit = this.state.totalEarned - this.state.totalSpent;
    this.checkMilestones();
    this.saveState();
  }

  // Complete a project
  completeProject() {
    this.state.projectsCompleted += 1;
    this.saveState();
  }

  // Update account status
  updateAccountStatus(service: string, status: AccountStatus['status'], tier?: 'free' | 'paid') {
    const account = this.state.accounts.find(a => a.service === service);
    if (account) {
      account.status = status;
      if (tier) account.tier = tier;
    }
    this.updatePhase();
    this.saveState();
  }

  private checkMilestones() {
    const { totalEarned, tradingPnL, projectsCompleted } = this.state;

    for (const milestone of this.state.milestones) {
      if (milestone.achieved) continue;

      let achieved = false;

      switch (milestone.id) {
        case 'first_dollar':
          achieved = totalEarned >= 1;
          break;
        case 'first_hundred':
          achieved = totalEarned >= 100;
          break;
        case 'first_thousand':
          achieved = totalEarned >= 1000;
          break;
        case 'ten_thousand':
          achieved = totalEarned >= 10000;
          break;
        case 'first_trade':
          achieved = tradingPnL !== 0;
          break;
        case 'profitable_trading':
          achieved = tradingPnL >= 100;
          break;
        case 'fully_autonomous':
          achieved = this.state.accounts.every(a => a.status === 'active') && projectsCompleted >= 10;
          break;
      }

      if (achieved) {
        milestone.achieved = true;
        milestone.achievedAt = new Date();
      }
    }
  }

  private updatePhase() {
    const activeAccounts = this.state.accounts.filter(a => a.status === 'active').length;
    const totalAccounts = this.state.accounts.length;
    const { totalEarned, projectsCompleted } = this.state;

    if (activeAccounts < totalAccounts * 0.5) {
      this.state.currentPhase = 'infrastructure';
    } else if (projectsCompleted === 0) {
      this.state.currentPhase = 'first_client';
    } else if (totalEarned < 1000) {
      this.state.currentPhase = 'reinvestment';
    } else if (totalEarned < 10000) {
      this.state.currentPhase = 'scaling';
    } else {
      this.state.currentPhase = 'autonomous';
    }
  }

  // Get allocation recommendation based on current earnings
  getAllocationRecommendation(): { reserve: number; trading: number; tools: number; marketing: number } {
    const available = this.state.netProfit;

    return {
      reserve: Math.round(available * 0.4 * 100) / 100,
      trading: Math.round(available * 0.3 * 100) / 100,
      tools: Math.round(available * 0.2 * 100) / 100,
      marketing: Math.round(available * 0.1 * 100) / 100
    };
  }

  // Get status report
  getReport(): string {
    const {
      startedAt, currentPhase, totalEarned, totalSpent, netProfit,
      projectsCompleted, tradingPnL, milestones, accounts
    } = this.state;

    const daysSinceStart = Math.floor((Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24));
    const achievedMilestones = milestones.filter(m => m.achieved);
    const activeAccounts = accounts.filter(a => a.status === 'active');

    return `
# Sovereign Swarm Bootstrap Status

**Started:** ${startedAt.toLocaleDateString()} (${daysSinceStart} days ago)
**Phase:** ${currentPhase.replace('_', ' ').toUpperCase()}

## Financials
| Metric | Value |
|--------|-------|
| Total Earned | $${totalEarned.toFixed(2)} |
| Total Spent | $${totalSpent.toFixed(2)} |
| Net Profit | $${netProfit.toFixed(2)} |
| Trading P&L | $${tradingPnL.toFixed(2)} |
| Projects Completed | ${projectsCompleted} |

## Infrastructure (${activeAccounts.length}/${accounts.length})
${accounts.map(a => `${a.status === 'active' ? '✅' : '⬜'} ${a.service} (${a.tier})`).join('\n')}

## Milestones (${achievedMilestones.length}/${milestones.length})
${milestones.map(m => `${m.achieved ? '🏆' : '⬜'} ${m.name}${m.achieved && m.achievedAt ? ` - ${m.achievedAt.toLocaleDateString()}` : ''}`).join('\n')}

## Recommended Allocation
${Object.entries(this.getAllocationRecommendation()).map(([k, v]) => `- ${k}: $${v}`).join('\n')}
`;
  }
}

export const bootstrap = new BootstrapManager();

// First client acquisition message templates
export const OUTREACH_TEMPLATES = {
  reddit_forhire: `**[FOR HIRE] AI-Powered Dev Team | Landing Pages from $75 | 24-48hr Delivery**

Hey r/forhire! We're Sovereign Swarm - an AI-augmented dev team that delivers fast, quality work at startup-friendly prices.

**What we build:**
- Landing pages ($75-150)
- Web apps ($300-2000)
- APIs & backends ($200-1000)
- Automations & bots ($100-500)

**Why us:**
- 24-48 hour turnaround on small projects
- AI-assisted development = faster delivery
- Clean, modern code
- Free revisions until you're happy

**Portfolio:** doesthisfeelright.com

Drop a comment or DM with what you need. Happy to provide a free quote.`,

  twitter_reply: `Hey! I build landing pages and web apps fast (24-48hrs).

If you want, I can put together a quick quote for you - no obligation. Just DM me what you're thinking.`,

  cold_email: `Subject: Quick question about your website

Hi {{name}},

I noticed {{business}} doesn't have a website yet (or the current one could use an update).

I help small businesses get online fast with clean, professional landing pages. Usually takes me 24-48 hours and starts at $75.

Would you be interested in a free mockup? No strings attached - just want to show you what's possible.

Best,
Sovereign Swarm
doesthisfeelright.com`
};
