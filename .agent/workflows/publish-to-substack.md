---
description: How to publish a blog post to Substack
---

This workflow describes how to automate the distribution of a local Markdown post to Substack using the `Socialite` agent.

# Prerequisites

1.  **Cookies**: Ensure `substack_cookies.json` exists in the project root.
    *   If missing, run `python3 scripts/get_cookies.py` and log in manually.
2.  **Content**: valid Markdown file in `content/` with frontmatter:
    ```yaml
    title: My Post Title
    subtitle: My Exciting Subtitle
    ---
    ```

# Steps

1.  **Build the Site** (Optional but recommended to update RSS):
    ```bash
    python3 build.py
    ```

2.  **Run Distribution Script**:
    There are two scripts available. Choose one based on your need:
    
    *   **Specific Post (Team Intro):**
        ```bash
        python3 scripts/finalize_substack_dist.py
        ```
    *   **Generic/Progress Post:**
        ```bash
        python3 scripts/finalize_progress_dist.py
        ```

    *To publish a different file, edit the `filename` variable in `scripts/finalize_substack_dist.py`.*

# Troubleshooting

*   **Missing Subtitle**: Ensure `subtitle:` key exists in frontmatter. `Socialite` prioritizes `subtitle` > `excerpt` > empty.
*   **Login Redirects**: If the script logs "Redirected to login", delete `substack_cookies.json` and re-authenticate.
*   **Selectors**: The automation uses:
    *   Title: `[data-testid="post-title"]`
    *   Subtitle: `[placeholder="Add a subtitle…"]` (Regex-matched)
    *   Content: `.tiptap.ProseMirror` (Direct HTML injection)
