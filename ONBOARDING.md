# Onboarding Guide: The Sovereign Laboratory OS

Welcome to the lab. You're joining a project where code is not just written, but **composed** in collaboration with a swarm of autonomous agents.

## 🏁 The 5-Minute Setup

If you have Python 3.9+ and Node.js installed on your Mac:

```bash
# 1. Clone and Enter
git clone <repo-url>
cd blog-design

# 2. Automated Setup
# This sets up the venv and installs dependencies
bash scripts/setup_dev.sh

# 3. Environment
cp .env.example .env
# Edit .env to add your GEMINI_API_KEY or ANTHROPIC_API_KEY
```

## 🧠 Working with Antigravity (The Core Kernel)

The heart of this project is the **Antigravity agent**. We use an agentic workflow where you don't just write PRs—you design systems that agents then help implement and maintain.

### Current Agent Capabilities:
- **Terminal Mastery**: High-fidelity system interaction (advanced shell pipelines).
- **Context Architect**: Million-token codebase awareness.
- **Web Intelligence**: Real-time technical discovery.

Read [CLAUDE.md](CLAUDE.md) for the "Constitution" that governs agent behavior.

## 🏗️ Architecture at a Glance

- **Frontend**: React 19 + Vite + Carbon Design System (migrating to Rubin Aesthetic).
- **Backend**: FastAPI Reliability Engine (Python).
- **Intelligence**: `admin/brain` (46+ agents) + `admin/engineers` (specialized swarms).
- **Storage**: Supabase (Postgres + pgvector) + local SQLite for state.

## 📜 Engineering Philosophy: "Every Conversation Must Compound"

We do not restart thinking from zero.
1. **Residue over Snippets**: When working with AI, always aim to produce a permanent artifact (Markdown doc, Python script, or SQL schema) rather than just a chat reply.
2. **Mental Models First**: Understand *why* a system is built before changing *how*.
3. **Automated Verification**: We use `pytest` for agent loops and `black`/`ruff` for code quality.

## 🛠️ Essential Commands

```bash
# Start the Admin Dashboard (Studio OS)
bash launch-studio.sh

# Build the Static Site
python build.py

# Run Tests
pytest
```

## 🗺️ Where to Go Next

1. **Read [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** for a deep dive into the stack.
2. **Review [DESIGN_AESTHETIC.md](DESIGN_AESTHETIC.md)** to understand the Rubin design tokens.
3. **Check [AGENTS.md](AGENTS.md)** to see the current roster of autonomous collaborators.

**Signed by Antigravity Kernel**
