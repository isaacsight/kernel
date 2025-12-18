#!/usr/bin/env python3
"""
Health Check Script
Usage: python scripts/check_health.py

Checks for:
1. High CPU usage by specific processes.
2. Large directories that are not excluded from indexing.
"""
import os
import psutil
import json
import toml
from pathlib import Path

# Thresholds
CPU_THRESHOLD = 50.0  # Percentage
LARGE_DIR_THRESHOLD = 1000  # Number of files

# Known heavy processes to watch
WATCH_LIST = ["run-jedi-language-server.py", "Adobe", "Code Helper", "Electron"]

def check_cpu_usage():
    print("Checking CPU usage...")
    issues_found = False
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'cmdline']):
        try:
            # Get process details
            cmdline = proc.info['cmdline'] or []
            cmd_str = " ".join(cmdline)
            name = proc.info['name']
            cpu = proc.info['cpu_percent']

            # Check against watch list
            for watch_item in WATCH_LIST:
                if watch_item in cmd_str or watch_item in name:
                    if cpu > CPU_THRESHOLD:
                        print(f"⚠️  HIGH CPU: {name} (PID {proc.info['pid']}) is using {cpu}% CPU.")
                        print(f"    Command: {cmd_str[:100]}...")
                        issues_found = True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    
    if not issues_found:
        print("✅  No high CPU usage detected from watched processes.")

def get_ignored_dirs(root: Path):
    ignored = set()
    
    # Check pyproject.toml
    pyproject_path = root / "pyproject.toml"
    if pyproject_path.exists():
        try:
            data = toml.load(pyproject_path)
            # Add black/ruff excludes
            ignored.update(data.get("tool", {}).get("black", {}).get("extend-exclude", "").split("|"))
            ignored.update(data.get("tool", {}).get("ruff", {}).get("exclude", []))
        except Exception:
            pass
            
    # Check .vscode/settings.json
    vscode_path = root / ".vscode" / "settings.json"
    if vscode_path.exists():
        try:
            with open(vscode_path) as f:
                data = json.load(f)
                excludes = data.get("python.analysis.exclude", [])
                ignored.update(excludes)
                ignored.update(data.get("files.watcherExclude", {}).keys())
        except Exception:
            pass

    # Clean up strings
    clean_ignored = set()
    for item in ignored:
        clean = item.strip().replace("test", "").replace("*", "").replace("/", "").replace("\\", "").replace("(", "").replace(")", "").strip()
        if clean:
            clean_ignored.add(clean)
            
    return clean_ignored

def check_workspace_bloat():
    print("\nChecking workspace for large un-indexed directories...")
    root = Path(".")
    ignored_dirs = get_ignored_dirs(root)
    # Add standard ignores
    ignored_dirs.update({".git", ".venv", "__pycache__", "node_modules", "dist", "build"})
    
    print(f"ℹ️  Ignoring: {', '.join(sorted(ignored_dirs))}")
    
    issues_found = False
    for item in root.iterdir():
        if item.is_dir() and item.name not in ignored_dirs:
            # Count files
            try:
                count = sum(1 for _ in item.rglob('*') if _.is_file())
                if count > LARGE_DIR_THRESHOLD:
                    print(f"⚠️  LARGE DIRECTORY: '{item.name}' has {count} files and is NOT clearly ignored.")
                    print(f"    Action: Add '{item.name}' to pyproject.toml and .vscode/settings.json")
                    issues_found = True
            except Exception as e:
                print(f"    Error scanning {item.name}: {e}")

    if not issues_found:
        print("✅  No large un-indexed directories found.")

if __name__ == "__main__":
    print("=== System Health Check ===\n")
    check_cpu_usage()
    check_workspace_bloat()
    print("\n=== Check Complete ===")
