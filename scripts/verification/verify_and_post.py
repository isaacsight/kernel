import sys
import os
import time
from datetime import date

# Add current directory to path so we can import admin.core
sys.path.append(os.getcwd())
import admin.core as core

def test_server_manager():
    print("Testing ServerManager...")
    manager = core.ServerManager(port=8081) # Use different port to avoid conflict
    
    # Test Start
    print(f"Starting server on 8081: {manager.start_server()}")
    time.sleep(1)
    
    # Test Status
    status = manager.get_status()
    print(f"Status: {status}")
    if status != "Running":
        print("FAIL: Server did not start")
        return False

    # Test Stop
    print(f"Stopping server: {manager.stop_server()}")
    time.sleep(1)
    
    # Verify Stopped
    status = manager.get_status()
    print(f"Status: {status}")
    if status != "Stopped":
        print("FAIL: Server did not stop")
        return False
        
    print("PASS: ServerManager logic verified.")
    return True

def create_blog_post():
    print("Creating blog post...")
    title = "Building a Custom Site Manager"
    today = date.today()
    category = "Engineering"
    tags = ["python", "textual", "automation", "tools"]
    
    content = """
Managing a static site often involves juggling multiple terminal windows: one for the preview server, one for the editor, and another for git commands. It gets messy fast.

Today, I built a custom **Site Manager Assistant** to solve this.

## The Problem
I constantly had orphan `python -m http.server` processes running in the background. I'd forget to kill them, leading to "Address already in use" errors and general system clutter.

## The Solution
I upgraded my existing Python TUI (built with [Textual](https://textual.textualize.io/)) to handle the entire lifecycle.

### Key Features
1.  **Integrated Server Control**: I can start and stop the local preview server directly from the dashboard. No more separate terminal tabs.
2.  **Live Logs**: Server logs are piped directly into the TUI, so I can catch 404s or 500s instantly.
3.  **Automated Cleanup**: A wrapper script (`manage_site.sh`) ensures that whenever I close the app, all background processes are killed.

## How it Works
The backend uses Python's `subprocess` module to manage the server process. It captures the PID and uses `os.killpg` to ensure the entire process group is terminated when requested.

```python
def stop_server(self):
    os.killpg(os.getpgid(self.process.pid), 15)
```

Now, I have a single "Command Center" for my entire blog workflow.
"""
    
    filename = core.save_post(None, title, today, category, tags, content)
    print(f"PASS: Blog post created at {filename}")

if __name__ == "__main__":
    if test_server_manager():
        create_blog_post()
