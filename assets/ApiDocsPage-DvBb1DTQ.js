import{r as s,j as e}from"./vendor-react-C1MACuvJ.js";function r(){return s.useEffect(()=>(document.body.classList.add("ka-scrollable-page"),()=>{document.body.classList.remove("ka-scrollable-page")}),[]),e.jsxs("div",{className:"ka-legal-page ka-docs-page",children:[e.jsx("button",{className:"ka-legal-back",onClick:()=>{window.location.hash="#/"},children:"← Back to Kernel"}),e.jsx("h1",{children:"Kernel API"}),e.jsx("p",{className:"ka-docs-subtitle",children:"Access Kernel's 17-agent intelligence layer via a simple REST API. One call gets specialist routing, multi-agent collaboration, and structured responses."}),e.jsxs("section",{className:"ka-docs-section",children:[e.jsx("h2",{children:"K:BOT — Terminal Agent"}),e.jsx("p",{children:"K:BOT gives you the full power of Kernel's agent system from your terminal. It runs tools locally (file ops, git, bash) for free — only AI reasoning uses your API quota."}),e.jsx("pre",{className:"ka-docs-code",children:`# Install
curl -fsSL https://kernel.chat/install.sh | bash

# Or via npm
npm install -g @antigravity/kbot

# Configure
kbot auth

# Use
kbot "fix the TypeScript errors in src/utils"
kbot "research the latest React Server Components changes"
kbot                    # interactive REPL`}),e.jsx("h3",{children:"Efficiency"}),e.jsx("p",{children:"K:BOT is designed to conserve your tokens and messages. Simple commands (file reads, git status, directory listings) are handled locally without any API call. The agent batches context upfront for one-shot accuracy, reducing round trips. Tool execution always runs on your machine for free."})]}),e.jsxs("section",{className:"ka-docs-section",children:[e.jsx("h2",{children:"Authentication"}),e.jsxs("p",{children:["All API requests require a Bearer token using your API key. Keys are prefixed with ",e.jsx("code",{children:"kn_live_"})," and can be managed from your account dashboard."]}),e.jsx("pre",{className:"ka-docs-code",children:`curl -X POST https://eoxxpyixdieprsxlpwcs.supabase.co/functions/v1/kernel-api/chat \\
  -H "Authorization: Bearer kn_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello"}'`})]}),e.jsxs("section",{className:"ka-docs-section",children:[e.jsx("h2",{children:"POST /chat"}),e.jsx("p",{children:"Send a message and get an agent-routed response. If no agent is specified, Kernel auto-classifies your intent and routes to the best specialist."}),e.jsx("h3",{children:"Request"}),e.jsx("pre",{className:"ka-docs-code",children:`{
  "message": "Explain quantum computing",
  "agent": "researcher",           // optional — auto-routes if omitted
  "mode": "json",                  // "json" (default) or "stream" (SSE)
  "system": "Be concise.",         // enterprise only — custom system prompt
  "max_tokens": 4096,              // optional, max 8192
  "previous_messages": [           // optional conversation context
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "tools": [                       // optional — tool definitions for tool-use
    { "name": "web_search", "description": "Search the web" }
  ],
  "tool_results": [                // optional — results from previous tool calls
    { "tool_call_id": "tc_1", "result": "..." }
  ]
}`}),e.jsx("h3",{children:"Response (text)"}),e.jsx("pre",{className:"ka-docs-code",children:`{
  "id": "msg_uuid",
  "agent": "researcher",
  "type": "text",
  "content": "Quantum computing is...",
  "model": "claude-sonnet-4-6",
  "usage": {
    "input_tokens": 234,
    "output_tokens": 1023,
    "cost_usd": 0.018
  },
  "classification": {              // present when auto-routed
    "agent_id": "researcher",
    "confidence": 0.92,
    "complexity": 0.45
  }
}`}),e.jsx("h3",{children:"Response (tool calls)"}),e.jsx("p",{children:"When the agent wants to use tools, the response contains tool_calls instead of content:"}),e.jsx("pre",{className:"ka-docs-code",children:`{
  "id": "msg_uuid",
  "agent": "researcher",
  "type": "tool_calls",
  "tool_calls": [
    { "id": "tc_1", "name": "web_search", "arguments": { "query": "quantum computing 2026" } }
  ],
  "model": "claude-sonnet-4-6",
  "usage": { ... }
}`}),e.jsxs("p",{children:["Execute the tool locally, then send results back via ",e.jsx("code",{children:"tool_results"})," in the next request."]})]}),e.jsxs("section",{className:"ka-docs-section",children:[e.jsx("h2",{children:"POST /classify"}),e.jsx("p",{children:"Classify intent without generating a full response. Uses collective intelligence patterns when available — may skip the classifier entirely for high-confidence matches."}),e.jsx("h3",{children:"Request"}),e.jsx("pre",{className:"ka-docs-code",children:`{
  "message": "Write a Python script to sort a list"
}`}),e.jsx("h3",{children:"Response"}),e.jsx("pre",{className:"ka-docs-code",children:`{
  "agent_id": "coder",
  "confidence": 0.95,
  "complexity": 0.3,
  "reasoning": "Code generation request — Python scripting task"
}`})]}),e.jsxs("section",{className:"ka-docs-section",children:[e.jsx("h2",{children:"POST /swarm"}),e.jsx("p",{children:"Multi-agent collaboration. Multiple agents contribute in parallel, then a synthesis model combines their perspectives. Requires Growth tier or higher."}),e.jsx("h3",{children:"Request"}),e.jsx("pre",{className:"ka-docs-code",children:`{
  "message": "Design a microservices architecture for a real-time trading platform",
  "agents": ["architect", "coder", "guardian"],
  "synthesis_model": "sonnet"       // optional, default: sonnet
}`}),e.jsx("h3",{children:"Response"}),e.jsx("pre",{className:"ka-docs-code",children:`{
  "id": "msg_uuid",
  "agents": ["architect", "coder", "guardian"],
  "contributions": [
    { "agent": "architect", "content": "For a real-time trading platform..." },
    { "agent": "coder", "content": "The implementation should use..." },
    { "agent": "guardian", "content": "Security considerations include..." }
  ],
  "synthesis": "Combined analysis: The optimal architecture...",
  "model": "claude-sonnet-4-6"
}`})]}),e.jsxs("section",{className:"ka-docs-section",children:[e.jsx("h2",{children:"GET /knowledge"}),e.jsx("p",{children:"Query the collective intelligence — learned patterns from all API interactions. The Kernel Matrix gets smarter with every request across all users."}),e.jsx("h3",{children:"Request"}),e.jsx("pre",{className:"ka-docs-code",children:"GET /knowledge?category=coder"}),e.jsx("h3",{children:"Response"}),e.jsx("pre",{className:"ka-docs-code",children:`{
  "patterns": [
    {
      "type": "routing_rule",
      "pattern": {
        "category": "coder",
        "agent": "coder",
        "accuracy": 0.94,
        "avg_confidence": 0.91
      },
      "confidence": 0.94,
      "sample_count": 1247
    }
  ]
}`})]}),e.jsxs("section",{className:"ka-docs-section",children:[e.jsx("h2",{children:"GET /agents"}),e.jsx("p",{children:"List available agents for your API key tier."}),e.jsx("pre",{className:"ka-docs-code",children:`{
  "agents": [
    { "id": "kernel", "name": "Kernel", "role": "General Assistant" },
    { "id": "researcher", "name": "Researcher", "role": "Research & Analysis" },
    { "id": "coder", "name": "Coder", "role": "Programming" },
    { "id": "writer", "name": "Writer", "role": "Content Creation" },
    { "id": "analyst", "name": "Analyst", "role": "Strategy & Evaluation" }
  ],
  "tier": "starter"
}`})]}),e.jsxs("section",{className:"ka-docs-section",children:[e.jsx("h2",{children:"GET /usage"}),e.jsx("p",{children:"Get monthly usage statistics for your API key, including per-agent breakdown."}),e.jsx("pre",{className:"ka-docs-code",children:`{
  "tier": "growth",
  "monthly_messages": { "count": 1247, "limit": 20000 },
  "monthly_window_start": "2026-03-01T00:00:00Z",
  "per_agent": {
    "coder": { "messages": 523, "input_tokens": 125000, "output_tokens": 890000, "cost_usd": 13.72 },
    "researcher": { "messages": 312, "input_tokens": 98000, "output_tokens": 450000, "cost_usd": 7.04 }
  }
}`})]}),e.jsxs("section",{className:"ka-docs-section",children:[e.jsx("h2",{children:"Tiers & Limits"}),e.jsxs("table",{className:"ka-docs-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Tier"}),e.jsx("th",{children:"Price"}),e.jsx("th",{children:"Messages / mo"}),e.jsx("th",{children:"Agents"}),e.jsx("th",{children:"Swarm"}),e.jsx("th",{children:"K:BOT Tools"}),e.jsx("th",{children:"Rate Limit"})]})}),e.jsxs("tbody",{children:[e.jsxs("tr",{children:[e.jsx("td",{children:"Free"}),e.jsx("td",{children:"$0"}),e.jsx("td",{children:"100"}),e.jsx("td",{children:"Core 5"}),e.jsx("td",{children:"No"}),e.jsx("td",{children:"Files, Git"}),e.jsx("td",{children:"10/min"})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"Starter"}),e.jsx("td",{children:"$149/mo"}),e.jsx("td",{children:"5,000"}),e.jsx("td",{children:"Core 5"}),e.jsx("td",{children:"No"}),e.jsx("td",{children:"+ Bash, Search"}),e.jsx("td",{children:"60/min"})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"Growth"}),e.jsx("td",{children:"$499/mo"}),e.jsx("td",{children:"20,000"}),e.jsx("td",{children:"All 17"}),e.jsx("td",{children:"Yes"}),e.jsx("td",{children:"+ Browser"}),e.jsx("td",{children:"120/min"})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"Enterprise"}),e.jsx("td",{children:"Custom"}),e.jsx("td",{children:"50K soft cap"}),e.jsx("td",{children:"All + custom prompts"}),e.jsx("td",{children:"Yes"}),e.jsx("td",{children:"+ Computer Use"}),e.jsx("td",{children:"180/min"})]})]})]})]}),e.jsxs("section",{className:"ka-docs-section",children:[e.jsx("h2",{children:"Error Codes"}),e.jsxs("table",{className:"ka-docs-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Status"}),e.jsx("th",{children:"Error"}),e.jsx("th",{children:"Description"})]})}),e.jsxs("tbody",{children:[e.jsxs("tr",{children:[e.jsx("td",{children:"401"}),e.jsx("td",{children:"Invalid API key"}),e.jsx("td",{children:"Key is missing, malformed, or revoked"})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"403"}),e.jsx("td",{children:"Monthly limit exceeded"}),e.jsx("td",{children:"Monthly message quota exhausted"})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"403"}),e.jsx("td",{children:"Enterprise required"}),e.jsx("td",{children:"Feature requires Enterprise tier"})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"403"}),e.jsx("td",{children:"Swarm requires Growth"}),e.jsx("td",{children:"/swarm endpoint requires Growth tier"})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"429"}),e.jsx("td",{children:"Rate limited"}),e.jsx("td",{children:"Per-minute rate limit exceeded. Check Retry-After header."})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"400"}),e.jsx("td",{children:"Invalid request"}),e.jsx("td",{children:"Missing required fields or invalid agent ID"})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"502"}),e.jsx("td",{children:"Upstream error"}),e.jsx("td",{children:"AI provider returned an error"})]})]})]}),e.jsxs("p",{children:["All errors return JSON with an ",e.jsx("code",{children:"error"})," field:"]}),e.jsx("pre",{className:"ka-docs-code",children:`{
  "error": "rate_limited",
  "retry_after": 12,
  "limit": 60
}`})]}),e.jsxs("section",{className:"ka-docs-section",children:[e.jsx("h2",{children:"Quick Start"}),e.jsx("h3",{children:"K:BOT (recommended)"}),e.jsx("pre",{className:"ka-docs-code",children:`# Install and start using in 30 seconds
npm install -g @antigravity/kbot
kbot auth
kbot "analyze the code quality of this repo"`}),e.jsx("h3",{children:"API (Node.js)"}),e.jsx("pre",{className:"ka-docs-code",children:`const response = await fetch(
  'https://eoxxpyixdieprsxlpwcs.supabase.co/functions/v1/kernel-api/chat',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer kn_live_your_key_here',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Analyze the competitive landscape for AI coding assistants',
      agent: 'analyst',
    }),
  }
)

const data = await response.json()
console.log(data.content)   // The analyst's response
console.log(data.usage)     // { input_tokens, output_tokens, cost_usd }`}),e.jsx("h3",{children:"Streaming"}),e.jsx("pre",{className:"ka-docs-code",children:`const response = await fetch(url, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer kn_live_...', 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Write a poem', mode: 'stream' }),
})

const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  process.stdout.write(decoder.decode(value))
}`}),e.jsx("h3",{children:"Multi-Agent Swarm"}),e.jsx("pre",{className:"ka-docs-code",children:`const response = await fetch(url + '/swarm', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer kn_live_...', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Design a real-time notification system',
    agents: ['architect', 'coder', 'guardian'],
  }),
})

const data = await response.json()
console.log(data.synthesis)        // Combined analysis
data.contributions.forEach(c =>    // Individual perspectives
  console.log(c.agent + ':', c.content)
)`})]}),e.jsx("footer",{className:"ka-docs-footer",children:e.jsxs("p",{children:["Questions? Contact us at ",e.jsx("a",{href:"mailto:api@kernel.chat",children:"api@kernel.chat"})]})})]})}export{r as ApiDocsPage};
