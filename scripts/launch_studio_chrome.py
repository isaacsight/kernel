#!/usr/bin/env python3
"""
Launches Google Chrome with:
1. The "Does This Feel Right?" extension loaded.
2. Remote debugging enabled (port 9222) for Antigravity control.
3. Optimization flags.
"""
import os
import subprocess
import sys

def launch_chrome():
    # Paths
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    extension_path = os.path.join(project_root, "tools", "browser_extension")
    
    # OS-specific Chrome Path (Mac)
    chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    
    if not os.path.exists(chrome_path):
        print(f"Error: Chrome not found at {chrome_path}")
        sys.exit(1)
        
    user_data_dir = os.path.join(project_root, ".chrome_dev_profile")
    os.makedirs(user_data_dir, exist_ok=True)
    
    args = [
        chrome_path,
        f"--load-extension={extension_path}",
        f"--remote-debugging-port=9222",
        f"--user-data-dir={user_data_dir}", # Separate profile to avoid conflicts
        "--no-first-run",
        "--no-default-browser-check",
        "about:blank"
    ]
    
    print(f"🚀 Launching Studio Chrome...")
    print(f"   Extension: {extension_path}")
    print(f"   Debugging: Port 9222")
    
    subprocess.Popen(args)
    print("✅ Chrome launched in background.")

if __name__ == "__main__":
    launch_chrome()
