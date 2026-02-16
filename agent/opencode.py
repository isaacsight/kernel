#!/usr/bin/env python3
"""
OpenCode — Local AI Coding Agent

A CLI that discovers, manages, and runs open-weight models locally via Ollama.
No API keys needed. Uses the OpenAI SDK to talk to Ollama's compatible API.

Usage:
    python3 opencode.py                                    # interactive REPL
    python3 opencode.py "refactor the auth module"         # single task
    python3 opencode.py --model qwen3-coder:8b "fix bug"  # specific model
    python3 opencode.py --confirm "delete old files"       # step-by-step approval
    python3 opencode.py models                             # list catalog + downloaded
    python3 opencode.py pull qwen3-coder:8b                # download a model
    python3 opencode.py remove qwen3-coder:8b              # remove a model
    python3 opencode.py serve                              # ensure Ollama is running
    python3 opencode.py doctor                             # full health check
"""

import argparse
import json
import os
import sys

# --- Dependency checks ---

try:
    from openai import OpenAI
except ImportError:
    print("Error: openai package not installed. Run: pip3 install openai")
    sys.exit(1)

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.markdown import Markdown
    from rich.text import Text
    from rich import box
except ImportError:
    print("Error: rich package not installed. Run: pip3 install rich")
    sys.exit(1)

try:
    from prompt_toolkit import PromptSession
    from prompt_toolkit.history import FileHistory
except ImportError:
    PromptSession = None  # Graceful fallback to input()

# --- Local imports ---

from agent.config import (
    OLLAMA_API_URL,
    DEFAULT_MODEL,
    MAX_TOKENS,
    MAX_ITERATIONS,
    SYSTEM_PROMPT,
    MODEL_CATALOG,
    MODEL_MAP,
)
from agent.tools import TOOL_SCHEMAS, execute_tool
from agent.fallback import (
    build_tool_prompt_section,
    parse_tool_calls_from_text,
    extract_text_before_tools,
)
from agent.models import (
    find_ollama,
    is_ollama_running,
    ensure_ollama,
    list_local_models,
    get_local_model_names,
    pull_model,
    remove_model,
    get_system_ram_gb,
    get_recommended_models,
)


console = Console()


# ============================================================
# Client
# ============================================================

def create_client() -> OpenAI:
    """Create an OpenAI client pointed at the local Ollama server."""
    return OpenAI(
        base_url=OLLAMA_API_URL,
        api_key="ollama",  # Ollama ignores this but the SDK requires it
    )


# ============================================================
# Agent Loop — Native Tool Calling
# ============================================================

def agent_loop_native(
    client: OpenAI,
    model: str,
    task: str,
    confirm: bool = False,
    max_iterations: int = MAX_ITERATIONS,
) -> None:
    """Agent loop for models that support OpenAI function calling."""
    system = SYSTEM_PROMPT.format(cwd=os.getcwd())
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": task},
    ]

    for i in range(max_iterations):
        console.print(f"\n[dim]--- iteration {i + 1}/{max_iterations} ---[/dim]")

        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                tools=TOOL_SCHEMAS,
                max_tokens=MAX_TOKENS,
            )
        except Exception as e:
            console.print(f"[red]API error: {e}[/red]")
            break

        choice = response.choices[0]
        msg = choice.message

        # Print any text content
        if msg.content:
            console.print(Panel(Markdown(msg.content), border_style="green", padding=(1, 2)))

        # No tool calls — done
        if not msg.tool_calls:
            break

        # Append assistant message (with tool calls)
        messages.append(msg)

        # Process each tool call
        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments)
            except json.JSONDecodeError:
                args = {}

            _print_tool_call(name, args)

            if confirm and name in ("write_file", "edit_file", "bash"):
                if not _confirm_action(name, args):
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": "Skipped by user.",
                    })
                    continue

            result = execute_tool(name, args)
            _print_tool_result(name, result)

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result,
            })

        if choice.finish_reason == "stop":
            break

    console.print("\n[bold green]Done.[/bold green]")


# ============================================================
# Agent Loop — Fallback (Prompt-Based)
# ============================================================

def agent_loop_fallback(
    client: OpenAI,
    model: str,
    task: str,
    confirm: bool = False,
    max_iterations: int = MAX_ITERATIONS,
) -> None:
    """Agent loop for models WITHOUT native tool calling. Uses XML parsing."""
    tool_section = build_tool_prompt_section()
    system = SYSTEM_PROMPT.format(cwd=os.getcwd()) + "\n" + tool_section
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": task},
    ]

    for i in range(max_iterations):
        console.print(f"\n[dim]--- iteration {i + 1}/{max_iterations} ---[/dim]")

        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=MAX_TOKENS,
            )
        except Exception as e:
            console.print(f"[red]API error: {e}[/red]")
            break

        choice = response.choices[0]
        raw_text = choice.message.content or ""

        # Extract prose before tool calls
        prose = extract_text_before_tools(raw_text)
        if prose:
            console.print(Panel(Markdown(prose), border_style="green", padding=(1, 2)))

        # Parse tool calls from text
        tool_calls = parse_tool_calls_from_text(raw_text)

        if not tool_calls:
            # No tools invoked — model is done
            break

        # Append assistant's raw message
        messages.append({"role": "assistant", "content": raw_text})

        # Execute tools and build result message
        result_parts = []
        for tc in tool_calls:
            name = tc["name"]
            args = tc["arguments"]

            _print_tool_call(name, args)

            if confirm and name in ("write_file", "edit_file", "bash"):
                if not _confirm_action(name, args):
                    result_parts.append(f"[{name}]: Skipped by user.")
                    continue

            result = execute_tool(name, args)
            _print_tool_result(name, result)
            result_parts.append(f"[{name}] Result:\n{result}")

        # Feed results back as a user message
        messages.append({
            "role": "user",
            "content": "Tool results:\n\n" + "\n\n".join(result_parts),
        })

    console.print("\n[bold green]Done.[/bold green]")


# ============================================================
# Display Helpers
# ============================================================

def _print_tool_call(name: str, args: dict) -> None:
    """Print a tool call in a readable format."""
    if name == "bash":
        console.print(f"  [bold cyan]$ {args.get('command', '')}[/bold cyan]")
    elif name == "read_file":
        console.print(f"  [cyan]read[/cyan] {args.get('path', '')}")
    elif name == "write_file":
        console.print(f"  [yellow]write[/yellow] {args.get('path', '')}")
    elif name == "edit_file":
        console.print(f"  [yellow]edit[/yellow] {args.get('path', '')}")
    elif name == "glob_search":
        console.print(f"  [cyan]glob[/cyan] {args.get('pattern', '')}")
    elif name == "grep_search":
        console.print(f"  [cyan]grep[/cyan] {args.get('pattern', '')}")
    else:
        console.print(f"  [cyan]{name}[/cyan] {json.dumps(args)[:80]}")


def _print_tool_result(name: str, result: str) -> None:
    """Print a truncated tool result."""
    preview = result[:300]
    if len(result) > 300:
        preview += "..."
    if result.startswith("Error"):
        console.print(f"  [red]{preview}[/red]")
    else:
        console.print(f"  [dim]{preview}[/dim]")


def _confirm_action(name: str, args: dict) -> bool:
    """Ask user for confirmation before a mutating action."""
    console.print(f"  [yellow]Confirm {name}?[/yellow] ", end="")
    try:
        resp = input("[y/N] ").strip().lower()
        return resp == "y"
    except (EOFError, KeyboardInterrupt):
        return False


# ============================================================
# Subcommands
# ============================================================

def cmd_models() -> None:
    """Display model catalog with download status."""
    ok, msg = ensure_ollama()
    local = get_local_model_names() if ok else set()
    ram = get_system_ram_gb()

    table = Table(
        title="OpenCode Model Catalog",
        box=box.ROUNDED,
        show_lines=True,
    )
    table.add_column("Model", style="bold")
    table.add_column("Size", justify="right")
    table.add_column("Category")
    table.add_column("Tools")
    table.add_column("Status")
    table.add_column("Description")

    for m in MODEL_CATALOG:
        downloaded = m.name in local
        fits = m.min_ram_gb <= ram

        status_parts = []
        if downloaded:
            status_parts.append("[green]downloaded[/green]")
        if not fits:
            status_parts.append("[red]too large[/red]")
        if m.name == DEFAULT_MODEL:
            status_parts.append("[cyan]default[/cyan]")
        status = " ".join(status_parts) if status_parts else "[dim]available[/dim]"

        tools = "[green]native[/green]" if m.supports_tools else "[yellow]fallback[/yellow]"

        table.add_row(
            m.name,
            f"{m.size_gb} GB",
            m.category,
            tools,
            status,
            m.description,
        )

    console.print(table)
    console.print(f"\n[dim]System RAM: {ram:.0f} GB | Ollama: {'running' if ok else 'not running'}[/dim]")


def cmd_pull(model_name: str) -> None:
    """Download a model."""
    ok, msg = ensure_ollama()
    if not ok:
        console.print(f"[red]{msg}[/red]")
        return

    if model_name in MODEL_MAP:
        info = MODEL_MAP[model_name]
        console.print(f"Pulling [bold]{info.display_name}[/bold] ({info.size_gb} GB)...")
    else:
        console.print(f"Pulling [bold]{model_name}[/bold] (not in catalog)...")

    success, result = pull_model(model_name)
    if success:
        console.print(f"[green]{result}[/green]")
    else:
        console.print(f"[red]{result}[/red]")


def cmd_remove(model_name: str) -> None:
    """Remove a downloaded model."""
    success, msg = remove_model(model_name)
    if success:
        console.print(f"[green]{msg}[/green]")
    else:
        console.print(f"[red]{msg}[/red]")


def cmd_serve() -> None:
    """Ensure Ollama is running."""
    ok, msg = ensure_ollama()
    style = "green" if ok else "red"
    console.print(f"[{style}]{msg}[/{style}]")


def cmd_doctor() -> None:
    """Full health check."""
    console.print(Panel("[bold]OpenCode Doctor[/bold]", border_style="cyan"))

    # 1. Ollama binary
    binary = find_ollama()
    if binary:
        console.print(f"  [green]✓[/green] Ollama found: {binary}")
    else:
        console.print("  [red]✗[/red] Ollama not found")
        console.print("    Install: curl -fsSL https://ollama.com/install.sh | sh")

    # 2. Ollama running
    if is_ollama_running():
        console.print("  [green]✓[/green] Ollama server is running")
    else:
        console.print("  [yellow]![/yellow] Ollama not running (use 'opencode serve' to start)")

    # 3. System RAM
    ram = get_system_ram_gb()
    console.print(f"  [green]✓[/green] System RAM: {ram:.0f} GB")
    recommended = get_recommended_models(ram)
    console.print(f"  [dim]  {len(recommended)}/{len(MODEL_CATALOG)} models fit in RAM[/dim]")

    # 4. Python packages
    packages = {"openai": "openai", "rich": "rich", "prompt_toolkit": "prompt_toolkit"}
    for display, module in packages.items():
        try:
            __import__(module)
            console.print(f"  [green]✓[/green] {display} installed")
        except ImportError:
            console.print(f"  [red]✗[/red] {display} missing — pip3 install {display}")

    # 5. Local models
    if is_ollama_running():
        local = list_local_models()
        if local:
            console.print(f"\n  [bold]Downloaded models ({len(local)}):[/bold]")
            for m in local:
                name = m.get("name", "unknown")
                size_bytes = m.get("size", 0)
                size_gb = size_bytes / (1024 ** 3)
                console.print(f"    {name} ({size_gb:.1f} GB)")
        else:
            console.print("\n  [yellow]No models downloaded yet.[/yellow]")
            console.print(f"  Try: python3 opencode.py pull {DEFAULT_MODEL}")


def cmd_interactive(client: OpenAI, model: str, model_info, confirm: bool) -> None:
    """Interactive REPL with prompt_toolkit."""
    console.print(
        Panel(
            f"[bold]OpenCode[/bold] — local AI coding agent\n"
            f"Model: [cyan]{model_info.display_name if model_info else model}[/cyan]\n"
            f"Tools: {'native' if model_info and model_info.supports_tools else 'fallback'}\n"
            f"Type [bold]quit[/bold] to exit, [bold]model <name>[/bold] to switch",
            border_style="cyan",
        )
    )

    # Set up prompt with history
    history_path = os.path.expanduser("~/.opencode_history")
    if PromptSession:
        session = PromptSession(history=FileHistory(history_path))
        get_input = lambda: session.prompt("→ ")
    else:
        get_input = lambda: input("→ ")

    agent_fn = _pick_agent_fn(model_info)

    while True:
        try:
            task = get_input().strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\nGoodbye.")
            break

        if not task:
            continue
        if task.lower() in ("quit", "exit", "q"):
            console.print("Goodbye.")
            break

        # In-session model switch
        if task.lower().startswith("model "):
            new_model = task.split(None, 1)[1].strip()
            model_info = MODEL_MAP.get(new_model)
            model = new_model
            agent_fn = _pick_agent_fn(model_info)
            name = model_info.display_name if model_info else new_model
            console.print(f"Switched to [cyan]{name}[/cyan]")
            continue

        agent_fn(client, model, task, confirm=confirm)


def _pick_agent_fn(model_info):
    """Pick the right agent loop based on model capabilities."""
    if model_info and model_info.supports_tools:
        return agent_loop_native
    return agent_loop_fallback


# ============================================================
# Auto-pull
# ============================================================

def auto_pull_if_needed(model: str) -> bool:
    """If the model isn't downloaded, offer to pull it. Returns True if ready."""
    local = get_local_model_names()
    if model in local:
        return True

    info = MODEL_MAP.get(model)
    name = info.display_name if info else model
    size = f" ({info.size_gb} GB)" if info else ""

    console.print(f"\n[yellow]{name}{size} is not downloaded.[/yellow]")
    try:
        resp = input("Download now? [Y/n] ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        return False

    if resp in ("", "y", "yes"):
        ok, msg = pull_model(model)
        if ok:
            console.print(f"[green]{msg}[/green]")
            return True
        console.print(f"[red]{msg}[/red]")
        return False

    return False


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="OpenCode — Local AI Coding Agent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Subcommands:\n"
            "  models            List model catalog + download status\n"
            "  pull <model>      Download a model\n"
            "  remove <model>    Remove a downloaded model\n"
            "  serve             Start Ollama server\n"
            "  doctor            Full health check\n"
        ),
    )
    parser.add_argument(
        "task",
        nargs="*",
        default=[],
        help="Task to execute, or a subcommand (models, pull, remove, serve, doctor)",
    )
    parser.add_argument(
        "--model", "-m",
        default=DEFAULT_MODEL,
        help=f"Model to use (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--confirm", "-c",
        action="store_true",
        help="Require confirmation for write/edit/bash actions",
    )
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=MAX_ITERATIONS,
        help=f"Max agent iterations (default: {MAX_ITERATIONS})",
    )
    args = parser.parse_args()

    words = args.task

    # --- Handle subcommands ---
    if words and words[0] == "doctor":
        cmd_doctor()
        return

    if words and words[0] == "models":
        cmd_models()
        return

    if words and words[0] == "serve":
        cmd_serve()
        return

    if words and words[0] == "pull":
        if len(words) < 2:
            console.print(f"[red]Usage: opencode pull <model>[/red]")
            console.print(f"[dim]Example: opencode pull {DEFAULT_MODEL}[/dim]")
            return
        cmd_pull(words[1])
        return

    if words and words[0] == "remove":
        if len(words) < 2:
            console.print("[red]Usage: opencode remove <model>[/red]")
            return
        cmd_remove(words[1])
        return

    # --- Agent mode: ensure Ollama is running ---
    ok, msg = ensure_ollama()
    if not ok:
        console.print(f"[red]{msg}[/red]")
        sys.exit(1)

    model = args.model
    model_info = MODEL_MAP.get(model)

    # Auto-pull model if needed
    if not auto_pull_if_needed(model):
        console.print("[red]Cannot proceed without a model.[/red]")
        sys.exit(1)

    client = create_client()
    agent_fn = _pick_agent_fn(model_info)

    if words:
        # Single task mode
        task = " ".join(words)
        agent_fn(client, model, task, confirm=args.confirm, max_iterations=args.max_iterations)
    else:
        # Interactive REPL
        cmd_interactive(client, model, model_info, confirm=args.confirm)


if __name__ == "__main__":
    main()
