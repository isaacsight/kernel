import time
import logging
import threading
import schedule
import sys
import os
from datetime import datetime

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from admin.engineers.researcher import Researcher
    from scripts.research_flywheel import ResearchFlywheel
    from admin.engineers.viral_coach import ViralCoach, get_viral_coach
    from admin.engineers.editor import Editor
    from admin.engineers.council import Council
    from admin.brain.memory_store import get_memory_store
except Exception as e:
    print(f"CRITICAL IMPORT ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [StudioOS] - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("StudioOS")

class StudioKernel:
    """
    The Operating System for the Studio Agents.
    Orchestrates continuous research, analysis, and content generation.
    """
    def __init__(self):
        self.running = False
        self.flywheel = ResearchFlywheel()
        self.council = Council()
        self.coach = get_viral_coach()
        self.editor = Editor()
        self.memory = get_memory_store()
        
    def start(self):
        """Starts the main event loop."""
        self.running = True
        logger.info("🚀 Studio OS Kernel Initialized")
        logger.info("✅ Agents Online: Council, Researcher, Trends, ViralCoach, Editor")
        
        # Schedule Tasks
        # 1. Council Deliberation (Deep Research) - Run every 20 minutes (slower)
        schedule.every(20).minutes.do(self.run_research_cycle)
        
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
        """Triggers the Council for Deep Reasoning."""
        logger.info("🔄 STATUS: Starting Council Deliberation...")
        try:
            # Pick a topic via TrendScout (reusing flywheel logic for now, or direct)
            # For this upgrade, let's pick a random high-level topic or pull from scout
            # To iterate fast, we will ask the Council to study a trend found by the Scout
            
            # Simple Hack: Use flywheel to get a trend, then Pass to Council
            trend = self.flywheel.trend_scout.get_current_trends(niche="auto")[0]
            logger.info(f"   🏛️ Council debating: {trend}")
            
            outcome = self.council.deliberate(trend)
            
            # Save Deep Insight
            self.memory.save_insight(
                insight_type="deep_reasoning",
                source="council_of_minds",
                data=outcome,
                confidence=0.99
            )
            logger.info("✅ STATUS: Council Adjourned. Insight Saved.")
        except Exception as e:
            logger.error(f"❌ Council Session Failed: {e}")
            
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
        logger.info("📊 Dashboard launching on http://localhost:8000 (if active) or static.")
        # We can launch a separate thread here for the dashboard API
        dashboard_thread = threading.Thread(target=self._run_dashboard_server, daemon=True)
        dashboard_thread.start()
        
    def _run_dashboard_server(self):
        """Runs a simple HTTP server for the dashboard."""
        import http.server
        import socketserver
        import json
        
        PORT = 8999
        DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dashboard")
        
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
        with socketserver.TCPServer(("", PORT), DashboardHandler) as httpd:
            try:
                httpd.serve_forever()
            except Exception as e:
                logger.error(f"Dashboard server error: {e}")
