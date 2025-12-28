import sys
import os

# Ensure project root is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from admin.engineers.research_engineer import ResearchEngineer

def verify_skills():
    print("Verifying Research Engineer Skills...")
    engineer = ResearchEngineer()
    
    # Test 1: Draft RFC
    print("\n--- Testing RFC Drafting ---")
    rfc_result = engineer.draft_rfc("Test Protocol Alpha", "A protocol for testing agents.")
    print(rfc_result)
    
    if "RFC created" in rfc_result:
        print("PASS: RFC created.")
    else:
        print("FAIL: RFC creation failed.")
        
    # Test 2: Prototype Feature
    print("\n--- Testing Prototyping ---")
    proto_result = engineer.prototype_feature("A python script that prints 'Hello from the Future'", "hello_future.py")
    print(proto_result)
    
    if "Prototype created" in proto_result:
        print("PASS: Prototype created.")
    else:
        print("FAIL: Prototype creation failed.")

if __name__ == "__main__":
    verify_skills()
