#!/usr/bin/env python3
"""
The Evolution Loop: A self-improvement cycle for the Studio OS.

Process:
1. Visionary: Analyzes data and "dreams" of a mission (Goal).
2. Collective Intelligence: Registers the goal.
3. Architect: Creates a technical blueprint to achieve the goal.
4. Operator: (Future) Executes the blueprint.
"""

import sys
import os
import json
import logging
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from admin.engineers.visionary import Visionary
from admin.engineers.architect import Architect
from admin.brain.collective_intelligence import get_collective_intelligence

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(name)s] - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("EvolutionLoop")

def run_evolution_cycle():
    print("🧬 STARTING EVOLUTION CYCLE")
    print("=" * 60)
    
    # 1. The Visionary Dreams
    print("\n👁️  Step 1: The Visionary is analyzing system data...")
    visionary = Visionary()
    mission = visionary.dream()
    
    if not mission:
        print("   No clear mission identified. System is stable.")
        return

    print(f"   ✨ Proposed Mission: {mission}")
    
    # 2. Collective Intelligence Registers Goal
    print("\n🧠 Step 2: Registering goal with Collective Intelligence...")
    ci = get_collective_intelligence()
    goal_entry = ci.set_goal(mission, ["Architect", "Operator"], priority="high")
    print(f"   ✅ Goal ID: {goal_entry['id']}")
    
    # 3. The Architect Plans
    print("\n📐 Step 3: The Architect is drafting a blueprint...")
    architect = Architect()
    
    # Check if we have Node connection for complex planning
    if not architect.node_url:
        print("   ⚠️  Studio Node not connected. Cannot generate complex blueprint.")
        print("   (To enable: set STUDIO_NODE_URL environment variable)")
        return

    blueprint = architect.create_blueprint(mission)
    
    if "error" in blueprint:
        print(f"   ❌ Blueprint generation failed: {blueprint['error']}")
    else:
        print("\n   📄 BLUEPRINT GENERATED:")
        print(f"   Summary: {blueprint.get('plan_summary')}")
        print("   Proposed Changes:")
        for change in blueprint.get("changes", []):
            print(f"   • {change['action'].upper()} {change['file']}")
            
        # In a fully autonomous mode, we might execute this.
        # For now, we stop at the proposal stage for safety.
        print("\n   🔒 Execution paused (Safety Mode). Review blueprint before applying.")

    print("\n" + "=" * 60)
    print("✅ Evolution Cycle Complete")

if __name__ == "__main__":
    run_evolution_cycle()
