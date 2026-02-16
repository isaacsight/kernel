"""
OpenCode Fallback — Prompt-based tool calling for models without native support.

Models like Qwen2.5-Coder and DeepSeek don't support OpenAI function calling.
Instead, we inject tool descriptions into the system prompt and parse
<tool_call> XML blocks from the model's text output.
"""

import json
import re

from .tools import TOOL_SCHEMAS


def build_tool_prompt_section() -> str:
    """Generate a tool description block for injection into the system prompt."""
    lines = [
        "\n## Available Tools",
        "When you need to use a tool, output a <tool_call> block with valid JSON inside.",
        "You may output multiple tool calls in a single response.",
        "Format:\n",
        "<tool_call>",
        '{"name": "tool_name", "arguments": {"param": "value"}}',
        "</tool_call>\n",
        "After tool results are provided, continue your work.\n",
        "Tools:\n",
    ]

    for schema in TOOL_SCHEMAS:
        func = schema["function"]
        name = func["name"]
        desc = func["description"]
        params = func["parameters"]["properties"]
        required = func["parameters"].get("required", [])

        lines.append(f"### {name}")
        lines.append(f"{desc}\n")
        lines.append("Parameters:")
        for pname, pinfo in params.items():
            req = " (required)" if pname in required else " (optional)"
            lines.append(f"  - {pname}: {pinfo.get('description', '')}{req}")
        lines.append("")

    return "\n".join(lines)


def _repair_json(text: str) -> str:
    """Attempt to fix common JSON issues from small models."""
    # Replace single quotes with double quotes (but not inside strings)
    # Simple heuristic: if the text has single-quoted keys, swap them
    if "'" in text and '"' not in text:
        text = text.replace("'", '"')

    # Remove trailing commas before } or ]
    text = re.sub(r",\s*([}\]])", r"\1", text)

    # Fix unquoted keys: { key: "value" } -> { "key": "value" }
    text = re.sub(r'(?<=[{,])\s*(\w+)\s*:', r' "\1":', text)

    return text


def parse_tool_calls_from_text(text: str) -> list[dict]:
    """
    Extract tool calls from model output text.

    Looks for patterns like:
        <tool_call>
        {"name": "read_file", "arguments": {"path": "foo.py"}}
        </tool_call>

    Returns list of {"name": str, "arguments": dict} dicts.
    """
    calls = []

    # Match <tool_call>...</tool_call> blocks
    pattern = re.compile(
        r"<tool_call>\s*(.*?)\s*</tool_call>",
        re.DOTALL,
    )

    for match in pattern.finditer(text):
        raw = match.group(1).strip()
        if not raw:
            continue

        # Try parsing as-is first
        parsed = _try_parse(raw)
        if not parsed:
            # Try with repairs
            parsed = _try_parse(_repair_json(raw))

        if parsed and "name" in parsed:
            calls.append({
                "name": parsed["name"],
                "arguments": parsed.get("arguments", {}),
            })

    return calls


def _try_parse(text: str) -> dict | None:
    """Try to parse JSON, return None on failure."""
    try:
        return json.loads(text)
    except (json.JSONDecodeError, ValueError):
        return None


def extract_text_before_tools(text: str) -> str:
    """Get the model's text response before any tool calls."""
    # Find the first <tool_call> tag
    idx = text.find("<tool_call>")
    if idx == -1:
        return text.strip()
    return text[:idx].strip()
