---
title: "Tracking AI Experiments: Building a Custom Logger"
date: 2025-11-29
category: Machine Learning
tags: [mlops, logging, data-engineering, ai]
---

In traditional software engineering, logs are for debugging errors. In Machine Learning engineering, logs are for **science**.

One of the most critical best practices in ML is "Track Experiments." You can't improve what you don't measure. Today, I added a custom ML logger to CodeLens to track every interaction with our AI models.

### Why Log Interactions?

When an AI generates code, several things matter:
*   **Latency**: How long did the user wait?
*   **Prompt**: What exactly did we send to the model?
*   **Model Version**: Was this Claude 3.5 Sonnet or Gemini 1.5 Pro?
*   **Output**: What did the model return?

Without logging this data, we are flying blind. We don't know if a prompt change improved the output or if a specific model is causing latency spikes.

### The Implementation

I built a simple, JSON-line based logger in `codelens/utils/logger.py`:

```python
class MLLogger:
    @staticmethod
    def log_interaction(provider, model, system_prompt, user_prompt, response, latency_ms):
        entry = {
            "timestamp": datetime.now().isoformat(),
            "provider": provider,
            "model": model,
            "inputs": {"system": system_prompt, "user": user_prompt},
            "outputs": {"response": response},
            "metrics": {"latency_ms": latency_ms}
        }
        # Append to a .jsonl file
```

### The "Dataset" Mindset

By saving these logs to `~/.codelens/logs/interactions.jsonl`, I am effectively building a **proprietary dataset** of code review interactions. 

In the future, I can use this data to:
1.  **Fine-tune** a smaller model to perform code reviews.
2.  **Run evaluations** to compare different models against my own past usage.
3.  **Detect drift** if the model's performance changes over time.

Data is the fuel for AI, and now CodeLens is harvesting its own fuel.
