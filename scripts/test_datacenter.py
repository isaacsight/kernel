import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.network_engineer import NetworkEngineer

def test_datacenter_interaction():
    print("Initializing Network Engineer...")
    engineer = NetworkEngineer()
    
    print("\n--- Engineer Managing Infrastructure ---")
    report = engineer.manage_infrastructure()
    print(report)
    
    print("\n--- Legacy Check ---")
    legacy_status = engineer.check_node_status()
    print(f"Legacy Status: {legacy_status}")

if __name__ == "__main__":
    test_datacenter_interaction()
