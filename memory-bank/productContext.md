# Product Context

## Problem Statement
Traditional CMSs can be bloated and insecure, while raw static site generators often lack user-friendly management tools. This project bridges the gap by offering a custom, high-performance static site generator coupled with a powerful terminal-based admin interface and AI assistance.

## User Experience
- **Readers**: fast, responsive, and visually distinct blog experience ("Swiss Console" design).
- **Authors/Admins**: A productive command-line interface (TUI) for drafting, editing, and publishing posts, aided by AI tools for generating content and ideas.

## Feature Description
### Static Site Engine
- **Custom Build Script**: `build.py` handles the conversion of markdown to HTML, template rendering, and asset management.
- **Frontmatter**: Uses YAML frontmatter for metadata (title, date, tags, etc.).

### Admin Interface (TUI)
- **Framework**: Built with `Textual`.
- **Capabilities**:
    - Manage posts (create, edit, delete).
    - Generate content using AI.
    - Git operations (commit, push).

### AI Integration
- **Providers**: Google Gemini, OpenAI, Anthropic.
- **Functions**: generating post ideas, drafting content, and potentially editing/refining text.

### Deployment & Security
- **GitHub Pages**: Automated deployment target.
- **Security**: `bandit` for security scanning, `ruff` for linting.
