// Sovereign Swarm Treasury
// Tracks revenue, costs, payments, and financial health

import type { ProjectQuote } from './PricingEngine';

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: 'project' | 'ai_costs' | 'infrastructure' | 'payout';
  amount: number;
  description: string;
  projectId?: string;
  stripePaymentId?: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
}

export interface Project {
  id: string;
  clientEmail: string;
  description: string;
  quote: ProjectQuote;
  status: 'quoted' | 'paid' | 'in_progress' | 'delivered' | 'completed';
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  paidAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
}

export interface TreasuryState {
  balance: number;
  totalRevenue: number;
  totalExpenses: number;
  pendingPayments: number;
  projectsCompleted: number;
  projectsInProgress: number;
  transactions: Transaction[];
  projects: Project[];
}

class TreasuryManager {
  private state: TreasuryState = {
    balance: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    pendingPayments: 0,
    projectsCompleted: 0,
    projectsInProgress: 0,
    transactions: [],
    projects: []
  };

  constructor() {
    this.loadState();
  }

  private loadState() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sovereign_treasury');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = {
          ...parsed,
          transactions: parsed.transactions.map((t: any) => ({
            ...t,
            timestamp: new Date(t.timestamp)
          })),
          projects: parsed.projects.map((p: any) => ({
            ...p,
            createdAt: new Date(p.createdAt),
            paidAt: p.paidAt ? new Date(p.paidAt) : undefined,
            deliveredAt: p.deliveredAt ? new Date(p.deliveredAt) : undefined
          }))
        };
      }
    }
  }

  private saveState() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sovereign_treasury', JSON.stringify(this.state));
    }
  }

  getState(): TreasuryState {
    return { ...this.state };
  }

  createProject(clientEmail: string, description: string, quote: ProjectQuote): Project {
    const project: Project = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      clientEmail,
      description,
      quote,
      status: 'quoted',
      createdAt: new Date()
    };

    this.state.projects.push(project);
    this.state.pendingPayments += quote.total;
    this.saveState();

    return project;
  }

  recordPayment(projectId: string, stripePaymentIntentId: string): boolean {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return false;

    project.status = 'paid';
    project.stripePaymentIntentId = stripePaymentIntentId;
    project.paidAt = new Date();

    const transaction: Transaction = {
      id: `txn_${Date.now()}`,
      type: 'income',
      category: 'project',
      amount: project.quote.total,
      description: `Payment for ${project.quote.type}: ${project.description.slice(0, 50)}...`,
      projectId: project.id,
      stripePaymentId: stripePaymentIntentId,
      timestamp: new Date(),
      status: 'completed'
    };

    this.state.transactions.push(transaction);
    this.state.totalRevenue += project.quote.total;
    this.state.balance += project.quote.total;
    this.state.pendingPayments -= project.quote.total;
    this.state.projectsInProgress += 1;

    this.saveState();
    return true;
  }

  markProjectDelivered(projectId: string): boolean {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project || project.status !== 'in_progress') return false;

    project.status = 'delivered';
    project.deliveredAt = new Date();
    this.saveState();
    return true;
  }

  markProjectCompleted(projectId: string): boolean {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return false;

    project.status = 'completed';
    this.state.projectsInProgress -= 1;
    this.state.projectsCompleted += 1;
    this.saveState();
    return true;
  }

  recordExpense(category: Transaction['category'], amount: number, description: string): void {
    const transaction: Transaction = {
      id: `txn_${Date.now()}`,
      type: 'expense',
      category,
      amount,
      description,
      timestamp: new Date(),
      status: 'completed'
    };

    this.state.transactions.push(transaction);
    this.state.totalExpenses += amount;
    this.state.balance -= amount;
    this.saveState();
  }

  getFinancialSummary(): string {
    const { balance, totalRevenue, totalExpenses, projectsCompleted, projectsInProgress, pendingPayments } = this.state;
    const profit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : '0';

    return `
## Treasury Report

**Balance:** $${balance.toFixed(2)}
**Total Revenue:** $${totalRevenue.toFixed(2)}
**Total Expenses:** $${totalExpenses.toFixed(2)}
**Net Profit:** $${profit.toFixed(2)} (${profitMargin}% margin)

**Pending Payments:** $${pendingPayments.toFixed(2)}
**Projects In Progress:** ${projectsInProgress}
**Projects Completed:** ${projectsCompleted}

### Recent Transactions
${this.state.transactions.slice(-5).reverse().map(t =>
  `- ${t.type === 'income' ? '+' : '-'}$${t.amount.toFixed(2)} | ${t.description.slice(0, 40)}...`
).join('\n')}
`;
  }

  getProjectById(id: string): Project | undefined {
    return this.state.projects.find(p => p.id === id);
  }

  getPendingProjects(): Project[] {
    return this.state.projects.filter(p => p.status === 'paid' || p.status === 'in_progress');
  }
}

export const treasury = new TreasuryManager();
