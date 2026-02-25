# Does This Feel Right?

## A White Paper on Building a Sovereign Evaluation Platform

*February 2026*

---

## I. What We've Built

A contemplative, AI-powered platform where visitors describe an idea and receive an honest, multi-dimensional evaluation. The site asks one question — *does this feel right?* — and then answers it with data, narrative, and taste.

### Current Architecture

```
Visitor arrives
  → Describes their idea (free)
  → Instant 6-dimension evaluation (free)
  → AI narrative deep analysis (paid, $2)
  → Auto-generated project quote (free)
  → Contact form for contracting (free)
  → Blog with craft-focused writing
```

### What Exists Today

| Layer | Status | Technology |
|-------|--------|------------|
| **Evaluation Engine** | Live | Keyword heuristics + 6-category scoring + tier system |
| **AI Deep Analysis** | Live | Gemini 2.0 Flash, streaming narrative |
| **Pricing Engine** | Live | Auto-detection of project type, complexity, deliverables |
| **Project Inquiry** | Live | Contact form → localStorage pipeline |
| **Blog** | Live | Markdown posts, tag filtering |
| **Assistant Agent** | Built | Triage, scheduling, daily briefs |
| **Agent Swarm** | Built (not routed) | 8 specialized agents + 3 kernel agents |
| **Reasoning Engine** | Built (not routed) | Chain-of-thought financial decisions |
| **Treasury** | Built (not routed) | Transaction tracking, project lifecycle |
| **Trading Engine** | Built (not routed) | Position management, risk rules |

---

## II. The Revenue Model

### Tier 1: Free Evaluation (Acquisition)

Every visitor gets a free, instant evaluation. This is the hook. It's fast, it's useful, and it demonstrates capability without requiring commitment. The evaluation itself is a product — people share their scores, compare them, come back with new ideas.

**Goal:** Volume. Get as many evaluations as possible to build data and traffic.

### Tier 2: Deep Analysis ($2 per evaluation)

The paid tier unlocks an AI-written narrative analysis: specific risks, blind spots, opportunities, and an honest "does this feel right?" gut take. This is the first dollar.

**Pricing rationale:** $2 is low enough to be impulse, high enough to signal value. Gemini Flash costs ~$0.01 per analysis, so margins are ~99%.

**Goal:** Convert 5-10% of free evaluations to paid analyses. At 100 evaluations/day, that's $10-20/day.

### Tier 3: Project Contracting (High-Value)

After evaluation, visitors who want their project built can get an auto-generated quote and submit an inquiry. The Pricing Engine handles estimation; the Assistant Agent handles triage.

**Goal:** 1-2 projects/month at $500-5,000 each.

### Tier 4: Subscription (Future)

Unlimited deep analyses + priority response on inquiries + access to the Observer (AI agent discussions) for $19/month.

**Goal:** Recurring revenue base. Even 50 subscribers = $950/month.

---

## III. What to Build Next

### Phase 1: Revenue Infrastructure (This Week)

These changes turn the platform from a demo into a business.

**1. Stripe Checkout Integration**
- Wire up real Stripe Checkout for the $2 deep analysis
- Create a minimal backend (Supabase Edge Function or Vercel Serverless) to handle checkout session creation
- Verify payment before running the AI analysis
- Store payment records in Supabase

**2. Lead Capture to Supabase**
- Move project inquiries from localStorage to Supabase
- Send email notifications via Resend when a new inquiry arrives
- Auto-triage using the Assistant Agent's priority classification

**3. Email Notifications**
- Resend integration for:
  - New inquiry alert (to Isaac)
  - Confirmation email (to visitor)
  - Follow-up templates based on tier (drafted by Assistant Agent)

### Phase 2: Assistant Dashboard (Next Week)

A private `/dashboard` route for Isaac to manage his pipeline.

**4. Inquiry Pipeline View**
- All inquiries sorted by evaluation score and tier
- Quick-action buttons: respond, archive, convert to project
- Auto-generated response drafts from the Assistant Agent

**5. Schedule Manager**
- Add/edit time blocks for active projects
- Visual weekly view showing committed hours
- Overcommitment warnings when capacity exceeds available hours
- Daily brief generation — "here's what needs attention today"

**6. Revenue Tracker**
- Integrate Treasury for income/expense tracking
- Show: total revenue, pending invoices, profit margin
- Per-project financials (quoted vs. actual)

### Phase 3: Public Features (Week 3-4)

**7. Observer Mode (Public)**
- Route `/observe` — let visitors watch AI agents discuss a topic they choose
- Free for one round, paid for extended discussions
- Demonstrates the agent swarm's capabilities as a showcase

**8. Evaluation History**
- Let returning visitors see their past evaluations
- Track improvements — "your project went from Silver to Gold"
- Share evaluation results as a public link

**9. Blog Integration**
- After evaluation, surface the most relevant blog post
- Auto-suggest writing topics based on common evaluation patterns
- RSS feed for subscribers

### Phase 4: Scale (Month 2+)

**10. API Access**
- Expose the Evaluation Engine as a public API
- Pricing: $0.05/evaluation (free tier: 10/day)
- Use case: other tools embed "does this feel right?" scoring

**11. Subscription Tier**
- Unlimited deep analyses
- Priority inquiry response
- Observer Mode access
- Monthly evaluation reports

**12. Agent Marketplace**
- Let visitors choose which agent evaluates their idea
- Different agents = different perspectives (Architect vs. Contrarian vs. Researcher)
- Premium agents with specialized domain knowledge

---

## IV. Technical Roadmap

### Infrastructure Needed

| Service | Purpose | Cost | Already in deps? |
|---------|---------|------|-------------------|
| **Supabase** | Database, auth, edge functions | Free tier → $25/mo | Yes |
| **Stripe** | Payments | 2.9% + $0.30 per txn | Yes |
| **Resend** | Transactional email | Free tier (100/day) | Yes |
| **Vercel** | Hosting + serverless | Free tier | No (currently GitHub Pages) |
| **Gemini API** | AI analysis | ~$0.01/analysis | Yes |

### Migration Path

1. **GitHub Pages → Vercel**: Better for serverless functions (Stripe webhooks, email sending). The Vite build is already compatible.

2. **localStorage → Supabase**: All state currently persists in localStorage. Migrate incrementally:
   - Phase 1: Inquiries + payments to Supabase
   - Phase 2: Evaluation history to Supabase
   - Phase 3: Full state sync (schedule, treasury, etc.)

3. **Client-side AI → Edge Functions**: Move Gemini API calls to Supabase Edge Functions so API keys aren't exposed in the browser.

### Security Considerations

- Move all API keys to server-side (currently `import.meta.env.VITE_*` exposes them)
- Add rate limiting on the evaluation endpoint
- Sanitize user input in the textarea (already using React, which handles XSS)
- Stripe webhook signature verification for payment confirmation

---

## V. Metrics to Track

### North Star

**Revenue per week** — the single number that tells us if the platform is working.

### Leading Indicators

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Evaluations/day | 50+ | Supabase counter |
| Free → Paid conversion | 5-10% | Stripe checkout / total evals |
| Inquiry → Project conversion | 20%+ | Manual tracking in dashboard |
| Avg project value | $1,000+ | Treasury records |
| Time to first response | < 2 hours (Gold+) | Assistant Agent timestamps |

### Lagging Indicators

- Monthly recurring revenue (subscriptions)
- Client satisfaction / repeat clients
- Organic traffic growth
- Evaluation engine accuracy (Brier score from calibration system)

---

## VI. The Philosophy

This isn't a SaaS product. It's a *craft practice* with a revenue model.

The evaluation engine exists because the question "does this feel right?" is genuinely useful. People struggle to assess their own ideas — they're either irrationally optimistic or paralyzed by doubt. A structured, honest evaluation from an impartial system has real value.

The design is contemplative because the best decisions happen in calm environments. The typography, whitespace, and animation aren't decorative — they create the conditions for clear thinking.

The AI analysis is paid because good advice should cost something. Free advice is ignored. A $2 commitment means the person actually reads the analysis and considers it.

The project contracting is natural because if someone's idea scores well and they want it built, the shortest path should be obvious. No hunting for a contact page. No cold emails. Just: "here's what it would cost, here's how to start."

Every layer of the platform serves the same question: *does this feel right?*

The answer should always be yes.

---

## VII. Immediate Next Actions

1. **Set up Stripe account** and add `VITE_STRIPE_PUBLISHABLE_KEY` to env
2. **Set up Supabase project** and create `inquiries` + `payments` tables
3. **Set up Resend** and add email notification on new inquiry
4. **Deploy to Vercel** for serverless function support
5. **Move Gemini API key** to server-side edge function
6. **Share the evaluation engine** — post the link, let people try it
7. **Write a blog post** about the evaluation engine itself — meta-content that drives traffic

---

*Built with the Antigravity Kernel. Powered by contemplative engineering.*
