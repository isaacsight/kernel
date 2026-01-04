# Procedural + Modular Web Architecture

Reference patterns for evolving the DTFR site into a living, self-assembling interface.

## Architecture Layers

| Layer | Purpose | Implementation |
|-------|---------|----------------|
| **Presentation** | Web Components with Shadow DOM | Jinja2 templates → Custom Elements |
| **Orchestration** | AI-driven module assembly | `build.py` + agent workflows |
| **Generation** | Procedural algorithms | Noise functions, seeds, constraints |

## Priority Patterns

### 1. Seed-Based Generation
Use visitor timestamp + context as seed for reproducible but unique layouts.

### 2. Chain-of-Modules
Sequential data pipeline: `input → transform → render`

### 3. Dynamic Composition  
Runtime assembly based on rules (time of day, visitor notes, etc.)

### 4. Constraint-Based Assembly
Mathematical rules ensure valid module combinations.

## Implementation Ideas

- **Time-based header**: Sky color, sun position based on visitor timezone
- **Notes-driven layout**: Visitor notes influence module arrangement
- **Procedural trails**: Essays rearrange based on reading patterns

## References

- [callie.zone procedural header](https://callie.zone/blog/procedural-generation-website)
- [Relume AI wireframes](https://www.relume.io)
- [Velvet modular PCG](https://reddit.com/r/gamedev/comments/48ykgs/)
- [Unreal PCG Framework](https://dev.epicgames.com/documentation/en-us/unreal-engine/procedural-content-generation-overview)
