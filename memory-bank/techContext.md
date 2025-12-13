# Tech Context

## Technology Stack
### Core
- **Language**: Python 3.9+
- **SSG Engine**: Custom Python (`build.py`)
- **Web Server (Dev)**: `http.server` (standard lib) or `uvicorn`

### Libraries & Dependencies
- **Web Framework**: `fastapi`, `uvicorn` (possibly for a dynamic component or API, though the main output is static).
- **Data Validation**: `pydantic`.
- **Content Parsing**: `python-frontmatter`.
- **TUI**: `rich`, `textual`.
- **AI/ML**: `google-generativeai`, `openai`, `anthropic`, `huggingface_hub`.
- **Media**: `moviepy`, `gTTS`, `edge-tts`, `tiktok-uploader`, `TikTokApi`.
- **Utilities**: `python-dotenv`, `email-validator`, `nest_asyncio`, `playwright`.

### Development Tools
- **Testing**: `pytest`, `pytest-cov`.
- **Linting/Formatting**: `black`, `ruff`.
- **Type Checking**: `mypy`.
- **Security**: `bandit`.

## Development Environment
- **OS**: Mac (User's current OS).
- **Version Control**: Git.
- **Branching Strategy**: Standard feature branches (assumed).

## Configuration
- **Project**: `pyproject.toml` (Ruff, Black, Pytest, Mypy config).
- **Secrets**: `.env` (API keys).
- **Pre-commit**: `.pre-commit-config.yaml`.
