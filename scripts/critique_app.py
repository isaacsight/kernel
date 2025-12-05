import requests
import sys
import os

def critique_app():
    print("🎨 CRITIQUING APP DESIGN...")
    print("-" * 50)
    
    # Load CSS
    try:
        with open("admin/web/src/index.css", "r") as f:
            index_css = f.read()
        with open("admin/web/src/App.css", "r") as f:
            app_css = f.read()
            
        full_css = index_css + "\n" + app_css
    except Exception as e:
        print(f"❌ Failed to read CSS files: {e}")
        return

    # Mock HTML context for the Dashboard
    html_context = """
    <div class="flex min-h-screen bg-background text-foreground">
        <aside class="w-64 border-r border-border bg-card/30 backdrop-blur-md">
            <h1>Studio OS</h1>
            <nav>
                <a href="/" class="text-accent">Mission Control</a>
                <a href="/content">Content Studio</a>
            </nav>
        </aside>
        <main class="flex-1">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="glass-panel p-6 rounded-xl">
                    <h3>System Status</h3>
                    <span class="text-green-500">Operational</span>
                </div>
            </div>
        </main>
    </div>
    """
    
    url = "http://localhost:8000/agents/run"
    
    payload = {
        "agent_name": "The Visionary",
        "action": "critique",
        "parameters": {
            "css": full_css,
            "html": html_context
        }
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        
        print("\n🧐 THE VISIONARY'S CRITIQUE:")
        print(result.get("result", "No result"))
        
    except Exception as e:
        print(f"❌ FAILED: {e}")

if __name__ == "__main__":
    critique_app()
