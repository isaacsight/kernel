import { useEffect } from 'react'

export function ApiDocsPage() {
  useEffect(() => {
    document.body.classList.add('ka-scrollable-page')
    return () => { document.body.classList.remove('ka-scrollable-page') }
  }, [])

  return (
    <div className="ka-legal-page ka-docs-page">
      <button className="ka-legal-back" onClick={() => { window.location.hash = '#/' }}>
        &larr; Back to Kernel
      </button>

      <h1>Kernel API</h1>
      <p className="ka-docs-subtitle">
        Access Kernel's 17-agent intelligence layer via a simple REST API.
        One call gets specialist routing, multi-agent collaboration, and structured responses.
      </p>

      {/* ── K:BOT Terminal Agent ── */}
      <section className="ka-docs-section">
        <h2>K:BOT — Terminal Agent</h2>
        <p>
          K:BOT gives you the full power of Kernel's agent system from your terminal.
          It runs tools locally (file ops, git, bash) for free — only AI reasoning uses your API quota.
        </p>
        <pre className="ka-docs-code">{`# Install
curl -fsSL https://kernel.chat/install.sh | bash

# Or via npm
npm install -g @kernel.chat/kbot

# Configure
kbot auth

# Use
kbot "fix the TypeScript errors in src/utils"
kbot "research the latest React Server Components changes"
kbot                    # interactive REPL`}</pre>

        <h3>Efficiency</h3>
        <p>
          K:BOT is designed to conserve your tokens and messages. Simple commands (file reads, git status, directory
          listings) are handled locally without any API call. The agent batches context upfront for one-shot accuracy,
          reducing round trips. Tool execution always runs on your machine for free.
        </p>
      </section>

      {/* ── Authentication ── */}
      <section className="ka-docs-section">
        <h2>Authentication</h2>
        <p>
          All API requests require a Bearer token using your API key.
          Keys are prefixed with <code>kn_live_</code> and can be managed from your account dashboard.
        </p>
        <pre className="ka-docs-code">{`curl -X POST https://eoxxpyixdieprsxlpwcs.supabase.co/functions/v1/kernel-api/chat \\
  -H "Authorization: Bearer kn_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello"}'`}</pre>
      </section>

      {/* ── POST /chat ── */}
      <section className="ka-docs-section">
        <h2>POST /chat</h2>
        <p>Send a message and get an agent-routed response. If no agent is specified, Kernel auto-classifies your intent and routes to the best specialist.</p>

        <h3>Request</h3>
        <pre className="ka-docs-code">{`{
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
}`}</pre>

        <h3>Response (text)</h3>
        <pre className="ka-docs-code">{`{
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
}`}</pre>

        <h3>Response (tool calls)</h3>
        <p>When the agent wants to use tools, the response contains tool_calls instead of content:</p>
        <pre className="ka-docs-code">{`{
  "id": "msg_uuid",
  "agent": "researcher",
  "type": "tool_calls",
  "tool_calls": [
    { "id": "tc_1", "name": "web_search", "arguments": { "query": "quantum computing 2026" } }
  ],
  "model": "claude-sonnet-4-6",
  "usage": { ... }
}`}</pre>
        <p>Execute the tool locally, then send results back via <code>tool_results</code> in the next request.</p>
      </section>

      {/* ── POST /classify ── */}
      <section className="ka-docs-section">
        <h2>POST /classify</h2>
        <p>Classify intent without generating a full response. Uses collective intelligence patterns when available — may skip the classifier entirely for high-confidence matches.</p>

        <h3>Request</h3>
        <pre className="ka-docs-code">{`{
  "message": "Write a Python script to sort a list"
}`}</pre>

        <h3>Response</h3>
        <pre className="ka-docs-code">{`{
  "agent_id": "coder",
  "confidence": 0.95,
  "complexity": 0.3,
  "reasoning": "Code generation request — Python scripting task"
}`}</pre>
      </section>

      {/* ── POST /swarm ── */}
      <section className="ka-docs-section">
        <h2>POST /swarm</h2>
        <p>Multi-agent collaboration. Multiple agents contribute in parallel, then a synthesis model combines their perspectives. Requires Pro tier.</p>

        <h3>Request</h3>
        <pre className="ka-docs-code">{`{
  "message": "Design a microservices architecture for a real-time trading platform",
  "agents": ["architect", "coder", "guardian"],
  "synthesis_model": "sonnet"       // optional, default: sonnet
}`}</pre>

        <h3>Response</h3>
        <pre className="ka-docs-code">{`{
  "id": "msg_uuid",
  "agents": ["architect", "coder", "guardian"],
  "contributions": [
    { "agent": "architect", "content": "For a real-time trading platform..." },
    { "agent": "coder", "content": "The implementation should use..." },
    { "agent": "guardian", "content": "Security considerations include..." }
  ],
  "synthesis": "Combined analysis: The optimal architecture...",
  "model": "claude-sonnet-4-6"
}`}</pre>
      </section>

      {/* ── GET /knowledge ── */}
      <section className="ka-docs-section">
        <h2>GET /knowledge</h2>
        <p>Query the collective intelligence — learned patterns from all API interactions. The Kernel Matrix gets smarter with every request across all users.</p>

        <h3>Request</h3>
        <pre className="ka-docs-code">{`GET /knowledge?category=coder`}</pre>

        <h3>Response</h3>
        <pre className="ka-docs-code">{`{
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
}`}</pre>
      </section>

      {/* ── GET /agents ── */}
      <section className="ka-docs-section">
        <h2>GET /agents</h2>
        <p>List available agents for your API key tier.</p>
        <pre className="ka-docs-code">{`{
  "agents": [
    { "id": "kernel", "name": "Kernel", "role": "General Assistant" },
    { "id": "researcher", "name": "Researcher", "role": "Research & Analysis" },
    { "id": "coder", "name": "Coder", "role": "Programming" },
    { "id": "writer", "name": "Writer", "role": "Content Creation" },
    { "id": "analyst", "name": "Analyst", "role": "Strategy & Evaluation" }
  ],
  "tier": "free"
}`}</pre>
      </section>

      {/* ── GET /usage ── */}
      <section className="ka-docs-section">
        <h2>GET /usage</h2>
        <p>Get monthly usage statistics for your API key, including per-agent breakdown.</p>
        <pre className="ka-docs-code">{`{
  "tier": "pro",
  "monthly_messages": { "count": 87, "limit": 200 },
  "monthly_window_start": "2026-03-01T00:00:00Z",
  "per_agent": {
    "coder": { "messages": 43, "input_tokens": 12500, "output_tokens": 89000, "cost_usd": 1.37 },
    "researcher": { "messages": 31, "input_tokens": 9800, "output_tokens": 45000, "cost_usd": 0.70 }
  }
}`}</pre>
      </section>

      {/* ── Rate Limits & Tiers ── */}
      <section className="ka-docs-section">
        <h2>Tiers & Limits</h2>
        <table className="ka-docs-table">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Price</th>
              <th>Messages / mo</th>
              <th>Agents</th>
              <th>Swarm</th>
              <th>K:BOT Tools</th>
              <th>Rate Limit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Free</td>
              <td>$0</td>
              <td>10</td>
              <td>Core 5</td>
              <td>No</td>
              <td>Files, Git</td>
              <td>10/min</td>
            </tr>
            <tr>
              <td>Pro</td>
              <td>$15/mo</td>
              <td>200</td>
              <td>All 17</td>
              <td>Yes</td>
              <td>All tools</td>
              <td>30/min</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Error Codes ── */}
      <section className="ka-docs-section">
        <h2>Error Codes</h2>
        <table className="ka-docs-table">
          <thead>
            <tr><th>Status</th><th>Error</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td>401</td><td>Invalid API key</td><td>Key is missing, malformed, or revoked</td></tr>
            <tr><td>403</td><td>Monthly limit exceeded</td><td>Monthly message quota exhausted</td></tr>
            <tr><td>403</td><td>Pro required</td><td>Feature requires Pro tier</td></tr>
            <tr><td>429</td><td>Rate limited</td><td>Per-minute rate limit exceeded. Check Retry-After header.</td></tr>
            <tr><td>400</td><td>Invalid request</td><td>Missing required fields or invalid agent ID</td></tr>
            <tr><td>502</td><td>Upstream error</td><td>AI provider returned an error</td></tr>
          </tbody>
        </table>
        <p>All errors return JSON with an <code>error</code> field:</p>
        <pre className="ka-docs-code">{`{
  "error": "rate_limited",
  "retry_after": 12,
  "limit": 60
}`}</pre>
      </section>

      {/* ── Quick Start ── */}
      <section className="ka-docs-section">
        <h2>Quick Start</h2>

        <h3>K:BOT (recommended)</h3>
        <pre className="ka-docs-code">{`# Install and start using in 30 seconds
npm install -g @kernel.chat/kbot
kbot auth
kbot "analyze the code quality of this repo"`}</pre>

        <h3>API (Node.js)</h3>
        <pre className="ka-docs-code">{`const response = await fetch(
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
console.log(data.usage)     // { input_tokens, output_tokens, cost_usd }`}</pre>

        <h3>Streaming</h3>
        <pre className="ka-docs-code">{`const response = await fetch(url, {
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
}`}</pre>

        <h3>Multi-Agent Swarm</h3>
        <pre className="ka-docs-code">{`const response = await fetch(url + '/swarm', {
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
)`}</pre>
      </section>

      <footer className="ka-docs-footer">
        <p>Questions? Contact us at <a href="mailto:api@kernel.chat">api@kernel.chat</a></p>
      </footer>
    </div>
  )
}
