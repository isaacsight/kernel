# Studio OS: The Open Source Model

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/isaacsight/does-this-feel-right-/workflows/Build%20and%20Deploy/badge.svg)](https://github.com/isaacsight/does-this-feel-right-/actions)

> **This entire site is an open-source, forkable "model" that anyone can clone, adapt, and extend.**

**Studio OS** is more than a static site generator—it is a reference implementation of an **Agentic System** designed for high-leverage creative work. It includes the architecture, patterns, and workflows needed to run your own "Sovereign Studio".

Use this repository as a base for your own studio, lab, or personal agentic platform.

🌐 **Live Reference**: [doesthisfeelright.com](https://www.doesthisfeelright.com)

---

## 📂 Project Structure

This repository acts as a monorepo for your studio's brain and body.

- **`/site`**: The reference implementation (this blog). A Python-based static site generator optimized for AI content pipelines.
- **`/patterns`**: Reusable agentic patterns (e.g., "The Alchemist" for content repurposing, "The Architect" for system design).
- **`/agents`**: The "Staff" of your studio. Python-based agents that operate on your content and code.
- **`/workflows`**: Operational loops (e.g., n8n blueprints, GitHub Actions) that tie everything together.

*(Note: Some of these folders are currently virtual or integrated into `admin/` and `content/` in this reference implementation, but the pattern stands.)*

## 🚀 How to Fork This Studio

You can spin up your own instance of Studio OS in minutes.

### 1. Clone & Rename
```bash
git clone https://github.com/isaacsight/does-this-feel-right-.git my-studio-os
cd my-studio-os
```

### 2. Configure Your Keys
Copy the example environment file and add your LLM keys (Gemini, OpenAI, Anthropic).
```bash
cp .env.example .env
nano .env
```

### 3. Run the Reference Implementation
Build the site locally to see how the pieces fit together.
```bash
# Setup dependencies
bash scripts/setup_dev.sh
source .venv/bin/activate

# Build and Serve
python build.py
python -m http.server 8000 --directory docs
```

### 4. Deploy
This site is designed to run on **Cloudflare Pages** or **GitHub Pages**.
- **Build Command**: `python build.py`
- **Output Directory**: `docs`

## 🛠️ The "Model" Features

### 1. The Sovereign Doctrine
Agents in this system don't just "execute"; they follow a [Doctrine](.agent/rules/global-rules.md). This ensures all generated code and content feels like *you*.

### 2. The Living Lab
This isn't just a blog; it's a living system.
- **Agent Council**: `admin/engineers/` contains the code for your virtual staff.
- **Decision Logs**: Automated tracking of architectural decisions.
- **Snapshotting**: The system maintains a "Studio Snapshot" to understand its own state.

### 3. Open Patterns
We explicitly mark patterns as "Stealable". Look for the **Studio Patterns** tag to find reusable architectures for:
- 🧪 **Research**: Automated deep dives.
- 🎨 **Design**: CSS-in-Python systems.
- 📡 **Distribution**: "Alchemist" pipelines for viral repurposing.

## 🤝 Contributing & License

**License**: MIT. You are free to copy, fork, remix, and commercialize this OS.

We welcome contributions! If you develop a new agent pattern or workflow, PR it back to the `/patterns` directory.

---

## Technical Details

### Tech Stack
- **Core**: Python 3.9+
- **Static Gen**: Custom Python builder (Zero-dependency philosophy)
- **Admin**: Textual (TUI)
- **AI**: Google Gemini Pro (Primary), OpenAI, Anthropic

### Development Actions
```bash
# Run Tests
pytest

# Format & Lint
black . && ruff check . --fix

# Scan Security
bandit -r .
```
