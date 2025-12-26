import requests
import sys
import logging
from pathlib import Path
from typing import Optional

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("CritiqueApp")

def load_css() -> Optional[str]:
    """Loads and combines CSS files."""
    try:
        base_path = Path("admin/web/src")
        index_css = (base_path / "index.css").read_text(encoding="utf-8")
        app_css = (base_path / "App.css").read_text(encoding="utf-8")
        return f"{index_css}\n{app_css}"
    except Exception as e:
        logger.error(f"❌ Failed to read CSS files: {e}")
        return None

def get_dashboard_html() -> str:
    """Returns the mock HTML context."""
    return """
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

def critique_app():
    """Sends the app context to the Visionary agent for critique."""
    logger.info("🎨 CRITIQUING APP DESIGN...")
    logger.info("-" * 50)
    
    full_css = load_css()
    if not full_css:
        return

    url = "http://localhost:8000/agents/run"
    
    payload = {
        "agent_name": "The Visionary",
        "action": "critique",
        "parameters": {
            "css": full_css,
            "html": get_dashboard_html()
        }
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()
        
        logger.info("\n🧐 THE VISIONARY'S CRITIQUE:")
        logger.info(result.get("result", "No result"))
        
    except requests.RequestException as e:
        logger.error(f"❌ Request Failed: {e}")
    except Exception as e:
        logger.error(f"❌ Unexpected Error: {e}")

if __name__ == "__main__":
    critique_app()
