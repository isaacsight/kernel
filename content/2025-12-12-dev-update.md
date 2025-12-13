---
title: "Devlog: The Graph Reborn"
subtitle: "Moving from 3D chaos to Swiss precision, plus a massive speed boost."
excerpt: "Today was a marathon: Switched the AI brain to Gemini Flash 2.0, fixed the tracking bugs, deployed the new site, and completely rewrote the knowledge graph engine."
---

Here are a batch of updates summarizing today's work.

### 1. The Engine Room (Performance & AI)
Spent the morning doing a deep dive into performance. We switched the chatbot over to `gemini-2.0-flash`, which has drastically cut down latency—messages are now feeling effectively real-time. Also fixed some stubborn WebSocket protocol errors that were dropping connections, and finally squashed a Supabase RPC bug that was preventing page view counts from incrementing correctly. The backend is feeling solid.

### 2. UX & Polish
Ships are made in the details. Pushed a few key quality-of-life updates:
- **Search Navigation:** You can now fully navigate search results with the keyboard (arrow keys + enter).
- **Layout Fixes:** Cleaned up the alignment in the "Start Here" section and fixed a missing style block on the homepage.
- **Site Deploy:** The major site overhaul is officially live on production.

### 3. The Knowledge Graph Refactor (Technical)
We completely ripped out the old 3D graph visualization today. It was buggy, hard to control, and resource-heavy. We replaced it with a custom 2D force-directed graph built from scratch using HTML5 Canvas.
- **Physics Engine:** Tuned repulsion, damping, and center gravity to stop the "exploding graph" effect.
- **Performance:** Optimized for dozens of nodes without frame drops.
- **Interactivity:** Smooth zooming, panning, and hover states that don't jitter.

### 4. Design Aesthetics (The New Look)
For the new graph visualizer, we’re pivoting to a "Swiss Design" aesthetic. Moving away from dark mode sci-fi tropes to something cleaner and more editorial.
- **Palette:** White background, vibrant International Orange (`#ea580c`), and Deep Blue (`#2563eb`).
- **Typography:** Using Inter with high-contrast labels.
- **Vibe:** It feels less like a video game and more like an interactive OS for thought.

---

### **One-Line Summary**
"Today was a marathon: Switched the AI brain to Gemini Flash 2.0, fixed the tracking bugs, deployed the new site, and completely rewrote the knowledge graph engine to look like a Swiss design poster."
