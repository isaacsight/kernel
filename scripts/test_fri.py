import sys
import os
import json
from datetime import datetime, timedelta

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from admin.brain.memory_store import get_memory_store
from admin.brain.felt_right_index import fri_engine

def seed_mock_data():
    """Seed the memory store with mock decisions for testing."""
    memory = get_memory_store()
    
    # Clean old mock data if needed (optional, just for testing)
    # logger.info("Seeding mock data for FRI test...")
    
    # 1. High Alignment (Mostly 'yes')
    # 2. Moderate Cadence
    # 3. Positive Sentiment
    
    topics = [
        "Deploy v1.0", "New Agent: Alchemist", "Update styles", 
        "Fix bug #123", "Strategic pivot", "Ritual: Monday Sync"
    ]
    
    for i, topic in enumerate(topics):
        # Decisions spread over the last 3 days
        ts = (datetime.now() - timedelta(hours=i*4)).isoformat()
        decision = "yes" if i != 2 else "no" # One 'no' for variety
        sentiment = "felt_right" if i % 2 == 0 else None
        
        memory.save_decision(
            topic=topic,
            decision=decision,
            context="Testing FRI engine",
            agent_id="test_runner",
            metadata={"sentiment": sentiment}
        )

def run_test():
    print("--- FELT RIGHT INDEX TEST ---")
    
    # First, calculate with existing data
    result_before = fri_engine.calculate_fri(days=7)
    print(f"Current FRI: {result_before['score']} ({result_before['label']})")
    print(f"Sample Size: {result_before['sample_size']}")
    
    # Seed mock data
    print("\nSeeding mock data...")
    seed_mock_data()
    
    # Calculate again
    result_after = fri_engine.calculate_fri(days=7)
    print(f"Updated FRI: {result_after['score']} ({result_after['label']})")
    print(f"Alignment: {result_after['alignment']}%")
    print(f"Cadence Score: {result_after['cadence']}%")
    print(f"Sentiment Score: {result_after['sentiment']}%")
    print(f"Sample Size: {result_after['sample_size']}")
    
    print("\nTest Complete.")

if __name__ == "__main__":
    run_test()
