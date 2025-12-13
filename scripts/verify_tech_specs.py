import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.web_scout import get_web_scout

def verify_specs():
    print("=== Technician's Verification Tool ===")
    print("Verifying technical claims via Web Scout...")
    
    scout = get_web_scout()
    
    # Specific technical claims to verify
    specs = [
        "ByteMesh service mesh",
        "KiteX Golang RPC",
        "TikTok ByteDance Edge Nodes BEN",
        "TikTok Monolith vs Microservices architecture",
        "TikTok Multi-Modal Learning"
    ]
    
    for spec in specs:
        print(f"\n🔎 Checking: {spec}...")
        results = scout.search(spec, num_results=2)
        
        if results:
            top = results[0]
            print(f"   ✅ Found: {top.get('title')}")
            print(f"   🔗 Source: {top.get('url')}")
            print(f"   📝 Snippet: {top.get('snippet')[:150]}...")
        else:
            print("   ❌ No direct results found.")
            
    print("\n=== Verification Complete ===")

if __name__ == "__main__":
    verify_specs()
