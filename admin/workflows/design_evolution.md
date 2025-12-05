---
description: Design Evolution Loop - Proactively research and apply design trends.
---

# Design Evolution Loop

This workflow empowers the "Studio OS" to actively learn from the web and evolve the design system.

## 1. Scout Design Trends
The Visionary agent uses the Web Scout to research the latest trends.

```python
from admin.engineers.visionary import Visionary
visionary = Visionary()

# Research current trends
trends = visionary.research_design_trends("modern minimalist web design trends 2025")
print(f"Found {len(trends['general_trends'])} general trend insights.")
print(f"Found {len(trends['color_trends'])} color trend insights.")
```

## 2. Analyze & Critique
The Visionary critiques the current `style.css` against these new insights.

```python
# Read current styles
with open("css/style.css", "r") as f:
    current_css = f.read()

# Generate a critique based on trends
critique = visionary.critique_design(current_css[:1500]) # Send a chunk
print("\n=== Design Critique ===\n")
print(critique)
```

## 3. Propose Mission (Optional)
If significant improvements are found, the Visionary can propose a mission for the Operator.
