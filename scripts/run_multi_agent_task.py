import asyncio
import os
import sys
import time
import logging

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.researcher import Researcher
from admin.engineers.alchemist import Alchemist
from admin.engineers.viral_coach import get_viral_coach
from admin.brain.multi_agent_processor import get_orchestrator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(name)s] - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("MultiAgentDemo")

async def main():
    logger.info("🎬 Starting Multi-Agent Parallel Processing Demo")
    
    # Initialize Agents
    logger.info("Initializing agents...")
    researcher = Researcher()
    alchemist = Alchemist()
    coach = get_viral_coach()
    
    topic = "The Rise of Agentic AI Workflows in 2025"
    
    # Task Definitions
    tasks = [
        {
            "id": "Research_Task",
            "agent": researcher,
            "action": "research",
            "params": {"topic": topic, "max_iterations": 1} # Keep it short for demo
        },
        {
            "id": "Drafting_Task",
            "agent": alchemist,
            "action": "generate",
            "params": {"topic": topic}
        },
        {
            "id": "Optimization_Task",
            "agent": coach,
            "action": "analyze",
            "params": {"content": "Placeholder content for viral analysis."}
        }
    ]

    # --- SEQUENTIAL EXECUTION ---
    logger.info("\n--- PHASE 1: Sequential Execution ---")
    seq_start = time.time()
    
    seq_results = {}
    for task in tasks:
        task_id = task['id']
        logger.info(f"Starting {task_id}...")
        start = time.time()
        
        # We manually call execute for sequential comparison
        if asyncio.iscoroutinefunction(task['agent'].execute):
            result = await task['agent'].execute(task['action'], **task['params'])
        else:
            result = task['agent'].execute(task['action'], **task['params'])
            
        seq_results[task_id] = result
        logger.info(f"Finished {task_id} in {time.time() - start:.2f}s")
        
    seq_duration = time.time() - seq_start
    logger.info(f"Total Sequential Time: {seq_duration:.2f}s")

    # --- PARALLEL EXECUTION ---
    logger.info("\n--- PHASE 2: Parallel Execution ---")
    orchestrator = get_orchestrator()
    
    par_start = time.time()
    par_result_data = await orchestrator.run_parallel(tasks)
    par_duration = par_result_data['duration_seconds']
    
    logger.info("\n--- DEMO RESULTS ---")
    logger.info(f"Sequential Duration: {seq_duration:.2f}s")
    logger.info(f"Parallel Duration:   {par_duration:.2f}s")
    
    if par_duration < seq_duration:
        speedup = (seq_duration / par_duration)
        logger.info(f"🚀 Speedup Factor: {speedup:.2x}")
        logger.info(f"✅ Time Saved: {seq_duration - par_duration:.2f}s")
    else:
        logger.info("⚠️ No speedup observed (likely due to overhead or very fast tasks).")

    logger.info("\nDone.")

if __name__ == "__main__":
    asyncio.run(main())
