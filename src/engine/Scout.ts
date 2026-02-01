// Scout Agent - Finds opportunities across the internet
// Monitors Twitter, Reddit, HN for people who need things built

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export interface Opportunity {
  id: string;
  source: 'twitter' | 'reddit' | 'hackernews' | 'manual';
  url?: string;
  author: string;
  content: string;
  timestamp: Date;
  analysis?: OpportunityAnalysis;
}

export interface OpportunityAnalysis {
  isViable: boolean;
  projectType: string;
  estimatedValue: number;
  urgency: 'low' | 'medium' | 'high';
  confidence: number;
  summary: string;
  suggestedApproach: string;
}

// Keywords that indicate someone needs something built
const OPPORTUNITY_KEYWORDS = [
  'need a website',
  'looking for developer',
  'need help building',
  'anyone know how to build',
  'looking to hire',
  'need an app',
  'want to create',
  'need a landing page',
  'looking for someone to build',
  'pay someone to',
  'budget for',
  'freelancer needed',
  'need a bot',
  'automate',
  'need an API',
  'scrape',
  'build me',
  'create a',
  'develop a'
];

// Analyze if a post is a viable opportunity
export async function analyzeOpportunity(content: string, source: string): Promise<OpportunityAnalysis> {
  const model = genAI.getGenerativeModel({
    model: import.meta.env.VITE_GEMINI_MODEL_FLASH || 'gemini-2.0-flash'
  });

  const prompt = `You are Scout, an AI that identifies business opportunities for a development agency.

Analyze this post from ${source}:
"${content}"

Determine:
1. Is this a viable project opportunity? (someone genuinely needs something built)
2. What type of project is it? (landing_page, web_app, mobile_app, api_backend, automation, chatbot, etc.)
3. Estimated value in USD (based on complexity)
4. Urgency level (low/medium/high)
5. Your confidence (0-100) that this is a real opportunity
6. Brief summary of what they need
7. Suggested approach to win this project

Respond in JSON format:
{
  "isViable": boolean,
  "projectType": string,
  "estimatedValue": number,
  "urgency": "low" | "medium" | "high",
  "confidence": number,
  "summary": string,
  "suggestedApproach": string
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as OpportunityAnalysis;
    }
  } catch (error) {
    console.error('Error analyzing opportunity:', error);
  }

  // Default response if analysis fails
  return {
    isViable: false,
    projectType: 'unknown',
    estimatedValue: 0,
    urgency: 'low',
    confidence: 0,
    summary: 'Unable to analyze',
    suggestedApproach: ''
  };
}

// Check if content matches opportunity keywords
export function containsOpportunityKeywords(content: string): boolean {
  const lower = content.toLowerCase();
  return OPPORTUNITY_KEYWORDS.some(keyword => lower.includes(keyword));
}

// Generate a personalized outreach message
export async function generateOutreach(opportunity: Opportunity): Promise<string> {
  if (!opportunity.analysis) return '';

  const model = genAI.getGenerativeModel({
    model: import.meta.env.VITE_GEMINI_MODEL_FLASH || 'gemini-2.0-flash'
  });

  const prompt = `You are Salesman, writing a brief, friendly outreach message to someone who needs development help.

Their post: "${opportunity.content}"

Analysis: ${JSON.stringify(opportunity.analysis)}

Write a short (2-3 sentences) personalized response that:
1. Shows you understand their specific need
2. Briefly mentions you can help
3. Asks one clarifying question
4. Feels human, not salesy

Do NOT:
- Use generic templates
- Be pushy
- Make promises
- Use emojis excessively

Just be helpful and genuine.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error generating outreach:', error);
    return '';
  }
}

// Storage for found opportunities
let opportunities: Opportunity[] = [];

export function addOpportunity(opp: Opportunity) {
  opportunities.push(opp);
  saveOpportunities();
}

export function getOpportunities(): Opportunity[] {
  loadOpportunities();
  return opportunities;
}

export function getViableOpportunities(): Opportunity[] {
  return getOpportunities().filter(o => o.analysis?.isViable && o.analysis.confidence > 50);
}

function saveOpportunities() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('scout_opportunities', JSON.stringify(opportunities));
  }
}

function loadOpportunities() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('scout_opportunities');
    if (saved) {
      opportunities = JSON.parse(saved).map((o: any) => ({
        ...o,
        timestamp: new Date(o.timestamp)
      }));
    }
  }
}

// Manual opportunity submission (for testing or manual finds)
export async function submitOpportunity(
  content: string,
  source: Opportunity['source'],
  author: string = 'unknown',
  url?: string
): Promise<Opportunity> {
  const analysis = await analyzeOpportunity(content, source);

  const opportunity: Opportunity = {
    id: `opp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    source,
    url,
    author,
    content,
    timestamp: new Date(),
    analysis
  };

  addOpportunity(opportunity);
  return opportunity;
}

// Summary for dashboard
export function getScoutSummary(): string {
  const opps = getOpportunities();
  const viable = opps.filter(o => o.analysis?.isViable);
  const totalValue = viable.reduce((sum, o) => sum + (o.analysis?.estimatedValue || 0), 0);

  return `
## Scout Report

**Total Opportunities Found:** ${opps.length}
**Viable Opportunities:** ${viable.length}
**Total Potential Value:** $${totalValue.toLocaleString()}

### Top Opportunities
${viable
  .sort((a, b) => (b.analysis?.estimatedValue || 0) - (a.analysis?.estimatedValue || 0))
  .slice(0, 5)
  .map(o => `- **$${o.analysis?.estimatedValue}** | ${o.analysis?.summary?.slice(0, 50)}...`)
  .join('\n')}
`;
}
