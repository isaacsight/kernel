import sys
import os

# Add root directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.remote_worker import get_remote_worker

def test_nodes():
    # Active nodes from Tailscale status
    nodes = [
        {"ip": "100.91.174.71", "name": "gx10-a7c8", "user": "angelvasquez0208"},
        {"ip": "100.98.193.42", "name": "gx10-dab5", "user": "angelvasquez0208"}
    ]

    print("--- 📡 Testing Distributed Nodes Connectivity ---")
    
    results = []

    for node in nodes:
        print(f"\nTesting {node['name']} ({node['ip']})...")
        
        # Try with the user reported by tailscale (angelvasquez0208)
        # We assume SSH might be configured for this user or via Tailscale SSH
        worker = get_remote_worker(host=node['ip'], user=node['user'])
        
        is_alive = worker.check_health()
        
        if is_alive:
            print(f"✅ {node['name']} is ONLINE and ACCESSIBLE.")
            
            # Try a simple command
            info = worker.run_command("uname -a && uptime")
            if info['success']:
                print(f"   System Info: {info['stdout']}")
                results.append({"name": node['name'], "status": "Active", "details": info['stdout']})
            else:
                print(f"   ⚠️ Connected but command failed: {info['error']}")
                results.append({"name": node['name'], "status": "Partial", "details": "Command failed"})
        else:
            print(f"❌ {node['name']} is UNREACHABLE (SSH failed).")
            # Fallback check: maybe the user is 'root' or 'isaachernandez' if keys are shared?
            # But let's stick to the reported user first.
            results.append({"name": node['name'], "status": "Unreachable", "details": "SSH check failed"})

    print("\n--- Summary ---")
    for r in results:
        print(f"{r['name']}: {r['status']}")

if __name__ == "__main__":
    test_nodes()
