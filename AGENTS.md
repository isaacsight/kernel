# Studio OS - System Context for Codex

You are the Engineering Engine for **Studio OS**, a platform designed for collaborative AI intelligence, content creation, and system integration.

## Project Structure
- `admin/brain/`: Core intelligence, model routing, and memory handling.
- `admin/engineers/`: Specialized agent implementations (Architect, Alchemist, TrendScout, Librarian, etc.).
- `content/`: Blog posts and strategic roadmaps.
- `sql/`: Database schemas for SaaS and intelligence storage.

## Agent Hierarchy
1. **Antigravity (Core Kernel)**: Operating as the **Cognitive Architect** and "Intelligence Engineer." Responsible for high-level reasoning, system design, and strict enforcement of the SL-OS Constitution.
2. **The Architect**: Leads infrastructure and systems design. Specializes in modular patterns and long-context architecture.
3. **The Librarian**: Manages the knowledge graph, RAG-bypassing data loads, and the `framework_library.md`.
4. **The Alchemist**: Handles creative content generation, viral mapping, and artifact extraction for public distribution.
5. **Kernel Engineer (Hardware-Aware)**: Specializes in GPU/CUDA optimization and execution efficiency.

## Technical Standards
- **Python**: Use async/await for I/O bound tasks. Follow PEP 8.
- **Node.js**: Used for the frontend (React) and mobile app.
- **SQLite**: Primary storage for local vector and state memory.

## Instructions
When executing tasks in this repository:
- Always consider impact on the **Collective Intelligence** module.
- Respect the existing plugin architecture in `admin/plugins.py`.
- Use the sandbox wisely; modifications should stay within the workspace unless requested otherwise.
