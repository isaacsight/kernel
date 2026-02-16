"""
OpenCode Models — Ollama lifecycle management.

Handles detection, installation, starting, model pulling/listing/removal.
Uses only stdlib (urllib, subprocess) — no extra dependencies.
"""

import json
import os
import platform
import subprocess
import sys
import time
import urllib.error
import urllib.request

from .config import OLLAMA_BASE_URL, MODEL_CATALOG, MODEL_MAP


def find_ollama() -> str | None:
    """Find the ollama binary. Checks PATH + standard macOS locations."""
    # Check PATH
    for dir_ in os.environ.get("PATH", "").split(os.pathsep):
        path = os.path.join(dir_, "ollama")
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path

    # Standard macOS install locations
    for path in [
        "/usr/local/bin/ollama",
        os.path.expanduser("~/.ollama/bin/ollama"),
        "/opt/homebrew/bin/ollama",
    ]:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path

    return None


def is_ollama_running() -> bool:
    """Check if Ollama API is responding."""
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE_URL}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except (urllib.error.URLError, OSError, TimeoutError):
        return False


def start_ollama(ollama_path: str | None = None) -> tuple[bool, str]:
    """Start Ollama server in the background. Returns (success, message)."""
    binary = ollama_path or find_ollama()
    if not binary:
        return False, "Ollama not found. Install: curl -fsSL https://ollama.com/install.sh | sh"

    if is_ollama_running():
        return True, "Ollama is already running"

    try:
        # Launch in background, suppress output
        subprocess.Popen(
            [binary, "serve"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )

        # Wait for it to be ready
        for _ in range(15):
            time.sleep(1)
            if is_ollama_running():
                return True, "Ollama started successfully"

        return False, "Ollama started but not responding after 15s"
    except Exception as e:
        return False, f"Failed to start Ollama: {e}"


def ensure_ollama() -> tuple[bool, str]:
    """Detect Ollama, auto-start if needed. Returns (ready, status_message)."""
    binary = find_ollama()
    if not binary:
        return False, (
            "Ollama not installed.\n"
            "Install with: curl -fsSL https://ollama.com/install.sh | sh\n"
            "Or: brew install ollama"
        )

    if is_ollama_running():
        return True, "Ollama is running"

    return start_ollama(binary)


def list_local_models() -> list[dict]:
    """Get list of locally downloaded models from Ollama API."""
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE_URL}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            return data.get("models", [])
    except (urllib.error.URLError, OSError, json.JSONDecodeError):
        return []


def get_local_model_names() -> set[str]:
    """Get set of locally available model name:tag strings."""
    models = list_local_models()
    names = set()
    for m in models:
        name = m.get("name", "")
        names.add(name)
        # Also add without :latest suffix
        if name.endswith(":latest"):
            names.add(name.rsplit(":", 1)[0])
    return names


def pull_model(model_name: str) -> tuple[bool, str]:
    """
    Pull a model using `ollama pull`. Streams progress to stdout.
    Returns (success, message).
    """
    binary = find_ollama()
    if not binary:
        return False, "Ollama not found"

    if not is_ollama_running():
        ok, msg = start_ollama(binary)
        if not ok:
            return False, msg

    try:
        result = subprocess.run(
            [binary, "pull", model_name],
            timeout=1800,  # 30 min timeout for large models
        )
        if result.returncode == 0:
            return True, f"Successfully pulled {model_name}"
        return False, f"Failed to pull {model_name} (exit code {result.returncode})"
    except subprocess.TimeoutExpired:
        return False, f"Pull timed out for {model_name}"
    except Exception as e:
        return False, f"Error pulling {model_name}: {e}"


def remove_model(model_name: str) -> tuple[bool, str]:
    """Remove a locally downloaded model."""
    binary = find_ollama()
    if not binary:
        return False, "Ollama not found"

    try:
        result = subprocess.run(
            [binary, "rm", model_name],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            return True, f"Removed {model_name}"
        return False, result.stderr.strip() or f"Failed to remove {model_name}"
    except Exception as e:
        return False, f"Error: {e}"


def get_system_ram_gb() -> float:
    """Get total system RAM in GB."""
    if platform.system() == "Darwin":
        try:
            result = subprocess.run(
                ["sysctl", "-n", "hw.memsize"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                return int(result.stdout.strip()) / (1024 ** 3)
        except Exception:
            pass

    # Fallback: try /proc/meminfo (Linux)
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    kb = int(line.split()[1])
                    return kb / (1024 ** 2)
    except FileNotFoundError:
        pass

    return 0.0


def get_recommended_models(ram_gb: float | None = None) -> list:
    """Return models that fit in available RAM."""
    if ram_gb is None:
        ram_gb = get_system_ram_gb()
    return [m for m in MODEL_CATALOG if m.min_ram_gb <= ram_gb]
