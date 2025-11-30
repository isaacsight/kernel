---
category: Engineering
date: 2025-11-29
tags:
- python
- textual
- automation
- tools
title: 'Building a Custom Site Manager'
---


Managing a static site often involves juggling multiple terminal windows: one for the preview server, one for the editor, and another for git commands. It gets messy fast.

Today, I built a custom **Site Manager Assistant** to solve this.

## The Problem
I constantly had orphan `python -m http.server` processes running in the background. I'd forget to kill them, leading to "Address already in use" errors and general system clutter.

## The Solution
I upgraded my existing Python TUI (built with [Textual](https://textual.textualize.io/)) to handle the entire lifecycle.

### Key Features
1.  **Integrated Server Control**: I can start and stop the local preview server directly from the dashboard. No more separate terminal tabs.
2.  **Live Logs**: Server logs are piped directly into the TUI, so I can catch 404s or 500s instantly.
3.  **Automated Cleanup**: A wrapper script (`manage_site.sh`) ensures that whenever I close the app, all background processes are killed.

## How it Works
The backend uses Python's `subprocess` module to manage the server process. It captures the PID and uses `os.killpg` to ensure the entire process group is terminated when requested.

```python
def stop_server(self):
    os.killpg(os.getpgid(self.process.pid), 15)
Now, I have a single "Command Center" for my entire blog workflow.