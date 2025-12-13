# Product Context

## Problem Statement
Traditional blogging platforms lack the "soul" of a hand-crafted digital garden. This project creates a **"Swiss Console"** aesthetic—functional, precise, and beautiful—powered by a custom Python engine that gives the author absolute control over every pixel and link.

## User Experience
- **The Reader ("The User")**:
    - **Aesthetic**: "Swiss Console". Clean typography, minimal noise, high utility.
    - **Navigation**: associative rather than just linear. Readers can "drift" through content via "Read Next", "Referenced By", and graph connections.
    - **Discovery**: Explicit "Start Here" tracks vs. "Experiments" vs. "Main Feed".
- **The Author ("The Operator")**:
    - **Interface**: A Terminal UI (TUI) that feels like a sci-fi command deck.
    - **Workflow**: 
        1. Check "Mission Control" for system status.
        2. "Commission" AI agents to draft ideas.
        3. Refine content in the "Content Studio" editor.
        4. "Publish" via Git integration.

## Design System Elements (Inferred)
- **Colors**:
    - Surface / Background: Dark/Light modes (handled via CSS variables).
    - Accents: Used for Agent Status ("Green" for Running, "Red" for Stopped) and Tag colors (modulo 6 color rotation in `build.py`).
- **Typography**:
    - Headers: `#`, `##` converted to standard HTML tags.
    - Badges: `mode-badge`, `version-badge` used to distinguish content types.
- **Layout**:
    - **Cards**: "Starter Set" cards, "Experiment" cards.
    - **Grid**: `card-grid` class for listings.
- **Badges**:
    - "Canon" (Canonical posts).
    - "Essay" vs "Experiment".
    - Pillars (Thematic groupings).

## AI Persona ("The Alchemist")
- **Role**: Content Generator.
- **Capabilities**: Topic research, drafting, checking against a "Style Guide".
