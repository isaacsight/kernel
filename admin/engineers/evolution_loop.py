import time
import logging
import random
import json
import os
from admin.engineers.strategist import get_strategist
from admin.engineers.trend_scout import TrendScout
from admin.engineers.content_repurposer import get_content_repurposer
from admin.engineers.tiktok_workflow import get_tiktok_workflow
from admin.engineers.publisher import get_publisher


# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

STATE_FILE = os.path.join(os.path.dirname(__file__), "../brain/evolution_state.json")

def save_state(state):
    """Saves the current evolution state to a JSON file."""
    try:
        with open(STATE_FILE, "w") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        logging.error(f"Failed to save state: {e}")

def run_evolution_loop():
    print("Starting Evolution Loop...")
    
    # Initialize Engineers FIRST
    trend_scout = TrendScout()
    repurposer = get_content_repurposer()
    publisher = get_publisher()
    tiktok_workflow = get_tiktok_workflow(template="educational")

    engineers = {
        "Trend Scout": trend_scout,
        "Publisher": publisher,
        "TikTok Workflow": tiktok_workflow
    }

    # Initialize the Strategist with Engineers
    strategist = get_strategist(engineers=engineers)
    
    # Example state data (Mocking the genetic data for now)
    current_state = {
        "cycle": 1,
        "status": "active",
        "last_log": "System initialized.",
        "data": ["gene_1", "gene_2"],
        "metrics": {
            "fitness": 0.8,
            "complexity": 0.5
        }
    }
    
    save_state(current_state)

    try:
        while True:
            print(f"\n--- Cycle {current_state['cycle']} ---")
            
            # --- CONSULT STRATEGIST ---
            current_state["status"] = "thinking"
            current_state["last_log"] = "Consulting Strategist..."
            save_state(current_state)
            
            # We send the current state to the Strategist to decide the next step or mutation
            response = strategist.process_evolution(current_state)
            
            # (Test mock removed)
            
            # Handle the response
            if "error" not in response:
                print(f"Strategist Instruction: {response}")
                
                # Execute the instruction
                if response.get("next_action") == "mutate":
                    current_state["status"] = "working"
                    current_state["last_log"] = "Received 'Mutation'. Engaging Engineers..."
                    save_state(current_state)
                    
                    print(">> EXECUTION: Received 'Mutation' Command. Engaging Engineers...")
                    
                    # 1. Scout for Trends
                    print("   [1/3] Scouting for Trends...")
                    trends = trend_scout.get_current_trends("tech")
                    if trends:
                        selected_trend = random.choice(trends)
                        print(f"   ✓ Selected Trend: {selected_trend['topic']} ({selected_trend['context']})")
                        current_state["last_log"] = f"Scouted Trend: {selected_trend['topic']}"
                        save_state(current_state)
                        
                        # 2. Generate Concept (Mocking a creative director process)
                        concept = {
                            "title": f"Why {selected_trend['topic']} Matters",
                            "content": f"We are seeing a huge shift in {selected_trend['topic']}. {selected_trend['context']}. It's time to pay attention because...",
                            "tags": ["tech", "trends", "future"]
                        }
                        
                        # 3. Generate Video (Real Production)
                        print(f"   [2/3] Producing Video for '{concept['title']}'...")
                        current_state["last_log"] = f"Producing Video: {concept['title']}..."
                        save_state(current_state)

                        # Use the full workflow
                        workflow = get_tiktok_workflow(template="educational") 
                        video_result = workflow.execute(concept)
                        
                        if video_result.get("success"):
                            video_path = video_result.get('video_path')
                            print("   [3/3] Video Produced Successfully!")
                            print(f"   path: {video_path}")
                            
                            current_state["last_log"] = f"Video Ready. Publishing..."
                            save_state(current_state)
                            
                            # 4. Publish (Distribution)
                            print(f"   [4/4] Publishing to Platforms...")
                            pub_result = publisher.publish(video_path)
                            
                            if pub_result.get("success"):
                                print(f"   ✓ Published and Archived!")
                                current_state["last_log"] = f"Published: {concept['title']}"
                            else:
                                print(f"   ⚠ Publishing Issues: {pub_result.get('results')}")
                                current_state["last_log"] = "Publishing Partial Fail."
                                
                            save_state(current_state)
                        else:
                            print(f"   [3/3] Video Generation Failed: {video_result.get('error')}")
                            current_state["last_log"] = "Video Generation Failed."
                            save_state(current_state)
                        
                    else:
                        print("   ⚠ Mos trends found.")
                    
                # Update state for next cycle
                current_state["cycle"] += 1
                current_state["status"] = "idle"
                # Simulate changing metrics
                current_state["metrics"]["fitness"] = round(random.uniform(0.1, 0.9), 2)
                current_state["metrics"]["complexity"] = round(random.uniform(0.1, 0.9), 2)
                
                current_state["last_log"] = f"Cycle complete. New Fitness: {current_state['metrics']['fitness']}"
                save_state(current_state)
                
            else:
                print(f"Skipping cycle due to operator error: {response.get('message')}")
                current_state["last_log"] = f"Error: {response.get('message')}"
                save_state(current_state)


            # Wait before next cycle based on complexity
            time.sleep(5) 
            
    except KeyboardInterrupt:
        print("\nEvolution Loop stopped.")

if __name__ == "__main__":
    run_evolution_loop()
