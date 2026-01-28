import time
import logging
import threading
import schedule
import sys
import os
import traceback
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [StudioOS] - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("StudioOS")

try:
    from admin.engineers.researcher import Researcher
    from scripts.research_flywheel import ResearchFlywheel
    from admin.engineers.viral_coach import ViralCoach, get_viral_coach
    from admin.engineers.editor import Editor
    from admin.brain.memory_store import get_memory_store
except Exception as e:
    logger.error(f"CRITICAL IMPORT ERROR: {e}")
    traceback.print_exc()
    sys.exit(1)

class StudioKernel:
    """
    The Operating System for the Studio Agents.
    Orchestrates continuous research, analysis, and content generation.
    """
    def __init__(self):
        self.running = False
        try:
            self.flywheel = ResearchFlywheel()
            self.coach = get_viral_coach()
            self.editor = Editor()
            self.memory = get_memory_store()
        except Exception as e:
            logger.error(f"Failed to initialize agents: {e}")
            traceback.print_exc()
            raise
        
    def start(self):
        """Starts the main event loop."""
        self.running = True
        logger.info("🚀 Studio OS Kernel Initialized")
        logger.info("✅ Agents Online: Researcher, Trends, ViralCoach, Editor")
        
        # Schedule Tasks
        # 1. Research Cycle - Run every 10 minutes (demo speed) or hour (prod)
        schedule.every(10).minutes.do(self.run_research_cycle)
        
        # 2. Daily Briefing - Check trends every 2 hours
        schedule.every(2).hours.do(self.run_trend_scan)
        
        # 3. Content Drafting - Check for new insights to draft content for every 15 mins
        schedule.every(15).minutes.do(self.run_auto_drafter)
        
        # Immediate kickoff
        logger.info("⚡ Running startup checks...")
        # self.run_research_cycle() # Optional: Run immediately on start
        
        # Start Dashboard Server (in background thread)
        self.start_dashboard()
        
        logger.info("⏳ Waiting for scheduled tasks...")
        
        try:
            while self.running:
                schedule.run_pending()
                time.sleep(1)
        except KeyboardInterrupt:
            self.stop()
            
    def stop(self):
        self.running = False
        logger.info("🛑 Studio OS Shutdown")
        
    def run_research_cycle(self):
        """Triggers the Research Flywheel."""
        logger.info("🔄 STATUS: Starting Autonomous Research Cycle...")
        try:
            self.flywheel.run_cycle()
            logger.info("✅ STATUS: Research Cycle Complete")
        except Exception as e:
            logger.error(f"❌ Research Cycle Failed: {e}")
            
    def run_trend_scan(self):
        """Checks for new trends."""
        logger.info("🔄 STATUS: Scanning Universal Trends...")
        # (Placeholder for specific trend scout polling if not covered by flywheel)
        pass
        
    def run_auto_drafter(self):
        """Checks for fresh insights and drafts content."""
        logger.info("🔄 STATUS: Checking for Draftable Insights...")
        try:
            # Delegate to Editor Agent
            self.editor.run_check()
        except Exception as e:
            logger.error(f"❌ Auto-Drafter Failed: {e}")
        
    def start_dashboard(self):
        """Starts the visual dashboard (FastAPI/SimpleHTTP)."""
        logger.info("📊 Dashboard launching on http://localhost:8999 (if active) or static.")
        # We can launch a separate thread here for the dashboard API
        dashboard_thread = threading.Thread(target=self._run_dashboard_server, daemon=True)
        dashboard_thread.start()
        
    def _run_dashboard_server(self):
        """Runs a simple HTTP server for the dashboard."""
        import http.server
        import socketserver
        import json
        
        PORT = 8999
        # Correct path to dashboard relative to root
        DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "admin", "dashboard")
        
        class DashboardHandler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=DIRECTORY, **kwargs)
                
            def do_GET(self):
                if self.path == '/api/memory':
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    
                    # Fetch Memory Snapshot
                    # For demo, we get insights and map them to nodes
                    mem_store = get_memory_store()
                    insights = mem_store.get_insights(min_confidence=0.5)
                    
                    nodes = []
                    for i, insight in enumerate(insights):
                        data = insight.get('data', {})
                        label = data.get('topic', 'Unknown')
                        nodes.append({"id": i, "label": label, "type": "concept"})
                    
                    response = {"nodes": nodes, "timestamp": datetime.now().isoformat()}
                    self.wfile.write(json.dumps(response).encode())
                else:
                    super().do_GET()
                    
            def log_message(self, format, *args):
                pass # Silence console logs

        logger.info(f"📊 Dashboard Live at http://localhost:{PORT}")
        try:
            with socketserver.TCPServer(("", PORT), DashboardHandler) as httpd:
                try:
                    httpd.serve_forever()
                except Exception as e:
                    logger.error(f"Dashboard server error: {e}")
        except OSError as e:
             logger.error(f"Could not bind port {PORT}: {e}")

if __name__ == "__main__":
    print("DEBUG: entering main block")
    try:
        kernel = StudioKernel()
        print("DEBUG: kernel created")
        kernel.start()
    except Exception as e:
        print(f"DEBUG: Exception in main: {e}")
        traceback.print_exc()
