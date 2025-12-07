
import os
import subprocess
import shutil

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPS_DIR = os.path.join(BASE_DIR, 'ai-tools/apps')
OUTPUT_DIR = os.path.join(BASE_DIR, 'docs')
APPS_OUTPUT_DIR = os.path.join(OUTPUT_DIR, 'apps')

def build_app(app_name, output_folder_name):
    app_path = os.path.join(APPS_DIR, app_name)
    print(f"Building {app_name}...")
    
    # Install dependencies if needed (assuming pre-installed for now to save time, or run install)
    # subprocess.run(['npm', 'install'], cwd=app_path, check=True)
    
    # Build
    # We use 'npx next build' directly to avoid package.json script issues if they differ
    subprocess.run(['npx', 'next', 'build'], cwd=app_path, check=True)
    
    # Move Output
    # Next.js export output is usually in 'out' folder
    source_out = os.path.join(app_path, 'out')
    dest_out = os.path.join(APPS_OUTPUT_DIR, output_folder_name)
    
    if os.path.exists(dest_out):
        shutil.rmtree(dest_out)
    
    # Ensure parent dir exists
    os.makedirs(os.path.dirname(dest_out), exist_ok=True)
        
    shutil.move(source_out, dest_out)
    print(f"Deployed {app_name} to {dest_out}")

def main():
    print("Starting Apps Build...")
    
    # Ensure docs/apps exists
    os.makedirs(APPS_OUTPUT_DIR, exist_ok=True)
    
    # Build Debugger
    try:
        build_app('debugger', 'debugger')
    except Exception as e:
        print(f"Failed to build debugger: {e}")

    # Build Visualizer (Context Viewer)
    try:
        build_app('context-viewer', 'visualizer')
    except Exception as e:
        print(f"Failed to build context-viewer: {e}")
        
    print("Apps Build Complete.")

if __name__ == "__main__":
    main()
