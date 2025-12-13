# System Patterns

## Architecture
### Static Site Generator (SSG)
- **Core Script**: `build.py` is the heart of the SSG. It orchestrates the reading of content, template rendering, and file writing.
- **Content**: Markdown files in `content/` with YAML frontmatter.
- **Templates**: HTML templates in `templates/` (likely Jinja2 or similar custom interpolation).
- **Video/Media**: Handled via `static/` directory.

### Admin Interface (TUI)
- **Framework**: `Textual`.
- **Structure**: `admin/` directory containing `tui.py` (UI layer) and `core.py` (business logic).
- **Communication**: Interacts with the local filesystem (content, git) and external APIs (AI).

### AI Services
- **Integration**: `ai-tools/` (assumed based on file list) or directly within `admin/`.
- **Providers**: APIs for Gemini, OpenAI, Claude are integrated for content assistance.

## Design Patterns
- **Frontmatter Metadata**: Using YAML headers to define post attributes is a key pattern for content management.
- **Command-Line First**: The project prioritizes CLI/TUI interactions for administration over a web-based CMS.
- **CI/CD Deployment**: Relying on GitHub Actions to build and deploy ensures that the `docs/` folder (or build artifact) is always in sync with the repository.

## Component Relationships
- `build.py` reads `content/` -> generates `docs/`.
- `admin/tui.py` reads/writes `content/` and triggers `build.py`.
- `scripts/` automate various dev and ops tasks (setup, testing, security).
