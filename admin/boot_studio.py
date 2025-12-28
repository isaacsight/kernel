import subprocess
import time
import sys
import threading
from datetime import datetime

# Configuration
SERVICES = [
    {
        "name": "🔌 Context Bridge (MCP)",
        "cmd": ["python3", "admin/brain/mcp_bridge/studio_context_server.py"],
        "type": "daemon"
    },
    {
        "name": "⚡ DSPy Migrator (Imperfect Loop)",
        "cmd": ["python3", "admin/engineers/migrator/auto_migrate.py"],
        "type": "job" # Runs once then waits
    },
    {
        "name": "👾 Synthetic UX (Data Feed)",
        "cmd": ["python3", "-c", "import sys; sys.path.append('.'); from admin.engineers.data.synthetic_feed import generate_feed; import time; [ (print(generate_feed(1)), time.sleep(2)) for _ in range(100) ]"],
        "type": "daemon"
    }
]

def log(service, msg):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {service:<20} | {msg}")

def monitor_service(service_config):
    name = service_config["name"]
    cmd = service_config["cmd"]
    
    log("SYSTEM", f"Starting {name}...")
    
    try:
        # Start Process
        proc = subprocess.Popen(
            cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        
        # Read Output
        while True:
            line = proc.stdout.readline()
            if not line and proc.poll() is not None:
                break
            if line:
                log(name.split('(')[0].strip(), line.strip()[:60] + "...")
                
        log("SYSTEM", f"{name} exited with code {proc.returncode}")
        
    except Exception as e:
        log("ERROR", f"Failed to start {name}: {e}")

def main():
    print("\n" + "="*50)
    print("   STUDIO OS // BOOTLOADER v1.0")
    print("   Initializing Sovereign Runtime...")
    print("="*50 + "\n")
    
    threads = []
    
    # Check Hardware (Pod)
    try:
        import requests
        res = requests.get("http://localhost:11434")
        if res.status_code == 200:
            log("🔒 Privacy Pod", "✅ OLLAMA DETECTED (Serving Model)")
        else:
            log("🔒 Privacy Pod", "⚠️  Ollama running but returned error")
    except:
        log("🔒 Privacy Pod", "❌ OLLAMA NOT FOUND (Start 'ollama serve')")

    # Start Services
    for service in SERVICES:
        t = threading.Thread(target=monitor_service, args=(service,))
        t.daemon = True
        t.start()
        threads.append(t)
        time.sleep(1) # Stagger start

    print("\n✅ SYSTEM ONLINE. Press Ctrl+C to shutdown.\n")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n🛑 SHUTTING DOWN STUDIO OS...")

if __name__ == "__main__":
    main()
