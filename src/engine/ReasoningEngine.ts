// Reasoning Engine - DeepSeek-R1 / o1 style chain-of-thought reasoning
// Shows explicit thinking process before arriving at financial decisions

import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './SupabaseClient';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export interface ThinkingStep {
  step: number;
  thought: string;
  type: 'observation' | 'analysis' | 'hypothesis' | 'calculation' | 'conclusion';
}

export interface ReasoningResult {
  thinking: ThinkingStep[];
  conclusion: string;
  confidence: number;
  reasoning_time_ms: number;
  action?: {
    type: string;
    params: Record<string, any>;
  };
}

export interface FinancialReasoning extends ReasoningResult {
  expectedValue: number;
  risk: 'low' | 'medium' | 'high';
  timeToProfit: string;
  requiredCapital: number;
}

// RLHF Feedback storage
export interface FeedbackEntry {
  id: string;
  reasoning_id: string;
  rating: 'positive' | 'negative';
  context: string;
  conclusion: string;
  timestamp: Date;
}

let feedbackLog: FeedbackEntry[] = [];

// Load feedback from storage
function loadFeedback() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('rlhf_feedback');
    if (saved) {
      feedbackLog = JSON.parse(saved);
    }
  }
}

function saveFeedback() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('rlhf_feedback', JSON.stringify(feedbackLog));
  }
}

loadFeedback();

// Record RLHF feedback
export function recordFeedback(
  reasoningId: string,
  rating: 'positive' | 'negative',
  context: string,
  conclusion: string
): void {
  const entry: FeedbackEntry = {
    id: `fb_${Date.now()}`,
    reasoning_id: reasoningId,
    rating,
    context,
    conclusion,
    timestamp: new Date()
  };

  feedbackLog.push(entry);
  saveFeedback();

  // Also try to save to Supabase for training data
  supabase.from('rlhf_feedback').insert(entry).then(({ error }) => {
    if (error) {
      console.log('Feedback saved locally only');
    } else {
      console.log('Feedback saved to Supabase');
    }
  });
}

// Get feedback stats
export function getFeedbackStats(): { positive: number; negative: number; total: number } {
  return {
    positive: feedbackLog.filter(f => f.rating === 'positive').length,
    negative: feedbackLog.filter(f => f.rating === 'negative').length,
    total: feedbackLog.length
  };
}

// Core reasoning function with explicit chain-of-thought
export async function reason(
  question: string,
  context?: string,
  domain: 'financial' | 'technical' | 'strategic' | 'general' = 'general'
): Promise<ReasoningResult> {
  const startTime = Date.now();

  const model = genAI.getGenerativeModel({
    model: import.meta.env.VITE_GEMINI_MODEL_PRO || 'gemini-2.5-pro'
  });

  // Get recent positive feedback to guide reasoning style
  const goodExamples = feedbackLog
    .filter(f => f.rating === 'positive')
    .slice(-3)
    .map(f => f.conclusion)
    .join('\n');

  const systemPrompt = `You are a reasoning engine that thinks step-by-step before reaching conclusions.
${goodExamples ? `\nExamples of reasoning the user found helpful:\n${goodExamples}\n` : ''}

For every question, you must:
1. Break down your thinking into explicit steps
2. Show observations, analysis, hypotheses, calculations, and conclusions
3. Be rigorous and consider multiple angles
4. Quantify when possible
5. Acknowledge uncertainty

Domain: ${domain}
${context ? `Context: ${context}` : ''}

Question: ${question}

Respond in JSON format:
{
  "thinking": [
    {"step": 1, "thought": "First, I observe...", "type": "observation"},
    {"step": 2, "thought": "Analyzing this...", "type": "analysis"},
    {"step": 3, "thought": "My hypothesis is...", "type": "hypothesis"},
    {"step": 4, "thought": "Calculating...", "type": "calculation"},
    {"step": 5, "thought": "Therefore...", "type": "conclusion"}
  ],
  "conclusion": "Final answer with reasoning summary",
  "confidence": 0.0-1.0,
  "action": {
    "type": "suggested_action_type",
    "params": {}
  }
}

Show at least 5 thinking steps. Be thorough.`;

  try {
    const result = await model.generateContent(systemPrompt);
    const text = result.response.text();
    const json = text.match(/\{[\s\S]*\}/);

    if (json) {
      const parsed = JSON.parse(json[0]);
      return {
        ...parsed,
        reasoning_time_ms: Date.now() - startTime
      };
    }
  } catch (error) {
    console.error('Reasoning error:', error);
  }

  return {
    thinking: [{ step: 1, thought: 'Error in reasoning process', type: 'observation' }],
    conclusion: 'Unable to complete reasoning',
    confidence: 0,
    reasoning_time_ms: Date.now() - startTime
  };
}

// Financial reasoning - specialized for $0 to revenue decisions
export async function reasonFinancially(
  situation: string,
  currentCapital: number = 0,
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
): Promise<FinancialReasoning> {
  const startTime = Date.now();

  const model = genAI.getGenerativeModel({
    model: import.meta.env.VITE_GEMINI_MODEL_PRO || 'gemini-2.5-pro'
  });

  const prompt = `You are a financial reasoning engine helping someone bootstrap from $${currentCapital} to profitability.

Risk tolerance: ${riskTolerance}
Current situation: ${situation}

Think through this step-by-step:
1. What resources do we have? (skills, time, existing assets)
2. What are the fastest paths to revenue?
3. What's the expected value of each path?
4. What are the risks?
5. What's the optimal first move?

Respond in JSON:
{
  "thinking": [
    {"step": 1, "thought": "...", "type": "observation"},
    {"step": 2, "thought": "...", "type": "analysis"},
    ...more steps...
  ],
  "conclusion": "Recommended action with clear reasoning",
  "confidence": 0.0-1.0,
  "expectedValue": expected_dollars_in_30_days,
  "risk": "low" | "medium" | "high",
  "timeToProfit": "X days/weeks",
  "requiredCapital": dollars_needed,
  "action": {
    "type": "action_category",
    "params": {
      "specific": "action details"
    }
  }
}

Be specific and actionable. Focus on paths that work with $${currentCapital} starting capital.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const json = text.match(/\{[\s\S]*\}/);

    if (json) {
      const parsed = JSON.parse(json[0]);
      return {
        ...parsed,
        reasoning_time_ms: Date.now() - startTime
      };
    }
  } catch (error) {
    console.error('Financial reasoning error:', error);
  }

  return {
    thinking: [{ step: 1, thought: 'Error in financial reasoning', type: 'observation' }],
    conclusion: 'Unable to complete financial analysis',
    confidence: 0,
    reasoning_time_ms: Date.now() - startTime,
    expectedValue: 0,
    risk: 'high',
    timeToProfit: 'unknown',
    requiredCapital: 0
  };
}

// Opportunity evaluation with reasoning
export async function evaluateOpportunity(
  opportunity: string,
  currentCapital: number = 0
): Promise<FinancialReasoning & { shouldPursue: boolean; priority: number }> {
  const startTime = Date.now();

  const model = genAI.getGenerativeModel({
    model: import.meta.env.VITE_GEMINI_MODEL_PRO || 'gemini-2.5-pro'
  });

  const prompt = `Evaluate this opportunity with rigorous reasoning:

Opportunity: ${opportunity}
Available capital: $${currentCapital}

Think through:
1. What exactly is being offered/requested?
2. What would it take to deliver?
3. What's the realistic probability of success?
4. What's the expected value? (probability × reward - cost)
5. How does this compare to alternatives?
6. What are the second-order effects?

Respond in JSON:
{
  "thinking": [
    {"step": 1, "thought": "Breaking down the opportunity...", "type": "observation"},
    {"step": 2, "thought": "The key requirements are...", "type": "analysis"},
    {"step": 3, "thought": "Success probability estimate...", "type": "calculation"},
    {"step": 4, "thought": "Expected value calculation...", "type": "calculation"},
    {"step": 5, "thought": "Comparing to alternatives...", "type": "analysis"},
    {"step": 6, "thought": "My recommendation is...", "type": "conclusion"}
  ],
  "conclusion": "Clear recommendation with reasoning",
  "confidence": 0.0-1.0,
  "expectedValue": expected_profit_dollars,
  "risk": "low" | "medium" | "high",
  "timeToProfit": "X days/weeks",
  "requiredCapital": dollars_needed,
  "shouldPursue": true/false,
  "priority": 1-10,
  "action": {
    "type": "next_step",
    "params": {}
  }
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const json = text.match(/\{[\s\S]*\}/);

    if (json) {
      const parsed = JSON.parse(json[0]);
      return {
        ...parsed,
        reasoning_time_ms: Date.now() - startTime
      };
    }
  } catch (error) {
    console.error('Opportunity evaluation error:', error);
  }

  return {
    thinking: [{ step: 1, thought: 'Error evaluating opportunity', type: 'observation' }],
    conclusion: 'Unable to evaluate',
    confidence: 0,
    reasoning_time_ms: Date.now() - startTime,
    expectedValue: 0,
    risk: 'high',
    timeToProfit: 'unknown',
    requiredCapital: 0,
    shouldPursue: false,
    priority: 0
  };
}

// Bootstrap strategy - the master plan from $0
export async function createBootstrapStrategy(
  skills: string[],
  timeAvailable: string,
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'
): Promise<{
  thinking: ThinkingStep[];
  phases: Array<{
    name: string;
    goal: string;
    actions: string[];
    expectedRevenue: number;
    timeframe: string;
  }>;
  firstAction: string;
  thirtyDayTarget: number;
  ninetyDayTarget: number;
}> {
  const startTime = Date.now();

  const model = genAI.getGenerativeModel({
    model: import.meta.env.VITE_GEMINI_MODEL_PRO || 'gemini-2.5-pro'
  });

  const prompt = `Create a detailed bootstrap strategy from $0 to sustainable income.

Available skills: ${skills.join(', ')}
Time available: ${timeAvailable}
Risk tolerance: ${riskTolerance}

Think through the optimal path step-by-step:
1. What's the fastest way to first dollar with these skills?
2. How do we scale from first dollar to consistent income?
3. What compounding effects can we leverage?
4. What are the milestones?

Respond in JSON:
{
  "thinking": [
    {"step": 1, "thought": "Given these skills, the highest-value quick wins are...", "type": "observation"},
    {"step": 2, "thought": "The market for these skills shows...", "type": "analysis"},
    {"step": 3, "thought": "Optimal sequencing would be...", "type": "hypothesis"},
    {"step": 4, "thought": "Expected value at each stage...", "type": "calculation"},
    {"step": 5, "thought": "The recommended strategy is...", "type": "conclusion"}
  ],
  "phases": [
    {
      "name": "Phase 1: First Dollar",
      "goal": "Generate first $100",
      "actions": ["specific action 1", "specific action 2"],
      "expectedRevenue": 100,
      "timeframe": "1-7 days"
    },
    {
      "name": "Phase 2: Consistent Income",
      "goal": "Reach $1000/month",
      "actions": ["action 1", "action 2"],
      "expectedRevenue": 1000,
      "timeframe": "30 days"
    },
    {
      "name": "Phase 3: Scale",
      "goal": "Reach $5000/month",
      "actions": ["action 1", "action 2"],
      "expectedRevenue": 5000,
      "timeframe": "90 days"
    }
  ],
  "firstAction": "The exact first thing to do right now",
  "thirtyDayTarget": realistic_30_day_revenue,
  "ninetyDayTarget": realistic_90_day_revenue
}

Be specific. Give actual platforms, actual rates, actual templates.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const json = text.match(/\{[\s\S]*\}/);

    if (json) {
      return JSON.parse(json[0]);
    }
  } catch (error) {
    console.error('Bootstrap strategy error:', error);
  }

  return {
    thinking: [{ step: 1, thought: 'Error creating strategy', type: 'observation' }],
    phases: [],
    firstAction: 'Review available skills and try again',
    thirtyDayTarget: 0,
    ninetyDayTarget: 0
  };
}

// Daily decision making - what to focus on today
export async function decideTodaysFocus(
  currentRevenue: number,
  pendingOpportunities: string[],
  inProgressProjects: string[],
  availableHours: number
): Promise<{
  thinking: ThinkingStep[];
  priorities: Array<{
    task: string;
    reason: string;
    expectedValue: number;
    timeRequired: string;
  }>;
  schedule: Array<{
    time: string;
    task: string;
    duration: string;
  }>;
}> {
  const model = genAI.getGenerativeModel({
    model: import.meta.env.VITE_GEMINI_MODEL_FLASH || 'gemini-2.0-flash'
  });

  const prompt = `Decide the optimal focus for today.

Current monthly revenue: $${currentRevenue}
Available hours today: ${availableHours}
Pending opportunities: ${pendingOpportunities.join(', ') || 'None'}
In-progress projects: ${inProgressProjects.join(', ') || 'None'}

Think through what will maximize value:
1. What has the highest expected value per hour?
2. What has deadlines or time-sensitivity?
3. What compounds over time?

Respond in JSON:
{
  "thinking": [
    {"step": 1, "thought": "...", "type": "observation"},
    {"step": 2, "thought": "...", "type": "analysis"},
    {"step": 3, "thought": "...", "type": "conclusion"}
  ],
  "priorities": [
    {
      "task": "specific task",
      "reason": "why this is priority",
      "expectedValue": dollars,
      "timeRequired": "X hours"
    }
  ],
  "schedule": [
    {
      "time": "9:00 AM",
      "task": "task name",
      "duration": "2 hours"
    }
  ]
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const json = text.match(/\{[\s\S]*\}/);

    if (json) {
      return JSON.parse(json[0]);
    }
  } catch (error) {
    console.error('Daily focus error:', error);
  }

  return {
    thinking: [{ step: 1, thought: 'Error deciding focus', type: 'observation' }],
    priorities: [],
    schedule: []
  };
}

// Export reasoning engine status
export function getReasoningStatus(): string {
  const stats = getFeedbackStats();

  return `
## Reasoning Engine Status

**Model:** DeepSeek-R1 Style Chain-of-Thought
**Feedback collected:** ${stats.total} entries
**Positive signals:** ${stats.positive}
**Negative signals:** ${stats.negative}
**Learning rate:** ${stats.total > 0 ? ((stats.positive / stats.total) * 100).toFixed(1) : 0}% positive

### Capabilities
- Financial reasoning from $0
- Opportunity evaluation with expected value
- Bootstrap strategy generation
- Daily prioritization
- RLHF learning from feedback

### Usage
\`\`\`typescript
import { reasonFinancially, evaluateOpportunity, recordFeedback } from './ReasoningEngine';

// Get financial advice with visible thinking
const result = await reasonFinancially("I have coding skills and 4 hours/day", 0, "moderate");
console.log(result.thinking); // See the reasoning steps
console.log(result.conclusion); // Get the recommendation

// Rate the result to improve future reasoning
recordFeedback(result.id, 'positive', situation, result.conclusion);
\`\`\`
`;
}
