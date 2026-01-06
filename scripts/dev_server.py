import os
import time
import subprocess
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading

# Configuration
WATCH_DIRS = ["content", "templates", "static"]
BUILD_COMMAND = [sys.executable, "build.py"]
DOCS_DIR = "docs"
PORT = 8002


class DevHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DOCS_DIR, **kwargs)


def get_file_stats():
    """Returns a dictionary mapping file paths to their last modification times."""
    stats = {}
    for watch_dir in WATCH_DIRS:
        if not os.path.exists(watch_dir):
            continue
        for root, _, files in os.walk(watch_dir):
            for file in files:
                filepath = os.path.join(root, file)
                try:
                    stats[filepath] = os.path.getmtime(filepath)
                except OSError:
                    pass
    return stats


def run_build():
    """Runs the build.py script."""
    print("\n[DEV] 🛠️  Change detected. Rebuilding...")
    try:
        result = subprocess.run(BUILD_COMMAND, capture_output=True, text=True)
        if result.returncode == 0:
            print("[DEV] ✅ Build successful.")
        else:
            print(f"[DEV] ❌ Build failed:\n{result.stderr}")
    except Exception as e:
        print(f"[DEV] ❌ Error running build: {e}")


def watch_loop():
    """Periodically checks for file changes and triggers build."""
    last_stats = get_file_stats()
    print(f"[DEV] 👀 Watching for changes in: {', '.join(WATCH_DIRS)}")

    while True:
        time.sleep(1)
        current_stats = get_file_stats()

        # Check for additions or modifications
        changed = False
        for path, mtime in current_stats.items():
            if path not in last_stats or mtime > last_stats[path]:
                changed = True
                break

        # Check for deletions
        if not changed:
            for path in last_stats:
                if path not in current_stats:
                    changed = True
                    break

        if changed:
            run_build()
            last_stats = current_stats


def serve():
    """Starts the HTTP server."""
    os.makedirs(DOCS_DIR, exist_ok=True)
    server = HTTPServer(("", PORT), DevHandler)
    print(f"[DEV] 🚀 Preview site running at http://localhost:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    # Initial build
    run_build()

    # Start server in a separate thread
    server_thread = threading.Thread(target=serve, daemon=True)
    server_thread.start()

    # Start watch loop in main thread
    try:
        watch_loop()
    except KeyboardInterrupt:
        print("\n[DEV] 👋 Shutting down dev server.")
        sys.exit(0)
