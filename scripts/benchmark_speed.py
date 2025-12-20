"""
🧪 BENCHMARK: Speed & Resilience
===============================
1. Matches the user's request for "fastest response time".
2. Verifies the new 'gemini-1.5-flash' model speed.
3. Verifies the Alchemy Fallback by simulating a crash.
"""

import time
import asyncio
import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.command_router import get_command_router

async def run_benchmark():
    router = get_command_router()
    
    print("🏎️  WARMING UP ENGINE (gemini-1.5-flash)...")
    
    # Test 1: Speed Run
    start = time.time()
    result = await router.execute(router.route("Hello, how fast are you?"))
    end = time.time()
    
    latency = (end - start) * 1000
    print(f"\n⚡ RESPONSE TIME: {latency:.2f}ms")
    print(f"   Reply: {result.get('message', 'No response')}")
    
    # Test 2: Error Simulation (Mocking the route method to fail)
    print("\n🧪 TESTING ALCHEMY FALLBACK (Simulating Crash)...")
    
    original_route = router.route
    def broken_route(input):
        raise Exception("SIMULATED_NEURAL_COLLAPSE")
        
    router.route = broken_route
    
    try:
        # This calls route_and_log logic manually or we mock the internal call
        # But here we just want to see if our TRY/EXCEPT block in router.route works.
        # Wait, I patched router.route logic itself, so I need to call the method that CONTAINS the try/except.
        # The try/except is INSIDE router.route. So I can't mock router.route to fail, I need to mock the MODEL.
        
        router.route = original_route # Restore
        router.model.generate_content = lambda *args, **kwargs: (_ for _ in ()).throw(Exception("SIMULATED_RATE_LIMIT_429"))
        
        start_crash = time.time()
        # This should trigger the fallback
        fallback_result = router.route("Help me!") 
        end_crash = time.time()
        
        print(f"🛡️  FALLBACK TIME: {(end_crash - start_crash) * 1000:.2f}ms")
        print(f"   Agent: {fallback_result.get('target_agent')}")
        print(f"   Reply: {fallback_result.get('response_text')}")
        
    except Exception as e:
        print(f"❌ TEST FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(run_benchmark())
