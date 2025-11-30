---
title: "Multi-Model AI: Managing Claude and Gemini Providers"
date: 2025-11-29
category: Engineering
tags: [python, design-patterns, anthropic, gemini]
---

Vendor lock-in is a real risk in the AI space. If you build your entire application around a single API, you are vulnerable to price hikes, outages, or model deprecations.

To make CodeLens robust, I implemented a flexible **Provider System** that allows users to switch between Anthropic's Claude and Google's Gemini models on the fly.

### The Provider Pattern

I defined an abstract base class `AIProvider` that enforces a common interface:

```python
class AIProvider:
    def call(self, system_prompt: str, user_message: str) -> str:
        raise NotImplementedError
```

Then, I implemented concrete classes for each service:

*   `AnthropicProvider`: Handles the `anthropic` SDK client.
*   `GeminiProvider`: Handles the `google.generativeai` SDK.

### Configuration Management

To make this usable, I needed a way to manage API keys without hardcoding them. I created a `ConfigManager` that loads settings from `~/.codelens/config.json`.

Now, the application logic is simple:

```python
# gui.py
provider = get_provider(self.config)
response = provider.call(system_prompt, user_msg)
```

The UI doesn't care if it's talking to Claude or Gemini. It just asks for a completion.

### Why This Matters

This flexibility allows CodeLens to:
1.  **Optimize for Cost**: Use Gemini Flash for simple explanations.
2.  **Optimize for Quality**: Use Claude 3.5 Sonnet for complex refactoring.
3.  **Fallback**: If one API goes down, the user can switch to the other.

Building for model independence is a key step in creating professional-grade AI tools.
