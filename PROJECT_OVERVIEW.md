# Studio OS: Your AI-Powered Creative Operating System

## What Is This?

**Studio OS** (branded as "Does This Feel Right?") is an open-source platform that gives you a complete AI-powered creative studio. Think of it as the operating system for running a modern creative business where AI agents handle specialized tasks while you direct the vision.

**Live Example**: [doesthisfeelright.com](https://www.doesthisfeelright.com)

---

## The Core Concept

Instead of manually managing 20 different tools and workflows, Studio OS provides:

1. **70+ Specialized AI Agents** - Each handles specific tasks (design, writing, research, distribution)
2. **Orchestration Engine** - Coordinates agents to complete complex projects
3. **Memory & Intelligence** - Learns from your work and maintains context across sessions
4. **Production Website** - Fully functional blog/portfolio that deploys automatically
5. **Evaluation Framework** - Measures quality beyond just "did it work?" to "does this feel right?"

---

## What Can You Do With It?

### **Option 1: Fork Your Own Studio**
Clone this entire system to run your own AI-augmented creative operation:
- Generate and publish content automatically
- Coordinate social media across platforms
- Research trends and competitors
- Design graphics and visual assets
- Manage projects and revenue tracking

### **Option 2: Extract Patterns**
Study how the agents work and integrate specific patterns into your existing systems:
- Content repurposing pipelines (The Alchemist)
- Multi-platform distribution workflows
- AI model routing and cost optimization
- Memory and context management

### **Option 3: Build on the Framework**
Use Studio OS as the foundation for your own agentic application:
- Evaluation harness for measuring AI quality
- Agent orchestration patterns
- Human-in-the-loop workflows

---

## System Architecture

### **The Intelligence Layer** (`/admin/brain/`)
The cognitive core that powers everything:

- **Model Router**: Intelligently routes tasks to the best AI model (GPT-4, Claude, Gemini)
- **Memory Store**: Maintains long-term memory across conversations and sessions
- **Knowledge Graph**: Connects related concepts and past learnings
- **Mission Orchestrator**: Breaks down complex tasks and assigns to appropriate agents
- **Collective Intelligence**: Enables agents to collaborate and share insights

### **The Agent Swarm** (`/admin/engineers/`)
Specialized workers, each with expertise:

**Creative Agents**:
- The Alchemist: Transforms content into multiple formats
- Designer: UI/UX design and brand systems
- Video Editor: Video production and editing
- Voice Actor: Audio and voiceover generation

**Distribution Agents**:
- Broadcaster: Multi-platform publishing
- Social Engine: Social media strategy
- TikTok Workflow: Short-form video optimization
- YouTube Agent: Long-form content management

**Business Agents**:
- Revenue Agent: Monetization and pricing strategy
- Marketing Strategist: Campaign planning
- Trend Scout: Market research and opportunity identification

**Engineering Agents**:
- The Architect: System design
- Infrastructure Engineer: DevOps and deployment
- Security Architect: Protection and compliance

### **The Answer Engine** (`/dtfr/`)
Smart search and reasoning:
- Understands intent behind questions
- Synthesizes answers from multiple sources
- Tracks decision rationale
- Integrates design intelligence

### **The Website** (`/docs/`)
Production-ready static site:
- Built with Python (no npm required for core)
- Carbon Design System integration
- Optimized for Cloudflare Pages
- Mobile-responsive with glassmorphism UI

---

## The "Does This Feel Right?" Framework

Traditional AI metrics measure accuracy, speed, and cost. But they miss something crucial: **Does this output actually feel right?**

Our evaluation harness introduces:

- **Felt Quality Metrics**: Beyond technical correctness to human judgment
- **Trust Scoring**: Measure reliability over time
- **Collaborative Practice**: Designer + Engineer joint quality assessment
- **Human-in-the-Loop Traces**: Audit trails for regulatory compliance

This positions Studio OS as infrastructure for the next generation of AI systems where **trust and quality are measurable**.

---

## Technical Stack

**Backend Intelligence**:
- Python 3.9+ (fully type-hinted, async)
- SQLite for state and memory
- Multi-model AI (Gemini Pro, GPT-4, Claude)

**Frontend & Mobile**:
- Custom Python static site generator
- Carbon Design System
- React + Capacitor for mobile apps

**Deployment**:
- Cloudflare Pages (recommended)
- GitHub Pages (supported)
- Self-hosted (fully supported)

**Development**:
- Textual TUI for local control
- Multi-agent debugging tools
- Hot reload development server

---

## Quick Start

### **1. Clone & Setup**
```bash
git clone https://github.com/isaacsight/does-this-feel-right-.git my-studio
cd my-studio
bash scripts/setup_dev.sh
source .venv/bin/activate
```

### **2. Configure AI Keys**
```bash
cp .env.example .env
# Add your API keys:
# - GOOGLE_API_KEY (Gemini)
# - OPENAI_API_KEY (GPT-4)
# - ANTHROPIC_API_KEY (Claude)
```

### **3. Build & Run**
```bash
python build.py                              # Build static site
python -m http.server 8000 --directory docs  # Local preview
```

### **4. Launch Agent Studio** (Optional)
```bash
./launch-studio.sh  # Multi-terminal environment
python admin/tui.py # Terminal UI for agents
```

---

## Key Features That Set This Apart

### **1. Truly Open Source**
Unlike walled-garden AI platforms, this is **MIT licensed**. Fork it, sell it, commercialize it - no restrictions.

### **2. Zero-Dependency Philosophy**
Core site generation uses only Python standard library. No npm dependency hell for the main build.

### **3. Long-Context Native**
Designed for Claude/Gemini's massive context windows. Load entire codebases without fragmented RAG.

### **4. Production-Ready**
This isn't a demo - doesthisfeelright.com runs on this exact code in production.

### **5. Agent Swarm Patterns**
Learn from 70+ agent implementations showing real-world orchestration patterns.

### **6. Evaluation-First**
Built-in DTFR harness for measuring quality beyond traditional metrics.

---

## Roadmap

### **Q1 2026**: The Evaluation Foundation
- Release DTFR evaluation harness
- Formalize agent patterns library
- Publish reference architecture docs

### **Q2 2026**: Composable Kits
- `dtfr-eval-harness` package
- `dtfr-agent-patterns` package
- `dtfr-ux-agent` package
- Integration bridges to LangChain, CrewAI, AutoGen

### **H2 2026**: The Evolutionary Marketplace
- Community pattern repository
- Custom studio deployment tools
- Enterprise fork support

---

## Who Is This For?

**✅ Perfect if you're:**
- Building an AI-powered creative business
- Researching agentic system architectures
- Developing evaluation frameworks for AI
- Creating content pipelines with AI
- Learning multi-agent orchestration

**❌ Not ideal if you're:**
- Looking for a no-code solution (this requires Python knowledge)
- Need enterprise support contracts (this is open source, community-supported)
- Want plug-and-play SaaS (this is infrastructure you run yourself)

---

## Support & Community

- **Documentation**: See `/admin/docs/` and markdown files in root
- **Issues**: [GitHub Issues](https://github.com/isaacsight/does-this-feel-right-/issues)
- **Contributing**: See `CONTRIBUTING.md`
- **License**: MIT (see `LICENSE`)

---

## Philosophy: The Sovereign Studio

This project embodies the concept of a **Sovereign Studio** - a creative operation that:

- **Owns its tools** (not rented from platforms)
- **Directs AI** (doesn't just type prompts)
- **Compounds knowledge** (every session builds on the last)
- **Produces artifacts** (systems, not just responses)
- **Measures felt quality** (beyond metrics)

The name "Does This Feel Right?" represents our core belief: **Quality in AI systems should be measured by human-AI collaborative judgment, not just accuracy scores.**

---

## Next Steps

1. **Explore the Code**: Start with `/admin/engineers/` to see agent implementations
2. **Read the Constitution**: Check `CLAUDE.md` for operating principles
3. **Review Agents**: See `AGENTS.md` for the agent hierarchy
4. **Build the Site**: Run `python build.py` to generate the static site
5. **Launch the Lab**: Try `./launch-studio.sh` for the full experience

---

## Questions?

This is an ambitious project with a lot of surface area. Common questions:

**Q: Do I need all 70 agents?**
A: No. Fork and use what you need. The Alchemist, Architect, and Librarian are the core trio.

**Q: What AI models do I need?**
A: At minimum, one of: Gemini Pro (cheapest), GPT-4 (most capable), or Claude (best reasoning).

**Q: Can I use this commercially?**
A: Yes. MIT license. Build products, sell services, whatever you want.

**Q: Is this production-ready?**
A: Yes. The reference site runs in production. But you own the maintenance.

**Q: How is this different from LangChain/CrewAI?**
A: Those are libraries. This is a complete system with UI, agents, memory, and evaluation.

---

**Welcome to Studio OS. Let's build something that feels right.**
