# Developer Guide

Comprehensive guide for developing the Does This Feel Right blog project.

## Table of Contents

- [Local Development Setup](#local-development-setup)
- [Development Workflow](#development-workflow)
- [Code Quality Tools](#code-quality-tools)
- [Testing](#testing)
- [AI-Assisted Development](#ai-assisted-development)
- [Troubleshooting](#troubleshooting)

## Local Development Setup

### System Requirements

- **Python**: 3.9 or later
- **Git**: Latest version
- **Terminal**: macOS Terminal, iTerm2, or similar
- **Optional**: Cursor IDE or VS Code

### Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/isaachernandez/blog-design.git
cd blog-design

# 2. Run the automated setup script
bash scripts/setup_dev.sh

# 3. Activate the virtual environment
source .venv/bin/activate

# 4. Configure environment variables
cp .env.example .env
nano .env  # Add your API keys
```

### API Keys Required

You'll need at least one AI provider API key:

- **Gemini** (Recommended): https://makersuite.google.com/app/apikey
- **OpenAI** (Optional): https://platform.openai.com/api-keys
- **Anthropic** (Optional): https://console.anthropic.com/settings/keys

Add these to your `.env` file.

## Development Workflow

### Daily Workflow

```bash
# 1. Activate environment
source .venv/bin/activate

# 2. Pull latest changes
git pull

# 3. Make your changes
# ... edit files ...

# 4. Run quality checks (automatic with pre-commit)
black .
ruff check . --fix
pytest

# 5. Commit (pre-commit hooks will auto-run)
git add .
git commit -m "feat: your feature description"
git push
```

### Building the Site

```bash
# Build static site
python build.py

# Serve locally
python -m http.server 8000 --directory docs

# Open browser
open http://localhost:8000
```

### Using the TUI Admin

```bash
# Launch the terminal UI
python3 admin/tui.py

# Keyboard shortcuts:
# n - New post
# g - Generate AI post
# r - Refresh post list
# p - Publish to Git
# q - Quit
```

## Code Quality Tools

### Black (Code Formatting)

Auto-formats Python code to a consistent style.

```bash
# Format all files
black .

# Check without modifying
black . --check

# Format specific file
black build.py
```

Configuration: `pyproject.toml` → `[tool.black]`

### Ruff (Linting)

Fast Python linter that catches errors and enforces best practices.

```bash
# Check all files
ruff check .

# Auto-fix issues
ruff check . --fix

# Check specific file
ruff check build.py
```

Configuration: `pyproject.toml` → `[tool.ruff]`

### MyPy (Type Checking)

Static type checker for Python.

```bash
# Check all files
mypy build.py admin/*.py

# Check with detailed output
mypy --show-error-codes build.py
```

Configuration: `pyproject.toml` → `[tool.mypy]`

### Pre-commit Hooks

Automatically run checks before each commit.

```bash
# Install hooks (one-time)
pre-commit install

# Run manually on all files
pre-commit run --all-files

# Skip hooks for a commit (NOT RECOMMENDED)
git commit --no-verify -m "message"
```

Configuration: `.pre-commit-config.yaml`

## Testing

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html

# Run specific test file
pytest tests/test_build.py

# Run specific test
pytest tests/test_build.py::TestMarkdownToHtml::test_headers

# Use the convenience script
bash scripts/run_tests.sh
```

### Writing Tests

Create test files in `tests/` directory:

```python
# tests/test_feature.py
import pytest

def test_my_feature():
    """Test description."""
    result = my_function()
    assert result == expected_value
```

Use fixtures from `conftest.py`:

```python
def test_with_temp_dir(temp_dir):
    """Test using temporary directory fixture."""
    test_file = temp_dir / "test.txt"
    # ...
```

### Coverage Reports

After running tests with coverage:

```bash
# Open HTML coverage report
open htmlcov/index.html

# View in terminal
pytest --cov=. --cov-report=term-missing
```

## AI-Assisted Development

### Using Cursor IDE

**Setup:**
1. Open project: `cursor .`
2. Cursor will use the `.cursorrules` (if you create one)

**Workflow:**
- `Cmd+K`: Inline AI edit
- `Cmd+L`: Chat about code
- Reference files: `@build.py`
- Ask to follow style: "Use the coding style from pyproject.toml"

**Best Practices:**
- Be specific: "Add type hints to the parse_frontmatter function"
- Request tests: "Write pytest tests for this function"
- Ask for documentation: "Add docstrings following PEP 257"

### Using Aider

```bash
# Start Aider with files
aider build.py admin/core.py

# In Aider chat:
# /add <file>       - Add file to chat
# /drop <file>      - Remove file
# /commit           - Commit changes
# /run pytest       - Run command
# /help             - Show all commands
```

**Example workflow:**
```bash
aider build.py

# Then in Aider:
> Add type hints to all functions in this file
> Run pytest to verify changes work
> /commit "Added type hints to build.py"
```

### AI Prompting Tips

**Good Prompts:**
- "Add security validation to save_post() to prevent path traversal"
- "Refactor the build() function into smaller, testable functions"
- "Write pytest tests for markdown_to_html() covering edge cases"

**Bad Prompts:**
- "Make it better"
- "Fix the code"
- "Add features"

## Troubleshooting

### Common Issues

**Issue: ModuleNotFoundError**
```bash
# Solution: Ensure virtual environment is activated
source .venv/bin/activate
pip install -r requirements.txt
```

**Issue: Pre-commit hooks failing**
```bash
# Solution: Run fixes manually
black .
ruff check . --fix
pre-commit run --all-files
```

**Issue: Tests failing**
```bash
# Solution: Check test output and fix issues
pytest -v  # Verbose output
pytest --lf  # Run last-failed tests only
```

**Issue: API keys not working**
```bash
# Solution: Check .env file
cat .env  # Verify keys are set
# Ensure .env is in project root
# Restart TUI after changing .env
```

**Issue: Build fails**
```bash
# Solution: Check for syntax errors
python -m py_compile build.py

# Check logs
python build.py 2>&1 | tee build.log
```

### Getting Help

1. **Check logs**: Look for error messages
2. **Run tests**: `pytest -v` shows detailed output
3. **Review docs**: Check implementation_plan.md in artifacts
4. **Use AI**: Ask Cursor or Aider to help debug
5. **Git history**: `git log --oneline` to see recent changes

## Performance Tips

### Build Performance

```python
# Use caching for expensive operations
from functools import lru_cache

@lru_cache(maxsize=256)
def expensive_function(arg):
    # ...
```

### Profile Code

```bash
# Profile build.py
python -m cProfile -o profile.stats build.py

# Analyze results
python -m pstats profile.stats
# Then: sort cumtime, stats 10
```
## System Optimization & Maintenance

### 1. Health Check Script
We have a script to monitor for high CPU usage and workspace bloat. Run this if your system feels slow.
```bash
python scripts/check_health.py
```

### 2. Workspace Exclusions
To keep VS Code and the Language Server fast, large data directories **must** be excluded from indexing.
**Current Exclusions:**
- `tools/` (>12k files)
- `node_modules/`
- `.venv/`

**How to Exclude a New Directory:**
If you add a folder with many files (datasets, logs, etc.), you must add it to:
1.  **`pyproject.toml`** (under `black`, `ruff`, `mypy`).
2.  **`.vscode/settings.json`** (under `python.analysis.exclude` and `files.watcherExclude`).
3.  **`pyrightconfig.json`**.

### 3. Emergency Fixes
If VS Code is using high CPU:
1.  Run `python scripts/check_health.py` to identify the cause.
2.  **Reload Window**: Press `Cmd+Shift+P` -> "Developer: Reload Window".
3.  **Kill Process**: If it's stuck, kill the `run-jedi-language-server` process.
## Code Style Guidelines

### Python Style (PEP 8)

- **Line length**: 100 characters (configured in pyproject.toml)
- **Indentation**: 4 spaces
- **Naming**:
  - Functions/variables: `snake_case`
  - Classes: `PascalCase`
  - Constants: `UPPER_CASE`

### Documentation

```python
def function_name(param: str) -> dict:
    """
    Short description.

    Args:
        param: Description of parameter

    Returns:
        Description of return value

    Raises:
        ValueError: When param is invalid
    """
    pass
```

### Type Hints

Always add type hints:

```python
from typing import List, Dict, Optional

def process_posts(posts: List[Dict[str, str]]) -> Optional[str]:
    """Process blog posts."""
    pass
```

## Git Workflow

### Commit Messages

Follow conventional commits:

```
feat: add new feature
fix: fix bug
docs: update documentation
style: format code
refactor: refactor code
test: add tests
chore: update dependencies
```

### Branching

```bash
# Feature branch
git checkout -b feature/new-feature

# Bug fix
git checkout -b fix/bug-description

# Merge to main
git checkout main
git merge feature/new-feature
```

## Next Steps

- Read the [2025 Dev Excellence Guide](/artifacts/2025-dev-excellence-guide.md)
- Review the [Implementation Plan](/artifacts/implementation_plan.md)
- Check [SECURITY.md](SECURITY.md) for security best practices
- Explore the test suite in `tests/`

---

## System Architecture

### Background Processes (The "Spin Up")

The system "spins up" in the background using the `launch-studio.sh` script, which orchestrates two main components:

1.  **Backend (`uvicorn`)**: 
    - Runs `admin.api.main:app` on port 8000.
    - Launched with `&` to run in the background.
    - Manages Agents (Alchemist, Guardian), Database (Supabase), and File Operations.

2.  **Frontend (`vite`)**:
    - Runs `npm run dev` in `admin/web` on port 5173.
    - Launched with `&` to run in the background.
    - Provides the UI for the Admin Dashboard.

**How it works:**
The script captures the Process IDs (PIDs) of these background jobs (`$!`) and sets a `trap` to kill them when you press Ctrl+C. This ensures both "spin up" together and shut down cleanly.

### Agent Plugin System (Planned)
We are moving towards a dynamic plugin system where agents can be dropped into a `plugins/` directory. Currently, agents are hardcoded in `core/agents.py`, but the new architecture will allow for modular extension.

**Questions?** Check the artifacts or use AI assistance (Cursor/Aider).
