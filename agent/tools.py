"""
OpenCode Tools — 6 tool schemas (OpenAI function format) and execution logic.
"""

import glob
import json
import os
import subprocess

MAX_OUTPUT = 10000  # Truncation limit for tool outputs


TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a file's contents with line numbers. Use offset/limit for large files.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute or relative path to the file",
                    },
                    "offset": {
                        "type": "integer",
                        "description": "Line number to start from (1-based). Default: 1",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max number of lines to read. Default: all",
                    },
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Create or overwrite a file with the given content. Creates parent directories as needed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Path to the file to write",
                    },
                    "content": {
                        "type": "string",
                        "description": "Full content to write to the file",
                    },
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "edit_file",
            "description": "Make a surgical find-and-replace edit in a file. old_str must match exactly one location.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Path to the file to edit",
                    },
                    "old_str": {
                        "type": "string",
                        "description": "Exact string to find (must be unique in the file)",
                    },
                    "new_str": {
                        "type": "string",
                        "description": "Replacement string",
                    },
                },
                "required": ["path", "old_str", "new_str"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "bash",
            "description": "Execute a shell command and return stdout/stderr. Use for builds, tests, git, etc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Shell command to execute",
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds. Default: 120",
                    },
                },
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "glob_search",
            "description": "Find files matching a glob pattern. Returns file paths sorted by modification time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Glob pattern (e.g. '**/*.py', 'src/**/*.ts')",
                    },
                    "path": {
                        "type": "string",
                        "description": "Base directory to search in. Default: current directory",
                    },
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "grep_search",
            "description": "Search file contents for a regex pattern. Uses ripgrep if available, falls back to grep.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Regex pattern to search for",
                    },
                    "path": {
                        "type": "string",
                        "description": "File or directory to search in. Default: current directory",
                    },
                    "file_glob": {
                        "type": "string",
                        "description": "Filter to specific file types (e.g. '*.py', '*.ts')",
                    },
                },
                "required": ["pattern"],
            },
        },
    },
]


def _truncate(text: str) -> str:
    """Truncate output to protect context windows."""
    if len(text) > MAX_OUTPUT:
        return text[:MAX_OUTPUT] + f"\n\n... [truncated, {len(text)} chars total]"
    return text


def execute_read_file(path: str, offset: int = 1, limit: int | None = None) -> str:
    """Read a file with line numbers."""
    path = os.path.expanduser(path)
    if not os.path.exists(path):
        return f"Error: file not found: {path}"
    if os.path.isdir(path):
        return f"Error: {path} is a directory, not a file"
    try:
        with open(path) as f:
            lines = f.readlines()
        start = max(0, offset - 1)
        end = start + limit if limit else len(lines)
        selected = lines[start:end]
        numbered = [f"{i + start + 1}: {line}" for i, line in enumerate(selected)]
        result = "".join(numbered)
        return _truncate(result) if result else "[empty file]"
    except Exception as e:
        return f"Error reading {path}: {e}"


def execute_write_file(path: str, content: str) -> str:
    """Write content to a file, creating parent directories."""
    path = os.path.expanduser(path)
    try:
        dir_path = os.path.dirname(path)
        if dir_path:
            os.makedirs(dir_path, exist_ok=True)
        with open(path, "w") as f:
            f.write(content)
        lines = content.count("\n") + (1 if content and not content.endswith("\n") else 0)
        return f"Wrote {lines} lines to {path}"
    except Exception as e:
        return f"Error writing {path}: {e}"


def execute_edit_file(path: str, old_str: str, new_str: str) -> str:
    """Surgical find-and-replace in a file."""
    path = os.path.expanduser(path)
    if not os.path.exists(path):
        return f"Error: file not found: {path}"
    try:
        with open(path) as f:
            content = f.read()
        count = content.count(old_str)
        if count == 0:
            return f"Error: old_str not found in {path}"
        if count > 1:
            return f"Error: old_str found {count} times in {path} — must be unique"
        new_content = content.replace(old_str, new_str, 1)
        with open(path, "w") as f:
            f.write(new_content)
        return f"Edited {path} (replaced 1 occurrence)"
    except Exception as e:
        return f"Error editing {path}: {e}"


def execute_bash(command: str, timeout: int = 120) -> str:
    """Execute a shell command."""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=os.getcwd(),
        )
        output = ""
        if result.stdout:
            output += result.stdout
        if result.stderr:
            output += ("\n" if output else "") + result.stderr
        if result.returncode != 0:
            output += f"\n[exit code: {result.returncode}]"
        return _truncate(output) if output else "[no output]"
    except subprocess.TimeoutExpired:
        return f"[command timed out after {timeout}s]"
    except Exception as e:
        return f"[error: {e}]"


def execute_glob(pattern: str, path: str | None = None) -> str:
    """Find files matching a glob pattern."""
    try:
        base = path or os.getcwd()
        base = os.path.expanduser(base)
        full_pattern = os.path.join(base, pattern)
        matches = sorted(glob.glob(full_pattern, recursive=True))
        # Filter out directories, keep files
        files = [m for m in matches if os.path.isfile(m)]
        if not files:
            return f"No files match pattern: {pattern}"
        # Sort by mtime descending
        files.sort(key=lambda f: os.path.getmtime(f), reverse=True)
        result = "\n".join(files[:200])
        if len(files) > 200:
            result += f"\n... and {len(files) - 200} more files"
        return result
    except Exception as e:
        return f"Error: {e}"


def execute_grep(pattern: str, path: str | None = None, file_glob: str | None = None) -> str:
    """Search file contents using ripgrep or grep."""
    base = path or os.getcwd()
    base = os.path.expanduser(base)

    # Try ripgrep first
    rg = _which("rg")
    if rg:
        cmd = [rg, "-n", "--no-heading", "--color=never", "-e", pattern]
        if file_glob:
            cmd.extend(["--glob", file_glob])
        cmd.append(base)
    else:
        cmd = ["grep", "-rn", "--color=never", "-E", pattern]
        if file_glob:
            cmd.extend(["--include", file_glob])
        cmd.append(base)

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
        )
        output = result.stdout or ""
        if not output:
            return f"No matches for pattern: {pattern}"
        return _truncate(output)
    except subprocess.TimeoutExpired:
        return "[search timed out]"
    except Exception as e:
        return f"Error: {e}"


def _which(name: str) -> str | None:
    """Find an executable on PATH."""
    for dir_ in os.environ.get("PATH", "").split(os.pathsep):
        full = os.path.join(dir_, name)
        if os.path.isfile(full) and os.access(full, os.X_OK):
            return full
    return None


def execute_tool(name: str, args: dict) -> str:
    """Dispatch a tool call to the appropriate executor."""
    executors = {
        "read_file": lambda a: execute_read_file(
            a["path"], a.get("offset", 1), a.get("limit")
        ),
        "write_file": lambda a: execute_write_file(a["path"], a["content"]),
        "edit_file": lambda a: execute_edit_file(
            a["path"], a["old_str"], a["new_str"]
        ),
        "bash": lambda a: execute_bash(a["command"], a.get("timeout", 120)),
        "glob_search": lambda a: execute_glob(a["pattern"], a.get("path")),
        "grep_search": lambda a: execute_grep(
            a["pattern"], a.get("path"), a.get("file_glob")
        ),
    }
    executor = executors.get(name)
    if not executor:
        return f"Unknown tool: {name}"
    try:
        return executor(args)
    except KeyError as e:
        return f"Missing required argument: {e}"
    except Exception as e:
        return f"Tool execution error: {e}"
