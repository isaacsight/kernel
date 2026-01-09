# The Way of Code: Sovereign Laboratory OS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/isaacsight/does-this-feel-right-/workflows/Build%20and%20Deploy/badge.svg)](https://github.com/isaacsight/does-this-feel-right-/actions)

> *"The soft overcomes the hard. The slow overcomes the fast. Let your code be like water."*
> — Adapted from The Way of Code, Chapter 78

## Philosophy: Vibe Coding Through Wu Wei

This is not just a repository. It's a **living system** that embodies [The Way of Code](https://www.thewayofcode.com/) - Rick Rubin's adaptation of Lao Tzu's Tao Te Ching for software development.

**The Way of Code OS** is:
- An agentic intelligence system practicing **wu wei** (effortless action)
- A contemplative interface for permanent thinking
- A reference implementation of vibe coding principles
- A sovereign laboratory that flows like water

We build through **subtraction**, not addition. We lead by **serving**, not controlling. We create **permanent systems**, not temporary hacks.

🌐 **Live System**: [doesthisfeelright.com](https://www.doesthisfeelright.com)

---

## 📂 Architecture: The Empty Hub (Chapter 11)

*"Thirty spokes share one hub. The wheel's utility comes from its emptiness."*

This repository is organized through **natural emergence**, not forced hierarchy:

- **`/admin/brain`**: The Council of Wu Wei - 46+ agents practicing effortless intelligence
- **`/admin/engineers`**: Specialized agents (Architect, Alchemist, Librarian, Mobbin Scout)
- **`/engine`**: FastAPI backend that flows like water
- **`/frontend`**: React contemplative interface - literary minimalism in action
- **`/content`**: Essays and permanent thinking artifacts
- **`/sql`**: Hardened memory - pgvector embeddings, multi-tenant architecture
- **`/static/design-system`**: The Way of Code aesthetic tokens

Each component useful because it contains the right amount of **emptiness**.

## 🌊 Getting Started: Let the System Flow

*"A journey of a thousand miles begins with a single step."* — Chapter 64

### 1. Clone & Contemplate
```bash
git clone https://github.com/isaacsight/does-this-feel-right-.git way-of-code-os
cd way-of-code-os
```

### 2. Configure with Humility
Add your API keys. Trust the flow.
```bash
cp .env.example .env
nano .env  # Add your keys (Anthropic, OpenAI, Gemini)
```

### 3. Build Through Natural Flow
```bash
# Backend: FastAPI flows at localhost:8000
cd engine && docker-compose up

# Frontend: React contemplates at localhost:5173
cd frontend && npm install && npm run dev

# Legacy Static Site: Python generates to docs/
python build.py
python -m http.server 8000 --directory docs
```

### 4. Deploy Like Water
This system adapts to any container:
- **GitHub Pages**: Static site auto-deploys from `/docs`
- **Fly.io**: Backend scales effortlessly
- **Supabase**: Database flows with pgvector intelligence

## 🏛️ The Three Treasures of This System

### 1. Wu Wei: Agents That Act Without Acting (Chapter 63)
The [Council of Wu Wei](CLAUDE.md#v-the-council-of-wu-wei-agent-roster) embodies effortless intelligence:
- **Architect** (Ch. 11, 17, 64): Designs through negative space
- **Alchemist** (Ch. 22, 43, 78): Transforms data like water
- **Librarian** (Ch. 33, 48, 56): Organizes through silence
- **Mobbin Scout** (Ch. 5, 15, 45): Observes without disturbing

Each agent practices vibe coding, not brute-force execution.

### 2. Simplicity: The Uncarved Block (Chapter 48)
*"In pursuit of the Way, subtract every day."*
- **No over-engineering**: Remove until you can't
- **Natural emergence**: Systems self-organize
- **Generous spacing**: 100px padding, 1.5+ line-height
- **Literary minimalism**: Reading first, interaction second

See [THE_WAY_OF_CODE.md](THE_WAY_OF_CODE.md) for complete philosophy.

### 3. Humility: Leading by Serving (Chapter 17)
*"The best leaders are barely known."*
- **Open source**: MIT License, fork freely
- **Documented wisdom**: Every decision explained
- **Contemplative design**: Timeless over trendy
- **Permanent thinking**: Artifacts over conversations

## 📖 Core Documentation

- **[THE_WAY_OF_CODE.md](THE_WAY_OF_CODE.md)**: Complete 81 chapters integrated with system
- **[CLAUDE.md](CLAUDE.md)**: Operating system constitution
- **[DESIGN_AESTHETIC.md](DESIGN_AESTHETIC.md)**: Visual philosophy & design tokens
- **[AGENTS.md](AGENTS.md)**: Multi-agent council documentation

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
