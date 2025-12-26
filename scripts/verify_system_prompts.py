
import sys
import inspect
import os

# Adjust path to find admin module
sys.path.append(os.path.join(os.getcwd()))

try:
    from admin.brain.system_prompts import SystemPrompts
except ImportError:
    print("Could not import SystemPrompts. Checking path...")
    print(sys.path)
    # Mocking for test if import fails, but aiming for real import
    class SystemPrompts:
        pass

def verify_and_run_prompts():
    print("=" * 60)
    print("SOVEREIGN PROMPT LIBRARY VERIFICATION")
    print("=" * 60)

    # Inspect class methods
    methods = [
        method_name for method_name, _ in inspect.getmembers(SystemPrompts, predicate=inspect.isfunction)
        if method_name.startswith("get_") and method_name.endswith("_prompt")
    ]

    total_count = len(methods)
    
    print(f"\n[INFO] Total Prompts Detected: {total_count}")
    
    if total_count >= 100:
        print("[SUCCESS] Target of 100 prompts reached/exceeded!")
    else:
        print(f"[WARNING] Target not reached. Found {total_count}/100.")

    print("\n[INFO] Running Prompt Execution Test...")
    
    passed = 0
    failed = 0
    
    for i, method_name in enumerate(methods):
        try:
            method = getattr(SystemPrompts, method_name)
            # Call method (static methods in this class don't need args)
            result = method()
            
            # Simple check: is it a string and not empty?
            if isinstance(result, str) and len(result) > 10:
                # Print first line as sample
                first_line = result.split('\n')[0]
                print(f"[{i+1:03d}] {method_name:<40} -> OK | {first_line[:40]}...")
                passed += 1
            else:
                print(f"[{i+1:03d}] {method_name:<40} -> FAIL (Empty/Invalid)")
                failed += 1
        except Exception as e:
            print(f"[{i+1:03d}] {method_name:<40} -> ERROR: {e}")
            failed += 1

    print("-" * 60)
    print(f"VERIFICATION SUMMARY: {passed} PASSED, {failed} FAILED")
    print("-" * 60)

if __name__ == "__main__":
    verify_and_run_prompts()
