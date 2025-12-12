import sys
import os
import time

# Add root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from admin.brain.collective_intelligence import get_collective_intelligence
from admin.brain.memory_store import get_memory_store

def test_learning_loop():
    print("🧠 Testing Self-Improving Learning Loop...")
    ci = get_collective_intelligence()
    
    # 1. Simulate a Failure
    action = "test_hazardous_action"
    error = "FileNotFoundError: /restricted/config.xml is not accessible"
    agent = "TestBot"
    
    print(f"\n1. Simulating failure in {action}...")
    # We mock the LLM response to avoid depending on the actual Node being up for this unit test,
    # OR we can try to actually hit it if we want integration testing. 
    # Let's try the real thing first, but fallback if needed.
    # Actually, to make this deterministic for the user, I should probably rely on the real thing 
    # ONLY if I know the env is set up. 
    # Let's just run it. If it fails to connect to Node, the code catches it.
    
    # Manually injecting a lesson to verify the Retrieval part first (deterministic)
    print("   (Injecting test lesson directly to DB for deterministic test)")
    ci.learn_lesson(
        agent,
        "Always check file permissions before accessing restricted configs.",
        f"Failure in {action}: {error}",
        "FAILED",
        ["security", "file_io"]
    )
    
    # 2. Verify Retrieval (Proactive Check)
    print("\n2. Verifying 'consult_collective' (Proactive Check)...")
    advice = ci.consult_collective(action, "I am about to read a config file")
    
    found_warning = False
    for item in advice:
        print(f"   Received: {item}")
        if "restricted configs" in item:
            found_warning = True
            
    if found_warning:
        print("✅ SUCCESS: System warned about the previous failure.")
    else:
        print("❌ FAILURE: System did not warn about the failure.")
        
    # 3. Verify Persistence directly
    print("\n3. Verifying persistence in Memory Store...")
    memory = get_memory_store()
    lessons = memory.search_lessons(tags=["security"])
    print(f"   Found {len(lessons)} lessons with tag 'security'.")
    if len(lessons) > 0:
        print("✅ SUCCESS: Lesson persisted in DB.")
    else:
        print("❌ FAILURE: Lesson not found in DB.")

if __name__ == "__main__":
    test_learning_loop()
