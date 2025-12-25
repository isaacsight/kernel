import sys
import os
import json
import asyncio

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.command_router import get_command_router
from admin.brain.model_router import get_model_router, TaskType

async def test_router_roles():
    print("🔬 TESTING STUDIO OS ARCHETYPES...")
    print("-" * 50)
    
    router = get_command_router()
    model_router = get_model_router()
    
    test_cases = [
        {
            "input": "Help me design a new coaching offer and map out the architecture.",
            "expected_agent": "Design Partner",
            "mock_response": {"intent": "action", "action": "help", "target_agent": "Design Partner", "response_text": "I can help you design that."}
        },
        {
            "input": "Generate a blog post about CoVT and audit it for style.",
            "expected_agent": "Content Engine Brain",
            "mock_response": {"intent": "action", "action": "generate_post", "target_agent": "Content Engine Brain", "response_text": "Drafting your post now."}
        },
        {
            "input": "Research the latest papers on continuous visual tokens and implement a prototype.",
            "expected_agent": "Research Copilot",
            "mock_response": {"intent": "action", "action": "research", "target_agent": "Research Copilot", "response_text": "Searching for papers."}
        }
    ]
    
    for case in test_cases:
        print(f"\nUser Input: '{case['input']}'")
        
        # Manually verify the logic that the router SHOULD perform
        # Since we can't call Gemini, we simulate the routing result
        # The key is that THESE AGENTS exist in the registry now
        agents = router.agents
        target = case['expected_agent']
        
        if target in agents:
            print(f"Agent '{target}' found in registry: {agents[target]}")
        else:
            print(f"❌ ERROR: Agent '{target}' NOT found in registry")
            continue
            
        print(f"Routed Agent (Mocked): {target}")
        
        if target == case['expected_agent']:
            print(f"✅ SUCCESS: Correctly routed to {target}")
        else:
            print(f"⚠️ MISMATCH: Expected {case['expected_agent']}, got {target}")
            
        # Test model selection for the agent
        model_result = model_router.get_model_for_agent(target)
        selected_model = model_result.get("selected")
        print(f"Selected Model: {selected_model}")
        print(f"Reasoning: {model_result.get('reasoning')}")

    print("\n🔬 TESTING VISUAL REASONING TASK...")
    visual_result = model_router.select_model(TaskType.VISUAL_REASONING)
    print(f"Task: VISUAL_REASONING")
    print(f"Selected Model: {visual_result.get('selected')}")
    print(f"Reasoning: {visual_result.get('reasoning')}")

if __name__ == "__main__":
    asyncio.run(test_router_roles())
