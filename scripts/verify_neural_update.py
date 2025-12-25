import os
import sys
import json
import logging

# Add the project root to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.brain.collective_intelligence import get_collective_intelligence
from admin.brain.agent_presence import get_agent_presence, AgentStatus

logging.basicConfig(level=logging.INFO)

def test_learning_loop():
    print("🚀 Initializing Collective Intelligence test...")
    collective = get_collective_intelligence()
    presence = get_agent_presence()
    
    # Simulate a failure
    agent_name = "Researcher"
    action = "fetch_trending_topics"
    error = "429 Client Error: Too Many Requests for url: https://api.twitter.com/2/tweets/search/recent"
    context = {"query": "AI Agents", "tier": "free"}
    
    print(f"📡 Simulating failure for {agent_name}...")
    presence.update_presence(agent_name, AgentStatus.ERROR, current_task=f"Failed: {action}")
    
    print("🧠 Triggering Gemini-based learning loop...")
    lesson = collective.learn_from_failure(agent_name, action, error, context)
    
    if lesson:
        print("\n✅ Learning Loop SUCCESS!")
        print(f"Root Cause: {lesson.get('root_cause')}")
        print(f"Lesson Learned: {lesson.get('lesson')}")
        print(f"Suggested Fix: {lesson.get('fix')}")
    else:
        print("\n❌ Learning Loop FAILED (Check logs for Gemini errors)")

    # Simulate an action critique
    print("\n🔍 Simulating action critique...")
    critique = collective.critique_action(
        "generate_title", 
        {"topic": "Quantum Computing"}, 
        "The Future of Qubits", 
        1.2
    )
    
    if critique:
        print("✅ Critique SUCCESS!")
        print(f"Rating: {critique.get('rating')}/10")
        print(f"Analysis: {critique.get('analysis')}")
    else:
        print("❌ Critique FAILED")

if __name__ == "__main__":
    test_learning_loop()
