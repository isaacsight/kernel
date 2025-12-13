# System Patterns

## Architecture

### 1. Static Site Generator (SSG) - `build.py`
The build system is a single-script orchestrator that transforms markdown content into a fully static website.
- **Pipeline**:
    1. **Pre-Build Hooks**: Runs registered plugins (e.g., Architect hooks) before starting.
    2. **Clean & Prep**: Wipes `docs/` and sets up `CNAME`/`.nojekyll`.
    3. **Asset Replication**: Copies `static/` to `docs/static`. *Legacy*: copies `css`/`js` to root for template compatibility.
    4. **Template Loading**: Reads Jinja2-style templates (`base.html`, `post.html`, `index.html`) from `templates/`.
        - *Note*: It uses string replacement (`.replace('{{ title }}', ...)`), not a full Template engine like Jinja2.
    5. **Post Processing**:
        - Iterates `content/` (skips `about.html`, `consulting.md` initially).
        - Parses Frontmatter (`parse_frontmatter`).
        - Converts Markdown -> HTML (`markdown_to_html` custom parser).
        - **Hooks**: Runs `on_post_process` hook.
        - **Validation**: Enforces `title` and `date`.
    6. **Ordering & Filtering**:
        - Sorts by Date (Descending).
        - Logic to separate "Starter Set", "Experiments" (slug starts with `ai-`), and "Main Feed".
    7. **HTML Generation**:
        - **Cross-linking**: Computes "Read Next" (explicit mentions -> Pillar fallback -> Global fallback).
        - **Backlinks**: Computes "Referenced By" index.
        - **Badges**: Injects "Classic" / "Experiment" mode badges.
        - **JSON-LD**: Injects structured data for SEO.
    8. **Homepage**: Generates `docs/index.html` with filter bars and categorized lists.

### 2. Admin Interface (TUI) - `admin/tui.py`
Built with `Textual`, acting as a "Mission Control" for the blog.
- **Layout**: Tabbed interface (`Mission Control`, `Content Studio`).
- **Engineers (Agents)**:
    - **Concept**: The app treats code modules as "Agents" (e.g., *The Alchemist* for content, *The Guardian* for safety).
    - **Visuals**: Displayed as `AgentCard` widgets in a Grid.
- **Content Studio**:
    - `ListView` on the left for posts (fetched via `core.get_posts()`).
    - `EditorScreen` (Modal) for editing content, frontmatter, and tags.
- **Server Manager**: Controls a local `http.server` running in a background thread/process via `core.ServerManager`.
- **AI Integration**: `AIGenerationModal` to "Commission The Alchemist" for drafting posts using Gemini/HuggingFace.

## Design Patterns
- **The "Engineers" Metaphor**: The code organization uses an anthropomorphic metaphor (Architect, Librarian, Guardian) to group functionality.
- **Custom Markdown Parser**: `build.py` implements its own `markdown_to_html` instead of using `markdown-it-py` or similar, offering bespoke control over code blocks and formatting.
- **Metadata-Driven Logic**: YAML frontmatter (`pillar`, `mode`, `connections`) drives the site's complex cross-linking and navigation structure.
- **Dual-Path Navigation**: The site supports both chronological browsing (Main Feed) and graph-based traversal (Backlinks, "Read Next", Connects To).
