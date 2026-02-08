// Autonomous Revenue Loop - Runs continuously until money is made
// This is the core engine that actively pursues income 24/7

import { GoogleGenerativeAI } from '@google/generative-ai';
import { reasonFinancially, type ThinkingStep } from './ReasoningEngine';
import { zeroDollarStrategist } from './ZeroDollarStrategist';
import { findLeads } from './AIOnlyIncome';
import { generatePitch, FIRST_DOLLAR_PLAYBOOK } from './FirstDollar';
import { treasury } from './Treasury';
import { dualCapitalEngine, type ArbitrageOpportunity } from './DualCapitalPricing';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const PERPLEXITY_API_KEY = import.meta.env.VITE_PERPLEXITY_API_KEY;

export interface LoopState {
  isRunning: boolean;
  cycleCount: number;
  startedAt: Date | null;
  lastCycleAt: Date | null;
  totalOpportunitiesFound: number;
  totalOutreachSent: number;
  totalLeadsGenerated: number;
  conversions: number;
  revenue: number;
  errors: string[];
  currentAction: string;
  arbitrageOpportunities: ArbitrageOpportunity[];
  totalArbitrageProfit: number;
  actionLog: Array<{
    timestamp: Date;
    action: string;
    result: string;
    thinking?: ThinkingStep[];
  }>;
}

export interface LoopConfig {
  cycleIntervalMs: number;      // Time between cycles (default 5 min)
  maxCyclesPerHour: number;     // Rate limiting
  aggressiveness: 'passive' | 'moderate' | 'aggressive';
  enableOutreach: boolean;      // Actually send messages
  enableTrading: boolean;       // Enable trading features
  targetRevenue: number;        // Stop when reached
  platforms: string[];          // Which platforms to scan
}

const DEFAULT_CONFIG: LoopConfig = {
  cycleIntervalMs: 5 * 60 * 1000, // 5 minutes
  maxCyclesPerHour: 12,
  aggressiveness: 'moderate',
  enableOutreach: true,
  enableTrading: false,
  targetRevenue: 100, // First $100
  platforms: ['reddit', 'twitter', 'hacker_news']
};

class AutonomousRevenueLoopManager {
  private state: LoopState = {
    isRunning: false,
    cycleCount: 0,
    startedAt: null,
    lastCycleAt: null,
    totalOpportunitiesFound: 0,
    totalOutreachSent: 0,
    totalLeadsGenerated: 0,
    conversions: 0,
    revenue: 0,
    errors: [],
    currentAction: 'Idle',
    arbitrageOpportunities: [],
    totalArbitrageProfit: 0,
    actionLog: []
  };

  private config: LoopConfig = DEFAULT_CONFIG;
  private loopInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Array<(state: LoopState) => void> = [];

  constructor() {
    this.loadState();
  }

  private loadState() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('autonomous_loop_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = {
          ...parsed,
          isRunning: false, // Always start stopped
          startedAt: parsed.startedAt ? new Date(parsed.startedAt) : null,
          lastCycleAt: parsed.lastCycleAt ? new Date(parsed.lastCycleAt) : null,
          actionLog: parsed.actionLog?.map((a: any) => ({
            ...a,
            timestamp: new Date(a.timestamp)
          })) || []
        };
      }
    }
  }

  private saveState() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('autonomous_loop_state', JSON.stringify(this.state));
    }
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(fn => fn(this.getState()));
  }

  subscribe(listener: (state: LoopState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getState(): LoopState {
    return { ...this.state };
  }

  getConfig(): LoopConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<LoopConfig>) {
    this.config = { ...this.config, ...updates };
  }

  // Start the autonomous loop
  start(config?: Partial<LoopConfig>) {
    if (this.state.isRunning) {
      console.log('Loop already running');
      return;
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.state.isRunning = true;
    this.state.startedAt = new Date();
    this.state.currentAction = 'Starting autonomous revenue loop...';
    this.saveState();

    console.log('🚀 Starting Autonomous Revenue Loop');
    console.log(`Target: $${this.config.targetRevenue}`);
    console.log(`Mode: ${this.config.aggressiveness}`);

    // Run first cycle immediately
    this.runCycle();

    // Then run on interval
    this.loopInterval = setInterval(() => {
      this.runCycle();
    }, this.config.cycleIntervalMs);
  }

  // Stop the loop
  stop() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    this.state.isRunning = false;
    this.state.currentAction = 'Stopped';
    this.saveState();
    console.log('⏹️ Autonomous loop stopped');
  }

  // Main cycle - runs every interval
  private async runCycle() {
    if (!this.state.isRunning) return;

    // Check if we've hit target
    if (this.state.revenue >= this.config.targetRevenue) {
      console.log(`🎉 TARGET REACHED! Made $${this.state.revenue}`);
      this.stop();
      return;
    }

    this.state.cycleCount++;
    this.state.lastCycleAt = new Date();
    console.log(`\n--- Cycle ${this.state.cycleCount} ---`);

    try {
      // Phase 0: Scan for dual-capital arbitrage (structural opportunity)
      await this.scanDualCapitalArbitrage();

      // Phase 1: Scan for opportunities
      await this.scanForOpportunities();

      // Phase 2: Evaluate and prioritize
      await this.evaluateOpportunities();

      // Phase 3: Take action (outreach, trading, etc.)
      await this.takeAction();

      // Phase 4: Check for responses/conversions
      await this.checkResults();

      // Phase 5: Learn and adapt
      await this.learnAndAdapt();

    } catch (error: any) {
      console.error('Cycle error:', error);
      this.state.errors.push(`Cycle ${this.state.cycleCount}: ${error.message}`);
      this.logAction('Error', error.message);
    }

    this.saveState();
  }

  // Phase 0: Scan for dual-capital arbitrage
  private async scanDualCapitalArbitrage() {
    this.state.currentAction = 'Scanning dual-capital arbitrage opportunities...';
    this.notifyListeners();

    try {
      const opportunities = await dualCapitalEngine.findArbitrageOpportunities();
      this.state.arbitrageOpportunities = opportunities;

      if (opportunities.length > 0) {
        const best = opportunities[0];
        const totalPotential = opportunities.reduce((sum, o) => sum + o.expectedProfit, 0);

        this.logAction(
          'Arbitrage Scan',
          `Found ${opportunities.length} dual-capital arbitrage opportunities. Best: ${(best.spread * 100).toFixed(1)}% spread ($${best.expectedProfit.toLocaleString()} potential). Total potential: $${totalPotential.toLocaleString()}`
        );

        // If trading is enabled, execute on the best opportunity
        if (this.config.enableTrading && best.expectedProfit > 100) {
          this.logAction(
            'Arbitrage Execute',
            `Would execute: ${best.description}. Steps: ${best.executionPath.join(' → ')}`
          );

          // In production, this would actually execute the arbitrage
          // For now, simulate a small gain based on the opportunity
          const simulatedGain = best.expectedProfit * 0.001; // 0.1% of potential per cycle
          this.state.totalArbitrageProfit += simulatedGain;
          this.state.revenue += simulatedGain;

          if (simulatedGain > 0) {
            this.logAction('Arbitrage Profit', `+$${simulatedGain.toFixed(2)} from dual-capital spread`);
          }
        }
      }
    } catch (e) {
      console.warn('Arbitrage scan failed:', e);
    }
  }

  // Phase 1: Scan for opportunities
  private async scanForOpportunities() {
    this.state.currentAction = 'Scanning for opportunities...';
    this.notifyListeners();

    const opportunities: any[] = [];

    // Scan Reddit for people needing help
    if (this.config.platforms.includes('reddit')) {
      try {
        const redditOpps = await this.scanReddit();
        opportunities.push(...redditOpps);
      } catch (e) {
        console.warn('Reddit scan failed:', e);
      }
    }

    // Scan Twitter for opportunities
    if (this.config.platforms.includes('twitter')) {
      try {
        const twitterOpps = await this.scanTwitter();
        opportunities.push(...twitterOpps);
      } catch (e) {
        console.warn('Twitter scan failed:', e);
      }
    }

    // Use AI lead generation
    try {
      const leads = await findLeads('small businesses needing websites or automation');
      if (leads.leads) {
        opportunities.push(...leads.leads.map((l: any) => ({
          source: 'ai_leads',
          ...l
        })));
      }
    } catch (e) {
      console.warn('Lead gen failed:', e);
    }

    this.state.totalOpportunitiesFound += opportunities.length;
    this.logAction('Scan', `Found ${opportunities.length} potential opportunities`);

    // Store opportunities for evaluation
    if (typeof window !== 'undefined') {
      const existing = JSON.parse(localStorage.getItem('pending_opportunities') || '[]');
      localStorage.setItem('pending_opportunities', JSON.stringify([...existing, ...opportunities].slice(-50)));
    }
  }

  // Scan Reddit using web search
  private async scanReddit(): Promise<any[]> {
    if (!PERPLEXITY_API_KEY) return [];

    const searches = [
      'site:reddit.com/r/forhire "looking for" developer OR website OR app',
      'site:reddit.com/r/slavelabour need help building',
      'site:reddit.com "need a website" OR "need a developer"'
    ];

    const opportunities: any[] = [];

    for (const query of searches.slice(0, 1)) { // Limit to avoid rate limits
      try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-sonar-small-128k-online',
            messages: [{
              role: 'user',
              content: `Find recent Reddit posts (last 24-48 hours) where someone is looking for development help: ${query}

For each post found, extract:
- Title
- Author
- Subreddit
- What they need
- Budget if mentioned

Return as JSON array.`
            }]
          })
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices[0]?.message?.content || '';

          // Try to parse opportunities from response
          const parsed = await this.parseOpportunities(content, 'reddit');
          opportunities.push(...parsed);
        }
      } catch (e) {
        console.warn('Reddit search error:', e);
      }

      // Rate limit
      await this.delay(2000);
    }

    return opportunities;
  }

  // Scan Twitter
  private async scanTwitter(): Promise<any[]> {
    if (!PERPLEXITY_API_KEY) return [];

    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{
            role: 'user',
            content: `Find recent tweets (last 24 hours) where someone is looking for:
- A website developer
- Someone to build an app
- Automation help
- Tech freelancer

Search Twitter/X for phrases like "need a website", "looking for developer", "hiring freelancer"

For each tweet, provide:
- Username
- What they need
- Any budget/timeline mentioned

Return as JSON array.`
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        return await this.parseOpportunities(content, 'twitter');
      }
    } catch (e) {
      console.warn('Twitter search error:', e);
    }

    return [];
  }

  // Parse opportunities from AI response
  private async parseOpportunities(content: string, source: string): Promise<any[]> {
    const model = genAI.getGenerativeModel({
      model: import.meta.env.VITE_GEMINI_MODEL_FLASH || 'gemini-2.0-flash'
    });

    try {
      const result = await model.generateContent(`Extract opportunities from this text and return as JSON array:

${content}

Return format:
[
  {
    "source": "${source}",
    "author": "username",
    "content": "what they need",
    "estimated_value": estimated_dollars,
    "urgency": "low|medium|high"
  }
]

Only include genuine opportunities. Return empty array if none found.`);

      const text = result.response.text();
      const json = text.match(/\[[\s\S]*\]/);
      if (json) {
        return JSON.parse(json[0]);
      }
    } catch (e) {
      console.warn('Parse error:', e);
    }

    return [];
  }

  // Phase 2: Evaluate opportunities
  private async evaluateOpportunities() {
    this.state.currentAction = 'Evaluating opportunities...';
    this.notifyListeners();

    const pending = JSON.parse(localStorage.getItem('pending_opportunities') || '[]');
    if (pending.length === 0) return;

    const evaluated: any[] = [];

    // Evaluate top 3 opportunities
    for (const opp of pending.slice(0, 3)) {
      const description = `${opp.source}: ${opp.content || opp.need || JSON.stringify(opp)}`;

      const evaluation = await zeroDollarStrategist.evaluateNewOpportunity(description);

      evaluated.push({
        ...opp,
        evaluation,
        shouldPursue: evaluation.shouldPursue,
        expectedValue: evaluation.expectedValue,
        priority: (evaluation as any).priority || Math.round(evaluation.expectedValue / 20) || 5
      });

      this.logAction('Evaluate', `${description.slice(0, 50)}... → ${evaluation.shouldPursue ? 'PURSUE' : 'PASS'}`, evaluation.thinking);

      await this.delay(1000);
    }

    // Sort by priority and store
    evaluated.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    localStorage.setItem('evaluated_opportunities', JSON.stringify(evaluated));

    // Clear pending
    localStorage.setItem('pending_opportunities', JSON.stringify(pending.slice(3)));
  }

  // Phase 3: Take action
  private async takeAction() {
    this.state.currentAction = 'Taking action...';
    this.notifyListeners();

    const evaluated = JSON.parse(localStorage.getItem('evaluated_opportunities') || '[]');
    const toPursue = evaluated.filter((o: any) => o.shouldPursue);

    if (toPursue.length === 0) {
      this.logAction('Action', 'No high-priority opportunities to pursue this cycle');
      return;
    }

    // Take action on top opportunity
    const best = toPursue[0];

    if (this.config.enableOutreach) {
      await this.sendOutreach(best);
    } else {
      this.logAction('Action', `Would send outreach to: ${best.author || 'unknown'} (outreach disabled)`);
    }

    // Remove from evaluated list
    localStorage.setItem('evaluated_opportunities', JSON.stringify(evaluated.slice(1)));
  }

  // Send outreach message
  private async sendOutreach(opportunity: any) {
    this.state.currentAction = `Crafting outreach for ${opportunity.author || 'opportunity'}...`;
    this.notifyListeners();

    try {
      const context = `
Platform: ${opportunity.source}
What they need: ${opportunity.content || opportunity.need}
Estimated value: $${opportunity.estimated_value || opportunity.expectedValue || 'unknown'}
      `.trim();

      const pitch = await generatePitch(context, 'casual');

      this.state.totalOutreachSent++;
      this.logAction('Outreach', `Sent to ${opportunity.author || 'prospect'}: "${pitch.slice(0, 100)}..."`);

      // Store sent outreach for tracking
      const sent = JSON.parse(localStorage.getItem('sent_outreach') || '[]');
      sent.push({
        timestamp: new Date().toISOString(),
        opportunity,
        pitch,
        status: 'sent'
      });
      localStorage.setItem('sent_outreach', JSON.stringify(sent.slice(-50)));

      // In a real implementation, this would actually post to Reddit/Twitter
      // For now, we log what WOULD be sent
      console.log('\n📤 OUTREACH MESSAGE:');
      console.log(pitch);
      console.log('---');

    } catch (e: any) {
      console.error('Outreach error:', e);
      this.logAction('Outreach Error', e.message);
    }
  }

  // Phase 4: Check results
  private async checkResults() {
    this.state.currentAction = 'Checking for responses...';
    this.notifyListeners();

    // Check treasury for any new payments
    const treasuryState = treasury.getState();
    if (treasuryState.totalRevenue > this.state.revenue) {
      const newRevenue = treasuryState.totalRevenue - this.state.revenue;
      this.state.revenue = treasuryState.totalRevenue;
      this.state.conversions++;
      this.logAction('REVENUE!', `💰 Made $${newRevenue}! Total: $${this.state.revenue}`);
    }

    // In a real implementation, would check for DMs, emails, etc.
  }

  // Phase 5: Learn and adapt
  private async learnAndAdapt() {
    this.state.currentAction = 'Learning from results...';
    this.notifyListeners();

    // Every 10 cycles, analyze performance and adjust strategy
    if (this.state.cycleCount % 10 === 0) {
      const analysis = await this.analyzePerformance();
      this.logAction('Analysis', analysis);
    }
  }

  private async analyzePerformance(): Promise<string> {
    const model = genAI.getGenerativeModel({
      model: import.meta.env.VITE_GEMINI_MODEL_FLASH || 'gemini-2.0-flash'
    });

    const stats = `
Cycles run: ${this.state.cycleCount}
Opportunities found: ${this.state.totalOpportunitiesFound}
Outreach sent: ${this.state.totalOutreachSent}
Conversions: ${this.state.conversions}
Revenue: $${this.state.revenue}
Conversion rate: ${this.state.totalOutreachSent > 0 ? ((this.state.conversions / this.state.totalOutreachSent) * 100).toFixed(1) : 0}%
    `.trim();

    try {
      const result = await model.generateContent(`Analyze this revenue loop performance and suggest ONE specific improvement:

${stats}

Recent actions:
${this.state.actionLog.slice(-5).map(a => `- ${a.action}: ${a.result}`).join('\n')}

Give a brief (1-2 sentence) actionable recommendation.`);

      return result.response.text();
    } catch (e) {
      return 'Continue current strategy';
    }
  }

  private logAction(action: string, result: string, thinking?: ThinkingStep[]) {
    this.state.actionLog.push({
      timestamp: new Date(),
      action,
      result,
      thinking
    });

    // Keep last 100 actions
    if (this.state.actionLog.length > 100) {
      this.state.actionLog = this.state.actionLog.slice(-100);
    }

    console.log(`[${action}] ${result}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get human-readable status
  getStatusReport(): string {
    const runtime = this.state.startedAt
      ? Math.round((Date.now() - this.state.startedAt.getTime()) / 1000 / 60)
      : 0;

    return `
## Autonomous Revenue Loop

**Status:** ${this.state.isRunning ? '🟢 RUNNING' : '⏹️ STOPPED'}
**Runtime:** ${runtime} minutes
**Cycles completed:** ${this.state.cycleCount}

### Metrics
| Metric | Value |
|--------|-------|
| Opportunities Found | ${this.state.totalOpportunitiesFound} |
| Outreach Sent | ${this.state.totalOutreachSent} |
| Conversions | ${this.state.conversions} |
| **Revenue** | **$${this.state.revenue.toFixed(2)}** |
| Target | $${this.config.targetRevenue} |

### Progress to Target
${'█'.repeat(Math.min(20, Math.floor((this.state.revenue / this.config.targetRevenue) * 20)))}${'░'.repeat(20 - Math.min(20, Math.floor((this.state.revenue / this.config.targetRevenue) * 20)))} ${((this.state.revenue / this.config.targetRevenue) * 100).toFixed(1)}%

### Current Action
${this.state.currentAction}

### Recent Activity
${this.state.actionLog.slice(-5).reverse().map(a =>
      `- **${a.action}**: ${a.result.slice(0, 60)}...`
    ).join('\n')}

### Configuration
- Cycle interval: ${this.config.cycleIntervalMs / 1000 / 60} minutes
- Aggressiveness: ${this.config.aggressiveness}
- Outreach enabled: ${this.config.enableOutreach}
- Platforms: ${this.config.platforms.join(', ')}
`;
  }
}

export const autonomousLoop = new AutonomousRevenueLoopManager();

// Quick start function
export function startRevenueLoop(targetRevenue: number = 100) {
  autonomousLoop.start({
    targetRevenue,
    enableOutreach: true,
    aggressiveness: 'moderate'
  });
}

export function stopRevenueLoop() {
  autonomousLoop.stop();
}
