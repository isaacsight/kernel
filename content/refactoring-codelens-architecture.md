---
title: "Refactoring for AI: From Script to Package"
date: 2025-11-29
category: Engineering
tags: [python, refactoring, architecture, ai]
---

When building AI applications, it's easy to start with a single `app.py` script. It's fast, simple, and gets the job done. But as your application grows—adding new models, complex UI logic, and configuration management—that single file becomes a bottleneck.

Today, I refactored **CodeLens**, my AI code review agent, from a monolithic script into a modular Python package. Here is why and how I did it.

### The Problem with "The Script"

My `codelens_app.py` was doing too much:
1.  **UI Logic**: Handling `customtkinter` windows and events.
2.  **Business Logic**: Managing file I/O and diffs.
3.  **AI Integration**: Calling Anthropic and Google Gemini APIs.
4.  **Configuration**: Loading API keys from JSON.

This made it hard to test, hard to read, and impossible to extend without breaking something.

### The Solution: Modular Architecture

I split the application into a structured package:

```text
codelens/
├── __init__.py
├── config.py          # Configuration management
├── ai_providers.py    # AI model integration
├── gui.py             # UI components
└── utils/
    └── logger.py      # ML interaction logging
```

### Key Benefits

1.  **Separation of Concerns**: The `gui.py` module doesn't know *how* the AI works; it just asks for a provider and sends a prompt.
2.  **Swappable Components**: I can now add a new AI provider (like OpenAI or a local Llama model) by simply adding a class to `ai_providers.py`, without touching the UI code.
3.  **Scalability**: We can now add unit tests for each module independently.

This refactor lays the groundwork for more advanced features like automated evaluation and complex agentic workflows.
