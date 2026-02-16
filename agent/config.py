"""
OpenCode Configuration — Model catalog, constants, and system prompt.
"""

from dataclasses import dataclass


@dataclass
class ModelInfo:
    name: str
    display_name: str
    size_gb: float
    min_ram_gb: int
    supports_tools: bool
    context_window: int
    description: str
    category: str  # "coding" or "general"


MODEL_CATALOG: list[ModelInfo] = [
    ModelInfo(
        name="qwen3-coder:8b",
        display_name="Qwen3 Coder 8B",
        size_gb=4.9,
        min_ram_gb=8,
        supports_tools=True,
        context_window=32768,
        description="Fast coding model with native tool calling",
        category="coding",
    ),
    ModelInfo(
        name="qwen3-coder:30b",
        display_name="Qwen3 Coder 30B (MoE)",
        size_gb=18.0,
        min_ram_gb=24,
        supports_tools=True,
        context_window=32768,
        description="Large MoE coding model — best code quality",
        category="coding",
    ),
    ModelInfo(
        name="devstral-small-2:24b",
        display_name="Devstral Small 24B",
        size_gb=14.0,
        min_ram_gb=20,
        supports_tools=True,
        context_window=32768,
        description="Mistral's dedicated coding model",
        category="coding",
    ),
    ModelInfo(
        name="qwen2.5-coder:7b",
        display_name="Qwen2.5 Coder 7B",
        size_gb=4.7,
        min_ram_gb=8,
        supports_tools=False,
        context_window=32768,
        description="Compact coding model (prompt-based tools)",
        category="coding",
    ),
    ModelInfo(
        name="llama3.1:8b",
        display_name="Llama 3.1 8B",
        size_gb=4.7,
        min_ram_gb=8,
        supports_tools=True,
        context_window=131072,
        description="Meta's general-purpose model with long context",
        category="general",
    ),
    ModelInfo(
        name="qwen3:8b",
        display_name="Qwen3 8B",
        size_gb=4.9,
        min_ram_gb=8,
        supports_tools=True,
        context_window=32768,
        description="Strong general-purpose model with tool calling",
        category="general",
    ),
    ModelInfo(
        name="mistral-small3.2:24b",
        display_name="Mistral Small 3.2 24B",
        size_gb=14.0,
        min_ram_gb=20,
        supports_tools=True,
        context_window=32768,
        description="Mistral's efficient general-purpose model",
        category="general",
    ),
    ModelInfo(
        name="deepseek-coder-v2:16b",
        display_name="DeepSeek Coder V2 16B",
        size_gb=8.9,
        min_ram_gb=12,
        supports_tools=False,
        context_window=65536,
        description="Strong coding model (prompt-based tools)",
        category="coding",
    ),
]

# Lookup by name
MODEL_MAP: dict[str, ModelInfo] = {m.name: m for m in MODEL_CATALOG}

# Defaults
OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_API_URL = f"{OLLAMA_BASE_URL}/v1"
DEFAULT_MODEL = "qwen3-coder:8b"
MAX_TOKENS = 4096
MAX_ITERATIONS = 30

SYSTEM_PROMPT = """You are OpenCode, a local AI coding agent running on the user's machine. You have direct access to their filesystem and can read, write, edit files, run shell commands, and search the codebase.

Current working directory: {cwd}

## Guidelines
- Read files before modifying them to understand existing code
- Make surgical edits with edit_file rather than rewriting entire files
- Run tests or build commands after making changes to verify correctness
- Use glob_search and grep_search to explore the codebase before diving in
- Be concise in explanations — focus on what you changed and why
- If a command fails, analyze the error and try a different approach
- Never modify files outside the project without explicit permission

## Tool Usage
You have 6 tools: read_file, write_file, edit_file, bash, glob_search, grep_search.
Use them to accomplish the user's task. When you're done, summarize what you did."""
