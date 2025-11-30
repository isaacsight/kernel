---
category: Engineering
date: 2025-11-30
tags:
- ai
- automation
- autonomy
- python
title: 'Towards Site Autonomy'
---

We are witnessing a shift in how we interact with our tools. For the longest time, "automation" meant writing a script that you manually triggered to do a repetitive task. It was a "human-in-the-loop" system where the human was the initiator and the manager.

Yesterday, I built a [Site Manager Assistant](building-a-custom-site-manager.html) to help me manage this blog. It was a great step forward—a TUI that centralized my workflow. But as I used it, I realized something: **Why am I still the one pushing the buttons?**

## The Shift to Autonomy

The goal isn't just to have better tools; it's to have tools that don't need *me* to operate them. I want to move from an "Assistant" model (where the AI waits for my command) to a "Manager" model (where the AI proactively handles the site).

We are now transitioning the blog's infrastructure to be fully autonomous. This means:

1.  **Headless Operation**: The site manager shouldn't need a TUI. It should run as a background daemon, constantly monitoring the state of the blog.
2.  **Context Awareness**: The system needs to "know" what the blog is. It needs to know if the server is running, if there are uncommitted changes, and if there are drafts waiting to be published.
3.  **Self-Correction**: If the server crashes, the system should restart it. If a build fails, it should alert me or try to fix it.

## What the Site Knows

To make this possible, we are giving the AI access to the "nervous system" of the blog. We've exposed:

*   **Server Status**: Real-time monitoring of the local preview server.
*   **Git State**: Awareness of the repository's status (clean, dirty, ahead/behind).
*   **Content Inventory**: A live index of all posts, tags, and categories.

## The Future

Imagine a blog that writes its own changelog. A site that notices a broken link and fixes it. A platform that suggests new internal links as you write.

This isn't just about saving a few keystrokes. It's about treating the website not as a static collection of files, but as a living organism that tends to itself.

## The Roadmap

We are moving beyond theory. Here is how we are implementing this autonomy for *Does This Feel Right?*:

1.  **The Automated Janitor**: We are building a background daemon that wakes up daily to check for "link rot," verify image integrity, and ensure all metadata is consistent. It won't just report errors; it will attempt to fix them.
2.  **Contextual Linking**: As I write in the TUI, the AI will analyze my draft against the entire archive of existing posts. It will suggest relevant internal links, weaving a tighter web of ideas without me needing to search for them.
3.  **Self-Documentation**: The site will begin writing its own history. By analyzing git commits and file changes, the AI will maintain a `changelog.md`, turning raw code updates into a readable narrative of the site's evolution.

We are building the nervous system today. Tomorrow, we give it a brain.
