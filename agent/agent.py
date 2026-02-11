#!/usr/bin/env python3
"""
macOS Computer-Use Agent
Uses Claude's computer_use API to see your screen and control your Mac.

Usage:
    python3 agent.py                              # interactive mode
    python3 agent.py "open Safari and search X"   # single task
    python3 agent.py --confirm "organize files"   # with action confirmation
"""

import argparse
import base64
import json
import os
import subprocess
import sys
import time

try:
    from anthropic import Anthropic
except ImportError:
    print("Error: anthropic package not installed. Run: pip3 install anthropic")
    sys.exit(1)

from computer import (
    get_screen_dimensions,
    compute_api_dimensions,
    take_screenshot,
    execute as computer_execute,
)

# --- Configuration ---

DEFAULT_MODEL = "claude-sonnet-4-5-20250929"
MAX_TOKENS = 4096

SYSTEM_PROMPT = """You are a computer-use agent operating on macOS. You can see the user's screen and control their mouse and keyboard.

Key macOS conventions:
- Use Command (⌘) instead of Ctrl for most shortcuts (Command+C, Command+V, Command+Tab, etc.)
- Command+Space opens Spotlight search — great for launching apps
- Command+Q quits applications, Command+W closes windows/tabs
- The menu bar is at the top of the screen, the Dock is at the bottom
- Right-click via Ctrl+Click or two-finger tap

Guidelines:
- Take a screenshot first to see the current state before acting
- Be precise with click coordinates — aim for the center of buttons/links
- After typing in a search bar or URL bar, press Return to confirm
- Wait briefly after actions that trigger loading (opening apps, loading pages)
- If something doesn't work, try an alternative approach
- Prefer keyboard shortcuts when they're faster than clicking
- Use Spotlight (Command+Space) to quickly open applications
"""


def load_api_key():
    """Load API key from environment or .env file."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        return key

    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("ANTHROPIC_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")

    print("Error: ANTHROPIC_API_KEY not found.")
    print("Set it via: export ANTHROPIC_API_KEY='sk-ant-...'")
    print(f"Or create {env_path} with: ANTHROPIC_API_KEY=sk-ant-...")
    sys.exit(1)


def build_tools(api_w, api_h):
    """Build the tool definitions for the API call."""
    return [
        {
            "type": "computer_20250124",
            "name": "computer",
            "display_width_px": api_w,
            "display_height_px": api_h,
            "display_number": 1,
        },
        {
            "type": "bash_20250124",
            "name": "bash",
        },
        {
            "type": "text_editor_20250124",
            "name": "str_replace_based_edit_tool",
        },
    ]


def execute_bash(command, timeout=120):
    """Execute a shell command and return stdout+stderr."""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output = ""
        if result.stdout:
            output += result.stdout
        if result.stderr:
            output += ("\n" if output else "") + result.stderr
        if result.returncode != 0:
            output += f"\n[exit code: {result.returncode}]"
        return output or "[no output]"
    except subprocess.TimeoutExpired:
        return f"[command timed out after {timeout}s]"
    except Exception as e:
        return f"[error: {e}]"


def execute_text_editor(command, path, file_text=None, insert_line=None,
                        new_str=None, old_str=None, view_range=None):
    """Execute text editor tool commands."""
    try:
        if command == "view":
            if not os.path.exists(path):
                return f"Error: {path} does not exist"
            with open(path) as f:
                lines = f.readlines()
            if view_range:
                start, end = view_range
                lines = lines[start - 1:end]
                numbered = [f"{i + start}: {l}" for i, l in enumerate(lines)]
            else:
                numbered = [f"{i + 1}: {l}" for i, l in enumerate(lines)]
            return "".join(numbered) or "[empty file]"

        elif command == "create":
            dir_path = os.path.dirname(path)
            if dir_path:
                os.makedirs(dir_path, exist_ok=True)
            with open(path, "w") as f:
                f.write(file_text or "")
            return f"Created {path}"

        elif command == "str_replace":
            if not os.path.exists(path):
                return f"Error: {path} does not exist"
            with open(path) as f:
                content = f.read()
            if old_str not in content:
                return f"Error: old_str not found in {path}"
            if content.count(old_str) > 1:
                return f"Error: old_str appears {content.count(old_str)} times in {path}. Must be unique."
            content = content.replace(old_str, new_str, 1)
            with open(path, "w") as f:
                f.write(content)
            return f"Replaced in {path}"

        elif command == "insert":
            if not os.path.exists(path):
                return f"Error: {path} does not exist"
            with open(path) as f:
                lines = f.readlines()
            insert_idx = insert_line  # 0 = before first line, n = after line n
            lines.insert(insert_idx, new_str + "\n")
            with open(path, "w") as f:
                f.writelines(lines)
            return f"Inserted at line {insert_line} in {path}"

        else:
            return f"Unknown command: {command}"

    except Exception as e:
        return f"Error: {e}"


def agent_loop(client, model, task, tools, dims, confirm=False, max_iterations=50):
    """
    Core agent loop:
    1. Send task + screenshot to Claude
    2. Process tool calls
    3. Execute actions
    4. Send results back
    5. Repeat until done
    """
    api_w, api_h, logical_w, logical_h = dims

    # Take initial screenshot
    screenshot_b64 = take_screenshot(api_w, api_h)

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": f"Here is your task: {task}",
                },
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": screenshot_b64,
                    },
                },
            ],
        }
    ]

    iteration = 0

    while iteration < max_iterations:
        iteration += 1
        print(f"\n--- Iteration {iteration}/{max_iterations} ---")

        try:
            response = client.messages.create(
                model=model,
                max_tokens=MAX_TOKENS,
                system=SYSTEM_PROMPT,
                tools=tools,
                messages=messages,
            )
        except Exception as e:
            print(f"API error: {e}")
            break

        # Process response blocks
        assistant_content = response.content
        tool_results = []
        has_tool_use = False

        for block in assistant_content:
            if block.type == "text":
                print(f"\nClaude: {block.text}")

            elif block.type == "tool_use":
                has_tool_use = True
                tool_name = block.name
                tool_id = block.id
                tool_input = block.input

                print(f"\n[Tool: {tool_name}]", end="")

                if tool_name == "computer":
                    action = tool_input.get("action", "")
                    print(f" action={action}", end="")
                    if tool_input.get("coordinate"):
                        print(f" coord={tool_input['coordinate']}", end="")
                    if tool_input.get("text"):
                        display_text = tool_input['text'][:80]
                        print(f" text=\"{display_text}\"", end="")
                    print()

                    if confirm:
                        resp = input("  Execute? [y/N] ").strip().lower()
                        if resp != "y":
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": tool_id,
                                "content": "Action skipped by user.",
                            })
                            continue

                    result = computer_execute(
                        action=action,
                        coordinate=tool_input.get("coordinate"),
                        text=tool_input.get("text"),
                        duration=tool_input.get("duration"),
                        scroll_direction=tool_input.get("scroll_direction"),
                        scroll_amount=tool_input.get("scroll_amount"),
                        start_coordinate=tool_input.get("start_coordinate"),
                        button=tool_input.get("button"),
                        api_w=api_w, api_h=api_h,
                        logical_w=logical_w, logical_h=logical_h,
                    )

                    if action == "screenshot":
                        # Return screenshot as image
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": tool_id,
                            "content": [
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": "image/png",
                                        "data": result,
                                    },
                                }
                            ],
                        })
                    else:
                        # After non-screenshot actions, take a screenshot automatically
                        time.sleep(0.5)
                        new_screenshot = take_screenshot(api_w, api_h)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": tool_id,
                            "content": [
                                {
                                    "type": "text",
                                    "text": "Action executed successfully.",
                                },
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": "image/png",
                                        "data": new_screenshot,
                                    },
                                },
                            ],
                        })

                elif tool_name == "bash":
                    command = tool_input.get("command", "")
                    print(f" $ {command}")

                    if confirm:
                        resp = input("  Execute? [y/N] ").strip().lower()
                        if resp != "y":
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": tool_id,
                                "content": "Command skipped by user.",
                            })
                            continue

                    restart = tool_input.get("restart", False)
                    output = execute_bash(command)
                    print(f"  Output: {output[:500]}")
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": output,
                    })

                elif tool_name == "str_replace_based_edit_tool":
                    cmd = tool_input.get("command", "")
                    path = tool_input.get("path", "")
                    print(f" {cmd} {path}")

                    if confirm and cmd != "view":
                        resp = input("  Execute? [y/N] ").strip().lower()
                        if resp != "y":
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": tool_id,
                                "content": "Action skipped by user.",
                            })
                            continue

                    output = execute_text_editor(
                        command=cmd,
                        path=path,
                        file_text=tool_input.get("file_text"),
                        insert_line=tool_input.get("insert_line"),
                        new_str=tool_input.get("new_str"),
                        old_str=tool_input.get("old_str"),
                        view_range=tool_input.get("view_range"),
                    )
                    print(f"  {output[:500]}")
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": output,
                    })

                else:
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": f"Unknown tool: {tool_name}",
                    })

        # If no tool use, Claude is done
        if not has_tool_use:
            print("\n[Task complete]")
            break

        # If stop reason is end_turn with tool use, still continue
        if response.stop_reason == "end_turn" and not has_tool_use:
            break

        # Add assistant response and tool results to messages
        messages.append({"role": "assistant", "content": assistant_content})
        messages.append({"role": "user", "content": tool_results})

    if iteration >= max_iterations:
        print(f"\n[Stopped: reached {max_iterations} iteration limit]")


def main():
    parser = argparse.ArgumentParser(
        description="macOS Computer-Use Agent powered by Claude"
    )
    parser.add_argument(
        "task",
        nargs="?",
        default=None,
        help="Task to execute (omit for interactive mode)",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Claude model to use (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Ask for confirmation before each action",
    )
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=50,
        help="Maximum agent iterations (default: 50)",
    )
    args = parser.parse_args()

    # Load API key
    api_key = load_api_key()
    client = Anthropic(api_key=api_key)

    # Detect screen
    logical_w, logical_h, physical_w, physical_h = get_screen_dimensions()
    api_w, api_h = compute_api_dimensions(physical_w, physical_h)

    print(f"Screen: {logical_w}x{logical_h} logical, {physical_w}x{physical_h} physical")
    print(f"API dimensions: {api_w}x{api_h}")
    print(f"Model: {args.model}")
    if args.confirm:
        print("Confirmation mode: ON")
    print()

    tools = build_tools(api_w, api_h)
    dims = (api_w, api_h, logical_w, logical_h)

    if args.task:
        # Single task mode
        agent_loop(client, args.model, args.task, tools, dims,
                   confirm=args.confirm, max_iterations=args.max_iterations)
    else:
        # Interactive mode
        print("Computer-Use Agent (type 'quit' to exit)")
        print("=" * 45)
        while True:
            try:
                task = input("\nTask> ").strip()
                if not task:
                    continue
                if task.lower() in ("quit", "exit", "q"):
                    print("Goodbye.")
                    break
                agent_loop(client, args.model, task, tools, dims,
                           confirm=args.confirm, max_iterations=args.max_iterations)
            except KeyboardInterrupt:
                print("\n\nInterrupted. Goodbye.")
                break


if __name__ == "__main__":
    main()
