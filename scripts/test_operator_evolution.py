import sys
import os
import logging

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.operator import Operator

# Configure logging to see what's happening
logging.basicConfig(level=logging.INFO)

def test_evolution():
    print("⚙️ TESTING THE OPERATOR (EVOLUTION LOOP)...")
    print("-" * 50)
    
    operator = Operator()
    
    # We want to test the loop, but maybe not actually CHANGE files during the test?
    # The Guardian should catch unsafe changes, or we can mock the implementation step.
    # For now, let's run it and see if it gets to the Blueprint stage.
    
    print("Triggering Evolution Cycle...")
    try:
        report = operator.evolve()
        print("\n📄 EVOLUTION REPORT:")
        print(report)
        
        if "Evolution Cycle Complete" in report or "Blueprint Created" in report:
            print("\n✅ SUCCESS: Operator coordinated the team.")
        else:
            print("\n⚠️ NOTE: Cycle finished, check report for details.")
            
    except Exception as e:
        print(f"\n❌ FAILED: {e}")

if __name__ == "__main__":
    test_evolution()
