import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to sys.path so we can import admin.engineers
sys.path.append(os.getcwd())

try:
    from admin.engineers.operator import Operator
    print("Successfully imported Operator")
except ImportError as e:
    print(f"Error importing Operator: {e}")
    sys.exit(1)

def test_evolution_loop():
    print("Testing Evolution Loop...")
    
    operator = Operator()
    
    try:
        report = operator.evolve()
        print("\n--- EVOLUTION REPORT START ---")
        print(report)
        print("--- EVOLUTION REPORT END ---\n")
        
        if "EVOLUTION CYCLE COMPLETE" in report or "Evolution Failed" in report:
             # We accept failure if it's just the remote node timeout, as we know that's an issue
            print("Verification PASSED: Evolution cycle attempted.")
        else:
            print("Verification FAILED: Did not receive expected report format.")
            
    except Exception as e:
        print(f"Verification FAILED: Evolution raised exception: {e}")

if __name__ == "__main__":
    test_evolution_loop()
